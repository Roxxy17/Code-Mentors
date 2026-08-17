# Enforcement Phase 1 — Design Spec (V0)

> Tanggal: 2026-08-16 · Status: DRAFT (menunggu review user)
> Hasil brainstorming sesi 2026-08-16.

## 1. Ringkasan

Phase 1 menambahkan **lapisan kode enforcement** di atas agent mentor
markdown. Tujuannya: menyelesaikan secara struktural kelas bug "agent tidak
patuh" yang ditemukan di V0 (contoh nyata: todo checklist beku karena agent
tidak update per-batch).

Dua fitur:
1. **Enforcement** — soft reminder ketika agent berjalan terlalu lama tanpa
   checkpoint/todo update.
2. **Token display** — angka token terlampir otomatis di setiap checkpoint
   (bukan enforcement, tapi info yang user harapkan "langsung terlihat").

Arsitektur tetap hybrid: **agent definitions tetap markdown** (protocol +
adapters), **enforcement & display berupa kode per platform** (plugin/hooks).

## 2. Keputusan desain (hasil brainstorming)

| Aspek | Pilihan | Alasan |
|---|---|---|
| Scope enforcement | Todo + checkpoint rhythm | Menyelesaikan akar bug V0 |
| Enforcement token | **Dihapus** | User tidak ingin mekanisme hitungan token sebagai penjaga |
| Kekuatan enforcement | **Soft reminder** | Tidak mengganggu alur, tapi menegur |
| Deteksi | **Hitungan tool call** sejak sinyal checkpoint terakhir | Sederhana, dapat diandalkan |
| Token display | **Ya, sebagai fitur terpisah** | User ingin angka token "terlampir di hasil tiap selesai" |
| Platform | 3 (OpenCode, Claude Code, Antigravity) | Satu rencana, urutan OpenCode → Claude → Antigravity |

## 3. Enforcement behavior

### 3.1 Sinyal checkpoint

Suatu tool call "menghitung" sebagai sinyal checkpoint jika:
- Respons agent mengandung heading checkpoint: `DEVELOP CHECKPOINT:`,
  `DEBUG CHECKPOINT:`, atau `REFACTOR CHECKPOINT:`; ATAU
- Agent memanggil tool `todowrite` / `TodoWrite` (todo wajib di-update tiap
  batas batch).

### 3.2 Ambang & reminder

- **Ambang N** (configurable, default **5**): jika agent melakukan N tool call
  berturut-turut tanpa sinyal checkpoint, sistem menyuntikkan reminder ke
  percakapan.
- **Teks reminder** (mentor-generic, disesuaikan per platform):
  > "System reminder: you appear to have completed a logical batch. Per the
  > protocol, present a <MENTOR> CHECKPOINT and re-issue the session todo
  > before continuing."
- Setelah reminder disuntikkan, penghitung di-reset.

### 3.3 Non-destruktif

- Reminder hanya **menambahkan pesan**, tidak mengubah/memblokir tool call
  agent.
- Threshold N tidak boleh terlalu kecil (< 3) agar tidak mengganggu batch
  kecil yang sah.

## 4. Token display behavior

- Ketika checkpoint terdeteksi (heading muncul), sistem **melampirkan ringkasan
  token sesi** pada output: input, output, dan total untuk sesi/checkpoint
  terakhir.
- Format (per platform):
  `📊 tokens: +X in / +Y out (session total Z)`
- Data token dari mekanisme usage platform:
  - OpenCode: `state.usage` pada tool output / data sesi
  - Claude Code: usage pada API response hooks
  - Antigravity: tergantung sistem plugin (riset)
- Token display **opsional disable** via config.

## 5. Implementasi per platform

### 5.1 OpenCode — plugin (TypeScript/JS)

- File: `.opencode/plugin/enforce-mentor.ts`
- Hook `tool.execute.after`: hitung tool call sejak sinyal checkpoint
  terakhir; jika melewati N, injeksi pesan reminder via `chat.message` /
  `tool.execute.before`; deteksi checkpoint dari isi output; lampirkan
  token dari `state.usage`.

### 5.2 Claude Code — hooks

- File: `.claude/settings.json` (hooks) — `PostToolUse` dan `PreToolUse`
- Logika sama; reminder via system message / notification.
- Token dari usage pada hook.

### 5.3 Antigravity — plugin

- Riset sistem plugin/hooks Antigravity terlebih dahulu.
- **Risiko tinggi**: instalasi lokal di mesin pengembangan rusak/kosong,
  kemungkinan besar tidak bisa diuji langsung. Hasil: implementasi + catatan
  verifikasi terbatas.

## 6. Deliverables

| # | Deliverable | Platform |
|---|---|---|
| 1 | Plugin enforcement + token display | OpenCode |
| 2 | Hooks enforcement + token display | Claude Code |
| 3 | Plugin enforcement + token display (riset & implementasi, verifikasi terbatas) | Antigravity |
| 4 | README update (cara install & konfigurasi) | — |
| 5 | EVALUATION update (hasil uji enforcement) | — |

## 7. Batasan & risiko

- Kode enforcement **platform-specific** — tidak ada satu implementasi untuk
  semua; logika sama, per platform beda.
- Antigravity: sistem plugin belum terverifikasi; pengujian terbatas di mesin
  ini.
- Enforcement tetap membiarkan agent memutuskan ISI checkpoint (soft) —
  hanya memastikan checkpoint/todo MUNCUL.
- Token display bergantung pada API usage yang diekspos platform; jika tidak
  tersedia, tampilkan yang tersedia saja.
