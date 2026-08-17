# Antigravity Enforcement — Research & Implementation Notes

> Task 3 of **Enforcement Phase 1**. Covers the Antigravity plugin/hooks research and the
> `enforce-mentor` plugin implementation.
>
> **Status of this implementation: BELUM TERVERIFIKASI** (see §4). The plugin's format and
> behavior are grounded in official docs + a real local transcript, but the hook has **not**
> been executed inside a live Antigravity agent session.

---

## 1. Research findings

### 1.1 Sources (fetched 2026-08-17)

| Source | URL |
|---|---|
| Plugins (Antigravity 2.0) | https://antigravity.google/docs/plugins/ |
| Hooks (Antigravity 2.0) | https://antigravity.google/docs/hooks/ |
| Plugins & Skills (Antigravity CLI) | https://antigravity.google/docs/cli/plugins/ |
| Hooks (Antigravity IDE) | https://antigravity.google/docs/ide/hooks/ (link discovered via docs nav; not fetched — the 2.0 pages cover the same model) |
| Local install (empirical) | `~/.gemini/antigravity/brain/*/.system_generated/logs/transcript.jsonl` |

### 1.2 Plugin format & location (CONFIRMED from docs)

A plugin is a **directory** (not a single file) with a mandatory `plugin.json` marker plus
optional `hooks.json` / `mcp_config.json` / `skills/` / `rules/` / `agents/`:

```
plugins/<plugin-name>/
├── plugin.json       # Required marker file
├── hooks.json        # Optional hooks definition
├── mcp_config.json   # Optional MCP servers
├── skills/           # Optional skills (SKILL.md per skill)
└── rules/            # Optional rules (markdown)
```

- **Workspace level:** `.agents/plugins/` or `_agents/plugins/` at the workspace root.
- **Global level:** `~/.gemini/config/plugins/`.
- `plugin.json` manifest: `{ "name": "enforce-mentor" }` (name optional in 2.0 docs, defaults to
  directory name; the CLI schema also supports `description` and a `$schema` URL).

> Note: the repo's global agents path `~/.gemini/config/agents` matches the same
> `~/.gemini/config/` customization directory — consistent with Antigravity **2.0** (desktop),
> which is the target for this plugin. The **CLI** (`agy`) instead stages plugins under
> `~/.gemini/antigravity-cli/plugins/` and manages them via `agy plugin <install|list|validate|...>`.

### 1.3 Hooks available (the tool.execute.after / PostToolUse equivalent)

Configured in `hooks.json` (inside the plugin dir, or in the customization dir). Schema maps a
hook name → event config:

```json
{
  "enforce-mentor": {
    "PreInvocation": [
      { "type": "command", "command": "node .agents/plugins/enforce-mentor/enforce-mentor.js", "timeout": 30 }
    ]
  }
}
```

Events:

| Event | Fires | Matcher target | Can inject? |
|---|---|---|---|
| `PreToolUse` | before a tool executes | tool name | only `decision` gating (allow/deny/ask) — no message injection |
| `PostToolUse` | after a tool completes | tool name | **NO** — output is an empty `{}` |
| `PreInvocation` | before the model is called | ignored | **YES — `injectSteps[].ephemeralMessage`** |
| `PostInvocation` | after each model invocation | ignored | **YES — `injectSteps` + `terminationBehavior`** |
| `Stop` | loop terminates | ignored | `decision: "continue"` + `reason` |

**Key finding:** `PostToolUse` returns only `{}` — it cannot inject a reminder. The correct
soft-reminder path is **`PreInvocation`** returning
`{ "injectSteps": [{ "ephemeralMessage": "<system reminder text>" }] }`. This is a transient
system message the model reads on its next turn — the closest Antigravity equivalent to
Claude Code's `additionalContext` / OpenCode's `output.output` mutation.

### 1.4 Reminder injection & token usage

- **Input contract:** every hook receives JSON on **stdin** with common fields
  `conversationId`, `workspacePaths`, `transcriptPath`, `artifactDirectoryPath`, `modelName`.
  `PreInvocation` adds `invocationNum` and `initialNumSteps`. Output is returned as JSON on
  **stdout** (exit 0 = continue).
- **Tool response is NOT in the payload.** `PreInvocation`/`PostToolUse` carry only
  `toolCall { name, args }` / `stepIdx` / `error` — not the tool's output text. To detect the
  checkpoint regex (`/(DEVELOP|DEBUG|REFACTOR) CHECKPOINT:/i`) we must parse the conversation
  **transcript** at `transcriptPath` (see §1.5).
- **Token usage is NOT exposed** anywhere in the hook payload. The docs describe no usage
  fields, and — empirically verified on this machine across **14 local transcripts** — the
  `transcript.jsonl` contains **zero** token/usage keys (`input_tokens`, `output_tokens`,
  `usage`, etc. → 0 matches). Therefore the `📊 tokens: ...` display line **cannot be
  produced** on the current install; it is implemented defensively (a tolerant extractor that
  only emits the line if usage-like fields ever appear) and disabled in practice by absence of
  data.

