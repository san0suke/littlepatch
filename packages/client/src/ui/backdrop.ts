import Phaser from 'phaser';
import { BACKDROP_TEXTURE, hasTexture } from '../config/assets.js';
import { COLORS } from '../config/theme.js';
import { dp, type Layout } from './layout.js';

/**
 * O cenário de fundo das telas de entrada (carregamento e menu).
 *
 * Cada uma tem a sua pintura — a estrada de entrada no carregamento, o quintal
 * com os bichos no menu — e as duas entram pelo mesmo lugar: enquadramento,
 * horizonte e desenho de reserva são um código só, e não dois quase iguais
 * dentro de cada cena.
 *
 * Quando existe a arte (`assets/ui/backdrop.webp`), é ela que aparece, cobrindo a
 * tela. Quando não — porque ainda está carregando, ou porque alguém apagou o
 * arquivo — o mesmo cenário é desenhado em formas, com o mesmo horizonte. A regra
 * é a do bicho (`ui/pet-sprite.ts`): a cena pede um fundo e não precisa saber
 * qual dos dois recebeu.
 *
 * Nada aqui é interativo nem guarda estado: a cena redesenha o fundo inteiro
 * quando o aparelho gira, junto com o resto.
 */
export interface BackdropConfig {
  /** Onde a grama começa, em fração da altura. */
  horizon?: number;
  /** Qual pintura usar. Sem ela, a da tela de carregamento. */
  texture?: string;
}

export interface Backdrop {
  /** Y em que a grama começa — o chão onde as cenas apoiam os bichos. */
  groundTop: number;
}

export function drawBackdrop(
  scene: Phaser.Scene,
  layout: Layout,
  config: BackdropConfig = {},
): Backdrop {
  const groundTop = Math.round(
    layout.height * (config.horizon ?? (layout.portrait ? 0.6 : 0.58)),
  );

  const texture = config.texture ?? BACKDROP_TEXTURE;
  if (hasTexture(scene, texture)) {
    drawCover(scene, layout, texture);
    return { groundTop };
  }

  const sky = scene.add.graphics();
  paintSky(sky, layout, groundTop);
  paintHills(sky, layout, groundTop);
  paintGround(sky, layout, groundTop);
  paintFence(sky, layout, groundTop);

  addClouds(scene, layout, groundTop);

  return { groundTop };
}

/**
 * A imagem cobrindo a tela inteira, cortando o excesso — nunca esticada.
 *
 * O jogo não tem resolução de projeto: a mesma arte serve um celular em pé e um
 * monitor deitado. Deformá-la para caber seria pior do que perder as beiradas.
 */
function drawCover(scene: Phaser.Scene, layout: Layout, texture: string): void {
  const image = scene.add.image(layout.width / 2, layout.height / 2, texture);
  const scale = Math.max(layout.width / image.width, layout.height / image.height);
  image.setScale(scale);
}

/**
 * Céu em faixas, e não em `fillGradientStyle`: o degradê do Phaser só existe no
 * renderizador WebGL, e no Canvas a mesma chamada pinta tudo de uma cor só. Vinte
 * faixas são indistinguíveis de um degradê na tela e funcionam nos dois.
 */
function paintSky(g: Phaser.GameObjects.Graphics, layout: Layout, groundTop: number): void {
  const bands = 20;
  const bandHeight = Math.ceil(groundTop / bands);

  for (let i = 0; i < bands; i += 1) {
    const color = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(COLORS.skyDeep),
      Phaser.Display.Color.ValueToColor(COLORS.sky),
      bands - 1,
      i,
    );
    g.fillStyle(Phaser.Display.Color.GetColor(color.r, color.g, color.b), 1);
    g.fillRect(0, i * bandHeight, layout.width, bandHeight + 1);
  }

  // Sol difuso no alto: três círculos de borda cada vez mais fraca, o mesmo que
  // o `radial-gradient` do `index.html` faz nas telas de formulário.
  const sunX = layout.width * 0.5;
  const sunY = groundTop * 0.16;
  const sunR = Math.min(layout.width, layout.height) * 0.18;
  // Cinco círculos, cada um um pouco mais forte: menos anéis visíveis do que
  // três, e ainda barato o bastante para redesenhar a cada giro do aparelho.
  for (const [radius, alpha] of [
    [sunR, 0.05],
    [sunR * 0.78, 0.06],
    [sunR * 0.56, 0.08],
    [sunR * 0.36, 0.1],
    [sunR * 0.2, 0.16],
  ] as const) {
    g.fillStyle(0xffffff, alpha);
    g.fillCircle(sunX, sunY, radius);
  }
}

