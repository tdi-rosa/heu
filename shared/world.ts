export const WORLD = { width: 1280, height: 960, tile: 32, speed: 150, radius: 7 };
export type Direction = 'down' | 'up' | 'left' | 'right';
export type Point = { x: number; y: number };
export type Player = Point & { id: string; name: string; skin: number; direction: Direction; moving: boolean; hp: number; maxHp: number };
export const pond = { x: 790, y: 210, width: 220, height: 155 };
export const trees: Point[] = [
  {x:180,y:185},{x:245,y:160},{x:110,y:350},{x:180,y:420},
  {x:1060,y:440},{x:1110,y:500},{x:1000,y:690},{x:1080,y:750},
  {x:280,y:710},{x:210,y:780},{x:380,y:795},{x:700,y:800},
  {x:600,y:125},{x:690,y:145},{x:1110,y:180}
];
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export function blocked(x: number, y: number): boolean {
  const r = WORLD.radius;
  if (x < 32 + r || y < 32 + r || x > WORLD.width - 32 - r || y > WORLD.height - 32 - r) return true;
  if (x > pond.x-r && x < pond.x+pond.width+r && y > pond.y-r && y < pond.y+pond.height+r) return true;
  return trees.some(tree => Math.hypot(x-tree.x, y-tree.y) < r+12);
}
export function move(point: Point, dx: number, dy: number, dt: number): Point {
  const magnitude = Math.hypot(dx, dy);
  if (!magnitude) return { ...point };
  const scale = WORLD.speed * clamp(dt, 0, 0.05) / Math.max(1, magnitude);
  let {x,y} = point;
  const nextX = x+dx*scale, nextY = y+dy*scale;
  if (!blocked(nextX, y)) x = nextX;
  if (!blocked(x, nextY)) y = nextY;
  return {x,y};
}
export function facing(dx: number, dy: number, previous: Direction): Direction {
  if (!dx && !dy) return previous;
  return Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 'right' : 'left' : dy > 0 ? 'down' : 'up';
}
export function spawn(point?: Point): Point {
  if (point && Number.isFinite(point.x) && Number.isFinite(point.y) && !blocked(point.x, point.y)) return point;
  return {x: 640, y: 480};
}
