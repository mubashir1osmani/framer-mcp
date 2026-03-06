// Shared message protocol (mirrors server/src/types.ts)

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
