import { move, spawn, trees } from './world.ts';
import type { Player, Point } from './world.ts';
export type Ent = Point & { ownerId:string; treeIndex:number; moving:boolean };
export function summonEnt(player:Player,ents:Ent[]):Ent|undefined{
  const available=trees.map((p,treeIndex)=>({...p,treeIndex})).filter(t=>!ents.some(e=>e.treeIndex===t.treeIndex)).sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y));
  const tree=available[0];return tree?{...tree,ownerId:player.id,moving:false}:undefined;
}
export function moveEnt(ent:Ent,dx:number,dy:number,dt:number){const next=move(ent,dx,dy,dt,false,trees.filter((_,i)=>i!==ent.treeIndex));ent.moving=Math.hypot(next.x-ent.x,next.y-ent.y)>.01;Object.assign(ent,next);}
export type Rabbit = Point & { id:string; ownerId:string; expiresAt:number };
export const AURA_RADIUS=42;
export const BOMB_RADIUS=180;
export function blast(players:Player[],source:Player){for(const target of players)if(target.id!==source.id&&Math.hypot(target.x-source.x,target.y-source.y)<=BOMB_RADIUS)hurt(target,50);}
export function hurt(player:Player,damage:number){
  player.hp=Math.max(0,player.hp-damage);
  if(player.hp<=.00001){Object.assign(player,spawn());player.hp=player.maxHp;}
}
export function advanceEffects(players:Player[],rabbits:Rabbit[],dt:number,now:number):Rabbit[]{
  for(const source of players)if(source.name.toLowerCase()==='grabolax'){
    for(const target of players)if(target!==source&&Math.hypot(target.x-source.x,target.y-source.y)<=AURA_RADIUS)hurt(target,10*dt);
  }
  return rabbits.filter(rabbit=>{
    if(now>=rabbit.expiresAt||!players.some(p=>p.id===rabbit.ownerId))return false;
    const target=players.filter(p=>p.id!==rabbit.ownerId).sort((a,b)=>Math.hypot(a.x-rabbit.x,a.y-rabbit.y)-Math.hypot(b.x-rabbit.x,b.y-rabbit.y))[0];
    if(!target)return true;
    const dx=target.x-rabbit.x,dy=target.y-rabbit.y,distance=Math.hypot(dx,dy);
    if(distance<=16){hurt(target,10);return false;}
    Object.assign(rabbit,move(rabbit,dx/Math.max(1,distance),dy/Math.max(1,distance),dt,true));
    return true;
  });
}
