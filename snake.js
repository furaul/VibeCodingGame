#!/usr/bin/env node
'use strict';

// ── Terminal helpers ────────────────────────────────────────────────
const stdout = process.stdout;
const stdin = process.stdin;

const ESC = '\x1b[';
const ALT_SCREEN_ON = '\x1b[?1049h';
const ALT_SCREEN_OFF = '\x1b[?1049l';
const CURSOR_HIDE = ESC + '?25l';
const CURSOR_SHOW = ESC + '?25h';
const CLEAR = ESC + '2J' + ESC + 'H';

const COLOR = {
  reset: ESC + '0m',
  bold: ESC + '1m',
  dim: ESC + '2m',
  green: ESC + '32m',
  brightGreen: ESC + '92m',
  red: ESC + '31m',
  yellow: ESC + '33m',
  cyan: ESC + '36m',
  white: ESC + '37m',
  bgGreen: ESC + '42m',
  bgRed: ESC + '41m',
};

function moveTo(x, y) {
  return ESC + (y + 1) + ';' + (x + 1) + 'H';
}

function write(s) {
  stdout.write(s);
}

// ── Game constants ──────────────────────────────────────────────────
const CHARS = {
  head: '●',
  body: '○',
  food: '★',
  borderH: '─',
  borderV: '│',
  cornerTL: '┌',
  cornerTR: '┐',
  cornerBL: '└',
  cornerBR: '┘',
};

const DIR = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
};

const OPPOSITE = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' };

const BASE_SPEED = 150; // ms per tick
const SPEED_INCREMENT = 3; // ms faster per food eaten
const MIN_SPEED = 60;

// ── Game state ──────────────────────────────────────────────────────
let gridW = 20;
let gridH = 20;
let offsetX = 2; // left margin in terminal columns
let offsetY = 1; // top margin in terminal rows

let snake, direction, nextDirection, food, score, gameOver, paused;
let tickTimer = null;
let state = 'menu'; // menu | playing | paused | gameover

function fitGrid() {
  const cols = stdout.columns || 80;
  const rows = stdout.rows || 24;
  // Each cell = 2 chars wide, 1 char tall; +2 for border
  gridW = Math.min(30, Math.max(10, Math.floor((cols - 4) / 2) - 1));
  gridH = Math.min(25, Math.max(8, rows - 6));
  offsetX = Math.max(1, Math.floor((cols - (gridW * 2 + 2)) / 2));
  offsetY = Math.max(0, Math.floor((rows - (gridH + 4)) / 2));
}

function initGame() {
  fitGrid();
  const cx = Math.floor(gridW / 2);
  const cy = Math.floor(gridH / 2);
  snake = [
    { x: cx, y: cy },
    { x: cx - 1, y: cy },
    { x: cx - 2, y: cy },
  ];
  direction = 'RIGHT';
  nextDirection = 'RIGHT';
  score = 0;
  gameOver = false;
  paused = false;
  spawnFood();
}

function spawnFood() {
  const occupied = new Set(snake.map((s) => s.x + ',' + s.y));
  const free = [];
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      if (!occupied.has(x + ',' + y)) free.push({ x, y });
    }
  }
  if (free.length === 0) {
    // You win! (extremely unlikely)
    gameOver = true;
    return;
  }
  food = free[Math.floor(Math.random() * free.length)];
}

// ── Tick ────────────────────────────────────────────────────────────
function tick() {
  if (paused || gameOver) return;

  direction = nextDirection;
  const head = snake[0];
  const nh = { x: head.x + DIR[direction].x, y: head.y + DIR[direction].y };

  // Wall collision
  if (nh.x < 0 || nh.x >= gridW || nh.y < 0 || nh.y >= gridH) {
    gameOver = true;
    state = 'gameover';
    stopTick();
    drawGameOver();
    return;
  }

  // Self collision
  for (let i = 0; i < snake.length; i++) {
    if (snake[i].x === nh.x && snake[i].y === nh.y) {
      gameOver = true;
      state = 'gameover';
      stopTick();
      drawGameOver();
      return;
    }
  }

  snake.unshift(nh);

  if (nh.x === food.x && nh.y === food.y) {
    score++;
    spawnFood();
    // Draw new food immediately
    drawCell(food.x, food.y, COLOR.red + COLOR.bold + CHARS.food + COLOR.reset);
  } else {
    // Erase tail
    const tail = snake.pop();
    drawCell(tail.x, tail.y, ' ');
  }

  // Draw new head
  drawCell(nh.x, nh.y, COLOR.brightGreen + COLOR.bold + CHARS.head + COLOR.reset);
  // Previous head becomes body
  if (snake.length > 1) {
    drawCell(snake[1].x, snake[1].y, COLOR.green + CHARS.body + COLOR.reset);
  }

  drawScore();
}

