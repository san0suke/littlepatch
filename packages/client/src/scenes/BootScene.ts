import Phaser from 'phaser';
import { PET_SPECIES_LIST } from '@patch/shared';
import { IMAGE_ASSETS } from '../config/assets.js';
import { CSS_COLORS, FONT_STACK } from '../config/theme.js';
import { getToken } from '../services/auth-storage.js';
import { drawBackdrop } from '../ui/backdrop.js';
import { createBrand, TAGLINE } from '../ui/brand.js';
import { dp, px, readLayout, space, type Layout } from '../ui/layout.js';
import { createPetSprite } from '../ui/pet-sprite.js';

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

const BADGES = ['Multiplayer', 'Cooperativo', 'Relaxante'];

export class BootScene extends Phaser.Scene {
  private layout!: Layout;
  private loaderProgress = 0;
  /** O valor desenhado na barra. Persegue o alvo, nunca pula para ele. */
  private shown = 0;
  private startedAt = 0;
  private leaving = false;
  private tip = TIPS[Math.floor(Math.random() * TIPS.length)];

  private bar: { x: number; y: number; width: number; height: number } | null = null;
  private barFill: Phaser.GameObjects.Graphics | null = null;
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
   * que sobra de altura fica para a logo e para os bichos — e se não sobrar nada,
   * eles saem de cena em vez de espremer o resto. É o mesmo princípio das outras
   * telas: nada de resolução de projeto, cada peça pede o espaço que tem.
   */
  private build(): void {
    this.children.removeAll(true);
    this.bar = null;
    this.barFill = null;
    this.percentText = null;

    const l = this.layout;
    const { groundTop } = drawBackdrop(this, l);

    // A placa nasce antes do que vai em cima dela: quem entra primeiro na cena
    // fica atrás. Só dá para desenhá-la depois de medir o bloco inteiro.
    const panel = this.add.graphics();

    let bottom = l.height - l.padBottom;
    bottom = this.buildBadges(bottom);
    const blockBottom = bottom;
    bottom = this.buildTip(bottom);
    bottom = this.buildBar(bottom);
    this.drawPanel(panel, bottom, blockBottom);

    const brand = createBrand(this, l, {
      x: l.width / 2,
      y: l.padTop + space(l, 10, 6),
      width: Math.min(l.width - l.padX * 2, dp(l, l.short ? 300 : 460)),
      tagline: l.short ? undefined : TAGLINE,
    });

    // Os bichos ficam no chão, entre a logo e a barra — e só se couberem de pé.
    const freeTop = brand.y + brand.height;
    const freeBottom = bottom - space(l, 14, 10);
    if (freeBottom - freeTop > dp(l, 64)) {
      this.buildPets(Math.max(freeTop, Math.min(groundTop, freeBottom - dp(l, 20))), {
        top: freeTop,
        bottom: freeBottom,
      });
    }

    this.drawProgress();
  }

  /**
   * A placa de papel atrás do aviso, da barra e da dica.
   *
   * O fundo é uma pintura, com chão de pedra claro e mato escuro na mesma faixa
   * onde o texto cai: sem a placa, metade da frase some. Um contorno no texto
   * resolveria em cima do chão e falharia em cima do mato — a placa resolve em
   * cima de qualquer fundo, inclusive o que vier depois.
   */
  private drawPanel(panel: Phaser.GameObjects.Graphics, top: number, bottom: number): void {
    const l = this.layout;
    const padX = space(l, 12, 10);
    const padY = space(l, 10, 8);
    const left = l.padX - padX;

    panel.fillStyle(0xfdf6e3, 0.82);
    panel.fillRoundedRect(
      left,
      top - padY,
      l.width - left * 2,
      bottom - top + padY * 2,
      dp(l, 18),
    );
  }

  /** Os três bichos parados na grama, do tamanho que o espaço permitir. */
  private buildPets(groundLine: number, free: { top: number; bottom: number }): void {
    const l = this.layout;
    const columns = PET_SPECIES_LIST.length;
    const slot = (l.width - l.padX * 2) / columns;
    const size = Math.min(slot * 0.62, free.bottom - free.top, dp(l, 104));

    PET_SPECIES_LIST.forEach((species, index) => {
      createPetSprite(this, l, {
        x: l.padX + slot * (index + 0.5),
        // O `createPetSprite` centra o bicho no y pedido; subir meio corpo é o
        // que faz ele parecer apoiado no chão, e não boiando sobre a grama.
        y: Math.min(groundLine, free.bottom - size / 2),
        species: species.id,
        stage: 'child',
        size,
      });
    });
  }

