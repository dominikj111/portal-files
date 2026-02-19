/**
 * New-folder dialog — self-contained module.
 *
 * Shows a simple prompt overlay, POSTs to /api/create-directory,
 * then refreshes the current listing.
 *
 * DECOUPLED: Remove `initNewFolder('newfolder-btn')` from main.ts
 * and delete this file to strip the feature.
 */

import { getCurrentPath } from './navigation';
import { requestRefreshDirectory } from './events';
import { logInfo, logError } from './error-logger';

// ===========================================================================
// State
// ===========================================================================

var dialog: HTMLElement | null = null;

// ===========================================================================
// Helpers
// ===========================================================================

function escapeText(text: string): string {
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}

// ===========================================================================
// XHR
// ===========================================================================

function createDirectory(
  dirPath: string,
  dirname: string,
  cb: (err: string | null) => void
): void {
  var xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/create-directory', true);
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
      } catch (_e) {
        /* keep default */
      }
      cb(errMsg);
    }
  };
  xhr.onerror = function () {
    cb('Network error');
  };
  xhr.send(JSON.stringify({ path: dirPath, dirname: dirname }));
}

// ===========================================================================
// DOM
// ===========================================================================

function injectStyles(): void {
  var style = document.createElement('style');
  style.textContent =
    '.newfolder-overlay{' +
    'position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;' +
    'background:rgba(0,0,0,0.9);display:none;' +
    '-webkit-align-items:center;align-items:center;' +
    '-webkit-justify-content:center;justify-content:center;' +
    '}' +
    '.newfolder-inner{' +
    'background:#222;border:1px solid #555;border-radius:10px;padding:24px;' +
    'width:90%;max-width:360px;text-align:center;' +
    '}' +
    '.newfolder-inner input{' +
    'width:100%;padding:10px;font-size:15px;border:1px solid #555;border-radius:6px;' +
    'background:#1e1e1e;color:#fff;margin:12px 0;outline:none;' +
    '}' +
    '.newfolder-inner input:focus{border-color:#3498db;}' +
    '.newfolder-btn{' +
    'padding:10px 18px;font-size:14px;border:1px solid #555;border-radius:8px;' +
    'background:#222;color:#fff;cursor:pointer;min-height:44px;margin:6px;' +
    '-webkit-tap-highlight-color:rgba(255,255,255,0.1);' +
    '}' +
    '.newfolder-btn:active{background:#444;}' +
    '.newfolder-btn--create{border-color:#27ae60;color:#2ecc71;}' +
    '.newfolder-btn--cancel{border-color:#c0392b;color:#e74c3c;}';
  document.head.appendChild(style);
}

function buildDialog(): HTMLElement {
  var el = document.createElement('div');
  el.className = 'newfolder-overlay';

  el.innerHTML =
    '<div class="newfolder-inner">' +
    '<div style="color:#fff;font-size:1.1rem;margin-bottom:8px;">&#x1F4C1; New Folder</div>' +
    '<div id="newfolder-path" style="color:#888;font-size:12px;margin-bottom:4px;"></div>' +
    '<input type="text" id="newfolder-name" placeholder="folder-name" />' +
    '<div style="display:-webkit-flex;display:flex;gap:10px;-webkit-justify-content:center;justify-content:center;">' +
    '<button id="newfolder-create" class="newfolder-btn newfolder-btn--create">Create</button>' +
    '<button id="newfolder-cancel" class="newfolder-btn newfolder-btn--cancel">Cancel</button>' +
    '</div>' +
    '<div id="newfolder-error" style="color:#e74c3c;font-size:13px;margin-top:8px;"></div>' +
    '</div>';

  document.body.appendChild(el);
  return el;
}

// ===========================================================================
// Actions
// ===========================================================================

function showDialog(): void {
  if (!dialog) {
    injectStyles();
    dialog = buildDialog();

    var createBtn = document.getElementById('newfolder-create');
    var cancelBtn = document.getElementById('newfolder-cancel');

    if (createBtn) createBtn.addEventListener('click', doCreate);
    if (cancelBtn) cancelBtn.addEventListener('click', hideDialog);
  }

  var pathEl = document.getElementById('newfolder-path');
  if (pathEl) pathEl.textContent = 'In: ' + getCurrentPath();

  var nameInput = document.getElementById('newfolder-name') as HTMLInputElement;
  if (nameInput) nameInput.value = '';

  var errEl = document.getElementById('newfolder-error');
  if (errEl) errEl.textContent = '';

  dialog.style.display = '-webkit-flex';
  dialog.style.display = 'flex';
}

function hideDialog(): void {
  if (dialog) dialog.style.display = 'none';
}

function doCreate(): void {
  var nameInput = document.getElementById('newfolder-name') as HTMLInputElement;
  var errEl = document.getElementById('newfolder-error');
  if (!nameInput) return;

  var dirname = nameInput.value.trim();
  if (!dirname) {
    if (errEl) errEl.textContent = 'Please enter a folder name';
    return;
  }

  var dirPath = getCurrentPath().replace(/^\//, '');
  if (errEl) errEl.textContent = 'Creating…';

  createDirectory(dirPath, dirname, function (err) {
    if (err) {
      if (errEl) errEl.textContent = escapeText(err);
      logError('Create folder failed: ' + err);
    } else {
      hideDialog();
      logInfo('Created folder: ' + dirname);
      requestRefreshDirectory();
    }
  });
}

// ===========================================================================
// Public init
// ===========================================================================

/**
 * Attach the new-folder dialog to a trigger button.
 *
 * @param buttonId  The DOM id of the "new folder" button.
 */
export function initNewFolder(buttonId: string): void {
  var btn = document.getElementById(buttonId);
  if (!btn) return;
  btn.addEventListener('click', function () {
    showDialog();
  });
}
