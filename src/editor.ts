/**
 * Text file editor — self-contained module.
 *
 * Full-screen overlay with:
 *  - Textarea for editing text files
 *  - Save / close buttons
 *  - "New file" dialog
 *  - Markdown live-preview toggle for .md files
 *
 * DECOUPLED: Call `initEditor(newFileBtnId)` from main.ts.
 * Import `openEditor(filePath, fileName)` from file-list.ts.
 * Remove those calls and delete this file to strip the feature.
 */

import { getCurrentPath } from './navigation';
import { requestRefreshDirectory } from './events';
import { logInfo, logError } from './error-logger';
import { markdownToHtml } from './markdown';

// ===========================================================================
// State
// ===========================================================================

var overlay: HTMLElement | null = null;
var textarea: HTMLTextAreaElement | null = null;
var previewPane: HTMLElement | null = null;
var titleEl: HTMLElement | null = null;
var statusEl: HTMLElement | null = null;
var previewToggle: HTMLElement | null = null;
var currentFilePath = '';
var isNewFile = false;
var previewVisible = false;

// ===========================================================================
// Helpers
// ===========================================================================

function escapeText(text: string): string {
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}

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
// XHR helpers
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
  xhr.onerror = function () { cb('Network error'); };
  xhr.send();
}

function saveFile(path: string, content: string, cb: (err: string | null) => void): void {
  var cleanPath = path.replace(/^\//, '');
  var segments = cleanPath.split('/');
  var encoded: string[] = [];
  for (var i = 0; i < segments.length; i++) {
    encoded.push(encodeURIComponent(segments[i]));
  }

  var xhr = new XMLHttpRequest();
  xhr.open('PUT', '/api/save/' + encoded.join('/'), true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.onreadystatechange = function () {
    if (xhr.readyState !== 4) return;
    if (xhr.status >= 200 && xhr.status < 300) {
      cb(null);
    } else {
      cb('HTTP ' + xhr.status);
    }
  };
  xhr.onerror = function () { cb('Network error'); };
  xhr.send(JSON.stringify({ content: content }));
}

function createNewFile(
  dirPath: string,
  filename: string,
  content: string,
  cb: (err: string | null) => void
): void {
  var xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/create-file', true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.onreadystatechange = function () {
    if (xhr.readyState !== 4) return;
    if (xhr.status >= 200 && xhr.status < 300) {
      cb(null);
    } else {
      var errMsg = 'HTTP ' + xhr.status;
      try {
        var data = JSON.parse(xhr.responseText);
        if (data.description) errMsg = data.description;
      } catch (_e) { /* keep default */ }
      cb(errMsg);
    }
  };
  xhr.onerror = function () { cb('Network error'); };
  xhr.send(JSON.stringify({ path: dirPath, filename: filename, content: content }));
}

// ===========================================================================
// DOM
// ===========================================================================

function injectStyles(): void {
  var style = document.createElement('style');
  style.textContent =
    '.editor-overlay{' +
      'position:fixed;top:0;left:0;right:0;bottom:0;z-index:9997;' +
      'background:rgba(0,0,0,0.95);display:none;' +
    '}' +
    '.editor-wrap{' +
      'display:-webkit-flex;display:flex;-webkit-flex-direction:column;flex-direction:column;' +
      'height:100%;padding:10px;' +
    '}' +
    '.editor-toolbar{' +
      'display:-webkit-flex;display:flex;-webkit-align-items:center;align-items:center;' +
      '-webkit-flex-wrap:wrap;flex-wrap:wrap;gap:8px;margin-bottom:8px;' +
    '}' +
    '.editor-title{color:#fff;font-size:1rem;-webkit-flex:1;flex:1;min-width:0;overflow:hidden;' +
      'text-overflow:ellipsis;white-space:nowrap;}' +
    '.editor-btn{' +
      'padding:8px 16px;font-size:13px;border:1px solid #555;border-radius:6px;' +
      'background:#222;color:#fff;cursor:pointer;min-height:40px;' +
      '-webkit-tap-highlight-color:rgba(255,255,255,0.1);white-space:nowrap;' +
    '}' +
    '.editor-btn:active{background:#444;}' +
    '.editor-btn--save{border-color:#27ae60;color:#2ecc71;}' +
    '.editor-btn--close{border-color:#c0392b;color:#e74c3c;}' +
    '.editor-btn--preview{border-color:#3498db;color:#5dade2;}' +
    '.editor-btn--preview.active{background:#1a3a5c;}' +
    '.editor-status{color:#888;font-size:12px;width:100%;text-align:right;margin-top:4px;margin-bottom:4px;}' +
    '.editor-body{' +
      'display:-webkit-flex;display:flex;-webkit-flex:1;flex:1;min-height:0;gap:8px;' +
    '}' +
    '.editor-textarea{' +
      '-webkit-flex:1;flex:1;background:#1e1e1e;color:#d4d4d4;border:1px solid #333;' +
      'border-radius:6px;padding:10px;font-family:monospace;font-size:14px;' +
      'resize:none;outline:none;-webkit-overflow-scrolling:touch;' +
      'tab-size:2;-moz-tab-size:2;-o-tab-size:2;' +
    '}' +
    '.editor-textarea:focus{border-color:#555;}' +
    '.editor-preview{' +
      '-webkit-flex:1;flex:1;background:#fff;color:#333;border:1px solid #333;' +
      'border-radius:6px;padding:14px 18px;overflow-y:auto;-webkit-overflow-scrolling:touch;' +
      'font-size:14px;line-height:1.6;display:none;' +
    '}' +
    '.editor-preview h1,.editor-preview h2,.editor-preview h3{margin:0.6em 0 0.3em;}' +
    '.editor-preview h1{font-size:1.6em;border-bottom:1px solid #ddd;padding-bottom:4px;}' +
    '.editor-preview h2{font-size:1.3em;border-bottom:1px solid #eee;padding-bottom:3px;}' +
    '.editor-preview h3{font-size:1.1em;}' +
    '.editor-preview p{margin:0.5em 0;}' +
    '.editor-preview pre{background:#f5f5f5;padding:10px;border-radius:4px;overflow-x:auto;}' +
    '.editor-preview code{background:#f0f0f0;padding:2px 4px;border-radius:3px;font-size:0.9em;}' +
    '.editor-preview pre code{background:none;padding:0;}' +
    '.editor-preview blockquote{border-left:4px solid #ddd;margin:0.5em 0;padding:4px 12px;color:#666;}' +
    '.editor-preview ul,.editor-preview ol{margin:0.5em 0;padding-left:24px;}' +
    '.editor-preview hr{border:none;border-top:1px solid #ddd;margin:1em 0;}' +
    '.editor-preview img{max-width:100%;border-radius:4px;}' +
    '.editor-preview a{color:#2980b9;}' +
    /* New-file dialog */
    '.editor-newfile{' +
      'position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;' +
      'background:rgba(0,0,0,0.9);display:none;' +
      '-webkit-align-items:center;align-items:center;' +
      '-webkit-justify-content:center;justify-content:center;' +
    '}' +
    '.editor-newfile-inner{' +
      'background:#222;border:1px solid #555;border-radius:10px;padding:24px;' +
      'width:90%;max-width:360px;text-align:center;' +
    '}' +
    '.editor-newfile-inner input{' +
      'width:100%;padding:10px;font-size:15px;border:1px solid #555;border-radius:6px;' +
      'background:#1e1e1e;color:#fff;margin:12px 0;outline:none;' +
    '}' +
    '.editor-newfile-inner input:focus{border-color:#3498db;}';
  document.head.appendChild(style);
}

function buildOverlay(): HTMLElement {
  var el = document.createElement('div');
  el.className = 'editor-overlay';

  el.innerHTML =
    '<div class="editor-wrap">' +
      '<div class="editor-toolbar">' +
        '<div id="editor-title" class="editor-title"></div>' +
        '<button id="editor-preview-toggle" class="editor-btn editor-btn--preview" style="display:none;" title="Toggle Preview">&#x25CE; Preview</button>' +
        '<button id="editor-save" class="editor-btn editor-btn--save">&#x2713; Save</button>' +
        '<button id="editor-close" class="editor-btn editor-btn--close">&#x2716; Close</button>' +
      '</div>' +
      '<div id="editor-status" class="editor-status"></div>' +
      '<div class="editor-body">' +
        '<textarea id="editor-textarea" class="editor-textarea" spellcheck="false"></textarea>' +
        '<div id="editor-preview" class="editor-preview"></div>' +
      '</div>' +
    '</div>';

  document.body.appendChild(el);
  return el;
}

function buildNewFileDialog(): HTMLElement {
  var el = document.createElement('div');
  el.className = 'editor-newfile';
  el.id = 'editor-newfile-dialog';

  el.innerHTML =
    '<div class="editor-newfile-inner">' +
      '<div style="color:#fff;font-size:1.1rem;margin-bottom:8px;">&#x2261; New Text File</div>' +
      '<div id="editor-newfile-path" style="color:#888;font-size:12px;margin-bottom:4px;"></div>' +
      '<input type="text" id="editor-newfile-name" placeholder="filename.md" />' +
      '<div style="color:#888;font-size:11px;margin-bottom:12px;">' +
        'Allowed: .txt .md .php .js .ts .css .html .json .xml .yaml .yml .sh .py .sql …' +
      '</div>' +
      '<div style="display:-webkit-flex;display:flex;gap:10px;-webkit-justify-content:center;justify-content:center;">' +
        '<button id="editor-newfile-create" class="editor-btn editor-btn--save">Create</button>' +
        '<button id="editor-newfile-cancel" class="editor-btn editor-btn--close">Cancel</button>' +
      '</div>' +
      '<div id="editor-newfile-error" style="color:#e74c3c;font-size:13px;margin-top:8px;"></div>' +
    '</div>';

  document.body.appendChild(el);
  return el;
}

// ===========================================================================
// Preview
// ===========================================================================

var previewTimer: number | undefined;

function updatePreview(): void {
  if (!previewPane || !textarea || !previewVisible) return;
  previewPane.innerHTML = markdownToHtml(textarea.value);
}

function schedulePreview(): void {
  clearTimeout(previewTimer);
  previewTimer = window.setTimeout(updatePreview, 300);
}

function togglePreview(): void {
  previewVisible = !previewVisible;

  if (previewPane) {
    previewPane.style.display = previewVisible ? 'block' : 'none';
  }
  if (previewToggle) {
    if (previewVisible) {
      previewToggle.className = 'editor-btn editor-btn--preview active';
    } else {
      previewToggle.className = 'editor-btn editor-btn--preview';
    }
  }

  if (previewVisible) updatePreview();
}

// ===========================================================================
// Editor actions
// ===========================================================================

function doSave(): void {
  if (!textarea) return;
  var content = textarea.value;

  if (isNewFile) {
    // Shouldn't happen — new-file flow creates first, then opens
    return;
  }

  setStatus('Saving…');

  saveFile(currentFilePath, content, function (err) {
    if (err) {
      setStatus('&#x2716; Save failed: ' + escapeText(err));
      logError('Save failed: ' + currentFilePath + ' — ' + err);
    } else {
      setStatus('&#x2713; Saved');
      logInfo('Saved file: ' + currentFilePath);
      requestRefreshDirectory();
    }
  });
}

function closeEditor(): void {
  if (overlay) overlay.style.display = 'none';
  previewVisible = false;
  if (previewPane) previewPane.style.display = 'none';
  if (previewToggle) previewToggle.className = 'editor-btn editor-btn--preview';
}

function setStatus(html: string): void {
  if (statusEl) statusEl.innerHTML = html;
}

// ===========================================================================
// Open editor
// ===========================================================================

function ensureOverlay(): void {
  if (!overlay) {
    injectStyles();
    overlay = buildOverlay();
    textarea = document.getElementById('editor-textarea') as HTMLTextAreaElement;
    previewPane = document.getElementById('editor-preview');
    titleEl = document.getElementById('editor-title');
    statusEl = document.getElementById('editor-status');
    previewToggle = document.getElementById('editor-preview-toggle');

    var saveBtn = document.getElementById('editor-save');
    var closeBtn = document.getElementById('editor-close');

    if (saveBtn) saveBtn.addEventListener('click', doSave);
    if (closeBtn) closeBtn.addEventListener('click', closeEditor);
    if (previewToggle) previewToggle.addEventListener('click', togglePreview);

    // Live markdown preview on input
    if (textarea) {
      textarea.addEventListener('input', schedulePreview);
    }
  }
}

/** Open the editor for an existing file. */
export function openEditor(filePath: string, fileName: string): void {
  ensureOverlay();

  currentFilePath = filePath;
  isNewFile = false;
  previewVisible = false;

  if (titleEl) titleEl.textContent = '\u270F\uFE0F ' + fileName; // ✏️
  if (textarea) textarea.value = '';
  if (previewPane) previewPane.style.display = 'none';
  if (previewToggle) {
    previewToggle.style.display = isMarkdown(fileName) ? 'inline-block' : 'none';
    previewToggle.className = 'editor-btn editor-btn--preview';
  }

  setStatus('Loading…');
  if (overlay) overlay.style.display = 'block';

  readFile(filePath, function (err, content) {
    if (err) {
      setStatus('&#x2716; Failed to load: ' + escapeText(err));
      logError('Read failed: ' + filePath + ' — ' + err);
    } else {
      if (textarea) textarea.value = content || '';
      setStatus('');
    }
  });
}

// ===========================================================================
// New-file dialog
// ===========================================================================

var newFileDialog: HTMLElement | null = null;

function showNewFileDialog(): void {
  if (!newFileDialog) {
    newFileDialog = buildNewFileDialog();

    var createBtn = document.getElementById('editor-newfile-create');
    var cancelBtn = document.getElementById('editor-newfile-cancel');

    if (createBtn) createBtn.addEventListener('click', doCreateFile);
    if (cancelBtn) cancelBtn.addEventListener('click', hideNewFileDialog);
  }

  var pathEl = document.getElementById('editor-newfile-path');
  if (pathEl) pathEl.textContent = 'In: ' + getCurrentPath();

  var nameInput = document.getElementById('editor-newfile-name') as HTMLInputElement;
  if (nameInput) nameInput.value = '';

  var errEl = document.getElementById('editor-newfile-error');
  if (errEl) errEl.textContent = '';

  newFileDialog.style.display = '-webkit-flex';
  newFileDialog.style.display = 'flex';
}

function hideNewFileDialog(): void {
  if (newFileDialog) newFileDialog.style.display = 'none';
}

function doCreateFile(): void {
  var nameInput = document.getElementById('editor-newfile-name') as HTMLInputElement;
  var errEl = document.getElementById('editor-newfile-error');
  if (!nameInput) return;

  var filename = nameInput.value.trim();
  if (!filename) {
    if (errEl) errEl.textContent = 'Please enter a filename';
    return;
  }

  var dirPath = getCurrentPath().replace(/^\//, '');

  if (errEl) errEl.textContent = 'Creating…';

  createNewFile(dirPath, filename, '', function (err) {
    if (err) {
      if (errEl) errEl.textContent = err;
      logError('Create file failed: ' + err);
    } else {
      hideNewFileDialog();
      logInfo('Created file: ' + filename);
      requestRefreshDirectory();

      // Open the newly created file in the editor
      var filePath = getCurrentPath() === '/'
        ? '/' + filename
        : getCurrentPath() + '/' + filename;
      openEditor(filePath, filename);
    }
  });
}

// ===========================================================================
// Public init
// ===========================================================================

/**
 * Attach the new-file dialog to a trigger button.
 *
 * @param buttonId  The DOM id of the "new file" button.
 */
export function initEditor(buttonId: string): void {
  var btn = document.getElementById(buttonId);
  if (!btn) return;
  btn.addEventListener('click', function () {
    showNewFileDialog();
  });
}
