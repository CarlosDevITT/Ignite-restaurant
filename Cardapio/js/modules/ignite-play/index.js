// Ignite Play 3.0 — plataforma de minijogos isolada do fluxo de pedidos.
// Fonte oficial: Cardapio/js/modules/ignite-play/

import { getGame, listGames } from './game-registry.js';
import { getHighScore, setHighScoreIfBetter } from './score-store.js';

const STYLE_ID = 'ignite-play-styles';
const LOCK_CLASS = 'ignite-play-lock';
const SWIPE_THRESHOLD = 24;
const KEY_DIRECTIONS = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right',
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
          <div class="ignite-play-hud-block"><span class="ignite-play-hud-block__label">SCORE</span><strong class="ignite-play-hud-block__value" data-role="score">000</strong></div>
          <div class="ignite-play-hud-block ignite-play-hud-block--best"><span class="ignite-play-hud-block__label">HI</span><strong class="ignite-play-hud-block__value" data-role="best">000</strong></div>
        </div>
        <div class="ignite-play-screen__canvas-wrap" data-role="canvas-wrap">
          <canvas class="ignite-play-canvas" data-role="canvas" aria-hidden="true"></canvas>
          <div class="ignite-play-panel" data-role="panel"></div>
        </div>
      </div>
      <div class="ignite-play-brand"><span class="ignite-play-brand__flame" aria-hidden="true"></span><span class="ignite-play-brand__word">IGNITE</span></div>
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
        <button type="button" class="ignite-play-btn ignite-play-btn--b" data-action="b" aria-label="Botão B: pausar ou voltar">B</button>
        <button type="button" class="ignite-play-btn ignite-play-btn--a" data-action="a" aria-label="Botão A: iniciar ou reiniciar">A</button>
      </div>
    </div>
    <div class="ignite-play-meta">
      <button type="button" class="ignite-play-pill" data-action="select" aria-label="Voltar aos jogos">SELECT</button>
      <button type="button" class="ignite-play-pill" data-action="start" aria-label="Iniciar ou pausar o jogo">START</button>
    </div>
  </div>
