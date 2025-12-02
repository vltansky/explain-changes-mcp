type Editor = "vscode" | "cursor" | "auto";
type DiffStyle = "line-by-line" | "side-by-side";

type Annotation = {
  file: string;
  line?: number;
  explanation: string;
};

type EditorConfig = {
  name: string;
  scheme: string;
  icon: string;
};

const EDITORS: Record<string, EditorConfig> = {
  vscode: {
    name: "VS Code",
    scheme: "vscode",
    icon: `<svg class="w-4 h-4" viewBox="0 0 100 100" fill="currentColor"><path d="M71.6 0L30 28.6l-18.4-14L0 19.6v60.8l11.6 5L30 71.4 71.6 100 100 86.2V13.8L71.6 0zM30 57.4L17.4 50 30 42.6v14.8zm41.6 21.8L40 55.8V44.2l31.6-23.4v58.4z"/></svg>`,
  },
  cursor: {
    name: "Cursor",
    scheme: "cursor",
    icon: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M5.5 2L20 12L5.5 22L7 12L5.5 2Z"/></svg>`,
  },
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeForJs(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$/g, "\\$");
}

function renderEditorButtons(editors: EditorConfig[]): string {
  return editors
    .map(
      (editor) => `
      <button onclick="openInEditor('${editor.scheme}')"
              class="editor-btn">
        ${editor.icon}
        <span>${editor.name}</span>
      </button>
    `
    )
    .join("");
}

