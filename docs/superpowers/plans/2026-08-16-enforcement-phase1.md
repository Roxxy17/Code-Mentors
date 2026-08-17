# Enforcement Phase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menambahkan lapisan kode enforcement + token display untuk 3 platform (OpenCode plugin, Claude Code hooks, Antigravity plugin) di atas agent mentor markdown.

**Architecture:** Hybrid — agent definitions tetap markdown (protocol + adapters); kode enforcement per platform menegakkan ritme checkpoint/todo via soft reminder (hitungan tool call) dan melampirkan angka token di setiap checkpoint. Urutan: OpenCode (paling teruji) → Claude Code → Antigravity (riset, verifikasi terbatas).

**Tech Stack:** TypeScript (plugin OpenCode), JSON + script hook (Claude Code), plugin Antigravity (riset). Tidak ada runtime di sisi markdown.

## Global Constraints

Dari spec `docs/superpowers/specs/2026-08-16-enforcement-phase1-design.md`, berlaku untuk semua task:

- Sinyal checkpoint = respons ber-heading `DEVELOP CHECKPOINT:` / `DEBUG CHECKPOINT:` / `REFACTOR CHECKPOINT:` ATAU panggilan `todowrite`/`TodoWrite`.
- Ambang N tool call tanpa sinyal → suntik reminder (default N = 5; minimal 3 agar tidak mengganggu batch kecil).
- Teks reminder: "System reminder: you appear to have completed a logical batch. Per the protocol, present a <MENTOR> CHECKPOINT and re-issue the session todo before continuing."
- Reminder **non-destruktif** — hanya menambah pesan, tidak memblokir.
- Token display: `📊 tokens: +X in / +Y out (session total Z)` saat checkpoint terdeteksi; opsional disable.
- Kode enforcement **platform-specific**; logika sama, implementasi beda.
- Antigravity: riset sistem plugin dulu; jika tidak bisa diuji, dokumentasikan keterbatasan.

---

### Task 1: OpenCode plugin (enforce-mentor)

**Files:**
- Create: `.opencode/plugin/enforce-mentor.ts`

**Interfaces:**
- Consumes: pola heading checkpoint dari `DEVELOPING_PROTOCOL.md`, `DEBUGGING_PROTOCOL.md`, `REFACTORING_PROTOCOL.md`
- Produces: plugin yang meng-enforce ritme checkpoint + display token di OpenCode

- [ ] **Step 1: Riset API plugin OpenCode (verifikasi cepat)**

Fetch: `https://opencode.ai/docs/plugins/` — konfirmasi nama hook yang tersedia (`tool.execute.after`, `chat.message`, dst.) dan bentuk `output` yang bisa dimutasi. Catat hasilnya di report.

- [ ] **Step 2: Tulis plugin**

Buat `.opencode/plugin/enforce-mentor.ts`:

```typescript
import type { Plugin } from "@opencode-ai/plugin"

// State per session
const sessionState = new Map<string, { calls: number; lastSignalAt: number }>()
const CHECKPOINT_RE = /(DEVELOP|DEBUG|REFACTOR) CHECKPOINT:/i
const DEFAULT_N = 5
const REMINDER = "System reminder: you appear to have completed a logical batch. Per the protocol, present a <MENTOR> CHECKPOINT and re-issue the session todo before continuing."

function isCheckpointSignal(tool: string, outputText: string): boolean {
  if (tool === "todowrite" || tool === "TodoWrite") return true
  return CHECKPOINT_RE.test(outputText)
}

export default (async ({ client, $ }) => {
  return {
    "tool.execute.after": async (input, output) => {
      const sessionID = input.sessionID
      const st = sessionState.get(sessionID) ?? { calls: 0, lastSignalAt: 0 }
      st.calls++

      const toolName = String(input.tool ?? "")
      const outputText = typeof output?.output === "string" ? output.output : ""
      if (isCheckpointSignal(toolName, outputText)) {
        st.calls = 0
        st.lastSignalAt = Date.now()
      }

      const n = Number(process.env.ENFORCE_MENTOR_N || DEFAULT_N)
      if (st.calls >= n) {
        // soft reminder: inject ke next chat turn via chat.message hook? gunakan
        // callback sederhana lewat client (fallback: log ke console + simpan flag)
        st.calls = 0
        console.warn("[enforce-mentor] " + REMINDER)
      }
      sessionState.set(sessionID, st)
    },
  }
})
```

