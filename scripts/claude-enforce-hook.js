#!/usr/bin/env node
// Claude Code hook: soft reminder + token display for mentor agents.
// Runs on PostToolUse (see .claude/settings.json). Reads JSON from stdin,
// writes a JSON decision to stdout (exit 0). Never blocks, never throws.
//
// Behavior:
//   - Checkpoint signal = tool_response matching /(DEVELOP|DEBUG|REFACTOR) CHECKPOINT:/i
//     OR a TodoWrite tool call. A signal resets the call counter and appends a
//     token line to additionalContext (no reminder).
//   - When N consecutive non-checkpoint tool calls elapse, appends the reminder
//     (plus a token line) to additionalContext and resets the counter.
//   - N defaults to 5 (min 3), overridable via ENFORCE_MENTOR_N.
//
// Token display approximation:
//   The PostToolUse hook payload does NOT expose token usage for regular tools
//   (only the Agent tool carries `tool_response.usage`/`totalTokens`). The best
//   available approximation reads the session transcript (`transcript_path`,
//   provided on every hook input) and sums `message.usage.{input,output}_tokens`
//   across assistant messages. "+X in / +Y out" is the delta since the last
//   checkpoint/report; "session total Z" is the cumulative sum. Cache tokens are
//   excluded. Set ENFORCE_MENTOR_TOKENS=0|false|off|no to disable the token line.
const fs = require("fs");
const path = require("path");
const os = require("os");

const CHECKPOINT_RE = /(DEVELOP|DEBUG|REFACTOR) CHECKPOINT:/i;
const RAW_N = Number(process.env.ENFORCE_MENTOR_N || 5);
const N = Number.isFinite(RAW_N) ? Math.max(3, Math.floor(RAW_N)) : 5;
const STATE_FILE = path.join(os.tmpdir(), "claude-enforce-mentor-state.json");
const TOKENS_DISABLED = /^(0|false|off|no)$/i.test(process.env.ENFORCE_MENTOR_TOKENS || "");
const MAX_SESSIONS = 200;
const REMINDER = "System reminder: you appear to have completed a logical batch. Per the protocol, present a <MENTOR> CHECKPOINT and re-issue the session todo before continuing.";

function readState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); } catch { return {}; }
}

function writeState(state) {
  try {
    const tmp = STATE_FILE + "." + process.pid + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(state));
    fs.renameSync(tmp, STATE_FILE);
  } catch (e) { /* best-effort; never break the hook */ }
}

function getSession(state, sessionId) {
  const sid = sessionId || "default";
  if (!state[sid]) {
    state[sid] = { calls: 0, lastIn: 0, lastOut: 0, updatedAt: Date.now() };
  }
  return state[sid];
}

function pruneSessions(state) {
  const keys = Object.keys(state);
  if (keys.length <= MAX_SESSIONS) return;
  keys
    .map((k) => [k, state[k].updatedAt || 0])
    .sort((a, b) => a[1] - b[1])
    .slice(0, keys.length - MAX_SESSIONS)
    .forEach(([k]) => delete state[k]);
}

function readTranscriptTotals(transcriptPath) {
  // Sum message.usage.{input,output}_tokens across assistant messages in the
  // session transcript (JSONL). Returns { in, out } or null if unreadable.
  if (!transcriptPath || typeof transcriptPath !== "string") return null;
  let raw;
  try { raw = fs.readFileSync(transcriptPath, "utf8"); } catch { return null; }
  let totalIn = 0, totalOut = 0, found = false;
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    let obj;
    try { obj = JSON.parse(line); } catch { continue; }
    const usage = obj && obj.message && obj.message.usage;
    if (!usage) continue;
    totalIn += usage.input_tokens || 0;
    totalOut += usage.output_tokens || 0;
    found = true;
  }
  return found ? { in: totalIn, out: totalOut } : null;
}

function tokenLine(totals, session) {
  if (!totals) return null;
  const deltaIn = Math.max(0, totals.in - session.lastIn);
  const deltaOut = Math.max(0, totals.out - session.lastOut);
  session.lastIn = totals.in;
  session.lastOut = totals.out;
  return `📊 tokens: +${deltaIn} in / +${deltaOut} out (session total ${totals.in + totals.out})`;
}

let input = "";
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", () => {
  let payload = {};
  try { payload = JSON.parse(input); } catch { process.exit(0); }

  const toolName = String(payload.tool_name || "");
  const responseText = (() => {
    try { return JSON.stringify(payload.tool_response || ""); } catch { return String(payload.tool_response || ""); }
  })();

  const state = readState();
  const session = getSession(state, payload.session_id);
  session.updatedAt = Date.now();

  const isSignal = toolName === "TodoWrite" || CHECKPOINT_RE.test(responseText);
  let context = "";

  if (isSignal) {
    session.calls = 0;
    if (!TOKENS_DISABLED) {
      const line = tokenLine(readTranscriptTotals(payload.transcript_path), session);
      if (line) context = line;
    }
  } else {
    session.calls = (session.calls || 0) + 1;
    if (session.calls >= N) {
      session.calls = 0;
      let parts = [REMINDER];
      if (!TOKENS_DISABLED) {
        const line = tokenLine(readTranscriptTotals(payload.transcript_path), session);
        if (line) parts.push(line);
      }
      context = parts.join("\n");
    }
  }

  pruneSessions(state);
  writeState(state);

  if (context) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: context
      }
    }));
  }
  process.exit(0);
});
