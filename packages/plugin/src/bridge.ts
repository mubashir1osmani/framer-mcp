import type { BridgeRequest, BridgeResponse } from "./types"

const WS_URL = "ws://localhost:9001"
const RECONNECT_BASE_DELAY_MS = 1000
const RECONNECT_MAX_DELAY_MS = 30_000
const MAX_LOG_ENTRIES = 50

export type ConnectionStatus = "connecting" | "connected" | "disconnected"

export type LogEntry = {
  timestamp: Date
  tool: string
  status: "success" | "error"
  message: string
}

type StatusListener = (status: ConnectionStatus) => void
type LogListener = (entries: LogEntry[]) => void

export class PluginBridge {
  private ws: WebSocket | null = null
  private reconnectDelay = RECONNECT_BASE_DELAY_MS
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private destroyed = false
  private handlers = new Map<string, (params: Record<string, unknown>) => Promise<unknown>>()
  private statusListeners: StatusListener[] = []
  private logListeners: LogListener[] = []
  private log: LogEntry[] = []
  private _status: ConnectionStatus = "disconnected"

  constructor() {
    this.connect()
  }

  get status(): ConnectionStatus {
    return this._status
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

    ws.onopen = () => {
      this.reconnectDelay = RECONNECT_BASE_DELAY_MS
      this.setStatus("connected")
    }

    ws.onmessage = async (event) => {
      let request: BridgeRequest
      try {
        request = JSON.parse(event.data as string)
      } catch {
        console.error("[bridge] Failed to parse message")
        return
      }

      const handler = this.handlers.get(request.tool)
      if (!handler) {
        const response: BridgeResponse = {
          id: request.id,
          error: `Unknown tool: ${request.tool}`,
        }
        ws.send(JSON.stringify(response))
        return
      }

      try {
        const result = await handler(request.params)
        const response: BridgeResponse = { id: request.id, result }
        ws.send(JSON.stringify(response))
        this.addLog({
          timestamp: new Date(),
          tool: request.tool,
          status: "success",
          message: `OK`,
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        const response: BridgeResponse = { id: request.id, error: message }
        ws.send(JSON.stringify(response))
        this.addLog({
          timestamp: new Date(),
          tool: request.tool,
          status: "error",
          message,
        })
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
