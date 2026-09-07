export const GAME2048_STATE=Object.freeze({READY:'ready',PLAYING:'playing',PAUSED:'paused',GAME_OVER:'game_over'});
export function create2048Game({canvas,onScoreChange,onStateChange}={}){
 if(!canvas)throw new Error('create2048Game: canvas obrigatório.');const c=canvas.getContext('2d');canvas.width=320;canvas.height=280;let state='ready',score=0,destroyed=false,board=[];
 const emit=s=>{state=s;onStateChange?.(s)},pts=n=>{score=n;onScoreChange?.(n)},empty=()=>Array.from({length:4},()=>Array(4).fill(0));
 function add(){const e=[];for(let y=0;y<4;y++)for(let x=0;x<4;x++)if(!board[y][x])e.push([x,y]);if(e.length){const[x,y]=e[Math.floor(Math.random()*e.length)];board[y][x]=Math.random()<.9?2:4}}
 function reset(){board=empty();pts(0);add();add();draw()}
 function draw(){c.clearRect(0,0,320,280);c.fillStyle='#173216';c.font='bold 20px sans-serif';c.textAlign='center';for(let y=0;y<4;y++)for(let x=0;x<4;x++){const px=28+x*68,py=8+y*68;c.strokeStyle='#173216';c.lineWidth=2;c.strokeRect(px,py,60,60);if(board[y][x])c.fillText(board[y][x],px+30,py+37)}c.textAlign='left'}
 function slide(arr,award=true){const a=arr.filter(Boolean);for(let i=0;i<a.length-1;i++)if(a[i]===a[i+1]){a[i]*=2;if(award)pts(score+a[i]);a.splice(i+1,1)}while(a.length<4)a.push(0);return a}
 const transpose=b=>b[0].map((_,i)=>b.map(r=>r[i]));
 function projected(d,b=board){const copy=JSON.parse(JSON.stringify(b));if(d==='left')return copy.map(r=>slide(r,false));if(d==='right')return copy.map(r=>slide([...r].reverse(),false).reverse());if(d==='up')return transpose(transpose(copy).map(r=>slide(r,false)));return transpose(transpose(copy).map(r=>slide([...r].reverse(),false).reverse()))}
 function canMove(){return ['left','right','up','down'].some(d=>JSON.stringify(projected(d))!==JSON.stringify(board))}
 function move(d){if(state!=='playing'||!['left','right','up','down'].includes(d))return;const before=JSON.stringify(board);if(d==='left')board=board.map(r=>slide(r));else if(d==='right')board=board.map(r=>slide([...r].reverse()).reverse());else if(d==='up')board=transpose(transpose(board).map(r=>slide(r)));else board=transpose(transpose(board).map(r=>slide([...r].reverse()).reverse()));if(JSON.stringify(board)!==before)add();draw();if(!board.some(r=>r.includes(0))&&!canMove())emit('game_over')}
 const start=()=>{if(state==='game_over')reset();if(state==='playing'||destroyed)return;emit('playing')},pause=()=>{if(state==='playing')emit('paused')},resume=()=>{if(state==='paused')emit('playing')},restart=()=>{reset();emit('ready')},destroy=()=>{destroyed=true;c.clearRect(0,0,320,280)};
 reset();onStateChange?.(state);return{start,pause,resume,restart,setDirection:move,action:()=>{},destroy,getScore:()=>score,getState:()=>state};
}