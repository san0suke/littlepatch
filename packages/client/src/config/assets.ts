import type Phaser from 'phaser';
import { PET_SPECIES_LIST, PET_STAGES, type PetSpeciesId, type PetStage } from '@patch/shared';

/**
 * O catálogo de arte — e o único lugar a mexer quando as imagens chegarem.
 *
 * Enquanto uma imagem não existe, o jogo não quebra: o `BootScene` carrega só o
 * que está listado aqui e cada tela pergunta `hasTexture()` antes de desenhar,
 * caindo no desenho provisório (`ui/pet-placeholder.ts`) quando falta. Isso é o
 * que permite jogar hoje, sem arte, e trocar peça por peça depois — em vez de
 * esperar o pacote inteiro para ver a primeira tela de pé.
 *
 * Para acrescentar uma imagem:
 *   1. Coloque o arquivo em `public/assets/<pasta>/`.
 *   2. Acrescente uma linha em `IMAGE_ASSETS` (ou descomente a linha do bicho).
 * Nada mais no código muda.
 */
export interface ImageAsset {
  key: string;
  /** Caminho a partir de `public/`. */
  url: string;
}

/** Chave da textura de um bicho, por espécie e estágio de vida. */
export function petTextureKey(species: PetSpeciesId, stage: PetStage): string {
  return `pet-${species}-${stage}`;
}

/**
 * Os arquivos que o jogo procuraria para os bichos, se existissem: um por
 * espécie e estágio (`pet/sprout-baby.png`, `pet/ember-adult.png`, …).
 *
 * A lista está pronta e **fora** de `IMAGE_ASSETS` de propósito: carregar um
 * arquivo que não existe enche o console de 404 e atrasa a abertura do jogo.
 * Assim que a arte entrar na pasta, troque `IMAGE_ASSETS` abaixo por
 * `[...expectedPetImages(), ...]` — ou mova só as espécies que já têm desenho.
 */
export function expectedPetImages(): ImageAsset[] {
  const images: ImageAsset[] = [];
  for (const species of PET_SPECIES_LIST) {
    for (const stage of PET_STAGES) {
      images.push({
        key: petTextureKey(species.id, stage.id),
        url: `assets/pet/${species.spriteKey}-${stage.id}.png`,
      });
    }
  }
  return images;
}

/**
 * O que o `BootScene` carrega de verdade.
 *
 * Vazio por enquanto: a arte ainda não chegou. Cada tela desenha o provisório e
 * segue.
 */
export const IMAGE_ASSETS: ImageAsset[] = [
  // ...expectedPetImages(),
  // { key: 'room-day', url: 'assets/room/day.png' },
  // { key: 'room-night', url: 'assets/room/night.png' },
  // { key: 'button-wood', url: 'assets/ui/button-wood.png' },
];

/** A textura existe e pode ser desenhada? Toda tela pergunta antes de usar. */
export function hasTexture(scene: Phaser.Scene, key: string): boolean {
  return scene.textures.exists(key);
}
