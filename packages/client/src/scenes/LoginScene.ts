import Phaser from 'phaser';
import { login, register } from '../services/api-client.js';
import { getToken, saveSession } from '../services/auth-storage.js';

/**
 * Entrar e criar conta. Desenhada no overlay de DOM, e não no canvas: campos de
 * texto de verdade dão o teclado nativo no celular (e dentro do Capacitor
 * depois), e manter o título no mesmo layout do formulário garante que os dois
 * nunca se sobreponham. Desenhar o título no canvas o colocaria noutro sistema
 * de coordenadas, exatamente onde o formulário fica.
 *
 * O Phaser só pinta o fundo aqui.
 *
 * O layout de retrato e de paisagem está no CSS do `index.html`: em pé a logo
 * fica sobre o formulário, deitado os dois vão lado a lado, e em telas muito
 * baixas a logo some para o formulário caber inteiro.
 */
export class LoginScene extends Phaser.Scene {
  private overlay!: HTMLElement;

  constructor() {
    super('LoginScene');
  }

  create(): void {
    // Já entrou numa visita anterior: vai direto para o menu, sem passar por
    // aqui. O `BootScene` faz a mesma checagem; esta cobre a volta pelo "sair da
    // conta", que descarta a sessão e recomeça nesta tela.
    if (getToken()) {
      this.scene.start('MenuScene');
      return;
    }

    this.overlay = document.getElementById('ui-overlay') as HTMLElement;
    this.overlay.innerHTML = this.formHtml();
    this.overlay.classList.add('active');
    this.bindForm();
    this.trackFieldFocus();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.overlay.classList.remove('active');
      this.overlay.innerHTML = '';
      document.documentElement.classList.remove('keyboard-open');
    });
  }

  /**
   * Marca `<html>` enquanto um campo está em foco — o mais perto de "o teclado
   * está aberto" que dá para saber sem adivinhar.
   *
   * Não existe evento de teclado no navegador. No iOS ele nem mexe no viewport
   * de layout, então nenhuma media query o enxerga; no Android o encolhimento
   * chega tarde. O foco, por outro lado, é a causa: o teclado sobe porque o
   * jogador tocou num campo.
   */
  private trackFieldFocus(): void {
    const update = (): void => {
      const active = document.activeElement;
      const editing = active instanceof HTMLInputElement && this.overlay.contains(active);
      document.documentElement.classList.toggle('keyboard-open', editing);
    };

    this.overlay.addEventListener('focusin', update);
    // O `focusout` chega antes do foco novo assentar: pular do usuário para a
    // senha passaria por um instante sem campo ativo e a logo piscaria de volta.
    this.overlay.addEventListener('focusout', () => setTimeout(update, 0));
  }

  private formHtml(): string {
    return `
      <div class="screen">
        <img class="brand" src="assets/ui/logo.webp" alt="Little Patch" />
        <form id="auth-form" class="card">
          <div class="mode-switch" role="group" aria-label="Entrar ou criar conta">
            <button type="button" class="mode-btn" data-mode="login" aria-pressed="true">Entrar</button>
            <button type="button" class="mode-btn" data-mode="register" aria-pressed="false">Criar conta</button>
          </div>
          <label class="field field-user">
            <input name="username" placeholder="Usuário" autocomplete="username"
                   autocapitalize="none" autocorrect="off" aria-label="Usuário" />
          </label>
          <label class="field field-mail" hidden>
            <input name="email" type="email" placeholder="E-mail" autocomplete="email"
                   autocapitalize="none" autocorrect="off" aria-label="E-mail" />
          </label>
          <label class="field field-lock">
            <input name="password" type="password" placeholder="Senha"
                   autocomplete="current-password" aria-label="Senha" />
          </label>
          <button type="submit" class="submit-btn">Entrar</button>
          <p id="auth-error" class="form-error" role="alert"></p>
        </form>
      </div>
    `;
  }

  private bindForm(): void {
    const form = this.overlay.querySelector<HTMLFormElement>('#auth-form')!;
    const emailInput = form.querySelector<HTMLInputElement>('input[name="email"]')!;
    const passwordInput = form.querySelector<HTMLInputElement>('input[name="password"]')!;
    const submitButton = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    const errorText = form.querySelector<HTMLParagraphElement>('#auth-error')!;
    let mode: 'login' | 'register' = 'login';

    const modeButtons = form.querySelectorAll<HTMLButtonElement>('.mode-btn');
    modeButtons.forEach((button) => {
      button.addEventListener('click', () => {
        mode = button.dataset.mode as 'login' | 'register';
        const registering = mode === 'register';

        // Esconde o rótulo, não o campo: o ícone mora no ::before do rótulo.
        emailInput.closest('label')!.hidden = !registering;
        emailInput.required = registering;
        submitButton.textContent = registering ? 'Criar conta' : 'Entrar';
        // Tells the password manager to offer a new password instead of a saved one.
        passwordInput.autocomplete = registering ? 'new-password' : 'current-password';
        errorText.textContent = '';

        modeButtons.forEach((other) =>
          other.setAttribute('aria-pressed', String(other.dataset.mode === mode)),
        );
      });
    });

    const inputs = form.querySelectorAll<HTMLInputElement>('input');
    const setError = (on: boolean) =>
      inputs.forEach((input) => input.classList.toggle('has-error', on));
    inputs.forEach((input) => input.addEventListener('input', () => setError(false)));

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      errorText.textContent = '';
      setError(false);
      submitButton.disabled = true;

      const data = new FormData(form);
      const username = String(data.get('username') ?? '').trim();
      const password = String(data.get('password') ?? '');
      const email = String(data.get('email') ?? '').trim();

      try {
        const result =
          mode === 'register'
            ? await register({ username, email, password })
            : await login({ username, password });
        saveSession(result.token, result.user);
        this.scene.start('MenuScene');
      } catch (error) {
        errorText.textContent = error instanceof Error ? error.message : 'Falha na autenticação';
        setError(true);
        submitButton.disabled = false;
      }
    });
  }
}
