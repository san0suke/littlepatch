import Phaser from 'phaser';
import { STAT_LABELS, type StatKey } from '@patch/shared';
import { COLORS, meterColor } from '../config/theme.js';
import { dp, px, space, type Layout } from './layout.js';

/**
 * Uma barra de medidor, com rótulo e número.
 *
 * Redesenhada a cada quadro em vez de animada com tween: o valor vem da
 * simulação local (`services/pet-store.ts`), que já muda de forma contínua. Um
 * tween por cima disso brigaria com ele — e daria um atraso visível justamente
 * quando o jogador acabou de alimentar o bicho e quer ver a barra subir.
 */
export interface Meter {
  container: Phaser.GameObjects.Container;
  /** `value` de 0 a 100. */
  update(value: number): void;
  height: number;
}

export function createMeter(
  scene: Phaser.Scene,
  layout: Layout,
  config: { key: StatKey; x: number; y: number; width: number },
): Meter {
  const { key, x, y, width } = config;
  const labelSize = px(layout, 13, 11);
  const barHeight = Math.max(dp(layout, 10), Math.round(labelSize * 0.9));
  const gap = space(layout, 4, 3);
  const radius = barHeight / 2;

  const label = scene.add.text(0, 0, STAT_LABELS[key], {
    fontSize: `${labelSize}px`,
    color: '#2f3b2c',
    fontStyle: 'bold',
  });

  const value = scene.add
    .text(width, 0, '0', { fontSize: `${labelSize}px`, color: '#5c6b57' })
    .setOrigin(1, 0);

  const bar = scene.add.graphics();
  const barTop = label.height + gap;

  const container = scene.add.container(x, y, [label, value, bar]);
  const height = barTop + barHeight;

  let lastDrawn = -1;

  const update = (raw: number): void => {
    const clamped = Math.max(0, Math.min(100, raw));
    const rounded = Math.round(clamped);
    // Só redesenha quando o inteiro muda: a simulação anda em frações de ponto
    // por quadro, e limpar um `Graphics` 60 vezes por segundo para mover meio
    // pixel é gasto puro no celular.
    if (rounded === lastDrawn) {
      return;
    }
    lastDrawn = rounded;

    value.setText(String(rounded));
    bar.clear();
    bar.fillStyle(COLORS.bark, 0.12);
    bar.fillRoundedRect(0, barTop, width, barHeight, radius);
    const filled = Math.round((width * clamped) / 100);
    if (filled > 0) {
      bar.fillStyle(meterColor(clamped), 1);
      bar.fillRoundedRect(0, barTop, Math.max(filled, barHeight), barHeight, radius);
    }
  };

  update(0);

  return { container, update, height };
}
