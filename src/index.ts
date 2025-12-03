#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { generateHTML } from "./html-generator.js";
import { tmpdir } from "os";
import { join } from "path";
import { writeFileSync } from "fs";

const open = async (url: string) => {
  const mod = await import("open");
  return mod.default(url);
};

type Editor = "vscode" | "cursor" | "auto";

type Action = {
  label: string;
  prompt: string;
};

type Annotation = {
  file: string;
  line?: number;
  explanation: string;
  actions?: Action[];
};

type ShowDiffExplanationArgs = {
  title: string;
  summary?: string;
  diff: string;
  annotations?: Annotation[];
  editor?: Editor;
  globalActions?: Action[];
};

const server = new Server(
  {
    name: "explain-changes-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      prompts: {},
    },
  }
);

const EXPLAIN_CHANGES_PROMPT = `Explain the code changes visually using git diff.

## Instructions

1. Get the diff using git:
   - Last commit: \`git diff HEAD~1 HEAD\`
   - Staged: \`git diff --cached\`
   - Working dir: \`git diff\`

2. Analyze the changes and prepare annotations for key parts

3. Call \`show_diff_explanation\` with:
   - \`title\`: Descriptive title
   - \`summary\`: 1-2 sentence overview
   - \`diff\`: The raw git diff output (full unified diff format)
   - \`annotations\`: Array of { file, line, explanation, actions? } for key changes
   - \`globalActions\`: Optional array of { label, prompt } for project-wide review actions
   - \`editor\`: Your IDE ("vscode" or "cursor")

4. Write annotations that explain WHAT the code does based on the code itself and conversation context. Don't fabricate intent or reasons you can't know.

## Reviewer Actions

For each annotation, think about what a code reviewer might want to change or improve. Generate specific, actionable suggestions:

**Good actions (specific, contextual):**
- "Extract to useAuth hook" → prompt includes the code and explains the refactor
- "Use early return pattern" → prompt shows current nested code and suggested structure
- "Add input validation" → prompt specifies what validation is missing
- "Rename to fetchUserData" → prompt explains why the new name is clearer

**Bad actions (generic, unhelpful):**
- "Refactor this" (too vague)
- "Add tests" (no context)
- "Improve code" (meaningless)

Each action's prompt MUST include:
1. The specific change being suggested
2. The relevant code snippet with file path and line numbers
3. Why this change would improve the code

Example action:
\`\`\`json
{
  "label": "Extract validation logic",
  "prompt": "Extract the token validation into a separate validateToken function for reusability.\\n\\nCurrent code in src/middleware/auth.ts:10-16:\\n\\\`\\\`\\\`typescript\\nif (!token) {\\n  return res.status(401).json({ error: 'No token' });\\n}\\nconst decoded = jwt.verify(token, secret);\\n\\\`\\\`\\\`\\n\\nThis would allow reusing validation in WebSocket handlers."
}
\`\`\`

Global actions should address project-wide concerns like "Add integration tests for all new endpoints" or "Review error handling consistency across files".`;

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "show_diff_explanation",
        description: `Opens a beautiful HTML page showing a git diff with annotations.

Use this tool after analyzing code changes to present the diff visually with your explanations.

The tool will:
1. Render the git diff with syntax highlighting (side-by-side or line-by-line)
2. Display your annotations alongside relevant lines
3. Open the page in the user's default browser with "Open in Editor" buttons`,
        inputSchema: {
          type: "object" as const,
          properties: {
            title: {
              type: "string",
              description: "Title for the page (e.g., 'Changes in PR #123')",
            },
            summary: {
              type: "string",
              description: "High-level summary of the changes",
            },
            diff: {
              type: "string",
              description: "The raw git diff output (unified diff format). Get this from `git diff` commands.",
            },
            annotations: {
              type: "array",
              description: "Annotations explaining specific parts of the diff",
              items: {
                type: "object",
                properties: {
                  file: {
                    type: "string",
                    description: "File path the annotation refers to",
                  },
                  line: {
                    type: "number",
                    description: "Line number in the new file (optional)",
                  },
                  explanation: {
                    type: "string",
                    description: "Your explanation of this change",
                  },
                  actions: {
                    type: "array",
                    description: "Reviewer actions - specific suggestions for improvements. Each action should be contextual (e.g., 'Extract to useAuth hook', 'Add input validation') not generic (e.g., 'Refactor', 'Improve').",
                    items: {
                      type: "object",
                      properties: {
                        label: {
                          type: "string",
                          description: "Short, specific action label (e.g., 'Extract to helper', 'Add null check', 'Rename to fetchUser')",
                        },
                        prompt: {
                          type: "string",
                          description: "Full context for the action: what to change, the relevant code snippet with file:line, and why this improves the code",
                        },
                      },
                      required: ["label", "prompt"],
                    },
                  },
                },
                required: ["file", "explanation"],
              },
            },
            editor: {
              type: "string",
              enum: ["vscode", "cursor", "auto"],
              description: "Which editor to show 'Open in' button for",
            },
            globalActions: {
              type: "array",
              description: "Project-wide reviewer actions (e.g., 'Add integration tests for new endpoints', 'Standardize error responses')",
              items: {
                type: "object",
                properties: {
                  label: {
                    type: "string",
                    description: "Short, specific action label for project-wide improvement",
                  },
                  prompt: {
                    type: "string",
                    description: "Full context: what to change across files, which files are affected, and why",
                  },
                },
                required: ["label", "prompt"],
              },
            },
          },
          required: ["title", "diff"],
        },
      },
    ],
  };
});

