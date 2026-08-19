import {
  CARE_ACTIONS,
  CHEER_COOLDOWN_MS,
  CHEER_JOY_BONUS,
  CHEER_REWARD_COINS,
  advanceVitals,
  clampStat,
  createNewbornStats,
  isPetSpeciesId,
  stageForAge,
  type CareAction,
  type GardenPetSummary,
  type PetSpeciesId,
  type PetStage,
  type PetState,
  type PetVitals,
} from '@patch/shared';
import type { Pet } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { resolveCare, type CareRejection } from './care-rules.js';

/**
 * O bicho no banco, e as regras de leitura e escrita dele.
 *
 * Duas coisas moram aqui e não podem sair:
 *
 * 1. **A simulação é aplicada na leitura.** A linha do banco guarda os medidores
 *    e o instante até onde eles valem (`simulatedAt`). Toda leitura avança dali
 *    até agora. É isso que faz o bicho viver com o jogo fechado, sem precisar de
 *    um processo cuidando de cada conta cadastrada.
 * 2. **Datas absolutas param aqui.** Para fora vai duração (`ageMs`,
 *    `cooldownsMs`), pelo motivo explicado em `shared/socket/payloads.ts`.
 */

/** Coluna de "última vez" de cada ação, para as esperas. */
const LAST_ACTION_COLUMN: Record<CareAction, keyof Pet | null> = {
  feed: 'lastFedAt',
  play: 'lastPlayedAt',
  clean: 'lastCleanedAt',
  heal: 'lastHealedAt',
  sleep: 'lastSleptAt',
  // Acordar usa a mesma marca de dormir: são o mesmo botão na tela.
  wake: 'lastSleptAt',
};

function vitalsOf(pet: Pet, now: number): PetVitals {
  return {
    stats: {
      satiety: pet.satiety,
      energy: pet.energy,
      hygiene: pet.hygiene,
      joy: pet.joy,
      health: pet.health,
    },
    asleep: pet.asleep,
    ageMs: Math.max(0, now - pet.bornAt.getTime()),
  };
}

/** Quanto falta de espera em cada ação, no instante `now`. */
function cooldownsOf(pet: Pet, now: number): Partial<Record<CareAction, number>> {
  const cooldowns: Partial<Record<CareAction, number>> = {};
  for (const definition of Object.values(CARE_ACTIONS)) {
    const column = LAST_ACTION_COLUMN[definition.id];
    const last = column ? (pet[column] as Date | null) : null;
    if (!last) {
      continue;
    }
    const remaining = definition.cooldownMs - (now - last.getTime());
    if (remaining > 0) {
      cooldowns[definition.id] = remaining;
    }
  }
  return cooldowns;
}

/**
 * Monta o estado que vai para a rede, já com a queda do tempo parado aplicada —
 * mas **sem gravar**. A gravação acontece nas ações e no tique
 * (`pet.ticker.ts`); um `GET` não precisa de escrita para o número estar certo,
 * já que a queda é função do tempo decorrido.
 */
export function toPetState(pet: Pet & { owner: { username: string } }, now: number): PetState {
  const elapsed = now - pet.simulatedAt.getTime();
  const vitals = advanceVitals(vitalsOf(pet, now), elapsed);

  return {
    id: pet.id,
    ownerId: pet.ownerId,
    ownerName: pet.owner.username,
    name: pet.name,
    species: pet.species as PetSpeciesId,
    ageMs: vitals.ageMs,
    stage: stageForAge(vitals.ageMs),
    stats: {
      satiety: Math.round(vitals.stats.satiety),
      energy: Math.round(vitals.stats.energy),
      hygiene: Math.round(vitals.stats.hygiene),
      joy: Math.round(vitals.stats.joy),
      health: Math.round(vitals.stats.health),
    },
    asleep: vitals.asleep,
    cooldownsMs: cooldownsOf(pet, now),
  };
}

const withOwner = { owner: { select: { username: true } } } as const;

export async function findPetByOwner(ownerId: string): Promise<PetState | null> {
  const pet = await prisma.pet.findUnique({ where: { ownerId }, include: withOwner });
  return pet ? toPetState(pet, Date.now()) : null;
}

