import { describe, expect, it } from 'vitest';
import { advanceVitals, moodFor, type PetVitals } from './simulation.js';
import { createNewbornStats } from './stats.js';

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

/** Recém-chocado: já fora do ovo, com os medidores de nascença. */
function hatched(overrides: Partial<PetVitals> = {}): PetVitals {
  return {
    stats: createNewbornStats(),
    asleep: false,
    ageMs: 30 * MINUTE,
    ...overrides,
  };
}

describe('advanceVitals', () => {
  it('não mexe em nada com tempo zero ou negativo', () => {
    const start = hatched();
    expect(advanceVitals(start, 0).stats).toEqual(start.stats);
    expect(advanceVitals(start, -HOUR).stats).toEqual(start.stats);
  });

  it('devolve uma cópia, sem alterar a foto recebida', () => {
    const start = hatched();
    advanceVitals(start, 5 * HOUR);
    expect(start.stats).toEqual(createNewbornStats());
  });

  it('derruba saciedade acordado, na taxa da tabela', () => {
    const after = advanceVitals(hatched(), 2 * HOUR);
    expect(after.stats.satiety).toBeCloseTo(70 - 6 * 2);
  });

  it('recupera energia dormindo e desacelera o resto', () => {
    const awake = advanceVitals(hatched(), 4 * HOUR);
    const asleep = advanceVitals(hatched({ asleep: true }), 4 * HOUR);

    expect(asleep.stats.energy).toBeGreaterThan(hatched().stats.energy);
    expect(asleep.stats.satiety).toBeGreaterThan(awake.stats.satiety);
    // Desacelera, mas não congela: dormir não pode virar um botão de pausa.
    expect(asleep.stats.satiety).toBeLessThan(hatched().stats.satiety);
  });

  it('dentro do ovo só a idade anda', () => {
    const egg: PetVitals = { stats: createNewbornStats(), asleep: false, ageMs: 0 };
    const after = advanceVitals(egg, 5 * MINUTE);
    expect(after.stats).toEqual(createNewbornStats());
    expect(after.ageMs).toBe(5 * MINUTE);
  });

  it('cobra da saúde enquanto houver medidor no chão', () => {
    const neglected = hatched({
      stats: { satiety: 0, energy: 0, hygiene: 0, joy: 0, health: 100 },
    });
    const after = advanceVitals(neglected, 2 * HOUR);
    // Quatro medidores críticos: 4 x 5/h x 2h.
    expect(after.stats.health).toBeCloseTo(100 - 40);
  });

  it('devolve saúde quando nada está crítico', () => {
    const recovering = hatched({
      stats: { satiety: 80, energy: 80, hygiene: 80, joy: 80, health: 50 },
    });
    expect(advanceVitals(recovering, 3 * HOUR).stats.health).toBeCloseTo(59);
  });

  it('limita a queda acumulada de uma ausência longa, mas não a idade', () => {
    const start = hatched();
    const twoDays = advanceVitals(start, 48 * HOUR);
    const threeWeeks = advanceVitals(start, 21 * 24 * HOUR);

    expect(threeWeeks.stats).toEqual(twoDays.stats);
    expect(threeWeeks.ageMs).toBe(start.ageMs + 21 * 24 * HOUR);
  });

  it('nenhum medidor sai da faixa 0..100', () => {
    const after = advanceVitals(hatched({ asleep: true }), 200 * HOUR);
    for (const value of Object.values(after.stats)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
  });
});

describe('moodFor', () => {
  it('o ovo vem antes de qualquer outra leitura', () => {
    const dyingEgg: PetVitals = {
      stats: { satiety: 0, energy: 0, hygiene: 0, joy: 0, health: 0 },
      asleep: false,
      ageMs: 0,
    };
    expect(moodFor(dyingEgg)).toBe('egg');
  });

  it('doença vem antes do sono', () => {
    const sick = hatched({ asleep: true, stats: { ...createNewbornStats(), health: 10 } });
    expect(moodFor(sick)).toBe('sick');
  });

  it('reclama do medidor mais baixo', () => {
    const hungry = hatched({
      stats: { satiety: 10, energy: 90, hygiene: 90, joy: 90, health: 100 },
    });
    const dirty = hatched({
      stats: { satiety: 90, energy: 90, hygiene: 12, joy: 90, health: 100 },
    });
    expect(moodFor(hungry)).toBe('hungry');
    expect(moodFor(dirty)).toBe('dirty');
  });

  it('está feliz com tudo acima de 40', () => {
    expect(moodFor(hatched())).toBe('happy');
  });
});
