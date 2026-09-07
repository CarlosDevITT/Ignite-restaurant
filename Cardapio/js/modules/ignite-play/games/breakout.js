export const BREAKOUT_STATE = Object.freeze({ READY: 'ready', PLAYING: 'playing', PAUSED: 'paused', GAME_OVER: 'game_over' });

export function createBreakoutGame({ canvas, onScoreChange, onStateChange } = {}) {
  if (!canvas) throw new Error('createBreakoutGame: canvas é obrigatório.');
  const ctx = canvas.getContext('2d');
  canvas.width = 320; canvas.height = 280;
  let state = BREAKOUT_STATE.READY, raf = null, destroyed = false, score = 0;
  const paddle = { x: 124, y: 255, w: 72, h: 8 };
  const ball = { x: 160, y: 220, r: 5, vx: 3.1, vy: -3.1 };
  let bricks = [];
  const emitState = (next) => { state = next; onStateChange?.(state); };
  const emitScore = (next) => { score = next; onScoreChange?.(score); };
  const buildBricks = () => {
    bricks = [];
    const cols = 7, rows = 5, gap = 5, w = 38, h = 13, startX = 13, startY = 24;
    for (let r=0;r<rows;r++) for (let c=0;c<cols;c++) bricks.push({ x:startX+c*(w+gap), y:startY+r*(h+gap), w, h, alive:true });
  };
  const reset = () => { paddle.x=124; ball.x=160; ball.y=220; ball.vx=3.1; ball.vy=-3.1; emitScore(0); buildBricks(); draw(); };
  const draw = () => {
    ctx.clearRect(0,0,320,280); ctx.fillStyle='#173216';
    bricks.forEach(b=>{ if(b.alive) ctx.fillRect(b.x,b.y,b.w,b.h); });
    ctx.fillRect(paddle.x,paddle.y,paddle.w,paddle.h);
    ctx.beginPath(); ctx.arc(ball.x,ball.y,ball.r,0,Math.PI*2); ctx.fill();
  };
  const intersects = (b) => ball.x+ball.r>=b.x && ball.x-ball.r<=b.x+b.w && ball.y+ball.r>=b.y && ball.y-ball.r<=b.y+b.h;
  const frame = () => {
    if (destroyed || state!==BREAKOUT_STATE.PLAYING) return;
    ball.x += ball.vx; ball.y += ball.vy;
    if (ball.x-ball.r<=0 || ball.x+ball.r>=320) ball.vx *= -1;
    if (ball.y-ball.r<=0) ball.vy = Math.abs(ball.vy);
    if (ball.vy>0 && ball.y+ball.r>=paddle.y && ball.y-ball.r<=paddle.y+paddle.h && ball.x>=paddle.x && ball.x<=paddle.x+paddle.w) {
      ball.y=paddle.y-ball.r; ball.vy=-Math.abs(ball.vy); ball.vx += ((ball.x-(paddle.x+paddle.w/2))/(paddle.w/2))*.8;
    }
    const brick = bricks.find(b=>b.alive && intersects(b));
    if (brick) { brick.alive=false; ball.vy*=-1; emitScore(score+10); }
    if (!bricks.some(b=>b.alive)) { cancelAnimationFrame(raf); raf=null; emitScore(score+100); emitState(BREAKOUT_STATE.GAME_OVER); draw(); return; }
    if (ball.y-ball.r>280) { cancelAnimationFrame(raf); raf=null; emitState(BREAKOUT_STATE.GAME_OVER); draw(); return; }
    draw(); raf=requestAnimationFrame(frame);
  };
  const start=()=>{ if(destroyed||state===BREAKOUT_STATE.PLAYING)return; if(state===BREAKOUT_STATE.GAME_OVER) reset(); emitState(BREAKOUT_STATE.PLAYING); raf=requestAnimationFrame(frame); };
  const pause=()=>{ if(state!==BREAKOUT_STATE.PLAYING)return; cancelAnimationFrame(raf); raf=null; emitState(BREAKOUT_STATE.PAUSED); };
  const resume=()=>{ if(state!==BREAKOUT_STATE.PAUSED)return; emitState(BREAKOUT_STATE.PLAYING); raf=requestAnimationFrame(frame); };
  const restart=()=>{ cancelAnimationFrame(raf); raf=null; reset(); emitState(BREAKOUT_STATE.READY); };
  const setDirection=(dir)=>{ const delta=dir==='left'?-32:dir==='right'?32:0; paddle.x=Math.max(0,Math.min(320-paddle.w,paddle.x+delta)); draw(); };
  const destroy=()=>{ destroyed=true; cancelAnimationFrame(raf); ctx.clearRect(0,0,320,280); };
  reset(); onStateChange?.(state);
  return { start,pause,resume,restart,setDirection,destroy,getScore:()=>score,getState:()=>state };
}
