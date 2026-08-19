import type { PetStats, StatKey } from './stats.js';

/**
 * O que o jogador pode fazer com o bicho, e o que cada coisa custa.
 *
 * Uma tabela, e não um `switch` espalhado: o servidor decide (é ele a autoridade)
 * mas o cliente precisa dos mesmos números para desabilitar o botão sem moeda,
 * mostrar o preço e o tempo de espera. Duas cópias desses números divergiriam na
 * primeira vez que alguém equilibrasse o jogo.
 */
export type CareAction = 'feed' | 'play' | 'clean' | 'heal' | 'sleep' | 'wake';

export interface CareDefinition {
  id: CareAction;
  label: string;
  /** O que a ação soma (ou tira) de cada medidor. */
  effects: Partial<Record<StatKey, number>>;
  /** Moedas gastas. Comida e remédio custam. */
  cost: number;
  /** Moedas ganhas. Brincar e dar banho pagam o cuidado. */
  reward: number;
  /** Espera até poder repetir. Impede encher tudo em cinco toques. */
  cooldownMs: number;
  /** Só faz sentido com o bicho acordado (ou dormindo, no caso de `wake`). */
  requiresAwake: boolean;
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;

export const CARE_ACTIONS: Record<CareAction, CareDefinition> = {
  feed: {
    id: 'feed',
    label: 'Alimentar',
    effects: { satiety: 28, joy: 4, hygiene: -3 },
    cost: 5,
    reward: 0,
    cooldownMs: 3 * MINUTE,
    requiresAwake: true,
  },
  play: {
    id: 'play',
    label: 'Brincar',
    effects: { joy: 24, energy: -10, satiety: -6, hygiene: -8 },
    cost: 0,
    reward: 4,
    cooldownMs: 2 * MINUTE,
    requiresAwake: true,
  },
  clean: {
    id: 'clean',
    label: 'Banho',
    effects: { hygiene: 40, joy: -4 },
    cost: 0,
    reward: 3,
    cooldownMs: 5 * MINUTE,
    requiresAwake: true,
  },
  heal: {
    id: 'heal',
    label: 'Remédio',
    effects: { health: 35, joy: -8 },
    cost: 20,
    reward: 0,
    cooldownMs: 15 * MINUTE,
    requiresAwake: true,
  },
  sleep: {
    id: 'sleep',
    label: 'Dormir',
    effects: {},
    cost: 0,
    reward: 0,
    cooldownMs: 30 * SECOND,
    requiresAwake: true,
  },
  wake: {
    id: 'wake',
    label: 'Acordar',
    effects: { energy: -4 },
    cost: 0,
    reward: 0,
    cooldownMs: 30 * SECOND,
    requiresAwake: false,
  },
};

export const CARE_ACTION_LIST: CareDefinition[] = Object.values(CARE_ACTIONS);

export function isCareAction(value: unknown): value is CareAction {
  return typeof value === 'string' && value in CARE_ACTIONS;
}

/**
 * Aplica os efeitos de uma ação sobre os medidores. Sem regra nenhuma de
 * permissão: quem checa moeda, sono e espera é o servidor
 * (`pets/pet.service.ts`), porque só ele tem a verdade sobre as três coisas.
 */
export function applyCareEffects(stats: PetStats, action: CareAction): PetStats {
  const { effects } = CARE_ACTIONS[action];
  const next: PetStats = { ...stats };
  for (const [key, delta] of Object.entries(effects) as [StatKey, number][]) {
    next[key] = Math.min(100, Math.max(0, next[key] + delta));
  }
  return next;
}

/**
 * Um mimo de outro jogador no jardim: alegria de graça, para quem visita e para
 * quem é visitado. É o gancho social do jogo — a razão de ele ser online e não um
 * chaveirinho de plástico.
 */
export const CHEER_JOY_BONUS = 6;
export const CHEER_REWARD_COINS = 1;
/** Espera entre mimos, por par de jogadores. Sem isso viraria um botão de moeda. */
export const CHEER_COOLDOWN_MS = 10 * MINUTE;
