import Phaser from 'phaser';
import { IMAGE_ASSETS } from '../config/assets.js';
import { CSS_COLORS, FONT_STACK } from '../config/theme.js';
import { getToken } from '../services/auth-storage.js';
import { drawBackdrop } from '../ui/backdrop.js';
import { createBrand, TAGLINE } from '../ui/brand.js';
import { drawIcon, type IconName } from '../ui/icon.js';
import { dp, px, readLayout, space, type Layout } from '../ui/layout.js';
import { createProgressBar, type ProgressBar } from '../ui/progress-bar.js';

/**
 * A tela de carregamento: a primeira coisa que o jogo mostra.
 *
 * Carrega a arte que existe e, enquanto isso, desenha a fazendinha, a logo e a
 * barra. Um arquivo que falta **não** pode travar a abertura: enquanto a arte
 * não chega, o jogo desenha o provisório (`ui/pet-sprite.ts`) e continua
 * jogável. Por isso o erro de carga vira aviso no console, e não uma tela parada.
 *
 * Duas coisas guiam o desenho daqui:
 *
 * - **A barra mostra o carregamento de verdade** (`load.on('progress')`), mas
 *   nunca chega ao fim antes de `MIN_SPLASH_MS`. Hoje a lista de imagens está
 *   vazia e o carregamento acaba no primeiro quadro: sem o piso de tempo, a tela
 *   apareceria e sumiria no mesmo piscar, que é pior do que não existir. Quando a
 *   arte entrar, quem manda passa a ser o carregamento — o piso só some do
 *   caminho.
 * - **O desenho é atualizado no evento do carregador**, e não no `update()`: o
 *   `update()` da cena só começa a rodar depois do `create()`, ou seja, depois
 *   que tudo já carregou. Uma barra que só anda no fim não serve para nada.
 *
 * O `update()` assume dali em diante, para o resto da subida ser suave.
 */

/** Tempo mínimo de tela, em ms. Abaixo disso a abertura vira um flash. */
const MIN_SPLASH_MS = 1200;

/** Sorteada uma por abertura: dá o que ler enquanto a barra anda. */
const TIPS = [
  'Visite a fazenda dos amigos todos os dias para ganhar presentes.',
  'Seu bichinho continua vivendo com o jogo fechado — volte antes que ele passe fome.',
  'Bicho dormindo gasta menos energia. Apague a luz antes de sair.',
  'Mimar o bicho de outro jogador rende moeda para os dois.',
  'Remédio custa caro: banho e comida em dia evitam a doença.',
];

const BADGES: { label: string; icon: IconName; color: number; detail: number }[] = [
  { label: 'Multiplayer', icon: 'people', color: 0xf6c453, detail: 0xf2a2c0 },
  { label: 'Cooperativo', icon: 'heart', color: 0xe5695f, detail: 0xffffff },
  { label: 'Relaxante', icon: 'leaf', color: 0x8ed36a, detail: 0x4e8a3c },
];

/** Texto do rodape: claro, sobre o escurecido - nunca a tinta escura do jogo. */
const LIGHT = '#fdf6e3';

export class BootScene extends Phaser.Scene {
  private layout!: Layout;
  private loaderProgress = 0;
  /** O valor desenhado na barra. Persegue o alvo, nunca pula para ele. */
  private shown = 0;
  private startedAt = 0;
  private leaving = false;
  private tip = TIPS[Math.floor(Math.random() * TIPS.length)];

