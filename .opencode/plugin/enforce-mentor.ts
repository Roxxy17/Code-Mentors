import type { Plugin } from "@opencode-ai/plugin"

declare const process: { env: Record<string, string | undefined> }

const CHECKPOINT_RE = /(DEVELOP|DEBUG|REFACTOR) CHECKPOINT:/i
const TODO_TOOLS = new Set(["todowrite", "TodoWrite", "todoWrite", "updateTodo"])
const DEFAULT_N = 5
const MIN_N = 3

type TokenCount = { input: number; output: number }

type SessionState = {
  calls: number
  tokens: TokenCount
  lastCheckpointTokens: TokenCount
  countedMessages: Set<string>
}

const sessionState = new Map<string, SessionState>()
const MAX_SESSIONS = 1000

function getState(sessionID: string): SessionState {
  let st = sessionState.get(sessionID)
  if (!st) {
    st = { calls: 0, tokens: { input: 0, output: 0 }, lastCheckpointTokens: { input: 0, output: 0 }, countedMessages: new Set() }
    if (sessionState.size >= MAX_SESSIONS) {
      sessionState.delete(sessionState.keys().next().value as string)
    }
    sessionState.set(sessionID, st)
  }
  return st
}

function readThreshold(): number {
  const raw = process.env.ENFORCE_MENTOR_N
  const parsed = Number(raw)
  if (raw === undefined || raw === null || raw === "" || !Number.isFinite(parsed)) return DEFAULT_N
  return Math.max(MIN_N, Math.floor(parsed))
}

function tokensEnabled(): boolean {
  const raw = process.env.ENFORCE_MENTOR_TOKENS
  if (raw === undefined || raw === null || raw === "") return true
  const v = String(raw).trim().toLowerCase()
  return !(v === "0" || v === "false" || v === "off" || v === "no")
}

function isCheckpointSignal(tool: string, outputText: string): boolean {
  if (TODO_TOOLS.has(tool)) return true
  return CHECKPOINT_RE.test(outputText)
}

function appendLine(output: { output: string }, line: string): void {
  if (typeof output.output !== "string") output.output = line
  else output.output = output.output.length > 0 ? `${output.output}\n${line}` : line
}

function tokenLine(state: SessionState): string | null {
  const total = state.tokens.input + state.tokens.output
  const deltaIn = state.tokens.input - state.lastCheckpointTokens.input
  const deltaOut = state.tokens.output - state.lastCheckpointTokens.output
  if (total <= 0 && deltaIn <= 0 && deltaOut <= 0) return null
  return `📊 tokens: +${deltaIn} in / +${deltaOut} out (session total ${total})`
}

function updateLastCheckpoint(state: SessionState): void {
  state.lastCheckpointTokens.input = state.tokens.input
  state.lastCheckpointTokens.output = state.tokens.output
}

function reminderText(calls: number): string {
  return `System reminder: you appear to have completed a logical batch (${calls} tool calls without a checkpoint). Per the protocol, STOP and present a 📚 DEVELOP/DEBUG/REFACTOR CHECKPOINT: <batch name>, then re-issue the session todo before continuing.`
}

let n = readThreshold()
let showTokens = tokensEnabled()

const plugin: Plugin = async ({ client, $ }) => {
  n = readThreshold()
  showTokens = tokensEnabled()

  client.app.log({
    body: {
      service: "enforce-mentor",
      level: "info",
      message: `enforce-mentor loaded: checkpoint reminder every ${n} tool calls, token display ${showTokens ? "on" : "off"}`,
    },
  }).catch(() => console.info("[enforce-mentor] loaded (client.app.log unavailable)"))

  return {
    event: async ({ event }) => {
      if (event.type === "session.deleted") {
        const info = event.properties.info as { id?: string }
        if (info?.id) sessionState.delete(info.id)
        return
      }
      if (event.type !== "message.updated") return
      const info = event.properties.info as {
        id?: string
        sessionID?: string
        role?: string
        tokens?: { input?: number; output?: number }
      }
      if (!info || info.role !== "assistant" || !info.tokens || !info.sessionID) return
      if (typeof info.tokens.input !== "number" || typeof info.tokens.output !== "number") return
      const st = getState(info.sessionID)
      if (!info.id || st.countedMessages.has(info.id)) return
      st.countedMessages.add(info.id)
      st.tokens.input += info.tokens.input
      st.tokens.output += info.tokens.output
    },

    "tool.execute.after": async (input, output) => {
      if (!output) return
      const sessionID = input.sessionID
      const st = getState(sessionID)

      st.calls++

      const toolName = String(input.tool ?? "")
      const outputText = typeof output.output === "string" ? output.output : ""
      const isSignal = isCheckpointSignal(toolName, outputText)

      if (isSignal) {
        st.calls = 0
        if (showTokens) {
          const line = tokenLine(st)
          if (line) appendLine(output, line)
        }
        updateLastCheckpoint(st)
      } else if (st.calls >= n) {
        st.calls = 0
        const reminder = reminderText(n)
        appendLine(output, reminder)
        if (showTokens) {
          const line = tokenLine(st)
          if (line) appendLine(output, line)
        }
        updateLastCheckpoint(st)
        console.warn("[enforce-mentor] " + reminder)
      }

      sessionState.set(sessionID, st)
      void $
    },
  }
}

export default plugin
