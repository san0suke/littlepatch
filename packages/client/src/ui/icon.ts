import Phaser from 'phaser';

/**
 * Os ícones do menu, desenhados em vetor.
 *
 * Enquanto a arte não chega, um ícone precisa existir de algum jeito — e um
 * emoji não serve: cada sistema desenha o seu, em cores que não são as do jogo,
 * e o Android antigo simplesmente mostra um quadrado. Formas simples ficam na
 * cor certa, acompanham a densidade da tela e não somam requisição nem licença.
 *
 * Cada glifo é desenhado centrado em (0, 0), cabendo numa caixa de `size`. Quem
 * chama posiciona o `Graphics` — normalmente dentro do container do item de menu.
 *
 * Quando a arte de interface chegar, é aqui que ela entra (uma imagem por nome,
 * via `config/assets.ts`); os itens de menu não mudam.
 */
export type IconName = 'leaf' | 'house' | 'pet' | 'bag' | 'star' | 'gear';

export interface IconPalette {
  fill: number;
  detail: number;
}

export function drawIcon(
  g: Phaser.GameObjects.Graphics,
  name: IconName,
  size: number,
  palette: IconPalette,
): void {
  const r = size / 2;

  switch (name) {
    case 'leaf':
      drawLeaf(g, r, palette);
      return;
    case 'house':
      drawHouse(g, r, palette);
      return;
    case 'pet':
      drawPet(g, r, palette);
      return;
    case 'bag':
      drawBag(g, r, palette);
      return;
    case 'star':
      drawStar(g, r, palette);
      return;
    case 'gear':
      drawGear(g, r, palette);
      return;
  }
}

/** Folha: duas curvas espelhadas de ponta a ponta, e a nervura no meio. */
function drawLeaf(g: Phaser.GameObjects.Graphics, r: number, palette: IconPalette): void {
  const tip = new Phaser.Math.Vector2(r * 0.8, -r * 0.8);
  const base = new Phaser.Math.Vector2(-r * 0.8, r * 0.8);
  const upper = new Phaser.Curves.QuadraticBezier(
    base,
    new Phaser.Math.Vector2(-r * 0.7, -r * 0.7),
    tip,
  );
  const lower = new Phaser.Curves.QuadraticBezier(
    tip,
    new Phaser.Math.Vector2(r * 0.7, r * 0.7),
    base,
  );

  g.fillStyle(palette.fill, 1);
  g.fillPoints([...upper.getPoints(14), ...lower.getPoints(14)], true);

  g.lineStyle(Math.max(1, r * 0.12), palette.detail, 0.9);
  g.beginPath();
  g.moveTo(base.x + r * 0.1, base.y - r * 0.1);
  g.lineTo(tip.x - r * 0.1, tip.y + r * 0.1);
  g.strokePath();
}

/** Casa: telhado triangular sobre um corpo quadrado, com porta. */
function drawHouse(g: Phaser.GameObjects.Graphics, r: number, palette: IconPalette): void {
  g.fillStyle(palette.fill, 1);
  g.fillRoundedRect(-r * 0.62, -r * 0.1, r * 1.24, r * 0.95, r * 0.14);

  g.fillStyle(palette.detail, 1);
  g.fillTriangle(-r * 0.85, -r * 0.05, 0, -r * 0.85, r * 0.85, -r * 0.05);

  g.fillStyle(palette.detail, 0.85);
  g.fillRoundedRect(-r * 0.18, r * 0.25, r * 0.36, r * 0.6, r * 0.08);
}

/** Bicho: cabeça redonda com duas orelhas e dois olhos. */
function drawPet(g: Phaser.GameObjects.Graphics, r: number, palette: IconPalette): void {
  g.fillStyle(palette.fill, 1);
  g.fillEllipse(-r * 0.42, -r * 0.55, r * 0.46, r * 0.72);
  g.fillEllipse(r * 0.42, -r * 0.55, r * 0.46, r * 0.72);
  g.fillCircle(0, r * 0.12, r * 0.78);

  g.fillStyle(palette.detail, 1);
  g.fillCircle(-r * 0.28, r * 0.02, r * 0.12);
  g.fillCircle(r * 0.28, r * 0.02, r * 0.12);
  g.fillEllipse(0, r * 0.38, r * 0.3, r * 0.18);
}

/** Mochila: corpo arredondado, alça por cima e um bolso na frente. */
function drawBag(g: Phaser.GameObjects.Graphics, r: number, palette: IconPalette): void {
  // A alça vem antes do corpo e mais larga do que ele parece pedir: estreita, o
  // desenho vira um cadeado.
  g.lineStyle(Math.max(1, r * 0.16), palette.detail, 1);
  g.beginPath();
  g.arc(0, -r * 0.2, r * 0.44, Math.PI, 0);
  g.strokePath();

  g.fillStyle(palette.fill, 1);
  g.fillRoundedRect(-r * 0.8, -r * 0.3, r * 1.6, r * 1.1, r * 0.26);

  // Tampa e fivela, atravessando o corpo inteiro.
  g.fillStyle(palette.detail, 0.85);
  g.fillRoundedRect(-r * 0.8, r * 0.06, r * 1.6, r * 0.26, r * 0.1);
  g.fillRoundedRect(-r * 0.16, -r * 0.02, r * 0.32, r * 0.42, r * 0.08);
}

/** Estrela de cinco pontas: raios alternando entre cheio e vazio. */
function drawStar(g: Phaser.GameObjects.Graphics, r: number, palette: IconPalette): void {
  const points: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? r : r * 0.46;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    points.push(new Phaser.Math.Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius));
  }

  g.fillStyle(palette.fill, 1);
  g.fillPoints(points, true);
  g.lineStyle(Math.max(1, r * 0.1), palette.detail, 0.6);
  g.strokePoints(points, true);
}

/** Engrenagem: um anel de dentes e o furo no meio. */
function drawGear(g: Phaser.GameObjects.Graphics, r: number, palette: IconPalette): void {
  const teeth = 8;
  const points: Phaser.Math.Vector2[] = [];
  const step = Math.PI / teeth;

  for (let i = 0; i < teeth * 2; i += 1) {
    const radius = i % 2 === 0 ? r : r * 0.72;
    // Cada dente é um par de pontos no mesmo raio, o que dá o topo reto —
    // alternar ponto a ponto daria uma estrela, não uma engrenagem.
    const angle = i * step;
    points.push(new Phaser.Math.Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius));
    points.push(
      new Phaser.Math.Vector2(
        Math.cos(angle + step * 0.55) * radius,
        Math.sin(angle + step * 0.55) * radius,
      ),
    );
  }

  g.fillStyle(palette.fill, 1);
  g.fillPoints(points, true);

  g.fillStyle(palette.detail, 1);
  g.fillCircle(0, 0, r * 0.3);
}
