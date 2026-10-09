import { newToken } from '../shared/identity.ts';
import { requestLabels } from '../shared/requests.ts';
import type { GameRequest } from '../shared/requests.ts';

type SavedRequest = { commentId: number; request: GameRequest };
export function initRequests(options: { token: string; stop: () => void; storage: { get(key: string): string | null; set(key: string, value: string): void } }) {
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const composer = $('chat-composer'), form = $<HTMLFormElement>('chat-form');
  const input = $<HTMLInputElement>('chat-text'), notice = $('chat-notice');
  let history: SavedRequest[] = [], pending = 0;
  try { history = JSON.parse(options.storage.get('request-history') || '[]'); } catch {}
  input.value = options.storage.get('request-draft') || '';
  function save() { options.storage.set('request-history', JSON.stringify(history.slice(0, 6))); }
  function close() { composer.hidden = true; input.blur(); options.stop(); }
  function open() { if (document.querySelector('dialog[open]')) return; options.stop(); composer.hidden = false; input.focus(); }
  function status() {
    const latest = history[0]; if (!latest || pending) return;
    notice.textContent = requestLabels[latest.request.status] + (latest.request.reply ? ' · ' + latest.request.reply : '');
  }
  $('chat-open').addEventListener('click', open);
  $('chat-close').addEventListener('click', close);
  window.addEventListener('keydown', event => {
    if (event.isComposing || event.repeat || document.querySelector('dialog[open]')) return;
    if (event.key === 'Escape' && !composer.hidden) { event.preventDefault(); close(); }
    if (event.key === 'Enter' && composer.hidden && !(event.target instanceof HTMLInputElement)) { event.preventDefault(); open(); }
  }, true);
  input.addEventListener('input', () => options.storage.set('request-draft', input.value));
  form.addEventListener('submit', async event => {
    event.preventDefault(); const text = input.value.trim(); if (!text) { close(); return; }
    if (pending >= 3) { notice.textContent = 'Trois messages sont en cours d’envoi. Réessayez dans un instant.'; return; }
    pending++; input.value = ''; close(); notice.textContent = 'Transmission de votre souhait…';
    const headers = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + options.token };
    try {
      const response = await fetch('/requests', { method: 'POST', headers, body: JSON.stringify({ id: newToken(), text }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Envoi impossible.');
      history.unshift(data); history = history.slice(0, 6); save();
      if (options.storage.get('request-draft') === text) options.storage.set('request-draft', '');
      notice.textContent = 'Souhait transmis · la modification est en attente.';
    } catch (error) {
      notice.textContent = error instanceof Error ? error.message : 'Envoi impossible.';
      if (!input.value) { input.value = text; options.storage.set('request-draft', text); }
    } finally { pending--; }
  });
  let checking = false;
  async function refresh() {
    if (checking || document.hidden) return; checking = true;
    try {
      const active = history.filter(h => h.request.status === 'queued' || h.request.status === 'processing');
      for (const entry of active) {
        try { const response = await fetch('/requests/' + entry.commentId, { cache: 'no-store', headers: { Authorization: 'Bearer ' + options.token } });
          if (response.ok) entry.request = await response.json();
        } catch { /* Keep the last confirmed status during deployments. */ }
      }
      save(); status();
    } finally { checking = false; }
  }
  setInterval(() => { void refresh(); }, 5000); status();
}
