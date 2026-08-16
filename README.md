# Code Mentor — Study Mode (V0)

Agent coding yang **membangun secara autonom** sambil **mengajar di
checkpoint yang bermakna**. Berbasis satu protocol + adapter per platform.

## Cara kerja

`Agent → [Batch → STUDY CHECKPOINT → Menu → Tanya/Jawab → Continue] × N → Done`

- **Batch**: unit kerja logis (bukan per tool call).
- **Checkpoint**: ≤ 250 kata — what / why / architecture / concepts / verification.
- **Menu**: tool question native platform (AskUserQuestion / question / ask_question).
- **Continue**: resume build penuh.

## Instalasi

### Claude Code

```bash
# Global
mkdir -p ~/.claude/agents
cp adapters/claude/.claude/agents/study.md ~/.claude/agents/study.md
# atau per proyek
cp -r adapters/claude/.claude ./
```

Pemakaian: buka `claude`, pilih agent `study`, beri task.

### OpenCode

```bash
# Global
mkdir -p ~/.config/opencode/agents
cp adapters/opencode/.opencode/agents/study.md ~/.config/opencode/agents/study.md
# atau per proyek
cp -r adapters/opencode/.opencode ./
```

Pemakaian: buka `opencode`, tekan `Tab` untuk pilih agent `study`.

### Antigravity 2.0

```bash
# Global
mkdir -p ~/.gemini/config/agents
cp adapters/antigravity/.agents/agents/study.md ~/.gemini/config/agents/study.md
# atau per proyek
mkdir -p .agents/agents
cp adapters/antigravity/.agents/agents/study.md .agents/agents/study.md
```

Pemakaian: buka Antigravity, pilih agent `study` (mainAgent), beri task.

## Mengukur konsumsi token

Bandingkan dua run pada task yang sama:

1. **Baseline**: jalankan task dengan agent build biasa, catat usage.
2. **Study**: jalankan task yang sama dengan agent `study`, catat usage.

Catat angka di `poc/todo-cli/EVALUATION.md`. Ekspektasi: hanya continue →
+10–15%; tiap pertanyaan bebas ≈ +5.000 token.

> Observasi eksternal (hooks/plugin) gratis — yang membebani token hanya
> teks yang benar-benar ditulis.
