import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3457;

// Mock data for testing
const mockData = {
  title: "Add user authentication",
  summary: "Added JWT middleware and protected API routes with token validation.",
  editor: "cursor",
  workspacePath: "/Users/test/myproject",
  timestamp: Date.now(),
  diff: `diff --git a/src/auth.ts b/src/auth.ts
new file mode 100644
index 0000000..a1b2c3d
--- /dev/null
+++ b/src/auth.ts
@@ -0,0 +1,25 @@
+import jwt from 'jsonwebtoken';
+
+const SECRET = process.env.JWT_SECRET || 'dev-secret';
+
+export function authMiddleware(req, res, next) {
+  const token = req.headers.authorization?.replace('Bearer ', '');
+
+  if (!token) {
+    return res.status(401).json({ error: 'No token provided' });
+  }
+
+  try {
+    const decoded = jwt.verify(token, SECRET);
+    req.user = decoded;
+    next();
+  } catch (err) {
+    return res.status(401).json({ error: 'Invalid token' });
+  }
+}
+
+export function generateToken(payload) {
+  return jwt.sign(payload, SECRET, { expiresIn: '24h' });
+}
diff --git a/src/routes/api.ts b/src/routes/api.ts
index 1234567..89abcde 100644
--- a/src/routes/api.ts
+++ b/src/routes/api.ts
@@ -1,8 +1,12 @@
 import express from 'express';
+import { authMiddleware } from '../auth';

 const router = express.Router();

-router.get('/users', (req, res) => {
+// Protected route - requires authentication
+router.get('/users', authMiddleware, (req, res) => {
   res.json({ users: [] });
 });
+
+router.get('/public', (req, res) => {
+  res.json({ message: 'Public endpoint' });
+});`,
  annotations: [
    {
      file: "src/auth.ts",
      line: 6,
      explanation: "Extracts Bearer token from Authorization header. The optional chaining handles cases where the header is missing.",
      actions: [
        {
          label: "Add refresh token",
          prompt: "Add refresh token support to this auth middleware. Include a /refresh endpoint that issues new access tokens."
        },
        {
          label: "Add rate limiting",
          prompt: "Add rate limiting to prevent brute force attacks on the auth endpoints."
        }
      ]
    },
    {
      file: "src/auth.ts",
      line: 14,
      explanation: "JWT verification using the secret. If the token is expired or tampered with, this will throw an error.",
      actions: [
        {
          label: "Log failed attempts",
          prompt: "Add logging for failed authentication attempts to help detect potential attacks."
        }
      ]
    },
    {
      file: "src/routes/api.ts",
      line: 8,
      explanation: "Applied authMiddleware to protect the /users endpoint. Only authenticated requests will reach the handler.",
      actions: [
        {
          label: "Add role-based access",
          prompt: "Add role-based access control so only admin users can access the /users endpoint."
        }
      ]
    }
  ]
};

