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
  const [sessionId, setSessionId] = useState<string | null>(bridge.sessionId)
  const [restored, setRestored] = useState(false)

  useEffect(() => {
    const unsubStatus = bridge.onStatusChange(setStatus)
    const unsubLog = bridge.onLogChange(setLog)
    const unsubSession = bridge.onSessionChange(({ sessionId: id, restored: r }) => {
      setSessionId(id)
      setRestored(r)
    })
    return () => {
      unsubStatus()
      unsubLog()
      unsubSession()
    }
  }, [])

  return <App status={status} log={log} sessionId={sessionId} restored={restored} />
}

const container = document.getElementById("root")!
createRoot(container).render(<Root />)
