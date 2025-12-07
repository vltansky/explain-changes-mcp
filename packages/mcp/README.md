# Explain Changes MCP Server

MCP server that provides the `show_diff_explanation` tool for visualizing code changes with AI annotations.

## Installation

```bash
npx -y explain-changes-mcp
```

Or install globally:

```bash
npm install -g explain-changes-mcp
```

## MCP Configuration

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "explain-changes": {
      "command": "npx",
      "args": ["-y", "explain-changes-mcp"]
    }
  }
}
```

## Tool: `show_diff_explanation`

Displays a git diff with AI-generated annotations in the Explain Changes extension panel.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `title` | string | Yes | Title for the explanation |
| `diff` | string | Yes | Raw git diff output (unified format) |
| `summary` | string | No | High-level overview of changes |
| `annotations` | array | No | Explanations for specific parts of the diff |
| `workspacePath` | string | No | Absolute path to project folder (for workspace filtering) |
| `editor` | string | No | `"cursor"` or `"vscode"` (default: `"cursor"`) |

### Annotation Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | string | Yes | File path the annotation refers to |
| `line` | number | No | Line number in the new file |
| `explanation` | string | Yes | Your explanation of this change |
| `actions` | array | No | Action buttons with prompts |

### Action Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `label` | string | Yes | Button label (e.g., "Add tests") |
| `prompt` | string | Yes | Full prompt to send to chat |

### Example

```json
{
  "title": "Add user authentication",
  "summary": "Added JWT middleware and protected API routes.",
  "diff": "diff --git a/src/auth.ts b/src/auth.ts\n...",
  "workspacePath": "/Users/me/myproject",
  "annotations": [
    {
      "file": "src/auth.ts",
      "line": 15,
      "explanation": "Extracts and validates JWT token from Authorization header",
      "actions": [
        {
          "label": "Add refresh token",
          "prompt": "Add refresh token support to this auth middleware"
        }
      ]
    }
  ]
}
```

## Prompt: `explain-changes`

The MCP server also provides a prompt with instructions for explaining code changes. Reference it with `@explain-changes` in your chat.

The prompt guides the AI to:
1. Get the diff from conversation context (or run `git diff` if needed)
2. Analyze and prepare annotations
3. Call `show_diff_explanation` with appropriate parameters
4. Generate specific, actionable suggestions for each annotation

## How It Works

The MCP server writes to `~/.explain-changes/pending.json`. The companion VS Code/Cursor extension watches this file and displays the diff in a webview panel.

```
MCP Server                    Extension
     │                            │
     │ writes to                  │ watches
     │ ~/.explain-changes/        │ ~/.explain-changes/
     │ pending.json               │ pending.json
     └────────────────────────────┘
```

## Development

```bash
# Build
npm run build

# The server runs via stdio
node dist/index.js
```

## License

MIT
