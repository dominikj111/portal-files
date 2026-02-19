/**
 * Simple event bus for decoupling modules.
 *
 * Avoids circular imports by letting modules publish/subscribe
 * without knowing about each other.
 */

type Listener = () => void;

var refreshListeners: Listener[] = [];

/** Subscribe to directory-refresh requests. */
export function onRefreshDirectory(listener: Listener): void {
  refreshListeners.push(listener);
}

/** Ask the UI to reload the current directory listing. */
export function requestRefreshDirectory(): void {
  for (var i = 0; i < refreshListeners.length; i++) {
    refreshListeners[i]();
  }
}
