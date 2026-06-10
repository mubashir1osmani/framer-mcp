import { randomUUID } from "node:crypto"
import { createServer } from "node:http"
import express, { type Request, type Response, type NextFunction } from "express"
import cors from "cors"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js"
import { z } from "zod"
import { FramerBridge } from "./bridge.js"
import { registerCanvasTools } from "./tools/canvas.js"
import { registerCmsTools } from "./tools/cms.js"
import { registerDesignTools } from "./tools/design.js"

const HTTP_PORT = Number(process.env.PORT ?? 3000)
// When set, every /mcp request must carry `Authorization: Bearer <token>`.
const AUTH_TOKEN = process.env.MCP_AUTH_TOKEN

// Adapter so tool files can call server.tool() with a plain ZodRawShape
function makeServerAdapter(mcpServer: McpServer, bridge: FramerBridge) {
  return {
    tool(
      name: string,
      description: string,
      schema: z.ZodRawShape,
      handler: (args: Record<string, unknown>) => Promise<unknown>
    ) {
      mcpServer.tool(name, description, schema, async (args) => {
        try {
          const result = await handler(args as Record<string, unknown>)
          return {
            content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          return {
            content: [{ type: "text" as const, text: `Error: ${message}` }],
            isError: true,
          }
        }
      })
    },
  }
}

/** Builds a fresh McpServer wired to the shared Framer bridge. One per MCP session. */
function createMcpServer(bridge: FramerBridge): McpServer {
  const mcpServer = new McpServer({
    name: "framer-mcp",
    version: "0.1.0",
  })

  const adapter = makeServerAdapter(mcpServer, bridge)
  registerCanvasTools(adapter, bridge)
  registerCmsTools(adapter, bridge)
  registerDesignTools(adapter, bridge)

  return mcpServer
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!AUTH_TOKEN) return next()
  if (req.headers.authorization === `Bearer ${AUTH_TOKEN}`) return next()
  res.status(401).json({
    jsonrpc: "2.0",
    error: { code: -32001, message: "Unauthorized" },
    id: null,
  })
}

async function main() {
  const app = express()
  const httpServer = createServer(app)

  // Single shared bridge: the Framer plugin connects over WebSocket at /bridge on
  // this same HTTP server, independent of how many MCP client sessions are open.
  const bridge = new FramerBridge(httpServer)

  // One transport per MCP session, keyed by the protocol's mcp-session-id header.
  const transports: Record<string, StreamableHTTPServerTransport> = {}

  // Allow browser-based MCP clients to call the server cross-origin and to read
  // the session id the transport returns. ALLOWED_ORIGINS (comma-separated)
  // restricts origins; defaults to "*".
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim())
  app.use(
    cors({
      origin: allowedOrigins ?? "*",
      exposedHeaders: ["Mcp-Session-Id"],
      allowedHeaders: ["Content-Type", "Authorization", "Mcp-Session-Id", "Mcp-Protocol-Version"],
    })
  )

  app.use(express.json())

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", bridgeConnected: bridge.isConnected })
  })

  // Client → server messages (and the initial handshake).
  app.post("/mcp", requireAuth, async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined
    let transport: StreamableHTTPServerTransport

    if (sessionId && transports[sessionId]) {
      transport = transports[sessionId]
    } else if (!sessionId && isInitializeRequest(req.body)) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          transports[sid] = transport
          console.error(`[http] MCP session initialized: ${sid.slice(0, 8)}`)
        },
      })

      transport.onclose = () => {
        if (transport.sessionId) {
          delete transports[transport.sessionId]
          console.error(`[http] MCP session closed: ${transport.sessionId.slice(0, 8)}`)
        }
      }

      const server = createMcpServer(bridge)
      await server.connect(transport)
    } else {
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Bad Request: No valid session ID provided" },
        id: null,
      })
      return
    }

    await transport.handleRequest(req, res, req.body)
  })

  // Server → client streaming (GET) and session teardown (DELETE).
  const handleSessionRequest = async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send("Invalid or missing session ID")
      return
    }
    await transports[sessionId].handleRequest(req, res)
  }

  app.get("/mcp", requireAuth, handleSessionRequest)
  app.delete("/mcp", requireAuth, handleSessionRequest)

  httpServer.listen(HTTP_PORT, () => {
    console.error(`[http] Framer MCP server listening on http://0.0.0.0:${HTTP_PORT}/mcp`)
    if (AUTH_TOKEN) console.error("[http] Bearer auth required on /mcp")
  })
}

main().catch((err) => {
  console.error("[mcp] Fatal error:", err)
  process.exit(1)
})
