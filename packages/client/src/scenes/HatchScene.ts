import Phaser from 'phaser';
import { PET_SPECIES_LIST, type PetSpeciesId, type PetState } from '@patch/shared';
import { getSocket } from '../services/socket-client.js';

/**
 * Escolher a espécie e dar nome ao bicho. Só aparece para quem ainda não tem um.
 *
 * DOM, e não canvas, pela mesma razão do login: precisa de um campo de texto de
 * verdade para o teclado do celular aparecer. As espécies são botões de rádio
 * estilizados — o desenho de cada uma vem das cores de `shared/pet/species.ts`
 * enquanto a arte não chega.
 */
export class HatchScene extends Phaser.Scene {
  private overlay!: HTMLElement;

  constructor() {
    super('HatchScene');
  }

  create(): void {
    this.overlay = document.getElementById('ui-overlay') as HTMLElement;
    this.overlay.innerHTML = this.hatchHtml();
    this.overlay.classList.add('active');
    this.bindForm();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.overlay.classList.remove('active');
      this.overlay.innerHTML = '';
      document.documentElement.classList.remove('keyboard-open');
    });
  }

  private hatchHtml(): string {
    const options = PET_SPECIES_LIST.map(
      (species, index) => `
        <label class="species" style="--species: #${species.placeholder.body
          .toString(16)
          .padStart(6, '0')}">
          <input type="radio" name="species" value="${species.id}" ${index === 0 ? 'checked' : ''} />
          <span class="species-egg" aria-hidden="true"></span>
          <span class="species-name">${species.name}</span>
          <span class="species-note">${species.description}</span>
        </label>
      `,
    ).join('');

    return `
      <div class="screen">
        <h1 class="brand">Little<span>Patch</span></h1>
        <form id="hatch-form" class="card">
          <p class="card-title">Escolha o ovo</p>
          <div class="species-list">${options}</div>
          <label class="field field-tag">
            <input name="name" placeholder="Nome do bicho" maxlength="16"
                   autocomplete="off" aria-label="Nome do bicho" />
          </label>
          <button type="submit" class="submit-btn">Chocar</button>
          <p id="hatch-error" class="form-error" role="alert"></p>
        </form>
      </div>
    `;
  }

  private bindForm(): void {
    const form = this.overlay.querySelector<HTMLFormElement>('#hatch-form')!;
    const nameInput = form.querySelector<HTMLInputElement>('input[name="name"]')!;
    const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    const errorText = form.querySelector<HTMLParagraphElement>('#hatch-error')!;

    // Mesmo truque do login: a logo sai do caminho enquanto o teclado está de pé.
    const focusTracker = (): void => {
      const editing = document.activeElement === nameInput;
      document.documentElement.classList.toggle('keyboard-open', editing);
    };
    this.overlay.addEventListener('focusin', focusTracker);
    this.overlay.addEventListener('focusout', () => setTimeout(focusTracker, 0));

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      errorText.textContent = '';

      const name = nameInput.value.trim();
      const species = new FormData(form).get('species') as PetSpeciesId | null;

      // Validação local só para o erro chegar rápido; quem decide é o servidor.
      if (name.length < 2) {
        errorText.textContent = 'O nome precisa de ao menos 2 letras.';
        return;
      }
      if (!species) {
        errorText.textContent = 'Escolha um ovo.';
        return;
      }

      submit.disabled = true;
      const socket = getSocket();

      const onError = ({ message }: { message: string }): void => {
        errorText.textContent = message;
        submit.disabled = false;
      };
      socket.once('server:error', onError);

      socket.emit('pet:create', { name, species }, (pet: PetState | null) => {
        socket.off('server:error', onError);
        if (!pet) {
          submit.disabled = false;
          // A mensagem detalhada vem pelo `server:error`; se ela não chegar,
          // pelo menos o botão volta a funcionar.
          return;
        }
        this.scene.start('RoomScene');
      });
    });
  }
}
