/**
 * Estágios de vida, medidos em idade real do bicho.
 *
 * A idade viaja como duração (`ageMs`), nunca como a data de nascimento. É a
 * mesma razão do relógio da vez no poker: o relógio do celular pode estar minutos
 * — às vezes horas — fora do relógio do servidor, e uma subtração entre os dois
 * viraria uma idade errada. O servidor manda "este bicho tem tantos ms de vida" e
 * o cliente conta a partir daí.
 *
 * O ovo é curto de propósito: ninguém quer esperar horas para ver o bicho. Depois
 * disso a escala é de dias, para o crescimento ser algo que se acompanha.
 */
export type PetStage = 'egg' | 'baby' | 'child' | 'teen' | 'adult';

export interface StageDefinition {
  id: PetStage;
  name: string;
  /** Idade mínima, em milissegundos, para entrar neste estágio. */
  minAgeMs: number;
  /** Escala do desenho: o bicho cresce na tela junto com a idade. */
  scale: number;
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const PET_STAGES: StageDefinition[] = [
  { id: 'egg', name: 'Ovo', minAgeMs: 0, scale: 0.7 },
  { id: 'baby', name: 'Filhote', minAgeMs: 10 * MINUTE, scale: 0.8 },
  { id: 'child', name: 'Criança', minAgeMs: 1 * DAY, scale: 0.95 },
  { id: 'teen', name: 'Jovem', minAgeMs: 3 * DAY, scale: 1.1 },
  { id: 'adult', name: 'Adulto', minAgeMs: 7 * DAY, scale: 1.25 },
];

export function stageForAge(ageMs: number): PetStage {
  let current: PetStage = 'egg';
  for (const stage of PET_STAGES) {
    if (ageMs >= stage.minAgeMs) {
      current = stage.id;
    }
  }
  return current;
}

export function stageDefinition(stage: PetStage): StageDefinition {
  return PET_STAGES.find((entry) => entry.id === stage) ?? PET_STAGES[0];
}

/** Quanto falta para o próximo estágio, ou `null` se já é adulto. */
export function msToNextStage(ageMs: number): number | null {
  const next = PET_STAGES.find((stage) => stage.minAgeMs > ageMs);
  return next ? next.minAgeMs - ageMs : null;
}

/** Dentro do ovo o bicho não come, não brinca e não suja nada. */
export function isHatched(stage: PetStage): boolean {
  return stage !== 'egg';
}
