import { stageForAge } from '@patch/shared';
import type { PatchServer } from '../socket/socket-server.js';
import { onlineUserIds, socketsOfUser } from '../socket/presence.js';
import { findPetByOwner, persistSimulation } from './pet.service.js';

/**
 * O relógio do bicho.
 *
 * O decaimento em si **não** depende deste tique: ele é função do tempo decorrido
 * e é aplicado em toda leitura (`pet.service.ts`). O tique existe por dois
 * motivos mais modestos:
 *
 * 1. Empurrar o estado para quem está com a tela aberta — sem isso as barras só
 *    mudariam quando o jogador tocasse em algo, e a passagem do tempo, que é o
 *    jogo inteiro, ficaria invisível.
 * 2. Gravar o que já passou, de vez em quando, para o número no banco não ficar
 *    eternamente atrasado em relação ao que o jogador está vendo.
 *
 * Por isso ele só percorre quem está online. Um jogo com 10 mil contas não
 * precisa de 10 mil tiques por minuto: as 9.990 que estão fechadas recebem a
 * queda toda de uma vez no próximo login.
 *
 * O intervalo é grande de propósito. As barras não precisam de 60 quadros por
 * segundo vindos da rede — o cliente interpola sozinho, com a mesma função de
 * simulação (é por isso que ela mora no `shared`).
 */
const TICK_MS = 15_000;

export function startPetTicker(io: PatchServer): () => void {
  const timer = setInterval(() => {
    void tick(io);
  }, TICK_MS);

  // Não segura o processo: um `npm run dev` precisa poder terminar com Ctrl+C.
  timer.unref?.();

  return () => clearInterval(timer);
}

async function tick(io: PatchServer): Promise<void> {
  for (const userId of onlineUserIds(io)) {
    try {
      const before = await findPetByOwner(userId);
      if (!before) {
        continue;
      }

      const after = await persistSimulation(before.id);
      if (!after) {
        continue;
      }

      const sockets = socketsOfUser(io, userId);
      for (const socket of sockets) {
        socket.emit('pet:state', after);
      }

      // Crescer é o evento mais raro e mais importante do jogo; ele quase sempre
      // acontece durante um tique, e não durante uma ação.
      const stageBefore = stageForAge(before.ageMs);
      if (stageBefore !== after.stage) {
        for (const socket of sockets) {
          socket.emit('pet:stage-changed', {
            petId: after.id,
            from: stageBefore,
            to: after.stage,
          });
        }
      }
    } catch (error) {
      // Um bicho com problema não pode derrubar o tique dos outros.
      console.error(`[ticker] failed for user ${userId}`, error);
    }
  }
}
