import { z } from "zod"
import type { FramerBridge } from "../bridge.js"

export function registerDesignTools(
  server: { tool: (name: string, desc: string, schema: z.ZodRawShape, handler: (args: Record<string, unknown>) => Promise<unknown>) => void },
  bridge: FramerBridge
) {
  // ── Color Styles ────────────────────────────────────────────────────────────

  server.tool(
    "listColorStyles",
    "List all color styles in the Framer project",
    {},
    async () => bridge.send("listColorStyles", {})
  )

  server.tool(
    "getColorStyle",
    "Get a specific color style by ID or name",
    {
      colorStyleId: z.string().optional().describe("Color style ID"),
      name: z.string().optional().describe("Color style name (used if ID not provided)"),
    },
    async (args) => bridge.send("getColorStyle", args)
  )

  server.tool(
    "createColorStyle",
    "Create a new color style",
    {
      name: z.string().describe("Color style name (e.g. 'Primary/500')"),
      light: z.string().describe("Light mode color value (hex, rgb, rgba, or hsl)"),
      dark: z.string().optional().describe("Dark mode color value (uses light value if omitted)"),
    },
    async (args) => bridge.send("createColorStyle", args)
  )

  server.tool(
    "updateColorStyle",
    "Update an existing color style",
    {
      colorStyleId: z.string().describe("Color style ID"),
      name: z.string().optional().describe("New name"),
      light: z.string().optional().describe("New light mode color value"),
      dark: z.string().optional().describe("New dark mode color value"),
    },
    async (args) => bridge.send("updateColorStyle", args)
  )

  server.tool(
    "deleteColorStyle",
    "Delete a color style",
    {
      colorStyleId: z.string().describe("Color style ID"),
    },
    async (args) => bridge.send("deleteColorStyle", args)
  )

  // ── Text Styles ─────────────────────────────────────────────────────────────

  server.tool(
    "listTextStyles",
    "List all text styles in the Framer project",
    {},
    async () => bridge.send("listTextStyles", {})
  )

  server.tool(
    "createTextStyle",
    "Create a new text style",
    {
      name: z.string().describe("Text style name (e.g. 'Heading/H1')"),
      fontFamily: z.string().describe("Font family name"),
      fontWeight: z.number().int().describe("Font weight (100–900)"),
      fontSize: z.number().describe("Font size in px"),
      lineHeight: z.union([z.number(), z.string()]).optional().describe("Line height (number for px, string for %)"),
      letterSpacing: z.union([z.number(), z.string()]).optional().describe("Letter spacing"),
      color: z.string().optional().describe("Default text color"),
    },
    async (args) => bridge.send("createTextStyle", args)
  )

  server.tool(
    "updateTextStyle",
    "Update an existing text style",
    {
      textStyleId: z.string().describe("Text style ID"),
      name: z.string().optional().describe("New name"),
      fontFamily: z.string().optional().describe("Font family"),
      fontWeight: z.number().int().optional().describe("Font weight"),
      fontSize: z.number().optional().describe("Font size in px"),
      lineHeight: z.union([z.number(), z.string()]).optional().describe("Line height"),
      letterSpacing: z.union([z.number(), z.string()]).optional().describe("Letter spacing"),
      color: z.string().optional().describe("Default text color"),
    },
    async (args) => bridge.send("updateTextStyle", args)
  )

  server.tool(
    "deleteTextStyle",
    "Delete a text style",
    {
      textStyleId: z.string().describe("Text style ID"),
    },
    async (args) => bridge.send("deleteTextStyle", args)
  )
}
