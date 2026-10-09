import { newToken } from '../shared/identity.ts';
import { requestLabels } from '../shared/requests.ts';
import type { GameRequest } from '../shared/requests.ts';

export function initRequests(options: { token: string; stop: () => void; storage: { get(key: string): string | null; set(key: string, value: string): void } }) {
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const dialog = $<HTMLDialogElement>('requests-dialog'), form = $<HTMLFormElement>('requests-form');
  const text = $<HTMLTextAreaElement>('request-text'), submit = $<HTMLButtonElement>('request-send');
  const notice = $('request-notice'), result = $('request-result'), reply = $('request-reply');
  let ready = false, sending = false;
  let last: { commentId: number; request: GameRequest } | undefined;
  let requestId = newToken();
  text.value = options.storage.get('request-draft') || '';
  try { const value = options.storage.get('last-request'); if (value) last = JSON.parse(value); } catch {}
  function render() {
    submit.disabled = !ready || sending || !text.value.trim();
    submit.textContent = sending ? 'Envoi…' : 'Envoyer à ChatGPT ↗';
    result.hidden = !last;
    if (last) {
      $('request-state').textContent = requestLabels[last.request.status] || 'Demande envoyée';
      $('request-summary').textContent = last.request.text;
      reply.textContent = last.request.reply;
    }
  }
  async function refresh() {
    try {
      const response = await fetch('/requests/config', { cache: 'no-store' });
      if (!response.ok) throw new Error();
      const config = await response.json(); ready = config.ready === true;
      notice.textContent = config.message || 'Décrivez un petit changement précis. Le traitement et le déploiement prennent quelques minutes.';
    } catch { ready = false; notice.textContent = 'Connexion indisponible. Votre brouillon reste enregistré.'; }
    if (last) {
      try {
        const response = await fetch('/requests/' + last.commentId, { cache: 'no-store', headers: { Authorization: 'Bearer ' + options.token } });
        if (response.ok) { last.request = await response.json(); options.storage.set('last-request', JSON.stringify(last)); }
      } catch { /* Preserve the latest confirmed status during a deployment. */ }
    }
    render();
  }
  $('request-open').addEventListener('click', () => {
    options.stop(); dialog.showModal(); render(); void refresh(); text.focus();
  });
  $('request-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) {
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  } });
  text.addEventListener('input', () => { options.storage.set('request-draft', text.value); render(); });
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (!ready || sending || !text.value.trim()) return;
    sending = true; render();
    try {
      const response = await fetch('/requests', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + options.token },
        body: JSON.stringify({ id: requestId, text: text.value.trim() }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Envoi impossible.');
      last = data; options.storage.set('last-request', JSON.stringify(last));
      text.value = ''; options.storage.set('request-draft', ''); requestId = newToken();
      notice.textContent = 'Demande transmise à la boîte de réception. Le statut ci-dessous se met à jour automatiquement.';
    } catch (error) { notice.textContent = error instanceof Error ? error.message : 'Envoi impossible. Votre brouillon reste ici.'; }
    finally { sending = false; render(); }
  });
  setInterval(() => { if (dialog.open && !sending) void refresh(); }, 5000);
  render();
}
