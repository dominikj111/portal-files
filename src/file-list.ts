/** File / folder list component. */

import { FileEntry } from './types';
import { navigateTo } from './navigation';
import { getDownloadUrl } from './api';
import { formatFileSize, formatDate, getFileIcon, escapeHtml } from './utils';
import { canOpenInVlc, getVlcUrl } from './vlc';
import { openEditor } from './editor';
import { openViewer } from './viewer';
import { requestRefreshDirectory } from './events';
import { logInfo, logError } from './error-logger';

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

/**
 * Render the list of files and directories into the given container.
 *
 * @param container  - DOM element to render into
 * @param entries    - file / folder entries from the API
 * @param currentPath - the path that was listed
 * @param parentPath  - path to the parent directory (null for root)
 */
export function renderFileList(
  container: HTMLElement,
  entries: FileEntry[],
  currentPath: string,
  parentPath: string | null
): void {
  container.innerHTML = '';

  // "Go up" row
  if (parentPath !== null) {
    container.appendChild(createUpItem(parentPath));
  }

  // Empty directory notice
  if (entries.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-message';
    empty.textContent = 'This directory is empty';
    container.appendChild(empty);
    return;
  }

  // Entries
  for (let i = 0; i < entries.length; i++) {
    container.appendChild(createFileItem(entries[i], currentPath));
  }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function createUpItem(parentPath: string): HTMLElement {
  const item = document.createElement('div');
  item.className = 'file-item file-item--directory';
  item.innerHTML =
    '<div class="file-item__icon">\u2B06\uFE0F</div>' + // ⬆️
    '<div class="file-item__info">' +
    '<div class="file-item__name">Parent Directory</div>' +
    '<div class="file-item__meta">Go up one level</div>' +
    '</div>';

  item.addEventListener('click', function () {
    navigateTo(parentPath);
  });

  return item;
}

function createFileItem(entry: FileEntry, currentPath: string): HTMLElement {
  const item = document.createElement('div');
  const isDir = entry.type === 'directory';
  item.className = 'file-item' + (isDir ? ' file-item--directory' : ' file-item--file');

  const icon = getFileIcon(entry);
  const size = isDir ? '--' : formatFileSize(entry.size);
  const modified = formatDate(entry.modified);
  const filePath = currentPath === '/' ? '/' + entry.name : currentPath + '/' + entry.name;

  // Build action buttons for files
  let actionsHtml = '';
  if (!isDir) {
    const downloadUrl = getDownloadUrl(filePath);
    actionsHtml = '<div class="file-item__actions">';
    actionsHtml +=
      '<a href="' +
      escapeHtml(downloadUrl) +
      '" class="btn btn--download" title="Download">\u2B07\uFE0F</a>'; // ⬇️

    if (entry.editable) {
      actionsHtml +=
        '<span class="btn btn--view" title="View">\uD83D\uDC41\uFE0F</span>' + // 👁️
        '<span class="btn btn--edit" title="Edit">\u270F\uFE0F</span>'; // ✏️
    }

    if (canOpenInVlc(entry.extension)) {
      const vlcUrl = getVlcUrl(filePath);
      actionsHtml +=
        '<a href="' +
        escapeHtml(vlcUrl) +
        '" class="btn btn--vlc" title="Open in VLC">\u25B6\uFE0F</a>'; // ▶️
    }

    actionsHtml += '<span class="btn btn--delete" title="Delete">\uD83D\uDDD1\uFE0F</span>'; // 🗑️
    actionsHtml += '</div>';
  } else {
    // Directory: just a delete button
    actionsHtml = '<div class="file-item__actions">';
    actionsHtml += '<span class="btn btn--delete" title="Delete">\uD83D\uDDD1\uFE0F</span>';
    actionsHtml += '</div>';
  }

  item.innerHTML =
    '<div class="file-item__icon">' +
    icon +
    '</div>' +
    '<div class="file-item__info">' +
    '<div class="file-item__name">' +
    escapeHtml(entry.name) +
    '</div>' +
    '<div class="file-item__meta">' +
    '<span class="file-item__size">' +
    size +
    '</span>' +
    '<span class="file-item__date">' +
    escapeHtml(modified) +
    '</span>' +
    '</div>' +
    '</div>' +
    actionsHtml;

  // Directory tap → navigate
  if (isDir) {
    item.addEventListener('click', function () {
      navigateTo(filePath);
    });
  }

  // Prevent action-button taps from bubbling to the row handler
  const actionLinks = item.querySelectorAll('.btn');
  for (let j = 0; j < actionLinks.length; j++) {
    actionLinks[j].addEventListener('click', function (e) {
      e.stopPropagation();
    });
  }

  // View button handler
  if (!isDir && entry.editable) {
    const viewBtn = item.querySelector('.btn--view');
    if (viewBtn) {
      viewBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        openViewer(filePath, entry.name);
      });
    }
  }

  // Edit button handler
  if (!isDir && entry.editable) {
    const editBtn = item.querySelector('.btn--edit');
    if (editBtn) {
      editBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        openEditor(filePath, entry.name);
      });
    }
  }

  // Delete button handler
  const deleteBtn = item.querySelector('.btn--delete');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      deleteItem(filePath, entry.name, isDir);
    });
  }

  return item;
}

// ===========================================================================
// Delete
// ===========================================================================

function deleteItem(filePath: string, itemName: string, isDir: boolean): void {
  var typeLabel = isDir ? 'folder' : 'file';
  var confirmed = confirm('Delete ' + typeLabel + ' "' + itemName + '"?');
  if (!confirmed) return;

  var cleanPath = filePath.replace(/^\//, '');
  var segments = cleanPath.split('/');
  var encoded: string[] = [];
  for (var i = 0; i < segments.length; i++) {
    encoded.push(encodeURIComponent(segments[i]));
  }

  var xhr = new XMLHttpRequest();
  xhr.open('DELETE', '/api/delete/' + encoded.join('/'), true);
  xhr.onreadystatechange = function () {
    if (xhr.readyState !== 4) return;
    if (xhr.status >= 200 && xhr.status < 300) {
      logInfo('Deleted ' + typeLabel + ': ' + itemName);
      requestRefreshDirectory();
    } else {
      var errMsg = 'Failed to delete (HTTP ' + xhr.status + ')';
      try {
        var data = JSON.parse(xhr.responseText);
        if (data.description) errMsg = data.description;
      } catch (_e) {
        /* keep default */
      }
      alert('Error: ' + errMsg);
      logError('Delete failed: ' + filePath + ' — ' + errMsg);
    }
  };
  xhr.onerror = function () {
    alert('Network error');
    logError('Delete network error: ' + filePath);
  };
  xhr.send();
}
