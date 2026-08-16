# Study Mode — Design Spec (V0)

Tanggal: 2026-08-16
Status: Draft untuk review

## 1. Visi

Study Mode adalah behavior agent coding yang **tetap bekerja autonomously** (membaca, menulis, menguji, memperbaiki) tetapi **berhenti sejenak setelah setiap Logical Work Batch** untuk menjelaskan apa yang baru saja dikerjakan, mengapa dikerjakan dengan cara itu, dan memberi kesempatan developer bertanya sebelum lanjut.

Prinsip inti:

> Agent mengerjakan pekerjaannya, tetapi developer memahami pekerjaannya.

> Jangan menginterupsi eksekusi tiap tool call. Interupsi learning flow hanya saat ada sesuatu yang bermakna untuk dipelajari.

Study Mode BUKAN pengganti Build/Plan, dan BUKAN Manual Mode. Agent tetap autonom penuh di antara checkpoint.

## 2. Temuan Kelayakan

| Kemampuan | Claude Code | OpenCode | Antigravity (AGY) |
|---|---|---|---|
| Custom Study Agent | Ya — `.claude/agents/*.md`, `AgentDefinition` (SDK) | Ya — `.opencode/agents/*.md`, `mode: primary` | Ya — `.agents/agents/*.md`, frontmatter `mainAgent: true` |
| Autonomi antar checkpoint | Ya | Ya | Ya |
| Observasi tool calls | Hooks `PreToolUse`/`PostToolUse`; SDK stream | Plugin `tool.execute.before`/`after`, `session.*` | Hooks `PreToolUse`/`PostToolUse`; transcript JSONL |
| Deteksi batch | Tidak native (self-report / runtime) | Tidak native (sama) | Tidak native (sama) |
| Pause/resume sesi | `--resume`; SDK `continue: true` | Native (satu sesi hidup) | Hooks `PostInvocation` (`terminationBehavior`) / `Stop` (`continue`) |
| Menu interaktif | Tool `AskUserQuestion` | Tool `question` | Tool `ask_question` (multiple-choice) |
| Pertanyaan bebas berkonteks | Ya | Ya | Ya |
| Lanjut dari posisi berhenti | Ya | Ya | Ya |

Kesimpulan: V0 layak dibangun sebagai **custom Study Agent + protocol**, tanpa runtime eksternal. Deteksi batch via self-report. Ketiga platform didukung; Antigravity bahkan menyediakan hooks `injectSteps` yang berguna untuk runtime di fase berikutnya.

## 3. Ruang Lingkup V0

**Satu otak, banyak kulit.** Semua perilaku Study ditulis sekali di protocol canonical; tiap platform hanya punya adapter tipis.

```
code-mentor/
├── STUDY_PROTOCOL.md              ← satu-satunya sumber kebenaran (provider-agnostic)
├── adapters/
│   ├── claude/
│   │   └── .claude/agents/study.md
│   ├── opencode/
│   │   └── .opencode/agents/study.md
│   └── antigravity/
│       └── .agents/agents/study.md
└── docs/superpowers/specs/
    └── 2026-08-16-study-mode-design.md
```

### 3.1 STUDY_PROTOCOL.md (canonical, bahasa Inggris)

Berisi instruksi operasional, di-embed inline ke setiap adapter:

1. **Role** — senior engineer yang mengajar; autonom penuh di antara checkpoint.
2. **Definisi Logical Batch** — sekelompok aksi yang menuju satu tujuan bermakna (sinyal: file yang sama, plan-step, dependency, fase). Batas batch ditentukan agent sendiri (self-report).
3. **Aturan Checkpoint** — berhenti di akhir turn setelah batch selesai; JANGAN berhenti tiap tool call.
4. **Format Checkpoint** — `What / Why / Architecture / Concepts / Verification`, **maksimal 250 kata**, ditulis dari working memory. DILARANG membaca ulang file hanya untuk menjelaskan.
5. **Menu** — gunakan platform's native question tool bila ada, else teks bernomor. Opsi: explain more / why approach / walkthrough kode / konsep terkait / tanya bebas / quiz / continue. "Continue" selalu fast-path.
6. **Aturan menjawab** — jawab dengan konteks proyek + trade-off, bukan jawaban textbook. Tidak ada arsitektur yang selalu benar.
7. **Aturan lanjut** — "continue" = resume build penuh tanpa derail.

