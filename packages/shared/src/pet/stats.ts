/**
 * Os cinco medidores do bicho, e a velocidade com que caem.
 *
 * Todos vão de 0 a 100 e apontam para o mesmo lado: **100 é bom**. Um deles seria
 * mais natural ao contrário — "fome" cresce quando o bicho não come — mas aí uma
 * barra da tela encheria significando o oposto das outras quatro, e cada leitura
 * viraria uma tradução mental. Por isso `satiety` (saciedade), e não fome.
 *
 * As taxas são por hora de tempo real. O bicho continua vivendo com o jogo
 * fechado: quem aplica o tempo que passou é `simulation.ts`, do lado do servidor,
 * a partir do instante até onde a simulação já tinha ido.
 */
export type StatKey = 'satiety' | 'energy' | 'hygiene' | 'joy' | 'health';

export interface PetStats {
  /** Saciedade. Cai sozinha; comida sobe. */
  satiety: number;
  /** Energia. Cai acordado, sobe dormindo. */
  energy: number;
  /** Higiene. Cai devagar, e mais rápido depois de brincar. */
  hygiene: number;
  /** Alegria. Cai sozinha, e desaba quando falta o resto. */
  joy: number;
  /** Saúde. Não cai com o tempo: cai quando os outros medidores zeram. */
  health: number;
}

export const STAT_KEYS: StatKey[] = ['satiety', 'energy', 'hygiene', 'joy', 'health'];

export const STAT_MIN = 0;
export const STAT_MAX = 100;

/** Rótulos em português, para a interface não repetir `switch` em cada tela. */
export const STAT_LABELS: Record<StatKey, string> = {
  satiety: 'Saciedade',
  energy: 'Energia',
  hygiene: 'Higiene',
  joy: 'Alegria',
  health: 'Saúde',
};

/** Abaixo disso a barra fica vermelha e o bicho reclama. */
export const STAT_WARNING = 30;
/** Abaixo disso o medidor começa a cobrar da saúde. */
export const STAT_CRITICAL = 10;

/**
 * Queda por hora com o bicho acordado.
 *
 * Os números vêm de uma sessão-alvo: um jogador que abre o jogo de manhã e de
 * noite encontra o bicho precisando de algo, mas não arrasado. Saciedade em 6/h
 * significa pouco mais de 16 horas do cheio ao vazio.
 */
export const AWAKE_DECAY_PER_HOUR: Record<StatKey, number> = {
  satiety: 6,
  energy: 5,
  hygiene: 3.5,
  joy: 4.5,
  health: 0,
};

/**
 * Dormindo o bicho recupera energia e o resto desacelera — mas não para. Um
 * tamagotchi que congela enquanto dorme vira um botão de pausa, e o jogador
 * aprende a deixá-lo dormindo o dia inteiro.
 */
export const SLEEP_DECAY_MULTIPLIER = 0.35;
/** Energia recuperada por hora de sono: uma noite inteira enche o medidor. */
export const SLEEP_ENERGY_PER_HOUR = 14;

/**
 * Saúde perdida por hora, por medidor em estado crítico. Três medidores no chão
 * ao mesmo tempo derrubam a saúde três vezes mais rápido.
 */
export const HEALTH_LOSS_PER_CRITICAL_STAT_PER_HOUR = 5;
/** Saúde recuperada por hora quando nada está em estado crítico. */
export const HEALTH_RECOVERY_PER_HOUR = 3;

/** Abaixo desta saúde o bicho está doente: fica apático até tomar remédio. */
export const SICK_THRESHOLD = 35;

export function clampStat(value: number): number {
  return Math.min(STAT_MAX, Math.max(STAT_MIN, value));
}

export function clampStats(stats: PetStats): PetStats {
  return {
    satiety: clampStat(stats.satiety),
    energy: clampStat(stats.energy),
    hygiene: clampStat(stats.hygiene),
    joy: clampStat(stats.joy),
    health: clampStat(stats.health),
  };
}

export function createNewbornStats(): PetStats {
  return { satiety: 70, energy: 80, hygiene: 90, joy: 75, health: 100 };
}

/** Quantos medidores (fora saúde) estão no chão. Alimenta a perda de saúde. */
export function countCriticalStats(stats: PetStats): number {
  return STAT_KEYS.filter((key) => key !== 'health' && stats[key] <= STAT_CRITICAL).length;
}

export function isSick(stats: PetStats): boolean {
  return stats.health < SICK_THRESHOLD;
}
