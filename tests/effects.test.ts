import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceEffects, hurt, blast, summonEnt, moveEnt } from '../shared/effects.ts';
import type { Player } from '../shared/world.ts';
const player=(id:string,name=id,x=640,y=480):Player=>({id,name,x,y,skin:0,direction:'down',moving:false,hp:50,maxHp:50,flying:false,invisible:false});
test('Grabolax aura deals exactly 10 DPS only inside its radius',()=>{
  const source=player('g','Grabolax'),near=player('n'),far=player('f','far',700);
  for(let i=0;i<40;i++)advanceEffects([source,near,far],[],.025,i*25);
  assert.ok(Math.abs(near.hp-40)<1e-8);assert.equal(source.hp,50);assert.equal(far.hp,50);
});
test('rabbits chase opponents, hit once and expire when owner leaves',()=>{
  const owner=player('o'),target=player('t','target',700);
  let rabbits=advanceEffects([owner,target],[{id:'r',ownerId:'o',x:660,y:480,expiresAt:8000}],.05,0);
  assert.ok(rabbits[0].x>660);assert.equal(owner.hp,50);
  rabbits=advanceEffects([owner,target],[{id:'r',ownerId:'o',x:700,y:480,expiresAt:8000}],.05,50);
  assert.equal(rabbits.length,0);assert.equal(target.hp,40);
  assert.equal(advanceEffects([target],[{id:'r',ownerId:'o',x:690,y:480,expiresAt:8000}],.05,50).length,0);assert.equal(target.hp,40);
});
test('lethal damage respawns with full HP',()=>{const p=player('p','p',100,100);hurt(p,50);assert.equal(p.hp,50);assert.equal(p.x,640);assert.equal(p.y,480);});

test('bomb hits only opponents inside its radius',()=>{const source=player('s'),near=player('n','n',700),far=player('f','f',900);blast([source,near,far],source);assert.equal(source.hp,50);assert.equal(near.x,640);assert.equal(far.x,900);});

test('Ents reserve unique trees and can leave their original roots',()=>{const p=player('p'),first=summonEnt(p,[])!;const other=summonEnt(player('q'),[first])!;assert.notEqual(first.treeIndex,other.treeIndex);const x=first.x;moveEnt(first,1,0,.05);assert.ok(first.x>x);});
