#!/usr/bin/env node
// enforce-mentor.js — Antigravity PreInvocation hook: soft checkpoint reminder + token display.
//
// STATUS: BELUM TERVERIFIKASI (format/behavior verified against official docs + a real local
// transcript.jsonl, but the hook has NOT been executed inside a live Antigravity session).
//
// How it works (based on https://antigravity.google/docs/hooks/ + empirical local transcripts):
//   - Antigravity runs this command at the PreInvocation event (before the model is called).
//     Input payload arrives on stdin as JSON (conversationId, transcriptPath, modelName, ...).
//   - The ONLY non-destructive injection mechanism is PreInvocation/PostInvocation
//     `injectSteps[].ephemeralMessage` (a transient system message the model reads next).
//     PostToolUse output is an empty object {} and cannot inject anything.
//   - The PreInvocation payload does NOT include the tool-call stream, so we parse the
//     conversation transcript (transcriptPath -> transcript.jsonl) instead:
//       * tool calls appear as entries in `tool_calls` on MODEL/PLANNER_RESPONSE lines;
//       * tool results appear as MODEL lines whose `type` is the tool name (e.g. RUN_COMMAND);
//       * the model's own message text is the `content` of PLANNER_RESPONSE lines.
//   - Checkpoint signal = any step content matching /(DEVELOP|DEBUG|REFACTOR) CHECKPOINT:/i
//     (covers tool results AND model-presented checkpoint headings) OR a tool named like a todo
//     tool (/todo/i). On signal: reset the counter. After N consecutive non-signal tool calls:
//     inject the reminder via injectSteps.
//   - Token display: the transcript empirically contains NO token/usage fields on this install
//     (verified 2026-08-17 across 14 local transcripts), so the token line is only emitted if
//     usage-like fields ever appear. The extractor below is tolerant and future-proof.
//
// Non-destructive: never blocks, never exits non-zero, never throws out of the handler.

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const CHECKPOINT_RE = /(DEVELOP|DEBUG|REFACTOR) CHECKPOINT:/i;
const TODO_TOOL_RE = /todo/i;
const DEFAULT_N = 5;
const MIN_N = 3;
const MAX_SESSIONS = 200;

const STATE_FILE_DEFAULT = path.join(os.tmpdir(), "antigravity-enforce-mentor-state.json");

function stateFilePath() {
  return process.env.ENFORCE_MENTOR_STATE_FILE || STATE_FILE_DEFAULT;
}

function readThreshold() {
  const raw = process.env.ENFORCE_MENTOR_N;
  if (raw === undefined || raw === null || raw === "") return DEFAULT_N;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_N;
  return Math.max(MIN_N, Math.floor(parsed));
}

function tokensEnabled() {
  const raw = process.env.ENFORCE_MENTOR_TOKENS;
  if (raw === undefined || raw === null || raw === "") return true;
  const v = String(raw).trim().toLowerCase();
  return !(v === "0" || v === "false" || v === "off" || v === "no");
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(stateFilePath(), "utf8"));
  } catch {
    return { sessions: {} };
  }
}

function writeState(state) {
  try {
    const tmp = stateFilePath() + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(state));
    fs.renameSync(tmp, stateFilePath());
  } catch {
    /* swallow — a state write failure must never break the hook */
  }
}

function getSession(state, conversationId) {
  const id = conversationId || "default";
  let st = state.sessions[id];
  if (!st) {
    if (Object.keys(state.sessions).length >= MAX_SESSIONS) {
      const oldest = Object.keys(state.sessions)[0];
      delete state.sessions[oldest];
    }
    st = { lastStep: -1, calls: 0, tokens: { input: 0, output: 0 }, lastCheckpointTokens: { input: 0, output: 0 } };
    state.sessions[id] = st;
  }
  return st;
}

function isSignalContent(text) {
  return CHECKPOINT_RE.test(text);
}

function isTodoTool(name) {
  return TODO_TOOL_RE.test(String(name || ""));
}

// Best-effort token extractor. Antigravity transcripts have no usage fields today; if
// usage-like numeric keys (e.g. input_tokens / output_tokens, cache excluded) ever appear,
// this records the largest value seen per category as the session total (self-correcting).
function extractUsage(rawLine) {
  let input = null;
  let output = null;
  const re = /"([A-Za-z0-9_]*[Tt]oken[A-Za-z0-9_]*)"\s*:\s*(\d+)/g;
  let m;
  while ((m = re.exec(rawLine)) !== null) {
    const key = m[1];
    if (/cache/i.test(key)) continue;
    const val = Number(m[2]);
    if (/input/i.test(key)) input = input === null ? val : Math.max(input, val);
    else if (/output/i.test(key)) output = output === null ? val : Math.max(output, val);
  }
  if (input === null && output === null) return null;
  return { input: input || 0, output: output || 0 };
}

