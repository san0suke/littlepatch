import { PetError, cheerPet, listGarden } from '../pets/pet.service.js';
import type { PatchServer, PatchSocket } from './socket-server.js';
import { onlineUserIds, socketsOfUser } from './presence.js';

/**
 * O jardim: os bichos dos outros jogadores.
 *
 * É o que faz o jogo ser online e não um chaveirinho de plástico. Por enquanto a
 * interação é um mimo — alegria para o bicho visitado, uma moeda para quem
 * visita, com espera por par de jogadores para não virar um botão de dinheiro.
 */
export function registerGardenHandlers(io: PatchServer, socket: PatchSocket): void {
  const { id: userId, username } = socket.data.user;

  socket.on('garden:list', async (ack) => {
    try {
      ack(await listGarden(userId, onlineUserIds(io)));
    } catch (error) {
      console.error('[socket] garden:list failed', error);
      ack([]);
    }
  });

  socket.on('garden:cheer', async (payload) => {
    const petId = String(payload?.petId ?? '');
    if (!petId) {
      socket.emit('server:error', { code: 'invalid-pet', message: 'Bicho não informado.' });
      return;
    }

    try {
      const result = await cheerPet(userId, petId);

      socket.emit('user:coins', { coins: result.senderCoins });
      socket.emit('garden:updated', await listGarden(userId, onlineUserIds(io)));

      // O dono vê o efeito na hora, se estiver com o jogo aberto.
      for (const target of socketsOfUser(io, result.pet.ownerId)) {
        target.emit('pet:state', result.pet);
        target.emit('garden:cheer-received', {
          fromUsername: username,
          joyGained: result.joyGained,
        });
      }
    } catch (error) {
      socket.emit('server:error', {
        code: error instanceof PetError ? error.code : 'cheer-failed',
        message: error instanceof Error ? error.message : 'Não deu para mimar agora.',
      });
    }
  });
}
