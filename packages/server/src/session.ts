import { randomUUID } from "crypto"
import { readFileSync, writeFileSync, mkdirSync } from "fs"
import { homedir } from "os"
import { join } from "path"
import { WebSocket } from "ws"
import type { SessionInfo, ProjectInfo } from "./types.js"

const SESSIONS_DIR = join(homedir(), ".framer-mcp")
const SESSIONS_FILE = join(SESSIONS_DIR, "sessions.json")
const GRACE_PERIOD_MS = 15_000

export type QueueItem = {
  id: string
  serialized: string
  resolve: (value: unknown) => void
  reject: (err: Error) => void
}

type RuntimeSession = SessionInfo & {
  socket: WebSocket | null
  graceTimer: NodeJS.Timeout | null
  queue: QueueItem[]
}

export class SessionManager {
  private sessions = new Map<string, RuntimeSession>()

  constructor() {
    this.loadFromDisk()
  }

  hasSession(token: string): boolean {
    return this.sessions.has(token)
  }

  getOrCreate(token: string, projectInfo: ProjectInfo): SessionInfo {
    let session = this.sessions.get(token)
    if (!session) {
      const now = new Date().toISOString()
      session = {
        token,
        sessionId: randomUUID(),
        projectInfo,
        connectedAt: now,
        lastSeenAt: now,
        disconnectedAt: null,
        socket: null,
        graceTimer: null,
        queue: [],
      }
      this.sessions.set(token, session)
    }
    return session
  }

  /** Marks the session connected, clears the grace timer, returns queued items to drain. */
  markConnected(token: string, ws: WebSocket): QueueItem[] {
    const session = this.sessions.get(token)
    if (!session) return []

    if (session.graceTimer) {
      clearTimeout(session.graceTimer)
      session.graceTimer = null
    }

    session.socket = ws
    session.disconnectedAt = null
    session.lastSeenAt = new Date().toISOString()
    this.saveToDisk()

    const queued = [...session.queue]
    session.queue = []
    return queued
  }

  /** Marks the session disconnected and starts the grace timer. */
  markDisconnected(token: string, onGraceExpired: (items: QueueItem[]) => void) {
    const session = this.sessions.get(token)
    if (!session) return

    session.socket = null
    session.disconnectedAt = new Date().toISOString()
    session.lastSeenAt = new Date().toISOString()
    this.saveToDisk()

    session.graceTimer = setTimeout(() => {
      const s = this.sessions.get(token)
      if (!s) return
      const items = [...s.queue]
      s.queue = []
      s.graceTimer = null
      console.error(
        `[session] Grace period expired for token ${token.slice(0, 8)}, rejecting ${items.length} queued request(s)`
      )
      onGraceExpired(items)
    }, GRACE_PERIOD_MS)
  }

  getSocket(token: string): WebSocket | null {
    return this.sessions.get(token)?.socket ?? null
  }

  isWithinGrace(token: string): boolean {
    const session = this.sessions.get(token)
    return session?.graceTimer !== null && session?.graceTimer !== undefined
  }

  queueItem(token: string, item: QueueItem) {
    this.sessions.get(token)?.queue.push(item)
  }

  private loadFromDisk() {
    try {
      const raw = readFileSync(SESSIONS_FILE, "utf8")
      const data = JSON.parse(raw) as SessionInfo[]
      const now = new Date().toISOString()
      for (const s of data) {
        this.sessions.set(s.token, {
          ...s,
          disconnectedAt: s.disconnectedAt ?? now,
          socket: null,
          graceTimer: null,
          queue: [],
        })
      }
      console.error(`[session] Loaded ${data.length} session(s) from disk`)
    } catch {
      // No sessions file yet — that's fine
    }
  }

  private saveToDisk() {
    try {
      mkdirSync(SESSIONS_DIR, { recursive: true })
      const data: SessionInfo[] = [...this.sessions.values()].map(
        ({ socket: _s, graceTimer: _g, queue: _q, ...info }) => info
      )
      writeFileSync(SESSIONS_FILE, JSON.stringify(data, null, 2))
    } catch (err) {
      console.error("[session] Failed to save sessions:", err)
    }
  }
}