</div>`;

let overlay = null;
let activeGame = null;
let activeMeta = null;
let currentScore = 0;
let bestScore = 0;
let currentOrderNumber = '';
let onCloseCallback = null;
let previousFocus = null;
let keydownHandler = null;
let pointerStart = null;

const ensureStyles = () => {
  if (document.getElementById(STYLE_ID)) return;
  const link = document.createElement('link'); link.id = STYLE_ID; link.rel = 'stylesheet';
  link.href = new URL('../../../styles/ignite-play.css', import.meta.url).href; document.head.appendChild(link);
};
const query = (role) => overlay?.querySelector(`[data-role="${role}"]`);
const formatScore = (value) => String(Math.max(0, Math.floor(value))).padStart(3, '0');
const escapeText = (value) => String(value).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const gameMenuMarkup = () => `
  <div class="ignite-play-library">
    <p class="ignite-play-panel__eyebrow">IGNITE PLAY</p>
    <p class="ignite-play-panel__tagline">ESCOLHA UM JOGO</p>
    ${currentOrderNumber ? `<p class="ignite-play-panel__order">Pedido #${escapeText(currentOrderNumber)}</p>` : ''}
    <div class="ignite-play-library__grid">
      ${listGames().map((game) => `<button type="button" class="ignite-play-game-card" data-game-id="${game.id}"><span class="ignite-play-game-card__icon">${game.icon}</span><strong>${game.name}</strong><small>${game.description}</small><em>${game.controls}</em></button>`).join('')}
    </div>
    <p class="ignite-play-panel__hint">Seu pedido continua sendo acompanhado enquanto você joga.</p>
  </div>`;

const buildPanel = (state) => {
  if (!activeMeta) return gameMenuMarkup();
  if (state === 'ready') return `<p class="ignite-play-panel__eyebrow">${activeMeta.icon} ${activeMeta.name.toUpperCase()}</p><p class="ignite-play-panel__tagline">${activeMeta.description}</p>${currentOrderNumber ? `<p class="ignite-play-panel__order">Pedido #${escapeText(currentOrderNumber)}</p>` : ''}<p class="ignite-play-panel__note">${activeMeta.controls}</p><p class="ignite-play-panel__hint">START / A — COMEÇAR</p><p class="ignite-play-panel__hint">SELECT — escolher outro jogo</p>`;
  if (state === 'paused') return `<p class="ignite-play-panel__eyebrow">PAUSADO</p><p class="ignite-play-panel__game">${activeMeta.icon} ${activeMeta.name}</p><p class="ignite-play-panel__note">Seu pedido continua sendo preparado.</p><p class="ignite-play-panel__hint">START — continuar · B/SELECT — jogos</p>`;
  if (state === 'game_over') return `<p class="ignite-play-panel__eyebrow">GAME OVER</p><p class="ignite-play-panel__game">${activeMeta.icon} ${activeMeta.name}</p><div class="ignite-play-panel__scores"><div class="ignite-play-panel__score"><span>SCORE</span><strong>${formatScore(currentScore)}</strong></div><div class="ignite-play-panel__score"><span>🏆 RECORDE</span><strong>${formatScore(bestScore)}</strong></div></div><p class="ignite-play-panel__hint">A — jogar novamente · B/SELECT — jogos</p>`;
  return '';
};

const renderPanel = (state) => {
  if (!overlay) return;
  if (state === 'game_over' && activeMeta) {
    bestScore = setHighScoreIfBetter(activeMeta.id, currentScore);
    const best = query('best'); if (best) best.textContent = formatScore(bestScore);
  }
  const panel = query('panel');
  if (panel) { panel.innerHTML = buildPanel(state); panel.classList.toggle('is-visible', !activeMeta || state !== 'playing'); }
  overlay.dataset.state = activeMeta ? state : 'library';
};

const destroyActiveGame = () => { activeGame?.destroy(); activeGame = null; activeMeta = null; currentScore = 0; };
const showLibrary = () => {
  activeGame?.destroy(); activeGame = null; activeMeta = null; currentScore = 0; bestScore = 0;
  const score = query('score'); const best = query('best'); if (score) score.textContent='000'; if (best) best.textContent='000';
  renderPanel('library'); requestAnimationFrame(() => overlay?.querySelector('[data-game-id]')?.focus());
};
const launchGame = (gameId) => {
  const meta = getGame(gameId); if (!meta || !overlay) return;
  activeGame?.destroy(); activeMeta = meta; currentScore = 0; bestScore = getHighScore(meta.id);
  const score = query('score'); const best = query('best'); if (score) score.textContent='000'; if (best) best.textContent=formatScore(bestScore);
  activeGame = meta.create({ canvas: query('canvas'), onScoreChange: (value) => { currentScore=value; if(score)score.textContent=formatScore(value); }, onStateChange: renderPanel });
  renderPanel(activeGame.getState());
};

const handleStart = () => { if (!activeGame) return; const s=activeGame.getState(); if(s==='playing')activeGame.pause(); else if(s==='paused')activeGame.resume(); else activeGame.start(); };
const handleA = () => { if (!activeGame) return; const s=activeGame.getState(); if(s==='paused')activeGame.resume(); else if(s!=='playing')activeGame.start(); };
const handleB = () => { if (!activeGame) { IgnitePlay.hide(); return; } if(activeGame.getState()==='playing') activeGame.pause(); else showLibrary(); };
const setPressed = (button, pressed) => button.classList.toggle('is-pressed', pressed);
const teardownListeners = () => { if(keydownHandler){document.removeEventListener('keydown',keydownHandler);keydownHandler=null;} pointerStart=null; };

const wireControls = () => {
  overlay.querySelectorAll('.ignite-play-dpad__btn,.ignite-play-btn,.ignite-play-pill,.ignite-play-iconbtn').forEach((button) => {
    button.addEventListener('pointerdown',()=>setPressed(button,true)); ['pointerup','pointercancel','pointerleave'].forEach((type)=>button.addEventListener(type,()=>setPressed(button,false)));
  });
  overlay.addEventListener('click',(event)=>{
    const gameButton=event.target.closest('[data-game-id]'); if(gameButton){launchGame(gameButton.dataset.gameId);return;}
    const dirButton=event.target.closest('[data-dir]'); if(dirButton){activeGame?.setDirection(dirButton.dataset.dir);return;}
    const actionButton=event.target.closest('[data-action]'); if(!actionButton)return;
    const action=actionButton.dataset.action;
    if(action==='close')IgnitePlay.hide(); else if(action==='select'){ if(activeGame)showLibrary(); else IgnitePlay.hide(); } else if(action==='start')handleStart(); else if(action==='a')handleA(); else if(action==='b')handleB();
  });
  keydownHandler=(event)=>{
    if(!overlay)return; const dir=KEY_DIRECTIONS[event.key];
    if(dir&&activeGame){event.preventDefault();activeGame.setDirection(dir);return;}
    if((event.key==='Enter'||event.key===' ')&&activeGame){event.preventDefault();handleStart();return;}
    if(event.key==='Escape'){event.preventDefault(); if(activeGame)showLibrary(); else IgnitePlay.hide();}
  }; document.addEventListener('keydown',keydownHandler);
  const wrap=query('canvas-wrap');
  wrap?.addEventListener('pointerdown',(event)=>{pointerStart={x:event.clientX,y:event.clientY,id:event.pointerId};});
  wrap?.addEventListener('pointerup',(event)=>{if(!pointerStart||event.pointerId!==pointerStart.id){pointerStart=null;return;}const dx=event.clientX-pointerStart.x,dy=event.clientY-pointerStart.y;pointerStart=null;if(Math.max(Math.abs(dx),Math.abs(dy))<SWIPE_THRESHOLD)return;activeGame?.setDirection(Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up'));});
  wrap?.addEventListener('pointercancel',()=>{pointerStart=null;});
};

export const IgnitePlay = {
  show(options={}) {
    const { orderId=null, orderNumber='', onClose, gameId=null }=options;
    if(overlay){ onCloseCallback?.(); overlay.dataset.orderId=orderId!=null?String(orderId):''; onCloseCallback=typeof onClose==='function'?onClose:null; currentOrderNumber=orderNumber?String(orderNumber):''; if(gameId)getGame(gameId)&&launchGame(gameId); return; }
    ensureStyles(); previousFocus=document.activeElement; onCloseCallback=typeof onClose==='function'?onClose:null; currentOrderNumber=orderNumber?String(orderNumber):'';
    const wrapper=document.createElement('div');wrapper.innerHTML=MARKUP.trim();overlay=wrapper.firstElementChild;overlay.dataset.orderId=orderId!=null?String(orderId):'';
    document.documentElement.classList.add(LOCK_CLASS);document.body.classList.add(LOCK_CLASS);document.body.appendChild(overlay);wireControls();
    if(gameId&&getGame(gameId))launchGame(gameId);else showLibrary();
  },
  hide() {
    if(!overlay)return;const callback=onCloseCallback;destroyActiveGame();teardownListeners();overlay.remove();overlay=null;document.documentElement.classList.remove(LOCK_CLASS);document.body.classList.remove(LOCK_CLASS);onCloseCallback=null;if(previousFocus instanceof HTMLElement)previousFocus.focus();previousFocus=null;callback?.();
  },
  destroy(){IgnitePlay.hide();}, isOpen(){return overlay!==null;}, getScore(){return currentScore;}, getActiveGame(){return activeMeta?.id||null;}, listGames,
};

export default IgnitePlay;