/** Morros ao longe e uma fileira de pinheiros na linha do horizonte. */
function paintHills(g: Phaser.GameObjects.Graphics, layout: Layout, groundTop: number): void {
  const { width } = layout;

  g.fillStyle(0x9fd08a, 1);
  g.fillEllipse(width * 0.22, groundTop + 2, width * 0.9, groundTop * 0.34);
  g.fillStyle(0x8cc47a, 1);
  g.fillEllipse(width * 0.82, groundTop + 2, width * 0.8, groundTop * 0.26);

  const treeHeight = Math.max(dp(layout, 18), groundTop * 0.1);
  const treeWidth = treeHeight * 0.62;
  const spacing = treeWidth * 1.35;

  for (let x = -spacing; x < width + spacing; x += spacing) {
    // Alturas alternadas: uma fileira de triângulos idênticos parece um padrão
    // de papel de parede, e não um bosque.
    const scale = 0.75 + ((Math.floor(x / spacing) % 3) * 0.18);
    const h = treeHeight * scale;
    const w = treeWidth * scale;
    g.fillStyle(0x4e8a3c, 1);
    g.fillTriangle(x, groundTop, x + w / 2, groundTop - h, x + w, groundTop);
    g.fillStyle(0x3d7030, 1);
    g.fillTriangle(x + w * 0.2, groundTop, x + w / 2, groundTop - h * 0.62, x + w * 0.8, groundTop);
  }
}

/** Grama, um caminho de terra subindo até o horizonte e canteiros soltos. */
function paintGround(g: Phaser.GameObjects.Graphics, layout: Layout, groundTop: number): void {
  const { width, height } = layout;

  g.fillStyle(COLORS.grass, 1);
  g.fillRect(0, groundTop, width, height - groundTop);
  g.fillStyle(COLORS.grassDark, 1);
  g.fillRect(0, groundTop, width, dp(layout, 3));

  // O caminho: um trapézio estreito lá em cima e largo embaixo, que é o que dá
  // a sensação de profundidade sem precisar de perspectiva de verdade.
  const bottom = height + dp(layout, 4);
  g.fillStyle(0xd9bb8a, 1);
  g.fillPoints(
    [
      new Phaser.Math.Vector2(width * 0.46, groundTop),
      new Phaser.Math.Vector2(width * 0.54, groundTop),
      new Phaser.Math.Vector2(width * 0.78, bottom),
      new Phaser.Math.Vector2(width * 0.22, bottom),
    ],
    true,
  );

  // Tufos de grama mais escura, para o chão não ser um retângulo chapado.
  const tuft = dp(layout, 7);
  for (let i = 0; i < 14; i += 1) {
    const t = (i * 37) % 100;
    const x = (t / 100) * width;
    const y = groundTop + ((i * 53) % 100) / 100 * (height - groundTop);
    if (x > width * 0.24 && x < width * 0.76 && y > groundTop + (height - groundTop) * 0.3) {
      continue; // Em cima do caminho, não.
    }
    g.fillStyle(0x6fae55, 0.75);
    g.fillEllipse(x, y, tuft * 2.2, tuft);
  }
}

/** Cerca de madeira encostada no horizonte, à esquerda e à direita do caminho. */
function paintFence(g: Phaser.GameObjects.Graphics, layout: Layout, groundTop: number): void {
  const { width } = layout;
  const postHeight = Math.max(dp(layout, 20), (layout.height - groundTop) * 0.12);
  const postWidth = Math.max(dp(layout, 4), postHeight * 0.16);
  const top = groundTop + postHeight * 0.35;
  const spacing = postWidth * 7;

  const rail = (from: number, to: number, y: number): void => {
    g.fillStyle(0x9b6f47, 1);
    g.fillRect(from, y, to - from, postWidth * 0.75);
  };

  for (const [from, to] of [
    [-spacing, width * 0.34],
    [width * 0.66, width + spacing],
  ] as const) {
    rail(from, to, top + postHeight * 0.25);
    rail(from, to, top + postHeight * 0.6);
    for (let x = from; x < to; x += spacing) {
      g.fillStyle(0x8a6244, 1);
      g.fillRect(x, top, postWidth, postHeight);
    }
  }
}

/**
 * Nuvens que atravessam a tela devagar.
 *
 * O movimento é o que diferencia uma tela de carregamento viva de uma imagem
 * parada — e uma imagem parada, no celular, parece o jogo travado. São três
 * nuvens e um tween cada uma; ao girar o aparelho a cena se desfaz e elas nascem
 * de novo, sem sobrar tween solto (o Phaser mata os do objeto destruído).
 */
function addClouds(scene: Phaser.Scene, layout: Layout, groundTop: number): void {
  const { width } = layout;
  const size = Math.max(dp(layout, 26), width * 0.06);

  for (const [xFactor, yFactor, scale, seconds] of [
    [0.18, 0.18, 1, 78],
    [0.62, 0.1, 0.72, 96],
    [0.86, 0.3, 0.86, 64],
  ] as const) {
    const cloud = scene.add.graphics();
    cloud.fillStyle(0xffffff, 0.9);
    cloud.fillCircle(0, 0, size * scale);
    cloud.fillCircle(size * scale * 0.85, size * scale * 0.15, size * scale * 0.72);
    cloud.fillCircle(-size * scale * 0.8, size * scale * 0.2, size * scale * 0.6);
    cloud.fillRect(-size * scale * 0.8, 0, size * scale * 1.7, size * scale * 0.85);
    cloud.setPosition(width * xFactor, groundTop * yFactor);

    scene.tweens.add({
      targets: cloud,
      x: `+=${width + size * 3}`,
      duration: seconds * 1000,
      repeat: -1,
      // Some pela direita e reaparece pela esquerda, fora da tela.
      onRepeat: () => cloud.setX(-size * 2),
    });
  }
}
