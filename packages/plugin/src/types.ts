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