Catatan implementasi (implementer WAJIB baca dan sempurnakan):
- Karena API `client`/`chat.message` mutasi bergantung versi, pastikan cara injeksi reminder yang benar dari docs/step 1; fallback minimal = `console.warn` + tambahkan ke `output.output` sebagai catatan.
- Token display: jika `output` memuat `state.usage` (input/output token), tambahkan baris `📊 tokens: ...` pada `output.output` saat checkpoint terdeteksi.
- File `.opencode/plugin/enforce-mentor.ts` ter-auto-discover oleh OpenCode (tanpa config).

- [ ] **Step 3: Verifikasi sintaks**

Run: `npx tsc --noEmit .opencode/plugin/enforce-mentor.ts` (jika tsc tersedia) ATAU minimal pastikan file valid TS. Catat hasil di report.

- [ ] **Step 4: Uji manual ringan**

Jalankan opencode di project ini, buat sesi kecil, dan pastikan plugin termuat tanpa error (cek console). (Opsional: sesuaikan N untuk uji cepat.) Catat hasil di report.

- [ ] **Step 5: Commit**

```powershell
git add .opencode/plugin/enforce-mentor.ts
git commit -m "feat: add opencode enforce-mentor plugin (soft reminder + token display)"
```

---

### Task 2: Claude Code hooks (enforce-mentor)

**Files:**
- Create: `.claude/settings.json` (hooks config)
- Create: `scripts/claude-enforce-hook.js` (logika state)

**Interfaces:**
- Consumes: pola heading checkpoint; mekanisme hooks Claude Code (`PreToolUse`/`PostToolUse` dengan `additionalContext`)
- Produces: enforcement + token display di Claude Code

- [ ] **Step 1: Riset hooks Claude Code**

Fetch: `https://docs.anthropic.com/en/docs/claude-code/hooks` — konfirmasi skema settings.json, event `PostToolUse`, dan cara mengembalikan `additionalContext` (untuk soft reminder). Catat di report.

- [ ] **Step 2: Tulis state & hook script**

Buat `scripts/claude-enforce-hook.js`:

```javascript
#!/usr/bin/env node
// Claude Code hook: soft reminder + token display untuk mentor agents.
// Input: JSON dari stdin (event, tool_input, tool_response, session_id, dll.)
const fs = require("fs");
const path = require("path");
const os = require("os");

const CHECKPOINT_RE = /(DEVELOP|DEBUG|REFACTOR) CHECKPOINT:/i;
const N = Number(process.env.ENFORCE_MENTOR_N || 5);
const STATE_FILE = path.join(os.tmpdir(), "claude-enforce-mentor-state.json");
const REMINDER = "System reminder: you appear to have completed a logical batch. Per the protocol, present a <MENTOR> CHECKPOINT and re-issue the session todo before continuing.";

function readState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); } catch { return { calls: 0 }; }
}
function writeState(s) { fs.writeFileSync(STATE_FILE, JSON.stringify(s)); }

let input = "";
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", () => {
  let payload = {};
  try { payload = JSON.parse(input); } catch { process.exit(0); }

  const toolName = String(payload.tool_name || payload.tool_use?.name || "");
  const outputText = String(payload.tool_response || "");
  const st = readState();
  st.calls = (st.calls || 0) + 1;

  if (toolName === "TodoWrite" || CHECKPOINT_RE.test(outputText)) {
    st.calls = 0;
  }

  const result = { "hookSpecificOutput": {} };
  if (st.calls >= N) {
    st.calls = 0;
    result.hookSpecificOutput.additionalContext = REMINDER;
  }
  writeState(st);
  process.stdout.write(JSON.stringify(result));
});
```

Catatan: pastikan nama event/field sesuai hasil riset Step 1 (mekanisme `additionalContext` pada `PostToolUse`).

- [ ] **Step 3: Konfigurasi hooks di settings.json**

