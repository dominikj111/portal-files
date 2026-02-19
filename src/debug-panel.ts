/**
 * On-screen debug panel.
 *
 * Displays a floating console overlay so that errors and diagnostic
 * messages can be inspected directly on the device without dev-tools.
 */

import { DebugMessage } from './types';

const MAX_MESSAGES = 50;
const messages: DebugMessage[] = [];
let panelElement: HTMLElement | null = null;
let listElement: HTMLElement | null = null;
let isVisible = false;

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

function createPanel(): void {
  // Toggle button — fixed in the bottom-right corner
  const toggleBtn = document.createElement('div');
  toggleBtn.id = 'debug-toggle';
  toggleBtn.innerHTML = '&#x1F41B;'; // 🐛
  toggleBtn.setAttribute(
    'style',
    'position:fixed;bottom:10px;right:10px;width:44px;height:44px;' +
      'background:#333;color:#fff;border-radius:50%;' +
      'display:-webkit-flex;display:flex;' +
      '-webkit-align-items:center;align-items:center;' +
      '-webkit-justify-content:center;justify-content:center;' +
      'font-size:20px;cursor:pointer;z-index:10001;' +
      '-webkit-tap-highlight-color:rgba(0,0,0,0.2);'
  );
  toggleBtn.addEventListener('click', togglePanel);
  document.body.appendChild(toggleBtn);

  // Panel
  panelElement = document.createElement('div');
  panelElement.id = 'debug-panel';
  panelElement.setAttribute(
    'style',
    'position:fixed;bottom:60px;right:10px;left:10px;max-height:300px;' +
      'background:rgba(0,0,0,0.92);color:#0f0;font-family:monospace;' +
      'font-size:11px;overflow-y:auto;padding:8px;border-radius:8px;' +
      'z-index:10000;display:none;-webkit-overflow-scrolling:touch;'
  );

  listElement = document.createElement('div');
  panelElement.appendChild(listElement);
  document.body.appendChild(panelElement);
}

function togglePanel(): void {
  if (!panelElement) return;
  isVisible = !isVisible;
  panelElement.style.display = isVisible ? 'block' : 'none';
}

function getLevelColor(level: string): string {
  switch (level) {
    case 'error':
      return '#ff4444';
    case 'warn':
      return '#ffaa00';
    case 'info':
      return '#4488ff';
    case 'debug':
      return '#888888';
    default:
      return '#0f0';
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}

function renderMessages(): void {
  if (!listElement) return;

  let html = '';
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const time = msg.timestamp.toLocaleTimeString();
    const color = getLevelColor(msg.level);
    html +=
      '<div style="margin-bottom:2px;border-bottom:1px solid #333;padding-bottom:2px;">' +
      '<span style="color:' +
      color +
      ';">[' +
      msg.level.toUpperCase() +
      ']</span> ' +
      '<span style="color:#666;">' +
      time +
      '</span> ' +
      '<span>' +
      escapeHtml(msg.message) +
      '</span>' +
      '</div>';
  }

  listElement.innerHTML = html;

  // Auto-scroll to the bottom
  if (panelElement) {
    panelElement.scrollTop = panelElement.scrollHeight;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Append a message to the debug panel. */
export function addDebugMessage(level: string, message: string): void {
  const msg: DebugMessage = {
    level: level,
    message: message,
    timestamp: new Date(),
  };

  messages.push(msg);
  if (messages.length > MAX_MESSAGES) {
    messages.shift();
  }

  renderMessages();
}

/** Create the debug panel DOM elements. */
export function initDebugPanel(): void {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createPanel);
  } else {
    createPanel();
  }
}
