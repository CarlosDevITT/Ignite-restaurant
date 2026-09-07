export const MAZE_STATE=Object.freeze({READY:'ready',PLAYING:'playing',PAUSED:'paused',GAME_OVER:'game_over'});
const MAP=[
  '################',
  '#..............#',
  '#.####.##.####.#',
  '#......##......#',
  '###.##....##.###',
  '#...##.##.##...#',
  '#.#..........#.#',
  '#.##.######.##.#',
  '#....#....#....#',
  '####.#.##.#.####',
  '#..............#',
  '#.####.##.####.#',
  '#..............#',
  '################',
];
export function createMazeMiniGame({canvas,onScoreChange,onStateChange}={}){
  if(!canvas)throw new Error('createMazeMiniGame: canvas obrigatório.');
  const c=canvas.getContext('2d'),cell=18;canvas.width=MAP[0].length*cell;canvas.height=MAP.length*cell;
  let state='ready',timer=0,score=0,destroyed=false,dir='right',dots=new Set(),px=1,py=1,tick=0,grace=0;
  const ghosts=[{x:14,y:12,last:null},{x:14,y:1,last:null}];
  const emit=s=>{state=s;onStateChange?.(s)},pts=n=>{score=n;onScoreChange?.(n)},key=(x,y)=>`${x}:${y}`,open=(x,y)=>MAP[y]?.[x]&&MAP[y][x]!=='#';
  function reset(){dots=new Set();for(let y=0;y<MAP.length;y++)for(let x=0;x<MAP[y].length;x++)if(MAP[y][x]==='.')dots.add(key(x,y));px=1;py=1;dir='right';tick=0;grace=18;ghosts[0]={x:14,y:12,last:null};ghosts[1]={x:14,y:1,last:null};pts(0);draw()}
  function draw(){c.clearRect(0,0,canvas.width,canvas.height);c.fillStyle='#173216';for(let y=0;y<MAP.length;y++)for(let x=0;x<MAP[y].length;x++)if(MAP[y][x]==='#')c.fillRect(x*cell,y*cell,cell,cell);dots.forEach(k=>{const [x,y]=k.split(':').map(Number);c.fillRect(x*cell+8,y*cell+8,3,3)});c.beginPath();c.arc(px*cell+9,py*cell+9,7,0,Math.PI*2);c.fill();ghosts.forEach(g=>c.fillRect(g.x*cell+4,g.y*cell+4,10,10));}
  function ghostStep(g){const reverse=g.last&&[-g.last[0],-g.last[1]];let options=[[1,0],[-1,0],[0,1],[0,-1]].filter(([a,b])=>open(g.x+a,g.y+b));if(options.length>1&&reverse)options=options.filter(([a,b])=>a!==reverse[0]||b!==reverse[1]);if(!options.length)return;const chase=[...options].sort((a,b)=>(Math.abs(g.x+a[0]-px)+Math.abs(g.y+a[1]-py))-(Math.abs(g.x+b[0]-px)+Math.abs(g.y+b[1]-py)))[0];const ch=Math.random()<.48?chase:options[Math.floor(Math.random()*options.length)];g.x+=ch[0];g.y+=ch[1];g.last=ch;}
  function moveOne(){tick++;if(grace>0)grace--;const D={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]},[dx,dy]=D[dir]||[0,0];if(open(px+dx,py+dy)){px+=dx;py+=dy}const k=key(px,py);if(dots.delete(k))pts(score+5);if(tick%2===0&&grace<12)ghosts.forEach(ghostStep);if(grace===0&&ghosts.some(g=>g.x===px&&g.y===py)){clearInterval(timer);emit('game_over')}else if(!dots.size){clearInterval(timer);pts(score+150);emit('game_over')}draw()}
  const setDirection=d=>{if(['up','down','left','right'].includes(d))dir=d},start=()=>{if(state==='game_over')reset();if(state==='playing'||destroyed)return;emit('playing');timer=setInterval(moveOne,150)},pause=()=>{if(state==='playing'){clearInterval(timer);emit('paused')}},resume=()=>{if(state==='paused'){emit('playing');timer=setInterval(moveOne,150)}},restart=()=>{clearInterval(timer);reset();emit('ready')},destroy=()=>{destroyed=true;clearInterval(timer);c.clearRect(0,0,canvas.width,canvas.height)};
  reset();onStateChange?.(state);return{start,pause,resume,restart,setDirection,action:()=>{},destroy,getScore:()=>score,getState:()=>state};
}
