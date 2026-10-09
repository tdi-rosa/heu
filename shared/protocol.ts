import type { Rabbit, Ent } from './effects.ts';
import type { Player, Point } from './world.ts';
export type ClientMessage =
  | { type: 'join'; token: string; name: string; position?: Point }
  | { type: 'input'; dx: number; dy: number; sprint?: boolean }
  | { type: 'attack' }
  | { type: 'summon' }
  | { type: 'bomb' }
  | { type: 'ent' }
  | { type: 'fire' }
  | { type: 'jetpack'; flying: boolean }
  | { type: 'ping'; time: number };
export type ServerMessage =
  | { type: 'bomb'; id:string; x:number; y:number; createdAt:number; expiresAt:number }
  | { type: 'fire'; id: string; playerId: string; x: number; y: number; direction: Player['direction']; createdAt: number; expiresAt: number }
  | { type: 'attack'; id: string; playerId: string; targetId?: string; createdAt: number; expiresAt: number }
  | { type: 'speech'; id: string; playerId: string; text: string; createdAt: number; expiresAt: number }
  | { type: 'welcome'; id: string; version: string; player: Player }
  | { type: 'world'; players: Player[]; rabbits?: Rabbit[]; ents?: Ent[] }
  | { type: 'pong'; time: number }
  | { type: 'error'; message: string; terminal?: boolean };
