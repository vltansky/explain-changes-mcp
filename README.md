# Code Explainer MCP

An MCP server that renders git diffs with AI annotations as beautiful VSCode-styled HTML pages.

## What it does

```
AI Agent runs git diff
       ↓
Analyzes changes, prepares annotations
       ↓
Calls show_diff_explanation tool
       ↓
MCP renders diff with diff2html + annotations
       ↓
Opens in browser with "Open in Editor" buttons
```

## Features

- **Git diff rendering** - Uses diff2html for side-by-side or unified view
- **VSCode dark theme** - Familiar IDE aesthetics
- **Syntax highlighting** - Automatic language detection
- **Annotations** - AI explanations for key changes
- **"Open in Editor"** - Jump to file in VS Code or Cursor

## Installation

```bash
git clone <repo>
cd code-explainer-mcp
npm install
npm run build
```

## Configuration

### Claude Code

Add to `~/.claude/mcp_settings.json`:

```json
{
  "mcpServers": {
    "code-explainer": {
      "command": "node",
      "args": ["/path/to/code-explainer-mcp/dist/index.js"]
    }
  }
}
```

### Cursor

Add to Cursor MCP settings:

```json
{
  "mcpServers": {
    "code-explainer": {
      "command": "node",
      "args": ["/path/to/code-explainer-mcp/dist/index.js"]
    }
  }
}
```

## Tool: `show_diff_explanation`

Renders a git diff with annotations in the browser.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `title` | string | Yes | Page title |
| `summary` | string | No | High-level overview |
| `diff` | string | Yes | Raw git diff output (unified format) |
| `annotations` | array | No | Explanations for specific changes |
| `editor` | string | No | `"vscode"`, `"cursor"`, or `"auto"` |

### Annotation Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | string | Yes | File path |
| `line` | number | No | Line number |
| `explanation` | string | Yes | Your explanation |

## MCP Prompts

### `explain-changes`
Instructions for explaining git diffs with visual output.

### `explain-code`
Instructions for explaining code with visual output.

## Example Usage

Ask your AI agent: "Explain the last commit"

The agent will:
1. Run `git diff HEAD~1 HEAD`
2. Analyze the changes
3. Call `show_diff_explanation`:

```json
{
  "title": "Add JWT Authentication",
  "summary": "Added JWT auth middleware and applied to API routes.",
  "diff": "diff --git a/src/auth.ts b/src/auth.ts\n...",
  "annotations": [
    {
      "file": "src/auth.ts",
      "line": 5,
      "explanation": "Extracts Bearer token from Authorization header"
    }
  ],
  "editor": "cursor"
}
```

4. Browser opens with diff2html rendered diff + annotations

## License

MIT
