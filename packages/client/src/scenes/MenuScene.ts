import Phaser from 'phaser';
import type { CoinsUpdatedPayload } from '@patch/shared';
import { MENU_BACKDROP_TEXTURE } from '../config/assets.js';
import { CSS_COLORS, FONT_STACK } from '../config/theme.js';
import { clearSession, getToken, getUser } from '../services/auth-storage.js';
import { disconnectSocket, getSocket } from '../services/socket-client.js';
import { drawBackdrop } from '../ui/backdrop.js';
import { createBrand, TAGLINE } from '../ui/brand.js';
import { createButton } from '../ui/button.js';
import type { IconName } from '../ui/icon.js';
import { dp, px, readLayout, space, type Layout } from '../ui/layout.js';
import { createMenuItem, type MenuItemVariant } from '../ui/menu-item.js';
import { fitText } from '../ui/text.js';
import { showToast } from '../ui/toast.js';

/**
 * O menu inicial: a porta de entrada depois do login.
 *
 * Existe por dois motivos. O primeiro é que o jogo passou a ter mais de um lugar
 * — o bicho, o jardim, e o que vier — e cair direto no bicho escondia o resto. O
 * segundo é que o menu é onde as partes que ainda não existem aparecem sem
 * mentir: elas estão na lista, marcadas com "Em breve", em vez de sumirem do
 * mapa até o dia que ficarem prontas.
 *
 * Por isso um item que ainda não foi feito continua tocável: um toque que não
 * faz nada parece tela travada. Ele responde dizendo que ainda não existe.
 *
 * É canvas, e não DOM: não há campo de texto aqui (a regra do `index.html` vale
 * para login e chocagem). O saldo vem do servidor — o socket manda `user:coins`
 * na conexão, e este é o primeiro lugar do jogo que abre a conexão.
 *
 * A cena inteira é reconstruída quando o aparelho gira, como as outras: não há
 * estado no desenho que se perca.
 */
interface MenuEntry {
  title: string;
  subtitle: string;
  icon: IconName;
  variant?: MenuItemVariant;
  /** Para onde vai. Sem isso, o item é uma promessa e recebe a etiqueta. */
  scene?: string;
}

const ENTRIES: MenuEntry[] = [
  {
    title: 'Jogar',
    subtitle: 'Entrar no seu mundo',
    icon: 'leaf',
    variant: 'primary',
    scene: 'RoomScene',
  },
  {
    title: 'Fazendas',
    subtitle: 'Visite os bichos dos amigos',
    icon: 'house',
    scene: 'GardenScene',
  },
  // Daqui para baixo, o que o jogo ainda não tem. A ordem é a do mapa do jogo,
  // não a do que foi feito primeiro: é assim que o menu conta para onde ele vai.
  { title: 'Bichinhos', subtitle: 'Veja e cuide dos seus', icon: 'pet' },
  { title: 'Inventário', subtitle: 'Seus itens e recursos', icon: 'bag' },
  { title: 'Missões', subtitle: 'Desafios e recompensas', icon: 'star' },
  { title: 'Configurações', subtitle: 'Ajustes do jogo', icon: 'gear' },
];

