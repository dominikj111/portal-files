/**
 * Tetris — self-contained game module.
 *
 * This file owns the full lifecycle: overlay UI, canvas rendering,
 * game logic, touch controls, level progression, and localStorage persistence.
 *
 * DECOUPLED: The only external integration point is `initTetris(buttonId)`.
 * Remove that one call from main.ts and delete this file to strip the feature.
 */

// ===========================================================================
// Constants
// ===========================================================================

const STORAGE_KEY = 'portalfiles_tetris';
const COLS = 10;
const ROWS = 20;
const CELL_PX = 24; // will be scaled to fit container
const TICK_BASE_MS = 800; // level 0 drop interval
const TICK_DECAY = 0.85; // each level multiplies interval by this
const LINES_PER_LEVEL = 10;

// Tetromino shapes (rotation states)
// Each piece is an array of rotation variants; each variant is [row,col] offsets
// prettier-ignore
var PIECES: number[][][][] = [
  // I
  [[[0,0],[0,1],[0,2],[0,3]], [[0,0],[1,0],[2,0],[3,0]]],
  // O
  [[[0,0],[0,1],[1,0],[1,1]]],
  // T
  [[[0,0],[0,1],[0,2],[1,1]], [[0,0],[1,0],[2,0],[1,1]], [[0,1],[1,0],[1,1],[1,2]], [[0,0],[1,0],[1,-1],[2,0]]],
  // S
  [[[0,1],[0,2],[1,0],[1,1]], [[0,0],[1,0],[1,1],[2,1]]],
  // Z
  [[[0,0],[0,1],[1,1],[1,2]], [[0,1],[1,0],[1,1],[2,0]]],
  // L
  [[[0,0],[0,1],[0,2],[1,0]], [[0,0],[1,0],[2,0],[2,1]], [[0,2],[1,0],[1,1],[1,2]], [[0,0],[0,1],[1,1],[2,1]]],
  // J
  [[[0,0],[0,1],[0,2],[1,2]], [[0,0],[1,0],[2,0],[0,1]], [[0,0],[1,0],[1,1],[1,2]], [[0,0],[0,1],[1,0],[2,0]]]
];

var COLORS = ['#00f0f0', '#f0f000', '#a000f0', '#00f000', '#f00000', '#f0a000', '#0000f0'];

// ===========================================================================
// Types
// ===========================================================================

interface TetrisSave {
  level: number;
  lines: number;
  score: number;
}

// ===========================================================================
// Game state (module-scoped — single instance)
// ===========================================================================

var board: number[][]; // ROWS x COLS, 0 = empty, >0 = colour index + 1
var currentPiece: number;
var currentRotation: number;
var currentRow: number;
var currentCol: number;
var gameOver: boolean;
var paused: boolean;
var level: number;
var totalLines: number;
var score: number;
var tickTimer: number;

// DOM
var overlay: HTMLElement | null = null;
var canvas: HTMLCanvasElement | null = null;
var ctx: CanvasRenderingContext2D | null = null;
var scoreLabel: HTMLElement | null = null;
var levelLabel: HTMLElement | null = null;
var linesLabel: HTMLElement | null = null;
var gameOverBanner: HTMLElement | null = null;

// ===========================================================================
// Persistence
// ===========================================================================

function loadProgress(): TetrisSave {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as TetrisSave;
  } catch (_e) {
    // ignore
  }
  return { level: 0, lines: 0, score: 0 };
}

function saveProgress(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ level: level, lines: totalLines, score: score }));
  } catch (_e) {
    // ignore
  }
}

function clearProgress(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (_e) {
    // ignore
  }
}

// ===========================================================================
// Board helpers
// ===========================================================================

function createBoard(): number[][] {
  var b: number[][] = [];
  for (var r = 0; r < ROWS; r++) {
    var row: number[] = [];
    for (var c = 0; c < COLS; c++) row.push(0);
    b.push(row);
  }
  return b;
}

function collides(piece: number, rotation: number, row: number, col: number): boolean {
  var shape = PIECES[piece][rotation % PIECES[piece].length];
  for (var i = 0; i < shape.length; i++) {
    var r = row + shape[i][0];
    var c = col + shape[i][1];
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return true;
    if (board[r][c] !== 0) return true;
  }
  return false;
}

function lockPiece(): void {
  var shape = PIECES[currentPiece][currentRotation % PIECES[currentPiece].length];
  for (var i = 0; i < shape.length; i++) {
    var r = currentRow + shape[i][0];
    var c = currentCol + shape[i][1];
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
      board[r][c] = currentPiece + 1;
    }
  }
}

