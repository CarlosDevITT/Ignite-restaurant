import { createSnakeGame } from './games/snake.js';
import { createPongGame } from './games/pong.js';
import { createBreakoutGame } from './games/breakout.js';
import { createTetrisGame } from './games/tetris.js';

const GAMES = Object.freeze([
  { id: 'snake', name: 'Snake', icon: '🐍', description: 'Clássico da cobrinha', controls: 'Direcionais / swipe', create: createSnakeGame },
  { id: 'pong', name: 'Pong', icon: '🏓', description: 'Segure a defesa', controls: 'Cima / baixo', create: createPongGame },
  { id: 'breakout', name: 'Breakout', icon: '🧱', description: 'Quebre todos os blocos', controls: 'Esquerda / direita', create: createBreakoutGame },
  { id: 'tetris', name: 'Tetris', icon: '🧩', description: 'Complete linhas', controls: '← → mover · ↑ girar · ↓ descer', create: createTetrisGame },
]);

export const listGames = () => GAMES;
export const getGame = (gameId) => GAMES.find((game) => game.id === gameId) || null;
export const hasGame = (gameId) => Boolean(getGame(gameId));
