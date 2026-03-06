// Message protocol between MCP server and Framer plugin over WebSocket

export interface BridgeRequest {
  id: string
  tool: string
  params: Record<string, unknown>
}

export interface BridgeResponse {
  id: string
  result?: unknown
  error?: string
}

// ── Session / handshake protocol ──────────────────────────────────────────────

export interface ProjectInfo {
  name: string
  projectId?: string
}

export interface HandshakeMessage {
  type: "handshake"
  token: string
  projectInfo: ProjectInfo
}

export interface HandshakeAck {
  type: "ack"
  sessionId: string
  restoredAt: string | null
  projectInfo: ProjectInfo
}

export interface SessionInfo {
  token: string
  sessionId: string
  projectInfo: ProjectInfo
  connectedAt: string
  lastSeenAt: string
  disconnectedAt: string | null
}

// ── Canvas types ──────────────────────────────────────────────────────────────

export interface NodeInfo {
  id: string
  name: string
  type: string
  visible: boolean
  locked: boolean
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
  children?: NodeInfo[]
  // Type-specific props serialized as JSON
  props?: Record<string, unknown>
}

export interface PageInfo {
  id: string
  name: string
}

// ── CMS types ─────────────────────────────────────────────────────────────────

export type CMSFieldType =
  | "string"
  | "number"
  | "boolean"
  | "image"
  | "color"
  | "link"
  | "date"
  | "enum"
  | "formattedText"

export interface CMSField {
  id: string
  name: string
  type: CMSFieldType
  required?: boolean
  userEditable?: boolean
}

export interface CMSCollection {
  id: string
  name: string
  slug: string
  fields: CMSField[]
}

export interface CMSItem {
  id: string
  slug: string
  fieldData: Record<string, unknown>
  isDraft: boolean
  isArchived: boolean
}

// ── Design system types ───────────────────────────────────────────────────────

export interface ColorStyle {
  id: string
  name: string
  light: string
  dark?: string
}

export interface TextStyle {
  id: string
  name: string
  fontFamily: string
  fontWeight: number
  fontSize: number
  lineHeight: number | string
  letterSpacing: number | string
  color?: string
}
