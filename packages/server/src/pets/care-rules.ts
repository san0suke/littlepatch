import {
  CARE_ACTIONS,
  SICK_THRESHOLD,
  STAT_KEYS,
  advanceVitals,
  applyCareEffects,
  isHatched,
  stageForAge,
  type CareAction,
  type PetStats,
  type PetVitals,
} from '@patch/shared';

/**
 * A decisão de "esta ação pode acontecer, e com que efeito" — pura, sem banco.
 *
 * O servidor é a autoridade (o cliente só sugere), e autoridade que mistura
 * regra com IO não se testa: cada caso viraria um banco de mentira. Aqui entra
 * uma foto do bicho e da carteira, sai um veredito. Quem lê e grava é o
 * `pet.service.ts`.
 *
 * O tempo decorrido entra como argumento pelo mesmo motivo: um teste roda dois
 * dias de descuido sem esperar dois dias.
 */
export interface CareContext {
  vitals: PetVitals;
  /** Moedas do dono no momento da ação. */
  coins: number;
  /** Espera restante de cada ação, em ms. Ausente = disponível. */
  cooldownsMs: Partial<Record<CareAction, number>>;
}

export interface CareRejection {
  code: string;
  message: string;
}

export type CareOutcome =
  | {
      ok: true;
      /** Estado do bicho depois da ação. */
      vitals: PetVitals;
      /** Só os medidores que mudaram, para o cliente animar. */
      delta: Partial<PetStats>;
      coinsSpent: number;
      coinsEarned: number;
    }
  | { ok: false; rejection: CareRejection };

function reject(code: string, message: string): CareOutcome {
  return { ok: false, rejection: { code, message } };
}

/**
 * Resolve uma ação de cuidado.
 *
 * `elapsedMs` é o tempo desde a última simulação: a queda é aplicada **antes** da
 * ação, senão alimentar um bicho parado há dez horas mediria a fome de dez horas
 * atrás e o jogador ganharia comida de graça.
 */
export function resolveCare(
  context: CareContext,
  action: CareAction,
  elapsedMs: number,
): CareOutcome {
  const definition = CARE_ACTIONS[action];
  const current = advanceVitals(context.vitals, elapsedMs);

  if (!isHatched(stageForAge(current.ageMs))) {
    return reject('pet-not-hatched', 'O ovo ainda não chocou.');
  }

  const remaining = context.cooldownsMs[action] ?? 0;
  if (remaining > 0) {
    return reject('cooldown', `Espere mais ${Math.ceil(remaining / 1000)}s para isso.`);
  }

  if (definition.requiresAwake && current.asleep) {
    return reject('pet-asleep', 'Ele está dormindo. Acorde antes.');
  }
  if (action === 'wake' && !current.asleep) {
    return reject('pet-awake', 'Ele já está acordado.');
  }
  if (action === 'heal' && current.stats.health >= SICK_THRESHOLD) {
    // Remédio custa caro; recusar aqui evita o jogador torrar moeda à toa.
    return reject('pet-not-sick', 'Ele não está doente.');
  }
  if (context.coins < definition.cost) {
    return reject('no-coins', 'Moedas insuficientes.');
  }

  const stats = applyCareEffects(current.stats, action);
  const asleep = action === 'sleep' ? true : action === 'wake' ? false : current.asleep;

  const delta: Partial<PetStats> = {};
  for (const key of STAT_KEYS) {
    const change = Math.round(stats[key] - current.stats[key]);
    if (change !== 0) {
      delta[key] = change;
    }
  }

  return {
    ok: true,
    vitals: { stats, asleep, ageMs: current.ageMs },
    delta,
    coinsSpent: definition.cost,
    coinsEarned: definition.reward,
  };
}
