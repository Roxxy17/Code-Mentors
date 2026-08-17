# Shared Core + Refactor Mentor — Design Spec (V0)

> Tanggal: 2026-08-16 · Status: DRAFT (menunggu review user)
> Hasil brainstorming sesi 2026-08-16 (lanjutan dari Debugging Mentor).

## 1. Ringkasan

Dua pekerjaan yang digabung menjadi satu:

1. **Shared Core Refactor (Approach A)** — ekstrak mekanika bersama dari
   STUDY_PROTOCOL dan DEBUGGING_PROTOCOL ke `CORE_PROTOCOL.md`; dua protocol
   itu di-slim; semua adapter disusun ulang menjadi komposisi
   "mentor-specific + CORE"; tambah script `verify-copies` untuk deteksi drift.
2. **Refactor Mentor (mentor ke-3)** — agent yang membantu user merombak kode
   dengan aman sambil mengajar; **dibangun langsung di atas CORE** (tidak
   perlu retrofit).

Urutan eksekusi: **core dulu, lalu Refactor Mentor lahir di atas CORE** —
menghindari retrofit ganda (pelajaran dari Session Todo yang di-retrofit).

## 2. Keputusan desain (hasil brainstorming)

| Keputusan | Pilihan | Alasan |
|---|---|---|
| Approach refactor | **A: Dokumentasi-DRY** | Canonical DRY tanpa build step; adapter tetap self-contained |
| Model Refactor Mentor | **Hibrida** (propose + konfirmasi) | Refactor mengubah struktur — konfirmasi sebelum eksekusi aman |
| Pemicu Refactor Mentor | **Keduanya** (user tunjuk / minta audit) | Fleksibel |
| Prinsip Refactor Mentor | **Behavior-preserving** | Refactor TIDAK boleh mengubah perilaku; test wajib setelah tiap langkah |
| Platform | 3 (OpenCode, Claude Code, Antigravity) | Konsisten dengan mentor lain |

## 3. Shared Core (Approach A)

### 3.1 `CORE_PROTOCOL.md` (baru, canonical, EN)

Berisi **5 section mekanika bersama**, self-contained:

1. `## Session Todo` — teks sama dengan yang ada di study/debug saat ini
2. `## Learning menu` — 7 opsi + "Continue" fast-path + native question tool
3. `## Answering questions` — jawaban kontekstual + trade-off
4. `## Continuing` — resume penuh tanpa restart
5. `## Token budget discipline` — max 250 words, no re-read, menu pendek

### 3.2 Protocol per-mentor (di-slim)

| File | Bagian spesifik (tetap) | Mekanika (pindah ke CORE) |
|---|---|---|
| `STUDY_PROTOCOL.md` | Role, Logical Batch, STUDY CHECKPOINT format | Session Todo, Learning menu, Answering, Continuing, Token budget |
| `DEBUGGING_PROTOCOL.md` | Role, Logical Batch, Edge cases, DEBUG CHECKPOINT format | sama |
| `REFACTORING_PROTOCOL.md` 🆕 | Role, Logical Batch, Edge cases, REFACTOR CHECKPOINT format | sama |

Protocol slim **tidak mengulang teks CORE** — cukup satu baris referensi:
> "Shared mechanics (Session Todo, Learning menu, Answering questions,
> Continuing, Token budget discipline) live in CORE_PROTOCOL.md."

### 3.3 Template body adapter (komposisi penuh)

Setiap adapter file body = mentor-specific + CORE verbatim, di-flatten:

```
# <MENTOR> PROTOCOL (v0)
## Role                          ← protocol mentor
## Logical Batch                 ← protocol mentor
## [Edge cases]                  ← protocol mentor (debug & refactor)
## <MENTOR> CHECKPOINT format    ← protocol mentor
## Session Todo                  ← CORE (verbatim)
## Learning menu                 ← CORE (verbatim)
## Answering questions           ← CORE (verbatim)
## Continuing                    ← CORE (verbatim)
## Token budget discipline       ← CORE (verbatim)
```