server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: "explain-changes",
        description: "Instructions for explaining code changes (git diff) with visual HTML output",
      },
    ],
  };
});

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name } = request.params;

  if (name === "explain-changes") {
    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: EXPLAIN_CHANGES_PROMPT,
          },
        },
      ],
    };
  }

  throw new Error(`Unknown prompt: ${name}`);
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "show_diff_explanation") {
    const args = request.params.arguments as ShowDiffExplanationArgs;

    if (!args.title || !args.diff) {
      return {
        content: [
          {
            type: "text" as const,
            text: "Error: 'title' and 'diff' are required",
          },
        ],
        isError: true,
      };
    }

    const html = generateHTML(
      args.title,
      args.summary,
      args.diff,
      args.annotations || [],
      args.editor || "auto",
      "side-by-side",
      args.globalActions
    );

    const timestamp = Date.now();
    const filename = `diff-explanation-${timestamp}.html`;
    const filepath = join(tmpdir(), filename);

    writeFileSync(filepath, html, "utf-8");

    const annotationCount = args.annotations?.length || 0;
    const editor = (args.editor || "auto").toLowerCase();

    // Check if editor is cursor - don't open browser directly
    if (editor === "cursor") {
      // Format file:// URL properly for Unix systems (needs three slashes: file:///)
      const fileUrl = `file:///${filepath}`;
      return {
        content: [
          {
            type: "text" as const,
            text: `Generated diff explanation${annotationCount > 0 ? ` with ${annotationCount} annotation${annotationCount === 1 ? "" : "s"}` : ""}.\nFile: ${filepath}\n\nPlease use the browser_navigate MCP tool to open this URL in Cursor browser:\n${fileUrl}`,
          },
        ],
      };
    }

    // Only open browser if editor is not cursor
    await open(filepath);

    return {
      content: [
        {
          type: "text" as const,
          text: `Opened diff explanation in browser${annotationCount > 0 ? ` with ${annotationCount} annotation${annotationCount === 1 ? "" : "s"}` : ""}.\nFile: ${filepath}`,
        },
      ],
    };
  }

  return {
    content: [
      {
        type: "text" as const,
        text: `Unknown tool: ${request.params.name}`,
      },
    ],
    isError: true,
  };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Explain Changes MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
