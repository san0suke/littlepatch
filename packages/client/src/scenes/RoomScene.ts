import Phaser from 'phaser';
import {
  CARE_ACTIONS,
  MOOD_MESSAGES,
  STAT_KEYS,
  msToNextStage,
  stageDefinition,
  type CareAction,
  type CheerReceivedPayload,
  type PetState,
  type SocketErrorPayload,
  type StageChangedPayload,
  type StatKey,
} from '@patch/shared';
import { COLORS } from '../config/theme.js';
import { clearSession, getUser } from '../services/auth-storage.js';
import { petStore } from '../services/pet-store.js';
import { disconnectSocket, getSocket } from '../services/socket-client.js';
import { createButton } from '../ui/button.js';
import { dp, px, readLayout, space, type Layout } from '../ui/layout.js';
import { createMeter, type Meter } from '../ui/meter.js';
import { createPetSprite, type PetSprite } from '../ui/pet-sprite.js';
import { showToast } from '../ui/toast.js';

/**
 * A tela do bicho: onde o jogo acontece.
 *
 * Duas coisas guiam o desenho daqui:
 *
 * - **As barras andam sozinhas.** O servidor manda estado a cada 15 segundos; o
 *   `update()` desenha a simulação local entre um e outro (`services/pet-store.ts`).
 *   Sem isso a tela pareceria congelada, e a passagem do tempo é o jogo inteiro.
 * - **Botão nenhum decide nada.** Tocar em "Alimentar" manda `pet:care` e espera:
 *   quem diz se a ação valeu, quanto custou e o que mudou é o servidor. O botão
 *   fica cinza durante a espera porque o servidor mandou a espera, não porque a
 *   tela cronometrou por conta própria.
 *
 * A cena inteira é reconstruída quando o aparelho gira ou o teclado abre: é mais
 * simples e mais confiável do que reposicionar cada peça, e não há estado no
 * desenho que se perca (a verdade está no `petStore`).
 */
export class RoomScene extends Phaser.Scene {
  private layout!: Layout;
  private petSprite: PetSprite | null = null;
  private meters = new Map<StatKey, Meter>();
  private moodText: Phaser.GameObjects.Text | null = null;
  private coinsText: Phaser.GameObjects.Text | null = null;
  private ageText: Phaser.GameObjects.Text | null = null;
  private actionButtons = new Map<CareAction, Phaser.GameObjects.Container>();
  private unsubscribe: (() => void) | null = null;

  constructor() {
    super('RoomScene');
  }

