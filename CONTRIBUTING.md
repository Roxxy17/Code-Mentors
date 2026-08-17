# Contributing to Code Mentors

Thanks for helping grow Code Mentors! The project is designed so that adding
a new mentor is genuinely simple — most of the machinery lives in the shared
CORE protocol, so a new mentor is mostly new *content*, not new *code*.

## Ground rules

- Everything is Markdown agent files + one PowerShell drift-checker. No build
  step, no runtime.
- Protocols (`*_PROTOCOL.md`) are written in English.
- Adapter bodies are composed as `mentor-specific + CORE block` (verbatim).
- The drift-checker `scripts/verify-copies.ps1` must always pass:
  `powershell -ExecutionPolicy Bypass -File scripts/verify-copies.ps1`

## How to add a new mentor

1. **Create the mentor protocol** at the repo root, e.g. `X_PROTOCOL.md`, with
   the mentor-specific sections only:
   - intro paragraph (what this mentor does)
   - `## Role`
   - `## Logical Batch (when to checkpoint)`
   - `## Edge cases` (optional)
   - `<MENTOR> CHECKPOINT format`
   - a `## Shared mechanics` pointer to `CORE_PROTOCOL.md`
2. **Create one adapter per platform** under `adapters/<platform>/.../agents/`:
   - OpenCode: `mode: primary` + `permission: { edit, bash, question, todowrite: allow }`
   - Claude Code: `name: <mentor>` + `tools:` allowlist (include
     `AskUserQuestion` and `TodoWrite`) + `model: sonnet`
   - Antigravity: `name:` + the exact 9 snake_case tools (including
     `ask_question`) + `mainAgent/subagent/model/commandExecutionPolicy`
   - Body = `mentor-specific + CORE block` (CORE block = `CORE_PROTOCOL.md`
     from `## Session Todo` to EOF, verbatim)
3. **Copy to root** for project-level use:
   `.opencode/agents/`, `.claude/agents/`, `.agents/agents/`
4. **Update `scripts/verify-copies.ps1`** — add the mentor to the `$pairs` and
   `$checkpoint` tables.
5. **Run the drift-checker** and make sure it reports `ALL OK`, exit `0`.
6. Add a row to the README mentors table.

## Adding a checkpoint tool or menu option (shared)

Because mechanics live in `CORE_PROTOCOL.md`, changing the learning menu,
session todo, or answering rules means:
1. Edit `CORE_PROTOCOL.md`.
2. Re-embed the CORE block into all adapters (from `## Session Todo` to EOF).
3. Run the drift-checker — it will flag any adapter you missed.

## Reporting bugs

Use the bug report template. Include: which platform, which mentor, the exact
steps, and whether the drift-checker passes on your copy.

## Style

- Keep checkpoint bodies ≤ 250 words.
- Preserve UTF-8 (em-dashes, arrows, emoji) — do not let editors re-encode.
- Commit messages: `feat:`, `fix:`, `docs:`, `refactor:`, `style:`, `chore:`.

## Code of conduct

Be respectful. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
