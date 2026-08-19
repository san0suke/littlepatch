import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@patch/shared';
import { getToken, saveCoins } from './auth-storage.js';
import { SOCKET_URL } from './backend-url.js';
import { petStore } from './pet-store.js';

export type PatchClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: PatchClientSocket | null = null;

/** One shared connection for the whole session, authenticated with the stored JWT. */
export function getSocket(): PatchClientSocket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      auth: { token: getToken() ?? '' },
      autoConnect: true,
    });

    // Estado do bicho e saldo mudam longe de qualquer cena — num tique do
    // servidor, num mimo que outro jogador mandou. Guardar aqui, na conexão,
    // deixa o valor certo para quem for desenhar depois; as cenas escutam os
    // mesmos eventos só para se redesenhar.
    socket.on('pet:state', (pet) => petStore.receive(pet));
    socket.on('user:coins', ({ coins }) => saveCoins(coins));
  }
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
  petStore.clear();
}
