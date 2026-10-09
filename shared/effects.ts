import { move, spawn } from './world.ts';
import type { Player, Point } from './world.ts';
export type Rabbit = Point & { id:string; ownerId:string; expiresAt:number };
export const AURA_RADIUS=42;
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
