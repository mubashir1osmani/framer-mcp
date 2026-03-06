import { WebSocketServer, WebSocket } from "ws"
import { randomUUID } from "crypto"
import type { BridgeRequest, BridgeResponse } from "./types.js"

const WS_PORT = 9001
const REQUEST_TIMEOUT_MS = 30_000

type PendingRequest = {
  resolve: (result: unknown) => void
  reject: (err: Error) => void
  timer: NodeJS.Timeout
}

export class FramerBridge {
  private wss: WebSocketServer
  private socket: WebSocket | null = null
  private pending = new Map<string, PendingRequest>()

  constructor() {
    this.wss = new WebSocketServer({ port: WS_PORT })
    this.wss.on("connection", (ws) => this.onConnection(ws))
    console.error(`[bridge] WebSocket server listening on ws://localhost:${WS_PORT}`)
  }

  get isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN
  }

  private onConnection(ws: WebSocket) {
    // Only allow one plugin connection at a time
    if (this.socket) {
      this.socket.terminate()
    }
    this.socket = ws
    console.error("[bridge] Framer plugin connected")

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString()) as BridgeResponse
        this.handleResponse(msg)
      } catch {
        console.error("[bridge] Failed to parse message:", data.toString())
      }
    })

    ws.on("close", () => {
      console.error("[bridge] Framer plugin disconnected")
      if (this.socket === ws) {
        this.socket = null
      }
      // Reject all pending requests
      for (const [id, pending] of this.pending) {
        clearTimeout(pending.timer)
        pending.reject(new Error("Framer plugin disconnected while waiting for response"))
        this.pending.delete(id)
      }
    })

    ws.on("error", (err) => {
      console.error("[bridge] WebSocket error:", err.message)
    })
  }

  private handleResponse(msg: BridgeResponse) {
    const pending = this.pending.get(msg.id)
    if (!pending) return

    clearTimeout(pending.timer)
    this.pending.delete(msg.id)

    if (msg.error) {
      pending.reject(new Error(msg.error))
    } else {
      pending.resolve(msg.result)
    }
  }

  async send(tool: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.isConnected) {
      throw new Error(
        "Framer plugin is not connected. Open the Framer MCP plugin in your Framer project to continue."
      )
    }

    const id = randomUUID()
    const request: BridgeRequest = { id, tool, params }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Tool "${tool}" timed out after ${REQUEST_TIMEOUT_MS / 1000}s`))
      }, REQUEST_TIMEOUT_MS)

      this.pending.set(id, { resolve, reject, timer })
      this.socket!.send(JSON.stringify(request))
    })
  }
}
