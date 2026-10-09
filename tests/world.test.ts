import test from 'node:test';
import assert from 'node:assert/strict';
import { move, spawn, pond, WORLD, facing } from '../shared/world.ts';

test('diagonal and cardinal movements have the same speed',()=>{
  const point={x:500,y:500};
  const straight=move(point,1,0,.05), diagonal=move(point,1,1,.05);
  assert.ok(Math.abs(Math.hypot(diagonal.x-point.x,diagonal.y-point.y)-(straight.x-point.x))<.0001);
});
test('movement cannot cross the pond or world boundary',()=>{
  const point={x:pond.x-WORLD.radius-1,y:pond.y+30};
  assert.deepEqual(move(point,1,0,.05),point);
  assert.deepEqual(move({x:39,y:400},-1,0,.05),{x:39,y:400});
});
test('invalid stored positions return to the shared meeting point',()=>{
  assert.deepEqual(spawn({x:NaN,y:400}),{x:640,y:480});
  assert.deepEqual(spawn({x:pond.x+20,y:pond.y+20}),{x:640,y:480});
  assert.deepEqual(spawn({x:500,y:500}),{x:500,y:500});
});
test('long pauses do not cause a teleport and idle keeps direction',()=>{
  assert.equal(move({x:500,y:500},1,0,10).x,507.5);
  assert.equal(facing(0,0,'left'),'left');
});

test("sprint is 70 percent faster and respects obstacles",()=>{const p={x:640,y:480};assert.equal(move(p,1,0,.05,true).x-p.x,(move(p,1,0,.05).x-p.x)*1.7);assert.equal(move({x:39,y:39},-1,0,.05,true).x,39);});