  private bar: ProgressBar | null = null;
  private percentText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('BootScene');
  }

  preload(): void {
    // `performance.now()`, e não `Date.now()`: relógio monotônico, imune a um
    // ajuste de hora do sistema no meio da abertura. Mesma regra do `pet-store`.
    this.startedAt = performance.now();
    this.layout = readLayout(this.scale);
    this.build();

    for (const asset of IMAGE_ASSETS) {
      this.load.image(asset.key, asset.url);
    }

    this.load.on(Phaser.Loader.Events.PROGRESS, (value: number) => {
      this.loaderProgress = value;
      // Sem espera aqui: o `update()` ainda não roda, então quem anima a barra
      // durante o carregamento é este evento.
      this.shown = Math.max(this.shown, this.target());
      this.drawProgress();
    });

    // Esta tela desenha o letreiro e o cenário — e é ela mesma quem os carrega.
    // Sem redesenhar a cada arquivo que chega, a abertura inteira mostraria as
    // versões de reserva e a arte só apareceria no menu.
    this.load.on(Phaser.Loader.Events.FILE_COMPLETE, () => this.build());

    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      console.warn(`[assets] não carregou: ${file.key} (${file.url}) — usando o desenho provisório`);
    });
  }

  create(): void {
    // Sem lista de arquivos o evento de progresso nunca chega: o carregador
    // termina antes de ter o que contar. Daqui em diante é o piso de tempo que
    // enche a barra, no `update()`.
    this.loaderProgress = 1;

    const onResize = (): void => {
      this.layout = readLayout(this.scale);
      this.build();
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
    });
  }

  update(_time: number, delta: number): void {
    if (this.leaving) {
      return;
    }

    const target = this.target();
    // Suavização exponencial: a barra corre atrás do alvo em vez de saltar
    // quando um pacote grande termina de uma vez.
    this.shown = Phaser.Math.Linear(this.shown, target, Math.min(1, delta / 140));

    if (target >= 1 && this.shown > 0.995) {
      this.shown = 1;
      this.leave();
    }

    this.drawProgress();
  }

  /** Onde a barra deveria estar: o menor entre o carregamento e o piso de tempo. */
  private target(): number {
    const elapsed = (performance.now() - this.startedAt) / MIN_SPLASH_MS;
    return Math.max(0, Math.min(this.loaderProgress, elapsed, 1));
  }

  private leave(): void {
    this.leaving = true;
    // Quem já entrou numa visita anterior cai direto no menu; o `LoginScene`
    // repete a checagem, porque também se chega nele pelo "sair da conta".
    const next = getToken() ? 'MenuScene' : 'LoginScene';

    this.cameras.main.fadeOut(220, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(next);
    });
  }

  /**
   * Monta a tela do zero.
   *
   * De baixo para cima: os selos, a dica, a barra e o aviso de carregamento. O
   * que sobra de altura fica para a marca e para a pintura do fundo aparecer. É
   * o mesmo princípio das outras telas: nada de resolução de projeto, cada peça
   * pede o espaço que tem.
   */
  private build(): void {
    this.children.removeAll(true);
    this.bar = null;
    this.percentText = null;

    const l = this.layout;
    drawBackdrop(this, l);

    // O escurecido nasce antes do que vai em cima dele: quem entra primeiro na
    // cena fica atrás. Só dá para desenhá-lo depois de medir o bloco inteiro.
    const scrim = this.add.graphics();

    let bottom = l.height - l.padBottom;
    bottom = this.buildBadges(bottom);
    bottom = this.buildTip(bottom);
    bottom = this.buildBar(bottom);
    this.drawScrim(scrim, bottom - space(l, 12, 9));

    createBrand(this, l, {
      x: l.width / 2,
      y: l.padTop + space(l, 10, 6),
      width: Math.min(l.width - l.padX * 2, dp(l, l.short ? 300 : 460)),
      tagline: l.short ? undefined : TAGLINE,
    });

    this.drawProgress();
  }

  /**
   * O escurecido do rodapé.
   *
   * A placa de papel que havia aqui antes resolvia a leitura, mas colava um
   * retângulo claro por cima da pintura, e o rodapé parecia um aviso de sistema.
   * Escurecer o fundo em degradê deixa a arte aparecer, e o texto claro por cima
   * lê em qualquer parte dela — chão de pedra, mato ou céu.
   *
   * Em faixas, e não em `fillGradientStyle`: o degradê do Phaser é só do WebGL, e
   * no renderizador Canvas a mesma chamada pintaria uma tarja chapada. Mesma
   * razão do céu em `ui/backdrop.ts`.
   */
  private drawScrim(scrim: Phaser.GameObjects.Graphics, top: number): void {
    const l = this.layout;
    const fade = Math.max(dp(l, 40), (l.height - top) * 0.55);
    const layers = 16;
    const alpha = 0.062;

    // Camadas empilhadas, cada uma indo até a base da tela: onde há mais delas
    // por cima, mais escuro fica. Faixas lado a lado deixariam a emenda à mostra
    // como uma listra; assim o acúmulo é contínuo e some sozinho no alto.
    for (let i = 0; i < layers; i += 1) {
      const y = top - fade + (fade * i) / layers;
      scrim.fillStyle(0x1b2a16, alpha);
      scrim.fillRect(0, y, l.width, l.height - y);
    }
  }

  /** A barra e o "Carregando…". Devolve o topo do bloco. */
  private buildBar(bottom: number): number {
    const l = this.layout;
    const width = Math.min(l.width - l.padX * 2, dp(l, 520));
    const height = Math.max(dp(l, 26), Math.round(l.height * 0.03));
    const x = Math.round((l.width - width) / 2);
    const y = Math.round(bottom - height);

    this.bar = createProgressBar(this, l, { x, y, width, height });

    this.percentText = this.add
      .text(l.width / 2, y + height / 2, '', {
        fontFamily: FONT_STACK,
        fontSize: `${px(l, 15, 12)}px`,
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.percentText.setShadow(0, dp(l, 2), 'rgba(0, 0, 0, 0.55)', dp(l, 2), false, true);

    const status = this.add
      .text(l.width / 2, y - space(l, 10, 7), 'Carregando seu mundo fofinho…', {
        fontFamily: FONT_STACK,
        fontSize: `${px(l, 17, 13)}px`,
        color: LIGHT,
        align: 'center',
        wordWrap: { width: l.width - l.padX * 2 },
      })
      .setOrigin(0.5, 1);
    status.setShadow(0, dp(l, 2), 'rgba(0, 0, 0, 0.6)', dp(l, 3), false, true);

    return status.y - status.height;
  }

  /**
   * A dica do dia: uma folhinha, "Dica:" em dourado e o resto em claro.
   *
   * São três objetos numa linha, e não um texto único, porque a palavra "Dica:"
   * tem cor própria — um `Text` do Phaser pinta tudo de uma cor só. O bloco é
   * medido depois de montado e centralizado então.
   */
  private buildTip(bottom: number): number {
    const l = this.layout;
    if (l.short) {
      return bottom; // Em tela baixa a barra vale mais do que a dica.
    }

    const fontSize = px(l, 14, 11);
    const iconSize = Math.round(fontSize * 1.2);
    const gap = space(l, 6, 4);

    const label = this.add.text(0, 0, 'Dica:', {
      fontFamily: FONT_STACK,
      fontSize: `${fontSize}px`,
      color: CSS_COLORS.sun,
      fontStyle: 'bold',
    });

    const maxWidth = Math.min(l.width - l.padX * 2, dp(l, 560));
    const text = this.add.text(0, 0, this.tip, {
      fontFamily: FONT_STACK,
      fontSize: `${fontSize}px`,
      color: LIGHT,
      wordWrap: { width: maxWidth - iconSize - label.width - gap * 2 },
    });

    for (const part of [label, text]) {
      part.setShadow(0, dp(l, 2), 'rgba(0, 0, 0, 0.6)', dp(l, 3), false, true);
    }

    const blockWidth = iconSize + gap + label.width + gap + text.width;
    const left = Math.round((l.width - blockWidth) / 2);
    const top = Math.round(bottom - text.height);

    const leaf = this.add.graphics().setPosition(left + iconSize / 2, top + label.height / 2);
    drawIcon(leaf, 'leaf', iconSize, { fill: 0x8ed36a, detail: 0x4e8a3c });

    label.setPosition(left + iconSize + gap, top);
    text.setPosition(label.x + label.width + gap, top);

    return top - space(l, 12, 9);
  }

  /**
   * Os selos do rodapé: ícone e palavra, espalhados na largura.
   *
   * Devolve o topo da fila — ou o mesmo `bottom`, quando não cabem: numa tela
   * estreita eles seriam a primeira coisa a atropelar a dica, e são o que menos
   * faz falta.
   */
  private buildBadges(bottom: number): number {
    const l = this.layout;
    const fontSize = px(l, 13, 10);
    const iconSize = Math.round(fontSize * 1.5);
    const gap = space(l, 7, 5);

    const labels = BADGES.map((badge) =>
      this.add.text(0, 0, badge.label, {
        fontFamily: FONT_STACK,
        fontSize: `${fontSize}px`,
        color: LIGHT,
        fontStyle: 'bold',
      }),
    );

    const widths = labels.map((label) => iconSize + gap + label.width);
    const total = widths.reduce((sum, w) => sum + w, 0);
    const available = Math.min(l.width - l.padX * 2, dp(l, 560));

    if (total + space(l, 14, 10) * (labels.length - 1) > available) {
      labels.forEach((label) => label.destroy());
      return bottom;
    }

    // O que sobra de largura vira o espaço entre um selo e outro, por igual.
    const spacing = (available - total) / (labels.length - 1);
    const height = Math.max(iconSize, labels[0].height);
    const top = bottom - height;
    let x = Math.round((l.width - available) / 2);

    labels.forEach((label, index) => {
      const badge = BADGES[index];
      const icon = this.add.graphics().setPosition(x + iconSize / 2, top + height / 2);
      drawIcon(icon, badge.icon, iconSize, { fill: badge.color, detail: badge.detail });

      label.setPosition(x + iconSize + gap, Math.round(top + (height - label.height) / 2));
      label.setShadow(0, dp(l, 2), 'rgba(0, 0, 0, 0.6)', dp(l, 3), false, true);

      x += widths[index] + spacing;
    });

    return top - space(l, 12, 9);
  }

  /** Redesenha só o que muda: o preenchimento da barra e o número. */
  private drawProgress(): void {
    this.bar?.set(this.shown);
    this.percentText?.setText(`${Math.round(this.shown * 100)}%`);
  }
}
