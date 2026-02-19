/**
 * Client-side error logger.
 *
 * Hooks into window.onerror and unhandledrejection to catch runtime errors,
 * then forwards them to the server via POST /api/log so they can be
 * inspected in the server terminal.
 */

import { ClientLogEntry } from './types';
import { addDebugMessage } from './debug-panel';

const LOG_ENDPOINT = '/api/log';

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function sendLog(entry: ClientLogEntry): void {
  try {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', LOG_ENDPOINT, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send(JSON.stringify(entry));
  } catch (_e) {
    // Silently swallow — we cannot log errors about logging errors.
  }
}

function buildLogEntry(
  level: ClientLogEntry['level'],
  message: string,
  extras?: Partial<ClientLogEntry>
): ClientLogEntry {
  const entry: ClientLogEntry = {
    level: level,
    message: message,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString(),
  };

  if (extras) {
    if (extras.stack) entry.stack = extras.stack;
    if (extras.url) entry.url = extras.url;
    if (extras.line !== undefined) entry.line = extras.line;
    if (extras.col !== undefined) entry.col = extras.col;
  }

  return entry;
}

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/** Log an error to the server and debug panel. */
export function logError(message: string, extras?: Partial<ClientLogEntry>): void {
  const entry = buildLogEntry('error', message, extras);
  sendLog(entry);
  addDebugMessage('error', message);
}

/** Log a warning to the server and debug panel. */
export function logWarn(message: string): void {
  const entry = buildLogEntry('warn', message);
  sendLog(entry);
  addDebugMessage('warn', message);
}

/** Log an informational message to the server and debug panel. */
export function logInfo(message: string): void {
  const entry = buildLogEntry('info', message);
  sendLog(entry);
  addDebugMessage('info', message);
}

/** Log a debug-level message to the server and debug panel. */
export function logDebug(message: string): void {
  const entry = buildLogEntry('debug', message);
  sendLog(entry);
  addDebugMessage('debug', message);
}

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

/** Install global error handlers. */
export function initErrorLogger(): void {
  // Global runtime error handler
  window.onerror = function (
    message: Event | string,
    source?: string,
    lineno?: number,
    colno?: number,
    error?: Error
  ): boolean {
    logError(String(message), {
      url: source || '',
      line: lineno || 0,
      col: colno || 0,
      stack: error && error.stack ? error.stack : '',
    });
    return false;
  };

  // Unhandled Promise rejections (silently ignored if the browser lacks support)
  window.addEventListener('unhandledrejection', function (event: PromiseRejectionEvent) {
    let message = 'Unhandled Promise Rejection';
    if (event.reason) {
      message += ': ' + (event.reason.message || String(event.reason));
    }
    logError(message, {
      stack: event.reason && event.reason.stack ? event.reason.stack : '',
    });
  });

  logInfo('Error logger initialised');
}
