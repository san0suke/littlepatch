import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from '@patch/shared';
import { env } from '../config/env.js';
import { buildCorsOriginCheck } from '../config/cors.js';
import { startPetTicker } from '../pets/pet.ticker.js';
import { socketAuthMiddleware } from './socket-auth.middleware.js';
import { registerPetHandlers } from './pet.handlers.js';
import { registerGardenHandlers } from './garden.handlers.js';

export type PatchServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export type PatchSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export function createSocketServer(httpServer: HttpServer): PatchServer {
  const io: PatchServer = new Server(httpServer, {
    cors: { origin: buildCorsOriginCheck(env.corsOrigin) },
  });

  io.use(socketAuthMiddleware);

  io.on('connection', (socket) => {
    console.log(`[socket] ${socket.data.user.username} connected (${socket.id})`);

    registerPetHandlers(io, socket);
    registerGardenHandlers(io, socket);

    socket.on('disconnect', (reason) => {
      console.log(`[socket] ${socket.data.user.username} disconnected: ${reason}`);
    });
  });

  // O relógio do bicho: empurra o estado para quem está com o jogo aberto e
  // grava o que já passou. Quem está offline não precisa de tique nenhum.
  startPetTicker(io);

  return io;
}
