/** Breadcrumb navigation component. */

import { navigateTo } from './navigation';

/** Render breadcrumb links into the given container element. */
export function renderBreadcrumb(container: HTMLElement, path: string): void {
  // Clear previous breadcrumbs
  container.innerHTML = '';

  const parts = path.split('/').filter(function (p) {
    return p.length > 0;
  });

  // Root link
  const rootLink = document.createElement('a');
  rootLink.href = '#/';
  rootLink.className = 'breadcrumb-item';
  rootLink.textContent = '\uD83C\uDFE0 Root'; // 🏠
  rootLink.addEventListener('click', function (e) {
    e.preventDefault();
    navigateTo('/');
  });
  container.appendChild(rootLink);

  // Path segments
  let builtPath = '';

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    builtPath += '/' + part;

    // Separator
    const separator = document.createElement('span');
    separator.className = 'breadcrumb-separator';
    separator.textContent = ' / ';
    container.appendChild(separator);

    if (i === parts.length - 1) {
      // Current directory — plain text, not a link
      const current = document.createElement('span');
      current.className = 'breadcrumb-current';
      current.textContent = part;
      container.appendChild(current);
    } else {
      // Ancestor directory — clickable link
      const link = document.createElement('a');
      link.href = '#' + builtPath;
      link.className = 'breadcrumb-item';
      link.textContent = part;

      // Capture current builtPath value in an IIFE so the closure is correct
      (function (targetPath: string) {
        link.addEventListener('click', function (e) {
          e.preventDefault();
          navigateTo(targetPath);
        });
      })(builtPath);

      container.appendChild(link);
    }
  }
}
