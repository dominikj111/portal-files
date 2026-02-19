/**
 * Hash-based client-side navigation.
 *
 * The current directory path is stored in `window.location.hash` so that
 * the browser back/forward buttons work and the URL can be bookmarked.
 */

type NavigationCallback = (path: string) => void;

let currentPath = '/';
let onNavigate: NavigationCallback | null = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Return the current directory path. */
export function getCurrentPath(): string {
  return currentPath;
}

/** Navigate to a new directory path (updates the hash). */
export function navigateTo(path: string): void {
  if (!path || path === '') path = '/';
  if (path.charAt(0) !== '/') path = '/' + path;

  currentPath = path;
  window.location.hash = '#' + path;
}

/**
 * Initialise the navigation system.
 *
 * @param callback  Called whenever the hash changes with the new path.
 */
export function initNavigation(callback: NavigationCallback): void {
  onNavigate = callback;

  // Listen for hash changes (back / forward / manual edit)
  if (window.addEventListener) {
    window.addEventListener('hashchange', handleHashChange, false);
  }

  // Read the initial hash
  const hash = window.location.hash;
  if (hash) {
    currentPath = hash.substring(1) || '/';
  }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function handleHashChange(): void {
  const hash = window.location.hash;
  const path = hash ? hash.substring(1) : '/';
  currentPath = path || '/';

  if (onNavigate) {
    onNavigate(currentPath);
  }
}
