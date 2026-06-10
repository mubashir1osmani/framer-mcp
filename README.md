# Framer MCP

Give Claude full control over your Framer project — canvas, CMS, and design system.

## Architecture

```
Claude (MCP client)                 Framer Plugin (docked panel)
      ↕ Streamable HTTP /mcp               ↕ WebSocket /bridge
      └──────────► MCP Server (Node.js, one port) ◄──────────┘
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

### 4. Run the server

```bash
cd packages/server
pnpm start            # PORT=3000, WS_PORT=9001 by default
```

Both surfaces share one port:

- MCP endpoint (Streamable HTTP): `http://localhost:3000/mcp`
- Plugin bridge (WebSocket): `ws://localhost:3000/bridge`
- `GET /health` reports status and whether the Framer plugin is connected.

Environment variables:

| Var | Default | Purpose |
|-----|---------|---------|
| `PORT` | `3000` | HTTP port serving `/mcp` and `/bridge` |
| `MCP_AUTH_TOKEN` | _(unset)_ | If set, `/mcp` requires `Authorization: Bearer <token>` |

### 5. Add to an MCP client

For a local client over HTTP:

```json
{
  "mcpServers": {
    "framer": {
      "type": "http",
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

## Deploy to Fly.io

The repo ships a `Dockerfile` and `fly.toml`. Both the MCP endpoint and the
plugin bridge are served on one port (443 at the edge), so a single Fly service
covers everything.

```bash
fly auth login                          # opens a browser
fly apps create your-unique-app-name    # app names are globally unique
# set the app name in fly.toml, then optionally require auth:
fly secrets set MCP_AUTH_TOKEN=$(openssl rand -hex 32) --app your-unique-app-name
fly deploy --app your-unique-app-name
```

After deploy:

- MCP URL: `https://your-app.fly.dev/mcp`
- Bridge URL: `wss://your-app.fly.dev/bridge`

Point the plugin at the deployment by building it with the bridge URL:

```bash
cd packages/plugin
VITE_BRIDGE_URL=wss://your-app.fly.dev/bridge pnpm build
```

Add the remote server to your MCP client (include the header only if you set
`MCP_AUTH_TOKEN`):

```json
{
  "mcpServers": {
    "framer": {
      "type": "http",
      "url": "https://your-app.fly.dev/mcp",
      "headers": { "Authorization": "Bearer <your-token>" }
    }
  }
}
```

> **Note:** session state in `~/.framer-mcp/sessions.json` lives on the machine's
> ephemeral disk and is lost when the machine stops/redeploys. The plugin
> re-handshakes automatically on reconnect, so this only drops in-flight requests.
> Mount a Fly volume if you need it to persist.

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
