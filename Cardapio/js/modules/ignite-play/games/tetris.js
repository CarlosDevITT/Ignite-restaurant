export const TETRIS_STATE = Object.freeze({ READY:'ready', PLAYING:'playing', PAUSED:'paused', GAME_OVER:'game_over' });

const SHAPES = [
  [[1,1,1,1]], [[1,1],[1,1]], [[0,1,0],[1,1,1]], [[1,0,0],[1,1,1]], [[0,0,1],[1,1,1]], [[0,1,1],[1,1,0]], [[1,1,0],[0,1,1]],
];

export function createTetrisGame({ canvas, onScoreChange, onStateChange } = {}) {
  if(!canvas) throw new Error('createTetrisGame: canvas é obrigatório.');
  const ctx=canvas.getContext('2d'), cols=10, rows=18, cell=14;
  canvas.width=cols*cell; canvas.height=rows*cell;
  let board=[], piece=null, state=TETRIS_STATE.READY, score=0, timer=null, destroyed=false, dropMs=520;
  const emitState=n=>{state=n;onStateChange?.(state);}; const emitScore=n=>{score=n;onScoreChange?.(score);};
  const empty=()=>Array.from({length:rows},()=>Array(cols).fill(0));
  const newPiece=()=>({ shape:SHAPES[Math.floor(Math.random()*SHAPES.length)].map(r=>[...r]), x:3, y:0 });
  const collide=(p,dx=0,dy=0,shape=p.shape)=>shape.some((row,y)=>row.some((v,x)=>v&&(p.y+y+dy>=rows||p.x+x+dx<0||p.x+x+dx>=cols||(p.y+y+dy>=0&&board[p.y+y+dy][p.x+x+dx]))));
  const merge=()=>piece.shape.forEach((row,y)=>row.forEach((v,x)=>{if(v&&piece.y+y>=0)board[piece.y+y][piece.x+x]=1;}));
  const clearLines=()=>{ let cleared=0; board=board.filter(r=>{if(r.every(Boolean)){cleared++;return false;}return true;}); while(board.length<rows)board.unshift(Array(cols).fill(0)); if(cleared){emitScore(score+[0,100,300,500,800][cleared]);dropMs=Math.max(160,520-Math.floor(score/500)*35);restartTimer();} };
  const spawn=()=>{piece=newPiece(); if(collide(piece)){stopTimer();emitState(TETRIS_STATE.GAME_OVER);} };
  const step=()=>{ if(state!==TETRIS_STATE.PLAYING)return; if(!collide(piece,0,1)){piece.y++;}else{merge();clearLines();spawn();} draw(); };
  const rotate=()=>{ const s=piece.shape[0].map((_,i)=>piece.shape.map(r=>r[i]).reverse()); if(!collide(piece,0,0,s))piece.shape=s; };
  const draw=()=>{ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#173216';board.forEach((r,y)=>r.forEach((v,x)=>{if(v)ctx.fillRect(x*cell+1,y*cell+1,cell-2,cell-2);})); if(piece)piece.shape.forEach((r,y)=>r.forEach((v,x)=>{if(v&&piece.y+y>=0)ctx.fillRect((piece.x+x)*cell+1,(piece.y+y)*cell+1,cell-2,cell-2);}));};
  const stopTimer=()=>{if(timer){clearInterval(timer);timer=null;}}; const restartTimer=()=>{stopTimer();if(state===TETRIS_STATE.PLAYING)timer=setInterval(step,dropMs);};
  const reset=()=>{stopTimer();board=empty();piece=newPiece();dropMs=520;emitScore(0);draw();};
  const start=()=>{if(destroyed||state===TETRIS_STATE.PLAYING)return;if(state===TETRIS_STATE.GAME_OVER)reset();emitState(TETRIS_STATE.PLAYING);restartTimer();};
  const pause=()=>{if(state!==TETRIS_STATE.PLAYING)return;stopTimer();emitState(TETRIS_STATE.PAUSED);};
  const resume=()=>{if(state!==TETRIS_STATE.PAUSED)return;emitState(TETRIS_STATE.PLAYING);restartTimer();};
  const restart=()=>{reset();emitState(TETRIS_STATE.READY);};
  const setDirection=dir=>{if(!piece||!(state===TETRIS_STATE.PLAYING||state===TETRIS_STATE.READY))return;if(dir==='left'&&!collide(piece,-1,0))piece.x--;else if(dir==='right'&&!collide(piece,1,0))piece.x++;else if(dir==='down'){if(!collide(piece,0,1))piece.y++;else step();}else if(dir==='up')rotate();draw();};
  const destroy=()=>{destroyed=true;stopTimer();ctx.clearRect(0,0,canvas.width,canvas.height);};
  reset();onStateChange?.(state);
  return {start,pause,resume,restart,setDirection,destroy,getScore:()=>score,getState:()=>state};
}