function currentSpeed() {
  return Math.max(MIN_SPEED, BASE_SPEED - score * SPEED_INCREMENT);
}

function startTick() {
  stopTick();
  function loop() {
    tick();
    if (!gameOver && !paused) {
      tickTimer = setTimeout(loop, currentSpeed());
    }
  }
  tickTimer = setTimeout(loop, currentSpeed());
}

function stopTick() {
  if (tickTimer) {
    clearTimeout(tickTimer);
    tickTimer = null;
  }
}

// ── Drawing ─────────────────────────────────────────────────────────
function drawCell(gx, gy, content) {
  // Each grid cell is 2 chars wide; left char is content, right is space
  const tx = offsetX + 1 + gx * 2;
  const ty = offsetY + 1 + gy;
  write(moveTo(tx, ty) + content + ' ');
}

function drawBorder() {
  const w = gridW * 2 + 2;
  // Top
  write(moveTo(offsetX, offsetY) + COLOR.dim);
  write(CHARS.cornerTL + CHARS.borderH.repeat(w - 2) + CHARS.cornerTR);
  // Sides
  for (let y = 0; y < gridH; y++) {
    write(moveTo(offsetX, offsetY + 1 + y) + CHARS.borderV);
    write(moveTo(offsetX + w - 1, offsetY + 1 + y) + CHARS.borderV);
  }
  // Bottom
  write(moveTo(offsetX, offsetY + gridH + 1));
  write(CHARS.cornerBL + CHARS.borderH.repeat(w - 2) + CHARS.cornerBR);
  write(COLOR.reset);
}

function drawScore() {
  const text = ` Score: ${score} `;
  write(moveTo(offsetX + 2, offsetY) + COLOR.yellow + COLOR.bold + text + COLOR.reset + COLOR.dim + CHARS.borderH + COLOR.reset);
}

function drawControls() {
  const y = offsetY + gridH + 2;
  write(moveTo(offsetX, y) + COLOR.dim + ' WASD/Arrows: Move  P: Pause  Q/Esc: Quit' + COLOR.reset);
}

function fullDraw() {
  write(CLEAR);
  drawBorder();
  drawScore();
  drawControls();

  // Draw food
  drawCell(food.x, food.y, COLOR.red + COLOR.bold + CHARS.food + COLOR.reset);

  // Draw snake
  for (let i = snake.length - 1; i >= 0; i--) {
    const s = snake[i];
    if (i === 0) {
      drawCell(s.x, s.y, COLOR.brightGreen + COLOR.bold + CHARS.head + COLOR.reset);
    } else {
      drawCell(s.x, s.y, COLOR.green + CHARS.body + COLOR.reset);
    }
  }
}

function drawPauseMenu() {
  const cx = offsetX + gridW;
  const cy = offsetY + Math.floor(gridH / 2);
  const box = [
    '┌──────────────────────┐',
    '│      ⏸  PAUSED       │',
    '│                      │',
    '│   [C] Continue       │',
    '│   [Q] Quit           │',
    '└──────────────────────┘',
  ];
  for (let i = 0; i < box.length; i++) {
    write(moveTo(cx - 12, cy - 3 + i) + COLOR.cyan + COLOR.bold + box[i] + COLOR.reset);
  }
}

function drawGameOver() {
  const cx = offsetX + gridW;
  const cy = offsetY + Math.floor(gridH / 2);
  const scoreLine = `Score: ${score}`;
  const pad = ' '.repeat(Math.max(0, Math.floor((18 - scoreLine.length) / 2)));
  const box = [
    '┌──────────────────────┐',
    '│     💀 GAME OVER     │',
    '│                      │',
    `│  ${pad}${scoreLine}${' '.repeat(Math.max(0, 18 - pad.length - scoreLine.length))}  │`,
    '│                      │',
    '│   [R] Restart        │',
    '│   [Q] Quit           │',
    '└──────────────────────┘',
  ];
  for (let i = 0; i < box.length; i++) {
    write(moveTo(cx - 12, cy - 4 + i) + COLOR.red + COLOR.bold + box[i] + COLOR.reset);
  }
}

