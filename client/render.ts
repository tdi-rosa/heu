import { WORLD, pond, trees } from '../shared/world.ts';
import type { Player, Point, Direction } from '../shared/world.ts';
import { characterSheets, treeSprite } from '../assets/sprites.ts';
import type { ServerMessage } from '../shared/protocol.ts';
const terrain=document.createElement('canvas'); terrain.width=WORLD.width;terrain.height=WORLD.height;
const t=terrain.getContext('2d')!;
let seed=42;
function random() { seed=(seed*1664525+1013904223)>>>0;return seed/4294967296; }
t.fillStyle='#ac96c1';t.fillRect(0,0,WORLD.width,WORLD.height);
for(let i=0;i<18000;i++) {
  const x=Math.floor(random()*WORLD.width),y=Math.floor(random()*WORLD.height);
  t.fillStyle=random()>.6?'#9b84b1':'#baa7ce';t.fillRect(x,y,random()>.85?3:1,1);
}
// Quiet crossing paths make the meeting point easy to recognize.
t.fillStyle='#cbd0a4';t.fillRect(32,447,WORLD.width-64,66);t.fillRect(607,32,66,WORLD.height-64);
t.fillStyle='#d4d6b0';t.fillRect(32,453,WORLD.width-64,54);t.fillRect(613,32,54,WORLD.height-64);
for(let i=0;i<1200;i++) {const x=Math.floor(random()*WORLD.width),y=Math.floor(random()*WORLD.height);if((y>453&&y<507)||(x>613&&x<667)){t.fillStyle='#c5c99c';t.fillRect(x,y,2,1);}}
// Pixel-stepped banks and a calm blue pond.
t.fillStyle='#947bab';t.fillRect(pond.x-8,pond.y-4,pond.width+16,pond.height+8);t.fillRect(pond.x-4,pond.y-8,pond.width+8,pond.height+16);
t.fillStyle='#86b5bb';t.fillRect(pond.x,pond.y,pond.width,pond.height);
t.fillStyle='#a2c7c5';t.fillRect(pond.x+4,pond.y,pond.width-8,3);t.fillRect(pond.x,pond.y+3,3,pond.height-6);
for(let i=0;i<100;i++){const x=pond.x+8+Math.floor(random()*(pond.width-16)),y=pond.y+8+Math.floor(random()*(pond.height-16));t.fillStyle='#91bfc2';t.fillRect(x,y,7,1);}
for(let i=0;i<190;i++) {
  const x=40+Math.floor(random()*(WORLD.width-80)),y=40+Math.floor(random()*(WORLD.height-80));
  if((Math.abs(x-640)<60)||(Math.abs(y-480)<60)||(x>pond.x-15&&x<pond.x+pond.width+15&&y>pond.y-15&&y<pond.y+pond.height+15))continue;
  t.fillStyle='#79618e';t.fillRect(x,y,1,4);
  t.fillStyle=i%3===0?'#f0dda1':'#e4eacb';t.fillRect(x-1,y-2,3,3);
}
t.fillStyle='#856f9c';t.fillRect(0,0,WORLD.width,26);t.fillRect(0,WORLD.height-26,WORLD.width,26);t.fillRect(0,0,26,WORLD.height);t.fillRect(WORLD.width-26,0,26,WORLD.height);
// Simple timber fence around the shared clearing.
for(let x=32;x<WORLD.width;x+=32){for(const y of [22,WORLD.height-30]){t.fillStyle='#b19b72';t.fillRect(x,y,4,12);t.fillRect(x,y+3,32,3);t.fillStyle='#c7b38c';t.fillRect(x,y,4,2);}}
for(let y=32;y<WORLD.height;y+=32){for(const x of [22,WORLD.width-30]){t.fillStyle='#b19b72';t.fillRect(x,y,4,12);t.fillRect(x+1,y,2,32);}}

