import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"
import { FramerBridge } from "./bridge.js"
import { registerCanvasTools } from "./tools/canvas.js"
import { registerCmsTools } from "./tools/cms.js"
import { registerDesignTools } from "./tools/design.js"

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

async function main() {
  const bridge = new FramerBridge()
  const mcpServer = new McpServer({
    name: "framer-mcp",
    version: "0.1.0",
  })

  const adapter = makeServerAdapter(mcpServer, bridge)

  registerCanvasTools(adapter, bridge)
  registerCmsTools(adapter, bridge)
  registerDesignTools(adapter, bridge)

  const transport = new StdioServerTransport()
  await mcpServer.connect(transport)
  console.error("[mcp] Framer MCP server started")
}

main().catch((err) => {
  console.error("[mcp] Fatal error:", err)
  process.exit(1)
})
