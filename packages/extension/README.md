# Explain Changes Extension

VS Code / Cursor extension that displays AI-generated code explanations with inline annotations.

## Features

- **Diff visualization** — Side-by-side or unified view powered by diff2html
- **Inline annotations** — AI explanations appear directly in the diff
- **Action buttons** — Click to send improvement prompts to Cursor chat
- **Workspace-aware** — Only activates in the correct project window
- **Auto-install MCP** — Configures the MCP server automatically on first run

## Installation

### From VSIX

1. Download `.vsix` from [releases](https://github.com/vltansky/explain-changes-mcp/releases)
2. In VS Code/Cursor: Extensions → `...` → "Install from VSIX..."
3. Reload the window

The extension automatically adds the MCP server to your Cursor/Windsurf configuration.

### From Source

```bash
cd packages/extension
npm install
npm run build
npm run package
```

Then install the generated `.vsix` file.

## Usage

Once installed, the extension:

1. **Watches** `~/.explain-changes/pending.json` for new explanations
2. **Opens a webview panel** when the MCP server writes new data
3. **Displays the diff** with syntax highlighting and annotations

### Commands

- `Explain Changes: Show Panel` — Manually open the panel with the last explanation

### Deep Links

The extension registers a URI handler:
- `cursor://explain-changes.explain-changes-extension/show`
- `vscode://explain-changes.explain-changes-extension/show`

## How It Works

```
MCP Server                    Extension
     │                            │
     │ writes to                  │ watches
     │ ~/.explain-changes/        │ ~/.explain-changes/
     │ pending.json               │ pending.json
     └────────────────────────────┘
                                  │
                                  ▼
                            Webview Panel
                            (diff + annotations)
```

The MCP server writes a JSON file with:
- `title` — Panel title
- `summary` — Overview of changes
- `diff` — Git diff content
- `annotations` — Array of explanations with optional actions
- `workspacePath` — Project path (for workspace filtering)
- `editor` — "cursor" or "vscode"

The extension watches this file and opens a webview when it changes.

## Development

```bash
# Build
npm run build

# Watch mode
npm run watch

# Package as .vsix
npm run package
```

## Configuration

The extension auto-configures MCP servers in:
- **Cursor**: `~/.cursor/mcp.json`
- **Windsurf**: `~/.codeium/windsurf/mcp_config.json`

VS Code native MCP support (1.101+) doesn't use file-based config.

## License

MIT
