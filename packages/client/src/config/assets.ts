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

/** O letreiro do jogo. Usado pelo carregamento e pelo menu (`ui/brand.ts`). */
export const LOGO_TEXTURE = 'ui-logo';

/** A fazendinha pintada, fundo da tela de carregamento (`ui/backdrop.ts`). */
export const BACKDROP_TEXTURE = 'ui-backdrop';

/** O quintal com os bichos, fundo do menu. Cenário diferente, mesmo lugar. */
export const MENU_BACKDROP_TEXTURE = 'ui-menu-backdrop';

/** A tábua onde a frase do jogo é escrita, embaixo do letreiro. */
export const PLANK_TEXTURE = 'ui-plank';

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
 * Por enquanto só o letreiro: o resto da arte ainda não chegou e cada tela
 * desenha o provisório. As linhas comentadas são o que vem em seguida.
 *
 * `.webp` e não `.png`: o mesmo letreiro pesa 120 KB em vez de 630 KB, e ele é a
 * primeira coisa que o celular baixa. Chrome, Firefox, Android e Safari 14+ leem
 * — o que inclui tudo que roda o jogo, aqui e dentro do Capacitor.
 */
export const IMAGE_ASSETS: ImageAsset[] = [
  { key: LOGO_TEXTURE, url: 'assets/ui/logo.webp' },
  { key: BACKDROP_TEXTURE, url: 'assets/ui/backdrop.webp' },
  { key: MENU_BACKDROP_TEXTURE, url: 'assets/ui/menu-backdrop.webp' },
  { key: PLANK_TEXTURE, url: 'assets/ui/plank.webp' },
  // ...expectedPetImages(),
  // { key: 'room-day', url: 'assets/room/day.png' },
  // { key: 'room-night', url: 'assets/room/night.png' },
];

/** A textura existe e pode ser desenhada? Toda tela pergunta antes de usar. */
export function hasTexture(scene: Phaser.Scene, key: string): boolean {
  return scene.textures.exists(key);
}
