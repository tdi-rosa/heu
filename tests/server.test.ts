import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import type { ServerMessage } from '../shared/protocol.ts';

test('two browsers share one world, move, disconnect and rejoin', {timeout:20000}, async t=>{
  const child=spawn(process.execPath,['server/index.ts'],{cwd:process.cwd(),env:{...process.env,PORT:'0',APP_VERSION:'integration-test'},stdio:['ignore','pipe','pipe']});
  t.after(()=>child.kill('SIGTERM'));
  let output='';
  const port=await new Promise<number>((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Server startup timeout: '+output)),5000);
    child.stderr.on('data',chunk=>output+=chunk);
    child.stdout.on('data',chunk=>{output+=chunk;const match=output.match(/listening on (\d+)/);if(match){clearTimeout(timer);resolve(Number(match[1]));}});
    child.on('exit',code=>{clearTimeout(timer);reject(new Error('Server exited '+code+': '+output));});
  });
  const base=`http://127.0.0.1:${port}`;
  const response=await fetch(base);
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
  assert.match(await response.text(),/Choisissez|Comment on vous appelle/);
  assert.equal((await (await fetch(base+'/version')).json()).version,'integration-test');
  assert.equal((await fetch(base+'/game.js')).status,200);
  assert.equal((await fetch(base+'/missing')).status,404);

  const sockets:WebSocket[]=[];t.after(()=>sockets.forEach(s=>s.terminate()));
  function wait(ws:WebSocket,condition:(message:ServerMessage)=>boolean):Promise<ServerMessage>{return new Promise((resolve,reject)=>{
    const listener=(raw:Buffer)=>{const message=JSON.parse(raw.toString());if(condition(message)){clearTimeout(timer);ws.off('message',listener);resolve(message);}};
    const timer=setTimeout(()=>{ws.off('message',listener);reject(new Error('WebSocket message timeout'));},4000);
    ws.on('message',listener);
  });}
  async function join(name:string,token=randomUUID(),position?:{x:number;y:number}){
    const socket=new WebSocket(`ws://127.0.0.1:${port}/ws`);sockets.push(socket);await once(socket,'open');
    const promise=wait(socket,m=>m.type==='welcome');socket.send(JSON.stringify({type:'join',name,token,position}));
    const message=await promise;assert.equal(message.type,'welcome');if(message.type!=='welcome')throw new Error('No welcome');
    return {socket,token,player:message.player};
  }
  const alice=await join('Alice'),bob=await join('Bob');
  assert.equal(alice.player.invisible,false);
  const both=await wait(alice.socket,m=>m.type==='world'&&m.players.length===2);
  if(both.type!=='world')throw new Error('No world');assert.deepEqual(both.players.map(p=>p.name).sort(),['Alice','Bob']);
  assert.ok(both.players.every(p=>p.hp===50&&p.maxHp===50));
  const airborne=wait(bob.socket,m=>m.type==='world'&&m.players.some(p=>p.id===alice.player.id&&p.flying));
  alice.socket.send(JSON.stringify({type:'jetpack',flying:true}));await airborne;
  const landed=wait(bob.socket,m=>m.type==='world'&&m.players.some(p=>p.id===alice.player.id&&!p.flying));
  alice.socket.send(JSON.stringify({type:'jetpack',flying:false}));await landed;
  const fire=wait(bob.socket,m=>m.type==='fire'&&m.playerId===alice.player.id);
  alice.socket.send(JSON.stringify({type:'fire'}));
  const flame=await fire;if(flame.type!=='fire')throw new Error('No flame');
  assert.equal(flame.direction,'down');assert.equal(flame.expiresAt-flame.createdAt,800);
  assert.equal(flame.x,alice.player.x);assert.equal(flame.y,alice.player.y);

  const slash=wait(bob.socket,m=>m.type==='attack'&&m.playerId===alice.player.id&&m.targetId===bob.player.id);
  const damaged=wait(bob.socket,m=>m.type==='world'&&m.players.some(p=>p.id===bob.player.id&&p.hp===45));
  alice.socket.send(JSON.stringify({type:'attack'}));await slash;await damaged;

  alice.socket.send(JSON.stringify({type:'input',dx:1,dy:0}));
  const movement=await wait(bob.socket,m=>m.type==='world'&&m.players.some(p=>p.id===alice.player.id&&p.x>alice.player.x+10));
  if(movement.type!=='world')throw new Error('No world');
  const moved=movement.players.find(p=>p.id===alice.player.id)!;assert.ok(moved.x<alice.player.x+85);
  alice.socket.send(JSON.stringify({type:'input',dx:0,dy:0}));
  alice.socket.close();await once(alice.socket,'close');
  await wait(bob.socket,m=>m.type==='world'&&m.players.length===1);
  const rejoined=await join('Alice',alice.token);
  assert.ok(rejoined.player.x>=moved.x);assert.equal(rejoined.player.name,'Alice');
  const stopTime=performance.now();
  await wait(rejoined.socket,m=>m.type==='world'&&performance.now()-stopTime>600);
  const previous=rejoined.player.x;
  const current=await wait(rejoined.socket,m=>m.type==='world');
  if(current.type==='world')assert.equal(current.players.find(p=>p.id===rejoined.player.id)?.x,previous);

  // Another tab takes over the same identity without duplicating the character.
  const replaced=wait(rejoined.socket,m=>m.type==='error'&&m.terminal===true);
  const otherTab=await join('Alice',alice.token);await replaced;
  const after=await wait(bob.socket,m=>m.type==='world'&&m.players.length===2);
  if(after.type==='world')assert.equal(after.players.filter(p=>p.name==='Alice').length,1);
  otherTab.socket.send('{broken');await once(otherTab.socket,'close');
  const summoner=await join('Summoner',randomUUID(),{x:300,y:480});
  const summoned=wait(bob.socket,m=>m.type==='world'&&(m.rabbits||[]).filter(r=>r.ownerId===summoner.player.id).length===3);
  summoner.socket.send(JSON.stringify({type:'summon'}));await summoned;
  summoner.socket.close();await once(summoner.socket,'close');
  const invisible=await join('Grabolax');assert.equal(invisible.player.invisible,true);
  assert.equal(invisible.player.flying,false);
});
