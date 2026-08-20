import Phaser from 'phaser';
import { hasTexture, LOGO_TEXTURE, PLANK_TEXTURE } from '../config/assets.js';
import { BRAND_FONT, CSS_COLORS, FONT_STACK } from '../config/theme.js';
import { createCurvedText } from './curved-text.js';
import { dp, px, space, type Layout } from './layout.js';

/**
 * A marca do jogo no canvas.
 *
 * É o letreiro desenhado (`assets/ui/logo.webp`) quando a textura já carregou, e
 * as duas palavras escritas quando não — a mesma regra do bicho
 * (`ui/pet-sprite.ts`): quem chama pede a marca e não precisa saber qual das duas
 * versões recebeu. O texto continua no código de propósito, porque a tela de
 * carregamento desenha a si mesma **antes** de a imagem existir.
 *
 * A largura é o que o chamador controla, não o tamanho da fonte: as duas versões
 * precisam ocupar o mesmo espaço para a tela não se remontar quando a imagem
 * chega. A altura sai da proporção da arte.
 *
 * As telas de formulário (login e chocagem) são DOM e usam a mesma imagem por
 * `<img class="brand">`, no `index.html`.
 */
export interface BrandConfig {
  x: number;
  y: number;
  /** Largura desejada, em unidades do canvas. A altura vem da proporção. */
  width: number;
  /** 0 = alinha pela esquerda, 0.5 = pelo centro, 1 = pela direita. */
  anchorX?: number;
  anchorY?: number;
  /** A frase abaixo do letreiro. Sai fora quando não há altura para ela. */
  tagline?: string;
}

export const TAGLINE = 'Sua fazendinha. Seus bichinhos. Juntos.';

/** Proporção do letreiro (1200×400). Vale também para o desenho de reserva. */
const LOGO_RATIO = 400 / 1200;

/**
 * Onde a barra de madeira do letreiro termina, em fração da altura da arte —
 * medido na imagem. Os 12% de baixo são folha e florzinha, que descem soltas.
 *
 * É por isso que a tábua não é encostada na base da imagem: ali embaixo não há
 * letreiro nenhum, e a frase pareceria largada longe. Ela sobe até um pouco acima
 * da barra e entra por baixo dela.
 */
const LOGO_BAR_BOTTOM = 0.882;

/**
 * Onde cabe texto dentro da tábua, em fração do tamanho dela.
 *
 * A arte tem folhas nas duas pontas e a madeira é curva: escrever de ponta a
 * ponta jogaria a frase por cima das folhas e para fora da tábua no meio. Estes
 * quatro números são a área plana, medida na própria imagem — se a arte da placa
 * mudar, é aqui que se ajusta, e mais nada.
 */
const PLANK_TEXT_AREA = { left: 0.125, right: 0.875 } as const;

/**
 * Onde a frase se apoia, em fração da altura da placa: a linha do meio da
 * madeira no ponto mais alto do arco (`centerY`) e quanta altura de letra cabe
 * ali (`textHeight`).
 *
 * O alinhamento é por este ponto, e não pela caixa do texto — a curva só empurra
 * para baixo, então centrar a caixa deixaria a frase alta. `centerY` fica um fio
 * abaixo do meio geométrico da madeira (medido em 0,385) porque a caixa da letra
 * carrega o espaço do descendente: centrar a caixa sobe o que se vê.
 */
const PLANK_FACE = { centerY: 0.41, textHeight: 0.54 } as const;

/**
 * O arco da madeira, ajustado sobre a face clara da imagem: uma parábola com o
 * ponto mais alto a 52% da largura e coeficiente 1,051 (altura da placa por
 * largura ao quadrado, as duas normalizadas). A frase assenta nessa mesma curva
 * (`ui/curved-text.ts`) — reta, ela sobe nas pontas e flutua fora da madeira.
 *
 * Fica em coordenadas da **placa**, e a conversão para as do texto é feita na
 * hora de desenhar. É o que mantém as duas coisas coerentes: mexer na faixa
 * escrita (`PLANK_TEXT_AREA`) muda onde a frase começa, e a curva que ela recebe
 * acompanha sozinha, porque perto das pontas a madeira desce mais.
 */
const PLANK_ARC = { apexX: 0.52, curvature: 1.051 } as const;

