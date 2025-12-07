#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { homedir } from "os";
import { join } from "path";
import { writeFileSync, existsSync, mkdirSync } from "fs";

// VS Code extension integration
const WATCH_DIR = join(homedir(), ".explain-changes");
const WATCH_FILE = join(WATCH_DIR, "pending.json");

type Editor = "vscode" | "cursor";

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

type DiffExplanationData = {
  title: string;
  summary?: string;
  diff: string;
  annotations: Annotation[];
  editor: Editor;
  workspacePath?: string;
  timestamp: number;
};

type ShowDiffExplanationArgs = {
  title: string;
  summary?: string;
  diff: string;
  annotations?: Annotation[];
  editor?: Editor;
  workspacePath?: string;
};

function writeToExtension(data: DiffExplanationData): void {
  if (!existsSync(WATCH_DIR)) {
    mkdirSync(WATCH_DIR, { recursive: true });
  }
  writeFileSync(WATCH_FILE, JSON.stringify(data, null, 2), "utf-8");
}

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

const EXPLAIN_CHANGES_PROMPT = `Explain code changes visually using the Explain Changes extension.

## Instructions

1. **Get the diff** - Use what you already have from the conversation context. Only run \`git diff\` if you don't have the changes:
   - Last commit: \`git diff HEAD~1 HEAD\`
   - Staged: \`git diff --cached\`
   - Working dir: \`git diff\`

2. **Analyze and annotate** - Prepare explanations for key parts of the changes

3. **Call \`show_diff_explanation\`** with:
   - \`title\`: Descriptive title
   - \`summary\`: 1-2 sentence overview
   - \`diff\`: The diff content as a string (the actual text, not a shell command)
   - \`annotations\`: Array of { file, line, explanation, actions? } for key changes
   - \`workspacePath\`: The absolute path to the current project folder (use \`pwd\` or equivalent)

4. **Write factual annotations** - Explain WHAT the code does based on the code itself. Don't fabricate intent.

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

Each annotation can have multiple actions if there are several ways to improve that specific piece of code.`;

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "show_diff_explanation",
        description: `Shows a git diff with annotations in the Explain Changes extension panel.

Use this tool after analyzing code changes to present the diff visually with your explanations.

The tool will:
1. Send the diff and annotations to the VS Code/Cursor extension
2. Open a panel with syntax-highlighted diff (side-by-side or unified view)
3. Display your annotations inline with action buttons`,
        inputSchema: {
          type: "object" as const,
          properties: {
            title: {
              type: "string",
              description: "Title for the explanation (e.g., 'Add user authentication')",
            },
            summary: {
              type: "string",
              description: "High-level summary of the changes",
            },
            diff: {
              type: "string",
              description: "The raw git diff output as a string (unified diff format). IMPORTANT: Pass the actual diff content, not a file path or shell command.",
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
                    description: "Reviewer actions - specific suggestions for improvements",
                    items: {
                      type: "object",
                      properties: {
                        label: {
                          type: "string",
                          description: "Short action label (e.g., 'Extract to helper')",
                        },
                        prompt: {
                          type: "string",
                          description: "Full context: what to change, code snippet, and why",
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
              enum: ["vscode", "cursor"],
              description: "Which editor you're using",
            },
            workspacePath: {
              type: "string",
              description: "Absolute path to the workspace/project folder. Used to show the panel only in the correct editor window.",
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
        description: "Instructions for explaining code changes with the Explain Changes extension",
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

    // Detect if diff looks like a shell command instead of actual diff content
    const shellPatterns = [
      /^\$\(.*\)$/,           // $(cat file)
      /^`.*`$/,               // `cat file`
      /^cat\s+/,              // cat /path/to/file
      /^<\s*\//,              // < /path/to/file
    ];

    const looksLikeShellCommand = shellPatterns.some(p => p.test(args.diff.trim()));
    const looksLikeDiff = args.diff.includes('diff --git') ||
                          args.diff.includes('@@') ||
                          args.diff.includes('---') ||
                          args.diff.includes('+++');

    if (looksLikeShellCommand && !looksLikeDiff) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: The 'diff' parameter contains a shell command ("${args.diff.substring(0, 50)}...") instead of actual diff content.\n\nPlease pass the actual diff output as a string. Run the git diff command and include its output directly in the 'diff' parameter.`,
          },
        ],
        isError: true,
      };
    }

    const timestamp = Date.now();
    const annotationCount = args.annotations?.length || 0;
    const editor = (args.editor || "cursor") as Editor;

    // Write JSON for the extension
    const extensionData: DiffExplanationData = {
      title: args.title,
      summary: args.summary,
      diff: args.diff,
      annotations: args.annotations || [],
      editor: editor,
      workspacePath: args.workspacePath,
      timestamp,
    };
    writeToExtension(extensionData);

    // Deep link to open the extension panel
    const deepLink = `${editor}://explain-changes.explain-changes-extension/show`;

    return {
      content: [
        {
          type: "text" as const,
          text: `Diff explanation ready${annotationCount > 0 ? ` with ${annotationCount} annotation${annotationCount === 1 ? "" : "s"}` : ""}.

The panel should open automatically. If not, run "Explain Changes: Show Panel" from the command palette.

Deep link: ${deepLink}`,
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
