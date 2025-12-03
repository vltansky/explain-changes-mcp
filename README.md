<div align="center">

# Explain Changes MCP

**AI peer review for your code changes.**

Just like humans review each other's PRs, your AI reviews its own changes — with inline annotations that appear directly in the diff.

[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

</div>

---

## Why AI Peer Review?

When humans write code, we do peer review. When AI writes code, we... scroll through chat hoping we understood what it did?

**The asymmetry is broken.** AI generates multi-file changes in seconds, but understanding those changes still requires you to:
- Read the chat explanation
- Open the diff
- Mentally map one to the other

This MCP gives AI the same workflow humans use: **review the diff, annotate the changes, explain the reasoning**.

---

## How It Works

```
AI makes changes → AI reviews its own diff → Browser opens with annotated diff
```

The AI calls `show_diff_explanation` after completing a task. You get a visual diff with inline annotations — exactly where a human reviewer would leave comments.

Works on any git diff: commits, PRs, branches. Action buttons let you ask follow-up questions right from the review.

---

## Features

- **Visual diff** — Side-by-side or unified view powered by diff2html
- **Inline annotations** — Review comments appear directly after relevant code lines
- **Action buttons** — Follow-up prompts ("Add tests", "Refactor this", "Security review")
- **Click to open** — File names link to VS Code or Cursor
- **GitHub dark theme** — Clean aesthetics

---

## Installation

### Prerequisites

- **Node.js** >= 18.0.0
- **MCP Client** (Cursor, Claude Code, VS Code, Windsurf, etc.)

### Quick Start

**1. Install the MCP Server**

The MCP server runs via `npx`. Configure it in your MCP client (see [Client-Specific Setup](#client-specific-setup) below).

---

### Client-Specific Setup

<details>
<summary><b>Cursor</b></summary>

#### One-Click Install

[<img src="https://cursor.com/deeplink/mcp-install-dark.svg" alt="Install in Cursor">](https://cursor.com/en/install-mcp?name=explain-changes-mcp&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsImV4cGxhaW4tY2hhbmdlcy1tY3BAbGF0ZXN0Il19)

#### Manual Install

Go to `Cursor Settings` → `MCP` → `Add new global MCP server`

```json
{
  "mcpServers": {
    "explain-changes-mcp": {
      "command": "npx",
      "args": ["-y", "explain-changes-mcp@latest"]
    }
  }
}
```

</details>

<details>
<summary><b>Claude Code</b></summary>

Use the Claude Code CLI:

```bash
claude mcp add explain-changes-mcp npx -y explain-changes-mcp@latest
```

Or manually edit `~/.claude/config.json`:

```json
{
  "mcpServers": {
    "explain-changes-mcp": {
      "command": "npx",
      "args": ["-y", "explain-changes-mcp@latest"]
    }
  }
}
```

</details>

<details>
<summary><b>VS Code / VS Code Insiders</b></summary>

[<img src="https://img.shields.io/badge/Install%20in%20VS%20Code-0098FF?style=for-the-badge&logo=visualstudiocode&logoColor=white" alt="Install in VS Code">](https://insiders.vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%7B%22name%22%3A%22explain-changes-mcp%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22explain-changes-mcp%40latest%22%5D%7D)

Or add to `settings.json`:

```json
{
  "mcp.servers": {
    "explain-changes-mcp": {
      "command": "npx",
      "args": ["-y", "explain-changes-mcp@latest"]
    }
  }
}
```

</details>

<details>
<summary><b>Windsurf</b></summary>

Add to your Windsurf MCP configuration:

```json
{
  "mcpServers": {
    "explain-changes-mcp": {
      "command": "npx",
      "args": ["-y", "explain-changes-mcp@latest"]
    }
  }
}
```

</details>

<details>
<summary><b>Claude Desktop</b></summary>

Follow the [MCP install guide](https://modelcontextprotocol.io/quickstart/user), then add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "explain-changes-mcp": {
      "command": "npx",
      "args": ["-y", "explain-changes-mcp@latest"]
    }
  }
}
```

</details>

---

## Tool: `show_diff_explanation`

Renders a git diff with review annotations in the browser.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `title` | string | Yes | Page title |
| `diff` | string | Yes | Raw git diff output (unified format) |
| `summary` | string | No | High-level overview of changes |
| `annotations` | array | No | Review comments for specific changes |
| `globalActions` | array | No | Action buttons in the header |
| `editor` | string | No | `"vscode"`, `"cursor"`, or `"auto"` |

### Annotation Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | string | Yes | File path |
| `line` | number | No | Line number to attach comment to |
| `explanation` | string | Yes | Review comment |
| `actions` | array | No | Array of `{ label, prompt }` for action buttons |

### Action Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `label` | string | Yes | Button label |
| `prompt` | string | Yes | Prompt to pre-fill in Cursor chat |

---

## MCP Prompt

### `explain-changes`
Instructions for reviewing git diffs with visual output. The AI will get the diff, review the changes, and call the tool with appropriate annotations.

---

## Example Usage

Ask your AI agent: **"Explain the last commit"**

The agent will:
1. Run `git diff HEAD~1 HEAD`
2. Review the changes
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

4. Browser opens with diff2html rendered diff + inline review comments

---

## Development

```bash
npm run dev
```

Opens http://localhost:3456 with hot reload. Edit `src/html-generator.ts` to change styling, `dev/server.mjs` to change mock data.

---

## Inspiration

Inspired by [Cline's `/explain-changes` feature](https://x.com/cline/status/1995892768116494488).

---

## License

MIT
