// Ignite Play 2.0 — mini game em tela cheia exibido quando o cliente toca no
// CTA "Jogue enquanto espera" em Meus Pedidos (o clique é decidido em
// js/app.js; este módulo não sabe de Supabase nem do serviço de pedidos).
//
// Pedido/Supabase → Order Tracking (orders.js) → app.js → IgnitePlay (aqui) → games/snake.js
//
// Arquitetura pronta para múltiplos jogos: cada jogo é um módulo independente
// em games/*.js seguindo o mesmo contrato de snake.js (start/pause/resume/
// restart/setDirection/destroy/getScore/getState). Trocar de jogo no futuro
// significa importar outro módulo de games/ aqui — nada mais.

import { createSnakeGame, SNAKE_STATE } from './games/snake.js';
import { getHighScore, setHighScoreIfBetter } from './score-store.js';

const GAME_ID = 'snake';
const STYLE_ID = 'ignite-play-styles';
const LOCK_CLASS = 'ignite-play-lock';
const SWIPE_THRESHOLD = 24;

const KEY_DIRECTIONS = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right',
  W: 'up', S: 'down', A: 'left', D: 'right',
};

const MARKUP = `
<div class="ignite-play-overlay" role="dialog" aria-modal="true" aria-labelledby="ignite-play-title">
  <div class="ignite-play-console">
    <header class="ignite-play-header">
      <button type="button" class="ignite-play-iconbtn" data-action="close" aria-label="Fechar Ignite Play"><span aria-hidden="true">&times;</span></button>
      <span class="ignite-play-header__title" id="ignite-play-title">IGNITE PLAY</span>
      <span class="ignite-play-header__dot" aria-hidden="true"></span>
    </header>

    <div class="ignite-play-stage">
      <div class="ignite-play-screen">
        <div class="ignite-play-screen__hud">
          <div class="ignite-play-hud-block">
            <span class="ignite-play-hud-block__label">SCORE</span>
            <strong class="ignite-play-hud-block__value" data-role="score">000</strong>
          </div>
          <div class="ignite-play-hud-block ignite-play-hud-block--best">
            <span class="ignite-play-hud-block__label">HI</span>
            <strong class="ignite-play-hud-block__value" data-role="best">000</strong>
          </div>
        </div>
        <div class="ignite-play-screen__canvas-wrap" data-role="canvas-wrap">
          <canvas class="ignite-play-canvas" data-role="canvas" aria-hidden="true"></canvas>
          <div class="ignite-play-panel" data-role="panel"></div>
        </div>
      </div>
      <div class="ignite-play-brand">
        <span class="ignite-play-brand__flame" aria-hidden="true"></span>
        <span class="ignite-play-brand__word">IGNITE</span>
      </div>
    </div>

    <div class="ignite-play-controls">
      <div class="ignite-play-dpad" role="group" aria-label="Direcionais">
        <button type="button" class="ignite-play-dpad__btn ignite-play-dpad__btn--up" data-dir="up" aria-label="Cima">▲</button>
        <button type="button" class="ignite-play-dpad__btn ignite-play-dpad__btn--left" data-dir="left" aria-label="Esquerda">◀</button>
        <button type="button" class="ignite-play-dpad__btn ignite-play-dpad__btn--right" data-dir="right" aria-label="Direita">▶</button>
        <button type="button" class="ignite-play-dpad__btn ignite-play-dpad__btn--down" data-dir="down" aria-label="Baixo">▼</button>
        <span class="ignite-play-dpad__hub" aria-hidden="true"></span>
      </div>
      <div class="ignite-play-ab">
        <button type="button" class="ignite-play-btn ignite-play-btn--b" data-action="b" aria-label="Botão B: pausar ou sair">B</button>
        <button type="button" class="ignite-play-btn ignite-play-btn--a" data-action="a" aria-label="Botão A: iniciar ou reiniciar">A</button>
      </div>
    </div>
    <div class="ignite-play-meta">
      <button type="button" class="ignite-play-pill" data-action="select" aria-label="Sair do jogo">SELECT</button>
      <button type="button" class="ignite-play-pill" data-action="start" aria-label="Iniciar ou pausar o jogo">START</button>
    </div>
  </div>
</div>`;