function clearLines(): number {
  var cleared = 0;
  for (var r = ROWS - 1; r >= 0; r--) {
    var full = true;
    for (var c = 0; c < COLS; c++) {
      if (board[r][c] === 0) { full = false; break; }
    }
    if (full) {
      board.splice(r, 1);
      var emptyRow: number[] = [];
      for (var c2 = 0; c2 < COLS; c2++) emptyRow.push(0);
      board.unshift(emptyRow);
      cleared++;
      r++; // re-check same index
    }
  }
  return cleared;
}

function spawnPiece(): void {
  currentPiece = Math.floor(Math.random() * PIECES.length);
  currentRotation = 0;
  currentRow = 0;
  currentCol = Math.floor((COLS - 2) / 2);

  if (collides(currentPiece, currentRotation, currentRow, currentCol)) {
    gameOver = true;
  }
}

// ===========================================================================
// Rendering
// ===========================================================================

function drawCell(r: number, c: number, colorIdx: number, ghost?: boolean): void {
  if (!ctx) return;
  var x = c * CELL_PX;
  var y = r * CELL_PX;
  if (ghost) {
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
  } else {
    ctx.fillStyle = COLORS[colorIdx];
  }
  ctx.fillRect(x + 1, y + 1, CELL_PX - 2, CELL_PX - 2);
  if (!ghost) {
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.strokeRect(x + 1, y + 1, CELL_PX - 2, CELL_PX - 2);
  }
}

function getGhostRow(): number {
  var r = currentRow;
  while (!collides(currentPiece, currentRotation, r + 1, currentCol)) {
    r++;
  }
  return r;
}

function draw(): void {
  if (!ctx || !canvas) return;

  // Background
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  for (var r = 0; r <= ROWS; r++) {
    ctx.beginPath(); ctx.moveTo(0, r * CELL_PX); ctx.lineTo(COLS * CELL_PX, r * CELL_PX); ctx.stroke();
  }
  for (var c = 0; c <= COLS; c++) {
    ctx.beginPath(); ctx.moveTo(c * CELL_PX, 0); ctx.lineTo(c * CELL_PX, ROWS * CELL_PX); ctx.stroke();
  }

  // Board cells
  for (var r2 = 0; r2 < ROWS; r2++) {
    for (var c2 = 0; c2 < COLS; c2++) {
      if (board[r2][c2] !== 0) drawCell(r2, c2, board[r2][c2] - 1);
    }
  }

  // Ghost piece
  if (!gameOver && !paused) {
    var ghostR = getGhostRow();
    var shape = PIECES[currentPiece][currentRotation % PIECES[currentPiece].length];
    for (var i = 0; i < shape.length; i++) {
      drawCell(ghostR + shape[i][0], currentCol + shape[i][1], currentPiece, true);
    }
  }

  // Current piece
  if (!gameOver) {
    var shape2 = PIECES[currentPiece][currentRotation % PIECES[currentPiece].length];
    for (var j = 0; j < shape2.length; j++) {
      drawCell(currentRow + shape2[j][0], currentCol + shape2[j][1], currentPiece);
    }
  }

  // HUD labels
  if (scoreLabel) scoreLabel.textContent = 'Score: ' + score;
  if (levelLabel) levelLabel.textContent = 'Level: ' + level;
  if (linesLabel) linesLabel.textContent = 'Lines: ' + totalLines;

  // Game-over banner
  if (gameOverBanner) {
    gameOverBanner.style.display = gameOver ? 'block' : 'none';
  }
}

// ===========================================================================
// Game loop
// ===========================================================================

function getTickMs(): number {
  return Math.max(100, TICK_BASE_MS * Math.pow(TICK_DECAY, level));
}

function tick(): void {
  if (gameOver || paused) return;

  if (!collides(currentPiece, currentRotation, currentRow + 1, currentCol)) {
    currentRow++;
  } else {
    lockPiece();
    var cleared = clearLines();
    if (cleared > 0) {
      totalLines += cleared;
      // Scoring: 100 * cleared^2 * (level+1)
      score += 100 * cleared * cleared * (level + 1);
      level = Math.floor(totalLines / LINES_PER_LEVEL);
    }
    saveProgress();
    spawnPiece();
  }

  draw();
  scheduleTick();
}

function scheduleTick(): void {
  clearTimeout(tickTimer);
  if (!gameOver && !paused) {
    tickTimer = window.setTimeout(tick, getTickMs());
  }
}

// ===========================================================================
// Input handling
// ===========================================================================

function moveLeft(): void {
  if (!collides(currentPiece, currentRotation, currentRow, currentCol - 1)) {
    currentCol--;
    draw();
  }
}

