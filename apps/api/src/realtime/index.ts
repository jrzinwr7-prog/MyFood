import type { Server as HttpServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { verifyToken } from '../core/auth.js';

const rooms = new Map<string, Set<WebSocket>>();
let wss: WebSocketServer | null = null;

export function initRealtime(server: HttpServer) {
  wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', async (socket, request) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const user = await verifyToken(url.searchParams.get('token') ?? '');
    if (!user) { socket.close(4401, 'Unauthorized'); return; }
    let room = rooms.get(user.id);
    if (!room) { room = new Set(); rooms.set(user.id, room); }
    room.add(socket);
    socket.on('close', () => { room?.delete(socket); if (!room?.size) rooms.delete(user.id); });
    socket.on('message', raw => {
      try { const msg = JSON.parse(raw.toString()); if (msg.type === 'ping') socket.send(JSON.stringify({ type: 'pong' })); } catch { /* ignora */ }
    });
    socket.send(JSON.stringify({ type: 'ready', user: user.id }));
  });
}

export function emit(userId: string | null | undefined, event: string, data: unknown) {
  if (!userId) return;
  const payload = JSON.stringify({ type: event, data, at: new Date().toISOString() });
  rooms.get(userId)?.forEach(ws => { if (ws.readyState === WebSocket.OPEN) ws.send(payload); });
}
export function emitMany(userIds: (string | null | undefined)[], event: string, data: unknown) {
  new Set(userIds.filter(Boolean)).forEach(id => emit(id as string, event, data));
}
