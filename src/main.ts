/**
 * Portal Files — application entry point.
 *
 * Initialises every subsystem and triggers the first directory load
 * based on the current URL hash.
 */

import { initErrorLogger, logInfo } from './error-logger';
import { initDebugPanel } from './debug-panel';
import { initNavigation } from './navigation';
import { initUI, loadDirectory } from './ui';
import { initTetris } from './tetris';
import { initUploader } from './uploader';
import { initEditor } from './editor';
import { initNewFolder } from './newfolder';

function init(): void {
  // 1. Debug panel first so visual feedback is available immediately
  initDebugPanel();

  // 2. Error logger hooks window.onerror / unhandledrejection
  initErrorLogger();

  logInfo('Portal Files starting up');

  // 3. Grab DOM references
  initUI();

  // 4. Set up hash-based navigation
  initNavigation(function (path: string) {
    loadDirectory(path);
  });

  // 5. Load the initial directory from the current hash (or root)
  const hash = window.location.hash;
  const initialPath = hash ? hash.substring(1) : '/';
  loadDirectory(initialPath);

  // 6. Tetris easter-egg (remove this line + delete tetris.ts to strip the feature)
  initTetris('tetris-btn');

  // 7. File uploader (remove this line + delete uploader.ts to strip)
  initUploader('upload-btn');

  // 8. Text file editor (remove this line + delete editor.ts + markdown.ts to strip)
  initEditor('newfile-btn');

  // 9. New folder (remove this line + delete newfolder.ts to strip)
  initNewFolder('newfolder-btn');

  logInfo('Portal Files initialised');
}

// Start when the DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