export function createBrand(
  scene: Phaser.Scene,
  layout: Layout,
  config: BrandConfig,
): Phaser.GameObjects.Container {
  const { x, y, width, anchorX = 0.5, anchorY = 0, tagline } = config;

  const mark = hasTexture(scene, LOGO_TEXTURE)
    ? createLogo(scene, width)
    : createWordmark(scene, layout, width);

  const parts: Phaser.GameObjects.GameObject[] = [mark.object];
  // O bloco é o mais largo entre o letreiro e a placa da frase: é ele que manda
  // no alinhamento, senão uma frase mais larga que a marca vazaria para fora da
  // tela quando ela está encostada na margem esquerda.
  let blockWidth = width;
  let blockHeight = mark.height;
  let plate: Phaser.GameObjects.Container | null = null;

  if (tagline) {
    // Sobreposição, e não espaço: a tábua encosta no letreiro e entra alguns
    // pixels por baixo dele, como uma placa pregada logo abaixo da tabuleta. Por
    // isso ela também entra **antes** na lista — dentro de um container, quem vem
    // primeiro é desenhado atrás.
    plate = createTagline(scene, layout, tagline, width, mark.taglineTop);
    parts.unshift(plate);
    blockWidth = Math.max(blockWidth, plate.width);
    blockHeight = plate.y + plate.height;
  }

  // Centraliza as peças no bloco só agora, com a largura final conhecida: antes
  // disso a frase ainda podia alargá-lo.
  mark.object.setX((blockWidth - width) / 2);
  plate?.setX((blockWidth - plate.width) / 2);

  const container = scene.add.container(x - blockWidth * anchorX, y - blockHeight * anchorY, parts);
  container.setSize(blockWidth, blockHeight);
  return container;
}

/**
 * Efeito de texto entalhado na madeira.
 *
 * A letra escura é o fundo do sulco; a cópia clara um fio abaixo é a luz batendo
 * na borda de baixo do corte. São essas duas coisas juntas que o olho lê como
 * "furado na tábua" em vez de "pintado por cima" — e saem de graça, porque a
 * sombra do `Text` do Phaser é desenhada por baixo do preenchimento.
 */
function engrave(
  target: Phaser.GameObjects.Container | Phaser.GameObjects.Text,
  depth: number,
): void {
  const letters =
    target instanceof Phaser.GameObjects.Container
      ? target.list.filter((child): child is Phaser.GameObjects.Text => 'setShadow' in child)
      : [target];

  for (const letter of letters) {
    letter.setShadow(0, depth, 'rgba(255, 242, 210, 0.9)', 0, false, true);
  }
}

/** O letreiro desenhado, na largura pedida. */
function createLogo(
  scene: Phaser.Scene,
  width: number,
): { object: Phaser.GameObjects.Image; height: number; taglineTop: number } {
  const image = scene.add.image(0, 0, LOGO_TEXTURE).setOrigin(0, 0);
  const height = Math.round(width * (image.height / image.width));
  image.setDisplaySize(width, height);
  // Três por cento acima do fim da barra: o bastante para a tábua sumir por
  // baixo do letreiro em vez de tangenciá-lo.
  return { object: image, height, taglineTop: height * (LOGO_BAR_BOTTOM - 0.03) };
}

/**
 * O provisório: as duas palavras, em duas cores, com um traço embaixo — o mesmo
 * desenho que o `.brand` do `index.html` faz em CSS. Nasce medindo o próprio
 * texto e depois é escalado para a largura pedida, para ocupar o mesmo espaço
 * que a imagem ocuparia.
 */
function createWordmark(
  scene: Phaser.Scene,
  layout: Layout,
  width: number,
): { object: Phaser.GameObjects.Container; height: number; taglineTop: number } {
  const fontSize = px(layout, 44, 24);
  const style: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: BRAND_FONT,
    fontSize: `${fontSize}px`,
    fontStyle: 'bold',
  };

  const first = scene.add.text(0, 0, 'Little', { ...style, color: CSS_COLORS.bark });
  const second = scene.add.text(first.width, 0, 'Patch', { ...style, color: CSS_COLORS.grassDark });

  for (const part of [first, second]) {
    // Contorno claro: a marca fica sobre o céu e sobre a grama dependendo da
    // tela, e sem ele a palavra some no verde escuro do horizonte.
    part.setStroke('#ffffff', Math.max(2, Math.round(fontSize * 0.09)));
    part.setShadow(0, Math.round(fontSize * 0.06), '#00000033', 0, true, true);
  }

  const textWidth = first.width + second.width;
  const ruleY = first.height * 0.92;
  const ruleWidth = textWidth * 0.46;
  const rule = scene.add.graphics();
  rule.fillStyle(0x4e8a3c, 0.9);
  rule.fillRoundedRect((textWidth - ruleWidth) / 2, ruleY, ruleWidth, dp(layout, 5), dp(layout, 3));

  const container = scene.add.container(0, 0, [first, second, rule]);
  const naturalHeight = ruleY + dp(layout, 5);
  container.setSize(textWidth, naturalHeight);

  // Mesma largura da imagem, e a altura acompanha — as duas versões da marca
  // ocupam a mesma caixa, custe o que custar à fidelidade do provisório.
  const scale = width / textWidth;
  container.setScale(scale);

  // O provisório não tem folha sobrando embaixo: a tábua encosta quase na base.
  const height = Math.max(naturalHeight * scale, width * LOGO_RATIO * 0.5);
  return { object: container, height, taglineTop: height - space(layout, 4, 3) };
}

