import { stageForAge, type PetStage } from './stage.js';
import {
  AWAKE_DECAY_PER_HOUR,
  HEALTH_LOSS_PER_CRITICAL_STAT_PER_HOUR,
  HEALTH_RECOVERY_PER_HOUR,
  SLEEP_DECAY_MULTIPLIER,
  SLEEP_ENERGY_PER_HOUR,
  STAT_KEYS,
  clampStat,
  countCriticalStats,
  isSick,
  type PetStats,
} from './stats.js';

/**
 * O envelhecimento do bicho, como função pura.
 *
 * Mora no `shared` pelo mesmo motivo que o avaliador de mãos morava lá no poker:
 * é regra do jogo, e os dois lados precisam dela por razões diferentes.
 *
 * - **Servidor**: é a autoridade. Guarda até onde já simulou e, a cada leitura ou
 *   ação, avança do último instante simulado até agora. O bicho vive com o jogo
 *   fechado — é o que separa um tamagotchi de uma tela de botões.
 * - **Cliente**: só para o desenho. Entre um `pet:state` e o próximo as barras
 *   precisam escorrer, senão o jogo parece travado por minutos. O cliente avança
 *   a última foto recebida sem nunca mandar o resultado de volta: se ele errar,
 *   o próximo estado do servidor corrige.
 *
 * Ser pura é o que torna isso seguro. Nenhuma leitura de relógio aqui dentro: o
 * tempo decorrido entra como argumento, então o mesmo teste roda uma semana de
 * vida em um milissegundo.
 */
export interface PetVitals {
  stats: PetStats;
  asleep: boolean;
  /** Idade acumulada, em milissegundos. Duração, nunca data — ver `stage.ts`. */
  ageMs: number;
}

const HOUR_MS = 60 * 60 * 1000;

/**
 * Teto de tempo aplicado de uma vez. Um jogador que some por três semanas volta
 * com o bicho na pior, mas não com um número absurdo puxado por um relógio
 * torto — nem com uma idade que salta do ovo ao adulto durante um `advance` só
 * porque o servidor ficou fora do ar.
 *
 * O corte é no acúmulo, e não na idade: quem passa 30 dias fora envelhece o
 * bicho os 30 dias (o crescimento é o prêmio de voltar), mas a queda dos
 * medidores para depois de 48h, que é quando eles já estão no chão de qualquer
 * forma.
 */
const MAX_DECAY_WINDOW_MS = 48 * HOUR_MS;

/**
 * Avança os sinais vitais em `elapsedMs`.
 *
 * Devolve uma cópia; nada é modificado no lugar, para o cliente poder chamar isso
 * a cada quadro em cima da mesma foto recebida do servidor.
 */
export function advanceVitals(vitals: PetVitals, elapsedMs: number): PetVitals {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) {
    return { stats: { ...vitals.stats }, asleep: vitals.asleep, ageMs: vitals.ageMs };
  }

  const ageMs = vitals.ageMs + elapsedMs;
  const stage = stageForAge(ageMs);
  const hours = Math.min(elapsedMs, MAX_DECAY_WINDOW_MS) / HOUR_MS;
  const stats: PetStats = { ...vitals.stats };

  // Dentro do ovo nada acontece além de crescer: não come, não suja, não cansa.
  if (stage === 'egg') {
    return { stats, asleep: vitals.asleep, ageMs };
  }

  const multiplier = vitals.asleep ? SLEEP_DECAY_MULTIPLIER : 1;
  for (const key of STAT_KEYS) {
    if (key === 'health' || key === 'energy') {
      continue;
    }
    stats[key] = clampStat(stats[key] - AWAKE_DECAY_PER_HOUR[key] * multiplier * hours);
  }

  stats.energy = clampStat(
    vitals.asleep
      ? stats.energy + SLEEP_ENERGY_PER_HOUR * hours
      : stats.energy - AWAKE_DECAY_PER_HOUR.energy * hours,
  );

  // A saúde é consequência, não um medidor que escorre sozinho: ela paga a conta
  // dos outros. É isso que faz o descuido acumular, em vez de simplesmente parar
  // quando um medidor chega a zero e não tem mais de onde cair.
  const critical = countCriticalStats(stats);
  stats.health = clampStat(
    critical > 0
      ? stats.health - HEALTH_LOSS_PER_CRITICAL_STAT_PER_HOUR * critical * hours
      : stats.health + HEALTH_RECOVERY_PER_HOUR * hours,
  );

  return { stats, asleep: vitals.asleep, ageMs };
}

/**
 * Humor do bicho: o que a tela desenha e o que a frase de status diz. Derivado,
 * nunca guardado — é só uma leitura dos medidores num instante.
 */
export type PetMood = 'egg' | 'sick' | 'sleeping' | 'hungry' | 'dirty' | 'tired' | 'sad' | 'happy';

export function moodFor(vitals: PetVitals): PetMood {
  const stage: PetStage = stageForAge(vitals.ageMs);
  if (stage === 'egg') {
    return 'egg';
  }
  if (isSick(vitals.stats)) {
    return 'sick';
  }
  if (vitals.asleep) {
    return 'sleeping';
  }

  // Ordem de urgência: fome antes de tédio. Com dois medidores baixos, o bicho
  // reclama do que dói mais.
  const { satiety, energy, hygiene, joy } = vitals.stats;
  const lowest = Math.min(satiety, energy, hygiene, joy);
  if (lowest > 40) {
    return 'happy';
  }
  if (lowest === satiety) {
    return 'hungry';
  }
  if (lowest === energy) {
    return 'tired';
  }
  if (lowest === hygiene) {
    return 'dirty';
  }
  return 'sad';
}

export const MOOD_MESSAGES: Record<PetMood, string> = {
  egg: 'Ainda é um ovo… algo se mexe lá dentro.',
  sick: 'Não está bem. Precisa de remédio.',
  sleeping: 'Dormindo. Shhh.',
  hungry: 'Está com fome!',
  dirty: 'Precisa de um banho.',
  tired: 'Cansado. Que tal uma soneca?',
  sad: 'Meio pra baixo. Brinca um pouco?',
  happy: 'Feliz da vida!',
};
