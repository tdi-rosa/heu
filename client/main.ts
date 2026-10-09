import { Renderer } from './render.ts';
import { initRequests } from './requests.ts';
import { newToken } from '../shared/identity.ts';
import { move, facing, spawn, WORLD } from '../shared/world.ts';
import type { Player, Point } from '../shared/world.ts';
import type { ClientMessage, ServerMessage } from '../shared/protocol.ts';

const $ = <T extends HTMLElement>(id:string) => document.getElementById(id) as T;
const dialog=$<HTMLDialogElement>('join'),form=$<HTMLFormElement>('join-form'),nickname=$<HTMLInputElement>('nickname');
const status=$('status'),dot=$('connection-dot'),count=$('count'),rename=$<HTMLButtonElement>('rename');
const renderer=new Renderer($<HTMLCanvasElement>('world'));
const storage={
  get(key:string){try{return localStorage.getItem('heu.'+key);}catch{return null;}},
  set(key:string,value:string){try{localStorage.setItem('heu.'+key,value);}catch{/* The game remains usable when storage is disabled. */}}
};
let name=storage.get('name')||'',token=storage.get('token')||newToken();storage.set('token',token);
let savedPosition:Point|undefined;
try{const saved=storage.get('position');if(saved)savedPosition=JSON.parse(saved);}catch{}
let self:Player|undefined, socket:WebSocket|undefined, version:string|undefined;
let attempt=0, reconnectTimer:number|undefined, terminal=false, rtt=80, reloading=false;
let target:Point|undefined,serverVelocity:Point={x:0,y:0}, lastDirection={dx:0,dy:0};
const keys=new Set<string>();let touch={dx:0,dy:0};
type Snapshot={at:number;players:Player[]};const snapshots:Snapshot[]=[];
function connection(text:string,online=false){status.textContent=text;dot.classList.toggle('online',online);}
function send(message:ClientMessage){if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify(message));}
function persist(){if(self)storage.set('position',JSON.stringify({x:self.x,y:self.y}));}
function stop(){keys.clear();touch={dx:0,dy:0};lastDirection={dx:0,dy:0};if(self)self.moving=false;send({type:'input',dx:0,dy:0});}
function refresh(){if(reloading)return;reloading=true;persist();connection('Mise à jour…');location.reload();}
function connect(){
  if(!name||terminal||reloading)return;
  if(reconnectTimer)clearTimeout(reconnectTimer);
  const ws=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/ws`);socket=ws;
  connection(attempt?'Reconnexion…':'Connexion…');
  ws.addEventListener('open',()=>{
    if(ws!==socket)return;
    send({type:'join',token,name,position:self?{x:self.x,y:self.y}:savedPosition});
  });
  ws.addEventListener('message',event=>{
    if(ws!==socket)return;
    let message:ServerMessage;try{message=JSON.parse(event.data);}catch{return;}
    if(message.type==='welcome'){
      if(version&&version!==message.version){refresh();return;}
      version=message.version;self=message.player;target=undefined;snapshots.length=0;
      attempt=0;connection('En ligne',true);rename.textContent=name+' ↗';
      renderer.camera={x:self.x,y:self.y};
      send({type:'ping',time:Date.now()});
    }
    if(message.type==='world'){
      const at=performance.now();snapshots.push({at,players:message.players});while(snapshots.length>20)snapshots.shift();
      count.textContent=message.players.length+' ici';
      const own=message.players.find(player=>player.id===self?.id);
      if(own){
        target={x:own.x,y:own.y};
        const sample=snapshots.at(-2)?.players.find(player=>player.id===own.id);
        const sampleDt=at-(snapshots.at(-2)?.at||at);
        if(sample&&sampleDt>0){serverVelocity={x:(own.x-sample.x)/(sampleDt/1000),y:(own.y-sample.y)/(sampleDt/1000)};}
      }
    }
    if(message.type==='pong')rtt=Math.max(0,Math.min(400,Date.now()-message.time));
    if(message.type==='error'){connection(message.message);if(message.terminal){terminal=true;stop();}}
  });
  ws.addEventListener('close',()=>{
    if(ws!==socket||terminal||reloading)return;
    persist();stop();count.textContent='— ici';connection('Reconnexion…');
    const delay=Math.min(4000,350*2**Math.min(attempt++,4))+Math.random()*150;
    reconnectTimer=window.setTimeout(connect,delay);
  });
  ws.addEventListener('error',()=>{});
}
function showJoin(){stop();nickname.value=name;dialog.showModal();requestAnimationFrame(()=>nickname.focus());}
dialog.addEventListener('cancel',event=>{if(!name)event.preventDefault();});
form.addEventListener('submit',event=>{
  event.preventDefault();
  const next=nickname.value.trim().replace(/[\p{Cc}\p{Cf}]/gu,'').slice(0,20);
  if(!next){nickname.setCustomValidity('Choisissez un pseudo.');nickname.reportValidity();return;}
  name=next;storage.set('name',name);nickname.setCustomValidity('');dialog.close();terminal=false;
  const previous=socket;socket=undefined;previous?.close();connect();
});
nickname.addEventListener('input',()=>nickname.setCustomValidity(''));
rename.addEventListener('click',showJoin);
const movementKeys=new Set(['z','q','s','d','w','a','arrowup','arrowdown','arrowleft','arrowright']);
const modalOpen=()=>Boolean(document.querySelector('dialog[open]'));
window.addEventListener('keydown',event=>{if(modalOpen())return;const key=event.key.toLowerCase();if(movementKeys.has(key)){event.preventDefault();keys.add(key);}});
window.addEventListener('keyup',event=>{keys.delete(event.key.toLowerCase());});
window.addEventListener('blur',stop);
document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();persist();}else{void checkVersion();if(socket?.readyState===WebSocket.CLOSED)connect();}});
window.addEventListener('pagehide',persist);
const joystick=$('joystick'),stick=$('stick');let pointerId:number|undefined;
joystick.addEventListener('pointerdown',event=>{if(modalOpen()||pointerId!==undefined)return;pointerId=event.pointerId;joystick.setPointerCapture(pointerId);updateStick(event);});
joystick.addEventListener('pointermove',event=>{if(event.pointerId===pointerId)updateStick(event);});
function updateStick(event:PointerEvent){const bounds=joystick.getBoundingClientRect();let x=event.clientX-bounds.left-bounds.width/2,y=event.clientY-bounds.top-bounds.height/2;const length=Math.hypot(x,y);if(length>36){x=x/length*36;y=y/length*36;}stick.style.transform=`translate(${x}px,${y}px)`;touch={dx:Math.abs(x)<5?0:x/36,dy:Math.abs(y)<5?0:y/36};}
function releaseStick(event:PointerEvent){if(event.pointerId!==pointerId)return;pointerId=undefined;stick.style.transform='';touch={dx:0,dy:0};}
joystick.addEventListener('pointerup',releaseStick);joystick.addEventListener('pointercancel',releaseStick);joystick.addEventListener('lostpointercapture',releaseStick);
function input(){if(modalOpen()||document.hidden||terminal)return {dx:0,dy:0};return {
  dx:touch.dx+(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('q')||keys.has('a')||keys.has('arrowleft')?1:0),
  dy:touch.dy+(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('z')||keys.has('w')||keys.has('arrowup')?1:0)
};}
setInterval(()=>{if(self&&socket?.readyState===WebSocket.OPEN){const {dx,dy}=input();lastDirection={dx:Math.max(-1,Math.min(1,dx)),dy:Math.max(-1,Math.min(1,dy))};send({type:'input',...lastDirection});}},33);
setInterval(()=>{persist();if(socket?.readyState===WebSocket.OPEN)send({type:'ping',time:Date.now()});},2000);
let candidateVersion:string|undefined;
async function checkVersion(){
  if(!version||reloading)return;
  try{
    const response=await fetch('/version',{cache:'no-store'});if(!response.ok)return;
    const next=(await response.json()).version;
    if(typeof next!=='string')return;
    if(next!==version){if(next===candidateVersion)refresh();else candidateVersion=next;}else candidateVersion=undefined;
  }catch{/* The socket handles transient outages. */}
}
setInterval(()=>void checkVersion(),6000);
function others(time:number):Player[]{
  if(!snapshots.length)return [];
  const renderAt=time-100;
  let before=snapshots[0],after=snapshots.at(-1)!;
  for(const snapshot of snapshots){if(snapshot.at<=renderAt)before=snapshot;if(snapshot.at>=renderAt){after=snapshot;break;}}
  const alpha=after.at===before.at?1:Math.max(0,Math.min(1,(renderAt-before.at)/(after.at-before.at)));
  const latest=snapshots.at(-1)!;
  return latest.players.filter(p=>p.id!==self?.id).map(player=>{
    const a=before.players.find(p=>p.id===player.id)||player,b=after.players.find(p=>p.id===player.id)||player;
    return {...b,x:a.x+(b.x-a.x)*alpha,y:a.y+(b.y-a.y)*alpha};
  });
}
let last=performance.now();
function animate(time:number){
  const dt=Math.min((time-last)/1000,.05);last=time;
  if(self&&socket?.readyState===WebSocket.OPEN&&!terminal){
    const controls=input();const magnitude=Math.hypot(controls.dx,controls.dy);
    const dx=controls.dx/Math.max(1,magnitude),dy=controls.dy/Math.max(1,magnitude);
    if(target){
      const latency=Math.min(rtt/2,100)/1000;
      const estimated={x:target.x+(magnitude?serverVelocity.x*latency:0),y:target.y+(magnitude?serverVelocity.y*latency:0)};
      const error=Math.hypot(estimated.x-self.x,estimated.y-self.y);
      if(error>100)Object.assign(self,spawn(estimated));
      else if(error>1.5){const factor=1-Math.exp(-dt*(magnitude?3:12));Object.assign(self,spawn({x:self.x+(estimated.x-self.x)*factor,y:self.y+(estimated.y-self.y)*factor}));}
    }
    const next=move(self,dx,dy,dt);self.moving=Math.hypot(next.x-self.x,next.y-self.y)>.01;
    self.direction=facing(dx,dy,self.direction);Object.assign(self,next);
  }
  renderer.draw([...others(time),...(self?[self]:[])],self,time,dt);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
initRequests({token,stop,storage});
if(name)connect();else showJoin();
