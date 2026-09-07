// Ignite Play 4.1 — catálogo leve + carregamento sob demanda.
// Nenhum motor de jogo é importado estaticamente neste arquivo.
const GAMES = Object.freeze([
  { id:'ignite-maze', name:'Ignite Maze', icon:'🔥', description:'Colete ingredientes, use power-ups e fuja dos rivais.', controls:'Direcionais / swipe · A = escudo', controlMode:'all', featured:true, category:'Ignite' },
  { id:'snake', name:'Snake', icon:'🐍', description:'Clássico da cobrinha.', controls:'Direcionais / swipe', controlMode:'all', category:'Clássicos' },
  { id:'pong', name:'Pong', icon:'🏓', description:'Defenda sua meta contra a CPU.', controls:'Segure cima / baixo', controlMode:'vertical', continuous:true, category:'Clássicos' },
  { id:'breakout', name:'Breakout', icon:'🧱', description:'Quebre todos os blocos.', controls:'Segure esquerda / direita', controlMode:'horizontal', continuous:true, category:'Clássicos' },
  { id:'tetris', name:'Tetris', icon:'🧩', description:'Complete linhas e acelere.', controls:'← → mover · ↑ girar · ↓ descer', controlMode:'all', category:'Puzzle' },
  { id:'dino-run', name:'Dino Run', icon:'🦖', description:'Corra e pule obstáculos.', controls:'A / ↑ / toque = pular', controlMode:'vertical', category:'Arcade' },
  { id:'space-invaders', name:'Space Invaders', icon:'🚀', description:'Defenda a base da invasão.', controls:'← → mover · A / ↑ atirar', controlMode:'horizontal', category:'Arcade' },
  { id:'flappy', name:'Flappy', icon:'🐦', description:'Passe pelos espaços sem cair.', controls:'A / ↑ / toque = voar', controlMode:'vertical', category:'Arcade' },
  { id:'endless-racer', name:'Endless Racer', icon:'🏎️', description:'Troque de faixa e desvie do trânsito.', controls:'← → trocar faixa', controlMode:'horizontal', category:'Arcade' },
  { id:'maze-mini', name:'Maze Mini', icon:'👾', description:'Labirinto retrô com perseguição mais justa.', controls:'Direcionais / swipe', controlMode:'all', category:'Arcade' },
  { id:'stack-tower', name:'Stack Tower', icon:'🏗️', description:'Empilhe blocos com precisão.', controls:'A / toque = soltar bloco', controlMode:'none', category:'Casual' },
  { id:'asteroids', name:'Asteroids', icon:'🛸', description:'Desvie, gire e destrua asteroides.', controls:'← → girar · ↑ impulso · A atirar', controlMode:'all', category:'Arcade' },
]);

const LOADERS = Object.freeze({
  'ignite-maze': () => import('./games/ignite-maze.js').then(m => m.createIgniteMazeGame),
  snake: () => import('./games/snake.js').then(m => m.createSnakeGame),
  pong: () => import('./games/pong.js').then(m => m.createPongGame),
  breakout: () => import('./games/breakout.js').then(m => m.createBreakoutGame),
  tetris: () => import('./games/tetris.js').then(m => m.createTetrisGame),
  'dino-run': () => import('./games/dino-run.js').then(m => m.createDinoRunGame),
  'space-invaders': () => import('./games/space-invaders.js').then(m => m.createSpaceInvadersGame),
  flappy: () => import('./games/flappy.js').then(m => m.createFlappyGame),
  'endless-racer': () => import('./games/endless-racer.js').then(m => m.createEndlessRacerGame),
  'maze-mini': () => import('./games/maze-mini.js').then(m => m.createMazeMiniGame),
  'stack-tower': () => import('./games/stack-tower.js').then(m => m.createStackTowerGame),
  asteroids: () => import('./games/asteroids.js').then(m => m.createAsteroidsGame),
});

const modulePromises = new Map();
export const listGames = () => GAMES;
export const getGame = gameId => GAMES.find(game => game.id === gameId) || null;
export const hasGame = gameId => Boolean(getGame(gameId));
export async function loadGame(gameId) {
  if (!hasGame(gameId) || !LOADERS[gameId]) throw new Error(`Jogo não registrado: ${gameId}`);
  if (!modulePromises.has(gameId)) {
    const promise = LOADERS[gameId]().then(factory => {
      if (typeof factory !== 'function') throw new Error(`Factory inválida para ${gameId}`);
      return factory;
    }).catch(error => { modulePromises.delete(gameId); throw error; });
    modulePromises.set(gameId, promise);
  }
  return modulePromises.get(gameId);
}
