<div align="center">

# Explain Changes MCP

**Give your AI agent a way to show its work.**

An MCP tool that lets AI visualize the code changes it made — rendering git diffs as interactive HTML pages with inline annotations.

[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

</div>

---

## What is this?

When an AI agent makes code changes, it usually just tells you what it did in text. This MCP gives the agent a better way to communicate: **a visual diff with annotations**.

```
AI makes changes to your code
       ↓
AI calls show_diff_explanation
       ↓
Browser opens with diff + AI's annotations inline
```

The AI can highlight the important lines and explain what each change does — right next to the code.

---

## Features

- **Visual diff** - Side-by-side or unified view powered by diff2html
- **Inline annotations** - AI explanations appear directly after relevant code lines
- **Action buttons** - Follow-up prompts (e.g., "Add tests", "Refactor this")
- **Click to open** - File names link to VS Code or Cursor
- **GitHub dark theme** - Clean aesthetics

---

## Installation

```bash
git clone <repo>
cd explain-changes-mcp
npm install
npm run build
```

---

## Configuration

### Claude Code

```bash
claude mcp add explain-changes node /path/to/explain-changes-mcp/dist/index.js
```

Or add to `~/.claude/mcp_settings.json`:

```json
{
  "mcpServers": {
    "explain-changes": {
      "command": "node",
      "args": ["/path/to/explain-changes-mcp/dist/index.js"]
    }
  }
}
```

### Cursor

Add to Cursor MCP settings:

```json
{
  "mcpServers": {
    "explain-changes": {
      "command": "node",
      "args": ["/path/to/explain-changes-mcp/dist/index.js"]
    }
  }
}
```

---

## Tool: `show_diff_explanation`

Renders a git diff with annotations in the browser.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `title` | string | Yes | Page title |
| `diff` | string | Yes | Raw git diff output (unified format) |
| `summary` | string | No | High-level overview |
| `annotations` | array | No | Explanations for specific changes |
| `globalActions` | array | No | Action buttons in the header |
| `editor` | string | No | `"vscode"`, `"cursor"`, or `"auto"` |

### Annotation Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | string | Yes | File path |
| `line` | number | No | Line number to attach annotation to |
| `explanation` | string | Yes | Your explanation |
| `actions` | array | No | Array of `{ label, prompt }` for action buttons |

### Action Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `label` | string | Yes | Button label |
| `prompt` | string | Yes | Prompt to pre-fill in Cursor chat |

---

## MCP Prompt

### `explain-changes`
Instructions for explaining git diffs with visual output. The AI will get the diff, analyze the changes, and call the tool with appropriate annotations.

---

## Example Usage

Ask your AI agent: **"Explain the last commit"**

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
      "explanation": "Extracts Bearer token from Authorization header",
      "actions": [
        { "label": "Add tests", "prompt": "Write unit tests for this auth middleware" }
      ]
    }
  ],
  "globalActions": [
    { "label": "Security Review", "prompt": "Review this code for security vulnerabilities" }
  ],
  "editor": "cursor"
}
```

4. Browser opens with diff2html rendered diff + inline annotations

---

## Development

```bash
npm run dev
```

Opens http://localhost:3456 with hot reload. Edit `src/html-generator.ts` to change styling, `dev/server.mjs` to change mock data.

---

## License

MIT
