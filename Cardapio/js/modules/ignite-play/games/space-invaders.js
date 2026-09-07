export const INVADERS_STATE=Object.freeze({READY:'ready',PLAYING:'playing',PAUSED:'paused',GAME_OVER:'game_over'});
export function createSpaceInvadersGame({canvas,onScoreChange,onStateChange}={}){
 if(!canvas)throw new Error('createSpaceInvadersGame: canvas obrigatório.');const c=canvas.getContext('2d');canvas.width=320;canvas.height=280;
 let state='ready',raf=0,score=0,destroyed=false,dir=1,tick=0;const p={x:148,y:250,w:24,h:10},bullets=[],eb=[],enemies=[];
 const emit=s=>{state=s;onStateChange?.(s)},pts=n=>{score=n;onScoreChange?.(n)};
 function build(){enemies.length=0;for(let r=0;r<4;r++)for(let col=0;col<7;col++)enemies.push({x:34+col*36,y:30+r*27,w:18,h:12,alive:true})}
 function reset(){p.x=148;bullets.length=eb.length=0;dir=1;tick=0;build();pts(0);draw()}
 function fire(){if(state==='playing'&&bullets.length<3)bullets.push({x:p.x+11,y:p.y-5})}
 function move(d){if(d==='left')p.x=Math.max(4,p.x-10);else if(d==='right')p.x=Math.min(292,p.x+10);else if(d==='up')fire()}
 function draw(){c.clearRect(0,0,320,280);c.fillStyle='#173216';c.fillRect(p.x,p.y,p.w,p.h);enemies.forEach(e=>{if(e.alive)c.fillRect(e.x,e.y,e.w,e.h)});bullets.forEach(b=>c.fillRect(b.x,b.y,2,7));eb.forEach(b=>c.fillRect(b.x,b.y,2,7))}
 function frame(){if(state!=='playing'||destroyed)return;tick++;for(const b of bullets)b.y-=5;for(const b of eb)b.y+=3.5;for(const e of enemies)if(e.alive)e.x+=.45*dir;const alive=enemies.filter(e=>e.alive);if(alive.some(e=>e.x<6||e.x+e.w>314)){dir*=-1;for(const e of alive)e.y+=8}
 for(const b of bullets)for(const e of alive)if(e.alive&&b.x>=e.x&&b.x<=e.x+e.w&&b.y>=e.y&&b.y<=e.y+e.h){e.alive=false;b.y=-20;pts(score+10)}
 if(tick%75===0&&alive.length){const e=alive[Math.floor(Math.random()*alive.length)];eb.push({x:e.x+9,y:e.y+e.h})}
 while(bullets[0]&&bullets[0].y<0)bullets.shift();while(eb[0]&&eb[0].y>285)eb.shift();
 if(eb.some(b=>b.x>=p.x&&b.x<=p.x+p.w&&b.y>=p.y&&b.y<=p.y+p.h)||alive.some(e=>e.y+e.h>=p.y)){emit('game_over');draw();return}
 if(!enemies.some(e=>e.alive)){pts(score+100);build()}
 draw();raf=requestAnimationFrame(frame)}
 const start=()=>{if(state==='game_over')reset();if(state==='playing'||destroyed)return;emit('playing');raf=requestAnimationFrame(frame)},pause=()=>{if(state==='playing'){cancelAnimationFrame(raf);emit('paused')}},resume=()=>{if(state==='paused'){emit('playing');raf=requestAnimationFrame(frame)}},restart=()=>{cancelAnimationFrame(raf);reset();emit('ready')},action=a=>{if(a==='primary'||a==='tap')fire()},destroy=()=>{destroyed=true;cancelAnimationFrame(raf);c.clearRect(0,0,320,280)};
 reset();onStateChange?.(state);return{start,pause,resume,restart,setDirection:move,action,destroy,getScore:()=>score,getState:()=>state};
}