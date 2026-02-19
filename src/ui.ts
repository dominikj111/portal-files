/**
 * Main UI controller.
 *
 * Owns references to the top-level DOM containers and orchestrates
 * loading a directory listing then rendering breadcrumbs + file list.
 */

import { DirectoryListing } from './types';
import { fetchDirectoryListing } from './api';
import { renderBreadcrumb } from './breadcrumb';
import { renderFileList } from './file-list';
import { logError, logInfo } from './error-logger';
import { getCurrentPath } from './navigation';
import { onRefreshDirectory } from './events';

let breadcrumbContainer: HTMLElement | null = null;
let fileListContainer: HTMLElement | null = null;
let loadingIndicator: HTMLElement | null = null;
let errorContainer: HTMLElement | null = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Grab references to the fixed DOM elements. Call once after DOMContentLoaded. */
export function initUI(): void {
  breadcrumbContainer = document.getElementById('breadcrumb');
  fileListContainer = document.getElementById('file-list');
  loadingIndicator = document.getElementById('loading');
  errorContainer = document.getElementById('error-message');

  // Other modules request a refresh via the event bus
  onRefreshDirectory(function () {
    loadDirectory(getCurrentPath());
  });
}

/** Fetch and render a directory listing for the given path. */
export function loadDirectory(path: string): void {
  hideError();
  showLoading(true);
  logInfo('Loading directory: ' + path);

  fetchDirectoryListing(path).then(
    function (listing: DirectoryListing) {
      showLoading(false);

      if (breadcrumbContainer) {
        renderBreadcrumb(breadcrumbContainer, listing.path);
      }

      if (fileListContainer) {
        renderFileList(fileListContainer, listing.entries, listing.path, listing.parent);
      }

      document.title = 'Portal Files \u2014 ' + listing.path;
    },
    function (error: Error) {
      showLoading(false);
      showError('Failed to load directory: ' + error.message);
      logError('Failed to load directory: ' + path + ' — ' + error.message);
    }
  );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function showLoading(show: boolean): void {
  if (loadingIndicator) {
    loadingIndicator.style.display = show ? 'block' : 'none';
  }
  if (fileListContainer) {
    fileListContainer.style.display = show ? 'none' : 'block';
  }
}

function showError(message: string): void {
  if (errorContainer) {
    errorContainer.textContent = message;
    errorContainer.style.display = 'block';
  }
  showLoading(false);
}

function hideError(): void {
  if (errorContainer) {
    errorContainer.style.display = 'none';
  }
}