/**
 * A frase do jogo na tábua de madeira (`assets/ui/plank.webp`), ou numa placa de
 * papel enquanto a imagem não existe.
 *
 * A tábua é dimensionada a partir do texto, e não o contrário: a frase é a mesma
 * em toda tela, mas o tamanho da letra muda com a densidade e com o tamanho do
 * aparelho, então a placa tem que crescer junto. Ela nunca passa da largura
 * disponível na tela.
 */
function createTagline(
  scene: Phaser.Scene,
  layout: Layout,
  tagline: string,
  markWidth: number,
  top: number,
): Phaser.GameObjects.Container {
  // A tábua nunca passa muito da largura do letreiro: ela é a legenda dele, e
  // uma placa maior do que a marca inverte a hierarquia da tela. Quando a frase
  // não cabe nesse limite, quem cede é o corpo da letra.
  const maxWidth = Math.min(
    layout.width - layout.padX * 2,
    Math.max(markWidth * 1.15, dp(layout, 280)),
  );
  const style: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: FONT_STACK,
    fontSize: `${px(layout, 23, 15)}px`,
    align: 'center',
  };

  if (hasTexture(scene, PLANK_TEXTURE)) {
    const area = PLANK_TEXT_AREA;
    const inner = area.right - area.left;

    // A frase é sempre uma linha só. Ela é medida primeiro, e é a largura dela
    // que dá o tamanho da tábua; quando a tábua bate no limite da tela, quem
    // cede é o corpo da letra — quebrar em duas linhas descolaria o texto do
    // arco da madeira, que é de uma linha só.
    const textStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      ...style,
      // Marrom bem escuro, quase o do fundo do sulco: é a sombra dentro do furo,
      // não tinta sobre a tábua.
      color: '#3d2a19',
      fontStyle: 'bold',
    };

    const probe = scene.add.text(0, 0, tagline, textStyle);
    const straightWidth = probe.width;
    probe.destroy();

    const plank = scene.add.image(0, 0, PLANK_TEXTURE).setOrigin(0, 0);
    const ratio = plank.height / plank.width;
    const width = Math.min(maxWidth, Math.max(straightWidth / inner, markWidth * 0.6));
    const height = width * ratio;
    const innerWidth = width * inner;
    const innerHeight = height * PLANK_FACE.textHeight;

    plank.setDisplaySize(width, height);

    // Da placa para o texto: o topo do arco vira uma fração da linha escrita, e
    // a queda é a da parábola no ponto onde a primeira letra cai.
    const toApex = PLANK_ARC.apexX - area.left;
    const sag = height * PLANK_ARC.curvature * toApex ** 2;
    const curved = createCurvedText(scene, {
      text: tagline,
      style: textStyle,
      apex: toApex / inner,
      sag,
    });
    // A folga vertical é medida contra a altura de uma letra, não contra a caixa
    // inteira: o que a curva acrescenta à caixa acompanha a madeira, que desce
    // junto.
    const scale = Math.min(1, innerWidth / curved.width, innerHeight / curved.lineHeight);
    // Quando a frase precisa encolher para caber — no menu, onde a tábua é
    // limitada pela largura do letreiro —, a escala encolheria a curva junto. A
    // madeira, essa, não encolheu: a queda é dividida pela escala para a linha
    // continuar assentada nela.
    if (scale < 1) {
      curved.setSag(sag / scale);
    }
    curved.container.setScale(scale);
    curved.container.setPosition(width / 2, height * PLANK_FACE.centerY);
    engrave(curved.container, dp(layout, 2));

    const container = scene.add.container(0, Math.round(top), [plank, curved.container]);
    container.setSize(width, height);
    return container;
  }

  // Reserva: placa de papel, para se ler sobre o céu e sobre o mato.
  const padX = space(layout, 14, 10);
  const padY = space(layout, 7, 5);

  const label = scene.add.text(padX, padY, tagline, { ...style, color: CSS_COLORS.ink });
  // Uma linha só aqui também: encolhe a letra até caber, como faz a tábua.
  label.setScale(Math.min(1, (maxWidth - padX * 2) / label.width));
  label.setOrigin(0, 0);

  const width = label.width * label.scaleX + padX * 2;
  const height = label.height * label.scaleY + padY * 2;

  const background = scene.add.graphics();
  background.fillStyle(0xfdf6e3, 0.92);
  background.fillRoundedRect(0, 0, width, height, dp(layout, 10));
  background.lineStyle(dp(layout, 2), 0x4a3728, 0.28);
  background.strokeRoundedRect(0, 0, width, height, dp(layout, 10));

  const container = scene.add.container(0, Math.round(top), [background, label]);
  container.setSize(width, height);
  return container;
}
