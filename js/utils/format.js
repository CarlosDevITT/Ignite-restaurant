import { APP_CONFIG } from '../config.js';

export const money = (value) => new Intl.NumberFormat(APP_CONFIG.locale, {
  style: 'currency', currency: APP_CONFIG.currency,
}).format(Number(value || 0));

export const shortDate = (value) => new Intl.DateTimeFormat(APP_CONFIG.locale, {
  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
}).format(new Date(value));

export const escapeHTML = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
}[char]));

export const normalizeText = (value = '') => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export const createId = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
