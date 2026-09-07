import { getSupabase } from '../../services/supabase-client.js';
import { getLocalProfile } from '../../services/profile-service.js';

const TOKEN_KEY = 'ignite-play-player-token-v1';

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
}

export function getPlayerToken() {
  try {
    let token = localStorage.getItem(TOKEN_KEY);
    if (!token || token.length < 32) {
      token = randomToken();
      localStorage.setItem(TOKEN_KEY, token);
    }
    return token;
  } catch {
    return randomToken();
  }
}

export function formatPlayerName(value) {
  const parts = String(value || '').trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
  if (!parts.length) return 'Jogador Ignite';
  // Ranking mobile: primeiro + segundo nome. Evita nomes completos enormes quebrando o layout.
  return parts.slice(0, 2).join(' ').slice(0, 24);
}

function displayName() {
  const profile = getLocalProfile?.() || {};
  return formatPlayerName(profile.name);
}

export async function submitScore(gameId, score) {
  const numericScore = Math.max(0, Math.floor(Number(score) || 0));
  if (!gameId) return null;
  try {
    const supabase = await getSupabase();
    if (!supabase) return null;
    const { data, error } = await supabase.rpc('submit_ignite_play_score', {
      p_player_token: getPlayerToken(), p_game_id: gameId, p_score: numericScore, p_display_name: displayName(),
    });
    if (error) throw error;
    return data;
  } catch (error) {
    console.warn('[Ignite Play] Score remoto indisponível:', error?.message || error);
    return null;
  }
}

export async function getLeaderboard(gameId = null, limit = 10) {
  try {
    const supabase = await getSupabase();
    if (!supabase) return [];
    const { data, error } = await supabase.rpc('get_ignite_play_leaderboard', { p_game_id: gameId || null, p_limit: Math.max(1, Math.min(50, Number(limit) || 10)) });
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn('[Ignite Play] Ranking indisponível:', error?.message || error);
    return [];
  }
}

export async function getPlayerStats() {
  try {
    const supabase = await getSupabase();
    if (!supabase) return null;
    const { data, error } = await supabase.rpc('get_ignite_play_player', { p_player_token: getPlayerToken() });
    if (error) throw error;
    return data || null;
  } catch (error) {
    console.warn('[Ignite Play] Perfil do jogador indisponível:', error?.message || error);
    return null;
  }
}
