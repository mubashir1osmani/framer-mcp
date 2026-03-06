import { framer } from "framer-plugin"
import type { PluginBridge } from "../bridge"

export function registerDesignHandlers(bridge: PluginBridge) {
  // ── Color Styles ────────────────────────────────────────────────────────────

  bridge.registerHandler("listColorStyles", async () => {
    const styles = await framer.getColorStyles()
    return styles.map((s) => ({
      id: s.id,
      name: s.name,
      light: s.light,
      dark: s.dark,
    }))
  })

  bridge.registerHandler("getColorStyle", async ({ colorStyleId, name }) => {
    const styles = await framer.getColorStyles()
    const style = colorStyleId
      ? styles.find((s) => s.id === colorStyleId)
      : styles.find((s) => s.name === name)
    if (!style) throw new Error(`Color style not found: ${colorStyleId ?? name}`)
    return { id: style.id, name: style.name, light: style.light, dark: style.dark }
  })

  bridge.registerHandler("createColorStyle", async ({ name, light, dark }) => {
    const style = await framer.createColorStyle({
      name: name as string,
      light: light as string,
      dark: dark as string | undefined,
    })
    return { id: style.id, name: style.name, light: style.light, dark: style.dark }
  })

  bridge.registerHandler("updateColorStyle", async ({ colorStyleId, name, light, dark }) => {
    const styles = await framer.getColorStyles()
    const style = styles.find((s) => s.id === colorStyleId)
    if (!style) throw new Error(`Color style not found: ${colorStyleId}`)

    const updates: Record<string, unknown> = {}
    if (name !== undefined) updates.name = name
    if (light !== undefined) updates.light = light
    if (dark !== undefined) updates.dark = dark

    await style.setAttributes(updates)
    return { id: style.id, name: style.name, light: style.light, dark: style.dark }
  })

  bridge.registerHandler("deleteColorStyle", async ({ colorStyleId }) => {
    const styles = await framer.getColorStyles()
    const style = styles.find((s) => s.id === colorStyleId)
    if (!style) throw new Error(`Color style not found: ${colorStyleId}`)
    await style.remove()
    return { success: true, colorStyleId }
  })

  // ── Text Styles ─────────────────────────────────────────────────────────────

  bridge.registerHandler("listTextStyles", async () => {
    const styles = await framer.getTextStyles()
    return styles.map((s) => ({
      id: s.id,
      name: s.name,
      fontFamily: s.fontFamily,
      fontWeight: s.fontWeight,
      fontSize: s.fontSize,
      lineHeight: s.lineHeight,
      letterSpacing: s.letterSpacing,
      color: s.color,
    }))
  })

  bridge.registerHandler("createTextStyle", async (params) => {
    const { name, fontFamily, fontWeight, fontSize, lineHeight, letterSpacing, color } = params as {
      name: string; fontFamily: string; fontWeight: number; fontSize: number
      lineHeight?: number | string; letterSpacing?: number | string; color?: string
    }

    const style = await framer.createTextStyle({
      name,
      fontFamily,
      fontWeight,
      fontSize,
      ...(lineHeight !== undefined ? { lineHeight } : {}),
      ...(letterSpacing !== undefined ? { letterSpacing } : {}),
      ...(color ? { color } : {}),
    })

    return {
      id: style.id,
      name: style.name,
      fontFamily: style.fontFamily,
      fontWeight: style.fontWeight,
      fontSize: style.fontSize,
    }
  })

  bridge.registerHandler("updateTextStyle", async (params) => {
    const { textStyleId, ...updates } = params as { textStyleId: string } & Record<string, unknown>
    const styles = await framer.getTextStyles()
    const style = styles.find((s) => s.id === textStyleId)
    if (!style) throw new Error(`Text style not found: ${textStyleId}`)

    const allowed = ["name", "fontFamily", "fontWeight", "fontSize", "lineHeight", "letterSpacing", "color"]
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([k]) => allowed.includes(k))
    )
    await style.setAttributes(filtered)

    return {
      id: style.id,
      name: style.name,
      fontFamily: style.fontFamily,
      fontWeight: style.fontWeight,
      fontSize: style.fontSize,
    }
  })

  bridge.registerHandler("deleteTextStyle", async ({ textStyleId }) => {
    const styles = await framer.getTextStyles()
    const style = styles.find((s) => s.id === textStyleId)
    if (!style) throw new Error(`Text style not found: ${textStyleId}`)
    await style.remove()
    return { success: true, textStyleId }
  })
}