function tokenLine(st) {
  const total = st.tokens.input + st.tokens.output;
  const deltaIn = st.tokens.input - st.lastCheckpointTokens.input;
  const deltaOut = st.tokens.output - st.lastCheckpointTokens.output;
  if (total <= 0 && deltaIn <= 0 && deltaOut <= 0) return null;
  return `📊 tokens: +${deltaIn} in / +${deltaOut} out (session total ${total})`;
}

function reminderText(calls) {
  return `System reminder: you appear to have completed a logical batch (${calls} tool calls without a checkpoint). Per the protocol, STOP and present a 📚 DEVELOP/DEBUG/REFACTOR CHECKPOINT: <batch name>, then re-issue the session todo before continuing.`;
}

function parseLine(rawLine) {
  try {
    return JSON.parse(rawLine);
  } catch {
    return null;
  }
}

function readTranscriptLines(transcriptPath) {
  if (!transcriptPath || typeof transcriptPath !== "string") return [];
  try {
    if (!fs.existsSync(transcriptPath)) return [];
    const text = fs.readFileSync(transcriptPath, "utf8");
    return text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  } catch {
    return [];
  }
}

function handle(payload) {
  const conversationId = payload && payload.conversationId;
  const n = readThreshold();
  const showTokens = tokensEnabled();

  const state = readState();
  const st = getSession(state, conversationId);

  const lines = readTranscriptLines(payload && payload.transcriptPath);

  let sawSignal = false; // a checkpoint signal occurred among the newly processed steps
  for (const rawLine of lines) {
    const obj = parseLine(rawLine);
    if (!obj || typeof obj !== "object") continue;

    const stepIdx = Number.isFinite(obj.step_index) ? obj.step_index : -1;
    if (stepIdx >= 0 && stepIdx <= st.lastStep) continue; // already processed

    // Count tool executions issued in this step (PLANNER_RESPONSE / MODEL lines carry tool_calls).
    const toolCalls = Array.isArray(obj.tool_calls) ? obj.tool_calls : [];
    let issuedCalls = 0;
    let signal = false;
    if (toolCalls.length > 0) {
      for (const tc of toolCalls) {
        issuedCalls++;
        if (tc && tc.name && isTodoTool(tc.name)) signal = true;
      }
    }

    // Signal check against the whole step (model message content, tool result content).
    const content = typeof obj.content === "string" ? obj.content : "";
    if (!signal && isSignalContent(content)) signal = true;
    if (!signal && isSignalContent(rawLine)) signal = true;

    // Token usage best-effort.
    if (showTokens) {
      const usage = extractUsage(rawLine);
      if (usage) {
        st.tokens.input = Math.max(st.tokens.input, usage.input);
        st.tokens.output = Math.max(st.tokens.output, usage.output);
      }
    }

    if (signal) {
      st.calls = 0;
      sawSignal = true;
    } else {
      st.calls += issuedCalls;
    }

    if (stepIdx >= 0) st.lastStep = stepIdx;
  }

  let injectMessage = null;

  if (st.calls >= n) {
    st.calls = 0;
    let msg = reminderText(n);
    if (showTokens) {
      const line = tokenLine(st);
      if (line) msg += "\n" + line;
    }
    st.lastCheckpointTokens.input = st.tokens.input;
    st.lastCheckpointTokens.output = st.tokens.output;
    injectMessage = msg;
    try {
      console.warn("[enforce-mentor] " + msg);
    } catch {
      /* noop */
    }
  } else if (sawSignal && showTokens) {
    // Token display at a detected checkpoint (mirrors Task 1/2: token line on signal,
    // computed against the previous checkpoint before recording the new one).
    const line = tokenLine(st);
    if (line) injectMessage = line;
    st.lastCheckpointTokens.input = st.tokens.input;
    st.lastCheckpointTokens.output = st.tokens.output;
  }

  writeState(state);

  if (injectMessage) {
    return { injectSteps: [{ ephemeralMessage: injectMessage }] };
  }
  return {};
}

function main() {
  let input = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (d) => (input += d));
  process.stdin.on("end", () => {
    let payload = {};
    try {
      payload = input ? JSON.parse(input) : {};
    } catch {
      payload = {};
    }
    let output = {};
    try {
      output = handle(payload);
    } catch {
      output = {};
    }
    process.stdout.write(JSON.stringify(output));
  });
}

if (require.main === module) {
  main();
}

module.exports = { handle, reminderText, tokenLine, extractUsage };
