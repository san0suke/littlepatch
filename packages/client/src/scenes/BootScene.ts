import Phaser from 'phaser';
import { IMAGE_ASSETS } from '../config/assets.js';

/**
 * Carrega a arte que existe e sai da frente.
 *
 * Um arquivo que falta **não** pode travar a abertura: enquanto a arte não
 * chega, o jogo desenha o provisório (`ui/pet-sprite.ts`) e continua jogável.
 * Por isso o erro de carga vira aviso no console, e não uma tela parada.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    for (const asset of IMAGE_ASSETS) {
      this.load.image(asset.key, asset.url);
    }

    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      console.warn(`[assets] não carregou: ${file.key} (${file.url}) — usando o desenho provisório`);
    });
  }

  create(): void {
    this.scene.start('LoginScene');
  }
}
