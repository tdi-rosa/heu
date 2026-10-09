import type { Player, Point } from './world.ts';
export type ClientMessage =
  | { type: 'join'; token: string; name: string; position?: Point }
  | { type: 'input'; dx: number; dy: number }
  | { type: 'attack' }
  | { type: 'ping'; time: number };
export type ServerMessage =
  | { type: 'attack'; id: string; playerId: string; targetId?: string; createdAt: number; expiresAt: number }
  | { type: 'speech'; id: string; playerId: string; text: string; createdAt: number; expiresAt: number }
  | { type: 'welcome'; id: string; version: string; player: Player }
  | { type: 'world'; players: Player[] }
  | { type: 'pong'; time: number }
  | { type: 'error'; message: string; terminal?: boolean };