  create(): void {
    this.layout = readLayout(this.scale);
    const socket = getSocket();

    socket.emit('pet:get', (pet: PetState | null) => {
      if (!pet) {
        this.scene.start('HatchScene');
        return;
      }
      petStore.receive(pet);
      this.build();
    });

    this.bindSocket();

    const onResize = (): void => {
      this.layout = readLayout(this.scale);
      if (petStore.raw) {
        this.build();
      }
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
      this.unsubscribe?.();
      this.unsubscribe = null;
      this.unbindSocket();
    });
  }

  /** Redesenho por evento; o `update()` cuida só do que muda a cada quadro. */
  private bindSocket(): void {
    const socket = getSocket();

    this.unsubscribe = petStore.subscribe(() => this.refreshStatic());

    socket.on('pet:care-applied', this.onCareApplied);
    socket.on('pet:stage-changed', this.onStageChanged);
    socket.on('garden:cheer-received', this.onCheerReceived);
    socket.on('server:error', this.onServerError);
  }

  private unbindSocket(): void {
    const socket = getSocket();
    socket.off('pet:care-applied', this.onCareApplied);
    socket.off('pet:stage-changed', this.onStageChanged);
    socket.off('garden:cheer-received', this.onCheerReceived);
    socket.off('server:error', this.onServerError);
  }

  private onCareApplied = (): void => {
    this.petSprite?.react();
  };

  private onStageChanged = ({ to }: StageChangedPayload): void => {
    showToast(this, this.layout, `Cresceu! Agora é ${stageDefinition(to).name}.`);
    this.build();
  };

  private onCheerReceived = ({ fromUsername }: CheerReceivedPayload): void => {
    showToast(this, this.layout, `${fromUsername} mimou seu bicho!`);
  };

  private onServerError = ({ message }: SocketErrorPayload): void => {
    showToast(this, this.layout, message, 'error');
  };

  /** Monta a cena do zero a partir do estado atual. */
  private build(): void {
    const pet = petStore.raw;
    if (!pet) {
      return;
    }

    this.children.removeAll(true);
    this.meters.clear();
    this.actionButtons.clear();

    const { width, padX, padTop, padBottom } = this.layout;
    const l = this.layout;

    this.drawBackground(pet.asleep);

    // ── Cabeçalho: nome, estágio, idade e moedas ──────────────────────────
    const name = this.add.text(padX, padTop, pet.name, {
      fontSize: `${px(l, 26, 18)}px`,
      color: '#2f3b2c',
      fontStyle: 'bold',
    });

    this.ageText = this.add.text(padX, name.y + name.height + space(l, 2, 2), '', {
      fontSize: `${px(l, 13, 11)}px`,
      color: '#5c6b57',
    });

    this.coinsText = this.add
      .text(width - padX, padTop, '', {
        fontSize: `${px(l, 18, 14)}px`,
        color: '#4a3728',
        fontStyle: 'bold',
      })
      .setOrigin(1, 0);

    const headerBottom = this.ageText.y + this.ageText.height;

    // ── Rodapé: as ações, e as saídas abaixo delas ────────────────────────
    const exits = this.buildExits(padBottom);
    const actionsBottom = exits.top - space(l, 10, 8);
    const actionsTop = this.buildActions(actionsBottom);

    // ── Medidores, logo acima das ações ───────────────────────────────────
    const meterWidth = width - padX * 2;
    const metersHeight = this.buildMeters(meterWidth, actionsTop - space(l, 14, 10));

    // ── O bicho, no espaço que sobrou ─────────────────────────────────────
    const freeTop = headerBottom + space(l, 8, 6);
    const freeBottom = metersHeight.top - space(l, 10, 8);
    const centerY = (freeTop + freeBottom) / 2;
    const available = Math.max(dp(l, 80), freeBottom - freeTop);
    const size = Math.min(available, width - padX * 2, dp(l, 260));

    this.petSprite = createPetSprite(this, l, {
      x: width / 2,
      y: centerY,
      species: pet.species,
      stage: pet.stage,
      size,
    });

    this.moodText = this.add
      .text(width / 2, freeBottom, '', {
        fontSize: `${px(l, 15, 12)}px`,
        color: '#4a3728',
        align: 'center',
        wordWrap: { width: width - padX * 2 },
      })
      .setOrigin(0.5, 1);

    // Um último ajuste com os valores de agora, para a cena não nascer zerada.
    this.refreshStatic();
    this.refreshLive();
  }

  private drawBackground(asleep: boolean): void {
    const { width, height } = this.layout;

    // Céu, grama e um monte de terra. Vira imagem assim que a arte do quarto
    // chegar (`config/assets.ts` → `room-day` / `room-night`).
    const sky = this.add.graphics();
    sky.fillStyle(asleep ? COLORS.night : COLORS.sky, 1);
    sky.fillRect(0, 0, width, height);

    const groundTop = height * 0.72;
    sky.fillStyle(asleep ? 0x24502f : COLORS.grass, 1);
    sky.fillRect(0, groundTop, width, height - groundTop);
    sky.fillStyle(asleep ? 0x1d4326 : COLORS.grassDark, 1);
    sky.fillRect(0, groundTop, width, dp(this.layout, 3));
  }

  private buildMeters(meterWidth: number, bottom: number): { top: number } {
    const l = this.layout;
    const gap = space(l, 8, 6);
    // Cinco medidores empilhados: mede um para saber a altura de todos.
    const probe = createMeter(this, l, { key: 'satiety', x: 0, y: -9999, width: meterWidth });
    const rowHeight = probe.height;
    probe.container.destroy();

    const total = rowHeight * STAT_KEYS.length + gap * (STAT_KEYS.length - 1);
    const top = bottom - total;

    STAT_KEYS.forEach((key, index) => {
      const meter = createMeter(this, l, {
        key,
        x: l.padX,
        y: top + index * (rowHeight + gap),
        width: meterWidth,
      });
      this.meters.set(key, meter);
    });

    return { top };
  }

  /** Fila de botões de cuidado. Devolve o topo da fila, para o resto se apoiar. */
  private buildActions(bottom: number): number {
    const l = this.layout;
    const pet = petStore.raw!;
    const actions: CareAction[] = ['feed', 'play', 'clean', 'heal', pet.asleep ? 'wake' : 'sleep'];

    const gap = space(l, 8, 6);
    const columns = l.portrait ? 3 : actions.length;
    const rows = Math.ceil(actions.length / columns);
    const cellWidth = (l.width - l.padX * 2 - gap * (columns - 1)) / columns;

    // Mede a altura real de um botão antes de decidir onde a fila começa.
    const probe = createButton(this, { label: 'X', x: -9999, y: -9999, layout: l, fontSize: 15 });
    const cellHeight = probe.height;
    probe.destroy();

    const top = bottom - (cellHeight * rows + gap * (rows - 1));

    actions.forEach((action, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = l.padX + column * (cellWidth + gap);
      const y = top + row * (cellHeight + gap);

      const definition = CARE_ACTIONS[action];
      const price = definition.cost > 0 ? ` (${definition.cost})` : '';

      const button = createButton(this, {
        label: `${definition.label}${price}`,
        x,
        y,
        layout: l,
        fontSize: 15,
        minWidth: cellWidth,
        variant: action === 'feed' ? 'primary' : 'ghost',
        onClick: () => this.care(action),
      });
      this.actionButtons.set(action, button);
    });

    return top;
  }

  /** Jardim e sair. Devolve o topo da linha. */
  private buildExits(padBottom: number): { top: number } {
    const l = this.layout;
    const y = l.height - padBottom;

    const garden = createButton(this, {
      label: 'Jardim',
      x: l.padX,
      y,
      layout: l,
      fontSize: 14,
      anchorY: 1,
      onClick: () => this.scene.start('GardenScene'),
    });

    createButton(this, {
      label: 'Sair',
      x: l.width - l.padX,
      y,
      layout: l,
      fontSize: 14,
      anchorX: 1,
      anchorY: 1,
      onClick: () => this.logout(),
    });

    return { top: y - garden.height };
  }

  private care(action: CareAction): void {
    // Nenhuma checagem de saldo ou de espera aqui: o servidor recusa e a recusa
    // vira aviso (`server:error`). Duplicar a regra na tela só daria duas versões
    // dela para divergirem.
    getSocket().emit('pet:care', { action });
  }

  private logout(): void {
    clearSession();
    disconnectSocket();
    this.scene.start('LoginScene');
  }

  /** O que só muda quando chega estado novo do servidor. */
  private refreshStatic(): void {
    const pet = petStore.raw;
    if (!pet) {
      return;
    }

    this.petSprite?.setStage(pet.stage);

    const coins = getUser()?.coins ?? 0;
    this.coinsText?.setText(`◎ ${coins}`);

    // Botão cinza é o eco da espera que o servidor mandou, não um cronômetro
    // local: a tela mostra o que ele disse.
    for (const [action, button] of this.actionButtons) {
      const blocked =
        petStore.cooldownMs(action) > 0 ||
        (CARE_ACTIONS[action].requiresAwake && pet.asleep && action !== 'wake');
      button.setAlpha(blocked ? 0.45 : 1);
    }
  }

  /** O que muda a cada quadro: barras escorrendo e a frase de humor. */
  private refreshLive(): void {
    const vitals = petStore.vitals();
    const pet = petStore.raw;
    if (!vitals || !pet) {
      return;
    }

    for (const key of STAT_KEYS) {
      this.meters.get(key)?.update(vitals.stats[key]);
    }

    const mood = petStore.mood();
    if (mood) {
      this.moodText?.setText(MOOD_MESSAGES[mood]);
      this.petSprite?.setMood(mood);
    }

    const stage = stageDefinition(pet.stage).name;
    const remaining = msToNextStage(vitals.ageMs);
    this.ageText?.setText(
      remaining === null
        ? `${stage} · ${formatDuration(vitals.ageMs)} de vida`
        : `${stage} · cresce em ${formatDuration(remaining)}`,
    );
  }

  update(): void {
    if (petStore.raw) {
      this.refreshLive();
    }
  }
}

/** Duração curta e legível: "3d 4h", "2h 10min", "45s". */
function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}min`;
  }
  if (minutes > 0) {
    return `${minutes}min`;
  }
  return `${seconds}s`;
}