function drawMenu() {
  write(CLEAR);
  fitGrid();
  const cx = offsetX + gridW;
  const cy = offsetY + Math.floor(gridH / 2);
  const title = [
    ' ╔═╗╔╗╔╔═╗╦╔═╔═╗ ',
    ' ╚═╗║║║╠═╣╠╩╗║╣  ',
    ' ╚═╝╝╚╝╩ ╩╩ ╩╚═╝ ',
  ];
  for (let i = 0; i < title.length; i++) {
    write(moveTo(cx - 10, cy - 4 + i) + COLOR.brightGreen + COLOR.bold + title[i] + COLOR.reset);
  }
  write(moveTo(cx - 10, cy) + COLOR.cyan + '  Press ENTER to start' + COLOR.reset);
  write(moveTo(cx - 10, cy + 1) + COLOR.cyan + '  Press Q to quit' + COLOR.reset);
  write(moveTo(cx - 10, cy + 3) + COLOR.dim + '  WASD/Arrows to move' + COLOR.reset);
  write(moveTo(cx - 10, cy + 4) + COLOR.dim + '  Ctrl+Z to suspend' + COLOR.reset);
}

// ── Input handling ──────────────────────────────────────────────────
function handleInput(data) {
  const key = data.toString();

  // Ctrl+C → exit
  if (key === '\x03') {
    cleanup();
    process.exit(0);
  }

  if (state === 'menu') {
    if (key === '\r' || key === '\n' || key === ' ') {
      state = 'playing';
      initGame();
      fullDraw();
      startTick();
    } else if (key === 'q' || key === 'Q' || key === '\x1b') {
      cleanup();
      process.exit(0);
    }
    return;
  }

  if (state === 'gameover') {
    if (key === 'r' || key === 'R') {
      state = 'playing';
      initGame();
      fullDraw();
      startTick();
    } else if (key === 'q' || key === 'Q' || key === '\x1b') {
      cleanup();
      process.exit(0);
    }
    return;
  }

  if (state === 'paused') {
    if (key === 'c' || key === 'C' || key === 'p' || key === 'P') {
      state = 'playing';
      paused = false;
      fullDraw();
      startTick();
    } else if (key === 'q' || key === 'Q' || key === '\x1b') {
      cleanup();
      process.exit(0);
    }
    return;
  }

  // state === 'playing'
  // Arrow keys come as escape sequences: \x1b[A, \x1b[B, \x1b[C, \x1b[D
  if (key === '\x1b[A' || key === 'w' || key === 'W') {
    if (direction !== 'DOWN') nextDirection = 'UP';
  } else if (key === '\x1b[B' || key === 's' || key === 'S') {
    if (direction !== 'UP') nextDirection = 'DOWN';
  } else if (key === '\x1b[D' || key === 'a' || key === 'A') {
    if (direction !== 'RIGHT') nextDirection = 'LEFT';
  } else if (key === '\x1b[C' || key === 'd' || key === 'D') {
    if (direction !== 'LEFT') nextDirection = 'RIGHT';
  } else if (key === 'p' || key === 'P') {
    paused = true;
    state = 'paused';
    stopTick();
    drawPauseMenu();
  } else if (key === 'q' || key === 'Q' || key === '\x1b') {
    cleanup();
    process.exit(0);
  }
}

// ── Signal handling (Ctrl+Z / fg) ───────────────────────────────────
function handleSIGTSTP() {
  // Leaving alternate screen so Claude Code output is visible
  stopTick();
  paused = true;
  write(CURSOR_SHOW + ALT_SCREEN_OFF);
  stdin.setRawMode(false);
  stdin.pause();

  // Re-send SIGTSTP to actually suspend the process
  process.once('SIGCONT', handleSIGCONT);
  process.kill(process.pid, 'SIGSTOP');
}

function handleSIGCONT() {
  // Resumed via `fg`
  stdin.setRawMode(true);
  stdin.resume();
  write(ALT_SCREEN_ON + CURSOR_HIDE);

  if (state === 'playing') {
    state = 'paused';
  }

  if (state === 'paused') {
    fullDraw();
    drawPauseMenu();
  } else if (state === 'gameover') {
    fullDraw();
    drawGameOver();
  } else if (state === 'menu') {
    drawMenu();
  }
}

// ── Lifecycle ───────────────────────────────────────────────────────
function setup() {
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');
  stdin.on('data', handleInput);

  write(ALT_SCREEN_ON + CURSOR_HIDE);

  process.on('SIGTSTP', handleSIGTSTP);

  process.on('SIGWINCH', () => {
    if (state === 'playing' || state === 'paused') {
      fitGrid();
      fullDraw();
      if (state === 'paused') drawPauseMenu();
    } else if (state === 'menu') {
      drawMenu();
    } else if (state === 'gameover') {
      fitGrid();
      fullDraw();
      drawGameOver();
    }
  });
}

function cleanup() {
  stopTick();
  write(CURSOR_SHOW + ALT_SCREEN_OFF);
  stdin.setRawMode(false);
  stdin.pause();
}

// Handle unexpected exit
process.on('exit', () => {
  write(CURSOR_SHOW + ALT_SCREEN_OFF);
});

// ── Main ────────────────────────────────────────────────────────────
setup();
drawMenu();
