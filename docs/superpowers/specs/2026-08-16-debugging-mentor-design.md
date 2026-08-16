# Debugging Mentor — Design Spec (V0)

> Tanggal: 2026-08-16 · Status: DRAFT (menunggu review user)
> Hasil brainstorming sesi 2026-08-16 dengan user.

## 1. Ringkasan

**Debugging Mentor** adalah agent coding yang membantu user **memahami dan
memperbaiki bug** melalui *siklus hipotesis terstruktur*, sambil mengajar di
setiap checkpoint. Satu protocol canonical (`DEBUGGING_PROTOCOL.md`) + tiga
adapter platform (Claude Code, OpenCode, Antigravity) — pola identik dengan
Study Mode V0.

**Perbedaan kunci dengan Study Mode:**

| Aspek | Study Mode | Debugging Mentor |
|---|---|---|
| Aktivitas | Membangun fitur | Memperbaiki bug |
| Batch | Satu fase build | Satu siklus hipotesis |
| Peran agent | Eksekutor + guru | Diagnostik + guru (tidak eksekusi tanpa konfirmasi) |
| Output utama | Fitur jadi | Pemahaman akar masalah + fix terverifikasi |

## 2. Keputusan desain (hasil brainstorming)

| Keputusan | Pilihan | Alasan |
|---|---|---|
| Model interaksi | **Hibrida** | Agent diagnosa & usulkan fix; user **konfirmasi** sebelum eksekusi. Seimbang kecepatan & keterlibatan belajar |
| Pemicu sesi | **User lapor bug** | Masalah konkret: test gagal, error runtime, perilaku salah |
| Cakupan bug | **Semua jenis** | Mentor menyesuaikan pendekatan per jenis |
| Platform | **3 sekaligus** | Claude Code, OpenCode, Antigravity — pola study terbukti |
| Pendekatan arsitektur | **A: Sibling Protocol** | `DEBUGGING_PROTOCOL.md` baru; study mode tidak disentuh |
| Session todo | **Ya, lintas-agent** | Semua sesi (study & debug) maintain todo terlihat |
| Todo Antigravity | **File fallback** | `SESSION_TODO.md` via write_to_file — tidak ada tool todo native |

## 3. Arsitektur & file

```
DEBUGGING_PROTOCOL.md                       ← BARU: canonical, bahasa Inggris
adapters/claude/.claude/agents/debug-mentor.md      ← BARU
adapters/opencode/.opencode/agents/debug-mentor.md  ← BARU
adapters/antigravity/.agents/agents/debug-mentor.md ← BARU
.claude/agents/debug-mentor.md              ← salinan terpasang (root)
.opencode/agents/debug-mentor.md            ← salinan terpasang (root)
.agents/agents/debug-mentor.md              ← salinan terpasang (root)
README.md                                   ← UPDATE: bagian instalasi debug mentor + session todo
poc/bug-hunt/TASK.md                        ← BARU: PoC (3 bug ditanam)
poc/bug-hunt/EVALUATION.md                  ← BARU: checklist evaluasi
STUDY_PROTOCOL.md                           ← UPDATE: tambah bagian Session Todo
adapters/*/agents/study.md + root copies    ← UPDATE: permission/tools todo
```

**Frontmatter adapter `debug-mentor`** — identik dengan study, plus todo:

- **OpenCode** (`mode: primary`): `permission: { edit: allow, bash: allow, question: allow, todowrite: allow }`
- **Claude Code**: `tools: Read, Grep, Glob, Edit, Write, Bash, Task, AskUserQuestion, TodoWrite`
- **Antigravity**: tools list sama seperti study (termasuk `ask_question`) — todo via file fallback, tidak perlu tool tambahan

Nama agent: `debug-mentor` (OpenCode dari nama file; Claude & Antigravity dari `name:`).

## 4. Alur inti (debug cycle)

Satu siklus hipotesis = satu logical batch:

```
1. REPRODUCE/OBSERVE   → kumpulkan gejala: error message, stack trace, langkah reproduksi, test gagal
2. HYPOTHESIZE         → 1–3 hipotesis akar masalah + reasoning (kenapa ini kandidat)
3. VERIFY              → cek bukti: baca kode, log, test — konfirmasi/tolak hipotesis
4. PROPOSE FIX         → usulkan fix + penjelasan kenapa menyelesaikan AKAR masalah (bukan gejala)
5. USER CONFIRM        → agent MENUNGGU konfirmasi sebelum menyentuh kode  [kunci hibrida]
6. EXECUTE & VERIFY    → terapkan fix, jalankan test/verifikasi, pastikan hijau
7. CHECKPOINT          → ringkas pelajaran + menu interaksi
```

Jika hipotesis ditolak pada langkah 3 → kembali ke langkah 2 (hipotesis baru),
bukan memaksa fix. Jika fix gagal verifikasi (langkah 6) → kembali ke siklus.

## 5. DEBUG CHECKPOINT