Ini berarti **18 file adapter di repo diubah** (6 study + 6 debug + 6
refactor baru) — konten mekanika tidak berubah, hanya struktur/urutan.

### 3.4 `verify-copies.ps1`

Script PowerShell yang memvalidasi:
1. **Root copies == adapter** (hash compare per platform)
2. **Body adapter == komposisi canonical** (mentor-specific + CORE verbatim)
3. Keluar non-zero saat ada drift; print file mana yang tidak cocok.

## 4. Refactor Mentor

### 4.1 Gambaran

Agent `refactor-mentor` — membantu user merombak kode dengan aman sambil
mengajar. Model hibrida; pemicu keduanya (user tunjuk / minta audit);
prinsip **behavior-preserving**.

### 4.2 Refactor cycle (1 siklus = 1 batch)

```
1. OBSERVE     → pahami kode target: apa yang dilakukan, bagaimana caranya
2. DIAGNOSE    → identifikasi masalah struktur: duplikasi, kompleksitas, nama buruk, file terlalu besar
3. PROPOSE     → usulkan refactor spesifik + jelaskan kenapa & trade-off (extract vs inline, dll)
4. USER CONFIRM → tunggu konfirmasi
5. APPLY       → eksekusi perubahan
6. VERIFY      → jalankan test/verifikasi, pastikan perilaku TIDAK berubah (hijau)
7. CHECKPOINT  → ringkas pelajaran + menu
```

### 4.3 REFACTOR CHECKPOINT

```
📚 REFACTOR CHECKPOINT: <nama batch>
Batch type: Observe / Diagnose / Propose / Apply / Verify
Problem → Proposal → Trade-off → Result:
Why (design rationale):
Concepts you encountered:   (misal: coupling, cohesion, DRY, Law of Demeter)
Verification:               (test hijau = perilaku tidak berubah)
```

### 4.4 Edge cases

| Skenario | Penanganan |
|---|---|
| Refactor menyentuh banyak file | Pecah jadi langkah-langkah kecil |
| Tidak ada test | Usulkan buat test dulu sebagai safety net |
| Verifikasi gagal | Perbaiki atau rollback |
| User ragu | Jelaskan trade-off lebih detail |
| User menolak konfirmasi | Jangan eksekusi; tawarkan alternatif |

### 4.5 Session Todo & Menu

Dari CORE — teks identik dengan mentor lain.

## 5. Deliverables & urutan

| # | Deliverable | Urutan |
|---|---|---|
| 1 | `CORE_PROTOCOL.md` | 1 |
| 2 | Slim `STUDY_PROTOCOL.md` + re-compose 6 adapter study | 2 |
| 3 | Slim `DEBUGGING_PROTOCOL.md` + re-compose 6 adapter debug | 3 |
| 4 | `REFACTORING_PROTOCOL.md` + 6 adapter refactor-mentor (adapters/ + root) | 4 |
| 5 | `verify-copies.ps1` | 5 |
| 6 | README update (CORE + refactor-mentor + cara verifikasi) | 6 |
| 7 | Sync global agents (12 file: 3 mentor × 4 lokasi home) | 7 (manual/sesi) |

Total: **3 protocol slim + 1 CORE + 1 protocol baru + 18 adapter + 1 script
+ README**.

## 6. Batasan V0

- Tanpa runtime/hooks — perilaku di-enforce oleh prompt.
- Adapter files tetap **self-contained** (platform butuh file utuh).
- Nama tool Antigravity persis (view_file, write_to_file, replace_file_content,
  multi_replace_file_content, grep_search, list_dir, find_by_name,
  run_command, ask_question).
- Protocol canonical dalam bahasa Inggris; plan & dokumentasi Bahasa Indonesia.
- Refactor Mentor: TIDAK boleh mengubah perilaku; test wajib sebelum & sesudah.
