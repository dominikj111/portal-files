/**
 * File uploader — self-contained module.
 *
 * Provides an overlay with a multi-file picker and upload progress.
 * Files are uploaded via XHR + FormData to POST /api/upload.
 *
 * DECOUPLED: The only external integration point is `initUploader(buttonId)`.
 * Remove that call from main.ts and delete this file to strip the feature.
 */

import { getCurrentPath } from './navigation';
import { requestRefreshDirectory } from './events';
import { logInfo, logError } from './error-logger';

// ===========================================================================
// State
// ===========================================================================

var overlay: HTMLElement | null = null;
var fileInput: HTMLInputElement | null = null;
var statusArea: HTMLElement | null = null;
var uploadBtn: HTMLElement | null = null;

// ===========================================================================
// Overlay DOM
// ===========================================================================

function injectStyles(): void {
  var style = document.createElement('style');
  style.textContent =
    '.uploader-overlay{' +
      'position:fixed;top:0;left:0;right:0;bottom:0;z-index:9998;' +
      'background:rgba(0,0,0,0.92);display:none;' +
    '}' +
    '.uploader-wrap{' +
      'display:-webkit-flex;display:flex;-webkit-flex-direction:column;flex-direction:column;' +
      '-webkit-align-items:center;align-items:center;-webkit-justify-content:center;justify-content:center;' +
      'height:100%;padding:20px;' +
    '}' +
    '.uploader-title{color:#fff;font-size:1.25rem;margin-bottom:16px;}' +
    '.uploader-file-input{display:none;}' +
    '.uploader-pick-btn,.uploader-send-btn,.uploader-close-btn{' +
      'padding:12px 24px;font-size:15px;border:1px solid #555;border-radius:8px;' +
      'background:#222;color:#fff;cursor:pointer;min-height:44px;margin:6px;' +
      '-webkit-tap-highlight-color:rgba(255,255,255,0.1);' +
    '}' +
    '.uploader-pick-btn:active,.uploader-send-btn:active,.uploader-close-btn:active{background:#444;}' +
    '.uploader-send-btn{border-color:#27ae60;color:#2ecc71;}' +
    '.uploader-send-btn:disabled{opacity:0.4;cursor:default;}' +
    '.uploader-close-btn{border-color:#c0392b;color:#e74c3c;}' +
    '.uploader-status{' +
      'color:#ccc;font-family:monospace;font-size:13px;margin-top:14px;' +
      'max-height:200px;overflow-y:auto;width:100%;max-width:400px;' +
      '-webkit-overflow-scrolling:touch;' +
    '}' +
    '.uploader-file-list{' +
      'color:#aaa;font-size:13px;margin:10px 0;max-height:150px;overflow-y:auto;' +
      'width:100%;max-width:400px;text-align:left;' +
    '}' +
    '.uploader-file-list div{padding:3px 0;border-bottom:1px solid #333;}';
  document.head.appendChild(style);
}

function buildOverlay(): HTMLElement {
  var el = document.createElement('div');
  el.className = 'uploader-overlay';

  el.innerHTML =
    '<div class="uploader-wrap">' +
      '<div class="uploader-title">&#x1F4E4; Upload Files</div>' +
      '<div id="uploader-path" style="color:#888;font-size:13px;margin-bottom:12px;"></div>' +
      '<input type="file" id="uploader-file-input" class="uploader-file-input" multiple />' +
      '<div style="display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;flex-wrap:wrap;-webkit-justify-content:center;justify-content:center;">' +
        '<button id="uploader-pick" class="uploader-pick-btn">&#x1F4CE; Choose Files</button>' +
        '<button id="uploader-send" class="uploader-send-btn" disabled>&#x1F680; Upload</button>' +
      '</div>' +
      '<div id="uploader-file-list" class="uploader-file-list"></div>' +
      '<div id="uploader-status" class="uploader-status"></div>' +
      '<button id="uploader-close" class="uploader-close-btn" style="margin-top:16px;">&#x274C; Close</button>' +
    '</div>';

  document.body.appendChild(el);
  return el;
}

// ===========================================================================
// Logic
// ===========================================================================

