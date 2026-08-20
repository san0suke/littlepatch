import Phaser from 'phaser';
import { CSS_COLORS, FONT_STACK } from '../config/theme.js';
import { drawIcon, type IconName } from './icon.js';
import { dp, px, space, type Layout } from './layout.js';
import { fitText } from './text.js';

/**
 * Uma linha do menu: ícone, título e uma frase curta explicando para onde leva.
 *
 * Existe separado de `ui/button.ts` porque não é um botão: aquele mede o próprio
 * rótulo e cresce com ele, este recebe largura e altura da cena — o menu decide
 * quanto espaço cada linha tem e depois desenha as seis iguais. Sem isso, seis
 * botões de tamanhos diferentes empilhados, cada um com o seu texto, viram uma
 * escada.
 *
 * O `variant` diz o que o item é hoje:
 * - `primary`: a ação principal da tela;
 * - `default`: leva a alguma parte do jogo que existe;
 * - `soon`: está no mapa do jogo, mas ainda não foi feito. Continua tocável de
 *   propósito — um toque sem resposta nenhuma parece tela travada; ele responde
 *   dizendo que ainda não existe.
 */
export type MenuItemVariant = 'primary' | 'default' | 'soon';

export interface MenuItemConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  layout: Layout;
  title: string;
  subtitle?: string;
  icon: IconName;
  variant?: MenuItemVariant;
  /** Etiqueta à direita, tipo "Em breve". Sai fora em tela estreita. */
  badge?: string;
  onClick?: () => void;
}

interface Palette {
  fill: number;
  fillAlpha: number;
  stroke: number;
  lip: number;
  title: string;
  subtitle: string;
  icon: { chip: number; fill: number; detail: number };
}

const PALETTES: Record<MenuItemVariant, Palette> = {
  primary: {
    fill: 0xf6c453,
    fillAlpha: 1,
    stroke: 0x4a3728,
    lip: 0xc79a35,
    title: '#3a2a17',
    subtitle: '#6b5426',
    icon: { chip: 0xfff3d0, fill: 0x4e8a3c, detail: 0x2f5b25 },
  },
  default: {
    fill: 0xfdf6e3,
    fillAlpha: 0.96,
    stroke: 0x4a3728,
    lip: 0xd6c9a8,
    title: CSS_COLORS.ink,
    subtitle: CSS_COLORS.muted,
    icon: { chip: 0xeef4e4, fill: 0x8a6244, detail: 0x4a3728 },
  },
  soon: {
    fill: 0xeff0e6,
    // Quase opaco: o fundo é uma pintura cheia de detalhe, e um cartão
    // translúcido em cima dela vira sujeira. O que diz que o item ainda não
    // existe é a cor apagada e a etiqueta, não a transparência.
    fillAlpha: 0.94,
    stroke: 0x9aa694,
    lip: 0xd8ddd2,
    title: '#7b8b74',
    subtitle: '#9aa694',
    icon: { chip: 0xe9ece4, fill: 0xb3bcae, detail: 0x9aa694 },
  },
};