let overlay = null;
let snakeGame = null;
let currentScore = 0;
let bestScore = 0;
let currentOrderNumber = '';
let onCloseCallback = null;
let previousFocus = null;
let keydownHandler = null;
let pointerStart = null;

const ensureStyles = () => {
  if (document.getElementById(STYLE_ID)) return;
  const link = document.createElement('link');
  link.id = STYLE_ID;
  link.rel = 'stylesheet';
  link.href = new URL('../../../styles/ignite-play.css', import.meta.url).href;
  document.head.appendChild(link);
};

const query = (role) => overlay?.querySelector(`[data-role="${role}"]`);

const formatScore = (value) => String(Math.max(0, Math.floor(value))).padStart(3, '0');

const escapeText = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

const buildPanel = (state) => {
  if (state === SNAKE_STATE.READY) {
    return `
      <p class="ignite-play-panel__eyebrow">IGNITE PLAY</p>
      <p class="ignite-play-panel__game">🐍 SNAKE</p>
      <p class="ignite-play-panel__tagline">JOGUE ENQUANTO ESPERA</p>
      ${currentOrderNumber ? `<p class="ignite-play-panel__order">Pedido #${escapeText(currentOrderNumber)}</p>` : ''}
      <p class="ignite-play-panel__hint">START / A — COMEÇAR</p>`;
  }
  if (state === SNAKE_STATE.PAUSED) {
    return `
      <p class="ignite-play-panel__eyebrow">PAUSADO</p>
      <p class="ignite-play-panel__note">Seu pedido continua sendo preparado.</p>
      <p class="ignite-play-panel__hint">START — continuar</p>
      <p class="ignite-play-panel__hint">B — sair</p>`;
  }
  if (state === SNAKE_STATE.GAME_OVER) {
    return `
      <p class="ignite-play-panel__eyebrow">GAME OVER</p>
      <div class="ignite-play-panel__scores">
        <div class="ignite-play-panel__score"><span>SCORE</span><strong>${formatScore(currentScore)}</strong></div>
        <div class="ignite-play-panel__score"><span>🏆 RECORDE</span><strong>${formatScore(bestScore)}</strong></div>
      </div>
      <p class="ignite-play-panel__hint">A — jogar novamente</p>
      <p class="ignite-play-panel__hint">B — voltar ao pedido</p>`;
  }
  return '';
};

const applyState = (state) => {
  if (!overlay) return;
  if (state === SNAKE_STATE.GAME_OVER) {
    bestScore = setHighScoreIfBetter(GAME_ID, currentScore);
    const bestEl = query('best');
    if (bestEl) bestEl.textContent = formatScore(bestScore);
  }
  const panel = query('panel');
  if (panel) {
    panel.innerHTML = buildPanel(state);
    panel.classList.toggle('is-visible', state !== SNAKE_STATE.PLAYING);
  }
  overlay.dataset.state = state;
};

const handleStartAction = () => {
  if (!snakeGame) return;
  const state = snakeGame.getState();
  if (state === SNAKE_STATE.PLAYING) snakeGame.pause();
  else if (state === SNAKE_STATE.PAUSED) snakeGame.resume();
  else snakeGame.start();
};

const handleAAction = () => {
  if (!snakeGame) return;
  const state = snakeGame.getState();
  if (state === SNAKE_STATE.PAUSED) snakeGame.resume();
  else if (state !== SNAKE_STATE.PLAYING) snakeGame.start();
};

const handleBAction = () => {
  if (!snakeGame) return;
  if (snakeGame.getState() === SNAKE_STATE.PLAYING) snakeGame.pause();
  else IgnitePlay.hide();
};

const setPressed = (button, pressed) => button.classList.toggle('is-pressed', pressed);

const teardownListeners = () => {
  if (keydownHandler) {
    document.removeEventListener('keydown', keydownHandler);
    keydownHandler = null;
  }
  pointerStart = null;
};

const wireControls = () => {
  const pressableButtons = overlay.querySelectorAll('.ignite-play-dpad__btn, .ignite-play-btn, .ignite-play-pill, .ignite-play-iconbtn');
  pressableButtons.forEach((button) => {
    button.addEventListener('pointerdown', () => setPressed(button, true));
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((type) => {
      button.addEventListener(type, () => setPressed(button, false));
    });
  });

  overlay.querySelectorAll('[data-dir]').forEach((button) => {
    button.addEventListener('click', () => snakeGame?.setDirection(button.dataset.dir));
  });

  overlay.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.action;
      if (action === 'start') handleStartAction();
      else if (action === 'select' || action === 'close') IgnitePlay.hide();
      else if (action === 'a') handleAAction();
      else if (action === 'b') handleBAction();
    });
  });

  keydownHandler = (event) => {
    if (!overlay) return;
    const direction = KEY_DIRECTIONS[event.key];
    if (direction) { event.preventDefault(); snakeGame?.setDirection(direction); return; }
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); handleStartAction(); return; }
    if (event.key === 'Escape') { event.preventDefault(); IgnitePlay.hide(); }
  };
  document.addEventListener('keydown', keydownHandler);

  const canvasWrap = query('canvas-wrap');
  if (canvasWrap) {
    canvasWrap.addEventListener('pointerdown', (event) => {
      pointerStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
    });
    canvasWrap.addEventListener('pointerup', (event) => {
      if (!pointerStart || event.pointerId !== pointerStart.id) { pointerStart = null; return; }
      const dx = event.clientX - pointerStart.x;
      const dy = event.clientY - pointerStart.y;
      pointerStart = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD) return;
      const direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      snakeGame?.setDirection(direction);
    });
    canvasWrap.addEventListener('pointercancel', () => { pointerStart = null; });
  }
};

export const IgnitePlay = {
  show(options = {}) {
    const { orderId = null, orderNumber = '', onClose } = options;

    if (overlay) {
      onCloseCallback = typeof onClose === 'function' ? onClose : null;
      currentOrderNumber = orderNumber ? String(orderNumber) : '';
      return;
    }

    ensureStyles();
    previousFocus = document.activeElement;
    onCloseCallback = typeof onClose === 'function' ? onClose : null;
    currentOrderNumber = orderNumber ? String(orderNumber) : '';
    currentScore = 0;
    bestScore = getHighScore(GAME_ID);

    const wrapper = document.createElement('div');
    wrapper.innerHTML = MARKUP.trim();
    overlay = wrapper.firstElementChild;
    overlay.dataset.orderId = orderId != null ? String(orderId) : '';

    document.documentElement.classList.add(LOCK_CLASS);
    document.body.classList.add(LOCK_CLASS);
    document.body.appendChild(overlay);

    const scoreEl = query('score');
    const bestEl = query('best');
    if (scoreEl) scoreEl.textContent = formatScore(0);
    if (bestEl) bestEl.textContent = formatScore(bestScore);

    snakeGame = createSnakeGame({
      canvas: query('canvas'),
      onScoreChange: (score) => {
        currentScore = score;
        if (scoreEl) scoreEl.textContent = formatScore(score);
      },
      onStateChange: applyState,
    });
    applyState(SNAKE_STATE.READY);
    wireControls();

    requestAnimationFrame(() => overlay?.querySelector('[data-action="close"]')?.focus());
  },

  hide() {
    if (!overlay) return;
    const callback = onCloseCallback;
    snakeGame?.destroy();
    snakeGame = null;
    teardownListeners();
    overlay.remove();
    overlay = null;
    document.documentElement.classList.remove(LOCK_CLASS);
    document.body.classList.remove(LOCK_CLASS);
    onCloseCallback = null;
    if (previousFocus instanceof HTMLElement) previousFocus.focus();
    previousFocus = null;
    callback?.();
  },

  destroy() {
    IgnitePlay.hide();
  },

  isOpen() {
    return overlay !== null;
  },

  getScore() {
    return currentScore;
  },
};

export default IgnitePlay;
