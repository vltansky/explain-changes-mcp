import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { DiffExplanationPanel } from "./webviewProvider";
import { DiffExplanation } from "./types";

const WATCH_DIR = path.join(os.homedir(), ".explain-changes");
const WATCH_FILE = path.join(WATCH_DIR, "pending.json");

// MCP server configuration
const MCP_SERVER_NAME = "explain-changes";
const MCP_COMMAND = "npx";
const MCP_ARGS = ["-y", "explain-changes-mcp"];

let fileWatcher: fs.FSWatcher | null = null;
let lastTimestamp = 0;

type McpServerConfig = {
  command: string;
  args: string[];
};

type McpConfig = {
  mcpServers: Record<string, McpServerConfig>;
};

// Detect editor type
function getEditorInfo(): { name: string; scheme: string; mcpConfigPath: string | null } {
  const appName = vscode.env.appName.toLowerCase();

  if (appName.includes("cursor")) {
    return {
      name: "Cursor",
      scheme: "cursor",
      mcpConfigPath: path.join(os.homedir(), ".cursor", "mcp.json"),
    };
  }

  if (appName.includes("windsurf")) {
    return {
      name: "Windsurf",
      scheme: "windsurf",
      mcpConfigPath: path.join(os.homedir(), ".codeium", "windsurf", "mcp_config.json"),
    };
  }

  // VS Code - no file-based MCP config (uses native API in 1.101+)
  return {
    name: "VS Code",
    scheme: "vscode",
    mcpConfigPath: null,
  };
}

// Auto-install MCP server in editor's config
async function ensureMcpServerInstalled(mcpConfigPath: string): Promise<boolean> {
  try {
    let config: McpConfig = { mcpServers: {} };

    // Read existing config if it exists
    if (fs.existsSync(mcpConfigPath)) {
      try {
        const content = fs.readFileSync(mcpConfigPath, "utf-8");
        const parsed = JSON.parse(content);
        if (parsed && typeof parsed === "object" && parsed.mcpServers) {
          config = parsed as McpConfig;
        }
      } catch {
        // Invalid JSON, will create new config
      }
    }

    // Check if already configured
    const existingServer = config.mcpServers[MCP_SERVER_NAME];
    if (
      existingServer &&
      existingServer.command === MCP_COMMAND &&
      JSON.stringify(existingServer.args) === JSON.stringify(MCP_ARGS)
    ) {
      return false; // Already configured correctly
    }

    // Add/update server config
    config.mcpServers[MCP_SERVER_NAME] = {
      command: MCP_COMMAND,
      args: MCP_ARGS,
    };

    // Ensure directory exists and write config
    fs.mkdirSync(path.dirname(mcpConfigPath), { recursive: true });
    fs.writeFileSync(mcpConfigPath, JSON.stringify(config, null, 2), "utf-8");

    return true; // Config was updated
  } catch (err) {
    console.error("Failed to configure MCP server:", err);
    return false;
  }
}

export async function activate(context: vscode.ExtensionContext) {
  const editorInfo = getEditorInfo();
  console.log(`Explain Changes extension activated in ${editorInfo.name}`);

  // Ensure watch directory exists
  if (!fs.existsSync(WATCH_DIR)) {
    fs.mkdirSync(WATCH_DIR, { recursive: true });
  }

  // Auto-install MCP server if editor supports file-based config
  if (editorInfo.mcpConfigPath) {
    const wasInstalled = await ensureMcpServerInstalled(editorInfo.mcpConfigPath);
    if (wasInstalled) {
      vscode.window.showInformationMessage(
        `Explain Changes MCP server has been configured. Restart ${editorInfo.name} to enable it.`
      );
    }
  }

  // Register command to manually show panel
  const showPanelCommand = vscode.commands.registerCommand(
    "explainChanges.showPanel",
    () => {
      const data = readPendingFile();
      if (data) {
        DiffExplanationPanel.createOrShow(context.extensionUri, data);
      } else {
        vscode.window.showInformationMessage(
          "No pending diff explanation found."
        );
      }
    }
  );
  context.subscriptions.push(showPanelCommand);

  // Register URI handler for deep links
  // Works with: vscode://explain-changes.explain-changes/show
  //         or: cursor://explain-changes.explain-changes/show
  //         or: windsurf://explain-changes.explain-changes/show
  const uriHandler = vscode.window.registerUriHandler({
    handleUri(uri: vscode.Uri) {
      if (uri.path === "/show" || uri.path === "") {
        const data = readPendingFile();
        if (data) {
          DiffExplanationPanel.createOrShow(context.extensionUri, data);
        } else {
          vscode.window.showInformationMessage(
            "No pending diff explanation found."
          );
        }
      }
    },
  });
  context.subscriptions.push(uriHandler);

  // Start file watcher
  startFileWatcher(context);

  // Check for existing pending file on activation
  const existingData = readPendingFile();
  if (existingData && existingData.timestamp > lastTimestamp && isWorkspaceMatch(existingData)) {
    lastTimestamp = existingData.timestamp;
    DiffExplanationPanel.createOrShow(context.extensionUri, existingData);
  }
}

function startFileWatcher(context: vscode.ExtensionContext) {
  // Watch the directory for changes
  try {
    fileWatcher = fs.watch(WATCH_DIR, (eventType, filename) => {
      if (filename === "pending.json") {
        handleFileChange(context);
      }
    });

    context.subscriptions.push({
      dispose: () => {
        if (fileWatcher) {
          fileWatcher.close();
          fileWatcher = null;
        }
      },
    });
  } catch (err) {
    console.error("Failed to start file watcher:", err);
  }
}

function handleFileChange(context: vscode.ExtensionContext) {
  // Debounce rapid changes
  setTimeout(() => {
    const data = readPendingFile();
    if (data && data.timestamp > lastTimestamp && isWorkspaceMatch(data)) {
      lastTimestamp = data.timestamp;
      DiffExplanationPanel.createOrShow(context.extensionUri, data);
      vscode.window.showInformationMessage("New diff explanation received!");
    }
  }, 100);
}

function readPendingFile(): DiffExplanation | null {
  try {
    if (!fs.existsSync(WATCH_FILE)) {
      return null;
    }
    const content = fs.readFileSync(WATCH_FILE, "utf-8");
    return JSON.parse(content) as DiffExplanation;
  } catch (err) {
    console.error("Failed to read pending file:", err);
    return null;
  }
}

function isWorkspaceMatch(data: DiffExplanation): boolean {
  // If no workspace path specified, show in all windows (backwards compatible)
  if (!data.workspacePath) {
    return true;
  }

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return false;
  }

  // Check if any workspace folder matches the data's workspace path
  const normalizedDataPath = data.workspacePath.replace(/\/$/, "").toLowerCase();
  return workspaceFolders.some((folder) => {
    const normalizedFolderPath = folder.uri.fsPath.replace(/\/$/, "").toLowerCase();
    return normalizedFolderPath === normalizedDataPath;
  });
}

export function deactivate() {
  if (fileWatcher) {
    fileWatcher.close();
    fileWatcher = null;
  }
}
