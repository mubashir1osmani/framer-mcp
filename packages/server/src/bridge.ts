import { WebSocketServer, WebSocket } from "ws"
import { randomUUID } from "crypto"
import type { BridgeRequest, BridgeResponse, HandshakeMessage, HandshakeAck } from "./types.js"
import { SessionManager, type QueueItem } from "./session.js"

const WS_PORT = 9001
const REQUEST_TIMEOUT_MS = 30_000
const HANDSHAKE_TIMEOUT_MS = 5_000

type PendingRequest = {
  request: BridgeRequest
  resolve: (result: unknown) => void
  reject: (err: Error) => void
  timer: NodeJS.Timeout | null
}

export class FramerBridge {
  private wss: WebSocketServer
  private sessionManager: SessionManager
  private pending = new Map<string, PendingRequest>()
  private currentToken: string | null = null

  constructor() {
    this.sessionManager = new SessionManager()
    this.wss = new WebSocketServer({ port: WS_PORT })
    this.wss.on("connection", (ws) => this.onConnection(ws))
    console.error(`[bridge] WebSocket server listening on ws://localhost:${WS_PORT}`)
  }

  get isConnected(): boolean {
    if (!this.currentToken) return false
    const socket = this.sessionManager.getSocket(this.currentToken)
    return socket !== null && socket.readyState === WebSocket.OPEN
  }

  private onConnection(ws: WebSocket) {
    // Wait for a handshake as the very first message
    const handshakeTimer = setTimeout(() => {
      console.error("[bridge] No handshake received, closing connection")
      ws.terminate()
    }, HANDSHAKE_TIMEOUT_MS)

    const onFirstMessage = (data: Buffer) => {
      clearTimeout(handshakeTimer)
      ws.off("message", onFirstMessage)
      try {
        const msg = JSON.parse(data.toString())
        if (msg.type === "handshake") {
          this.onHandshake(ws, msg as HandshakeMessage)
        } else {
          console.error("[bridge] Expected handshake, got:", msg.type)
          ws.terminate()
        }
      } catch {
        console.error("[bridge] Failed to parse handshake")
        ws.terminate()
      }
    }

    ws.on("message", onFirstMessage)
    ws.on("error", () => clearTimeout(handshakeTimer))
  }

  private onHandshake(ws: WebSocket, msg: HandshakeMessage) {
    const { token, projectInfo } = msg
    const isExisting = this.sessionManager.hasSession(token)
    const session = this.sessionManager.getOrCreate(token, projectInfo)
    const restoredAt = isExisting ? session.lastSeenAt : null

    // Terminate any stale socket for this token
    const oldSocket = this.sessionManager.getSocket(token)
    if (oldSocket && oldSocket !== ws) {
      oldSocket.terminate()
    }

    this.currentToken = token

    ws.on("message", (data) => {
      try {
        this.handleResponse(JSON.parse(data.toString()) as BridgeResponse)
      } catch {
        console.error("[bridge] Failed to parse message:", data.toString())
      }
    })

    ws.on("close", () => {
      console.error("[bridge] Framer plugin disconnected")
      if (this.currentToken === token) {
        this.pausePendingToQueue(token)
        this.sessionManager.markDisconnected(token, (items) => {
          for (const item of items) {
            item.reject(new Error("Plugin disconnected. Session grace period expired."))
          }
        })
      }
    })

    ws.on("error", (err) => {
      console.error("[bridge] WebSocket error:", err.message)
    })

    // Drain any queued requests from the previous session
    const queued = this.sessionManager.markConnected(token, ws)
    for (const item of queued) {
      const timer = setTimeout(() => {
        this.pending.delete(item.id)
        item.reject(new Error(`Tool timed out after ${REQUEST_TIMEOUT_MS / 1000}s`))
      }, REQUEST_TIMEOUT_MS)
      this.pending.set(item.id, {
        request: JSON.parse(item.serialized),
        resolve: item.resolve,
        reject: item.reject,
        timer,
      })
      ws.send(item.serialized)
    }
    if (queued.length > 0) {
      console.error(`[bridge] Drained ${queued.length} queued request(s)`)
    }

    // Send ack — plugin won't mark itself "connected" until it receives this
    const ack: HandshakeAck = {
      type: "ack",
      sessionId: session.sessionId,
      restoredAt,
      projectInfo: session.projectInfo,
    }
    ws.send(JSON.stringify(ack))

    console.error(
      `[bridge] Session ${session.sessionId.slice(0, 8)} ${isExisting ? "restored" : "created"} (token: ${token.slice(0, 8)})`
    )
  }

  /** Move all in-flight pending requests to the session queue so they survive a reconnect. */
  private pausePendingToQueue(token: string) {
    const count = this.pending.size
    for (const [id, p] of this.pending) {
      if (p.timer) clearTimeout(p.timer)
      const item: QueueItem = {
        id,
        serialized: JSON.stringify(p.request),
        resolve: p.resolve,
        reject: p.reject,
      }
      this.sessionManager.queueItem(token, item)
    }
    this.pending.clear()
    if (count > 0) {
      console.error(`[bridge] Paused ${count} in-flight request(s) to session queue`)
    }
  }

  private handleResponse(msg: BridgeResponse) {
    const pending = this.pending.get(msg.id)
    if (!pending) return

    if (pending.timer) clearTimeout(pending.timer)
    this.pending.delete(msg.id)

    if (msg.error) {
      pending.reject(new Error(msg.error))
    } else {
      pending.resolve(msg.result)
    }
  }

  async send(tool: string, params: Record<string, unknown>): Promise<unknown> {
    const id = randomUUID()
    const request: BridgeRequest = { id, tool, params }
    const serialized = JSON.stringify(request)

    return new Promise((resolve, reject) => {
      if (this.isConnected) {
        const timer = setTimeout(() => {
          this.pending.delete(id)
          reject(new Error(`Tool "${tool}" timed out after ${REQUEST_TIMEOUT_MS / 1000}s`))
        }, REQUEST_TIMEOUT_MS)
        this.pending.set(id, { request, resolve, reject, timer })
        this.sessionManager.getSocket(this.currentToken!)!.send(serialized)
      } else if (this.currentToken && this.sessionManager.isWithinGrace(this.currentToken)) {
        console.error(`[bridge] Queueing "${tool}" during grace period`)
        this.sessionManager.queueItem(this.currentToken, { id, serialized, resolve, reject })
      } else {
        reject(
          new Error(
            "Framer plugin is not connected. Open the Framer MCP plugin in your Framer project to continue."
          )
        )
      }
    })
  }
}
