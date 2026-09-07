export const TARGET_STATE=Object.freeze({READY:'ready',PLAYING:'playing',PAUSED:'paused',GAME_OVER:'game_over'});
export function createTargetRushGame({canvas,onScoreChange,onStateChange}={}){
 if(!canvas)throw new Error('createTargetRushGame: canvas obrigatório.');const c=canvas.getContext('2d');canvas.width=320;canvas.height=280;
 let state='ready',timer=0,clock=0,score=0,destroyed=false,target={x:160,y:140,r:18},cursor={x:160,y:140};
 const emit=s=>{state=s;onStateChange?.(s)},pts=n=>{score=n;onScoreChange?.(n)},spawn=()=>{target={x:30+Math.random()*260,y:35+Math.random()*210,r:13+Math.random()*9}};
 function reset(){clock=20;cursor={x:160,y:140};pts(0);spawn();draw()}
 function draw(){c.clearRect(0,0,320,280);c.fillStyle='#173216';c.beginPath();c.arc(target.x,target.y,target.r,0,Math.PI*2);c.fill();c.strokeStyle='#173216';c.strokeRect(cursor.x-7,cursor.y-7,14,14);c.font='12px sans-serif';c.fillText(`${Math.ceil(clock)}s`,10,18)}
 function hit(x=cursor.x,y=cursor.y){if(state!=='playing')return;const d=Math.hypot(x-target.x,y-target.y);if(d<=target.r){pts(score+10);spawn()}else pts(Math.max(0,score-2));draw()}
 function move(d){if(d==='left')cursor.x-=14;if(d==='right')cursor.x+=14;if(d==='up')cursor.y-=14;if(d==='down')cursor.y+=14;cursor.x=Math.max(8,Math.min(312,cursor.x));cursor.y=Math.max(8,Math.min(272,cursor.y));draw()}
 const start=()=>{if(state==='game_over')reset();if(state==='playing'||destroyed)return;emit('playing');let last=performance.now();timer=setInterval(()=>{const now=performance.now();clock-=(now-last)/1000;last=now;if(clock<=0){clock=0;clearInterval(timer);emit('game_over')}draw()},100)},pause=()=>{if(state==='playing'){clearInterval(timer);emit('paused')}},resume=()=>{if(state==='paused')start()},restart=()=>{clearInterval(timer);reset();emit('ready')},action=a=>{if(a==='primary')hit()},pointer=(x,y)=>hit(x,y),destroy=()=>{destroyed=true;clearInterval(timer);c.clearRect(0,0,320,280)};
 reset();onStateChange?.(state);return{start,pause,resume,restart,setDirection:move,action,pointer,destroy,getScore:()=>score,getState:()=>state};
}