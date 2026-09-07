export const RACER_STATE=Object.freeze({READY:'ready',PLAYING:'playing',PAUSED:'paused',GAME_OVER:'game_over'});
export function createEndlessRacerGame({canvas,onScoreChange,onStateChange}={}){
 if(!canvas)throw new Error('createEndlessRacerGame: canvas obrigatório.');const c=canvas.getContext('2d');canvas.width=320;canvas.height=280;const lanes=[90,160,230];
 let state='ready',raf=0,last=0,score=0,destroyed=false,spawn=0,lane=1,road=0;const cars=[];
 const emit=s=>{state=s;onStateChange?.(s)},pts=n=>{score=n;onScoreChange?.(n)};
 function reset(){lane=1;cars.length=0;spawn=300;road=0;pts(0);draw()}
 function draw(){c.clearRect(0,0,320,280);c.fillStyle='#173216';c.fillRect(55,0,210,280);c.clearRect(61,0,198,280);c.fillStyle='#173216';for(let y=-30+(road%45);y<300;y+=45){c.fillRect(124,y,3,22);c.fillRect(194,y,3,22)}c.fillRect(lanes[lane]-14,225,28,42);cars.forEach(o=>c.fillRect(lanes[o.l]-13,o.y,26,39))}
 function move(d){if(d==='left')lane=Math.max(0,lane-1);if(d==='right')lane=Math.min(2,lane+1)}
 function loop(t){if(state!=='playing'||destroyed)return;const dt=Math.min(32,t-(last||t));last=t;road+=4*dt/16;spawn-=dt;if(spawn<=0){cars.push({l:Math.floor(Math.random()*3),y:-45});spawn=520+Math.random()*520}for(const o of cars)o.y+=4.1*dt/16;while(cars[0]&&cars[0].y>285){cars.shift();pts(score+10)}if(cars.some(o=>o.l===lane&&o.y+39>225&&o.y<267)){emit('game_over');draw();return}draw();raf=requestAnimationFrame(loop)}
 const start=()=>{if(state==='game_over')reset();if(state==='playing'||destroyed)return;emit('playing');last=0;raf=requestAnimationFrame(loop)},pause=()=>{if(state==='playing'){cancelAnimationFrame(raf);emit('paused')}},resume=()=>{if(state==='paused'){emit('playing');last=0;raf=requestAnimationFrame(loop)}},restart=()=>{cancelAnimationFrame(raf);reset();emit('ready')},destroy=()=>{destroyed=true;cancelAnimationFrame(raf);c.clearRect(0,0,320,280)};
 reset();onStateChange?.(state);return{start,pause,resume,restart,setDirection:move,action:()=>{},destroy,getScore:()=>score,getState:()=>state};
}