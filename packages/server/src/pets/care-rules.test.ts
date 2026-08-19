import { describe, expect, it } from 'vitest';
import { CARE_ACTIONS, createNewbornStats, type PetVitals } from '@patch/shared';
import { resolveCare, type CareContext } from './care-rules.js';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

function context(overrides: Partial<CareContext> = {}): CareContext {
  const vitals: PetVitals = { stats: createNewbornStats(), asleep: false, ageMs: 2 * HOUR };
  return { vitals, coins: 200, cooldownsMs: {}, ...overrides };
}

describe('resolveCare', () => {
  it('recusa qualquer cuidado enquanto é ovo', () => {
    const egg = context({ vitals: { stats: createNewbornStats(), asleep: false, ageMs: 0 } });
    const outcome = resolveCare(egg, 'feed', 0);
    expect(outcome.ok).toBe(false);
    expect(outcome.ok === false && outcome.rejection.code).toBe('pet-not-hatched');
  });

  it('aplica a queda antes da ação', () => {
    // Dez horas sem comer: alimentar precisa partir da fome de agora, não da de
    // dez horas atrás — senão o jogador ganha saciedade de graça.
    const outcome = resolveCare(context(), 'feed', 10 * HOUR);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.vitals.stats.satiety).toBeCloseTo(70 - 6 * 10 + 28);
  });

  it('respeita a espera da ação', () => {
    const outcome = resolveCare(context({ cooldownsMs: { feed: 45 * 1000 } }), 'feed', 0);
    expect(outcome.ok === false && outcome.rejection.code).toBe('cooldown');
  });

  it('cobra as moedas da comida e recusa sem saldo', () => {
    const paid = resolveCare(context(), 'feed', 0);
    expect(paid.ok && paid.coinsSpent).toBe(CARE_ACTIONS.feed.cost);

    const broke = resolveCare(context({ coins: 1 }), 'feed', 0);
    expect(broke.ok === false && broke.rejection.code).toBe('no-coins');
  });

  it('paga o jogador por brincar', () => {
    const outcome = resolveCare(context(), 'play', 0);
    expect(outcome.ok && outcome.coinsEarned).toBe(CARE_ACTIONS.play.reward);
  });

  it('não deixa cuidar do bicho dormindo, mas deixa acordar', () => {
    const sleeping = context({
      vitals: { stats: createNewbornStats(), asleep: true, ageMs: 2 * HOUR },
    });
    expect(resolveCare(sleeping, 'feed', 0).ok).toBe(false);

    const woken = resolveCare(sleeping, 'wake', 0);
    expect(woken.ok).toBe(true);
    expect(woken.ok && woken.vitals.asleep).toBe(false);
  });

  it('recusa acordar quem já está acordado e dormir quem já dorme', () => {
    expect(resolveCare(context(), 'wake', 0).ok).toBe(false);
    const sleeping = context({
      vitals: { stats: createNewbornStats(), asleep: true, ageMs: 2 * HOUR },
    });
    expect(resolveCare(sleeping, 'sleep', 0).ok).toBe(false);
  });

  it('só vende remédio para bicho doente', () => {
    expect(resolveCare(context(), 'heal', 0).ok).toBe(false);

    const sick = context({
      vitals: {
        stats: { ...createNewbornStats(), health: 20 },
        asleep: false,
        ageMs: 2 * HOUR,
      },
    });
    const outcome = resolveCare(sick, 'heal', 0);
    expect(outcome.ok).toBe(true);
    expect(outcome.ok && outcome.vitals.stats.health).toBe(55);
  });

  it('reporta só os medidores que mudaram', () => {
    const outcome = resolveCare(context(), 'clean', 0);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(Object.keys(outcome.delta).sort()).toEqual(['hygiene', 'joy']);
  });

  it('não estoura o teto ao alimentar quem já está cheio', () => {
    const full = context({
      vitals: {
        stats: { satiety: 95, energy: 90, hygiene: 90, joy: 90, health: 100 },
        asleep: false,
        ageMs: 2 * HOUR,
      },
    });
    const outcome = resolveCare(full, 'feed', 0);
    expect(outcome.ok && outcome.vitals.stats.satiety).toBe(100);
    expect(outcome.ok && outcome.delta.satiety).toBe(5);
  });
});
