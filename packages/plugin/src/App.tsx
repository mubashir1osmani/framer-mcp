import { useEffect, useState, useRef } from "react"
import type { ConnectionStatus, LogEntry } from "./bridge"

interface Props {
  status: ConnectionStatus
  log: LogEntry[]
  sessionId: string | null
  restored: boolean
}

const STATUS_CONFIG = {
  connected: { color: "#22c55e", label: "Connected" },
  connecting: { color: "#f59e0b", label: "Connecting..." },
  disconnected: { color: "#ef4444", label: "Disconnected" },
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

function formatUptime(seconds: number) {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
}

export function App({ status, log, sessionId, restored }: Props) {
  const { color, label } = STATUS_CONFIG[status]
  const [showRestored, setShowRestored] = useState(false)
  const [uptime, setUptime] = useState(0)
  const connectedAtRef = useRef<number | null>(null)
  const uptimeTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // Show the "Session restored" badge for 3s when restored fires
  useEffect(() => {
    if (restored && status === "connected") {
      setShowRestored(true)
      const t = setTimeout(() => setShowRestored(false), 3000)
      return () => clearTimeout(t)
    }
  }, [restored, status])

  // Uptime counter: starts/resets on connect, stops on disconnect
  useEffect(() => {
    if (status === "connected") {
      connectedAtRef.current = Date.now()
      setUptime(0)
      uptimeTimer.current = setInterval(() => {
        setUptime(Math.floor((Date.now() - connectedAtRef.current!) / 1000))
      }, 1000)
    } else {
      if (uptimeTimer.current) {
        clearInterval(uptimeTimer.current)
        uptimeTimer.current = null
      }
    }
    return () => {
      if (uptimeTimer.current) clearInterval(uptimeTimer.current)
    }
  }, [status])

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.titleRow}>
          <span style={styles.title}>Framer MCP</span>
          <div style={styles.statusBadge}>
            <div style={{ ...styles.statusDot, background: color, boxShadow: `0 0 6px ${color}` }} />
            <span style={{ ...styles.statusLabel, color }}>{label}</span>
          </div>
        </div>

        {/* Session info row */}
        {sessionId && (
          <div style={styles.sessionRow}>
            <span style={styles.sessionChip} title={sessionId}>
              #{sessionId.slice(-8)}
            </span>
            {showRestored && <span style={styles.restoredBadge}>Session restored</span>}
            {status === "connected" && !showRestored && (
              <span style={styles.uptime}>{formatUptime(uptime)}</span>
            )}
          </div>
        )}

        {status === "disconnected" && (
          <p style={styles.hint}>Start the MCP server and it will reconnect automatically.</p>
        )}
        {status === "connecting" && (
          <p style={styles.hint}>Connecting to ws://localhost:9001…</p>
        )}
        {status === "connected" && !sessionId && (
          <p style={styles.hint}>Ready. Claude can now control this project.</p>
        )}
      </div>

      {/* Activity log */}
      <div style={styles.logSection}>
        <span style={styles.logHeader}>Activity</span>
        <div style={styles.logList}>
          {log.length === 0 ? (
            <p style={styles.emptyLog}>No activity yet.</p>
          ) : (
            log.map((entry, i) => (
              <div key={i} style={styles.logEntry}>
                <span style={styles.logTime}>{formatTime(entry.timestamp)}</span>
                <span style={{ ...styles.logTool, color: entry.status === "error" ? "#ef4444" : "#a3e635" }}>
                  {entry.tool}
                </span>
                {entry.status === "error" && (
                  <span style={styles.logError}>{entry.message}</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    background: "#111",
    color: "#eee",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize: 12,
  },
  header: {
    padding: "12px 14px 10px",
    borderBottom: "1px solid #222",
  },
  titleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  title: {
    fontSize: 13,
    fontWeight: 600,
    color: "#fff",
    letterSpacing: "-0.01em",
  },
  statusBadge: {
    display: "flex",
    alignItems: "center",
    gap: 5,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: 500,
  },
  sessionRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  sessionChip: {
    fontSize: 10,
    fontWeight: 500,
    color: "#555",
    background: "#1a1a1a",
    border: "1px solid #2a2a2a",
    borderRadius: 4,
    padding: "1px 5px",
    fontVariantNumeric: "tabular-nums",
    letterSpacing: "0.02em",
    cursor: "default",
  },
  restoredBadge: {
    fontSize: 10,
    fontWeight: 500,
    color: "#22c55e",
    background: "rgba(34,197,94,0.12)",
    border: "1px solid rgba(34,197,94,0.25)",
    borderRadius: 4,
    padding: "1px 5px",
  },
  uptime: {
    fontSize: 10,
    color: "#444",
    fontVariantNumeric: "tabular-nums",
  },
  hint: {
    color: "#666",
    fontSize: 11,
    lineHeight: 1.4,
    margin: 0,
  },
  logSection: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  logHeader: {
    padding: "8px 14px 4px",
    fontSize: 10,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#555",
  },
  logList: {
    flex: 1,
    overflowY: "auto",
    padding: "4px 0 8px",
  },
  emptyLog: {
    color: "#444",
    padding: "4px 14px",
    fontStyle: "italic",
  },
  logEntry: {
    display: "flex",
    alignItems: "baseline",
    gap: 8,
    padding: "3px 14px",
    lineHeight: 1.5,
  },
  logTime: {
    color: "#444",
    fontSize: 10,
    flexShrink: 0,
    fontVariantNumeric: "tabular-nums",
  },
  logTool: {
    fontSize: 11,
    fontWeight: 500,
    flexShrink: 0,
  },
  logError: {
    color: "#ef4444",
    fontSize: 10,
    opacity: 0.8,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
}
