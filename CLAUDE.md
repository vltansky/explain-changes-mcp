# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build      # Compile TypeScript to dist/
npm run dev        # Start dev server with hot reload at http://localhost:3456
npm run start      # Run the MCP server (for production use via stdio)
```

## Architecture

This is an MCP (Model Context Protocol) server that renders git diffs with AI annotations as HTML pages.

### Flow
```
AI Agent → calls show_diff_explanation tool → MCP generates HTML → opens in browser
```

### Key Files

- `src/index.ts` - MCP server entry point. Handles tool registration, prompts, and tool execution. Writes HTML to temp file and opens in browser.
- `src/html-generator.ts` - Generates the HTML page. Uses diff2html library for rendering, GitHub dark theme styling, and injects annotations inline after relevant code lines.
- `dev/server.mjs` - Development server with live reload. Watches `src/` for changes, rebuilds, and triggers browser refresh via SSE.

### Tool Schema

The `show_diff_explanation` tool accepts:
- `title` (required): Page title
- `diff` (required): Raw git diff output (unified format)
- `summary`: High-level overview
- `annotations`: Array of `{ file, line?, explanation, actions? }`
- `globalActions`: Array of `{ label, prompt }` for header action buttons
- `editor`: `"vscode"` | `"cursor"` | `"auto"`

Actions use Cursor deeplinks (`cursor://chat?text=...`) to pre-fill prompts.

### HTML Generation

The `generateHTML` function:
1. Renders diff using diff2html with dark theme overrides
2. Inserts annotation rows after matching line numbers via DOM manipulation
3. Makes file names clickable links to open in editor (vscode:// or cursor:// schemes)
4. Supports unified and side-by-side view toggle

### Development

Edit `dev/server.mjs` to change mock data for testing different scenarios. The dev server auto-rebuilds on `.ts` file changes and uses SSE to trigger browser reload.
