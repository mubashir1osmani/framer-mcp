import { z } from "zod"
import type { FramerBridge } from "../bridge.js"

export function registerCanvasTools(
  server: { tool: (name: string, desc: string, schema: z.ZodRawShape, handler: (args: Record<string, unknown>) => Promise<unknown>) => void },
  bridge: FramerBridge
) {
  server.tool(
    "getPages",
    "Get all pages in the Framer project",
    {},
    async () => bridge.send("getPages", {})
  )

  server.tool(
    "getCurrentPage",
    "Get the currently active page with its top-level nodes",
    {},
    async () => bridge.send("getCurrentPage", {})
  )

  server.tool(
    "navigateToPage",
    "Navigate to a page by ID or name",
    {
      pageId: z.string().optional().describe("Page ID"),
      pageName: z.string().optional().describe("Page name (used if pageId not provided)"),
    },
    async (args) => bridge.send("navigateToPage", args)
  )

  server.tool(
    "getSelection",
    "Get the currently selected nodes on the canvas",
    {},
    async () => bridge.send("getSelection", {})
  )

  server.tool(
    "getNode",
    "Get full details of a node by ID",
    {
      nodeId: z.string().describe("The node ID"),
    },
    async (args) => bridge.send("getNode", args)
  )

  server.tool(
    "getChildren",
    "Get the direct children of a node (use root page node ID for top-level nodes)",
    {
      nodeId: z.string().describe("Parent node ID"),
    },
    async (args) => bridge.send("getChildren", args)
  )

  server.tool(
    "createFrame",
    "Create a new frame (rectangle/container) on the canvas",
    {
      name: z.string().optional().describe("Frame name"),
      x: z.number().optional().default(0).describe("X position"),
      y: z.number().optional().default(0).describe("Y position"),
      width: z.number().optional().default(200).describe("Width in px"),
      height: z.number().optional().default(200).describe("Height in px"),
      fillColor: z.string().optional().describe("Fill color (hex, rgb, rgba, or CSS color)"),
      cornerRadius: z.number().optional().describe("Corner radius in px"),
      parentId: z.string().optional().describe("Parent node ID (defaults to current page)"),
    },
    async (args) => bridge.send("createFrame", args)
  )

  server.tool(
    "createText",
    "Create a new text node on the canvas",
    {
      content: z.string().describe("Text content"),
      name: z.string().optional().describe("Node name"),
      x: z.number().optional().default(0).describe("X position"),
      y: z.number().optional().default(0).describe("Y position"),
      fontSize: z.number().optional().default(16).describe("Font size in px"),
      fontWeight: z.number().optional().default(400).describe("Font weight (400, 500, 600, 700, etc.)"),
      fontFamily: z.string().optional().describe("Font family name"),
      color: z.string().optional().describe("Text color (hex, rgb, or CSS color)"),
      width: z.number().optional().describe("Fixed width (auto if omitted)"),
      parentId: z.string().optional().describe("Parent node ID (defaults to current page)"),
    },
    async (args) => bridge.send("createText", args)
  )

  server.tool(
    "updateNode",
    "Update properties of an existing node",
    {
      nodeId: z.string().describe("The node ID to update"),
      name: z.string().optional().describe("New name"),
      x: z.number().optional().describe("New X position"),
      y: z.number().optional().describe("New Y position"),
      width: z.number().optional().describe("New width"),
      height: z.number().optional().describe("New height"),
      rotation: z.number().optional().describe("Rotation in degrees"),
      opacity: z.number().min(0).max(1).optional().describe("Opacity 0-1"),
      visible: z.boolean().optional().describe("Visibility"),
      locked: z.boolean().optional().describe("Locked state"),
      fillColor: z.string().optional().describe("Fill color (frames only)"),
      content: z.string().optional().describe("Text content (text nodes only)"),
      fontSize: z.number().optional().describe("Font size (text nodes only)"),
      fontWeight: z.number().optional().describe("Font weight (text nodes only)"),
      fontFamily: z.string().optional().describe("Font family (text nodes only)"),
      color: z.string().optional().describe("Text color (text nodes only)"),
      cornerRadius: z.number().optional().describe("Corner radius (frame nodes only)"),
    },
    async (args) => bridge.send("updateNode", args)
  )

  server.tool(
    "deleteNode",
    "Delete a node from the canvas",
    {
      nodeId: z.string().describe("The node ID to delete"),
    },
    async (args) => bridge.send("deleteNode", args)
  )

  server.tool(
    "duplicateNode",
    "Duplicate a node",
    {
      nodeId: z.string().describe("The node ID to duplicate"),
      offsetX: z.number().optional().default(20).describe("X offset for the duplicate"),
      offsetY: z.number().optional().default(20).describe("Y offset for the duplicate"),
    },
    async (args) => bridge.send("duplicateNode", args)
  )

  server.tool(
    "moveNode",
    "Move a node to a new parent or change its position",
    {
      nodeId: z.string().describe("The node ID to move"),
      parentId: z.string().optional().describe("New parent node ID (omit to keep current parent)"),
      x: z.number().optional().describe("New X position"),
      y: z.number().optional().describe("New Y position"),
    },
    async (args) => bridge.send("moveNode", args)
  )

  server.tool(
    "groupNodes",
    "Group multiple nodes into a new frame",
    {
      nodeIds: z.array(z.string()).min(1).describe("Array of node IDs to group"),
      groupName: z.string().optional().describe("Name for the new group frame"),
    },
    async (args) => bridge.send("groupNodes", args)
  )

  server.tool(
    "getNodeXml",
    "Get the raw Framer XML representation of a node (useful for complex reads)",
    {
      nodeId: z.string().describe("The node ID"),
    },
    async (args) => bridge.send("getNodeXml", args)
  )

  server.tool(
    "setNodeXml",
    "Update a node using raw Framer XML (for advanced modifications)",
    {
      nodeId: z.string().describe("The node ID to update"),
      xml: z.string().describe("The full XML string for the node"),
    },
    async (args) => bridge.send("setNodeXml", args)
  )
}
