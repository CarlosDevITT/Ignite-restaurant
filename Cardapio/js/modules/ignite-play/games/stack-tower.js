export const STACK_STATE=Object.freeze({READY:'ready',PLAYING:'playing',PAUSED:'paused',GAME_OVER:'game_over'});
export function createStackTowerGame({canvas,onScoreChange,onStateChange}={}){
 if(!canvas)throw new Error('createStackTowerGame: canvas obrigatório.');const c=canvas.getContext('2d');canvas.width=320;canvas.height=280;
 let state='ready',raf=0,score=0,destroyed=false,x=0,dir=1,w=120,y=240;const blocks=[];
 const emit=s=>{state=s;onStateChange?.(s)},pts=n=>{score=n;onScoreChange?.(n)};
 function reset(){blocks.length=0;blocks.push({x:100,y:255,w:120});x=0;dir=1;w=120;y=240;pts(0);draw()}
 function drop(){if(state!=='playing')return;const prev=blocks[blocks.length-1],left=Math.max(x,prev.x),right=Math.min(x+w,prev.x+prev.w),nw=right-left;if(nw<=5){emit('game_over');return}blocks.push({x:left,y,w:nw});pts(score+10);w=nw;y-=15;x=dir>0?0:320-w;if(y<70){blocks.forEach(b=>b.y+=30);y+=30}}
 function draw(){c.clearRect(0,0,320,280);c.fillStyle='#173216';blocks.forEach(b=>c.fillRect(b.x,b.y,b.w,12));c.fillRect(x,y,w,12)}
 function loop(){if(state!=='playing'||destroyed)return;x+=2.4*dir;if(x<=0){x=0;dir=1}if(x+w>=320){x=320-w;dir=-1}draw();raf=requestAnimationFrame(loop)}
 const start=()=>{if(state==='game_over')reset();if(state==='playing'||destroyed)return;emit('playing');raf=requestAnimationFrame(loop)},pause=()=>{if(state==='playing'){cancelAnimationFrame(raf);emit('paused')}},resume=()=>{if(state==='paused'){emit('playing');raf=requestAnimationFrame(loop)}},restart=()=>{cancelAnimationFrame(raf);reset();emit('ready')},action=a=>{if(a==='primary'||a==='tap')drop()},destroy=()=>{destroyed=true;cancelAnimationFrame(raf);c.clearRect(0,0,320,280)};
 reset();onStateChange?.(state);return{start,pause,resume,restart,setDirection:()=>{},action,destroy,getScore:()=>score,getState:()=>state};
}