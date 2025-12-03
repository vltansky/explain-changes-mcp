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
import { writeFileSync, readFileSync } from "fs";
import { createServer, Server as HttpServer } from "http";

const open = async (url: string) => {
  const mod = await import("open");
  return mod.default(url);
};

// Simple HTTP server to serve generated HTML files
let httpServer: HttpServer | null = null;
let currentHtmlContent: string = "";
let serverPort = 54321;
let serverTimeout: NodeJS.Timeout | null = null;
const SERVER_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

function stopServer() {
  if (serverTimeout) {
    clearTimeout(serverTimeout);
    serverTimeout = null;
  }
  if (httpServer) {
    httpServer.close();
    httpServer = null;
  }
}

function resetServerTimeout() {
  if (serverTimeout) {
    clearTimeout(serverTimeout);
  }
  serverTimeout = setTimeout(() => {
    stopServer();
  }, SERVER_TIMEOUT_MS);
}

function startServer(): Promise<number> {
  return new Promise((resolve, reject) => {
    if (httpServer) {
      resetServerTimeout();
      resolve(serverPort);
      return;
    }

    httpServer = createServer((req, res) => {
      resetServerTimeout(); // Reset timeout on each request
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(currentHtmlContent);
    });

    httpServer.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        serverPort++;
        httpServer?.close();
        httpServer = null;
        startServer().then(resolve).catch(reject);
      } else {
        reject(err);
      }
    });

    httpServer.listen(serverPort, "127.0.0.1", () => {
      resetServerTimeout();
      resolve(serverPort);
    });
  });
}

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
   - \`diff\`: The ACTUAL diff content as a string (not a file path or shell command like \`$(cat file)\` - pass the real diff text)
   - \`annotations\`: Array of { file, line, explanation, actions? } for key changes
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

Each annotation can have multiple actions if there are several ways to improve that specific piece of code.`;

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
              description: "The raw git diff output as a string (unified diff format). IMPORTANT: Pass the actual diff content, not a file path or shell command. Get the content from `git diff` commands and include it directly.",
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

    const html = generateHTML(
      args.title,
      args.summary,
      args.diff,
      args.annotations || [],
      args.editor || "auto",
      "side-by-side"
    );

    const timestamp = Date.now();
    const filename = `diff-explanation-${timestamp}.html`;
    const filepath = join(tmpdir(), filename);

    writeFileSync(filepath, html, "utf-8");

    const annotationCount = args.annotations?.length || 0;
    const editor = (args.editor || "auto").toLowerCase();

    // Check if editor is cursor - serve via HTTP for browser_navigate
    if (editor === "cursor") {
      try {
        currentHtmlContent = html;
        const port = await startServer();
        const httpUrl = `http://127.0.0.1:${port}`;
        return {
          content: [
            {
              type: "text" as const,
              text: `Generated diff explanation${annotationCount > 0 ? ` with ${annotationCount} annotation${annotationCount === 1 ? "" : "s"}` : ""}.\n\nIMPORTANT: Use the browser_navigate tool (from cursor-ide-browser MCP) to open this URL in Cursor's browser:\n${httpUrl}`,
            },
          ],
        };
      } catch (err) {
        // Fallback to file if server fails
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
    }

    // Open in system default browser for other editors
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