### 1.5 Transcript format (EMPIRICALLY VERIFIED on this machine)

`transcript.jsonl` lives at
`<app_data_dir>/brain/<conversationId>/.system_generated/logs/transcript.jsonl` where
`<app_data_dir>` = `~/.gemini/antigravity` (2.0) or `~/.gemini/antigravity-cli` (CLI). Each line
is a JSON step:

```json
{"step_index":0,"source":"USER_EXPLICIT","type":"USER_INPUT","status":"DONE","created_at":"...","content":"..."}
{"step_index":2,"source":"MODEL","type":"PLANNER_RESPONSE","status":"DONE","created_at":"...","content":"I will list the files...","tool_calls":[{"name":"list_dir","args":{...}}]}
{"step_index":3,"source":"MODEL","type":"LIST_DIRECTORY","status":"DONE","created_at":"...","content":"Created At: ... \n{...dir listing...}"}
```

Verified facts:

1. Tool **calls** = entries in `tool_calls` on `MODEL` / `PLANNER_RESPONSE` lines. Tool **results**
   = MODEL lines whose `type` is the tool name (e.g. `RUN_COMMAND`, `LIST_DIRECTORY`, `VIEW_FILE`),
   with the output text in `content`.
2. The model's own message text is the `content` of `PLANNER_RESPONSE` lines.
3. `step_index` is a stable increasing integer per conversation — usable as a "already processed"
   watermark.
4. **No token/usage fields** in any of the 14 local transcripts (verified 2026-08-17).

---

## 2. Implementation (what was built)

### `.agents/plugins/enforce-mentor/` (workspace-level plugin, Antigravity 2.0)

- `plugin.json` — manifest marker.
- `hooks.json` — registers the hook on **`PreInvocation`** (matcher ignored) running
  `node .agents/plugins/enforce-mentor/enforce-mentor.js`.
- `enforce-mentor.js` — the hook handler (Node, reads stdin JSON, writes stdout JSON, exit 0;
  never throws/blocks).

### Behavior (mirrors Tasks 1/2 logic)

- **Checkpoint signal** = any newly-processed transcript step whose content matches
  `/(DEVELOP|DEBUG|REFACTOR) CHECKPOINT:/i` (covers both tool results *and* model-presented
  checkpoint headings) **OR** a tool call named like a todo tool (`/todo/i`). On signal:
  counter resets to 0.
- **Threshold N:** default 5, clamped to minimum 3, from `ENFORCE_MENTOR_N`.
- **Reminder:** after N consecutive non-signal tool calls, injects via
  `{ "injectSteps": [{ "ephemeralMessage": "System reminder: you appear to have completed a
  logical batch (N tool calls without a checkpoint). Per the protocol, STOP and present a
  📚 DEVELOP/DEBUG/REFACTOR CHECKPOINT: <batch name>, then re-issue the session todo before
  continuing." }] }` — the detectable heading form, matching the OpenCode implementation.
  Counter resets after firing (periodic cadence).
- **Token display:** `📊 tokens: +X in / +Y out (session total Z)` appended to the injected
  message when usage fields exist at a checkpoint/reminder. Disable via
  `ENFORCE_MENTOR_TOKENS=0|false|off|no`. **On the current install there is no usage data, so
  the token line never appears** — this is a documented data limitation, not a bug.
- **State:** per-conversation state in `os.tmpdir()/antigravity-enforce-mentor-state.json`,
  keyed by `conversationId` (`ENFORCE_MENTOR_STATE_FILE` overrides for testing), bounded to 200
  sessions, atomic-ish write (tmp + rename). Transcript steps are watermarked by `step_index`
  so re-runs are idempotent.
- **Non-destructive:** exit 0 always; malformed stdin, missing/unreadable transcript, or
  corrupt state file all degrade to `{}` with no crash.

---

## 3. Verification results

Environment (this machine, 2026-08-17): Node v22.23.2, Antigravity CLI `agy` v1.1.13,
Antigravity 2.0 data dir `~/.gemini/antigravity` present (14 conversations), desktop app binary
NOT found (staging dir empty) — consistent with the known "broken/empty local install" history.

- **`node --check`:** clean (0 errors).
- **`plugin.json` / `hooks.json`:** valid JSON.
- **`agy plugin validate .agents/plugins/enforce-mentor`** (real Antigravity CLI):
  `[ok] ... hooks: 1 processed` — the plugin directory + `hooks.json` format is accepted by the
  official validator.
