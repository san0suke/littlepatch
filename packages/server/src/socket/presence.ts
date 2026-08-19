import type { PatchServer } from './socket-server.js';

/**
 * Quem está com o jogo aberto agora.
 *
 * Lido do próprio Socket.IO em vez de mantido num `Set` paralelo: a lista de
 * sockets conectados já é a verdade, e um espelho manual dessa lista fica
 * desatualizado no primeiro `disconnect` que escapar de um `try`.
 *
 * Um jogador pode ter várias abas abertas — daí o `Set` de ids de usuário, e não
 * uma contagem de sockets.
 */
export function onlineUserIds(io: PatchServer): Set<string> {
  const ids = new Set<string>();
  for (const socket of io.sockets.sockets.values()) {
    const user = socket.data.user;
    if (user) {
      ids.add(user.id);
    }
  }
  return ids;
}

/** Todos os sockets de um jogador (ele pode estar em mais de uma aba). */
export function socketsOfUser(io: PatchServer, userId: string) {
  return [...io.sockets.sockets.values()].filter((socket) => socket.data.user?.id === userId);
}
