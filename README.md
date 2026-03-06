# Framer MCP

Give Claude full control over your Framer project — canvas, CMS, and design system.

## Architecture

```
Claude (MCP client)
      ↕ stdio
MCP Server (Node.js)
      ↕ WebSocket :9001
Framer Plugin (docked panel)
      ↕ Framer Plugin API
Your Framer Project
```

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Build & run the MCP server

```bash
cd packages/server
pnpm build
```

### 3. Load the plugin in Framer

```bash
cd packages/plugin
pnpm dev
```

Open Framer → Plugins → Import from URL → `http://localhost:5173`

The plugin will appear as a docked panel. It shows a green "Connected" dot when the MCP server is running.

### 4. Add to Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "framer": {
      "command": "node",
      "args": ["/absolute/path/to/framer-mcp/packages/server/dist/index.js"]
    }
  }
}
```

Restart Claude Desktop.

## Tools (30 total)

### Canvas
| Tool | Description |
|------|-------------|
| `getPages` | List all pages |
| `getCurrentPage` | Get active page + top-level nodes |
| `navigateToPage` | Switch to a page by ID or name |
| `getSelection` | Get currently selected nodes |
| `getNode` | Get node details by ID |
| `getChildren` | Get children of a node |
| `createFrame` | Create a frame/container |
| `createText` | Create a text node |
| `updateNode` | Update any node property |
| `deleteNode` | Delete a node |
| `duplicateNode` | Clone a node |
| `moveNode` | Move node to new parent or position |
| `groupNodes` | Group nodes into a frame |
| `getNodeXml` | Get raw XML for a node |
| `setNodeXml` | Update node via raw XML |

### CMS
| Tool | Description |
|------|-------------|
| `listCollections` | List all CMS collections |
| `getCollection` | Get collection + field schema |
| `createCollection` | Create a new collection |
| `listItems` | List items in a collection |
| `createItem` | Create a CMS item |
| `updateItem` | Update a CMS item |
| `deleteItem` | Delete a CMS item |

### Design System
| Tool | Description |
|------|-------------|
| `listColorStyles` | List all color styles |
| `getColorStyle` | Get a color style by ID or name |
| `createColorStyle` | Create a color style |
| `updateColorStyle` | Update a color style |
| `deleteColorStyle` | Delete a color style |
| `listTextStyles` | List all text styles |
| `createTextStyle` | Create a text style |
| `updateTextStyle` | Update a text style |
| `deleteTextStyle` | Delete a text style |

## Plugin Disconnection

If you close the Framer plugin, Claude will get a clear error:

> "Framer plugin is not connected. Open the Framer MCP plugin in your Framer project to continue."

Reopen the plugin and it reconnects automatically within a few seconds.
