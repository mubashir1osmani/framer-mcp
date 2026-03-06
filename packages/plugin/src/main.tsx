import { framer } from "framer-plugin"
import { createRoot } from "react-dom/client"
import { useState, useEffect } from "react"
import { PluginBridge, ConnectionStatus, LogEntry } from "./bridge"
import { registerCanvasHandlers } from "./handlers/canvas"
import { registerCmsHandlers } from "./handlers/cms"
import { registerDesignHandlers } from "./handlers/design"
import { App } from "./App"

// Show as a docked panel on the right side
framer.showUI({
  position: "top right",
  width: 240,
  height: 400,
  resizable: true,
})

// Initialize the bridge and register all handlers
const bridge = new PluginBridge()
registerCanvasHandlers(bridge)
registerCmsHandlers(bridge)
registerDesignHandlers(bridge)

// Root component that subscribes to bridge state
function Root() {
  const [status, setStatus] = useState<ConnectionStatus>(bridge.status)
  const [log, setLog] = useState<LogEntry[]>(bridge.logEntries)

  useEffect(() => {
    const unsubStatus = bridge.onStatusChange(setStatus)
    const unsubLog = bridge.onLogChange(setLog)
    return () => {
      unsubStatus()
      unsubLog()
    }
  }, [])

  return <App status={status} log={log} />
}

const container = document.getElementById("root")!
createRoot(container).render(<Root />)