export class Renderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  camera: Point = {x:640,y:480};
  speechLayouts = new Map<string,{lines:string[];width:number;height:number}>();
  width=0; height=0; dpr=1; zoom=2;
  constructor(canvas:HTMLCanvasElement){this.canvas=canvas;this.ctx=canvas.getContext('2d')!;this.resize();window.addEventListener('resize',()=>this.resize());}
  resize(){this.width=innerWidth;this.height=innerHeight;this.dpr=Math.min(devicePixelRatio||1,2);this.zoom=this.width<600?1.6:2;this.canvas.width=Math.round(this.width*this.dpr);this.canvas.height=Math.round(this.height*this.dpr);}
  draw(players:Player[],self:Player|undefined,time:number,dt:number,speeches:Extract<ServerMessage,{type:'speech'}>[]=[]){
    const halfW=this.width/this.zoom/2,halfH=this.height/this.zoom/2;
    const focus=self||{x:640,y:480};
    const targetX=halfW*2>WORLD.width?WORLD.width/2:Math.max(halfW,Math.min(WORLD.width-halfW,focus.x));
    const targetY=halfH*2>WORLD.height?WORLD.height/2:Math.max(halfH,Math.min(WORLD.height-halfH,focus.y));
    const ease=1-Math.exp(-dt*7);
    this.camera.x+=(targetX-this.camera.x)*ease;this.camera.y+=(targetY-this.camera.y)*ease;
    const ctx=this.ctx;
    ctx.setTransform(this.dpr,0,0,this.dpr,0,0);ctx.fillStyle='#856f9c';ctx.fillRect(0,0,this.width,this.height);
    ctx.imageSmoothingEnabled=false;
    ctx.translate(this.width/2,this.height/2);ctx.scale(this.zoom,this.zoom);ctx.translate(-Math.round(this.camera.x),-Math.round(this.camera.y));
    ctx.drawImage(terrain,0,0);
    ctx.fillStyle='#c0d8d0';
    for(let i=0;i<7;i++){const x=pond.x+30+(i*43)%170,y=pond.y+22+(i*29)%110;ctx.globalAlpha=.3+.2*Math.sin(time/1300+i);ctx.fillRect(x,y,9,1);}ctx.globalAlpha=1;
    const objects=[...trees.map(point=>({kind:'tree' as const,point})),...players.map(player=>({kind:'player' as const,point:player}))].sort((a,b)=>a.point.y-b.point.y);
    for(const object of objects){
      const {x,y}=object.point;
      if(object.kind==='tree'){ctx.fillStyle='#728e5c50';ctx.beginPath();ctx.ellipse(x+4,y+3,24,7,0,0,Math.PI*2);ctx.fill();ctx.drawImage(treeSprite,Math.round(x-32),Math.round(y-86),64,96);}
      else{
        const player=object.point as Player;
        ctx.fillStyle='#50624635';ctx.beginPath();ctx.ellipse(x,y+1,12,4,0,0,Math.PI*2);ctx.fill();
        const row:Record<Direction,number>={down:0,left:1,right:2,up:3};
        const cycle=[1,0,1,2],frame=player.moving?cycle[Math.floor(time/145)%4]:1;
        ctx.drawImage(characterSheets[player.skin],frame*16,row[player.direction]*24,16,24,Math.round(x-16),Math.round(y-44),32,48);
        ctx.font='500 7px system-ui';ctx.textAlign='center';
        const textWidth=ctx.measureText(player.name).width;
        ctx.fillStyle=player.id===self?.id?'#f8f9f2f2':'#f8f9f2d9';ctx.beginPath();ctx.roundRect(x-textWidth/2-5,y-59,textWidth+10,12,3);ctx.fill();
        ctx.fillStyle='#3c4837';ctx.fillText(player.name,x,y-50.5);
        if(player.id===self?.id){ctx.fillStyle='#f8f9f2';ctx.fillRect(Math.round(x-1),Math.round(y-65),2,2);}
      }
    }
    const activeSpeechIds=new Set(speeches.map(s=>s.id));
    for(const id of this.speechLayouts.keys())if(!activeSpeechIds.has(id))this.speechLayouts.delete(id);
    // Speech is a final overlay so a nearby tree or player cannot hide it.
    for(const speech of speeches){
      const player=players.find(p=>p.id===speech.playerId);if(!player)continue;
      const remaining=speech.expiresAt-Date.now();if(remaining<=0)continue;
      const alpha=Math.min(1,remaining/700,(Date.now()-speech.createdAt)/180);
      ctx.save();ctx.globalAlpha=Math.max(0,alpha);ctx.font='500 8px system-ui';ctx.textAlign='left';
      let layout=this.speechLayouts.get(speech.id);
      if(!layout){
        const lines:string[]=[];let line='';
        for(const char of speech.text.replace(/\s+/g,' ')){
          if(ctx.measureText(line+char).width>150&&line){lines.push(line.trim());line=char;}else line+=char;
        }
        if(line)lines.push(line.trim());
        const shown=lines.slice(0,12);if(lines.length>12)shown[11]=shown[11].slice(0,-1)+'…';
        layout={lines:shown,width:Math.max(36,...shown.map(l=>ctx.measureText(l).width))+16,height:shown.length*11+14};
        this.speechLayouts.set(speech.id,layout);
      }
      const {lines:shown,width,height}=layout;
      const x=player.x-width/2,y=player.y-73-height;
      ctx.fillStyle='#fdfdf7f5';ctx.beginPath();ctx.roundRect(x,y,width,height,7);ctx.fill();
      ctx.beginPath();ctx.moveTo(player.x-4,y+height-1);ctx.lineTo(player.x,y+height+5);ctx.lineTo(player.x+4,y+height-1);ctx.closePath();ctx.fill();
      ctx.fillStyle='#363e32';shown.forEach((l,i)=>ctx.fillText(l,x+8,y+13+i*11));ctx.restore();
    }
  }
}