export function createMenuItem(
  scene: Phaser.Scene,
  config: MenuItemConfig,
): Phaser.GameObjects.Container {
  const { x, y, width, height, layout: l, title, icon, variant = 'default', onClick } = config;
  const palette = PALETTES[variant];

  const radius = dp(l, 16);
  const lip = dp(l, 4);
  const stroke = dp(l, 2);

  // Lábio embaixo, do mesmo jeito dos botões do formulário no `index.html`: é o
  // que faz o item parecer uma peça de madeira em vez de um retângulo pintado.
  // Fica num objeto à parte porque o toque afunda o resto por cima dele.
  const shadow = scene.add.graphics();
  shadow.fillStyle(palette.lip, palette.fillAlpha);
  shadow.fillRoundedRect(0, lip, width, height - lip, radius);

  const background = scene.add.graphics();
  background.fillStyle(palette.fill, palette.fillAlpha);
  background.fillRoundedRect(0, 0, width, height - lip, radius);
  background.lineStyle(stroke, palette.stroke, variant === 'soon' ? 0.5 : 0.8);
  background.strokeRoundedRect(0, 0, width, height - lip, radius);

  // ── Ícone, num disco à esquerda ──────────────────────────────────────────
  const bodyHeight = height - lip;
  const chipRadius = Math.min(bodyHeight * 0.34, dp(l, 26));
  const chipX = space(l, 16, 12) + chipRadius;
  const chipY = bodyHeight / 2;

  const chip = scene.add.graphics();
  chip.fillStyle(palette.icon.chip, 1);
  chip.fillCircle(chipX, chipY, chipRadius);
  chip.lineStyle(dp(l, 1.5), palette.stroke, variant === 'soon' ? 0.25 : 0.4);
  chip.strokeCircle(chipX, chipY, chipRadius);

  const glyph = scene.add.graphics().setPosition(chipX, chipY);
  drawIcon(glyph, icon, chipRadius * 1.15, { fill: palette.icon.fill, detail: palette.icon.detail });

  // ── Textos ───────────────────────────────────────────────────────────────
  const textLeft = chipX + chipRadius + space(l, 12, 10);
  const face: Phaser.GameObjects.GameObject[] = [background, chip, glyph];

  // A etiqueta só entra se sobrar largura de verdade: no celular em pé, entre
  // um "Em breve" e o subtítulo inteiro, o subtítulo diz mais.
  const badgeText = config.badge;
  const badgeWidth = badgeText ? Math.min(width * 0.28, dp(l, 92)) : 0;
  const showBadge = Boolean(badgeText) && width - textLeft - badgeWidth > dp(l, 110);
  const textWidth = width - textLeft - space(l, 14, 10) - (showBadge ? badgeWidth : 0);

  // Subtítulo só quando a linha é alta o bastante para as duas caberem sem se
  // encostarem — em paisagem de celular o menu inteiro fica em linhas baixas.
  const showSubtitle = Boolean(config.subtitle) && bodyHeight >= dp(l, 58);

  const titleText = scene.add.text(textLeft, 0, title, {
    fontFamily: FONT_STACK,
    fontSize: `${px(l, showSubtitle ? 19 : 17, 14)}px`,
    color: palette.title,
    fontStyle: 'bold',
  });
  fitText(titleText, textWidth);
  face.push(titleText);

  if (showSubtitle) {
    const subtitleText = scene.add.text(textLeft, 0, config.subtitle!, {
      fontFamily: FONT_STACK,
      fontSize: `${px(l, 13, 10)}px`,
      color: palette.subtitle,
    });
    fitText(subtitleText, textWidth);

    const block = titleText.height + subtitleText.height + space(l, 2, 2);
    titleText.setY(Math.round(chipY - block / 2));
    subtitleText.setY(Math.round(titleText.y + titleText.height + space(l, 2, 2)));
    face.push(subtitleText);
  } else {
    titleText.setY(Math.round(chipY - titleText.height / 2));
  }

  if (showBadge) {
    const label = scene.add
      .text(0, 0, badgeText!, {
        fontFamily: FONT_STACK,
        fontSize: `${px(l, 11, 9)}px`,
        color: '#6b7a65',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    const padX = space(l, 8, 6);
    const padY = space(l, 4, 3);
    const tagWidth = label.width + padX * 2;
    const tagHeight = label.height + padY * 2;
    const tagX = width - space(l, 14, 10) - tagWidth;
    const tagY = chipY - tagHeight / 2;

    const tag = scene.add.graphics();
    tag.fillStyle(0x000000, 0.06);
    tag.fillRoundedRect(tagX, tagY, tagWidth, tagHeight, dp(l, 8));
    tag.lineStyle(dp(l, 1.5), 0x9aa694, 0.7);
    tag.strokeRoundedRect(tagX, tagY, tagWidth, tagHeight, dp(l, 8));

    label.setPosition(tagX + tagWidth / 2, tagY + tagHeight / 2);
    face.push(tag, label);
  }

  // Tudo que afunda no toque vai num container só; o lábio fica fora dele.
  const surface = scene.add.container(0, 0, face);
  const container = scene.add.container(x, y, [shadow, surface]);
  container.setSize(width, height);

  if (onClick) {
    container.setInteractive({
      // O Phaser soma o `displayOrigin` do container — metade do tamanho — ao
      // ponto local antes de testar a hitArea, então o retângulo precisa vir
      // deslocado do mesmo tanto. Ver a mesma conta em `ui/button.ts`.
      hitArea: new Phaser.Geom.Rectangle(width / 2, height / 2, width, height),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });

    // Afunda no toque: no celular, sem cursor nem `:hover`, é o único retorno de
    // que o dedo acertou o alvo.
    const press = (down: boolean): void => {
      surface.setY(down ? lip : 0);
    };
    container.on('pointerdown', () => press(true));
    container.on('pointerout', () => press(false));
    container.on('pointerup', () => {
      press(false);
      onClick();
    });
  }

  return container;
}