### 3.2 Adapter

- **Claude Code** (`adapters/claude/.claude/agents/study.md`): frontmatter `name`, `description`, `tools` (Read, Grep, Glob, Edit, Write, Bash, Task), `model: sonnet`; isi = protocol. Menu via `AskUserQuestion`.
- **OpenCode** (`adapters/opencode/.opencode/agents/study.md`): frontmatter `mode: primary`, `permission` penuh (edit/bash allow); isi = protocol. Menu via `question`.
- **Antigravity** (`adapters/antigravity/.agents/agents/study.md`): frontmatter `name`, `description`, `tools` (view_file, write_to_file, replace_file_content, multi_replace_file_content, grep_search, list_dir, find_by_name, run_command, ask_question), `mainAgent: true`, `subagent: true`, `model: pro`, `commandExecutionPolicy: auto`; isi = protocol. Menu via `ask_question`.

## 4. Budget Token (batasan desain)

- Checkpoint ≤ 250 kata output; jelaskan dari working memory (tanpa baca ulang file).
- Menu singkat; "Continue" fast-path.
- Estimasi: hanya continue → +10–15%; aktif bertanya → +40%+ (tiap pertanyaan ~5.000 token karena riwayat terkirim ulang).
- Observasi eksternal (hooks/plugin) gratis; yang membebani token hanya teks yang ditulis.

## 5. Proof of Concept

Proyek uji: **CLI todo app** kecil di direktori scratch (3 fase: model+storage → command → test).

Alur: jalankan task build dengan agent `study` di Claude Code, OpenCode, dan Antigravity.

Kriteria evaluasi (diukur di kedua platform):
1. Granularitas checkpoint masuk akal (tidak per-tool-call, tidak terlalu jarang)?
2. Menu berfungsi & pilihan kontekstual?
3. Pertanyaan bebas dijawab dengan konteks proyek?
4. "Continue" benar-benar melanjutkan dari posisi berhenti?
5. **Token delta** — kenaikan token riil vs build biasa, diukur agar keputusan berbasis data.
6. Tingkat kelelahan interaksi (tidak annoying)?

## 6. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Deteksi batch tidak andal (terlalu sering/jarang) | Aturan batch eksplisit di protocol; evaluasi PoC |
| Agent lupa berhenti / berhenti di tengah batch | Format checkpoint + menu wajib; uji pada PoC |
| Jawaban generik (textbook) | Aturan "konteks proyek + trade-off" di protocol |
| Token bloat di sesi panjang | Batas 250 kata; depth Quick; compaction opsional |
| Interaksi melelahkan | Menu pendek; "Continue" fast-path |

## 7. Non-Goals V0

- Tidak ada Study Runtime / batch detection eksternal.
- Tidak ada hooks/plugin observer.
- Tidak ada antarmuka web; CLI tetap.
- Tidak ada depth mode (Quick/Guided/Deep) formal — cukup satu mode.

## 8. Evolusi ke Depan (untuk konteks)

Phase 1 (V0 ini): protocol + adapters (Claude Code, OpenCode, Antigravity). Phase 2: Study Runtime (batch detection eksternal dari event tool). Phase 3: Claude Adapter via SDK/hooks. Phase 4: OpenCode Adapter via plugin `tool.execute.*`. Phase 5: Antigravity hooks (`injectSteps`, `terminationBehavior`, transcript JSONL) untuk observasi eksternal.