export async function findPetById(petId: string): Promise<PetState | null> {
  const pet = await prisma.pet.findUnique({ where: { id: petId }, include: withOwner });
  return pet ? toPetState(pet, Date.now()) : null;
}

export class PetError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function createPet(
  ownerId: string,
  input: { name: string; species: string },
): Promise<PetState> {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 16) {
    throw new PetError('invalid-name', 'O nome precisa ter de 2 a 16 caracteres.');
  }
  if (!isPetSpeciesId(input.species)) {
    throw new PetError('invalid-species', 'Espécie desconhecida.');
  }

  const existing = await prisma.pet.findUnique({ where: { ownerId } });
  if (existing) {
    throw new PetError('pet-exists', 'Você já tem um bicho.');
  }

  const stats = createNewbornStats();
  const pet = await prisma.pet.create({
    data: {
      ownerId,
      name,
      species: input.species,
      satiety: stats.satiety,
      energy: stats.energy,
      hygiene: stats.hygiene,
      joy: stats.joy,
      health: stats.health,
    },
    include: withOwner,
  });

  return toPetState(pet, Date.now());
}

export interface CareResult {
  pet: PetState;
  delta: Partial<PetState['stats']>;
  coinsSpent: number;
  coinsEarned: number;
  coins: number;
  /** Preenchido quando a ação empurrou o bicho para o estágio seguinte. */
  stageChange: { from: PetStage; to: PetStage } | null;
}

/**
 * Aplica um cuidado. A decisão é do `care-rules.ts`; aqui só entra o que depende
 * do banco: ler a linha, cobrar a moeda, gravar a marca da espera.
 *
 * Tudo numa transação porque são três escritas ligadas (bicho, carteira, marca):
 * um erro no meio deixaria o jogador pagando por comida que o bicho não comeu.
 */
export async function applyCare(ownerId: string, action: CareAction): Promise<CareResult> {
  const now = new Date();
  const nowMs = now.getTime();

  return prisma.$transaction(async (tx) => {
    const pet = await tx.pet.findUnique({ where: { ownerId }, include: withOwner });
    if (!pet) {
      throw new PetError('no-pet', 'Você ainda não tem um bicho.');
    }
    const user = await tx.user.findUniqueOrThrow({ where: { id: ownerId } });

    const stageBefore = stageForAge(Math.max(0, nowMs - pet.bornAt.getTime()));
    const outcome = resolveCare(
      {
        vitals: vitalsOf(pet, nowMs),
        coins: Number(user.coins),
        cooldownsMs: cooldownsOf(pet, nowMs),
      },
      action,
      nowMs - pet.simulatedAt.getTime(),
    );

    if (!outcome.ok) {
      const rejection: CareRejection = outcome.rejection;
      throw new PetError(rejection.code, rejection.message);
    }

    const column = LAST_ACTION_COLUMN[action];
    const updated = await tx.pet.update({
      where: { id: pet.id },
      data: {
        satiety: Math.round(outcome.vitals.stats.satiety),
        energy: Math.round(outcome.vitals.stats.energy),
        hygiene: Math.round(outcome.vitals.stats.hygiene),
        joy: Math.round(outcome.vitals.stats.joy),
        health: Math.round(outcome.vitals.stats.health),
        asleep: outcome.vitals.asleep,
        simulatedAt: now,
        ...(column ? { [column]: now } : {}),
      },
      include: withOwner,
    });

    const coins = Number(user.coins) - outcome.coinsSpent + outcome.coinsEarned;
    if (outcome.coinsSpent !== 0 || outcome.coinsEarned !== 0) {
      await tx.user.update({ where: { id: ownerId }, data: { coins: BigInt(coins) } });
    }

    const state = toPetState(updated, nowMs);
    return {
      pet: state,
      delta: outcome.delta,
      coinsSpent: outcome.coinsSpent,
      coinsEarned: outcome.coinsEarned,
      coins,
      stageChange: stageBefore === state.stage ? null : { from: stageBefore, to: state.stage },
    };
  });
}

/**
 * Grava o estado simulado até agora.
 *
 * Chamado pelo tique (`pet.ticker.ts`) só para os bichos de quem está com o jogo
 * aberto. Quem está offline não precisa: a queda é função do tempo decorrido, e
 * a leitura seguinte a aplica de uma vez.
 */
