import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { requestHandler } from '../server/requests.ts';
import { parseRequestComment, requestComment } from '../shared/requests.ts';
import type { GameRequest } from '../shared/requests.ts';

test('request delivery, persistent GitHub status, identity, quotas and unavailable bridge', async t => {
  const comments = new Map<number, { id: number; body: string; issue_url: string }>();
  let writes = 0;
  const announced: GameRequest[] = [];
  const transport: typeof fetch = async (input, init) => {
    assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer server-secret');
    const path = String(input);
    if (path.endsWith('/pulls/1')) return Response.json({ number: 1 });
    if (init?.method === 'POST') {
      writes++;
      assert.equal(announced.length, writes, 'speech is announced before GitHub delivery');
      assert.equal(path, 'https://api.github.com/repos/tdi-rosa/heu/issues/1/comments');
      const comment = { id: writes, body: JSON.parse(String(init.body)).body, issue_url: 'https://api.github.com/repos/tdi-rosa/heu/issues/1' };
      comments.set(writes, comment); return Response.json(comment, { status: 201 });
    }
    const comment = comments.get(Number(path.split('/').at(-1)));
    return Response.json(comment || {}, { status: comment ? 200 : 404 });
  };
  const player = (token: string) => token === 'joined-token' ? 'Alice' : undefined;
  const handler = requestHandler({ token: 'server-secret', player, transport, announce: (token, request) => { assert.equal(token, 'joined-token'); announced.push(request); } });
  const unavailable = requestHandler({ player, transport });
  const failing = requestHandler({ token: 'private-secret', player, transport: async () => { throw new Error('private-secret'); } });
  const server = createServer(async (req, res) => {
    const path = new URL(req.url!, 'http://localhost').pathname;
    const selected = path.startsWith('/offline') ? unavailable : path.startsWith('/failing') ? failing : handler;
    if (!await selected(req, res, path.replace(/^\/(offline|failing)/, ''))) res.writeHead(404).end();
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const address = server.address(); if (!address || typeof address === 'string') throw new Error();
  const base = `http://127.0.0.1:${address.port}`;
  const headers = { Origin: base, Authorization: 'Bearer joined-token', 'Content-Type': 'application/json' };
  const post = (body: unknown, changed = {}) => fetch(base + '/requests', { method: 'POST', headers: { ...headers, ...changed }, body: JSON.stringify(body) });
  assert.equal((await (await fetch(base + '/requests/config')).json()).ready, true);
  const failure = await (await fetch(base + '/failing/requests/config')).json();
  assert.equal(failure.ready, false); assert.equal(JSON.stringify(failure).includes('private-secret'), false);
  assert.equal((await (await fetch(base + '/offline/requests/config')).json()).ready, false);
  assert.equal((await fetch(base + '/offline/requests', { method: 'POST', headers, body: '{}' })).status, 503);
  assert.equal((await post({ text: 'un banc' }, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await post({ text: 'un banc' }, { Authorization: 'Bearer unknown' })).status, 401);
  assert.equal((await post({ text: 'x'.repeat(1201) })).status, 400);
  assert.equal((await post({ text: ' ' })).status, 400);
  const id = randomUUID();
  const response = await post({ id, name: 'Impersonation', text: 'Un banc 🪑 près de l’étang, avec ``` dedans.' });
  assert.equal(response.status, 201);
  const saved = await response.json(); assert.equal(saved.request.name, 'Alice');
  assert.equal(saved.request.status, 'queued');
  assert.equal(announced[0].name, 'Alice'); assert.equal(announced[0].text, saved.request.text);
  assert.equal(JSON.stringify(saved).includes('server-secret'), false);
  assert.equal((await post({ id, text: 'Un banc' })).status, 200); assert.equal(writes, 1);
  const record = parseRequestComment(comments.get(1)!.body)!;
  assert.equal(record.text, 'Un banc 🪑 près de l’étang, avec ``` dedans.');
  comments.get(1)!.body = requestComment({ ...record, status: 'processing', reply: 'Je prépare le banc.' });
  assert.equal((await fetch(base + '/requests/1')).status, 401);
  const current = await (await fetch(base + '/requests/1', { headers })).json();
  assert.equal(current.status, 'processing'); assert.equal(current.reply, 'Je prépare le banc.');
  for (let i = 1; i < 20; i++) assert.equal((await post({ text: `souhait ${i}` })).status, 201);
  assert.equal((await post({ text: 'limite' })).status, 429); assert.equal(writes, 20); assert.equal(announced.length, 20);
  comments.set(99, { id: 99, body: requestComment(record), issue_url: 'https://api.github.com/repos/tdi-rosa/heu/issues/2' });
  assert.equal((await fetch(base + '/requests/99', { headers })).status, 404);
});

test('request parser rejects invalid envelopes and preserves text as data', () => {
  assert.equal(parseRequestComment('[heu-request]\n```json\n{}\n```'), undefined);
  const r: GameRequest = { schema: 1, id: randomUUID(), name: 'A', text: '<script>hello</script>\n```', status: 'queued', reply: '', createdAt: new Date().toISOString() };
  assert.deepEqual(parseRequestComment(requestComment(r)), r);
  assert.equal(parseRequestComment(requestComment({ ...r, status: '__proto__' as never })), undefined);
});
