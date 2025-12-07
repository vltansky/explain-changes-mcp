import * as vscode from "vscode";
import { DiffExplanation, Annotation, Action } from "./types";

export class DiffExplanationPanel {
  public static currentPanel: DiffExplanationPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private _currentEditor: string = "cursor";

  public static createOrShow(
    extensionUri: vscode.Uri,
    data: DiffExplanation
  ): void {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (DiffExplanationPanel.currentPanel) {
      DiffExplanationPanel.currentPanel._panel.reveal(column);
      DiffExplanationPanel.currentPanel._update(data);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "explainChanges",
      data.title,
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri],
      }
    );

    DiffExplanationPanel.currentPanel = new DiffExplanationPanel(
      panel,
      extensionUri,
      data
    );
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    data: DiffExplanation
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    this._update(data);

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      (message) => this._handleMessage(message),
      null,
      this._disposables
    );
  }

  private _handleMessage(message: { command: string; [key: string]: unknown }) {
    console.log("Received message from webview:", message.command);
    switch (message.command) {
      case "openFile":
        const filePath = message.file as string;
        const line = message.line as number | undefined;
        this._openFileInEditor(filePath, line);
        break;
      case "executeAction":
        const prompt = message.prompt as string;
        console.log("executeAction received, prompt length:", prompt?.length);
        this._executeAction(prompt);
        break;
    }
  }

  private async _openFileInEditor(filePath: string, line?: number) {
    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) return;

      const fullPath = vscode.Uri.joinPath(workspaceFolders[0].uri, filePath);
      const doc = await vscode.workspace.openTextDocument(fullPath);
      const editor = await vscode.window.showTextDocument(doc);

      if (line && line > 0) {
        const position = new vscode.Position(line - 1, 0);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(new vscode.Range(position, position));
      }
    } catch (err) {
      vscode.window.showErrorMessage(`Could not open file: ${filePath}`);
    }
  }

  private async _executeAction(prompt: string) {
    // Use native Cursor deeplink
    const deepLink = `cursor://anysphere.cursor-deeplink/prompt?text=${encodeURIComponent(prompt)}`;
    try {
      await vscode.env.openExternal(vscode.Uri.parse(deepLink));
    } catch (err) {
      // Fallback: copy to clipboard
      await vscode.env.clipboard.writeText(prompt);
      vscode.window.showInformationMessage(
        "Prompt copied to clipboard. Press Cmd+L and paste to start a chat."
      );
    }
  }

  private _update(data: DiffExplanation) {
    this._panel.title = data.title;
    this._currentEditor = data.editor || "cursor";
    this._panel.webview.html = this._getHtmlContent(data);
  }

  private _getHtmlContent(data: DiffExplanation): string {
    const { title, summary, diff, annotations, editor } = data;

    const escapedDiff = this._escapeForJs(diff);
    const annotationsJson = JSON.stringify(annotations);
    const diffStyle = "side-by-side";

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'unsafe-inline' https://cdn.jsdelivr.net; img-src data:;">
  <title>${this._escapeHtml(title)}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/diff2html/bundles/css/diff2html.min.css">
  <script src="https://cdn.jsdelivr.net/npm/diff2html/bundles/js/diff2html-ui.min.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', var(--vscode-font-family), sans-serif;
      background: var(--vscode-editor-background, #0d1117);
      color: var(--vscode-editor-foreground, #e6edf3);
      line-height: 1.5;
    }

    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--vscode-scrollbarSlider-background, #484f58); border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--vscode-scrollbarSlider-hoverBackground, #6e7681); }

    .header {
      position: sticky;
      top: 0;
      z-index: 100;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 24px;
      background: var(--vscode-editor-background, #0d1117);
      border-bottom: 1px solid var(--vscode-panel-border, #30363d);
    }

    .header-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--vscode-editor-foreground, #e6edf3);
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .view-toggle {
      display: flex;
      background: var(--vscode-input-background, #21262d);
      border: 1px solid var(--vscode-input-border, rgba(240, 246, 252, 0.1));
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
      color: var(--vscode-descriptionForeground, #8b949e);
      background: transparent;
      border: none;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .view-toggle-btn:hover {
      color: var(--vscode-editor-foreground, #e6edf3);
      background: rgba(255,255,255,0.05);
    }

    .view-toggle-btn.active {
      color: var(--vscode-editor-foreground, #e6edf3);
      background: var(--vscode-button-secondaryBackground, #30363d);
    }

    .view-toggle-btn svg {
      width: 14px;
      height: 14px;
    }

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
      color: var(--vscode-editor-foreground, #e6edf3);
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

    .d2h-file-wrapper {
      border-radius: 6px;
      overflow: hidden;
      margin-bottom: 0 !important;
    }

    .d2h-file-header {
      padding: 10px 16px;
      background: var(--vscode-editor-background, #161b22) !important;
    }

    .d2h-file-name {
      font-family: 'JetBrains Mono', ui-monospace, monospace;
      font-size: 13px;
      font-weight: 600;
    }

    .d2h-file-link {
      color: var(--vscode-textLink-foreground, #58a6ff);
      text-decoration: none;
      cursor: pointer;
    }

    .d2h-file-link:hover {
      text-decoration: underline;
    }

    .d2h-diff-table {
      font-family: 'JetBrains Mono', ui-monospace, monospace;
      font-size: 12px;
      width: 100% !important;
    }

    /* Make line number columns transparent */
    .d2h-code-linenumber,
    .d2h-code-side-linenumber {
      background: transparent !important;
    }

    .ai-annotation {
      display: flex;
      gap: 16px;
      margin: 8px 0 16px;
      padding: 16px 20px;
      background: var(--vscode-editor-inactiveSelectionBackground, #1c2128);
      border: 1px solid var(--vscode-panel-border, #30363d);
      border-radius: 8px;
      position: relative;
      overflow: hidden;
    }

    .ai-annotation::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 4px;
      height: 100%;
      background: linear-gradient(180deg, #8b5cf6 0%, #6366f1 100%);
    }

    .ai-annotation-content {
      flex: 1;
      min-width: 0;
    }

    .ai-annotation-text {
      font-size: 13px;
      color: var(--vscode-editor-foreground, #e6edf3);
      line-height: 1.6;
    }

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
      color: var(--vscode-editor-foreground, #e6edf3);
      background: var(--vscode-button-secondaryBackground, #21262d);
      border: 1px solid var(--vscode-input-border, rgba(240, 246, 252, 0.1));
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .action-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground, #30363d);
      border-color: var(--vscode-focusBorder, #58a6ff);
    }

    .action-btn svg {
      width: 14px;
      height: 14px;
    }

    .footer {
      max-width: 1400px;
      margin: 32px auto 16px;
      padding: 16px 24px;
      text-align: center;
      border-top: 1px solid var(--vscode-panel-border, rgba(48, 54, 61, 0.5));
    }

    .footer-text {
      font-size: 11px;
      color: var(--vscode-descriptionForeground, #484f58);
      font-family: 'JetBrains Mono', monospace;
    }
  </style>
</head>
<body>
  <header class="header">
    <h1 class="header-title">${this._escapeHtml(title)}</h1>
    <div class="header-actions">
      <div class="view-toggle">
        <button class="view-toggle-btn${diffStyle === "line-by-line" ? " active" : ""}" data-view="line-by-line">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M4 6h16M4 12h16M4 18h16"/>
          </svg>
          <span>Unified</span>
        </button>
        <button class="view-toggle-btn${diffStyle === "side-by-side" ? " active" : ""}" data-view="side-by-side">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M9 4v16M4 4h16v16H4z"/>
          </svg>
          <span>Split</span>
        </button>
      </div>
    </div>
  </header>

  ${summary ? `
  <div class="summary">
    <div class="summary-box">
      <p class="summary-text">${this._escapeHtml(summary)}</p>
    </div>
  </div>
  ` : ""}

  <div class="content">
    <div id="diff-container" class="d2h-dark-color-scheme"></div>
  </div>

  <footer class="footer">
    <p class="footer-text">Explain Changes</p>
  </footer>

  <script>
    const vscode = acquireVsCodeApi();
    const diffString = \`${escapedDiff}\`;
    const annotations = ${annotationsJson};
    let currentView = '${diffStyle}';

    function splitDiffByFile(diff) {
      const files = [];
      const parts = diff.split(/(?=diff --git)/);
      for (const part of parts) {
        if (part.trim()) files.push(part);
      }
      return files;
    }

    function isNewFile(fileDiff) {
      return fileDiff.includes('--- /dev/null') ||
             (fileDiff.includes('new file mode') && !fileDiff.includes('deleted file mode'));
    }

    function isDeletedFile(fileDiff) {
      return fileDiff.includes('+++ /dev/null') || fileDiff.includes('deleted file mode');
    }

    function renderDiff(outputFormat) {
      const targetElement = document.getElementById('diff-container');
      targetElement.innerHTML = '';

      if (!diffString || diffString.trim() === '') {
        targetElement.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--vscode-descriptionForeground);">No diff content</div>';
        return;
      }

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
          fileListToggle: false,
          fileContentToggle: false,
          matching: 'lines',
          outputFormat: fileOutputFormat,
          synchronisedScroll: true,
          highlight: true,
          renderNothingWhenEmpty: false,
        };

        try {
          const diff2htmlUi = new Diff2HtmlUI(fileContainer, fileDiff, configuration);
          diff2htmlUi.draw();
          diff2htmlUi.highlightCode();
        } catch (err) {
          fileContainer.innerHTML = '<div style="padding: 20px; color: var(--vscode-errorForeground);">Error rendering diff</div>';
        }
      });

      setTimeout(enhanceFileHeaders, 150);
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

    const CURSOR_LOGO = '<svg fill="none" height="16" width="16" viewBox="0 0 22 22"><g clip-path="url(#a)" fill="currentColor"><path d="M19.162 5.452 10.698.565a.88.88 0 0 0-.879 0L1.356 5.452a.74.74 0 0 0-.37.64v9.853a.74.74 0 0 0 .37.64l8.464 4.887a.879.879 0 0 0 .879 0l8.464-4.886a.74.74 0 0 0 .37-.64V6.091a.74.74 0 0 0-.37-.64Zm-.531 1.035L10.46 20.639c-.055.095-.201.056-.201-.055v-9.266a.52.52 0 0 0-.26-.45L1.975 6.237c-.096-.056-.057-.202.054-.202h16.34c.233 0 .378.252.262.453Z"/></g></svg>';

    const VSCODE_LOGO = '<svg fill="none" height="16" width="16" viewBox="0 0 24 24"><path fill="currentColor" d="M17.583 3.104l-5.477 4.984-5.45-4.239-2.656 1.27v13.762l2.656 1.27 5.45-4.239 5.477 4.984L21 18.986V5.014l-3.417-1.91zM5.5 16.5v-9l3.5 4.5-3.5 4.5zm7.5-4.5l-5 4.5V7.5l5 4.5zm5.5 4.5l-3.5-4.5 3.5-4.5v9z"/></svg>';

    const currentEditor = '${editor || "cursor"}';
    const EDITOR_LOGO = currentEditor === 'cursor' ? CURSOR_LOGO : VSCODE_LOGO;

    function renderActions(actions) {
      if (!actions || actions.length === 0) return '';
      return actions.map((action, idx) => \`
        <button class="action-btn" data-action-idx="\${idx}" data-prompt="\${btoa(encodeURIComponent(action.prompt))}">
          \${EDITOR_LOGO}
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
            let targetRow = rows[targetRowIndex];

            if (!targetRow && rows.length > 0) {
              targetRow = rows[rows.length - 1];
            }

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

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function escapeForAttr(text) {
      return text.replace(/'/g, "\\\\'").replace(/\\n/g, "\\\\n");
    }

    function enhanceFileHeaders() {
      document.querySelectorAll('.d2h-file-wrapper').forEach(wrapper => {
        const fileNameEl = wrapper.querySelector('.d2h-file-name');
        if (!fileNameEl || fileNameEl.dataset.enhanced) return;
        fileNameEl.dataset.enhanced = 'true';

        const filePath = fileNameEl.textContent.trim();

        let startLine = 1;
        const infoEl = wrapper.querySelector('td.d2h-info');
        if (infoEl) {
          const match = (infoEl.textContent || '').match(/[+](\\d+)/);
          if (match) startLine = parseInt(match[1], 10);
        }

        const link = document.createElement('a');
        link.href = '#';
        link.className = 'd2h-file-link';
        link.textContent = filePath;
        link.title = 'Open in editor';
        link.onclick = (e) => {
          e.preventDefault();
          vscode.postMessage({ command: 'openFile', file: filePath, line: startLine });
        };

        fileNameEl.textContent = '';
        fileNameEl.appendChild(link);
      });
    }

    function executeAction(prompt) {
      console.log('executeAction called with prompt:', prompt.substring(0, 100));
      vscode.postMessage({ command: 'executeAction', prompt: prompt });
    }

    // Event delegation for action buttons
    document.addEventListener('click', (e) => {
      console.log('Click event:', e.target);
      const btn = e.target.closest('.action-btn');
      console.log('Found button:', btn);
      if (btn) {
        console.log('Button dataset:', btn.dataset);
        if (btn.dataset.prompt) {
          try {
            const decoded = atob(btn.dataset.prompt);
            console.log('Decoded base64:', decoded.substring(0, 50));
            const prompt = decodeURIComponent(decoded);
            console.log('Final prompt:', prompt.substring(0, 100));
            executeAction(prompt);
          } catch (err) {
            console.error('Error decoding prompt:', err);
          }
        } else {
          console.log('No data-prompt on button');
        }
      }
    });
  </script>
</body>
</html>`;
  }

  private _escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  private _escapeForJs(text: string): string {
    return text
      .replace(/\\/g, "\\\\")
      .replace(/`/g, "\\`")
      .replace(/\$/g, "\\$")
      .replace(/'/g, "\\'");
  }

  public dispose() {
    DiffExplanationPanel.currentPanel = undefined;

    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
}
