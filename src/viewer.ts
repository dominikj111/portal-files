/**
 * Text file viewer — self-contained read-only overlay.
 *
 * Shows file contents in a readonly textarea, with live markdown
 * preview for .md files.
 *
 * DECOUPLED: Import `openViewer(filePath, fileName)` from file-list.ts.
 * Remove that import and delete this file to strip the feature.
 */

import { logError } from './error-logger';
import { markdownToHtml } from './markdown';

// ===========================================================================
// State
// ===========================================================================

var overlay: HTMLElement | null = null;
var textarea: HTMLTextAreaElement | null = null;
var previewPane: HTMLElement | null = null;
var titleEl: HTMLElement | null = null;
var previewToggle: HTMLElement | null = null;
var previewVisible = false;

// ===========================================================================
// Helpers
// ===========================================================================

function getExtension(filename: string): string {
  var dot = filename.lastIndexOf('.');
  if (dot === -1) return '';
  return filename.substring(dot + 1).toLowerCase();
}

function isMarkdown(filename: string): boolean {
  var ext = getExtension(filename);
  return ext === 'md' || ext === 'markdown';
}

// ===========================================================================
// XHR
// ===========================================================================

function readFile(path: string, cb: (err: string | null, content?: string) => void): void {
  var cleanPath = path.replace(/^\//, '');
  var segments = cleanPath.split('/');
  var encoded: string[] = [];
  for (var i = 0; i < segments.length; i++) {
    encoded.push(encodeURIComponent(segments[i]));
  }

  var xhr = new XMLHttpRequest();
  xhr.open('GET', '/api/read/' + encoded.join('/'), true);
  xhr.onreadystatechange = function () {
    if (xhr.readyState !== 4) return;
    if (xhr.status >= 200 && xhr.status < 300) {
      try {
        var data = JSON.parse(xhr.responseText);
        cb(null, data.content || '');
      } catch (_e) {
        cb('Invalid response');
      }
    } else {
      cb('HTTP ' + xhr.status);
    }
  };
  xhr.onerror = function () {
    cb('Network error');
  };
  xhr.send();
}

// ===========================================================================
// DOM
// ===========================================================================

function injectStyles(): void {
  var style = document.createElement('style');
  style.textContent =
    '.viewer-overlay{' +
    'position:fixed;top:0;left:0;right:0;bottom:0;z-index:9997;' +
    'background:rgba(0,0,0,0.95);display:none;' +
    '}' +
    '.viewer-wrap{' +
    'display:-webkit-flex;display:flex;-webkit-flex-direction:column;flex-direction:column;' +
    'height:100%;padding:10px;' +
    '}' +
    '.viewer-toolbar{' +
    'display:-webkit-flex;display:flex;-webkit-align-items:center;align-items:center;' +
    '-webkit-flex-wrap:wrap;flex-wrap:wrap;gap:8px;margin-bottom:8px;' +
    '}' +
    '.viewer-title{color:#fff;font-size:1rem;-webkit-flex:1;flex:1;min-width:0;overflow:hidden;' +
    'text-overflow:ellipsis;white-space:nowrap;}' +
    '.viewer-btn{' +
    'padding:8px 16px;font-size:13px;border:1px solid #555;border-radius:6px;' +
    'background:#222;color:#fff;cursor:pointer;min-height:40px;' +
    '-webkit-tap-highlight-color:rgba(255,255,255,0.1);white-space:nowrap;' +
    '}' +
    '.viewer-btn:active{background:#444;}' +
    '.viewer-btn--close{border-color:#c0392b;color:#e74c3c;}' +
    '.viewer-btn--preview{border-color:#3498db;color:#5dade2;}' +
    '.viewer-btn--preview.active{background:#1a3a5c;}' +
    '.viewer-body{' +
    'display:-webkit-flex;display:flex;-webkit-flex:1;flex:1;min-height:0;gap:8px;' +
    '}' +
    '.viewer-textarea{' +
    '-webkit-flex:1;flex:1;background:#1e1e1e;color:#d4d4d4;border:1px solid #333;' +
    'border-radius:6px;padding:10px;font-family:monospace;font-size:14px;' +
    'resize:none;outline:none;-webkit-overflow-scrolling:touch;' +
    '}' +
    '.viewer-preview{' +
    '-webkit-flex:1;flex:1;background:#fff;color:#333;border:1px solid #333;' +
    'border-radius:6px;padding:14px 18px;overflow-y:auto;-webkit-overflow-scrolling:touch;' +
    'font-size:14px;line-height:1.6;display:none;' +
    '}' +
    '.viewer-preview h1,.viewer-preview h2,.viewer-preview h3{margin:0.6em 0 0.3em;}' +
    '.viewer-preview h1{font-size:1.6em;border-bottom:1px solid #ddd;padding-bottom:4px;}' +
    '.viewer-preview h2{font-size:1.3em;border-bottom:1px solid #eee;padding-bottom:3px;}' +
    '.viewer-preview h3{font-size:1.1em;}' +
    '.viewer-preview p{margin:0.5em 0;}' +
    '.viewer-preview pre{background:#f5f5f5;padding:10px;border-radius:4px;overflow-x:auto;}' +
    '.viewer-preview code{background:#f0f0f0;padding:2px 4px;border-radius:3px;font-size:0.9em;}' +
    '.viewer-preview pre code{background:none;padding:0;}' +
    '.viewer-preview blockquote{border-left:4px solid #ddd;margin:0.5em 0;padding:4px 12px;color:#666;}' +
    '.viewer-preview ul,.viewer-preview ol{margin:0.5em 0;padding-left:24px;}' +
    '.viewer-preview hr{border:none;border-top:1px solid #ddd;margin:1em 0;}' +
    '.viewer-preview img{max-width:100%;border-radius:4px;}' +
    '.viewer-preview a{color:#2980b9;}';
  document.head.appendChild(style);
}

function buildOverlay(): HTMLElement {
  var el = document.createElement('div');
  el.className = 'viewer-overlay';

  el.innerHTML =
    '<div class="viewer-wrap">' +
    '<div class="viewer-toolbar">' +
    '<div id="viewer-title" class="viewer-title"></div>' +
    '<button id="viewer-preview-toggle" class="viewer-btn viewer-btn--preview" style="display:none;" title="Toggle Preview">&#x25CE; Preview</button>' +
    '<button id="viewer-close" class="viewer-btn viewer-btn--close">&#x2716; Close</button>' +
    '</div>' +
    '<div class="viewer-body">' +
    '<textarea id="viewer-textarea" class="viewer-textarea" readonly spellcheck="false"></textarea>' +
    '<div id="viewer-preview" class="viewer-preview"></div>' +
    '</div>' +
    '</div>';

  document.body.appendChild(el);
  return el;
}

// ===========================================================================
// Preview
// ===========================================================================

function updatePreview(): void {
  if (!previewPane || !textarea || !previewVisible) return;
  previewPane.innerHTML = markdownToHtml(textarea.value);
}

function togglePreview(): void {
  previewVisible = !previewVisible;

  if (previewPane) {
    previewPane.style.display = previewVisible ? 'block' : 'none';
  }
  if (previewToggle) {
    if (previewVisible) {
      previewToggle.className = 'viewer-btn viewer-btn--preview active';
    } else {
      previewToggle.className = 'viewer-btn viewer-btn--preview';
    }
  }

  if (previewVisible) updatePreview();
}

// ===========================================================================
// Actions
// ===========================================================================

function closeViewer(): void {
  if (overlay) overlay.style.display = 'none';
  previewVisible = false;
  if (previewPane) previewPane.style.display = 'none';
  if (previewToggle) previewToggle.className = 'viewer-btn viewer-btn--preview';
}

// ===========================================================================
// Open viewer
// ===========================================================================

function ensureOverlay(): void {
  if (!overlay) {
    injectStyles();
    overlay = buildOverlay();
    textarea = document.getElementById('viewer-textarea') as HTMLTextAreaElement;
    previewPane = document.getElementById('viewer-preview');
    titleEl = document.getElementById('viewer-title');
    previewToggle = document.getElementById('viewer-preview-toggle');

    var closeBtn = document.getElementById('viewer-close');
    if (closeBtn) closeBtn.addEventListener('click', closeViewer);
    if (previewToggle) previewToggle.addEventListener('click', togglePreview);
  }
}

/** Open the viewer for a file (read-only). */
export function openViewer(filePath: string, fileName: string): void {
  ensureOverlay();

  previewVisible = false;

  if (titleEl) titleEl.textContent = '\uD83D\uDC41\uFE0F ' + fileName; // 👁️
  if (textarea) textarea.value = '';
  if (previewPane) previewPane.style.display = 'none';
  if (previewToggle) {
    previewToggle.style.display = isMarkdown(fileName) ? 'inline-block' : 'none';
    previewToggle.className = 'viewer-btn viewer-btn--preview';
  }

  if (overlay) overlay.style.display = 'block';

  readFile(filePath, function (err, content) {
    if (err) {
      if (textarea) textarea.value = 'Error: ' + err;
      logError('Read failed: ' + filePath + ' — ' + err);
    } else {
      if (textarea) textarea.value = content || '';
      // Auto-show preview for markdown
      if (isMarkdown(fileName) && previewPane) {
        previewVisible = true;
        previewPane.style.display = 'block';
        if (previewToggle) previewToggle.className = 'viewer-btn viewer-btn--preview active';
        updatePreview();
      }
    }
  });
}
