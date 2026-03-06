import { framer } from "framer-plugin"
import type { BridgeRequest, BridgeResponse, HandshakeMessage, HandshakeAck } from "./types"

const WS_URL = "ws://localhost:9001"
const RECONNECT_BASE_DELAY_MS = 1000
const RECONNECT_MAX_DELAY_MS = 30_000
const MAX_LOG_ENTRIES = 50
const TOKEN_KEY = "framer-mcp-token"

export type ConnectionStatus = "connecting" | "connected" | "disconnected"

export type LogEntry = {
  timestamp: Date
  tool: string
  status: "success" | "error"
  message: string
}

type StatusListener = (status: ConnectionStatus) => void
type LogListener = (entries: LogEntry[]) => void
type SessionListener = (info: { sessionId: string; restored: boolean }) => void

function initToken(): string {
  let token = localStorage.getItem(TOKEN_KEY)
  if (!token) {
    token = crypto.randomUUID()
    localStorage.setItem(TOKEN_KEY, token)
  }
  return token
}

async function getProjectInfo(): Promise<{ name: string; projectId?: string }> {
  try {
    const pages = await framer.getPages()
    // Use first page name as a proxy for project name if no better API is available
    return { name: pages[0]?.name ?? "Framer Project" }
  } catch {
    return { name: "Framer Project" }
  }
}

export class PluginBridge {
  private ws: WebSocket | null = null
  private reconnectDelay = RECONNECT_BASE_DELAY_MS
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private destroyed = false
  private handlers = new Map<string, (params: Record<string, unknown>) => Promise<unknown>>()
  private statusListeners: StatusListener[] = []
  private logListeners: LogListener[] = []
  private sessionListeners: SessionListener[] = []
  private log: LogEntry[] = []
  private _status: ConnectionStatus = "disconnected"
  private _sessionId: string | null = null
  private _restored = false
  readonly token: string

  constructor() {
    this.token = initToken()
    this.connect()
  }

  get status(): ConnectionStatus {
    return this._status
  }

  get sessionId(): string | null {
    return this._sessionId
  }

  get restored(): boolean {
    return this._restored
  }

  get logEntries(): LogEntry[] {
    return this.log
  }

  registerHandler(tool: string, handler: (params: Record<string, unknown>) => Promise<unknown>) {
    this.handlers.set(tool, handler)
  }

  onStatusChange(listener: StatusListener) {
    this.statusListeners.push(listener)
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== listener)
    }
  }

  onLogChange(listener: LogListener) {
    this.logListeners.push(listener)
    return () => {
      this.logListeners = this.logListeners.filter((l) => l !== listener)
    }
  }

  onSessionChange(listener: SessionListener) {
    this.sessionListeners.push(listener)
    return () => {
      this.sessionListeners = this.sessionListeners.filter((l) => l !== listener)
    }
  }

  destroy() {
    this.destroyed = true
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ws?.close()
  }

  private setStatus(status: ConnectionStatus) {
    this._status = status
    this.statusListeners.forEach((l) => l(status))
  }

  private addLog(entry: LogEntry) {
    this.log = [entry, ...this.log].slice(0, MAX_LOG_ENTRIES)
    this.logListeners.forEach((l) => l(this.log))
  }

  private connect() {
    if (this.destroyed) return
    this.setStatus("connecting")

    const ws = new WebSocket(WS_URL)
    this.ws = ws

    ws.onopen = async () => {
      this.reconnectDelay = RECONNECT_BASE_DELAY_MS
      // Don't mark connected yet — wait for HandshakeAck
      const projectInfo = await getProjectInfo()
      const handshake: HandshakeMessage = {
        type: "handshake",
        token: this.token,
        projectInfo,
      }
      ws.send(JSON.stringify(handshake))
    }

    ws.onmessage = async (event) => {
      let msg: unknown
      try {
        msg = JSON.parse(event.data as string)
      } catch {
        console.error("[bridge] Failed to parse message")
        return
      }

      // HandshakeAck — server confirmed session
      if ((msg as { type?: string }).type === "ack") {
        const ack = msg as HandshakeAck
        this._sessionId = ack.sessionId
        this._restored = ack.restoredAt !== null
        this.setStatus("connected")
        if (this._sessionId) {
          this.sessionListeners.forEach((l) =>
            l({ sessionId: this._sessionId!, restored: this._restored })
          )
        }
        return
      }

      // Regular BridgeRequest from server
      const request = msg as BridgeRequest
      const handler = this.handlers.get(request.tool)
      if (!handler) {
        const response: BridgeResponse = { id: request.id, error: `Unknown tool: ${request.tool}` }
        ws.send(JSON.stringify(response))
        return
      }

      try {
        const result = await handler(request.params)
        const response: BridgeResponse = { id: request.id, result }
        ws.send(JSON.stringify(response))
        this.addLog({ timestamp: new Date(), tool: request.tool, status: "success", message: "OK" })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        const response: BridgeResponse = { id: request.id, error: message }
        ws.send(JSON.stringify(response))
        this.addLog({ timestamp: new Date(), tool: request.tool, status: "error", message })
      }
    }

    ws.onclose = () => {
      if (this.destroyed) return
      this.setStatus("disconnected")
      this.scheduleReconnect()
    }

    ws.onerror = () => {
      // onclose will fire after onerror, which handles reconnect
    }
  }

  private scheduleReconnect() {
    if (this.destroyed) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, RECONNECT_MAX_DELAY_MS)
      this.connect()
    }, this.reconnectDelay)
  }
}
