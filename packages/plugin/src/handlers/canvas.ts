import { framer, CanvasNode } from "framer-plugin"
import type { PluginBridge } from "../bridge"

function serializeNode(node: CanvasNode) {
  return {
    id: node.id,
    name: node.name,
    type: node.__class,
    x: "x" in node ? (node as unknown as { x: number }).x : 0,
    y: "y" in node ? (node as unknown as { y: number }).y : 0,
    width: "width" in node ? (node as unknown as { width: number }).width : 0,
    height: "height" in node ? (node as unknown as { height: number }).height : 0,
    visible: "visible" in node ? (node as unknown as { visible: boolean }).visible : true,
    locked: "locked" in node ? (node as unknown as { locked: boolean }).locked : false,
  }
}

export function registerCanvasHandlers(bridge: PluginBridge) {
  bridge.registerHandler("getPages", async () => {
    const pages = await framer.getPages()
    return pages.map((p) => ({ id: p.id, name: p.name }))
  })

  bridge.registerHandler("getCurrentPage", async () => {
    const page = await framer.getCurrentPage()
    if (!page) return null
    const children = await page.getChildren()
    return {
      id: page.id,
      name: page.name,
      children: children.map(serializeNode),
    }
  })

  bridge.registerHandler("navigateToPage", async ({ pageId, pageName }) => {
    const pages = await framer.getPages()
    let target = pageId
      ? pages.find((p) => p.id === pageId)
      : pages.find((p) => p.name === pageName)
    if (!target) throw new Error(`Page not found: ${pageId ?? pageName}`)
    await framer.setCurrentPage(target)
    return { success: true, pageId: target.id, pageName: target.name }
  })

  bridge.registerHandler("getSelection", async () => {
    const selection = await framer.getSelection()
    return selection.map(serializeNode)
  })

  bridge.registerHandler("getNode", async ({ nodeId }) => {
    const node = await framer.getNode(nodeId as string)
    if (!node) throw new Error(`Node not found: ${nodeId}`)
    return serializeNode(node)
  })

  bridge.registerHandler("getChildren", async ({ nodeId }) => {
    const node = await framer.getNode(nodeId as string)
    if (!node) throw new Error(`Node not found: ${nodeId}`)
    if (!("getChildren" in node)) return []
    const children = await (node as unknown as { getChildren: () => Promise<CanvasNode[]> }).getChildren()
    return children.map(serializeNode)
  })

  bridge.registerHandler("createFrame", async (params) => {
    const { name, x, y, width, height, fillColor, cornerRadius, parentId } = params as {
      name?: string; x?: number; y?: number; width?: number; height?: number
      fillColor?: string; cornerRadius?: number; parentId?: string
    }

    const node = await framer.createFrame({
      name: name ?? "Frame",
      x: x ?? 0,
      y: y ?? 0,
      width: width ?? 200,
      height: height ?? 200,
      ...(fillColor ? { backgroundColor: fillColor } : {}),
      ...(cornerRadius !== undefined ? { cornerRadius } : {}),
    })

    if (parentId) {
      const parent = await framer.getNode(parentId)
      if (parent && "addChild" in parent) {
        await (parent as unknown as { addChild: (n: CanvasNode) => Promise<void> }).addChild(node)
      }
    }

    return serializeNode(node)
  })

  bridge.registerHandler("createText", async (params) => {
    const { content, name, x, y, fontSize, fontWeight, fontFamily, color, width, parentId } = params as {
      content: string; name?: string; x?: number; y?: number; fontSize?: number
      fontWeight?: number; fontFamily?: string; color?: string; width?: number; parentId?: string
    }

    const node = await framer.createText({
      name: name ?? "Text",
      text: content,
      x: x ?? 0,
      y: y ?? 0,
      ...(fontSize !== undefined ? { fontSize } : {}),
      ...(fontWeight !== undefined ? { fontWeight } : {}),
      ...(fontFamily ? { fontFamily } : {}),
      ...(color ? { color } : {}),
      ...(width !== undefined ? { width } : {}),
    })

    if (parentId) {
      const parent = await framer.getNode(parentId)
      if (parent && "addChild" in parent) {
        await (parent as unknown as { addChild: (n: CanvasNode) => Promise<void> }).addChild(node)
      }
    }

    return serializeNode(node)
  })

  bridge.registerHandler("updateNode", async (params) => {
    const { nodeId, ...updates } = params as { nodeId: string } & Record<string, unknown>
    const node = await framer.getNode(nodeId)
    if (!node) throw new Error(`Node not found: ${nodeId}`)

    const allowed = ["name", "x", "y", "width", "height", "rotation", "opacity", "visible", "locked",
      "backgroundColor", "content", "text", "fontSize", "fontWeight", "fontFamily", "color", "cornerRadius"]

    const filteredUpdates: Record<string, unknown> = {}
    if (updates.fillColor) filteredUpdates.backgroundColor = updates.fillColor
    if (updates.content) filteredUpdates.text = updates.content
    for (const key of allowed) {
      if (key in updates) filteredUpdates[key] = updates[key]
    }

    await node.setAttributes(filteredUpdates)
    return serializeNode(node)
  })

  bridge.registerHandler("deleteNode", async ({ nodeId }) => {
    const node = await framer.getNode(nodeId as string)
    if (!node) throw new Error(`Node not found: ${nodeId}`)
    await node.remove()
    return { success: true, nodeId }
  })

  bridge.registerHandler("duplicateNode", async ({ nodeId, offsetX, offsetY }) => {
    const node = await framer.getNode(nodeId as string)
    if (!node) throw new Error(`Node not found: ${nodeId}`)
    const clone = await node.clone()
    const ox = (offsetX as number) ?? 20
    const oy = (offsetY as number) ?? 20
    if ("x" in clone && "y" in clone) {
      const x = (clone as unknown as { x: number }).x
      const y = (clone as unknown as { y: number }).y
      await clone.setAttributes({ x: x + ox, y: y + oy })
    }
    return serializeNode(clone)
  })

  bridge.registerHandler("moveNode", async ({ nodeId, parentId, x, y }) => {
    const node = await framer.getNode(nodeId as string)
    if (!node) throw new Error(`Node not found: ${nodeId}`)

    const updates: Record<string, unknown> = {}
    if (x !== undefined) updates.x = x
    if (y !== undefined) updates.y = y
    if (Object.keys(updates).length > 0) await node.setAttributes(updates)

    if (parentId) {
      const parent = await framer.getNode(parentId as string)
      if (!parent) throw new Error(`Parent not found: ${parentId}`)
      if ("addChild" in parent) {
        await (parent as unknown as { addChild: (n: CanvasNode) => Promise<void> }).addChild(node)
      }
    }

    return serializeNode(node)
  })

  bridge.registerHandler("groupNodes", async ({ nodeIds, groupName }) => {
    const ids = nodeIds as string[]
    const nodes = await Promise.all(ids.map((id) => framer.getNode(id)))
    const valid = nodes.filter(Boolean) as CanvasNode[]
    if (valid.length === 0) throw new Error("No valid nodes found to group")

    const group = await framer.group(valid)
    if (groupName) await group.setAttributes({ name: groupName })
    return serializeNode(group)
  })

  bridge.registerHandler("getNodeXml", async ({ nodeId }) => {
    const node = await framer.getNode(nodeId as string)
    if (!node) throw new Error(`Node not found: ${nodeId}`)
    if (!("getXML" in node)) throw new Error("Node does not support XML export")
    const xml = await (node as unknown as { getXML: () => Promise<string> }).getXML()
    return { nodeId, xml }
  })

  bridge.registerHandler("setNodeXml", async ({ nodeId, xml }) => {
    const node = await framer.getNode(nodeId as string)
    if (!node) throw new Error(`Node not found: ${nodeId}`)
    if (!("setXML" in node)) throw new Error("Node does not support XML import")
    await (node as unknown as { setXML: (xml: string) => Promise<void> }).setXML(xml as string)
    return serializeNode(node)
  })
}