function moveRight(): void {
  if (!collides(currentPiece, currentRotation, currentRow, currentCol + 1)) {
    currentCol++;
    draw();
  }
}

function rotate(): void {
  var next = (currentRotation + 1) % PIECES[currentPiece].length;
  if (!collides(currentPiece, next, currentRow, currentCol)) {
    currentRotation = next;
    draw();
  } else if (!collides(currentPiece, next, currentRow, currentCol - 1)) {
    // wall kick left
    currentCol--;
    currentRotation = next;
    draw();
  } else if (!collides(currentPiece, next, currentRow, currentCol + 1)) {
    // wall kick right
    currentCol++;
    currentRotation = next;
    draw();
  }
}

function softDrop(): void {
  if (!collides(currentPiece, currentRotation, currentRow + 1, currentCol)) {
    currentRow++;
    draw();
  }
}

function hardDrop(): void {
  while (!collides(currentPiece, currentRotation, currentRow + 1, currentCol)) {
    currentRow++;
    score += 2;
  }
  // Lock immediately
  lockPiece();
  var cleared = clearLines();
  if (cleared > 0) {
    totalLines += cleared;
    score += 100 * cleared * cleared * (level + 1);
    level = Math.floor(totalLines / LINES_PER_LEVEL);
  }
  saveProgress();
  spawnPiece();
  draw();
  scheduleTick();
}

function handleKeyDown(e: KeyboardEvent): void {
  if (gameOver || paused) return;
  switch (e.keyCode) {
    case 37: moveLeft(); break;       // ←
    case 39: moveRight(); break;      // →
    case 40: softDrop(); break;       // ↓
    case 38: rotate(); break;         // ↑
    case 32: hardDrop(); e.preventDefault(); break; // Space
  }
}

// ===========================================================================
// Touch controls
// ===========================================================================

var touchStartX = 0;
var touchStartY = 0;
var touchStartTime = 0;

function handleTouchStart(e: TouchEvent): void {
  if (e.touches.length !== 1) return;
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  touchStartTime = Date.now();
}

function handleTouchEnd(e: TouchEvent): void {
  if (gameOver || paused) return;
  var touch = e.changedTouches[0];
  if (!touch) return;

  var dx = touch.clientX - touchStartX;
  var dy = touch.clientY - touchStartY;
  var dt = Date.now() - touchStartTime;
  var absDx = Math.abs(dx);
  var absDy = Math.abs(dy);

  // Tap (no significant movement) → rotate
  if (absDx < 15 && absDy < 15 && dt < 300) {
    rotate();
    return;
  }

  // Swipe detection threshold
  if (absDx < 20 && absDy < 20) return;

  if (absDy > absDx) {
    // Vertical swipe
    if (dy > 0) {
      hardDrop();
    }
  } else {
    // Horizontal swipe
    if (dx < 0) { moveLeft(); }
    else { moveRight(); }
  }
}

// ===========================================================================
// Overlay DOM
// ===========================================================================

function buildOverlay(): HTMLElement {
  var el = document.createElement('div');
  el.id = 'tetris-overlay';
  el.className = 'tetris-overlay';
  el.setAttribute('style',
    'position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;' +
    'background:rgba(0,0,0,0.95);display:none;' +
    'display:none;'
  );

  // Use a flex column layout
  el.innerHTML =
    '<div class="tetris-overlay__wrap" style="' +
      'display:-webkit-flex;display:flex;-webkit-flex-direction:column;flex-direction:column;' +
      '-webkit-align-items:center;align-items:center;-webkit-justify-content:center;justify-content:center;' +
      'height:100%;width:100%;padding:12px;' +
    '">' +
      // Header bar
      '<div class="tetris-hud" style="' +
        'display:-webkit-flex;display:flex;width:100%;max-width:' + (COLS * CELL_PX) + 'px;' +
        '-webkit-justify-content:space-between;justify-content:space-between;' +
        'color:#fff;font-size:13px;font-family:monospace;margin-bottom:8px;' +
        '-webkit-flex-wrap:wrap;flex-wrap:wrap;gap:4px;' +
      '">' +
        '<span id="tetris-score">Score: 0</span>' +
        '<span id="tetris-level">Level: 0</span>' +
        '<span id="tetris-lines">Lines: 0</span>' +
      '</div>' +
      // Canvas
      '<canvas id="tetris-canvas" width="' + (COLS * CELL_PX) + '" height="' + (ROWS * CELL_PX) + '" ' +
        'style="border:2px solid #444;background:#111;touch-action:none;max-width:100%;max-height:70vh;"></canvas>' +
      // Game over banner
      '<div id="tetris-gameover" style="display:none;color:#ff4444;font-size:1.3rem;margin-top:12px;font-weight:bold;">GAME OVER</div>' +
      // Buttons
      '<div style="display:-webkit-flex;display:flex;gap:12px;margin-top:14px;-webkit-flex-wrap:wrap;flex-wrap:wrap;-webkit-justify-content:center;justify-content:center;">' +
        '<button id="tetris-restart" class="tetris-btn">&#x1F504; Restart</button>' +
        '<button id="tetris-reset" class="tetris-btn tetris-btn--danger">&#x1F5D1; Reset Progress</button>' +
        '<button id="tetris-close" class="tetris-btn">&#x274C; Close</button>' +
      '</div>' +
      // Touch hint
      '<div style="color:#666;font-size:11px;margin-top:10px;text-align:center;">' +
        'Tap=Rotate &nbsp; Swipe&larr;&rarr;=Move &nbsp; Swipe&darr;=Drop' +
      '</div>' +
    '</div>';

  document.body.appendChild(el);
  return el;
}

