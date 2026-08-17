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

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) — adding a new mentor is
straightforward: reuse the CORE protocol, add one adapter per platform.

## License

[MIT](LICENSE)
