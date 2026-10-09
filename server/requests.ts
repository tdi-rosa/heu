import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { parseRequestComment, requestComment } from '../shared/requests.ts';
import type { GameRequest } from '../shared/requests.ts';

const repo = 'tdi-rosa/heu';
class BridgeError extends Error {}
type Options = { token?: string; pullRequest?: number; player: (token: string) => string | undefined; transport?: typeof fetch };
export function requestHandler(options: Options) {
  const transport = options.transport || fetch, pr = options.pullRequest || 1;
  const headers = { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + (options.token || ''),
    'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'heu-game' };
  const rates = new Map<string, { start: number; count: number }>();
  const cache = new Map<string, { until: number; request: GameRequest }>();
  const sent = new Map<string, { commentId: number; request: GameRequest }>();
  let globalStart = Date.now(), globalCount = 0;
  let configuration: { until: number; ready: boolean; message: string } | undefined;
  function json(response: ServerResponse, status: number, data: unknown) {
    response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify(data));
  }
  async function github(path: string, init?: RequestInit) {
    const result = await transport('https://api.github.com/repos/' + repo + path,
      { ...init, headers, signal: AbortSignal.timeout(10000) });
    if (!result.ok) {
      console.warn('heu GitHub request failed: HTTP ' + result.status);
      const message = result.status === 401 ? 'La clé GitHub est invalide ou expirée. Vérifiez HEU_GITHUB_TOKEN dans Render.' :
        result.status === 403 ? 'GitHub refuse l’accès : vérifiez la permission Pull requests « Read and write » et les limites du jeton.' :
        result.status === 404 ? 'La clé GitHub n’a pas accès au dépôt heu ou à sa boîte de réception.' :
        'GitHub est momentanément indisponible (HTTP ' + result.status + ').';
      throw new BridgeError(message);
    }
    return result.json();
  }
  return async (request: IncomingMessage, response: ServerResponse, path: string): Promise<boolean> => {
    if (path !== '/requests/config' && path !== '/requests' && !/^\/requests\/\d+$/.test(path)) return false;
    if (request.method === 'GET' && path === '/requests/config') {
      if (!options.token) {
        json(response, 200, { ready: false, message: 'Le lien avec ChatGPT attend son activation. Votre brouillon reste ici.' }); return true;
      }
      if (!configuration || configuration.until < Date.now()) {
        try {
          await github('/pulls/' + pr);
          configuration = { until: Date.now() + 30000, ready: true, message: '' };
        } catch (error) {
          configuration = { until: Date.now() + 10000, ready: false, message:
            error instanceof BridgeError ? error.message : 'Le serveur ne parvient pas à joindre GitHub. Réessayez dans un instant.' };
        }
      }
      json(response, 200, { ready: configuration.ready, message: configuration.message }); return true;
    }
    if (!options.token) { json(response, 503, { error: 'Le lien avec ChatGPT n’est pas encore activé. Votre demande n’a pas été envoyée.' }); return true; }
    const token = request.headers.authorization?.replace(/^Bearer /, '') || '';
    const name = options.player(token);
    if (!name) { json(response, 401, { error: 'Rejoignez le monde avant d’envoyer une demande.' }); return true; }
    if (request.method === 'GET' && /^\/requests\/\d+$/.test(path)) {
      const id = path.split('/')[2], saved = cache.get(id);
      if (saved && saved.until > Date.now()) { json(response, 200, saved.request); return true; }
      try {
        const comment = await github('/issues/comments/' + id);
        const parsed = parseRequestComment(comment.body);
        if (!parsed || comment.issue_url !== `https://api.github.com/repos/${repo}/issues/${pr}`) {
          json(response, 404, { error: 'Demande introuvable.' }); return true;
        }
        if (cache.size > 200) cache.clear();
        cache.set(id, { until: Date.now() + 5000, request: parsed });
        json(response, 200, parsed);
      } catch { json(response, 502, { error: 'Le suivi est momentanément indisponible.' }); }
      return true;
    }
    if (request.method !== 'POST' || path !== '/requests') { json(response, 405, { error: 'Méthode invalide.' }); return true; }
    let sameOrigin = false;
    try { sameOrigin = new URL(request.headers.origin || '').host === request.headers.host; } catch {}
    if (!sameOrigin || !request.headers['content-type']?.startsWith('application/json')) {
      json(response, 403, { error: 'Envoyez votre demande depuis le jeu.' }); return true;
    }
    let body: { text?: unknown; id?: unknown };
    try {
      let bytes = 0; const chunks: Buffer[] = [];
      for await (const chunk of request) {
        bytes += Buffer.byteLength(chunk);
        if (bytes > 8192) { json(response, 413, { error: 'Votre demande est trop longue.' }); return true; }
        chunks.push(Buffer.from(chunk));
      }
      body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!body || typeof body !== 'object') throw new Error();
    } catch { json(response, 400, { error: 'Demande invalide.' }); return true; }
    const text = typeof body.text === 'string' ? body.text.trim().replace(/[\p{Cc}\p{Cf}]/gu, c => c === '\n' ? c : '') : '';
    if (!text || text.length > 1200) { json(response, 400, { error: 'Écrivez une demande entre 1 et 1 200 caractères.' }); return true; }
    const id = typeof body.id === 'string' && /^[a-f0-9-]{36}$/i.test(body.id) ? body.id : randomUUID();
    const dedupeKey = token + ':' + id;
    const existing = sent.get(dedupeKey);
    if (existing) { json(response, 200, existing); return true; }
    const now = Date.now();
    for (const [key, rate] of rates) if (now - rate.start >= 3600000) rates.delete(key);
    if (now - globalStart >= 3600000) { globalStart = now; globalCount = 0; sent.clear(); }
    const rate = rates.get(token) || { start: now, count: 0 };
    if (rate.count >= 3 || globalCount >= 15) {
      json(response, 429, { error: 'La boîte est pleine pour le moment. Réessayez plus tard ; votre brouillon reste enregistré.' }); return true;
    }
    rate.count++; rates.set(token, rate); globalCount++;
    const record: GameRequest = { schema: 1, id, name, text, status: 'queued', reply: 'La demande attend son traitement par ChatGPT.', createdAt: new Date().toISOString() };
    try {
      const comment = await github(`/issues/${pr}/comments`, { method: 'POST', body: JSON.stringify({ body: requestComment(record) }) });
      if (!Number.isSafeInteger(comment.id)) throw new Error();
      const result = { commentId: comment.id, request: record };
      sent.set(dedupeKey, result); json(response, 201, result);
    } catch (error) {
      // Log only a transport code, never headers, token, request text or upstream payload.
      const code = (error as { cause?: { code?: unknown } })?.cause?.code;
      if (typeof code === 'string' && /^[A-Z0-9_]+$/.test(code)) console.warn('heu GitHub transport failed: ' + code);
      json(response, 502, { error: error instanceof BridgeError ?
        error.message : 'Impossible de joindre GitHub. Votre brouillon est conservé ; vérifiez la boîte avant de réessayer.' });
    }
    return true;
  };
}