- **Smoke tests (11/11 passed)** — drove the real module with synthetic transcripts shaped
  exactly like the verified local format:
  - reminder fires at exactly N=5; uses the detectable heading form;
  - regex checkpoint in tool result resets the counter; model-presented heading resets it too;
  - todo-like tool resets the counter;
  - N=2 clamps to 3 (fires at 3, not at 2);
  - `ENFORCE_MENTOR_TOKENS=off` → no token line;
  - token line emitted when usage-like fields are present (future-proof extractor);
  - missing transcript → `{}`; corrupt state file → no crash.
- **Real transcript run:** fed a real 412-line transcript from this machine's Antigravity data
  dir → reminder injected after 5 tool calls (matching `PLANNER_RESPONSE.tool_calls` count);
  second/third runs with the same transcript returned `{}` (watermark works). No token line
  emitted, as expected (no usage data).

### Verified vs. unverified

| Claim | Status |
|---|---|
| Plugin = directory + `plugin.json` (+ `hooks.json`) | ✅ docs + `agy plugin validate` |
| Workspace discovery path `.agents/plugins/` | ✅ docs (2.0) |
| `PreInvocation` `injectSteps[].ephemeralMessage` is the injection mechanism | ✅ docs |
| `PostToolUse` output is `{}` (cannot inject) | ✅ docs |
| Transcript format + `step_index`/`tool_calls`/`content` | ✅ empirical (local transcripts) |
| No token usage anywhere in hook payload/transcript | ✅ empirical (14 transcripts) |
| Hook actually executes inside a live Antigravity session & the model reads the ephemeralMessage | ❌ **NOT testable here** (desktop app binary absent/broken) |
| `command` cwd assumption (workspace-relative `node .agents/...`) | ❌ unverified — see §4.3 |

---

## 4. Limitations & concerns (BEHIND THIS DOC'S "BELUM TERVERIFIKASI" FLAG)

1. **Live end-to-end run impossible on this machine.** The Antigravity 2.0 desktop app binary
   is missing from the expected install locations (`%LOCALAPPDATA%\Programs\antigravity\`,
   `%LOCALAPPDATA%\Google\Antigravity`, `%APPDATA%\Antigravity\bin` has only `agy-node.cmd`).
   The data dir exists but the app itself is absent/broken (matching the project's session
   history). Only the CLI (`agy`) is runnable, and it targets the **CLI** plugin root
   (`~/.gemini/antigravity-cli/plugins/`), not the 2.0 workspace `.agents/plugins/`. So whether
   the workspace plugin is actually discovered and whether the injected `ephemeralMessage`
   reaches the model remain unverified.
2. **Token display is data-limited.** No token usage exists in hook payloads or transcripts on
   this install, so `📊 tokens: ...` will not appear in practice. If/when Antigravity exposes
   usage, the tolerant extractor should pick it up — but the exact key names are unknown and
   unverifiable here.
3. **`command` cwd is assumed workspace-relative.** Docs show `./scripts/lint.sh` style commands
   but do not state the working directory. We used `node .agents/plugins/enforce-mentor/...`
   (workspace-relative). If Antigravity runs hooks from the customization/plugin dir, the path
   must be adjusted (e.g. `node enforce-mentor.js`). Unverifiable locally.
4. **Reminder cadence** mirrors Tasks 1/2 (reset after firing) but the transcript is parsed
   incrementally between `PreInvocation` events; if a transcript lags async writes, a reminder
   may fire one invocation late. Benign (advisory only).
5. **Parallel tool calls** could interleave transcript lines; counting is step-based, so a burst
   of parallel calls counts as that many calls — same semantics as Tasks 1/2.
6. **`ephemeralMessage` persistence is unknown.** Docs call it "transient"; if Antigravity also
   writes it to the transcript, the next run's regex scan could see our own reminder text (which
   contains the heading form). We reset the counter immediately after injecting, so this is
   self-consistent either way.
7. **Regex over whole step content** also matches the model's *presented* checkpoint heading
   (not just tool responses). This is a deliberate, stricter-correct superset of Tasks 1/2
   (which only inspect tool outputs) — it prevents false reminders after a real checkpoint and
   does not weaken enforcement.

---

## 5. Install / usage

Place the plugin in the workspace (already committed here at `.agents/plugins/enforce-mentor/`)
or copy it to the global customization dir `~/.gemini/config/plugins/`. No config entry is
needed — Antigravity auto-scans `.agents/plugins/`.

Config via environment (set in the Antigravity launch environment):

- `ENFORCE_MENTOR_N` — reminder threshold, default 5, min 3.
- `ENFORCE_MENTOR_TOKENS` — `0|false|off|no` disables the token line (default on).
- `ENFORCE_MENTOR_STATE_FILE` — override the shared state file path (testing).

Verify once Antigravity runs on this machine: open a session, make ≥5 tool calls without a
checkpoint, and confirm the model receives the system reminder; confirm `/hooks` in the CLI or
the Customizations UI lists the plugin.
