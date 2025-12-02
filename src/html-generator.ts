type Editor = "vscode" | "cursor" | "auto";
type DiffStyle = "line-by-line" | "side-by-side";

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
    .replace(/\$/g, "\\$")
    .replace(/'/g, "\\'");
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

const CURSOR_LOGO_SVG = `<svg fill="none" height="22" width="22" viewBox="0 0 22 22"><title class="sr-only">Cursor Logo</title><g clip-path="url(#a)" fill="currentColor"><path d="M19.162 5.452 10.698.565a.88.88 0 0 0-.879 0L1.356 5.452a.74.74 0 0 0-.37.64v9.853a.74.74 0 0 0 .37.64l8.464 4.887a.879.879 0 0 0 .879 0l8.464-4.886a.74.74 0 0 0 .37-.64V6.091a.74.74 0 0 0-.37-.64Zm-.531 1.035L10.46 20.639c-.055.095-.201.056-.201-.055v-9.266a.52.52 0 0 0-.26-.45L1.975 6.237c-.096-.056-.057-.202.054-.202h16.34c.233 0 .378.252.262.453Zm11.057-.555h3.602v1.984h-3.48c-1.877 0-3.342 1.083-3.342 3.372 0 2.29 1.465 3.373 3.342 3.373h3.48v1.984h-3.754c-3.144 0-5.372-1.847-5.372-5.356 0-3.51 2.38-5.357 5.524-5.357Zm5.432 0h2.227v6.546c0 1.633.748 2.396 2.503 2.396 1.755 0 2.503-.763 2.503-2.396V5.932h2.228v7.004c0 2.38-1.511 3.892-4.731 3.892-3.22 0-4.73-1.526-4.73-3.907v-6.99Zm21.106 3.036c0 1.19-.687 2.106-1.602 2.503v.03c.961.138 1.45.825 1.465 1.756l.045 3.388h-2.228l-.045-3.022c-.015-.671-.412-1.083-1.206-1.083h-3.708v4.105h-2.228V5.932h6.15c2.014 0 3.357 1.022 3.357 3.037Zm-2.243.306c0-.916-.489-1.42-1.404-1.42h-3.632v2.839h3.662c.84 0 1.374-.504 1.374-1.42Zm10.67 4.242c0-.763-.489-1.083-1.221-1.144l-2.472-.229c-2.137-.198-3.251-1.038-3.251-3.068 0-2.03 1.374-3.143 3.342-3.143h5.463v1.922h-5.31c-.763 0-1.252.397-1.252 1.16 0 .763.504 1.13 1.267 1.19l2.518.214c1.908.168 3.159 1.038 3.159 3.083s-1.328 3.144-3.205 3.144h-5.707v-1.923h5.494c.717 0 1.175-.488 1.175-1.205Zm8.751-7.768c3.357 0 5.479 2.152 5.479 5.524 0 3.373-2.213 5.555-5.57 5.555-3.358 0-5.479-2.182-5.479-5.555 0-3.372 2.213-5.524 5.57-5.524Zm3.174 5.54c0-2.26-1.312-3.587-3.22-3.587-1.908 0-3.22 1.328-3.22 3.587 0 2.258 1.312 3.585 3.22 3.585 1.908 0 3.22-1.327 3.22-3.585Zm13.362-2.32c0 1.19-.686 2.106-1.602 2.503v.03c.962.138 1.45.825 1.465 1.756l.046 3.388h-2.228l-.045-3.022c-.016-.671-.413-1.083-1.206-1.083h-3.71v4.105h-2.227V5.932h6.15c2.014 0 3.357 1.022 3.357 3.037Zm-2.242.306c0-.916-.489-1.42-1.404-1.42h-3.632v2.839h3.662c.839 0 1.374-.504 1.374-1.42Z"></path></g></svg>`;

function renderActions(actions: Action[] = [], editor: Editor = "auto"): string {
  if (actions.length === 0) return "";
  if (editor !== "cursor" && editor !== "auto") return "";
  return actions
    .map(
      (action) => `
    <a href="cursor://anysphere.cursor-deeplink/prompt?text=${encodeURIComponent(action.prompt)}" class="action-btn-link">
      ${CURSOR_LOGO_SVG}
      <span>${escapeHtml(action.label)}</span>
    </a>
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
  diffStyle: DiffStyle = "side-by-side",
  globalActions: Action[] = []
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

    .action-btn-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      white-space: nowrap;
      border-radius: 6px;
      font-weight: 500;
      font-size: 14px;
      outline: none;
      transition: all 0.2s;
      text-decoration: none;
      background: #21262d;
      color: #e6edf3;
      height: 36px;
      padding: 0 16px;
      border: 1px solid rgba(240, 246, 252, 0.1);
      cursor: pointer;
    }

    .action-btn-link:hover {
      background: #30363d;
      border-color: #8b949e;
    }

    .action-btn-link:focus-visible {
      border-color: #58a6ff;
      box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.3);
    }

    .action-btn-link svg {
      pointer-events: none;
      flex-shrink: 0;
      width: 22px;
      height: 22px;
    }

    .text-foreground {
      color: #e6edf3;
    }

    .italic {
      font-style: italic;
    }

    .leading-snug {
      line-height: 1.375;
    }

    .text-sm {
      font-size: 14px;
    }

    .line-clamp-2 {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .flex {
      display: flex;
    }

    .items-center {
      align-items: center;
    }

    .justify-between {
      justify-content: space-between;
    }

    .gap-3 {
      gap: 12px;
    }

    .header-global-actions {
      display: flex;
      gap: 8px;
      margin-left: 16px;
      border-left: 1px solid #30363d;
      padding-left: 16px;
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

    .ai-annotation-actions {
      display: flex;
      gap: 8px;
      margin-top: 12px;
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
      .header { padding: 12px 16px; flex-direction: column; gap: 12px; }
      .header-left { width: 100%; justify-content: space-between; }
      .header-actions { width: 100%; justify-content: flex-end; }
      .header-global-actions { padding-left: 0; border-left: none; border-top: 1px solid #30363d; padding-top: 12px; margin-left: 0; width: 100%; justify-content: flex-start; }
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
      ${globalActions.length > 0 ? `
        <div class="header-global-actions">
          ${renderActions(globalActions, editor)}
        </div>
      ` : ''}
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
    const editor = '${editor}';
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

    const CURSOR_LOGO_SVG = '<svg fill="none" height="22" width="22" viewBox="0 0 22 22"><title class="sr-only">Cursor Logo</title><g clip-path="url(#a)" fill="currentColor"><path d="M19.162 5.452 10.698.565a.88.88 0 0 0-.879 0L1.356 5.452a.74.74 0 0 0-.37.64v9.853a.74.74 0 0 0 .37.64l8.464 4.887a.879.879 0 0 0 .879 0l8.464-4.886a.74.74 0 0 0 .37-.64V6.091a.74.74 0 0 0-.37-.64Zm-.531 1.035L10.46 20.639c-.055.095-.201.056-.201-.055v-9.266a.52.52 0 0 0-.26-.45L1.975 6.237c-.096-.056-.057-.202.054-.202h16.34c.233 0 .378.252.262.453Zm11.057-.555h3.602v1.984h-3.48c-1.877 0-3.342 1.083-3.342 3.372 0 2.29 1.465 3.373 3.342 3.373h3.48v1.984h-3.754c-3.144 0-5.372-1.847-5.372-5.356 0-3.51 2.38-5.357 5.524-5.357Zm5.432 0h2.227v6.546c0 1.633.748 2.396 2.503 2.396 1.755 0 2.503-.763 2.503-2.396V5.932h2.228v7.004c0 2.38-1.511 3.892-4.731 3.892-3.22 0-4.73-1.526-4.73-3.907v-6.99Zm21.106 3.036c0 1.19-.687 2.106-1.602 2.503v.03c.961.138 1.45.825 1.465 1.756l.045 3.388h-2.228l-.045-3.022c-.015-.671-.412-1.083-1.206-1.083h-3.708v4.105h-2.228V5.932h6.15c2.014 0 3.357 1.022 3.357 3.037Zm-2.243.306c0-.916-.489-1.42-1.404-1.42h-3.632v2.839h3.662c.84 0 1.374-.504 1.374-1.42Zm10.67 4.242c0-.763-.489-1.083-1.221-1.144l-2.472-.229c-2.137-.198-3.251-1.038-3.251-3.068 0-2.03 1.374-3.143 3.342-3.143h5.463v1.922h-5.31c-.763 0-1.252.397-1.252 1.16 0 .763.504 1.13 1.267 1.19l2.518.214c1.908.168 3.159 1.038 3.159 3.083s-1.328 3.144-3.205 3.144h-5.707v-1.923h5.494c.717 0 1.175-.488 1.175-1.205Zm8.751-7.768c3.357 0 5.479 2.152 5.479 5.524 0 3.373-2.213 5.555-5.57 5.555-3.358 0-5.479-2.182-5.479-5.555 0-3.372 2.213-5.524 5.57-5.524Zm3.174 5.54c0-2.26-1.312-3.587-3.22-3.587-1.908 0-3.22 1.328-3.22 3.587 0 2.258 1.312 3.585 3.22 3.585 1.908 0 3.22-1.327 3.22-3.585Zm13.362-2.32c0 1.19-.686 2.106-1.602 2.503v.03c.962.138 1.45.825 1.465 1.756l.046 3.388h-2.228l-.045-3.022c-.016-.671-.413-1.083-1.206-1.083h-3.71v4.105h-2.227V5.932h6.15c2.014 0 3.357 1.022 3.357 3.037Zm-2.242.306c0-.916-.489-1.42-1.404-1.42h-3.632v2.839h3.662c.839 0 1.374-.504 1.374-1.42Z"></path></g></svg>';

    // Helper to render actions HTML in JS
    function renderActions(actions) {
      if (!actions || actions.length === 0) return '';
      if (editor !== 'cursor' && editor !== 'auto') return '';
      return actions.map(action => \`
        <a href="cursor://anysphere.cursor-deeplink/prompt?text=\${encodeURIComponent(action.prompt)}" class="action-btn-link">
          \${CURSOR_LOGO_SVG}
          <span>\${escapeHtml(action.label)}</span>
        </a>
      \`).join('');
    }

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
            const lineNumbers = searchBody.querySelectorAll('.d2h-code-linenumber, .d2h-code-side-linenumber');

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

                const actionsHtml = annotation.actions ? \`<div class="ai-annotation-actions">\${renderActions(annotation.actions)}</div>\` : '';

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

    function escapeForJs(text) {
      return text
        .replace(new RegExp("\\\\\\\\", "g"), "\\\\\\\\")
        .replace(new RegExp("\\\\x60", "g"), "\\\\\\\\\\\\x60")
        .replace(new RegExp("\\\\$", "g"), "\\\\$")
        .replace(new RegExp("'", "g"), "\\\\'");
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