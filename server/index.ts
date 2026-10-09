import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { move, spawn, facing } from '../shared/world.ts';
import type { Player } from '../shared/world.ts';
import type { ServerMessage } from '../shared/protocol.ts';

const root = resolve('dist');
const version = process.env.RAILWAY_GIT_COMMIT_SHA || process.env.APP_VERSION || 'development';
type Session = { socket: WebSocket; player: Player; token: string; dx: number; dy: number; lastInput: number; alive: boolean; rate: number; rateTime: number };
const sessions = new Map<WebSocket, Session>();
// Short lived continuity across reconnects, never an account or a database.
const remembered = new Map<string, { player: Player; expires: number }>();
const send = (socket: WebSocket, message: ServerMessage) => {
  if (socket.readyState === WebSocket.OPEN && socket.bufferedAmount < 65536) socket.send(JSON.stringify(message));
};
const mime: Record<string,string> = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml' };
const http = createServer(async (request, response) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'same-origin');
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET' && request.method !== 'HEAD') { response.writeHead(405).end(); return; }
  let path: string;
  try { path = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname); } catch { response.writeHead(400).end(); return; }
  if (path === '/health') { response.writeHead(200, {'Content-Type':'application/json'}).end(JSON.stringify({ok:true,version,players:sessions.size})); return; }
  if (path === '/version') { response.writeHead(200, {'Content-Type':'application/json'}).end(JSON.stringify({version})); return; }
  const file = resolve(root, '.'+(path === '/' ? '/index.html' : path));
  if (!file.startsWith(root+sep)) { response.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    response.writeHead(200, {'Content-Type':mime[extname(file)] || 'application/octet-stream'});
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch { response.writeHead(404).end('Introuvable'); }
});
const wss = new WebSocketServer({ noServer:true, maxPayload:2048, perMessageDeflate:false });
http.on('upgrade', (request,socket,head) => {
  const origin = request.headers.origin;
  let validOrigin = true;
  try { if (origin) validOrigin = new URL(origin).host === request.headers.host; } catch { validOrigin = false; }
  if (request.url !== '/ws' || !validOrigin || wss.clients.size >= 80) { socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return; }
  wss.handleUpgrade(request,socket,head,ws => wss.emit('connection',ws,request));
});
wss.on('connection', socket => {
  const joinTimeout = setTimeout(() => socket.close(1008,'Choisissez un pseudo'), 10000);
  socket.on('error', () => {});
  socket.on('pong', () => { const session = sessions.get(socket); if(session) session.alive = true; });
  socket.on('message', raw => {
    let message;
    try { message = JSON.parse(raw.toString()); } catch { socket.close(1008,'Message invalide'); return; }
    if (!message || typeof message !== 'object') return;
    const session = sessions.get(socket);
    if (!session) {
      if (message.type !== 'join') return;
      if (typeof message.token !== 'string' || !/^[a-f0-9-]{36}$/i.test(message.token)) { socket.close(1008,'Identifiant invalide'); return; }
      const name = typeof message.name === 'string' ? message.name.trim().replace(/[\p{Cc}\p{Cf}]/gu,'').slice(0,20) : '';
      if (!name) { send(socket,{type:'error',message:'Choisissez un pseudo.',terminal:true}); socket.close(1008); return; }
      for (const previous of sessions.values()) {
        if (previous.token === message.token) {
          remembered.set(message.token,{player:previous.player,expires:Date.now()+300000});
          sessions.delete(previous.socket);
          send(previous.socket,{type:'error',message:'Votre personnage est ouvert dans un autre onglet.',terminal:true});
          previous.socket.close(4001,'Autre onglet');
        }
      }
      const saved = remembered.get(message.token);
      const position = spawn(saved?.player || message.position);
      const skin = [...message.token].reduce((sum,c) => sum+c.charCodeAt(0),0)%6;
      const player: Player = { ...position,id:randomUUID(),name,skin,direction:'down',moving:false };
      sessions.set(socket,{socket,player,token:message.token,dx:0,dy:0,lastInput:Date.now(),alive:true,rate:0,rateTime:Date.now()});
      remembered.delete(message.token);
      clearTimeout(joinTimeout);
      send(socket,{type:'welcome',id:player.id,version,player});
      send(socket,{type:'world',players:[...sessions.values()].map(s => s.player)});
      return;
    }
    if (Date.now()-session.rateTime > 1000) { session.rate=0; session.rateTime=Date.now(); }
    if (++session.rate > 100) { socket.close(1008,'Trop de messages'); return; }
    if (message.type === 'input' && Number.isFinite(message.dx) && Number.isFinite(message.dy)) {
      session.dx = Math.max(-1,Math.min(1,message.dx)); session.dy = Math.max(-1,Math.min(1,message.dy));
      session.lastInput = Date.now();
    }
    if (message.type === 'ping' && Number.isFinite(message.time)) send(socket,{type:'pong',time:message.time});
  });
  socket.on('close', () => {
    clearTimeout(joinTimeout);
    const session = sessions.get(socket);
    if (session) { remembered.set(session.token,{player:session.player,expires:Date.now()+300000}); sessions.delete(socket); }
  });
});
let previous = performance.now(), step = 0;
const tick = setInterval(() => {
  const now = performance.now(), dt = Math.min((now-previous)/1000,0.05); previous=now;
  for (const session of sessions.values()) {
    if (Date.now()-session.lastInput > 500) { session.dx=0; session.dy=0; }
    const point = move(session.player,session.dx,session.dy,dt);
    session.player.moving = Math.hypot(point.x-session.player.x,point.y-session.player.y)>0.01;
    session.player.direction = facing(session.dx,session.dy,session.player.direction);
    Object.assign(session.player,point);
  }
  if (++step%2 === 0) {
    const message: ServerMessage = {type:'world',players:[...sessions.values()].map(s => s.player)};
    for (const session of sessions.values()) send(session.socket,message);
  }
},1000/40);
const heartbeat = setInterval(() => {
  for (const session of sessions.values()) {
    if (!session.alive) { session.socket.terminate(); continue; }
    session.alive=false; session.socket.ping();
  }
  for (const [token,saved] of remembered) if (saved.expires < Date.now()) remembered.delete(token);
},15000);
http.listen(Number(process.env.PORT || 3000),'0.0.0.0',() => {
  const address=http.address();
  console.log(`heu listening on ${typeof address==='object'&&address?address.port:process.env.PORT} (${version})`);
});
function shutdown() {
  clearInterval(tick); clearInterval(heartbeat);
  for(const socket of wss.clients) socket.close(1012,'Mise à jour');
  http.close(() => process.exit(0));
  setTimeout(() => process.exit(0),3000).unref();
}
process.on('SIGTERM',shutdown); process.on('SIGINT',shutdown);
