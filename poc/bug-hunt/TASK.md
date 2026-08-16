# Task: Bug Hunt (untuk uji Debugging Mentor)

Proyek kecil: CLI todo sederhana (Node.js). Terdapat **3 bug yang ditanam**.
Laporkan tiap bug ke debug-mentor satu per satu.

## Setup

```bash
mkdir bug-hunt-work && cd bug-hunt-work
npm init -y
# agent akan membangun CLI todo + test runner
```

## Bug yang ditanam (untuk evaluator — JANGAN tunjukkan ke agent)

1. **Logic bug**: `done <id>` menandai task dengan id yang salah saat ada task
   yang sudah dihapus (off-by-one pada indeks array vs id).
2. **Runtime error**: `list` crash (TypeError) saat file `tasks.json` berisi
   array kosong `[]`.
3. **Test failure**: unit test `todoService.test.js` gagal karena fungsi
   `add` tidak men-trim whitespace pada title.

## Alur uji (user → debug-mentor)

- User: "`done 2` menandai task yang salah" (bug 1) — lalu ulangi untuk bug 2 & 3.
- Ikuti DEBUGGING PROTOCOL: agent diagnosa → usulkan → user konfirmasi → eksekusi.
- Di tiap checkpoint, coba variasikan menu: "2" (why), "5" (tanya bebas), lalu "7" (continue).

## Aturan

- Ikuti DEBUGGING PROTOCOL: 1 siklus hipotesis = 1 checkpoint.
- Agent TIDAK boleh mengubah kode sebelum user konfirmasi.