export class MenuScene extends Phaser.Scene {
  private layout!: Layout;
  private coinsText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('MenuScene');
  }

  create(): void {
    // Só se chega aqui com sessão. Sem token o socket seria recusado no
    // handshake e o menu abriria com um saldo que não é de ninguém.
    if (!getToken()) {
      this.scene.start('LoginScene');
      return;
    }

    this.layout = readLayout(this.scale);

    const socket = getSocket();
    socket.on('user:coins', this.onCoins);

    const onResize = (): void => {
      this.layout = readLayout(this.scale);
      this.build();
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      socket.off('user:coins', this.onCoins);
      this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
    });

    this.build();
  }

  /**
   * O saldo guardado veio do login e pode ter envelhecido — o servidor manda o
   * número atual assim que a conexão sobe, e de novo a cada ação que mexe nele.
   */
  private onCoins = ({ coins }: CoinsUpdatedPayload): void => {
    this.coinsText?.setText(formatCoins(coins));
  };

  private build(): void {
    this.children.removeAll(true);
    this.coinsText = null;

    const l = this.layout;
    drawBackdrop(this, l, { texture: MENU_BACKDROP_TEXTURE });

    const headerBottom = this.buildHeader();
    const footerTop = this.buildFooter();
    this.buildList(headerBottom + space(l, 14, 10), footerTop - space(l, 12, 8));
  }

  /** Logo à esquerda, jogador à direita. Devolve a base do bloco. */
  private buildHeader(): number {
    const l = this.layout;

    const player = this.buildPlayerCard();

    // O cartão do jogador manda: a marca fica com a largura que sobrar, até um
    // teto. Encolher a marca é melhor do que deixar as duas se encostarem.
    const available = l.width - l.padX * 2 - player.width - space(l, 12, 10);
    const brand = createBrand(this, l, {
      x: l.padX,
      y: l.padTop,
      anchorX: 0,
      width: Math.max(dp(l, 96), Math.min(available, dp(l, l.portrait ? 240 : 320))),
      // A frase pede largura que o celular em pé não tem — ali a marca divide a
      // linha com o cartão do jogador. Em tela larga ela cabe.
      tagline: l.portrait || l.short ? undefined : TAGLINE,
    });

    return Math.max(brand.y + brand.height, player.y + player.height);
  }

  /** Nome e saldo, num cartão encostado no canto direito. */
  private buildPlayerCard(): Phaser.GameObjects.Container {
    const l = this.layout;
    const user = getUser();

    const name = this.add.text(0, 0, user?.username ?? 'Jogador', {
      fontFamily: FONT_STACK,
      fontSize: `${px(l, 15, 12)}px`,
      color: CSS_COLORS.ink,
      fontStyle: 'bold',
    });
    fitText(name, dp(l, 120));

    this.coinsText = this.add.text(0, 0, formatCoins(user?.coins ?? 0), {
      fontFamily: FONT_STACK,
      fontSize: `${px(l, 15, 12)}px`,
      color: '#8a6a20',
      fontStyle: 'bold',
    });

    const padX = space(l, 12, 9);
    const padY = space(l, 8, 6);
    const gap = space(l, 10, 8);
    const width = padX * 2 + name.width + gap + this.coinsText.width;
    const height = padY * 2 + Math.max(name.height, this.coinsText.height);

    const card = this.add.graphics();
    card.fillStyle(0xfdf6e3, 0.94);
    card.fillRoundedRect(0, 0, width, height, dp(l, 14));
    card.lineStyle(dp(l, 2), 0x4a3728, 0.55);
    card.strokeRoundedRect(0, 0, width, height, dp(l, 14));

    name.setPosition(padX, Math.round((height - name.height) / 2));
    this.coinsText.setPosition(
      padX + name.width + gap,
      Math.round((height - this.coinsText.height) / 2),
    );

    const container = this.add.container(l.width - l.padX - width, l.padTop, [
      card,
      name,
      this.coinsText,
    ]);
    container.setSize(width, height);
    return container;
  }

  /**
   * A lista, no espaço entre o cabeçalho e o rodapé.
   *
   * A altura de cada linha sai de uma divisão, e não de um número escolhido: seis
   * itens têm que caber num celular em pé de 640px e num deitado de 360px. Em
   * paisagem viram duas colunas, senão a lista precisaria rolar — e uma lista de
   * seis itens que rola é uma lista mal medida.
   */
  private buildList(top: number, bottom: number): void {
    const l = this.layout;
    const columns = l.portrait ? 1 : 2;
    const rows = Math.ceil(ENTRIES.length / columns);
    const gap = space(l, 10, 8);

    const maxWidth = dp(l, columns === 1 ? 460 : 900);
    const contentWidth = Math.min(l.width - l.padX * 2, maxWidth);
    const columnWidth = (contentWidth - gap * (columns - 1)) / columns;
    const left = Math.round((l.width - contentWidth) / 2);

    const available = bottom - top;
    const rowHeight = Math.round(
      Math.min(dp(l, 78), Math.max(dp(l, 50), (available - gap * (rows - 1)) / rows)),
    );
    const total = rowHeight * rows + gap * (rows - 1);
    // Centraliza na folga quando a lista é menor do que o espaço; quando não é,
    // começa no topo e o rodapé é quem cede.
    const listTop = Math.round(top + Math.max(0, (available - total) / 2));

    ENTRIES.forEach((entry, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);

      createMenuItem(this, {
        x: Math.round(left + column * (columnWidth + gap)),
        y: listTop + row * (rowHeight + gap),
        width: Math.round(columnWidth),
        height: rowHeight,
        layout: l,
        title: entry.title,
        subtitle: entry.subtitle,
        icon: entry.icon,
        variant: entry.scene ? entry.variant ?? 'default' : 'soon',
        badge: entry.scene ? undefined : 'Em breve',
        onClick: () => this.open(entry),
      });
    });
  }

  private open(entry: MenuEntry): void {
    if (!entry.scene) {
      showToast(this, this.layout, `${entry.title} ainda está sendo feito.`);
      return;
    }
    // Quem sabe voltar usa isto para saber que veio daqui, e não do quarto.
    this.scene.start(entry.scene, { from: 'MenuScene' });
  }

  /** Versão e sair da conta. Devolve o topo da linha. */
  private buildFooter(): number {
    const l = this.layout;
    const y = l.height - l.padBottom;

    const logout = createButton(this, {
      label: 'Sair da conta',
      x: l.width - l.padX,
      y,
      layout: l,
      fontSize: 14,
      anchorX: 1,
      anchorY: 1,
      onClick: () => this.logout(),
    });

    // A versão vai numa plaquinha: sozinha, ela cai em cima do mato pintado e
    // some — em qualquer cor. A placa é a mesma dos selos da tela de abertura.
    const plate = this.add.graphics();
    const version = this.add
      .text(0, 0, `v${__APP_VERSION__}`, {
        fontFamily: FONT_STACK,
        fontSize: `${px(l, 12, 10)}px`,
        color: CSS_COLORS.bark,
      })
      .setOrigin(0.5);

    const padX = space(l, 8, 6);
    const padY = space(l, 4, 3);
    const plateWidth = version.width + padX * 2;
    const plateHeight = version.height + padY * 2;
    plate.fillStyle(0xfdf6e3, 0.8);
    plate.fillRoundedRect(l.padX, y - plateHeight, plateWidth, plateHeight, plateHeight / 2);
    version.setPosition(l.padX + plateWidth / 2, y - plateHeight / 2);

    return y - logout.height;
  }

  private logout(): void {
    clearSession();
    disconnectSocket();
    this.scene.start('LoginScene');
  }
}

/** Saldo com separador de milhar: "2.340" lê melhor do que "2340". */
function formatCoins(coins: number): string {
  return `◎ ${coins.toLocaleString('pt-BR')}`;
}
