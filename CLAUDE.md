# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

Monorepo with two packages:
- `packages/mcp` - MCP server that provides the `show_diff_explanation` tool
- `packages/extension` - VS Code/Cursor extension that displays diff explanations in a webview panel

## Commands

```bash
# Root commands
npm run build            # Build all packages
npm run build:mcp        # Build MCP server only
npm run build:extension  # Build extension only

# Extension (from packages/extension)
npm run dev              # Dev server at http://localhost:3457 for webview debugging
npm run watch            # Watch mode for extension development
npm run package          # Create .vsix file

# MCP (from packages/mcp)
npm run build            # Compile TypeScript to dist/
npm run start            # Run MCP server via stdio
```

## Architecture

```
MCP Server                    VS Code Extension
     │                              │
     │ writes JSON to               │ watches
     │ ~/.explain-changes/          │ ~/.explain-changes/
     │ pending.json                 │ pending.json
     │                              │
     └──────────────────────────────┘
                                    │
                                    ▼
                              Webview Panel
                              (renders diff + annotations)
```

### MCP Package (`packages/mcp`)

- `src/index.ts` - MCP server entry point. Registers tool and prompt, writes JSON to `~/.explain-changes/pending.json`

### Extension Package (`packages/extension`)

- `src/extension.ts` - Extension entry point. Watches pending.json, auto-configures MCP in Cursor/Windsurf
- `src/webviewProvider.ts` - Creates webview panel, renders diff with diff2html, handles button clicks
- `src/types.ts` - Shared TypeScript types
- `dev/server.mjs` - Dev server for debugging webview in browser with mock data and HMR

### Tool Schema

The `show_diff_explanation` tool accepts:
- `title` (required): Page title
- `diff` (required): Raw git diff output (unified format)
- `summary`: High-level overview
- `annotations`: Array of `{ file, line?, explanation, actions? }`
- `workspacePath`: Absolute path to project (for workspace filtering)
- `editor`: `"cursor"` | `"vscode"`

### Action Buttons

Actions use Cursor deeplinks: `cursor://anysphere.cursor-deeplink/prompt?text=...`

The extension receives button clicks via `postMessage`, then calls `vscode.env.openExternal()` to open the deeplink.

### Development

1. **Webview debugging**: Run `npm run dev` in `packages/extension` to test the panel UI in browser
2. **Extension debugging**: Use VS Code's "Run and Debug" or reload window after `npm run build`
3. **MCP testing**: Configure in Cursor's `~/.cursor/mcp.json` and call the tool from chat

### Publishing

- **Extension**: Create `.vsix` with `npm run package`, upload to GitHub Releases
- **MCP**: Published to npm as `explain-changes-mcp`