export function generateHTML(
  title: string,
  summary: string | undefined,
  diff: string,
  annotations: Annotation[],
  editor: Editor = "auto",
  diffStyle: DiffStyle = "side-by-side"
): string {
  const editors: EditorConfig[] =
    editor === "auto" ? [EDITORS.vscode, EDITORS.cursor] : [EDITORS[editor]];

  const escapedDiff = escapeForJs(diff);
  const annotationsJson = JSON.stringify(annotations);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <!-- diff2html -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/diff2html/bundles/css/diff2html.min.css">
  <script src="https://cdn.jsdelivr.net/npm/diff2html/bundles/js/diff2html-ui.min.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #0d1117;
      color: #e6edf3;
      line-height: 1.5;
    }

    /* Scrollbar */
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #484f58; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #6e7681; }

    /* Header */
    .header {
      position: sticky;
      top: 0;
      z-index: 100;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 32px;
      background: rgba(13, 17, 23, 0.85);
      border-bottom: 1px solid #30363d;
      backdrop-filter: blur(12px);
      box-shadow: 0 1px 0 rgba(255,255,255,0.05);
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .header-title {
      font-size: 16px;
      font-weight: 600;
      color: #e6edf3;
      letter-spacing: -0.01em;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    /* View toggle */
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
      transition: all 0.15s ease;
    }

    .view-toggle-btn:hover {
      color: #e6edf3;
      background: rgba(255,255,255,0.05);
    }

    .view-toggle-btn.active {
      color: #e6edf3;
      background: #30363d;
    }

    .view-toggle-btn svg {
      width: 14px;
      height: 14px;
    }

    .editor-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      font-size: 13px;
      font-weight: 500;
      color: #e6edf3;
      background: #21262d;
      border: 1px solid rgba(240, 246, 252, 0.1);
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .editor-btn:hover {
      background: #30363d;
      border-color: #8b949e;
      transform: translateY(-1px);
    }

    /* Summary */
    .summary {
      max-width: 1400px;
      margin: 32px auto 0;
      padding: 0 32px;
    }

    .summary-box {
      display: flex;
      gap: 16px;
      padding: 20px;
      background: rgba(56, 139, 253, 0.1);
      border: 1px solid rgba(56, 139, 253, 0.2);
      border-radius: 12px;
    }

    .summary-icon {
      flex-shrink: 0;
      width: 24px;
      height: 24px;
      color: #58a6ff;
    }

    .summary-text {
      font-size: 15px;
      color: #e6edf3;
      line-height: 1.6;
    }

    /* Main content */
    .content {
      max-width: 1400px;
      margin: 32px auto;
      padding: 0 32px;
    }

    /* Diff container */
    #diff-container {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    /* Individual file changes */
    .d2h-file-wrapper {
      border-radius: 6px;
      overflow: hidden;
      margin-bottom: 0 !important;
    }

    /* File header tweaks */
    .d2h-file-header {
      padding: 10px 16px;
    }

    .d2h-file-name {
      font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace;
      font-size: 13px;
      font-weight: 600;
    }

    .d2h-file-link {
      color: #58a6ff;
      text-decoration: none;
      transition: color 0.15s ease;
    }

    .d2h-file-link:hover {
      color: #79c0ff;
      text-decoration: underline;
    }

    .d2h-tag {
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 6px;
      font-weight: 500;
    }

    .d2h-changed-tag {
      display: none;
    }

    .d2h-code-linenumber.d2h-ins {
      background: #21262d !important;
    }

    .d2h-code-linenumber.d2h-del {
      background: #21262d !important;
    }

    .d2h-code-side-linenumber.d2h-ins {
      backdrop-filter: blur(8px);
    }

    .d2h-diff-table {
      font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace;
      font-size: 12px;
      width: 100% !important;
      table-layout: auto;
    }

    /* Info/hunk headers */
    .d2h-info {
      padding: 4px 16px;
      font-size: 12px;
    }

    /* AI Annotation - inline comment style */
    .ai-annotation {
      display: flex;
      gap: 16px;
      margin: 8px 0 16px;
      padding: 20px;
      background: #1c2128;
      border: 1px solid #30363d;
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.2);
      position: relative;
      overflow: hidden;
      width: 100%;
      box-sizing: border-box;
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

    .ai-annotation-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 6px;
    }

    .ai-annotation-label {
      font-size: 13px;
      font-weight: 600;
      background: linear-gradient(90deg, #a5d6ff 0%, #e6edf3 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .ai-annotation-file {
      font-size: 11px;
      font-family: 'JetBrains Mono', monospace;
      color: #8b949e;
    }

    .ai-annotation-line {
      font-size: 11px;
      padding: 2px 8px;
      background: #30363d;
      color: #e6edf3;
      border-radius: 4px;
      font-family: 'JetBrains Mono', monospace;
    }

    .ai-annotation-text {
      font-size: 14px;
      color: #e6edf3;
      line-height: 1.6;
    }

    /* Annotation row full width */
    .d2h-diff-tbody td[colspan] {
      width: 100% !important;
      max-width: 100% !important;
      padding: 0 !important;
      display: table-cell;
    }

    .d2h-diff-tbody tr:has(td[colspan]) {
      width: 100% !important;
      display: table-row;
    }

    /* Ensure annotation spans full width of cell */
    .d2h-diff-tbody td[colspan] .ai-annotation {
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
    }

    /* Footer */
    .footer {
      max-width: 1400px;
      margin: 48px auto 24px;
      padding: 24px;
      text-align: center;
      border-top: 1px solid rgba(48, 54, 61, 0.5);
    }

    .footer-text {
      font-size: 12px;
      color: #484f58;
      font-family: 'JetBrains Mono', monospace;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .header { padding: 12px 16px; }
      .header-title { font-size: 14px; }
      .content, .summary { padding: 0 16px; }
      .d2h-file-name { font-size: 12px; }
    }
  </style>
</head>
<body>
  <!-- Header -->
  <header class="header">
    <div class="header-left">
      <h1 class="header-title">${escapeHtml(title)}</h1>
    </div>
    <div class="header-actions">
      <div class="view-toggle">
        <button class="view-toggle-btn${diffStyle === "line-by-line" ? " active" : ""}" data-view="line-by-line" title="Unified view">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M4 6h16M4 12h16M4 18h16"/>
          </svg>
          <span>Unified</span>
        </button>
        <button class="view-toggle-btn${diffStyle === "side-by-side" ? " active" : ""}" data-view="side-by-side" title="Split view">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M9 4v16M4 4h16v16H4z"/>
          </svg>
          <span>Split</span>
        </button>
      </div>
    </div>
  </header>

  ${summary ? `
  <!-- Summary -->
  <div class="summary">
    <div class="summary-box">
      <svg class="summary-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      <p class="summary-text">${escapeHtml(summary)}</p>
    </div>
  </div>
  ` : ""}

  <!-- Diff -->
  <div class="content">
    <div id="diff-container" class="d2h-dark-color-scheme"></div>
  </div>

  <!-- Footer -->
  <footer class="footer">
    <p class="footer-text">Generated by Code Explainer MCP · ${new Date().toLocaleString()}</p>
  </footer>

  <script>
    const diffString = \`${escapedDiff}\`;
    const annotations = ${annotationsJson};
    let currentView = '${diffStyle}';

    // Render diff
    function renderDiff(outputFormat) {
      const targetElement = document.getElementById('diff-container');
      targetElement.innerHTML = '';

      const configuration = {
        drawFileList: false,
        fileListToggle: false,
        fileContentToggle: false,
        matching: 'lines',
        outputFormat: outputFormat,
        synchronisedScroll: true,
        highlight: true,
        renderNothingWhenEmpty: false,
      };

      const diff2htmlUi = new Diff2HtmlUI(targetElement, diffString, configuration);
      diff2htmlUi.draw();
      diff2htmlUi.highlightCode();

      // Enhance file headers with line ranges and IDE links
      setTimeout(enhanceFileHeaders, 150);
      // Re-insert annotations after render
      setTimeout(insertAnnotations, 200);
    }

    // Initial render
    renderDiff(currentView);

    // View toggle handlers
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

    // Insert annotations after relevant lines
    function insertAnnotations() {
      annotations.forEach(annotation => {
        // Find file sections
        const fileHeaders = document.querySelectorAll('.d2h-file-header');

        fileHeaders.forEach(header => {
          const fileName = header.querySelector('.d2h-file-name');
          if (!fileName) return;

          const headerFileName = fileName.textContent.trim();
          // Match if annotation file is contained in or matches the header file
          if (!headerFileName.includes(annotation.file) && !annotation.file.includes(headerFileName)) return;

          // Find the diff body for this file
          const fileWrapper = header.closest('.d2h-file-wrapper');
          if (!fileWrapper) return;

          const diffBodies = fileWrapper.querySelectorAll('.d2h-diff-tbody');
          if (diffBodies.length === 0) return;

          const isSideBySide = diffBodies.length > 1;

          // If line specified, find specific line index
          let targetRowIndex = -1;

          if (annotation.line) {
            // In side-by-side, usually right side has the new code (added/modified)
            // We'll search in the last body (which is right side in split, or the only body in unified)
            const searchBody = diffBodies[diffBodies.length - 1];
            const lineNumbers = searchBody.querySelectorAll('.d2h-code-linenumber');

            lineNumbers.forEach(ln => {
              const lineNum = parseInt(ln.textContent.trim(), 10);
              if (lineNum === annotation.line) {
                const row = ln.closest('tr');
                if (row && row.parentElement) {
                  // Get index of this row in the tbody
                  targetRowIndex = Array.from(row.parentElement.children).indexOf(row);
                }
              }
            });
          }

          // If not found by line number, default to last row
          if (targetRowIndex === -1) {
             // Use the length of the last body
             targetRowIndex = diffBodies[diffBodies.length - 1].children.length - 1;
          }

          // Insert in all bodies to maintain alignment
          diffBodies.forEach((diffBody, index) => {
             const rows = diffBody.children;
             let targetRow = rows[targetRowIndex];

             // If target index is out of bounds (e.g. last row), use the last row
             if (!targetRow && rows.length > 0) {
               targetRow = rows[rows.length - 1];
             }

             if (targetRow) {
                // Determine colspan
                const firstRow = diffBody.querySelector('tr');
                const colCount = firstRow ? firstRow.querySelectorAll('td, th').length : (isSideBySide ? 2 : 3);

                // Create annotation row
                const annotationRow = document.createElement('tr');

                // Only show content in the right side (index 1) for split view, or if unified (index 0 of 1)
                // Or show in both but hide one?
                // To make it look like full width in split view, we can't easily merge them.
                // We will show the annotation in the right side (code side) mostly.
                // But for proper "full width" feel in split, maybe duplicating is better or just putting it on the code side.
                // Let's put it on the side that has the code. For ADDED file, that is right side.

                // If side-by-side and this is the left side (index 0), render invisible clone to maintain height
                const showContent = !isSideBySide || index === 1;

                annotationRow.innerHTML = \`
                  <td colspan="\${colCount}" style="padding: 0; width: 100%;">
                    <div class="ai-annotation" \${!showContent ? 'style="visibility: hidden;"' : ''}>
                      <div class="ai-annotation-content">
                        <p class="ai-annotation-text">\${escapeHtml(annotation.explanation)}</p>
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

    // Enhance file headers with IDE links
    function enhanceFileHeaders() {
      document.querySelectorAll('.d2h-file-wrapper').forEach(wrapper => {
        const fileNameEl = wrapper.querySelector('.d2h-file-name');
        if (!fileNameEl || fileNameEl.dataset.enhanced) return;
        fileNameEl.dataset.enhanced = 'true';

        const filePath = fileNameEl.textContent.trim();

        // Extract start line from first hunk header
        let startLine = 1;
        const infoEl = wrapper.querySelector('td.d2h-info');
        if (infoEl) {
          const match = (infoEl.textContent || '').match(/[+](\\d+)/);
          if (match) startLine = parseInt(match[1], 10);
        }

        // Create link element
        const link = document.createElement('a');
        link.href = '#';
        link.className = 'd2h-file-link';
        link.textContent = filePath;
        link.title = 'Open in editor';
        link.onclick = (e) => {
          e.preventDefault();
          const scheme = '${editor === "cursor" ? "cursor" : "vscode"}';
          window.location.href = scheme + '://file/' + filePath + ':' + startLine;
        };

        fileNameEl.textContent = '';
        fileNameEl.appendChild(link);
      });
    }

    // Open in editor (header button)
    function openInEditor(scheme) {
      const fileName = document.querySelector('.d2h-file-name a, .d2h-file-name');
      if (fileName) {
        const filePath = fileName.textContent.trim().split(':')[0];
        window.location.href = scheme + '://file/' + filePath;
      }
    }
  </script>
</body>
</html>`;
}
