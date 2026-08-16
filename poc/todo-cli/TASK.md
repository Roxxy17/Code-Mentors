# Task: CLI Todo App (untuk uji Study Mode)

Bangun aplikasi CLI todo sederhana dalam 3 fase, satu fase = satu
kesempatan checkpoint.

## Fase 1 — Model & storage
- Model `Task` (id, title, done).
- Persistence ke file JSON lokal (`tasks.json`).
- Load/save via service layer terpisah dari command.

## Fase 2 — Perintah CLI
- `add`, `list`, `done <id>`, `delete <id>`.
- Handler command tipis; logic ada di service.

## Fase 3 — Test
- Unit test untuk service (add, mark done, delete, persist).
- Jalankan test & pastikan hijau.
- (Opsional) typecheck/lint.

## Aturan Study
- Ikuti STUDY PROTOCOL: 3 checkpoint (satu per fase).
- Saat menu muncul: user akan coba "2" (why), "5" (tanya bebas), lalu "7" (continue).
