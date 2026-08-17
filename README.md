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
cp adapters/claude/.claude/agents/study-mode.md ~/.claude/agents/study-mode.md
# atau per proyek
cp -r adapters/claude/.claude ./
```

Pemakaian: buka `claude`, pilih agent `study-mode`, beri task.

### OpenCode

```bash
# Global
mkdir -p ~/.config/opencode/agents
cp adapters/opencode/.opencode/agents/study-mode.md ~/.config/opencode/agents/study-mode.md
# atau per proyek
cp -r adapters/opencode/.opencode ./
```

Pemakaian: buka `opencode`, tekan `Tab` untuk pilih agent `study-mode`.

### Antigravity 2.0

```bash
# Global
mkdir -p ~/.gemini/config/agents
cp adapters/antigravity/.agents/agents/study-mode.md ~/.gemini/config/agents/study-mode.md
# atau per proyek
mkdir -p .agents/agents
cp adapters/antigravity/.agents/agents/study-mode.md .agents/agents/study-mode.md
```

Pemakaian: buka Antigravity, pilih agent `study-mode` (mainAgent), beri task.

## Mengukur konsumsi token

Bandingkan dua run pada task yang sama:

1. **Baseline**: jalankan task dengan agent build biasa, catat usage.
2. **Study**: jalankan task yang sama dengan agent `study-mode`, catat usage.

Catat angka di `poc/todo-cli/EVALUATION.md`. Ekspektasi: hanya continue →
+10–15%; tiap pertanyaan bebas ≈ +5.000 token.

> Observasi eksternal (hooks/plugin) gratis — yang membebani token hanya
> teks yang benar-benar ditulis.

## Debugging Mentor (V0)

Sibling dari Study Mode — membantu memahami & memperbaiki bug melalui siklus
hipotesis. Model hibrida: agent diagnosa → usulkan fix → **user konfirmasi** →
eksekusi & verifikasi.

Instalasi: salin `adapters/<platform>/.../debug-mentor.md` ke lokasi yang
sama dengan study agent (lihat bagian instalasi di atas, ganti nama file
menjadi `debug-mentor.md`).

## Session Todo

Semua agent mentor (study-mode, debug, refactoring) memelihara todo yang terlihat:
- OpenCode: tool native `todowrite` (permission `todowrite: allow` sudah ada di adapter).
- Claude Code: tool native `TodoWrite` (sudah ada di `tools:`).
- Antigravity: file `SESSION_TODO.md` di workspace root (fallback, dibuat & dihapus oleh agent).

## Refactoring Mentor (V0)

Mentor ke-3 — merombak kode dengan aman (behavior-preserving). Model hibrida:
diagnosa → usulkan → **user konfirmasi** → terapkan → verifikasi (test).

Instalasi: salin `adapters/<platform>/.../refactor-mentor.md` ke lokasi yang
sama dengan agent lain (lihat bagian instalasi di atas).

## Shared Core

Semua mentor berbagi mekanika dari `CORE_PROTOCOL.md` (Session Todo, Learning
menu, Answering questions, Continuing, Token budget). Protocol per-mentor
hanya berisi bagian spesifik; body adapter = komposisi mentor + CORE.

## Memverifikasi konsistensi (anti-drift)

Jalankan untuk memastikan root copies, adapter, dan canonical sinkron:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-copies.ps1
```

Exit 0 = semua sinkron; exit 1 = ada mismatch (perbaiki file yang disebutkan).
