# Evaluasi Study Mode V0 — Todo CLI

Uji di: Claude Code ☐ OpenCode ☑ Antigravity ☐ (centang yang diuji)
Tanggal: 2026-08-16

## Checklist (jawab Ya/Tidak + catatan)

1. **Granularitas checkpoint**: tidak per-tool-call, tidak terlalu jarang?
   Ya — 3 checkpoint (satu per fase), tidak ada interrupt di tengah batch.
2. **Menu**: muncul setelah batch, pilihan kontekstual, dan "Continue" mudah?
   Ya — menu muncul tiap checkpoint via **native question tool** OpenCode (`question`) setelah fix `question: allow`; opsi kontekstual per fase, "Continue" = fast-path.
3. **Jawaban kontekstual**: pertanyaan bebas dijawab dengan konteks proyek + trade-off (bukan textbook)?
   Ya — sesi evaluasi tool question (2026-08-16): user bertanya bebas via free-text (scoping global vs project, status verifikasi Antigravity, mekanisme deep-merge) dan mendapat jawaban kontekstual + trade-off, bukan textbook. Opsi "2" (why) belum dipilih langsung, tapi Why: section dijelaskan tiap fase.
4. **Continue**: benar-benar melanjutkan dari posisi berhenti tanpa restart?
   Ya — 3× continue, lanjut presisi ke fase berikutnya tanpa konteks hilang.
5. **Token delta**:
   - Baseline (build biasa): ___ token (belum diukur — perlu run baseline)
   - Study: ___ token (belum diukur)
   - Delta: ___ %  (ekspektasi +10–15% tanpa pertanyaan)
6. **Kelelahan interaksi**: jumlah checkpoint terasa wajar, tidak annoying?
   Ya — 3 checkpoint untuk 3 fase terasa proporsional; tidak ada interrupt per tool call.

## Temuan / masalah
- Sesi OpenCode ini sudah membawa STUDY PROTOCOL di system prompt sejak awal — agent `study` baru tersedia sebagai opsi Tab setelah instalasi; perlu sesi baru untuk menguji jalur "pilih agent via Tab".
- Bug yang ditemukan selama PoC: `node --test test/` gagal di Node v22 (path arg dianggap module); solusi `node --test` (auto-discovery). Bukan bug produk, hanya catatan runner.
- **Tool `question` OpenCode bersifat opt-in**: tidak muncul di daftar tool model sampai permission `question: allow` di-set eksplisit. Fix diterapkan di 3 level (agent project, global config `~/.config/opencode/opencode.json`, agent global `~/.config/opencode/agents/`) dan di-sync ke `adapters/` (commit `ce1d63e`). Konvensi global agent Antigravity (`~/.agents/agents/`) masih inferensi — belum terverifikasi ke docs resmi.
- Pengukuran token delta belum dilakukan (butuh run baseline dengan agent build biasa di platform yang sama).

## Keputusan lanjut
- [x] Uji opsi menu "2" (why) dan "5" (tanya bebas) — opsi "5" (free-text) teruji via sesi evaluasi; "2" belum dipilih langsung
- [ ] Uji opsi "2" (why) pada run berikutnya
- [ ] Ukur token delta (baseline vs study) di satu platform
- [ ] Ulangi PoC di Claude Code dan Antigravity
- [ ] Lanjut ke Phase 1 penuh / iterate protocol / ubah granularity