function showOverlay(): void {
  if (!overlay) {
    injectStyles();
    overlay = buildOverlay();

    fileInput = document.getElementById('uploader-file-input') as HTMLInputElement;
    statusArea = document.getElementById('uploader-status');
    uploadBtn = document.getElementById('uploader-send');

    var pickBtn = document.getElementById('uploader-pick');
    var closeBtn = document.getElementById('uploader-close');

    if (pickBtn && fileInput) {
      pickBtn.addEventListener('click', function () {
        if (fileInput) fileInput.click();
      });
    }

    if (fileInput) {
      fileInput.addEventListener('change', onFilesSelected);
    }

    if (uploadBtn) {
      uploadBtn.addEventListener('click', doUpload);
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', hideOverlay);
    }
  }

  // Reset state
  if (fileInput) fileInput.value = '';
  if (statusArea) statusArea.innerHTML = '';
  if (uploadBtn) (uploadBtn as HTMLButtonElement).disabled = true;

  var fileListEl = document.getElementById('uploader-file-list');
  if (fileListEl) fileListEl.innerHTML = '';

  var pathEl = document.getElementById('uploader-path');
  if (pathEl) pathEl.textContent = 'Upload to: ' + getCurrentPath();

  overlay.style.display = 'block';
}

function hideOverlay(): void {
  if (overlay) overlay.style.display = 'none';
}

function onFilesSelected(): void {
  if (!fileInput || !fileInput.files) return;

  var files = fileInput.files;
  var listEl = document.getElementById('uploader-file-list');

  if (listEl) {
    var html = '';
    for (var i = 0; i < files.length; i++) {
      html += '<div>' + escapeText(files[i].name) + ' (' + formatBytes(files[i].size) + ')</div>';
    }
    listEl.innerHTML = html;
  }

  if (uploadBtn) {
    (uploadBtn as HTMLButtonElement).disabled = files.length === 0;
  }
}

function doUpload(): void {
  if (!fileInput || !fileInput.files || fileInput.files.length === 0) return;

  var files = fileInput.files;
  var formData = new FormData();
  var currentDir = getCurrentPath().replace(/^\//, '');
  formData.append('path', currentDir);

  for (var i = 0; i < files.length; i++) {
    formData.append('files', files[i], files[i].name);
  }

  if (uploadBtn) (uploadBtn as HTMLButtonElement).disabled = true;
  if (statusArea) statusArea.innerHTML = 'Uploading…';

  var xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/upload', true);

  xhr.upload.onprogress = function (e) {
    if (e.lengthComputable && statusArea) {
      var pct = Math.round((e.loaded / e.total) * 100);
      statusArea.innerHTML = 'Uploading… ' + pct + '%';
    }
  };

  xhr.onreadystatechange = function () {
    if (xhr.readyState !== 4) return;

    if (xhr.status >= 200 && xhr.status < 300) {
      try {
        var resp = JSON.parse(xhr.responseText);
        var count = resp.uploaded ? resp.uploaded.length : 0;
        if (statusArea) {
          statusArea.innerHTML =
            '<span style="color:#2ecc71;">&#x2705; ' + count + ' file(s) uploaded</span>';
        }
        logInfo('Uploaded ' + count + ' file(s) to ' + getCurrentPath());
        // Refresh the current directory listing
        requestRefreshDirectory();
      } catch (_e) {
        if (statusArea) {
          statusArea.innerHTML = '<span style="color:#e74c3c;">Upload succeeded but bad response</span>';
        }
      }
    } else {
      var errMsg = 'Upload failed (HTTP ' + xhr.status + ')';
      if (statusArea) {
        statusArea.innerHTML = '<span style="color:#e74c3c;">&#x274C; ' + errMsg + '</span>';
      }
      logError(errMsg);
    }

    if (uploadBtn) (uploadBtn as HTMLButtonElement).disabled = false;
  };

  xhr.onerror = function () {
    if (statusArea) {
      statusArea.innerHTML = '<span style="color:#e74c3c;">&#x274C; Network error</span>';
    }
    logError('Upload network error');
    if (uploadBtn) (uploadBtn as HTMLButtonElement).disabled = false;
  };

  xhr.send(formData);
}

// ===========================================================================
// Helpers
// ===========================================================================

function escapeText(text: string): string {
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  var units = ['B', 'KB', 'MB', 'GB'];
  var k = 1024;
  var i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
}

// ===========================================================================
// Public init
// ===========================================================================

/**
 * Attach the uploader overlay to a trigger button.
 *
 * @param buttonId  The DOM id of the button that opens the uploader.
 */
export function initUploader(buttonId: string): void {
  var btn = document.getElementById(buttonId);
  if (!btn) return;
  btn.addEventListener('click', function () {
    showOverlay();
  });
}
