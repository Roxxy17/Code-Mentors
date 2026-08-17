# Code Mentors

Multi-platform coding agents that **build, fix, and refactor while teaching**.
Three mentor agents share one protocol core and run as plain Markdown agent
files on OpenCode, Claude Code, and Antigravity — **no runtime, no build step**.

- 🟡 **develop-mentor** — builds features autonomously, teaches at each checkpoint
- 🟣 **debug-mentor** — fixes bugs through structured hypothesis cycles
- 🟢 **refactor-mentor** — refactors code safely (behavior-preserving), confirming before each change

## Quick start (OpenCode)

```bash
mkdir -p ~/.config/opencode/agents
cp adapters/opencode/.opencode/agents/develop-mentor.md ~/.config/opencode/agents/
```

1. Restart opencode, press `Tab`, pick `develop-mentor`.
2. Give it a task — for example: `build a CLI todo app`.
3. It works in logical batches, then stops at each **DEVELOP CHECKPOINT** to teach and present a menu.

## Mentors

| Agent | What it does | Model | Color (OpenCode) |
|---|---|---|---|
| `develop-mentor` | Build features while teaching | do + teach | 🟡 yellow |
| `debug-mentor` | Diagnose & fix bugs via hypothesis cycles | hybrid — you confirm fixes | 🟣 purple |
| `refactor-mentor` | Safe refactoring (behavior-preserving) | hybrid — you confirm changes | 🟢 green |

## How it works

- **`CORE_PROTOCOL.md`** — shared mechanics for every mentor: session todo,
  learning menu, answering questions, continuing, token budget.
- **Mentor protocols** — `DEVELOPING_PROTOCOL.md`, `DEBUGGING_PROTOCOL.md`,
  `REFACTORING_PROTOCOL.md` — only the mentor-specific behavior.
- **Adapters** — one per platform per mentor. Each body is
  `mentor-specific + CORE`, fully self-contained.
- **Session todo** — every session keeps a visible checklist, re-issued
  before each checkpoint.
- **Anti-drift** — `scripts/verify-copies.ps1` guarantees adapters and
  canonical protocols never silently diverge.

## Install

### OpenCode

```bash
mkdir -p ~/.config/opencode/agents
cp adapters/opencode/.opencode/agents/*.md ~/.config/opencode/agents/
# restart, press Tab, pick an agent
```

### Claude Code

```bash
mkdir -p ~/.claude/agents
cp adapters/claude/.claude/agents/*.md ~/.claude/agents/
```

### Antigravity 2.0

```bash
# global
mkdir -p ~/.gemini/config/agents
cp adapters/antigravity/.agents/agents/*.md ~/.gemini/config/agents/
# or per project
mkdir -p .agents/agents
cp adapters/antigravity/.agents/agents/*.md .agents/agents/
```

### Per project (any platform)

```bash
cp -r adapters/opencode/.opencode ./
```

## Verify consistency (anti-drift)

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-copies.ps1
```

Exit `0` = everything in sync. Exit `1` = a mismatch (fix the listed files).

## Measuring token cost

Run the same task with a normal build agent and with a mentor agent, then
compare usage. Expected: continue-only → +10–15%; each free-form question
≈ +5,000 tokens. See `poc/` for the evaluation kit.

## Phase 1 — Mentor enforcement (soft reminder)

A non-destructive helper that keeps mentor agents honest about checkpointing:
it never blocks, never gates, and never throws — it only nudges.

**What it does**

- Counts tool calls in each session. After `N` consecutive calls (default **5**,
  minimum **3**) without a checkpoint signal, it injects a soft system reminder
  to stop and present a `DEVELOP`/`DEBUG`/`REFACTOR CHECKPOINT:` (and re-issue
  the session todo) before continuing.
- A checkpoint signal resets the counter. A signal is a tool response containing
  `(DEVELOP|DEBUG|REFACTOR) CHECKPOINT:` **or** a todo-tool call
  (`todowrite`/`TodoWrite`/`updateTodo`).
- **Signal detection scope** — OpenCode and Claude Code check **tool output** for
  the checkpoint heading (they cannot see the model's presented text), while
  Antigravity scans the **whole transcript step** (tool result + model text).
  This is a documented intentional difference; the reliable cross-platform
  signal is the **TodoWrite** call, so prefer it over heading text.
- At checkpoints and reminders it appends a token display line:
  `📊 tokens: +X in / +Y out (session total Z)` — the delta since the last
  checkpoint plus the cumulative session total (OpenCode uses real per-message
  token usage; Claude Code approximates by summing the transcript's
  `message.usage` fields).

**Configuration** (environment variables)

| Variable | Meaning | Default |
|---|---|---|
| `ENFORCE_MENTOR_N` | Tool calls before a reminder fires (clamped to ≥ 3) | `5` |
| `ENFORCE_MENTOR_TOKENS` | `0`, `false`, `off`, `no` disables the token line | on |

**Install**

- **OpenCode** — no setup. The plugin at `.opencode/plugin/enforce-mentor.ts` is
  auto-discovered when the project is opened. Copy it into another project
  (e.g. `cp -r .opencode ./`) to enable enforcement there.
- **Claude Code** — hooks-based. The relevant files are `.claude/settings.json`
  (registers a `PostToolUse` hook) and `scripts/claude-enforce-hook.js` (the
  handler). Keep both together: the hook runs on `Read|Edit|Write|Bash|TodoWrite`
  and requires the script at `scripts/claude-enforce-hook.js`.
- **Antigravity 2.0** — research-based implementation at
  `.agents/plugins/enforce-mentor/` (plugin dir + `PreInvocation` hook injecting
  an `ephemeralMessage`). **Verification is limited**: the plugin's format is
  validated by the official CLI, but a live end-to-end run was not possible on
  this machine (no runnable Antigravity desktop app), and the token display is
  data-limited (no usage data in hook payloads/transcripts). See
  [docs/antigravity-enforcement-notes.md](docs/antigravity-enforcement-notes.md)
  for details and open concerns.

> Caveat: live end-to-end verification is pending on some platforms (notably
> Antigravity; Claude Code's hook payload also does not expose real per-tool
> usage, so its token line is a transcript-based approximation). The reminder
> is advisory only and safe to enable everywhere.
>
> **Acceptance gate:** a live end-to-end session run is the acceptance gate for
> Phase 1 (EVALUATION items 1–3 in `poc/todo-cli/EVALUATION.md` — reminder fires
> after N calls, does not block the flow, token display at checkpoints). It is
> still pending a real session run.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) — adding a new mentor is
straightforward: reuse the CORE protocol, add one adapter per platform.

## License

[MIT](LICENSE)