// Generate the HTML (simplified version of webviewProvider)
function generateHtml(data) {
  const { title, summary, diff, annotations, editor } = data;

  const escapedDiff = diff
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$/g, "\\$");

  const annotationsJson = JSON.stringify(annotations);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/diff2html/bundles/css/diff2html.min.css">
  <script src="https://cdn.jsdelivr.net/npm/diff2html/bundles/js/diff2html-ui.min.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', sans-serif;
      background: #0d1117;
      color: #e6edf3;
      line-height: 1.5;
    }

    .header {
      position: sticky;
      top: 0;
      z-index: 100;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 24px;
      background: #0d1117;
      border-bottom: 1px solid #30363d;
    }

    .header-title {
      font-size: 16px;
      font-weight: 600;
    }

    .view-toggle {
      display: flex;
      background: #21262d;
      border: 1px solid rgba(240, 246, 252, 0.1);
      border-radius: 6px;
      overflow: hidden;
    }

    .view-toggle-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      font-size: 12px;
      font-weight: 500;
      color: #8b949e;
      background: transparent;
      border: none;
      cursor: pointer;
    }

    .view-toggle-btn:hover { color: #e6edf3; background: rgba(255,255,255,0.05); }
    .view-toggle-btn.active { color: #e6edf3; background: #30363d; }

    .summary {
      max-width: 1400px;
      margin: 24px auto 0;
      padding: 0 24px;
    }

    .summary-box {
      padding: 16px 20px;
      background: rgba(56, 139, 253, 0.1);
      border: 1px solid rgba(56, 139, 253, 0.2);
      border-radius: 8px;
    }

    .summary-text {
      font-size: 14px;
      line-height: 1.5;
    }

    .content {
      max-width: 1400px;
      margin: 24px auto;
      padding: 0 24px;
    }

    #diff-container {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .d2h-file-wrapper { border-radius: 6px; overflow: hidden; margin-bottom: 0 !important; }
    .d2h-file-header { padding: 10px 16px; background: #161b22 !important; }
    .d2h-file-name { font-family: 'JetBrains Mono', monospace; font-size: 13px; font-weight: 600; }
    .d2h-diff-table { font-family: 'JetBrains Mono', monospace; font-size: 12px; width: 100% !important; }

    .d2h-code-linenumber, .d2h-code-side-linenumber { background: transparent !important; }

    .ai-annotation {
      display: flex;
      gap: 16px;
      margin: 8px 0 16px;
      padding: 16px 20px;
      background: #1c2128;
      border: 1px solid #30363d;
      border-radius: 8px;
      position: relative;
      overflow: hidden;
    }

    .ai-annotation::before {
      content: '';
      position: absolute;
      top: 0; left: 0;
      width: 4px; height: 100%;
      background: linear-gradient(180deg, #8b5cf6 0%, #6366f1 100%);
    }

    .ai-annotation-content { flex: 1; min-width: 0; }
    .ai-annotation-text { font-size: 13px; line-height: 1.6; }

    .ai-annotation-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
    }

    .action-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 500;
      color: #e6edf3;
      background: #21262d;
      border: 1px solid rgba(240, 246, 252, 0.1);
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .action-btn:hover {
      background: #30363d;
      border-color: #58a6ff;
    }

    .action-btn svg { width: 14px; height: 14px; }

    .footer {
      max-width: 1400px;
      margin: 32px auto 16px;
      padding: 16px 24px;
      text-align: center;
      border-top: 1px solid rgba(48, 54, 61, 0.5);
    }

    .footer-text {
      font-size: 11px;
      color: #484f58;
      font-family: 'JetBrains Mono', monospace;
    }

    /* Dev mode indicator */
    .dev-banner {
      background: #f85149;
      color: white;
      padding: 8px 16px;
      text-align: center;
      font-size: 12px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="dev-banner">DEV MODE - Click actions will log to console</div>

  <header class="header">
    <h1 class="header-title">${title}</h1>
    <div class="view-toggle">
      <button class="view-toggle-btn" data-view="line-by-line">Unified</button>
      <button class="view-toggle-btn active" data-view="side-by-side">Split</button>
    </div>
  </header>

  ${summary ? `
  <div class="summary">
    <div class="summary-box">
      <p class="summary-text">${summary}</p>
    </div>
  </div>
  ` : ""}

  <div class="content">
    <div id="diff-container" class="d2h-dark-color-scheme"></div>
  </div>

  <footer class="footer">
    <p class="footer-text">Explain Changes - Dev Mode</p>
  </footer>

  <script>
    const diffString = \`${escapedDiff}\`;
    const annotations = ${annotationsJson};
    let currentView = 'side-by-side';

    // Mock vscode API for dev - opens Cursor web link
    const vscode = {
      postMessage: (msg) => {
        console.log('vscode.postMessage:', msg);
        if (msg.command === 'executeAction') {
          const webLink = 'https://cursor.com/link/prompt?text=' + encodeURIComponent(msg.prompt);
          window.open(webLink, '_blank');
        }
      }
    };

    function splitDiffByFile(diff) {
      const files = [];
      const parts = diff.split(/(?=diff --git)/);
      for (const part of parts) {
        if (part.trim()) files.push(part);
      }
      return files;
    }

    function isNewFile(fileDiff) {
      return fileDiff.includes('--- /dev/null');
    }

    function isDeletedFile(fileDiff) {
      return fileDiff.includes('+++ /dev/null');
    }

    function renderDiff(outputFormat) {
      const targetElement = document.getElementById('diff-container');
      targetElement.innerHTML = '';

      const fileDiffs = splitDiffByFile(diffString);

      fileDiffs.forEach((fileDiff) => {
        const fileContainer = document.createElement('div');
        fileContainer.className = 'file-diff-section';
        targetElement.appendChild(fileContainer);

        const isNew = isNewFile(fileDiff);
        const isDeleted = isDeletedFile(fileDiff);
        const fileOutputFormat = (isNew || isDeleted) ? 'line-by-line' : outputFormat;

        const configuration = {
          drawFileList: false,
          matching: 'lines',
          outputFormat: fileOutputFormat,
          synchronisedScroll: true,
          highlight: true,
        };

        const diff2htmlUi = new Diff2HtmlUI(fileContainer, fileDiff, configuration);
        diff2htmlUi.draw();
        diff2htmlUi.highlightCode();
      });

      setTimeout(insertAnnotations, 200);
    }

    renderDiff(currentView);

    document.querySelectorAll('.view-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        if (view === currentView) return;
        currentView = view;
        document.querySelectorAll('.view-toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderDiff(view);
      });
    });

    const CURSOR_LOGO = '<svg fill="none" height="16" width="16" viewBox="0 0 22 22"><g fill="currentColor"><path d="M19.162 5.452 10.698.565a.88.88 0 0 0-.879 0L1.356 5.452a.74.74 0 0 0-.37.64v9.853a.74.74 0 0 0 .37.64l8.464 4.887a.879.879 0 0 0 .879 0l8.464-4.886a.74.74 0 0 0 .37-.64V6.091a.74.74 0 0 0-.37-.64Zm-.531 1.035L10.46 20.639c-.055.095-.201.056-.201-.055v-9.266a.52.52 0 0 0-.26-.45L1.975 6.237c-.096-.056-.057-.202.054-.202h16.34c.233 0 .378.252.262.453Z"/></g></svg>';

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function renderActions(actions) {
      if (!actions || actions.length === 0) return '';
      return actions.map((action, idx) => \`
        <button class="action-btn" data-prompt="\${btoa(encodeURIComponent(action.prompt))}">
          \${CURSOR_LOGO}
          <span>\${escapeHtml(action.label)}</span>
        </button>
      \`).join('');
    }

    function insertAnnotations() {
      annotations.forEach(annotation => {
        const fileHeaders = document.querySelectorAll('.d2h-file-header');

        fileHeaders.forEach(header => {
          const fileName = header.querySelector('.d2h-file-name');
          if (!fileName) return;

          const headerFileName = fileName.textContent.trim();
          if (!headerFileName.includes(annotation.file) && !annotation.file.includes(headerFileName)) return;

          const fileWrapper = header.closest('.d2h-file-wrapper');
          if (!fileWrapper) return;

          const diffBodies = fileWrapper.querySelectorAll('.d2h-diff-tbody');
          if (diffBodies.length === 0) return;

          const isSideBySide = diffBodies.length > 1;
          let targetRowIndex = -1;

          if (annotation.line) {
            const searchBody = diffBodies[diffBodies.length - 1];
            const lineNumbers = searchBody.querySelectorAll('.d2h-code-linenumber, .d2h-code-side-linenumber');

            lineNumbers.forEach(ln => {
              const lineNum = parseInt(ln.textContent.trim(), 10);
              if (lineNum === annotation.line) {
                const row = ln.closest('tr');
                if (row && row.parentElement) {
                  targetRowIndex = Array.from(row.parentElement.children).indexOf(row);
                }
              }
            });
          }

          if (targetRowIndex === -1) {
            targetRowIndex = diffBodies[diffBodies.length - 1].children.length - 1;
          }

          diffBodies.forEach((diffBody, index) => {
            const rows = diffBody.children;
            let targetRow = rows[targetRowIndex] || rows[rows.length - 1];

            if (targetRow) {
              const firstRow = diffBody.querySelector('tr');
              const colCount = firstRow ? firstRow.querySelectorAll('td, th').length : (isSideBySide ? 2 : 3);
              const showContent = !isSideBySide || index === 1;
              const actionsHtml = annotation.actions ? \`<div class="ai-annotation-actions">\${renderActions(annotation.actions)}</div>\` : '';

              const annotationRow = document.createElement('tr');
              annotationRow.innerHTML = \`
                <td colspan="\${colCount}" style="padding: 0; width: 100%;">
                  <div class="ai-annotation" \${!showContent ? 'style="visibility: hidden;"' : ''}>
                    <div class="ai-annotation-content">
                      <p class="ai-annotation-text">\${escapeHtml(annotation.explanation)}</p>
                      \${actionsHtml}
                    </div>
                  </div>
                </td>
              \`;

              targetRow.insertAdjacentElement('afterend', annotationRow);
            }
          });
        });
      });
    }

    // Event delegation for action buttons
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.action-btn');
      if (btn && btn.dataset.prompt) {
        try {
          const prompt = decodeURIComponent(atob(btn.dataset.prompt));
          console.log('Action clicked:', prompt);
          vscode.postMessage({ command: 'executeAction', prompt: prompt });
        } catch (err) {
          console.error('Error:', err);
        }
      }
    });

    // Hot reload via SSE
    if (typeof EventSource !== 'undefined') {
      const es = new EventSource('/events');
      es.onmessage = () => location.reload();
    }
  </script>
</body>
</html>`;
}

// Simple SSE for hot reload
let clients = [];

const server = http.createServer((req, res) => {
  if (req.url === "/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    clients.push(res);
    req.on("close", () => {
      clients = clients.filter((c) => c !== res);
    });
    return;
  }

  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(generateHtml(mockData));
});

// Watch for file changes
const srcDir = path.join(__dirname, "../src");
fs.watch(srcDir, { recursive: true }, (eventType, filename) => {
  if (filename?.endsWith(".ts")) {
    console.log(`File changed: ${filename}`);
    clients.forEach((c) => c.write("data: reload\n\n"));
  }
});

// Also watch this dev server file
fs.watch(__dirname, (eventType, filename) => {
  if (filename === "server.mjs") {
    console.log("Dev server changed - restart manually");
  }
});

server.listen(PORT, () => {
  console.log(`\n  Dev server running at http://localhost:${PORT}\n`);
  console.log("  Edit mock data in this file to test different scenarios");
  console.log("  Changes to src/*.ts will trigger reload\n");
});
