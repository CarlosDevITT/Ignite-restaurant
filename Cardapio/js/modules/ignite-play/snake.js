// Ignite Play — motor do Snake.
// Não depende de Supabase, de pedidos ou de qualquer estado externo:
// recebe um <canvas> e comandos de alto nível, e devolve estado/pontuação via callbacks.

export const SNAKE_STATE = Object.freeze({
  READY: 'ready',
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAME_OVER: 'game_over',
});

const DIRECTIONS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

const BASE_INTERVAL_MS = 170;
const MIN_INTERVAL_MS = 75;
const INTERVAL_STEP_MS = 6;
const POINTS_PER_FOOD = 10;

export function createSnakeGame({
  canvas,
  cols = 16,
  rows = 14,
  cellSize = 10,
  pixelColor = '#173216',
  onScoreChange,
  onStateChange,
} = {}) {
  if (!canvas) throw new Error('createSnakeGame: canvas é obrigatório.');
  const ctx = canvas.getContext('2d');
  canvas.width = cols * cellSize;
  canvas.height = rows * cellSize;

  let snake = [];
  let food = null;
  let direction = 'right';
  let pendingDirection = 'right';
  let score = 0;
  let intervalMs = BASE_INTERVAL_MS;
  let accumulator = 0;
  let lastTimestamp = 0;
  let rafId = null;
  let state = SNAKE_STATE.READY;
  let destroyed = false;

  const setState = (next) => {
    if (state === next) return;
    state = next;
    onStateChange?.(state);
  };

  const setScore = (next) => {
    score = next;
    onScoreChange?.(score);
  };

  const randomEmptyCell = () => {
    const occupied = new Set(snake.map((segment) => `${segment.x}:${segment.y}`));
    const free = [];
    for (let x = 0; x < cols; x += 1) {
      for (let y = 0; y < rows; y += 1) {
        if (!occupied.has(`${x}:${y}`)) free.push({ x, y });
      }
    }
    if (!free.length) return null;
    return free[Math.floor(Math.random() * free.length)];
  };

  const draw = () => {
    if (destroyed) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = pixelColor;
    snake.forEach((segment, index) => {
      const inset = index === 0 ? 0.5 : 1;
      ctx.fillRect(
        segment.x * cellSize + inset,
        segment.y * cellSize + inset,
        cellSize - inset * 2,
        cellSize - inset * 2,
      );
    });
    if (food) {
      const cx = food.x * cellSize + cellSize / 2;
      const cy = food.y * cellSize + cellSize / 2;
      const arm = cellSize * 0.38;
      const thick = cellSize * 0.24;
      ctx.fillRect(cx - thick / 2, cy - arm, thick, arm * 2);
      ctx.fillRect(cx - arm, cy - thick / 2, arm * 2, thick);
    }
  };

  const reset = () => {
    const startY = Math.floor(rows / 2);
    const startX = Math.floor(cols / 2);
    snake = [
      { x: startX - 1, y: startY },
      { x: startX - 2, y: startY },
      { x: startX - 3, y: startY },
    ];
    direction = 'right';
    pendingDirection = 'right';
    intervalMs = BASE_INTERVAL_MS;
    accumulator = 0;
    lastTimestamp = 0;
    setScore(0);
    food = randomEmptyCell();
    draw();
  };

  const stopLoop = () => {
    if (rafId != null) cancelAnimationFrame(rafId);
    rafId = null;
    lastTimestamp = 0;
  };

  const gameOver = () => {
    stopLoop();
    setState(SNAKE_STATE.GAME_OVER);
  };

  const step = () => {
    direction = pendingDirection;
    const delta = DIRECTIONS[direction];
    const head = snake[0];
    const next = { x: head.x + delta.x, y: head.y + delta.y };

    if (next.x < 0 || next.x >= cols || next.y < 0 || next.y >= rows) { gameOver(); return; }
    if (snake.some((segment) => segment.x === next.x && segment.y === next.y)) { gameOver(); return; }

    snake.unshift(next);
    if (food && next.x === food.x && next.y === food.y) {
      setScore(score + POINTS_PER_FOOD);
      intervalMs = Math.max(MIN_INTERVAL_MS, intervalMs - INTERVAL_STEP_MS);
      food = randomEmptyCell();
      if (!food) { gameOver(); return; }
    } else {
      snake.pop();
    }
    draw();
  };

  const loop = (timestamp) => {
    if (destroyed || state !== SNAKE_STATE.PLAYING) return;
    if (!lastTimestamp) lastTimestamp = timestamp;
    accumulator += timestamp - lastTimestamp;
    lastTimestamp = timestamp;
    while (accumulator >= intervalMs && state === SNAKE_STATE.PLAYING) {
      step();
      accumulator -= intervalMs;
    }
    if (!destroyed && state === SNAKE_STATE.PLAYING) rafId = requestAnimationFrame(loop);
  };

  const start = () => {
    if (destroyed || state === SNAKE_STATE.PLAYING) return;
    if (state === SNAKE_STATE.GAME_OVER) reset();
    setState(SNAKE_STATE.PLAYING);
    lastTimestamp = 0;
    accumulator = 0;
    rafId = requestAnimationFrame(loop);
  };

  const pause = () => {
    if (destroyed || state !== SNAKE_STATE.PLAYING) return;
    stopLoop();
    setState(SNAKE_STATE.PAUSED);
  };

  const resume = () => {
    if (destroyed || state !== SNAKE_STATE.PAUSED) return;
    setState(SNAKE_STATE.PLAYING);
    lastTimestamp = 0;
    rafId = requestAnimationFrame(loop);
  };

  const restart = () => {
    if (destroyed) return;
    stopLoop();
    reset();
    setState(SNAKE_STATE.READY);
  };

  const setDirection = (nextDirection) => {
    if (destroyed || !DIRECTIONS[nextDirection]) return;
    if (state !== SNAKE_STATE.PLAYING && state !== SNAKE_STATE.READY) return;
    if (OPPOSITE[nextDirection] === direction) return;
    pendingDirection = nextDirection;
  };

  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    stopLoop();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const getScore = () => score;
  const getState = () => state;

  reset();
  onStateChange?.(state);
  onScoreChange?.(score);

  return { start, pause, resume, restart, setDirection, destroy, getScore, getState };
}
