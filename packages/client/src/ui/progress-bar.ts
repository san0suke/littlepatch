import Phaser from 'phaser';
import { BAR_FILL_TEXTURE, hasTexture } from '../config/assets.js';
import { dp, type Layout } from './layout.js';

/**
 * A barra de carregamento.
 *
 * O sprite (`assets/ui/bar-fill.png`) vem do "UI Pack — Adventure" do Kenney, em
 * CC0: pode entrar no repositório e ser usado sem atribuição (que damos assim
 * mesmo, no README dos assets). É **uma** peça para as duas partes — trilho e
 * preenchimento —, cada uma com o seu `tint`: o arquivo é quase branco de
 * propósito, e o multiplicativo do Phaser dá a cor do jogo sem repintar imagem
 * nenhuma. Trocar o verde da barra é trocar um número aqui.
 *
 * **Nine-slice, não imagem esticada.** A peça tem 64×128 e pontas arredondadas;
 * esticada para os 500 e poucos pixels da barra, as pontas virariam duas curvas
 * derretidas. O nine-slice mantém os cantos do tamanho original e estica só o
 * miolo, então a barra fica igual em qualquer largura de tela.
 *
 * Sem os arquivos, o desenho de reserva assume — pílula, borda e um brilho na
 * metade de cima. É a mesma regra do bicho e do letreiro: quem chama pede uma
 * barra e não sabe qual das duas recebeu.
 */
export interface ProgressBar {
  /** Redesenha o preenchimento. `value` vai de 0 a 1. */
  set(value: number): void;
}

export interface ProgressBarConfig {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Canto do sprite, no tamanho em que ele foi rasterizado (4× de 16×32). */
const SLICE = 32;

/**
 * A altura em que a peça é montada, antes de escalar.
 *
 * Nine-slice não estica os cantos: eles ocupam sempre os 32px do arquivo, em
 * cima e embaixo. Numa barra mais baixa do que a soma dos dois — e a nossa é, em
 * qualquer celular — o Phaser espreme os cantos para caber, e cada peça fica
 * espremida de um jeito: o trilho e o preenchimento deixam de ter o mesmo
 * tamanho, que era o que estava saindo torto na tela.
 *
 * Então a barra é sempre montada com 64 de altura, onde os cantos são exatos, e
 * o objeto inteiro é escalado para a altura pedida. As pontas continuam
 * semicírculos perfeitos em qualquer tela.
 */
const INTERNAL_HEIGHT = SLICE * 2;

export function createProgressBar(
  scene: Phaser.Scene,
  layout: Layout,
  config: ProgressBarConfig,
): ProgressBar {
  return hasTexture(scene, BAR_FILL_TEXTURE)
    ? createSlicedBar(scene, config)
    : createDrawnBar(scene, layout, config);
}

function createSlicedBar(scene: Phaser.Scene, config: ProgressBarConfig): ProgressBar {
  const { x, y, width, height } = config;
  const scale = height / INTERNAL_HEIGHT;
  const internalWidth = width / scale;

  const slice = (tint: number, alpha: number): Phaser.GameObjects.NineSlice =>
    scene.add
      .nineslice(
        x,
        y,
        BAR_FILL_TEXTURE,
        undefined,
        internalWidth,
        INTERNAL_HEIGHT,
        SLICE,
        SLICE,
        SLICE,
        SLICE,
      )
      .setOrigin(0, 0)
      .setScale(scale)
      .setTint(tint)
      .setAlpha(alpha);

  // Trilho e preenchimento são a mesma peça, do mesmo tamanho, uma em cima da
  // outra: o trilho aparece só onde o preenchimento ainda não chegou. Encolher o
  // de cima para "caber dentro" do de baixo desalinharia as bordas arredondadas,
  // que são desenhadas na mesma proporção nos dois.
  slice(0x2f3d24, 0.9);
  const fill = slice(0x66b04a, 1);

  // Abaixo da soma dos dois cantos não sobra miolo para encolher, e as pontas
  // começariam a se sobrepor. Aí o preenchimento some — o que se vê é a barra
  // ainda vazia, que é a verdade.
  const minimum = SLICE * 2;

  return {
    set(value: number): void {
      const target = internalWidth * Math.min(1, Math.max(0, value));
      const visible = target >= minimum;
      fill.setVisible(visible);
      if (visible) {
        fill.setSize(target, INTERNAL_HEIGHT);
      }
    },
  };
}

/** Reserva: a barra desenhada, para quando os sprites não estiverem lá. */
function createDrawnBar(
  scene: Phaser.Scene,
  layout: Layout,
  config: ProgressBarConfig,
): ProgressBar {
  const { x, y, width, height } = config;
  const radius = height / 2;

  const track = scene.add.graphics();
  track.fillStyle(0x1c2a16, 0.55);
  track.fillRoundedRect(x, y, width, height, radius);
  track.lineStyle(dp(layout, 2), 0xfdf6e3, 0.85);
  track.strokeRoundedRect(x, y, width, height, radius);

  const graphics = scene.add.graphics();
  const inset = dp(layout, 3);

  return {
    set(value: number): void {
      const barHeight = height - inset * 2;
      const filled = Math.max(0, (width - inset * 2) * Math.min(1, Math.max(0, value)));

      graphics.clear();
      if (filled <= 0) {
        return;
      }

      // Um preenchimento mais estreito do que o próprio raio vira um losango
      // torto: abaixo disso ele volta a ser um retângulo comum.
      const fillRadius = Math.min(barHeight / 2, filled / 2);
      graphics.fillStyle(0x4e8a3c, 1);
      graphics.fillRoundedRect(x + inset, y + inset, filled, barHeight, fillRadius);

      // Faixa clara na metade de cima, recuada das pontas: a ponta da pílula é um
      // semicírculo, e uma faixa de canto menos redondo escaparia por fora dela.
      const capInset = barHeight * 0.28;
      const glowWidth = filled - capInset * 2;
      if (glowWidth > 0) {
        const glowHeight = barHeight * 0.42;
        graphics.fillStyle(0x8ed36a, 0.7);
        graphics.fillRoundedRect(
          x + inset + capInset,
          y + inset + barHeight * 0.12,
          glowWidth,
          glowHeight,
          Math.min(glowHeight / 2, glowWidth / 2),
        );
      }
    },
  };
}
