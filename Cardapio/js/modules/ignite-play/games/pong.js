export const PONG_STATE = Object.freeze({ READY: 'ready', PLAYING: 'playing', PAUSED: 'paused', GAME_OVER: 'game_over' });

export function createPongGame({ canvas, onScoreChange, onStateChange } = {}) {
  if (!canvas) throw new Error('createPongGame: canvas é obrigatório.');
  const ctx = canvas.getContext('2d');
  canvas.width = 320; canvas.height = 280;
  let state = PONG_STATE.READY, raf = null, destroyed = false, score = 0;
  const paddle = { x: 18, y: 109, w: 8, h: 62 };
  const ai = { x: 294, y: 109, w: 8, h: 62 };
  const ball = { x: 160, y: 140, r: 5, vx: 3.2, vy: 2.3 };
  const emitState = (next) => { state = next; onStateChange?.(state); };
  const emitScore = (next) => { score = next; onScoreChange?.(score); };
  const resetBall = (dir = 1) => { ball.x = 160; ball.y = 140; ball.vx = 3.2 * dir; ball.vy = (Math.random() > .5 ? 1 : -1) * (1.8 + Math.random() * 1.6); };
  const reset = () => { paddle.y = 109; ai.y = 109; emitScore(0); resetBall(1); draw(); };
  const draw = () => {
    ctx.clearRect(0,0,320,280); ctx.fillStyle = '#173216';
    for (let y=4;y<280;y+=14) ctx.fillRect(158,y,4,7);
    ctx.fillRect(paddle.x,paddle.y,paddle.w,paddle.h); ctx.fillRect(ai.x,ai.y,ai.w,ai.h);
    ctx.beginPath(); ctx.arc(ball.x,ball.y,ball.r,0,Math.PI*2); ctx.fill();
  };
  const hit = (p) => ball.x + ball.r >= p.x && ball.x - ball.r <= p.x+p.w && ball.y+ball.r >= p.y && ball.y-ball.r <= p.y+p.h;
  const frame = () => {
    if (destroyed || state !== PONG_STATE.PLAYING) return;
    const aiTarget = ball.y - ai.h/2; ai.y += Math.sign(aiTarget-ai.y) * 2.55; ai.y = Math.max(0,Math.min(280-ai.h,ai.y));
    ball.x += ball.vx; ball.y += ball.vy;
    if (ball.y-ball.r <= 0 || ball.y+ball.r >= 280) ball.vy *= -1;
    if (ball.vx < 0 && hit(paddle)) { ball.x = paddle.x+paddle.w+ball.r; ball.vx = Math.abs(ball.vx)*1.035; emitScore(score+10); }
    if (ball.vx > 0 && hit(ai)) { ball.x = ai.x-ball.r; ball.vx = -Math.abs(ball.vx)*1.02; }
    if (ball.x > 330) { emitScore(score+50); resetBall(-1); }
    if (ball.x < -10) { cancelAnimationFrame(raf); raf=null; emitState(PONG_STATE.GAME_OVER); draw(); return; }
    draw(); raf = requestAnimationFrame(frame);
  };
  const start = () => { if (destroyed || state===PONG_STATE.PLAYING) return; if (state===PONG_STATE.GAME_OVER) reset(); emitState(PONG_STATE.PLAYING); raf=requestAnimationFrame(frame); };
  const pause = () => { if (state!==PONG_STATE.PLAYING) return; cancelAnimationFrame(raf); raf=null; emitState(PONG_STATE.PAUSED); };
  const resume = () => { if (state!==PONG_STATE.PAUSED) return; emitState(PONG_STATE.PLAYING); raf=requestAnimationFrame(frame); };
  const restart = () => { cancelAnimationFrame(raf); raf=null; reset(); emitState(PONG_STATE.READY); };
  const setDirection = (dir) => { const delta = dir==='up' ? -24 : dir==='down' ? 24 : 0; paddle.y = Math.max(0,Math.min(280-paddle.h,paddle.y+delta)); draw(); };
  const destroy = () => { destroyed=true; cancelAnimationFrame(raf); ctx.clearRect(0,0,320,280); };
  reset(); onStateChange?.(state);
  return { start, pause, resume, restart, setDirection, destroy, getScore:()=>score, getState:()=>state };
}