function styleButtons(): void {
  // Inject a tiny <style> block — keeps everything in this module
  var style = document.createElement('style');
  style.textContent =
    '.tetris-btn{' +
      'padding:10px 18px;font-size:14px;border:1px solid #555;border-radius:8px;' +
      'background:#222;color:#fff;cursor:pointer;min-width:44px;min-height:44px;' +
      '-webkit-tap-highlight-color:rgba(255,255,255,0.1);' +
    '}' +
    '.tetris-btn:active{background:#444;}' +
    '.tetris-btn--danger{border-color:#c0392b;color:#e74c3c;}' +
    '.tetris-btn--danger:active{background:#3a1010;}';
  document.head.appendChild(style);
}

// ===========================================================================
// Start / stop
// ===========================================================================

function startGame(): void {
  var saved = loadProgress();
  level = saved.level;
  totalLines = saved.lines;
  score = saved.score;
  board = createBoard();
  gameOver = false;
  paused = false;
  spawnPiece();
  draw();
  scheduleTick();
}

function restartGame(): void {
  clearTimeout(tickTimer);
  // Keep level/progress — just start a fresh board
  board = createBoard();
  gameOver = false;
  paused = false;
  spawnPiece();
  draw();
  scheduleTick();
}

function resetGame(): void {
  clearTimeout(tickTimer);
  clearProgress();
  level = 0;
  totalLines = 0;
  score = 0;
  board = createBoard();
  gameOver = false;
  paused = false;
  spawnPiece();
  draw();
  scheduleTick();
}

function showOverlay(): void {
  if (!overlay) {
    overlay = buildOverlay();
    styleButtons();

    canvas = document.getElementById('tetris-canvas') as HTMLCanvasElement;
    ctx = canvas ? canvas.getContext('2d') : null;
    scoreLabel = document.getElementById('tetris-score');
    levelLabel = document.getElementById('tetris-level');
    linesLabel = document.getElementById('tetris-lines');
    gameOverBanner = document.getElementById('tetris-gameover');

    // Button handlers
    var restartBtn = document.getElementById('tetris-restart');
    var resetBtn = document.getElementById('tetris-reset');
    var closeBtn = document.getElementById('tetris-close');

    if (restartBtn) restartBtn.addEventListener('click', restartGame);
    if (resetBtn) resetBtn.addEventListener('click', resetGame);
    if (closeBtn) closeBtn.addEventListener('click', hideOverlay);

    // Touch on canvas
    if (canvas) {
      canvas.addEventListener('touchstart', handleTouchStart, false);
      canvas.addEventListener('touchend', handleTouchEnd, false);
    }
  }

  overlay.style.display = 'block';
  paused = false;
  startGame();
  document.addEventListener('keydown', handleKeyDown, false);
}

function hideOverlay(): void {
  if (overlay) overlay.style.display = 'none';
  paused = true;
  clearTimeout(tickTimer);
  saveProgress();
  document.removeEventListener('keydown', handleKeyDown, false);
}

// ===========================================================================
// Public init — sole integration point
// ===========================================================================

/**
 * Attach the Tetris overlay to a trigger button.
 *
 * @param buttonId  The DOM id of the button that opens the game.
 *                  If the element doesn't exist, this is a no-op.
 */
export function initTetris(buttonId: string): void {
  var btn = document.getElementById(buttonId);
  if (!btn) return;
  btn.addEventListener('click', function () {
    showOverlay();
  });
}