Maksimal 250 kata, dari working memory, setelah tiap siklus hipotesis:

```
📚 DEBUG CHECKPOINT: <nama batch>
Batch type: Reproduce / Hypothesis / Verify / Fix / Verification
Gejala → Hipotesis → Bukti → Keputusan:
Why (design rationale):
Concepts you encountered:
Verification:
```

Kunci pedagogis: selalu eksplisit membedakan **gejala vs akar masalah**, dan
mencatat hipotesis yang ditolak beserta alasannya (momen belajar paling berharga).

## 6. Learning menu

7 opsi, "Continue" = fast-path:

1. Explain more — perdalam hipotesis
2. Why this hypothesis? — kenapa kandidat ini dipilih, yang lain ditolak
3. Explain the important code
4. Explain a related concept — misal: event loop, closure, off-by-one, race condition
5. Ask my own question
6. Quiz me — uji pemahaman penyebab bug
7. Continue

Menggunakan native question tool platform (`AskUserQuestion` / `question` /
`ask_question`); fallback teks bernomor bila tidak tersedia.

## 7. Kasus tepi

| Skenario | Penanganan |
|---|---|
| Bug tidak bisa direproduksi | Checkpoint khusus: minta langkah reproduksi, lingkungan, data sample; jangan menebak fix |
| Hipotesis salah (verifikasi menolak) | Normal — catat + jelaskan kenapa ditolak; lanjut hipotesis berikutnya |
| User tidak yakin konfirmasi | Jelaskan opsi fix lebih detail, beri rekomendasi |
| Fix gagal verifikasi | Kembali ke siklus hipotesis, bukan force-fix |
| User menolak konfirmasi | Jangan eksekusi; tawarkan hipotesis alternatif |
| Banyak kemungkinan penyebab | Prioritaskan hipotesis berdasarkan bukti, uji satu per satu |

## 8. Session Todo (lintas-agent)

Semua sesi mentor (study & debug) **wajib** maintain todo yang terlihat:

- **OpenCode**: tool native `todowrite` / `todoread` — tambah `todowrite: allow`
- **Claude Code**: tool native `TodoWrite` — tambah ke `tools:`
- **Antigravity**: file `SESSION_TODO.md` di workspace root — dibuat & di-update
  via `write_to_file`; dibaca via `view_file`; dihapus saat sesi selesai

Aturan di kedua protocol:

1. Di awal sesi: buat todo awal dari task (dipecah menjadi batch-batch).
2. Setiap batch selesai: update status todo (checklist, satu baris status).
3. Todo tetap terlihat oleh user di seluruh sesi.
4. Sesi selesai (task done / user selesai): todo final menampilkan ringkasan.

Catatan: mekanisme per platform adalah detail **adapter**, bukan protocol —
protocol hanya menyatakan "maintain session todo". Jika Antigravity kelak
merilis tool todo native, cukup ganti mekanisme di adapter Antigravity.

## 9. Evaluasi (PoC bug-hunt)

Pola sama dengan study mode.

**`poc/bug-hunt/TASK.md`** — proyek kecil (CLI todo sederhana) dengan **3 bug
ditanam**: satu logic bug (perilaku salah tanpa error), satu runtime error
(crash), satu test failure (unit test gagal). User melaporkan tiap bug ke
debug mentor.

**`poc/bug-hunt/EVALUATION.md`** — checklist:

1. **Kualitas diagnosa**: gejala → akar masalah akurat, bukan tebak-tebakan?
2. **Ketepatan hipotesis**: hipotesis yang diajukan masuk akal & diuji dengan bukti?
3. **Kualitas penjelasan**: kontekstual + trade-off, bukan textbook?
4. **Kepatuhan model hibrida**: tidak pernah eksekusi fix tanpa konfirmasi user?
5. **Pengalaman interaksi**: jumlah checkpoint wajar, menu kontekstual?
6. **Token delta**: baseline (agent build) vs debug mentor, ekspektasi +10–15%?

## 10. Batasan V0

- Tanpa runtime, hooks, atau observer — perilaku di-enforce oleh prompt (LLM
  mengikuti protocol), bukan kode.
- Nama tool Antigravity harus **persis** (dokumentasi resmi memperingatkan nama
  salah bisa membuat subagent hang).
- `DEBUGGING_PROTOCOL.md` dalam bahasa Inggris; plan & dokumentasi dalam Bahasa
  Indonesia.
- Estimasi token: hanya continue → +10–15%; tiap pertanyaan bebas ≈ +5.000 token.

## 11. Deliverables

| # | Deliverable |
|---|---|
| 1 | `DEBUGGING_PROTOCOL.md` (canonical, EN) |
| 2 | 3 adapter `debug-mentor` (adapters/ + root copies) |
| 3 | Session Todo: update STUDY_PROTOCOL.md + 6 adapter agent |
| 4 | README.md update (instalasi debug mentor + session todo) |
| 5 | `poc/bug-hunt/TASK.md` + `EVALUATION.md` |
