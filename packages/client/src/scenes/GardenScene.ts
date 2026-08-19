import Phaser from 'phaser';
import { PET_SPECIES, stageDefinition, type GardenPetSummary } from '@patch/shared';
import { COLORS } from '../config/theme.js';
import { getSocket } from '../services/socket-client.js';
import { createButton } from '../ui/button.js';
import { dp, px, readLayout, space, type Layout } from '../ui/layout.js';
import { fitText } from '../ui/text.js';
import { showToast } from '../ui/toast.js';

/**
 * O jardim: os bichos dos outros jogadores.
 *
 * É a parte online do jogo. Cada linha traz um bicho e um botão de mimo, que dá
 * alegria a ele e uma moeda a quem visita — com espera por par de jogadores, do
 * lado do servidor, para não virar um botão de dinheiro.
 *
 * A lista rola com arraste do dedo (`setScrollFactor` num container mascarado
 * seria mais elegante, mas exige lidar com máscara em canvas de densidade
 * variável; aqui a rolagem move o container e a máscara acompanha).
 */
export class GardenScene extends Phaser.Scene {
  private layout!: Layout;
  private pets: GardenPetSummary[] = [];

  constructor() {
    super('GardenScene');
  }

  create(): void {
    this.layout = readLayout(this.scale);

    const socket = getSocket();
    socket.emit('garden:list', (pets: GardenPetSummary[]) => {
      this.pets = pets;
      this.build();
    });

    const onUpdated = (pets: GardenPetSummary[]): void => {
      this.pets = pets;
      this.build();
    };
    const onError = ({ message }: { message: string }): void =>
      showToast(this, this.layout, message, 'error');

    socket.on('garden:updated', onUpdated);
    socket.on('server:error', onError);

    const onResize = (): void => {
      this.layout = readLayout(this.scale);
      this.build();
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      socket.off('garden:updated', onUpdated);
      socket.off('server:error', onError);
      this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
    });

    this.build();
  }

  private build(): void {
    this.children.removeAll(true);
    const l = this.layout;

    const background = this.add.graphics();
    background.fillStyle(COLORS.sky, 1);
    background.fillRect(0, 0, l.width, l.height);
    background.fillStyle(COLORS.grass, 1);
    background.fillRect(0, l.height * 0.82, l.width, l.height * 0.18);

    const title = this.add.text(l.padX, l.padTop, 'Jardim', {
      fontSize: `${px(l, 24, 18)}px`,
      color: '#2f3b2c',
      fontStyle: 'bold',
    });

    const back = createButton(this, {
      label: 'Voltar',
      x: l.width - l.padX,
      y: l.height - l.padBottom,
      layout: l,
      fontSize: 14,
      anchorX: 1,
      anchorY: 1,
      onClick: () => this.scene.start('RoomScene'),
    });

    const listTop = title.y + title.height + space(l, 10, 8);
    const listBottom = l.height - l.padBottom - back.height - space(l, 10, 8);

    if (this.pets.length === 0) {
      this.add
        .text(l.width / 2, (listTop + listBottom) / 2, 'Ninguém por aqui ainda.\nVolte mais tarde.', {
          fontSize: `${px(l, 16, 13)}px`,
          color: '#4a3728',
          align: 'center',
        })
        .setOrigin(0.5);
      return;
    }

    const rowHeight = Math.max(dp(l, 62), px(l, 58, 48));
    const gap = space(l, 8, 6);
    const list = this.add.container(0, listTop);

    this.pets.forEach((pet, index) => {
      list.add(this.buildRow(pet, index * (rowHeight + gap), rowHeight));
    });

    // Recorta a lista à faixa livre da tela, para as linhas não passarem por
    // cima do título nem do botão de voltar ao rolar.
    const maskShape = this.make.graphics({}, false);
    maskShape.fillRect(0, listTop, l.width, listBottom - listTop);
    list.setMask(maskShape.createGeometryMask());

    this.enableDragScroll(list, {
      top: listTop,
      viewHeight: listBottom - listTop,
      contentHeight: this.pets.length * (rowHeight + gap) - gap,
    });
  }

  private buildRow(pet: GardenPetSummary, y: number, height: number): Phaser.GameObjects.Container {
    const l = this.layout;
    const width = l.width - l.padX * 2;
    const species = PET_SPECIES[pet.species];

    const card = this.add.graphics();
    card.fillStyle(0xfdf6e3, 0.95);
    card.fillRoundedRect(l.padX, y, width, height, dp(l, 12));
    card.lineStyle(dp(l, 2), pet.online ? COLORS.grassDark : 0xc9d3c2, 1);
    card.strokeRoundedRect(l.padX, y, width, height, dp(l, 12));

    // Bolinha na cor da espécie no lugar do retrato, enquanto a arte não chega.
    const avatarRadius = height * 0.28;
    const avatar = this.add.graphics();
    avatar.fillStyle(species.placeholder.body, 1);
    avatar.fillCircle(l.padX + space(l, 16, 12) + avatarRadius, y + height / 2, avatarRadius);

    const textLeft = l.padX + space(l, 16, 12) + avatarRadius * 2 + space(l, 10, 8);
    const buttonWidth = Math.max(dp(l, 92), px(l, 88, 76));
    const textWidth = width - (textLeft - l.padX) - buttonWidth - space(l, 20, 14);

    const name = this.add.text(textLeft, y + height * 0.22, pet.name, {
      fontSize: `${px(l, 16, 13)}px`,
      color: '#2f3b2c',
      fontStyle: 'bold',
    });
    fitText(name, textWidth);

    const subtitle = this.add.text(
      textLeft,
      y + height * 0.55,
      `${stageDefinition(pet.stage).name} · ${pet.ownerName}${pet.online ? ' · online' : ''}`,
      { fontSize: `${px(l, 12, 10)}px`, color: '#5c6b57' },
    );
    fitText(subtitle, textWidth);

    const waiting = pet.cheerCooldownMs > 0;
    const cheer = createButton(this, {
      label: waiting ? 'Feito' : 'Mimar',
      x: l.padX + width - space(l, 12, 10),
      y: y + height / 2,
      layout: l,
      fontSize: 13,
      anchorX: 1,
      anchorY: 0.5,
      minWidth: buttonWidth,
      variant: waiting ? 'disabled' : 'primary',
      onClick: () => getSocket().emit('garden:cheer', { petId: pet.petId }),
    });

    return this.add.container(0, 0, [card, avatar, name, subtitle, cheer]);
  }

  /**
   * Rolagem por arraste.
   *
   * Sem barra de rolagem nativa: o canvas ocupa a tela inteira e a lista é
   * desenhada dentro dele. O arraste move o container e os limites impedem que a
   * lista saia da faixa visível — no celular é o gesto esperado, e no desktop a
   * roda do mouse faz o mesmo.
   */
  private enableDragScroll(
    list: Phaser.GameObjects.Container,
    bounds: { top: number; viewHeight: number; contentHeight: number },
  ): void {
    const minY = bounds.top + Math.min(0, bounds.viewHeight - bounds.contentHeight);
    const maxY = bounds.top;
    if (minY >= maxY) {
      return; // Cabe inteira: não há o que rolar.
    }

    const clamp = (value: number): number => Math.min(maxY, Math.max(minY, value));

    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown) {
        list.y = clamp(list.y + (pointer.y - pointer.prevPosition.y));
      }
    });

    this.input.on(
      Phaser.Input.Events.POINTER_WHEEL,
      (_pointer: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => {
        list.y = clamp(list.y - dy);
      },
    );
  }
}
