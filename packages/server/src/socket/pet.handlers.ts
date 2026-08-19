import { isCareAction } from '@patch/shared';
import {
  PetError,
  applyCare,
  createPet,
  findPetByOwner,
  getCoins,
} from '../pets/pet.service.js';
import type { PatchServer, PatchSocket } from './socket-server.js';
import { socketsOfUser } from './presence.js';

/**
 * O bicho do próprio jogador.
 *
 * Nenhum handler aqui confia no que chega: o cliente **sugere** uma ação, o
 * servidor decide se ela vale, quanto custa e o que muda. É a mesma regra
 * permanente do poker — lá porque o cliente poderia inventar uma carta, aqui
 * porque poderia se dar 100 de saciedade de graça.
 *
 * Estado novo vai para **todos** os sockets do dono, não só para o que pediu: o
 * jogador pode estar com o jogo aberto no celular e no navegador ao mesmo tempo,
 * e a segunda tela ficaria com números velhos até o próximo tique.
 */
export function registerPetHandlers(io: PatchServer, socket: PatchSocket): void {
  const { id: userId } = socket.data.user;

  const broadcastToOwner = async (): Promise<void> => {
    const pet = await findPetByOwner(userId);
    if (!pet) {
      return;
    }
    for (const target of socketsOfUser(io, userId)) {
      target.emit('pet:state', pet);
    }
  };

  socket.on('pet:get', async (ack) => {
    try {
      ack(await findPetByOwner(userId));
    } catch (error) {
      console.error('[socket] pet:get failed', error);
      ack(null);
    }
  });

  socket.on('pet:create', async (payload, ack) => {
    try {
      const pet = await createPet(userId, {
        name: String(payload?.name ?? ''),
        species: String(payload?.species ?? ''),
      });
      ack(pet);
      socket.emit('pet:state', pet);
    } catch (error) {
      ack(null);
      socket.emit('server:error', {
        code: error instanceof PetError ? error.code : 'create-failed',
        message: error instanceof Error ? error.message : 'Não deu para chocar o ovo.',
      });
    }
  });

  socket.on('pet:care', async (payload) => {
    if (!isCareAction(payload?.action)) {
      socket.emit('server:error', { code: 'invalid-action', message: 'Ação desconhecida.' });
      return;
    }

    try {
      const result = await applyCare(userId, payload.action);

      for (const target of socketsOfUser(io, userId)) {
        target.emit('pet:state', result.pet);
        target.emit('user:coins', { coins: result.coins });
      }
      // A animação é do socket que agiu: quem só tem a outra aba aberta não
      // precisa ver a tigela de comida cair na tela sozinha.
      socket.emit('pet:care-applied', {
        action: payload.action,
        delta: result.delta,
        coinsSpent: result.coinsSpent,
        coinsEarned: result.coinsEarned,
      });

      if (result.stageChange) {
        for (const target of socketsOfUser(io, userId)) {
          target.emit('pet:stage-changed', {
            petId: result.pet.id,
            from: result.stageChange.from,
            to: result.stageChange.to,
          });
        }
      }
    } catch (error) {
      socket.emit('server:error', {
        code: error instanceof PetError ? error.code : 'care-failed',
        message: error instanceof Error ? error.message : 'Não deu para fazer isso agora.',
      });
      // O estado volta mesmo na recusa: o cliente pode ter adiantado a animação,
      // e sem isso a tela ficaria mostrando algo que não aconteceu.
      await broadcastToOwner();
    }
  });

  // Saldo na conexão: o lobby e a loja desenham a partir dele, e o valor
  // guardado no cliente veio do login — pode ter envelhecido desde então.
  void getCoins(userId)
    .then((coins) => socket.emit('user:coins', { coins }))
    .catch((error) => console.error('[socket] coins fetch failed', error));
}
