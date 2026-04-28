/**
 * embed.js — Python Snippet Widget (Trinket-style)
 * Multi-file projects, file I/O, inline input(), syntax highlighting.
 * Powered by Skulpt + CodeMirror 6. No build step required.
 */
(function () {
  'use strict';

  // Capture script URL now — document.currentScript is only available during sync execution
  const _embedScriptSrc = document.currentScript?.src || '';

  let _skulptPromise  = null;
  let _cmPromise      = null;
  let _widgetCounter  = 0;
  let _stylesInjected = false;

  const HOST_CLS = 'psw';

  // ── Skulpt loader (loads once, shared across all widgets) ──────────────────
  function getSkulpt() {
    if (_skulptPromise) return _skulptPromise;
    _skulptPromise = new Promise((resolve, reject) => {
      const s1 = document.createElement('script');
      s1.src = 'https://skulpt.org/js/skulpt.min.js';
      document.head.appendChild(s1);
      s1.onload = () => {
        const s2 = document.createElement('script');
        s2.src = 'https://skulpt.org/js/skulpt-stdlib.js';
        document.head.appendChild(s2);
        s2.onload  = () => resolve(window.Sk);
        s2.onerror = () => reject(new Error('Failed to load Skulpt stdlib'));
      };
      s1.onerror = () => reject(new Error('Failed to load Skulpt'));
    });
    return _skulptPromise;
  }

  // ── CodeMirror 6 loader ────────────────────────────────────────────────────
  function getCodeMirror() {
    if (_cmPromise) return _cmPromise;
    _cmPromise = Promise.all([
      import('https://esm.sh/codemirror@6.0.1'),
      import('https://esm.sh/@codemirror/state@6'),
      import('https://esm.sh/@codemirror/lang-python@6'),
      import('https://esm.sh/@codemirror/language@6'),
      import('https://esm.sh/@lezer/highlight@1'),
      import('https://esm.sh/@codemirror/view@6'),
    ]).then(([{ EditorView, basicSetup }, { EditorState }, { python }, { syntaxHighlighting, HighlightStyle }, { tags }, { ViewPlugin, Decoration, MatchDecorator }]) => ({
      EditorView, basicSetup, EditorState, python, syntaxHighlighting, HighlightStyle, tags,
      ViewPlugin, Decoration, MatchDecorator,
    }));
    return _cmPromise;
  }

  // ── Global styles (injected once) ─────────────────────────────────────────
  function injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    const style = document.createElement('style');
    style.textContent = `
.${HOST_CLS} { all: initial; display: block; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
.${HOST_CLS} *, .${HOST_CLS} *::before, .${HOST_CLS} *::after { box-sizing: border-box; margin: 0; padding: 0; }

.${HOST_CLS} .pw-widget {
  display: flex; flex-direction: column; height: 520px;
  border: 1px solid #d0d7de; border-radius: 8px; overflow: hidden;
  background: #fff; color: #24292e; line-height: 1.5; position: relative;
}

/* ── Turtle modal overlay ── */
.${HOST_CLS} .pw-turtle-modal {
  display: none; position: absolute; inset: 0; z-index: 200;
  flex-direction: column; background: #fff; border-radius: 8px; overflow: hidden;
}
.${HOST_CLS} .pw-turtle-modal.pw-turtle-open { display: flex; }
.${HOST_CLS} .pw-turtle-modal-hdr {
  display: flex; align-items: center; justify-content: space-between;
  padding: 6px 12px; background: #f6f8fa; border-bottom: 1px solid #d0d7de;
  font-size: 12px; font-weight: 700; letter-spacing: 0.5px; color: #57606a; flex-shrink: 0;
}
.${HOST_CLS} .pw-turtle-modal-title { text-transform: uppercase; letter-spacing: 1px; }
.${HOST_CLS} .pw-turtle-modal-close {
  padding: 4px 12px; border-radius: 6px; border: 1px solid #d0d7de;
  background: #fff; color: #24292e; font-size: 12px; cursor: pointer; font-family: inherit;
}
.${HOST_CLS} .pw-turtle-modal-close:hover { background: #f3f4f6; }
.${HOST_CLS} .pw-turtle-canvas-body {
  flex: 1; overflow: auto; display: flex; align-items: flex-start; justify-content: center; padding: 8px;
}

/* ── Toolbar ── */
.${HOST_CLS} .pw-toolbar {
  display: flex; align-items: center; gap: 10px; padding: 8px 14px;
  background: #f6f8fa; border-bottom: 1px solid #d0d7de; flex-shrink: 0;
}
.${HOST_CLS} .pw-title-area { flex: 1; overflow: hidden; min-width: 0; }
.${HOST_CLS} .pw-title { font-size: 14px; font-weight: 600; color: #24292e; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.${HOST_CLS} .pw-desc  { font-size: 11px; color: #57606a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.${HOST_CLS} .pw-btn {
  padding: 5px 14px; border-radius: 6px; border: 1px solid transparent;
  font-size: 13px; font-weight: 500; cursor: pointer; white-space: nowrap;
  flex-shrink: 0; transition: background 0.15s, opacity 0.15s; line-height: 1.5;
  font-family: inherit;
}
.${HOST_CLS} .pw-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.${HOST_CLS} .pw-btn-run  { background: #1f883d; color: #fff; border-color: #1f883d; }
.${HOST_CLS} .pw-btn-run:not(:disabled):hover  { background: #1a7f37; }
.${HOST_CLS} .pw-btn-stop { background: #cf222e; color: #fff; border-color: #cf222e; }
.${HOST_CLS} .pw-btn-stop:hover { background: #b91c1c; }
.${HOST_CLS} .pw-btn-dl    { background: #fff; color: #24292e; border-color: #d0d7de; }
.${HOST_CLS} .pw-btn-dl:not(:disabled):hover    { background: #f3f4f6; border-color: #9a9da1; }
.${HOST_CLS} .pw-btn-reset { background: #fff; color: #57606a; border-color: #d0d7de; }
.${HOST_CLS} .pw-btn-reset:not(:disabled):hover { background: #fff8c5; border-color: #d4a72c; color: #24292e; }
.${HOST_CLS} .pw-btn-embed { background: #fff; color: #0969da; border-color: #d0d7de; }
.${HOST_CLS} .pw-btn-embed:hover { background: #dbeafe; border-color: #0969da; }
.${HOST_CLS} .pw-hint     { font-size: 12px; color: #57606a; flex-shrink: 0; }
.${HOST_CLS} .pw-hint-err { color: #cf222e; }

/* ── Embed modal (appended to body, not scoped to widget) ── */
.psw-modal-overlay {
  position: fixed; inset: 0; z-index: 99999;
  background: rgba(0,0,0,0.45);
  display: flex; align-items: center; justify-content: center;
}
.psw-modal {
  background: #fff; border-radius: 10px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.22);
  padding: 24px 28px; max-width: 560px; width: calc(100% - 40px);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
.psw-modal-title { font-size: 15px; font-weight: 600; color: #24292e; margin: 0 0 4px; }
.psw-modal-sub   { font-size: 12px; color: #57606a; margin: 0 0 14px; }
.psw-modal-code {
  background: #f6f8fa; border: 1px solid #d0d7de; border-radius: 6px;
  padding: 12px 14px; font-family: Menlo, Monaco, 'Courier New', monospace;
  font-size: 12px; line-height: 1.7; color: #24292e;
  white-space: pre; overflow-x: auto; margin-bottom: 16px;
}
.psw-modal-actions { display: flex; justify-content: flex-end; gap: 10px; }
.psw-modal-btn {
  padding: 6px 16px; border-radius: 6px; border: 1px solid transparent;
  font-size: 13px; font-weight: 500; cursor: pointer; font-family: inherit;
  transition: background 0.15s;
}
.psw-modal-copy  { background: #0969da; color: #fff; border-color: #0969da; }
.psw-modal-copy:hover  { background: #0860ca; }
.psw-modal-close { background: #fff; color: #24292e; border-color: #d0d7de; }
.psw-modal-close:hover { background: #f3f4f6; }
.psw-modal-dl    { background: #1f883d; color: #fff; border-color: #1f883d; }
.psw-modal-dl:hover    { background: #1a7f37; }
/* Tabs */
.psw-modal-tabs  { display: flex; gap: 0; margin-bottom: 16px; border-bottom: 1px solid #d0d7de; }
.psw-modal-tab   {
  padding: 7px 16px; font-size: 13px; font-weight: 500; cursor: pointer;
  background: none; border: none; border-bottom: 2px solid transparent;
  color: #57606a; font-family: inherit; margin-bottom: -1px;
}
.psw-modal-tab:hover  { color: #24292e; }
.psw-modal-tab.active { color: #0969da; border-bottom-color: #0969da; }
/* JSON filename input */
.psw-modal-filename {
  width: 100%; padding: 7px 10px; border: 1px solid #d0d7de; border-radius: 6px;
  font-size: 13px; font-family: Menlo, Monaco, 'Courier New', monospace;
  color: #24292e; margin-bottom: 12px; outline: none;
}
.psw-modal-filename:focus { border-color: #0969da; box-shadow: 0 0 0 3px rgba(9,105,218,0.1); }
.psw-modal-panel { display: none; }
.psw-modal-panel.active { display: block; }

/* ── Main area ── */
.${HOST_CLS} .pw-main { display: flex; flex: 1; overflow: hidden; min-height: 0; }

/* ── File panel (sidebar) ── */
.${HOST_CLS} .pw-files {
  width: 148px; flex-shrink: 0; background: #f6f8fa;
  border-right: 1px solid #d0d7de; display: flex; flex-direction: column; overflow: hidden;
}
.${HOST_CLS} .pw-files-hdr {
  padding: 7px 10px; flex-shrink: 0;
  font-size: 10px; font-weight: 700; letter-spacing: 1px;
  text-transform: uppercase; color: #8c959f; border-bottom: 1px solid #d0d7de;
}
.${HOST_CLS} .pw-file-list { flex: 1; overflow-y: auto; }
.${HOST_CLS} .pw-file {
  display: flex; align-items: center; gap: 6px; padding: 7px 10px;
  font-size: 12px; color: #57606a; cursor: pointer;
  border-left: 2px solid transparent;
  transition: background 0.1s, color 0.1s; user-select: none;
  overflow: hidden; white-space: nowrap;
}
.${HOST_CLS} .pw-file:hover  { background: #eaeef2; color: #24292e; }
.${HOST_CLS} .pw-file.active { background: #fff; color: #0969da; border-left-color: #0969da; }
.${HOST_CLS} .pw-file-icon   { font-size: 11px; flex-shrink: 0; }
.${HOST_CLS} .pw-file-name   { overflow: hidden; text-overflow: ellipsis; }

/* ── File tabs (narrow/mobile — shown instead of sidebar) ── */
.${HOST_CLS} .pw-file-tabs {
  display: none; flex-shrink: 0; overflow-x: auto; white-space: nowrap;
  background: #f6f8fa; border-bottom: 1px solid #d0d7de;
  scrollbar-width: none;
}
.${HOST_CLS} .pw-file-tabs::-webkit-scrollbar { display: none; }
.${HOST_CLS} .pw-file-tab {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 8px 14px; font-size: 12px; color: #57606a; cursor: pointer;
  border-bottom: 2px solid transparent; user-select: none;
  transition: color 0.1s;
}
.${HOST_CLS} .pw-file-tab:hover  { color: #24292e; }
.${HOST_CLS} .pw-file-tab.active { color: #0969da; border-bottom-color: #0969da; background: #fff; }

/* ── Narrow mode (set via ResizeObserver when width < 520px) ── */
.${HOST_CLS}.pw-narrow .pw-toolbar { gap: 6px; padding: 8px 10px; flex-wrap: wrap; }
.${HOST_CLS}.pw-narrow .pw-btn     { padding: 7px 10px; font-size: 13px; }
.${HOST_CLS}.pw-narrow .pw-btn-dl-label    { display: none; }
.${HOST_CLS}.pw-narrow .pw-btn-reset-label { display: none; }
.${HOST_CLS}.pw-narrow .pw-btn-embed-label { display: none; }
.${HOST_CLS}.pw-narrow .pw-files     { display: none; }
.${HOST_CLS}.pw-narrow .pw-file-tabs { display: block; }

/* ── Editor section ── */
.${HOST_CLS} .pw-editor-section { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }
.${HOST_CLS} .pw-editor-area   { flex: 1; min-height: 0; position: relative; }
.${HOST_CLS} .pw-editor-area .cm-editor  { position: absolute; inset: 0; font-size: 12px !important; }
.${HOST_CLS} .pw-editor-area .cm-scroller {
  font-family: Menlo, Monaco, 'Courier New', Courier, monospace !important;
  overflow: auto !important;
}
/* Python built-in names — purple like IDLE */
.${HOST_CLS} .pw-editor-area .cm-py-builtin { color: #900090; }
/* Light editor tweaks */
.${HOST_CLS} .pw-editor-area .cm-gutters       { background: #f6f8fa !important; border-right: 1px solid #d0d7de !important; color: #8c959f !important; }
.${HOST_CLS} .pw-editor-area .cm-activeLine    { background: #f3f8ff !important; }
.${HOST_CLS} .pw-editor-area .cm-activeLineGutter { background: #dce9f7 !important; }

/* ── Output resize handle ── */
.${HOST_CLS} .pw-output-resize {
  height: 6px; flex-shrink: 0; cursor: ns-resize;
  background: #d0d7de; position: relative; transition: background 0.15s;
  touch-action: none;
}
.${HOST_CLS} .pw-output-resize:hover { background: #0969da; }
.${HOST_CLS} .pw-output-resize::after {
  content: ''; position: absolute; left: 50%; top: 50%;
  transform: translate(-50%, -50%);
  width: 32px; height: 2px; background: #fff; border-radius: 2px; opacity: 0.7;
}

/* ── Output / terminal panel (IDLE-style white shell) ── */
.${HOST_CLS} .pw-output {
  height: 200px; flex-shrink: 0;
  display: flex; flex-direction: column; background: #fff; overflow: hidden;
}
.${HOST_CLS} .pw-output-hdr {
  display: flex; align-items: center; justify-content: space-between;
  padding: 4px 12px; flex-shrink: 0;
  background: #f6f8fa; border-bottom: 1px solid #d0d7de;
  font-size: 10px; font-weight: 700; letter-spacing: 1px;
  text-transform: uppercase; color: #8c959f;
}
.${HOST_CLS} .pw-clear-btn {
  background: none; border: none; color: #8c959f; cursor: pointer;
  font-size: 11px; padding: 0 2px; font-family: inherit;
}
.${HOST_CLS} .pw-clear-btn:hover { color: #24292e; }
.${HOST_CLS} .pw-output-body { flex: 1; overflow-y: auto; padding: 10px 14px; background: #fff; }
.${HOST_CLS} .pw-output-pre {
  margin: 0; font-family: 'Courier New', Courier, monospace;
  font-size: 14px; line-height: 1.6; color: #24292e;
  white-space: pre-wrap; word-break: break-word;
}
.${HOST_CLS} .pw-err   { color: #cf222e; }
.${HOST_CLS} .pw-muted { color: #8c959f; font-style: italic; }

/* ── IDLE-style inline input ── */
.${HOST_CLS} .pw-input-line {
  display: flex; align-items: baseline;
  font-family: 'Courier New', Courier, monospace;
  font-size: 14px; line-height: 1.6; color: #24292e;
  white-space: pre;
}
.${HOST_CLS} .pw-input-field {
  flex: 1; min-width: 2px;
  background: transparent; border: none; outline: none;
  color: #24292e; caret-color: #24292e;
  font-family: 'Courier New', Courier, monospace;
  font-size: 14px; line-height: 1.6;
  padding: 0; margin: 0;
}
.${HOST_CLS} .pw-input-field::selection { background: #c0c0c0; }

/* ── Fullscreen button (toolbar) ── */
.${HOST_CLS} .pw-fullscreen-btn {
  padding: 5px 10px; border-radius: 6px; border: 1px solid #d0d7de;
  background: #fff; color: #57606a; cursor: pointer; flex-shrink: 0;
  font-size: 14px; line-height: 1; transition: background 0.15s, color 0.15s;
  font-family: inherit;
}
.${HOST_CLS} .pw-fullscreen-btn:hover { background: #eaeef2; color: #24292e; }

/* ── Fullscreen state ── */
.${HOST_CLS}.pw-is-fullscreen {
  position: fixed !important; inset: 0 !important;
  z-index: 99998 !important; width: 100% !important; height: 100% !important;
  border-radius: 0 !important; margin: 0 !important;
}
.${HOST_CLS}.pw-is-fullscreen .pw-widget {
  height: 100% !important; border-radius: 0 !important; border: none !important;
}

/* ── Loading/error overlay ── */
.${HOST_CLS} .pw-state {
  display: flex; align-items: center; justify-content: center;
  height: 100%; font-size: 13px; color: #57606a; padding: 20px;
}
.${HOST_CLS} .pw-state-err { color: #cf222e; }
    `;
    document.head.appendChild(style);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function esc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function normalizeFiles(snippet) {
    if (Array.isArray(snippet.files) && snippet.files.length) return snippet.files;
    return [{ name: 'main.py', content: snippet.code || '' }];
  }
  function fileIcon(name) {
    if (name.endsWith('.py'))   return '🐍';
    if (name.endsWith('.csv'))  return '📊';
    if (name.endsWith('.json')) return '📋';
    return '📄';
  }
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls)  e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  /** Format a Skulpt exception into a readable string, adjusting for preamble. */
  function formatSkulptError(e, preambleLines) {
    let type = 'Error', msg = '', line = null;
    try { type = e.tp$name || type; }           catch(_) {}
    try { msg  = e.args.v[0].v || ''; }         catch(_) {}
    try {
      const tbs = e.traceback || [];
      const tb  = tbs[tbs.length - 1];
      if (tb && tb.lineno > preambleLines) line = tb.lineno - preambleLines;
    } catch(_) {}
    return `${type}: ${msg}` + (line ? ` (line ${line})` : '');
  }

  /** Read Skulpt's _vfs_written dict back into JS after a run. */
  function readSkulptWritten() {
    const result = {};
    try {
      const pyDict = window.Sk?.globals?.['_vfs_written'];
      if (!pyDict || !pyDict.tp$iter) return result;
      const iter = pyDict.tp$iter();
      let key;
      while ((key = iter.tp$iternext()) !== undefined) {
        const val = pyDict.mp$subscript(key);
        if (typeof key.v === 'string' && typeof val.v === 'string')
          result[key.v] = val.v;
      }
    } catch(_) {}
    return result;
  }

  // ── Widget initializer ─────────────────────────────────────────────────────
  async function initWidget(hostEl) {
    const dataSrc = hostEl.dataset.src;
    if (!dataSrc || hostEl._pySnippetInit) return;
    hostEl._pySnippetInit = true;

    injectStyles();
    const widgetId = ++_widgetCounter;
    hostEl.classList.add(HOST_CLS);
    hostEl.style.display = 'block';

    const widget = el('div', 'pw-widget');
    widget.innerHTML = '<div class="pw-state">Loading…</div>';
    hostEl.appendChild(widget);

    let snippet, cm;
    try {
      [snippet, cm] = await Promise.all([
        fetch(dataSrc).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
        getCodeMirror(),
      ]);
    } catch (e) {
      widget.innerHTML = `<div class="pw-state pw-state-err">⚠ ${esc(e.message)}</div>`;
      return;
    }

    const { EditorView, basicSetup, EditorState, python, syntaxHighlighting, HighlightStyle, tags,
            ViewPlugin, Decoration, MatchDecorator } = cm;

    // ── Python built-in highlighter (MatchDecorator) ──────────────────────────
    // lezer-python cannot distinguish built-in calls from user-defined calls via
    // syntax tags alone, so we explicitly match the known built-in names.
    const PY_BUILTINS = /\b(abs|all|any|ascii|bin|bool|bytearray|bytes|callable|chr|classmethod|compile|complex|delattr|dict|dir|divmod|enumerate|eval|exec|filter|float|format|frozenset|getattr|globals|hasattr|hash|hex|id|input|int|isinstance|issubclass|iter|len|list|locals|map|max|memoryview|min|next|object|oct|open|ord|pow|print|property|range|repr|reversed|round|set|setattr|slice|sorted|staticmethod|str|sum|super|tuple|type|vars|zip)\b/g;
    const builtinDeco      = Decoration.mark({ class: 'cm-py-builtin' });
    const builtinDecorator = new MatchDecorator({ regexp: PY_BUILTINS, decoration: builtinDeco });
    const builtinHighlighter = ViewPlugin.fromClass(class {
      constructor(view) { this.decorations = builtinDecorator.createDeco(view); }
      update(u)         { this.decorations = builtinDecorator.updateDeco(u, this.decorations); }
    }, { decorations: v => v.decorations });
    const files = normalizeFiles(snippet);

    // ── Build UI ──────────────────────────────────────────────────────────────
    widget.innerHTML = '';

    // Toolbar
    const toolbar = el('div', 'pw-toolbar');
    const titleArea = el('div', 'pw-title-area');
    if (snippet.title)       titleArea.appendChild(el('div', 'pw-title', snippet.title));
    if (snippet.description) titleArea.appendChild(el('div', 'pw-desc',  snippet.description));
    const runBtn = el('button', 'pw-btn pw-btn-run', '▶ Run');
    runBtn.disabled = true;
    runBtn.title = 'Run main.py  (Ctrl+Enter)';

    const dlBtn = el('button', 'pw-btn pw-btn-dl');
    dlBtn.title = 'Download active file';
    dlBtn.innerHTML = '↓ <span class="pw-btn-dl-label">Download</span>';

    const resetBtn = el('button', 'pw-btn pw-btn-reset');
    resetBtn.title = 'Restore all files to their original state';
    resetBtn.innerHTML = '↺ <span class="pw-btn-reset-label">Reset</span>';

    const embedBtn = el('button', 'pw-btn pw-btn-embed');
    embedBtn.title = 'Get embed code for this snippet';
    embedBtn.innerHTML = '&lt;/&gt; <span class="pw-btn-embed-label">Embed</span>';
    const fsBtn = el('button', 'pw-fullscreen-btn', '⛶');
    fsBtn.title = 'Fullscreen';
    const hint = el('span', 'pw-hint', 'Loading Python…');
    toolbar.append(titleArea, runBtn, dlBtn, resetBtn, embedBtn, fsBtn, hint);
    widget.appendChild(toolbar);

    // Main area
    const mainArea = el('div', 'pw-main');
    widget.appendChild(mainArea);

    // File panel
    const filePanel = el('div', 'pw-files');
    filePanel.appendChild(el('div', 'pw-files-hdr', 'Files'));
    const fileList = el('div', 'pw-file-list');
    filePanel.appendChild(fileList);
    mainArea.appendChild(filePanel);

    // Editor section + output
    const editorSection = el('div', 'pw-editor-section');
    const fileTabs      = el('div', 'pw-file-tabs');   // shown only in narrow mode
    editorSection.appendChild(fileTabs);
    const editorArea    = el('div', 'pw-editor-area');
    editorSection.appendChild(editorArea);

    const outputPanel = el('div', 'pw-output');
    const outputHdr   = el('div', 'pw-output-hdr');
    const clearBtn    = el('button', 'pw-clear-btn', 'Clear');
    outputHdr.append(el('span', '', 'Output'), clearBtn);
    const outputBody  = el('div', 'pw-output-body');
    const outputPre   = el('pre', 'pw-output-pre');
    outputBody.appendChild(outputPre);
    outputPanel.append(outputHdr, outputBody);

    const outputResizeHandle = el('div', 'pw-output-resize');
    editorSection.appendChild(outputResizeHandle);
    editorSection.appendChild(outputPanel);

    // ── Turtle modal ──────────────────────────────────────────────────────────
    const turtleModal      = el('div', 'pw-turtle-modal');
    const turtleModalHdr   = el('div', 'pw-turtle-modal-hdr');
    const turtleModalTitle = el('span', 'pw-turtle-modal-title', 'Canvas');
    const turtleCloseBtn   = el('button', 'pw-turtle-modal-close', '✕ Close');
    turtleModalHdr.append(turtleModalTitle, turtleCloseBtn);
    const turtleCanvasBody = el('div', 'pw-turtle-canvas-body');
    turtleModal.append(turtleModalHdr, turtleCanvasBody);
    widget.appendChild(turtleModal);
    mainArea.appendChild(editorSection);


    // ── File state management ─────────────────────────────────────────────────
    const fileStates = new Map();
    const fileItems  = new Map();
    let currentFile  = null;

    // IDLE-style editor theme — Menlo font, exact IDLE colours
    const IDLE_FONT = "Menlo, Monaco, 'Courier New', Courier, monospace";
    const lightTheme = EditorView.theme({
      '&': {
        backgroundColor: '#ffffff',
        color: '#000000',
        height: '100%',
        fontSize: '12px',
        fontFamily: IDLE_FONT,
      },
      '.cm-content':          { caretColor: '#000000', fontFamily: IDLE_FONT },
      '.cm-cursor':           { borderLeftColor: '#000000', borderLeftWidth: '2px' },
      '.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection':
                              { backgroundColor: '#c0c0ff !important' },
      '.cm-gutters':          { backgroundColor: '#f2f2f2', color: '#aaa', borderRight: '1px solid #ddd', fontFamily: IDLE_FONT },
      '.cm-activeLine':       { backgroundColor: '#ffffcc' },
      '.cm-activeLineGutter': { backgroundColor: '#fffaaa' },
      '.cm-matchingBracket':  { backgroundColor: '#e0e0e0', outline: 'none' },
    }, { dark: false });

    // Exact IDLE Python syntax colours:
    //   keywords            → bold orange   #FF7700
    //   def/class names     → blue          #0000FF
    //   built-ins           → purple        #900090
    //   strings             → green         #008000
    //   comments            → red           #DD0000  (italic)
    //   True/False/None/self→ orange        #FF7700
    //   numbers             → black         #000000
    const idleHighlight = syntaxHighlighting(HighlightStyle.define([
      // Strings (all variants)
      { tag: [tags.string, tags.special(tags.string), tags.docString],
        color: '#008000' },
      // Comments
      { tag: [tags.comment, tags.lineComment, tags.blockComment],
        color: '#DD0000', fontStyle: 'italic' },
      // def / class / import / from / as / with / in / return etc.
      { tag: [tags.keyword, tags.controlKeyword, tags.operatorKeyword,
              tags.moduleKeyword, tags.definitionKeyword],
        color: '#FF7700', fontWeight: 'bold' },
      // True, False, None, self
      { tag: [tags.bool, tags.null, tags.self, tags.atom],
        color: '#FF7700' },
      // Function and class definition names (the name right after def/class)
      { tag: tags.definition(tags.variableName),
        color: '#0000FF' },
      { tag: tags.definition(tags.name),
        color: '#0000FF' },
      // Built-in names handled separately via builtinHighlighter (MatchDecorator)
      // Numbers
      { tag: [tags.number, tags.integer, tags.float],
        color: '#000000' },
      // Operators and punctuation — plain black
      { tag: [tags.operator, tags.punctuation, tags.bracket, tags.derefOperator,
              tags.arithmeticOperator, tags.compareOperator, tags.bitwiseOperator,
              tags.logicOperator, tags.updateOperator, tags.typeOperator],
        color: '#000000' },
    ]));

    function makeState(name, content) {
      return EditorState.create({
        doc: content,
        extensions: [
          basicSetup,
          lightTheme,
          idleHighlight,
          builtinHighlighter,
          ...(name.endsWith('.py') ? [python()] : []),
        ],
      });
    }
    function getContent(name) {
      if (name === currentFile) return editor.state.doc.toString();
      return fileStates.get(name)?.doc.toString() ?? '';
    }
    function setContent(name, newContent) {
      if (newContent === getContent(name)) return;
      if (name === currentFile) {
        editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: newContent } });
        fileStates.set(name, editor.state);
      } else {
        fileStates.set(name, makeState(name, newContent));
      }
    }

    const fileTabItems = new Map();

    for (const f of files) {
      fileStates.set(f.name, makeState(f.name, f.content ?? ''));

      // Sidebar item
      const item = el('div', 'pw-file');
      item.title = f.name;
      item.innerHTML = `<span class="pw-file-icon">${fileIcon(f.name)}</span><span class="pw-file-name">${esc(f.name)}</span>`;
      item.addEventListener('click', () => switchToFile(f.name));
      fileList.appendChild(item);
      fileItems.set(f.name, item);

      // Tab item (narrow mode)
      const tab = el('div', 'pw-file-tab');
      tab.innerHTML = `<span>${fileIcon(f.name)}</span><span>${esc(f.name)}</span>`;
      tab.addEventListener('click', () => switchToFile(f.name));
      fileTabs.appendChild(tab);
      fileTabItems.set(f.name, tab);
    }

    const editor = new EditorView({
      state: EditorState.create({ doc: '' }),
      parent: editorArea,
    });

    function switchToFile(name) {
      if (currentFile) fileStates.set(currentFile, editor.state);
      fileItems.get(currentFile)?.classList.remove('active');
      fileTabItems.get(currentFile)?.classList.remove('active');
      currentFile = name;
      fileItems.get(name)?.classList.add('active');
      fileTabItems.get(name)?.classList.add('active');
      editor.setState(fileStates.get(name) ?? makeState(name, ''));
    }

    const firstFile = files.find(f => f.name === 'main.py') ?? files[0];
    if (firstFile) switchToFile(firstFile.name);

    // ── Output helpers ────────────────────────────────────────────────────────
    function clearOutput() {
      outputPre.innerHTML = '<span class="pw-muted">Run your code to see output here.</span>';
      outputBody.querySelectorAll('.pw-input-row').forEach(r => r.remove());
    }
    function appendOut(text, isErr) {
      outputPre.querySelector('.pw-muted')?.remove();
      const s = el('span', isErr ? 'pw-err' : '');
      s.textContent = text;
      outputPre.appendChild(s);
      outputBody.scrollTop = outputBody.scrollHeight;
    }

    clearOutput();
    clearBtn.addEventListener('click', clearOutput);

    // ── Output panel resize ───────────────────────────────────────────────────
    // A full-page overlay captures all pointer events during the drag so the
    // handle keeps working even when the cursor leaves the resize strip.
    outputResizeHandle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const startY = e.clientY;
      const startH = outputPanel.offsetHeight;

      const overlay = document.createElement('div');
      overlay.style.cssText =
        'position:fixed;inset:0;z-index:99999;cursor:ns-resize;user-select:none;';
      document.body.appendChild(overlay);

      overlay.addEventListener('pointermove', (e) => {
        const newH = Math.max(60, Math.min(800, startH + (e.clientY - startY)));
        outputPanel.style.height = newH + 'px';
      });
      const endDrag = () => overlay.remove();
      overlay.addEventListener('pointerup',     endDrag, { once: true });
      overlay.addEventListener('pointercancel', endDrag, { once: true });
    });

    // ── Fullscreen toggle (uses browser Fullscreen API — works in iframes) ───
    function applyFullscreenState(isFs) {
      hostEl.classList.toggle('pw-is-fullscreen', isFs);
      fsBtn.textContent = isFs ? '✕' : '⛶';
      fsBtn.title       = isFs ? 'Exit fullscreen' : 'Fullscreen';
      document.body.style.overflow = isFs ? 'hidden' : '';
      editor.requestMeasure();
    }

    function toggleFullscreen() {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {
          // Fallback for browsers/contexts that block the Fullscreen API
          applyFullscreenState(!hostEl.classList.contains('pw-is-fullscreen'));
        });
      }
    }

    document.addEventListener('fullscreenchange', () => {
      applyFullscreenState(!!document.fullscreenElement);
    });

    fsBtn.addEventListener('click', toggleFullscreen);

    editorArea.addEventListener('keydown', e => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (!runBtn.disabled) runCode();
      }
    });

    dlBtn.addEventListener('click', () => {
      const blob = new Blob([getContent(currentFile)], { type: 'text/plain' });
      const url  = URL.createObjectURL(blob);
      const a    = Object.assign(document.createElement('a'), { href: url, download: currentFile ?? 'code.py' });
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 500);
    });

    // Store originals once at load time
    const originalContents = new Map(files.map(f => [f.name, f.content ?? '']));

    resetBtn.addEventListener('click', () => {
      for (const [name, content] of originalContents) {
        setContent(name, content);
      }
      // Re-activate the current file so the editor refreshes
      const active = currentFile;
      currentFile = null;
      switchToFile(active ?? firstFile?.name);
      clearOutput();
    });

    embedBtn.addEventListener('click', () => {
      // ── iframe embed code ────────────────────────────────────────────────────
      const base = _embedScriptSrc
        ? _embedScriptSrc.replace(/\/embed\.js$/, '')
        : 'https://USERNAME.github.io/REPO';
      const shortSrc  = dataSrc.replace(/^(https?:\/\/[^/]+\/[^/]+\/)?snippets\//, '');
      const viewerUrl = `${base}/viewer.html?src=${encodeURIComponent(shortSrc)}`;
      const iframeCode = `<iframe\n  src="${viewerUrl}"\n  width="100%"\n  height="540"\n  style="border:none;border-radius:8px;"\n  loading="lazy"\n  allowfullscreen\n></iframe>`;

      // ── Suggest a filename from the snippet title ────────────────────────────
      const defaultFilename = (snippet.title || 'my_snippet')
        .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') + '.json';

      // ── Build modal ──────────────────────────────────────────────────────────
      const overlay = document.createElement('div');
      overlay.className = 'psw-modal-overlay';
      overlay.innerHTML = `
        <div class="psw-modal" role="dialog" aria-modal="true">
          <p class="psw-modal-title">Export / Embed</p>

          <div class="psw-modal-tabs">
            <button class="psw-modal-tab active" data-tab="iframe">iframe Embed</button>
            <button class="psw-modal-tab"        data-tab="json">Create JSON file</button>
          </div>

          <!-- Tab: iframe -->
          <div class="psw-modal-panel active" data-panel="iframe">
            <p class="psw-modal-sub">Paste this into any HTML page — no extra script tag needed.</p>
            <div class="psw-modal-code">${iframeCode.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
            <div class="psw-modal-actions">
              <button class="psw-modal-btn psw-modal-close">Close</button>
              <button class="psw-modal-btn psw-modal-copy">Copy</button>
            </div>
          </div>

          <!-- Tab: JSON -->
          <div class="psw-modal-panel" data-panel="json">
            <p class="psw-modal-sub">Downloads the current editor contents as a JSON snippet file ready to upload to GitHub.</p>
            <input class="psw-modal-filename" type="text" value="${defaultFilename}" spellcheck="false" />
            <div class="psw-modal-actions">
              <button class="psw-modal-btn psw-modal-close">Close</button>
              <button class="psw-modal-btn psw-modal-dl">Download JSON</button>
            </div>
          </div>
        </div>`;
      document.body.appendChild(overlay);

      // ── Tab switching ────────────────────────────────────────────────────────
      overlay.querySelectorAll('.psw-modal-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          overlay.querySelectorAll('.psw-modal-tab').forEach(t => t.classList.remove('active'));
          overlay.querySelectorAll('.psw-modal-panel').forEach(p => p.classList.remove('active'));
          tab.classList.add('active');
          overlay.querySelector(`.psw-modal-panel[data-panel="${tab.dataset.tab}"]`).classList.add('active');
        });
      });

      // ── Close ────────────────────────────────────────────────────────────────
      const closeModal = () => overlay.remove();
      overlay.querySelectorAll('.psw-modal-close').forEach(btn => {
        btn.addEventListener('click', closeModal);
      });
      overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

      // ── Copy iframe code ─────────────────────────────────────────────────────
      const copyBtn = overlay.querySelector('.psw-modal-copy');
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(iframeCode).then(() => {
          copyBtn.textContent = 'Copied!';
          setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
        }).catch(() => {
          const ta = document.createElement('textarea');
          ta.value = iframeCode;
          ta.style.position = 'fixed'; ta.style.opacity = '0';
          document.body.appendChild(ta); ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          copyBtn.textContent = 'Copied!';
          setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
        });
      });

      // ── Download JSON ────────────────────────────────────────────────────────
      overlay.querySelector('.psw-modal-dl').addEventListener('click', () => {
        // Build snippet JSON from current editor contents
        const currentFiles = files.map(f => ({
          name:    f.name,
          content: getContent(f.name),
        }));
        const jsonSnippet = {
          ...(snippet.title       ? { title:       snippet.title }       : {}),
          ...(snippet.description ? { description: snippet.description } : {}),
          files: currentFiles,
        };
        const jsonText = JSON.stringify(jsonSnippet, null, 2);
        const filename = overlay.querySelector('.psw-modal-filename').value.trim() || defaultFilename;
        const blob = new Blob([jsonText], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 500);
      });
    });

    // ── Responsive: narrow mode via ResizeObserver ────────────────────────────
    const ro = new ResizeObserver(entries => {
      const width = entries[0].contentRect.width;
      hostEl.classList.toggle('pw-narrow', width < 520);
    });
    ro.observe(hostEl);

    // ── Skulpt: start loading immediately in background ───────────────────────
    const skulptPromise = getSkulpt();
    skulptPromise.then(() => {
      hint.textContent = '';
      runBtn.disabled  = false;
    }).catch(() => {
      hint.className   = 'pw-hint pw-hint-err';
      hint.textContent = '⚠ Python failed to load';
    });

    runBtn.addEventListener('click', runCode);

    // ── Stop support ──────────────────────────────────────────────────────────
    let _stopRequested  = false;
    let _dismissInput   = null;   // call to cancel a pending input() prompt

    function requestStop() {
      _stopRequested = true;
      // Trigger Skulpt's built-in time-limit error (already exceeded)
      try { window.Sk.execLimit = 1; } catch(_) {}
      // Dismiss any waiting input field
      if (_dismissInput) { _dismissInput(); _dismissInput = null; }
    }

    // ── IDLE-style inline input ───────────────────────────────────────────────
    function showInlineInput(prompt) {
      return new Promise(resolve => {
        if (_stopRequested) { resolve(''); return; }

        // Render: "prompt text" + invisible-background input field on same line
        const line  = el('div', 'pw-input-line');
        if (prompt) {
          const span = el('span', '');
          span.textContent = prompt;
          line.appendChild(span);
        }
        const field = el('input', 'pw-input-field');
        field.type = 'text';
        field.setAttribute('autocomplete', 'off');
        field.setAttribute('spellcheck',   'false');
        field.setAttribute('autocorrect',  'off');
        field.size = 40;
        line.appendChild(field);

        outputPre.querySelector('.pw-muted')?.remove();
        outputPre.appendChild(line);
        outputBody.scrollTop = outputBody.scrollHeight;
        field.focus();

        function commit(val) {
          _dismissInput = null;
          const committed = el('span', '');
          committed.textContent = (prompt || '') + val + '\n';
          outputPre.replaceChild(committed, line);
          outputBody.scrollTop = outputBody.scrollHeight;
          resolve(val);
        }

        // Allow stop to dismiss the input field
        _dismissInput = () => { line.remove(); resolve(''); };

        field.addEventListener('keydown', e => {
          if (e.key === 'Enter') { e.preventDefault(); commit(field.value); }
        });
      });
    }

    // ── Run code ──────────────────────────────────────────────────────────────
    async function runCode() {
      // Switch to Stop mode
      _stopRequested = false;
      runBtn.textContent = '⏹ Stop';
      runBtn.classList.replace('pw-btn-run', 'pw-btn-stop');
      runBtn.removeEventListener('click', runCode);
      runBtn.addEventListener('click', requestStop, { once: true });
      clearOutput();
      // Reset turtle modal
      turtleCanvasBody.innerHTML = '';
      turtleModal.classList.remove('pw-turtle-open');
      turtleCloseBtn.textContent = '✕ Close';

      const mainFile = files.find(f => f.name === 'main.py') ?? files.find(f => f.name.endsWith('.py'));
      if (!mainFile) {
        appendOut('No Python (.py) file found in this project.', true);
        runBtn.disabled = false; runBtn.textContent = '▶ Run';
        return;
      }

      // Declared outside try so catch/finally blocks can access them
      let turtleAnimId  = null;
      let skulptTarget  = null;
      let preambleLines = 36;   // updated inside try; fallback if error occurs before preamble

      try {
        const Sk = await skulptPromise;

        // Snapshot of all project files for this run
        const vfs = {};
        for (const f of files) vfs[f.name] = getContent(f.name);

        // ── Turtle detection ───────────────────────────────────────────────
        const allCode = Object.values(vfs).join('\n');
        const TW = 400, TH = 400;
        const usesTurtle = /\bimport\s+turtle\b|from\s+turtle\s+import/.test(allCode);
        if (usesTurtle) {
          // Hidden off-screen div for Skulpt to render into
          skulptTarget = document.createElement('div');
          skulptTarget.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:' + TW + 'px;height:' + TH + 'px;';
          document.body.appendChild(skulptTarget);

          // Single visible merged canvas
          const mergedCanvas = document.createElement('canvas');
          mergedCanvas.width  = TW;
          mergedCanvas.height = TH;
          mergedCanvas.style.display = 'block';
          turtleCanvasBody.appendChild(mergedCanvas);
          const mergedCtx = mergedCanvas.getContext('2d');

          // rAF loop: composite Skulpt's layered canvases onto the merged canvas
          const compose = () => {
            const layers = skulptTarget.querySelectorAll('canvas');
            mergedCtx.clearRect(0, 0, TW, TH);
            mergedCtx.fillStyle = '#fff';
            mergedCtx.fillRect(0, 0, TW, TH);
            layers.forEach(c => mergedCtx.drawImage(c, 0, 0));
            turtleAnimId = requestAnimationFrame(compose);
          };
          turtleAnimId = requestAnimationFrame(compose);

          turtleModal.classList.add('pw-turtle-open');
          turtleCloseBtn.textContent = '⏹ Stop';
          turtleCloseBtn.onclick = () => { requestStop(); };
        }

        // Build a Python dict literal for the VFS
        const vfsPyLiteral = '{\n' +
          Object.entries(vfs).map(([k, v]) =>
            '    ' + JSON.stringify(k) + ': ' + JSON.stringify(v)
          ).join(',\n') + '\n}';

        // ── File I/O preamble ──────────────────────────────────────────────
        // Defines a virtual open() that reads from / writes to vfs.
        // _vfs_written is populated on file.close() for write/append modes.
        const preamble = `_vfs = ${vfsPyLiteral}
_vfs_written = {}

class _VF:
    def __init__(self, name, mode):
        self.name = name
        self.mode = 'a' if mode.startswith('a') else ('w' if mode.startswith('w') else 'r')
        raw = _vfs.get(name, '')
        self._buf = raw if self.mode == 'a' else ''
        self._lines = raw.splitlines(True)
        self._lpos = 0
    def read(self, n=-1):
        s = _vfs.get(self.name, '')
        return s if n < 0 else s[:n]
    def readline(self):
        if self._lpos < len(self._lines):
            l = self._lines[self._lpos]; self._lpos += 1; return l
        return ''
    def readlines(self): return list(self._lines[self._lpos:])
    def write(self, s): self._buf += str(s); return len(str(s))
    def writelines(self, ls):
        for l in ls: self.write(l)
    def close(self):
        if self.mode in ('w', 'a'):
            _vfs[self.name] = self._buf
            _vfs_written[self.name] = self._buf
    def __iter__(self): return self
    def __next__(self):
        line = self.readline()
        if line == '': raise StopIteration
        return line
    def __enter__(self): return self
    def __exit__(self, *a): self.close(); return False

def open(name, mode='r', *args, **kwargs):
    nm = str(name); m = mode.rstrip('+b ')
    if nm in _vfs or m.startswith('w') or m.startswith('a'):
        return _VF(nm, m)
    raise IOError('File not found: ' + nm)

# Python 3 aliases not present in this Skulpt build
FileNotFoundError = IOError
PermissionError   = IOError
IsADirectoryError = IOError

`;
        preambleLines = preamble.split('\n').length;

        // ── Configure Skulpt ───────────────────────────────────────────────
        Sk.TurtleGraphics = {
          target: skulptTarget || undefined,
          width:  TW,
          height: TH
        };

        Sk.configure({
          output: (text) => appendOut(text, false),
          inputfun: (prompt) => showInlineInput(prompt),
          inputfunTakesPrompt: true,
          read: (filename) => {
            // Serve project files (for inter-module imports)
            const clean = filename.replace(/^\.\//, '');
            if (vfs[clean] !== undefined) return vfs[clean];
            // Skulpt stdlib
            if (Sk.builtinFiles?.files?.[filename] !== undefined)
              return Sk.builtinFiles.files[filename];
            throw new Error(`File not found: '${filename}'`);
          },
          __future__: Sk.python3,
        });

        // Prepend preamble to main.py for this run only
        const codeToRun = preamble + getContent(mainFile.name);

        await Sk.misceval.asyncToPromise(() =>
          Sk.importMainWithBody('<stdin>', false, codeToRun, true)
        );

        // Sync any files Python wrote back into the editor
        const written = readSkulptWritten();
        for (const [name, content] of Object.entries(written)) {
          if (files.some(f => f.name === name)) setContent(name, content);
        }

        // Show "(no output)" if output panel is empty
        if (!outputPre.textContent.trim() || outputPre.querySelector('.pw-muted')) {
          outputPre.innerHTML = '';
          outputPre.appendChild(el('span', 'pw-muted', '(no output)'));
        }

      } catch (e) {
        if (_stopRequested || e.tp$name === 'TimeLimitError') {
          appendOut('\n[Stopped]', false);
        } else {
          appendOut(formatSkulptError(e, preambleLines), true);
        }
      } finally {
        _stopRequested = false;
        try { window.Sk.execLimit = undefined; } catch(_) {}
        // Restore Run button
        runBtn.removeEventListener('click', requestStop);
        runBtn.classList.replace('pw-btn-stop', 'pw-btn-run');
        runBtn.textContent = '▶ Run';
        runBtn.addEventListener('click', runCode);
        // Stop compositing loop, clean up hidden Skulpt target
        if (turtleAnimId) { cancelAnimationFrame(turtleAnimId); turtleAnimId = null; }
        if (skulptTarget) { skulptTarget.remove(); skulptTarget = null; }
        // Switch modal button to Close
        if (turtleModal.classList.contains('pw-turtle-open')) {
          turtleCloseBtn.textContent = '✕ Close';
          turtleCloseBtn.onclick = () => {
            turtleModal.classList.remove('pw-turtle-open');
            turtleCanvasBody.innerHTML = '';
          };
        }
      }
    }
  }

  // ── Auto-discover all .py-snippet elements on the page ─────────────────────
  function initAll() {
    document.querySelectorAll('.py-snippet[data-src]').forEach(el => initWidget(el));
  }

  // Expose for pages that add widgets dynamically after DOMContentLoaded
  window._pySnippetInitAll = initAll;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAll);
  else initAll();
})();