  /** A barra e o "Carregando…". Devolve o topo do bloco. */
  private buildBar(bottom: number): number {
    const l = this.layout;
    const width = Math.min(l.width - l.padX * 2, dp(l, 520));
    const height = Math.max(dp(l, 18), Math.round(l.height * 0.022));
    const x = Math.round((l.width - width) / 2);
    const y = Math.round(bottom - height);

    const track = this.add.graphics();
    track.fillStyle(0xfdf6e3, 0.95);
    track.fillRoundedRect(x, y, width, height, height / 2);
    track.lineStyle(dp(l, 2), 0x4a3728, 0.55);
    track.strokeRoundedRect(x, y, width, height, height / 2);

    this.bar = { x, y, width, height };
    this.barFill = this.add.graphics();

    this.percentText = this.add
      .text(l.width / 2, y + height / 2, '', {
        fontFamily: FONT_STACK,
        fontSize: `${px(l, 12, 10)}px`,
        color: '#3a2a17',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    const status = this.add
      .text(l.width / 2, y - space(l, 8, 6), 'Carregando seu mundo fofinho…', {
        fontFamily: FONT_STACK,
        fontSize: `${px(l, 15, 12)}px`,
        color: CSS_COLORS.ink,
        align: 'center',
        wordWrap: { width: l.width - l.padX * 2 },
      })
      .setOrigin(0.5, 1);

    return status.y - status.height;
  }

  /** A dica do dia. Devolve o topo da linha. */
  private buildTip(bottom: number): number {
    const l = this.layout;
    if (l.short) {
      return bottom; // Em tela baixa a barra vale mais do que a dica.
    }

    const text = this.add
      .text(l.width / 2, bottom, `Dica: ${this.tip}`, {
        fontFamily: FONT_STACK,
        fontSize: `${px(l, 13, 11)}px`,
        color: CSS_COLORS.ink,
        align: 'center',
        wordWrap: { width: Math.min(l.width - l.padX * 2, dp(l, 520)) },
      })
      .setOrigin(0.5, 1);

    return text.y - text.height - space(l, 10, 8);
  }

  /**
   * Os selos do rodapé. Devolve o topo da fila — ou o mesmo `bottom`, quando não
   * cabem: numa tela estreita eles seriam a primeira coisa a atropelar a dica, e
   * são o que menos faz falta.
   */
  private buildBadges(bottom: number): number {
    const l = this.layout;
    const gap = space(l, 8, 6);
    const padX = space(l, 10, 8);
    const padY = space(l, 5, 4);

    // As placas nascem antes dos rótulos, ainda vazias: quem entra na cena
    // primeiro fica atrás. O desenho só acontece depois de medir os textos.
    const pills = this.add.graphics();
    const labels = BADGES.map((label) =>
      this.add
        .text(0, 0, label, {
          fontFamily: FONT_STACK,
          fontSize: `${px(l, 12, 10)}px`,
          color: CSS_COLORS.ink,
          fontStyle: 'bold',
        })
        .setOrigin(0.5),
    );

    const widths = labels.map((label) => label.width + padX * 2);
    const total = widths.reduce((sum, w) => sum + w, 0) + gap * (labels.length - 1);

    if (total > l.width - l.padX * 2) {
      labels.forEach((label) => label.destroy());
      pills.destroy();
      return bottom;
    }

    const height = labels[0].height + padY * 2;
    const top = bottom - height;
    let x = (l.width - total) / 2;

    pills.fillStyle(0xfdf6e3, 0.82);
    labels.forEach((label, index) => {
      const width = widths[index];
      pills.fillRoundedRect(x, top, width, height, height / 2);
      label.setPosition(x + width / 2, top + height / 2);
      x += width + gap;
    });

    return top - space(l, 10, 8);
  }

  /** Redesenha só o que muda: o preenchimento da barra e o número. */
  private drawProgress(): void {
    if (!this.bar || !this.barFill) {
      return;
    }

    const { x, y, width, height } = this.bar;
    const inset = dp(this.layout, 3);
    const filled = Math.max(0, (width - inset * 2) * this.shown);

    this.barFill.clear();
    if (filled > 0) {
      this.barFill.fillStyle(0x4e8a3c, 1);
      this.barFill.fillRoundedRect(
        x + inset,
        y + inset,
        // Um preenchimento mais estreito do que o próprio raio vira um losango
        // torto: abaixo disso ele volta a ser um retângulo comum.
        filled,
        height - inset * 2,
        Math.min((height - inset * 2) / 2, filled / 2),
      );
    }

    this.percentText?.setText(`${Math.round(this.shown * 100)}%`);
  }
}
