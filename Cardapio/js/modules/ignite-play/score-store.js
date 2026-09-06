// Ignite Play — recorde local, isolado por jogo (ex.: "snake", "tetris"...).
// Hoje usa localStorage. No futuro, para sincronizar com o usuário autenticado,
// basta trocar a implementação destas duas funções — nada em index.js ou nos
// motores de jogo (games/*.js) precisa mudar.

const PREFIX = 'ignite-play:highscore:';

export function getHighScore(gameId) {
  try {
    const raw = window.localStorage.getItem(PREFIX + gameId);
    const value = raw != null ? parseInt(raw, 10) : 0;
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch (error) {
    return 0;
  }
}

export function setHighScoreIfBetter(gameId, score) {
  const current = getHighScore(gameId);
  if (score <= current) return current;
  try {
    window.localStorage.setItem(PREFIX + gameId, String(score));
  } catch (error) {
    // Armazenamento indisponível (modo privado, quota etc.): apenas ignora.
  }
  return score;
}
