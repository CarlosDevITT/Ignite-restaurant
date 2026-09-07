export const DINO_RUN_STATE=Object.freeze({READY:'ready',PLAYING:'playing',PAUSED:'paused',GAME_OVER:'game_over'});
export function createDinoRunGame({canvas,onScoreChange,onStateChange}={}){
 if(!canvas)throw new Error('createDinoRunGame: canvas obrigatório.');const c=canvas.getContext('2d');canvas.width=320;canvas.height=280;
 let state='ready',raf=0,last=0,score=0,destroyed=false,spawn=0;const ground=235,p={x:42,y:ground-28,w:24,h:28,vy:0},obs=[];
 const emit=s=>{state=s;onStateChange?.(s)},points=n=>{score=n;onScoreChange?.(score)};
 function reset(){p.y=ground-p.h;p.vy=0;obs.length=0;spawn=0;points(0);draw()}
 function jump(){if(p.y>=ground-p.h-1)p.vy=-8.7}
 function draw(){c.clearRect(0,0,320,280);c.fillStyle='#173216';c.fillRect(0,ground,320,3);c.fillRect(p.x,p.y,p.w,p.h);c.fillRect(p.x+16,p.y-7,10,10);obs.forEach(o=>c.fillRect(o.x,ground-o.h,o.w,o.h));}
 function loop(t){if(destroyed||state!=='playing')return;const dt=Math.min(32,t-(last||t));last=t;p.vy+=.028*dt;p.y+=p.vy*dt/16;if(p.y>ground-p.h){p.y=ground-p.h;p.vy=0}spawn-=dt;if(spawn<=0){const h=22+Math.random()*28;obs.push({x:325,w:12+Math.random()*13,h});spawn=760+Math.random()*850}for(const o of obs)o.x-=4.2*dt/16;while(obs[0]&&obs[0].x+obs[0].w<0){obs.shift();points(score+10)}if(obs.some(o=>p.x<o.x+o.w&&p.x+p.w>o.x&&p.y+p.h>ground-o.h)){emit('game_over');draw();return}draw();raf=requestAnimationFrame(loop)}
 const start=()=>{if(state==='game_over')reset();if(state==='playing'||destroyed)return;emit('playing');last=0;raf=requestAnimationFrame(loop)},pause=()=>{if(state==='playing'){cancelAnimationFrame(raf);emit('paused')}},resume=()=>{if(state==='paused'){emit('playing');last=0;raf=requestAnimationFrame(loop)}},restart=()=>{cancelAnimationFrame(raf);reset();emit('ready')};
 const setDirection=d=>{if(d==='up')jump()},action=a=>{if(a==='primary'||a==='tap')jump()},destroy=()=>{destroyed=true;cancelAnimationFrame(raf);c.clearRect(0,0,320,280)};
 reset();onStateChange?.(state);return{start,pause,resume,restart,setDirection,action,destroy,getScore:()=>score,getState:()=>state};
}