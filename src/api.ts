/**
 * XHR-based API client.
 *
 * Uses XMLHttpRequest instead of fetch for maximum browser compatibility
 * (Safari on iOS 10).
 */

import { DirectoryListing } from './types';
import { logError } from './error-logger';

// ---------------------------------------------------------------------------
// Generic XHR helper
// ---------------------------------------------------------------------------

function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  return new Promise<T>(function (resolve, reject) {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url, true);

    if (body) {
      xhr.setRequestHeader('Content-Type', 'application/json');
    }

    // Prevent IE11 from caching GET responses
    if (!body && method === 'GET') {
      xhr.setRequestHeader('Cache-Control', 'no-cache');
      xhr.setRequestHeader('Pragma', 'no-cache');
    }

    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;

      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as T;
          resolve(data);
        } catch (e) {
          reject(new Error('Failed to parse JSON response'));
        }
      } else {
        reject(new Error('HTTP ' + xhr.status + ': ' + xhr.statusText));
      }
    };

    xhr.onerror = function () {
      reject(new Error('Network error'));
    };

    xhr.send(body ? JSON.stringify(body) : null);
  });
}

// ---------------------------------------------------------------------------
// Public API methods
// ---------------------------------------------------------------------------

/** Fetch the listing for a directory. */
export function fetchDirectoryListing(path: string): Promise<DirectoryListing> {
  const encodedPath = encodeURIComponent(path);
  return request<DirectoryListing>('GET', '/api/files?path=' + encodedPath).then(
    undefined,
    function (err: Error) {
      logError('API error (fetchDirectoryListing): ' + err.message);
      throw err;
    }
  );
}

/** Build a download URL for the given file path. */
export function getDownloadUrl(filePath: string): string {
  const cleanPath = filePath.replace(/^\//, '');
  const segments = cleanPath.split('/');
  const encoded = [];
  for (let i = 0; i < segments.length; i++) {
    encoded.push(encodeURIComponent(segments[i]));
  }
  return '/api/download/' + encoded.join('/');
}
