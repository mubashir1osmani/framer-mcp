import { framer } from "framer-plugin"
import type { PluginBridge } from "../bridge"

export function registerCmsHandlers(bridge: PluginBridge) {
  bridge.registerHandler("listCollections", async () => {
    const collections = await framer.getManagedCollections()
    return Promise.all(
      collections.map(async (c) => {
        const fields = await c.getFields()
        return {
          id: c.id,
          name: c.name,
          slug: c.slug,
          fields: fields.map((f) => ({
            id: f.id,
            name: f.name,
            type: f.type,
          })),
        }
      })
    )
  })

  bridge.registerHandler("getCollection", async ({ collectionId }) => {
    const collections = await framer.getManagedCollections()
    const collection = collections.find((c) => c.id === collectionId)
    if (!collection) throw new Error(`Collection not found: ${collectionId}`)
    const fields = await collection.getFields()
    const items = await collection.getItems()
    return {
      id: collection.id,
      name: collection.name,
      slug: collection.slug,
      fields: fields.map((f) => ({ id: f.id, name: f.name, type: f.type })),
      itemCount: items.length,
    }
  })

  bridge.registerHandler("createCollection", async (params) => {
    const { name, slug, fields } = params as {
      name: string
      slug: string
      fields?: Array<{ name: string; type: string; required?: boolean; userEditable?: boolean }>
    }

    const collection = await framer.createManagedCollection({ name, slug })

    if (fields && fields.length > 0) {
      await collection.setFields(
        fields.map((f) => ({
          id: f.name.toLowerCase().replace(/\s+/g, "-"),
          name: f.name,
          type: f.type as Parameters<typeof collection.setFields>[0][0]["type"],
          userEditable: f.userEditable ?? true,
        }))
      )
    }

    return {
      id: collection.id,
      name: collection.name,
      slug: collection.slug,
    }
  })

  bridge.registerHandler("listItems", async ({ collectionId }) => {
    const collections = await framer.getManagedCollections()
    const collection = collections.find((c) => c.id === collectionId)
    if (!collection) throw new Error(`Collection not found: ${collectionId}`)
    const items = await collection.getItems()
    return items.map((item) => ({
      id: item.id,
      slug: item.slug,
      isDraft: item.isDraft,
      isArchived: item.isArchived,
      fieldData: item.fieldData,
    }))
  })

  bridge.registerHandler("createItem", async (params) => {
    const { collectionId, slug, fieldData, isDraft } = params as {
      collectionId: string
      slug: string
      fieldData: Record<string, unknown>
      isDraft?: boolean
    }

    const collections = await framer.getManagedCollections()
    const collection = collections.find((c) => c.id === collectionId)
    if (!collection) throw new Error(`Collection not found: ${collectionId}`)

    const item = await collection.addItem({
      slug,
      isDraft: isDraft ?? false,
      fieldData,
    })

    return {
      id: item.id,
      slug: item.slug,
      isDraft: item.isDraft,
      fieldData: item.fieldData,
    }
  })

  bridge.registerHandler("updateItem", async (params) => {
    const { collectionId, itemId, slug, fieldData, isDraft, isArchived } = params as {
      collectionId: string
      itemId: string
      slug?: string
      fieldData?: Record<string, unknown>
      isDraft?: boolean
      isArchived?: boolean
    }

    const collections = await framer.getManagedCollections()
    const collection = collections.find((c) => c.id === collectionId)
    if (!collection) throw new Error(`Collection not found: ${collectionId}`)

    const items = await collection.getItems()
    const item = items.find((i) => i.id === itemId)
    if (!item) throw new Error(`Item not found: ${itemId}`)

    const updates: Record<string, unknown> = {}
    if (slug !== undefined) updates.slug = slug
    if (fieldData !== undefined) updates.fieldData = { ...item.fieldData, ...fieldData }
    if (isDraft !== undefined) updates.isDraft = isDraft
    if (isArchived !== undefined) updates.isArchived = isArchived

    await item.setAttributes(updates)

    return {
      id: item.id,
      slug: item.slug,
      isDraft: item.isDraft,
      isArchived: item.isArchived,
      fieldData: item.fieldData,
    }
  })

  bridge.registerHandler("deleteItem", async ({ collectionId, itemId }) => {
    const collections = await framer.getManagedCollections()
    const collection = collections.find((c) => c.id === collectionId)
    if (!collection) throw new Error(`Collection not found: ${collectionId}`)

    const items = await collection.getItems()
    const item = items.find((i) => i.id === itemId)
    if (!item) throw new Error(`Item not found: ${itemId}`)

    await item.remove()
    return { success: true, itemId }
  })
}
