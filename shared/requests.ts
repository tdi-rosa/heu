export type RequestStatus = 'queued' | 'processing' | 'deployed' | 'needs_info' | 'declined' | 'failed';
export type GameRequest = {
  schema: 1; id: string; name: string; text: string; status: RequestStatus;
  reply: string; createdAt: string; updatedAt?: string; commit?: string;
};
export const requestLabels: Record<RequestStatus, string> = {
  queued: 'Demande envoyée', processing: 'Modification en cours', deployed: 'Mise à jour disponible',
  needs_info: 'Une précision est nécessaire', declined: 'Demande non retenue', failed: 'La mise à jour a échoué'
};
export function requestComment(request: GameRequest): string {
  return '[heu-request]\n```json\n' + JSON.stringify(request, null, 2) + '\n```';
}
export function parseRequestComment(body: unknown): GameRequest | undefined {
  if (typeof body !== 'string') return;
  const match = body.match(/^\[heu-request\]\s*```json\n([\s\S]*)\n```\s*$/);
  if (!match) return;
  try {
    const r = JSON.parse(match[1]);
    if (r.schema !== 1 || typeof r.id !== 'string' || !/^[a-f0-9-]{36}$/i.test(r.id) ||
        typeof r.name !== 'string' || typeof r.text !== 'string' || typeof r.reply !== 'string' ||
        typeof r.createdAt !== 'string' || !Object.hasOwn(requestLabels, r.status)) return;
    return r;
  } catch { return; }
}
