import { z } from "zod"
import type { FramerBridge } from "../bridge.js"

const CMSFieldTypeSchema = z.enum([
  "string",
  "number",
  "boolean",
  "image",
  "color",
  "link",
  "date",
  "enum",
  "formattedText",
])

export function registerCmsTools(
  server: { tool: (name: string, desc: string, schema: z.ZodRawShape, handler: (args: Record<string, unknown>) => Promise<unknown>) => void },
  bridge: FramerBridge
) {
  server.tool(
    "listCollections",
    "List all CMS collections in the Framer project with their field schemas",
    {},
    async () => bridge.send("listCollections", {})
  )

  server.tool(
    "getCollection",
    "Get a specific CMS collection including its field definitions",
    {
      collectionId: z.string().describe("Collection ID"),
    },
    async (args) => bridge.send("getCollection", args)
  )

  server.tool(
    "createCollection",
    "Create a new CMS collection",
    {
      name: z.string().describe("Collection name"),
      slug: z.string().describe("URL-safe slug for the collection"),
      fields: z.array(
        z.object({
          name: z.string(),
          type: CMSFieldTypeSchema,
          required: z.boolean().optional().default(false),
          userEditable: z.boolean().optional().default(true),
        })
      ).optional().describe("Field definitions (slug and id fields are added automatically)"),
    },
    async (args) => bridge.send("createCollection", args)
  )

  server.tool(
    "listItems",
    "List items in a CMS collection",
    {
      collectionId: z.string().describe("Collection ID"),
    },
    async (args) => bridge.send("listItems", args)
  )

  server.tool(
    "createItem",
    "Create a new item in a CMS collection",
    {
      collectionId: z.string().describe("Collection ID"),
      slug: z.string().describe("URL-safe slug for the item"),
      fieldData: z.record(z.unknown()).describe("Field values keyed by field name or ID"),
      isDraft: z.boolean().optional().default(false).describe("Whether the item is a draft"),
    },
    async (args) => bridge.send("createItem", args)
  )

  server.tool(
    "updateItem",
    "Update an existing CMS item",
    {
      collectionId: z.string().describe("Collection ID"),
      itemId: z.string().describe("Item ID"),
      slug: z.string().optional().describe("New slug"),
      fieldData: z.record(z.unknown()).optional().describe("Updated field values"),
      isDraft: z.boolean().optional().describe("Draft status"),
      isArchived: z.boolean().optional().describe("Archive status"),
    },
    async (args) => bridge.send("updateItem", args)
  )

  server.tool(
    "deleteItem",
    "Delete an item from a CMS collection",
    {
      collectionId: z.string().describe("Collection ID"),
      itemId: z.string().describe("Item ID"),
    },
    async (args) => bridge.send("deleteItem", args)
  )
}
