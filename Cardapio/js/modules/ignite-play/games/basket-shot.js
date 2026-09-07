export const BASKET_STATE=Object.freeze({READY:'ready',PLAYING:'playing',PAUSED:'paused',GAME_OVER:'game_over'});
export function createBasketShotGame({canvas,onScoreChange,onStateChange}={}){
 if(!canvas)throw new Error('createBasketShotGame: canvas obrigatório.');const c=canvas.getContext('2d');canvas.width=320;canvas.height=280;
 let state='ready',raf=0,score=0,destroyed=false,angle=-1.05,shots=10;const ball={x:50,y:235,vx:0,vy:0,flying:false};
 const emit=s=>{state=s;onStateChange?.(s)},pts=n=>{score=n;onScoreChange?.(n)};
 function reset(){angle=-1.05;shots=10;ball.x=50;ball.y=235;ball.flying=false;pts(0);draw()}
 function aim(d){if(!ball.flying){if(d==='left')angle=Math.max(-1.35,angle-.08);if(d==='right')angle=Math.min(-.65,angle+.08)}}
 function shoot(){if(state!=='playing'||ball.flying||shots<=0)return;ball.flying=true;ball.vx=Math.cos(angle)*8;ball.vy=Math.sin(angle)*8;shots--}
 function draw(){c.clearRect(0,0,320,280);c.fillStyle='#173216';c.fillRect(245,90,5,90);c.fillRect(220,135,45,4);c.beginPath();c.arc(ball.x,ball.y,8,0,Math.PI*2);c.fill();if(!ball.flying){c.beginPath();c.moveTo(ball.x,ball.y);c.lineTo(ball.x+Math.cos(angle)*45,ball.y+Math.sin(angle)*45);c.strokeStyle='#173216';c.stroke()}c.font='12px sans-serif';c.fillText(`Bolas: ${shots}`,10,18)}
 function loop(){if(state!=='playing'||destroyed)return;if(ball.flying){const py=ball.y;ball.x+=ball.vx;ball.y+=ball.vy;ball.vy+=.28;if(ball.x>218&&ball.x<266&&py<135&&ball.y>=135&&ball.vy>0){pts(score+20);ball.flying=false;ball.x=50;ball.y=235}else if(ball.y>290||ball.x>340){ball.flying=false;ball.x=50;ball.y=235;if(shots<=0){emit('game_over');draw();return}}}draw();raf=requestAnimationFrame(loop)}
 const start=()=>{if(state==='game_over')reset();if(state==='playing'||destroyed)return;emit('playing');raf=requestAnimationFrame(loop)},pause=()=>{if(state==='playing'){cancelAnimationFrame(raf);emit('paused')}},resume=()=>{if(state==='paused'){emit('playing');raf=requestAnimationFrame(loop)}},restart=()=>{cancelAnimationFrame(raf);reset();emit('ready')},action=a=>{if(a==='primary'||a==='tap')shoot()},destroy=()=>{destroyed=true;cancelAnimationFrame(raf);c.clearRect(0,0,320,280)};
 reset();onStateChange?.(state);return{start,pause,resume,restart,setDirection:aim,action,destroy,getScore:()=>score,getState:()=>state};
}