export async function persistSimulation(petId: string): Promise<PetState | null> {
  const now = new Date();
  const pet = await prisma.pet.findUnique({ where: { id: petId }, include: withOwner });
  if (!pet) {
    return null;
  }

  const state = toPetState(pet, now.getTime());
  await prisma.pet.update({
    where: { id: pet.id },
    data: {
      satiety: state.stats.satiety,
      energy: state.stats.energy,
      hygiene: state.stats.hygiene,
      joy: state.stats.joy,
      health: state.stats.health,
      simulatedAt: now,
    },
  });
  return state;
}

/**
 * O jardim: os bichos dos outros jogadores.
 *
 * Sem paginação por enquanto — com o jogo pequeno, a lista inteira cabe numa
 * tela de rolagem. Quando passar de algumas centenas, isto vira um cursor.
 */
export async function listGarden(
  viewerId: string,
  onlineOwnerIds: Set<string>,
): Promise<GardenPetSummary[]> {
  const now = Date.now();
  const pets = await prisma.pet.findMany({
    where: { ownerId: { not: viewerId } },
    include: { ...withOwner, cheers: { where: { senderId: viewerId } } },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });

  return pets.map((pet) => {
    const lastCheer = pet.cheers[0]?.sentAt.getTime() ?? 0;
    const ageMs = Math.max(0, now - pet.bornAt.getTime());
    return {
      petId: pet.id,
      ownerId: pet.ownerId,
      ownerName: pet.owner.username,
      name: pet.name,
      species: pet.species as PetSpeciesId,
      stage: stageForAge(ageMs),
      ageMs,
      online: onlineOwnerIds.has(pet.ownerId),
      cheerCooldownMs: Math.max(0, CHEER_COOLDOWN_MS - (now - lastCheer)),
    };
  });
}

export interface CheerResult {
  /** Estado novo do bicho mimado, para o dono receber. */
  pet: PetState;
  senderCoins: number;
  joyGained: number;
}

/** Mimo no bicho de outro jogador: alegria para ele, uma moeda para quem visita. */
export async function cheerPet(senderId: string, petId: string): Promise<CheerResult> {
  const now = new Date();
  const nowMs = now.getTime();

  return prisma.$transaction(async (tx) => {
    const pet = await tx.pet.findUnique({ where: { id: petId }, include: withOwner });
    if (!pet) {
      throw new PetError('no-pet', 'Bicho não encontrado.');
    }
    if (pet.ownerId === senderId) {
      throw new PetError('own-pet', 'Esse é o seu próprio bicho.');
    }

    const previous = await tx.cheer.findUnique({
      where: { petId_senderId: { petId, senderId } },
    });
    if (previous && nowMs - previous.sentAt.getTime() < CHEER_COOLDOWN_MS) {
      throw new PetError('cooldown', 'Você já mimou esse bicho faz pouco tempo.');
    }

    const vitals = advanceVitals(vitalsOf(pet, nowMs), nowMs - pet.simulatedAt.getTime());
    const joy = clampStat(vitals.stats.joy + CHEER_JOY_BONUS);
    const joyGained = Math.round(joy - vitals.stats.joy);

    const updated = await tx.pet.update({
      where: { id: petId },
      data: {
        satiety: Math.round(vitals.stats.satiety),
        energy: Math.round(vitals.stats.energy),
        hygiene: Math.round(vitals.stats.hygiene),
        joy: Math.round(joy),
        health: Math.round(vitals.stats.health),
        simulatedAt: now,
      },
      include: withOwner,
    });

    await tx.cheer.upsert({
      where: { petId_senderId: { petId, senderId } },
      create: { petId, senderId, sentAt: now },
      update: { sentAt: now },
    });

    const sender = await tx.user.update({
      where: { id: senderId },
      data: { coins: { increment: BigInt(CHEER_REWARD_COINS) } },
    });

    return {
      pet: toPetState(updated, nowMs),
      senderCoins: Number(sender.coins),
      joyGained,
    };
  });
}

export async function getCoins(userId: string): Promise<number> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return Number(user.coins);
}
