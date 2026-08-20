import Phaser from 'phaser';
import { dp, px, space, type Layout } from './layout.js';
import { FONT_STACK } from '../config/theme.js';

/**
 * Aviso curto que aparece no alto e some sozinho.
 *
 * É o canal para tudo que o servidor recusa ("espere mais 40s", "moedas
 * insuficientes") e para o que chega de fora ("fulano mimou seu bicho"). Um
 * modal para isso seria pesado demais: são mensagens que não pedem decisão
 * nenhuma do jogador.
 */
export function showToast(
  scene: Phaser.Scene,
  layout: Layout,
  message: string,
  tone: 'info' | 'error' = 'info',
): void {
  const paddingX = space(layout, 14, 10);
  const paddingY = space(layout, 8, 6);

  const text = scene.add
    .text(0, 0, message, {
      fontFamily: FONT_STACK,
      fontSize: `${px(layout, 15, 12)}px`,
      color: tone === 'error' ? '#ffe9e6' : '#2f3b2c',
      align: 'center',
      wordWrap: { width: layout.width - layout.padX * 2 - paddingX * 2 },
    })
    .setOrigin(0.5);

  const width = text.width + paddingX * 2;
  const height = text.height + paddingY * 2;

  const background = scene.add.graphics();
  background.fillStyle(tone === 'error' ? 0xe5695f : 0xfdf6e3, 0.97);
  background.fillRoundedRect(-width / 2, -height / 2, width, height, dp(layout, 10));
  background.lineStyle(dp(layout, 2), tone === 'error' ? 0xb84a41 : 0x4e8a3c, 1);
  background.strokeRoundedRect(-width / 2, -height / 2, width, height, dp(layout, 10));

  const container = scene.add
    .container(layout.width / 2, layout.padTop + height, [background, text])
    // Acima de tudo: o aviso não pode ficar atrás do bicho nem dos botões.
    .setDepth(1000);

  scene.tweens.add({
    targets: container,
    alpha: { from: 0, to: 1 },
    y: container.y + dp(layout, 6),
    duration: 160,
    ease: 'Quad.easeOut',
    onComplete: () => {
      scene.tweens.add({
        targets: container,
        alpha: 0,
        delay: 2200,
        duration: 320,
        onComplete: () => container.destroy(),
      });
    },
  });
}
