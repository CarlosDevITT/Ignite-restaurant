// Ignite Play — mini game exibido enquanto o cliente aguarda o pedido.
// Não importa Supabase nem o serviço de pedidos: recebe apenas orderId/orderNumber
// via show() e um callback onClose. Quem decide QUANDO fechar é quem chama show()/hide(),
// observando o pedido pela infraestrutura já existente (ver js/app.js).
//
// Pedido/Supabase → Order Tracking → IgnitePlay (este módulo) → Snake

import { createSnakeGame, SNAKE_STATE } from './snake.js';

const STYLE_ID = 'ignite-play-styles';
const BODY_LOCK_CLASS = 'ignite-play-lock';
const SWIPE_THRESHOLD = 24;

const KEY_DIRECTIONS = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right',
  W: 'up', S: 'down', A: 'left', D: 'right',
};

const STATE_COPY = {
  [SNAKE_STATE.READY]: { hint: 'Aperte START ou A para começar', visible: true },
  [SNAKE_STATE.PLAYING]: { hint: '', visible: false },
  [SNAKE_STATE.PAUSED]: { hint: 'PAUSADO — aperte START para continuar', visible: true },
  [SNAKE_STATE.GAME_OVER]: { hint: 'GAME OVER — aperte A para jogar de novo', visible: true },
};

const MARKUP = `
<div class="ignite-play-overlay" role="dialog" aria-modal="true" aria-labelledby="ignite-play-title">
  <div class="ignite-play-console">
    <button type="button" class="ignite-play-close" aria-label="Fechar Ignite Play">&times;</button>
    <div class="ignite-play-topband">
      <span class="ignite-play-topband__mark" aria-hidden="true"></span>
      <span class="ignite-play-topband__text" id="ignite-play-title">IGNITE PLAY</span>
    </div>
    <div class="ignite-play-bezel">
      <div class="ignite-play-screen" data-role="screen">
        <div class="ignite-play-screen__hud">
          <span class="ignite-play-screen__score">SCORE <strong data-role="score">000</strong></span>
          <span class="ignite-play-screen__order" data-role="order-number"></span>
        </div>
        <div class="ignite-play-screen__canvas-wrap" data-role="canvas-wrap">
          <canvas class="ignite-play-canvas" data-role="canvas" aria-hidden="true"></canvas>
          <div class="ignite-play-overlaymsg" data-role="message">
            <p class="ignite-play-overlaymsg__eyebrow">PEDIDO RECEBIDO</p>
            <p class="ignite-play-overlaymsg__body">Enquanto preparamos seu pedido...</p>
            <p class="ignite-play-overlaymsg__cta">JOGUE ENQUANTO ESPERA</p>
            <p class="ignite-play-overlaymsg__hint" data-role="hint"></p>
          </div>
        </div>
        <div class="ignite-play-led">
          <span></span>
          POWER
        </div>
      </div>
    </div>
    <div class="ignite-play-brand">
      <span class="ignite-play-brand__flame" aria-hidden="true"></span>
      <span class="ignite-play-brand__word">IGNITE</span>
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
let onCloseCallback = null;
let previousFocus = null;
let keydownHandler = null;
let touchStart = null;

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

const applyStateCopy = (state) => {
  if (!overlay) return;
  const copy = STATE_COPY[state] || STATE_COPY[SNAKE_STATE.READY];
  const hint = query('hint');
  const message = query('message');
  if (hint) hint.textContent = copy.hint;
  if (message) message.classList.toggle('is-visible', copy.visible);
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

const teardownListeners = () => {
  if (keydownHandler) {
    document.removeEventListener('keydown', keydownHandler);
    keydownHandler = null;
  }
  touchStart = null;
};

const wireControls = () => {
  overlay.querySelectorAll('[data-dir]').forEach((button) => {
    button.addEventListener('click', () => snakeGame?.setDirection(button.dataset.dir));
  });
  overlay.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.action;
      if (action === 'start') handleStartAction();
      else if (action === 'select') IgnitePlay.hide();
      else if (action === 'a') handleAAction();
      else if (action === 'b') handleBAction();
    });
  });
  overlay.querySelector('.ignite-play-close')?.addEventListener('click', () => IgnitePlay.hide());

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
    canvasWrap.addEventListener('touchstart', (event) => {
      const touch = event.changedTouches[0];
      touchStart = { x: touch.clientX, y: touch.clientY };
    }, { passive: true });
    canvasWrap.addEventListener('touchend', (event) => {
      if (!touchStart) return;
      const touch = event.changedTouches[0];
      const dx = touch.clientX - touchStart.x;
      const dy = touch.clientY - touchStart.y;
      touchStart = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD) return;
      const direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      snakeGame?.setDirection(direction);
    }, { passive: true });
  }
};

export const IgnitePlay = {
  show(options = {}) {
    const { orderId = null, orderNumber = '', onClose } = options;

    if (overlay) {
      onCloseCallback = typeof onClose === 'function' ? onClose : null;
      const orderNumberEl = query('order-number');
      if (orderNumberEl) orderNumberEl.textContent = orderNumber ? `Pedido #${orderNumber}` : '';
      return;
    }

    ensureStyles();
    previousFocus = document.activeElement;
    onCloseCallback = typeof onClose === 'function' ? onClose : null;
    currentScore = 0;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = MARKUP.trim();
    overlay = wrapper.firstElementChild;
    overlay.dataset.orderId = orderId != null ? String(orderId) : '';
    document.body.appendChild(overlay);
    document.body.classList.add(BODY_LOCK_CLASS);

    const orderNumberEl = query('order-number');
    if (orderNumberEl) orderNumberEl.textContent = orderNumber ? `Pedido #${orderNumber}` : '';
    const scoreEl = query('score');
    if (scoreEl) scoreEl.textContent = formatScore(0);

    snakeGame = createSnakeGame({
      canvas: query('canvas'),
      onScoreChange: (score) => { currentScore = score; if (scoreEl) scoreEl.textContent = formatScore(score); },
      onStateChange: applyStateCopy,
    });
    applyStateCopy(SNAKE_STATE.READY);
    wireControls();

    requestAnimationFrame(() => overlay?.querySelector('.ignite-play-close')?.focus());
  },

  hide() {
    if (!overlay) return;
    const callback = onCloseCallback;
    snakeGame?.destroy();
    snakeGame = null;
    teardownListeners();
    overlay.remove();
    overlay = null;
    document.body.classList.remove(BODY_LOCK_CLASS);
    onCloseCallback = null;
    // currentScore não é zerado aqui: getScore() continua retornando o último
    // placar até a próxima chamada de show(), que reinicia a pontuação.
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