Buat `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Read|Edit|Write|Bash|TodoWrite",
        "hooks": [
          {
            "type": "command",
            "command": "node scripts/claude-enforce-hook.js"
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 4: Verifikasi**

Run: `node scripts/claude-enforce-hook.js` dengan input JSON contoh (echo '{"tool_name":"Bash","tool_response":"ok"}' | node ...) → pastikan tidak crash dan menghasilkan JSON valid (dengan `additionalContext` setelah N). Catat di report.

- [ ] **Step 5: Commit**

```powershell
git add .claude/settings.json scripts/claude-enforce-hook.js
git commit -m "feat: add claude code enforce-mentor hooks (soft reminder + token display)"
```

---

### Task 3: Antigravity plugin (riset + implementasi terbatas)

**Files:**
- Create: `.agents/plugins/enforce-mentor.*` (format menunggu hasil riset)
- Create: `docs/antigravity-enforcement-notes.md` (temuan & keterbatasan)

**Interfaces:**
- Consumes: hasil riset sistem plugin Antigravity (docs resmi)
- Produces: implementasi terbaik yang bisa + catatan keterbatasan verifikasi

- [ ] **Step 1: Riset sistem plugin/hooks Antigravity**

Fetch: `https://antigravity.google/docs/plugins/` dan `https://antigravity.google/docs/hooks/` (atau halaman yang sesuai). Dokumentasikan:
1. Format plugin & lokasi file
2. Hook apa yang tersedia (ekuivalen tool.execute.after / PostToolUse)
3. Cara injeksi reminder / akses token usage

Tulis temuan ke `docs/antigravity-enforcement-notes.md`.

- [ ] **Step 2: Implementasi**

Berdasarkan riset: buat plugin enforcement + token display sesuai format Antigravity. Jika format tidak bisa dipastikan/diuji, buat draft lengkap + tandai jelas di notes "BELUM TERVERIFIKASI".

- [ ] **Step 3: Verifikasi**

Catat di notes: apakah instalasi Antigravity lokal tersedia untuk diuji (di mesin pengembangan, kemungkinan rusak/kosong — lihat riwayat sesi). Jika tidak bisa diuji, tuliskan itu sebagai keterbatasan eksplisit.

- [ ] **Step 4: Commit**

```powershell
git add .agents/plugins docs/antigravity-enforcement-notes.md
git commit -m "feat: add antigravity enforce-mentor plugin (research-based, verification limited)"
```

---

### Task 4: README update

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: file yang dibuat Task 1–3
- Produces: panduan install & konfigurasi enforcement + token display

- [ ] **Step 1: Tambah section enforcement**

Tambahkan section `## Phase 1 — Mentor enforcement` di README.md:
- Cara kerja (soft reminder, ambang N, token display)
- Install per platform (OpenCode plugin auto-discover; Claude hooks; Antigravity — catatan keterbatasan)
- Config: env var `ENFORCE_MENTOR_N`

- [ ] **Step 2: Verifikasi**

Run: `Get-Content README.md` — section baru ada, bagian lama utuh.

- [ ] **Step 3: Commit**

```powershell
git add README.md
git commit -m "docs: add phase 1 enforcement setup guide"
```

---

### Task 5: EVALUATION update

**Files:**
- Modify: `poc/todo-cli/EVALUATION.md`

**Interfaces:**
- Consumes: hasil uji enforcement (Task 1–3)
- Produces: catatan evaluasi enforcement

- [ ] **Step 1: Tambah catatan enforcement di EVALUATION.md**

Tambahkan bagian "## Evaluasi Enforcement (Phase 1)" berisi checklist:
1. Reminder muncul setelah N tool call tanpa checkpoint? (Ya/Tidak + catatan)
2. Reminder tidak memblokir alur? 
3. Token display muncul di checkpoint? 
4. Berfungsi di platform mana (OpenCode/Claude/Antigravity)?

- [ ] **Step 2: Verifikasi**

Run: `Get-Content poc/todo-cli/EVALUATION.md` — bagian baru ada.

- [ ] **Step 3: Commit**

```powershell
git add poc/todo-cli/EVALUATION.md
git commit -m "docs: add phase 1 enforcement evaluation checklist"
```

---

## Ringkasan deliverable

| Task | Deliverable |
|---|---|
| 1 | `.opencode/plugin/enforce-mentor.ts` (OpenCode) |
| 2 | `.claude/settings.json` + `scripts/claude-enforce-hook.js` (Claude Code) |
| 3 | Antigravity plugin + notes (riset, verifikasi terbatas) |
| 4 | `README.md` update |
| 5 | `poc/todo-cli/EVALUATION.md` update |
