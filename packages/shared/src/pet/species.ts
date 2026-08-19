/**
 * As espécies que o jogador pode chocar.
 *
 * A arte ainda não entrou: enquanto o sprite de uma espécie não existir em
 * `public/assets/pet/<spriteKey>-<stage>.png`, o cliente desenha o bicho com as
 * cores daqui (`ui/pet-placeholder.ts`). Trocar o desenho depois é só colocar os
 * arquivos na pasta e listar as chaves em `config/assets.ts` — nada aqui muda.
 *
 * `spriteKey` é o prefixo do arquivo, e não o caminho inteiro, porque cada
 * espécie tem um desenho por estágio de vida (ovo, filhote, jovem, adulto).
 */
export type PetSpeciesId = 'sprout' | 'ember' | 'pebble';

export interface PetSpecies {
  id: PetSpeciesId;
  /** Nome mostrado na tela de escolha. */
  name: string;
  description: string;
  /** Prefixo dos arquivos de arte: `pet/<spriteKey>-baby.png`, etc. */
  spriteKey: string;
  /** Cores do desenho provisório, enquanto a arte não chega. */
  placeholder: {
    body: number;
    belly: number;
    accent: number;
  };
}

export const PET_SPECIES: Record<PetSpeciesId, PetSpecies> = {
  sprout: {
    id: 'sprout',
    name: 'Sprout',
    description: 'Broto teimoso. Dorme cedo e adora banho.',
    spriteKey: 'sprout',
    placeholder: { body: 0x7ec86a, belly: 0xd9f2c4, accent: 0x3f7a34 },
  },
  ember: {
    id: 'ember',
    name: 'Ember',
    description: 'Brasa inquieta. Gasta energia rápido brincando.',
    spriteKey: 'ember',
    placeholder: { body: 0xf6924a, belly: 0xffe0b2, accent: 0xb44a1b },
  },
  pebble: {
    id: 'pebble',
    name: 'Pebble',
    description: 'Seixo calmo. Come pouco e quase não adoece.',
    spriteKey: 'pebble',
    placeholder: { body: 0x8fa8c8, belly: 0xe4ecf7, accent: 0x4a6285 },
  },
};

export const PET_SPECIES_LIST: PetSpecies[] = Object.values(PET_SPECIES);

export function isPetSpeciesId(value: unknown): value is PetSpeciesId {
  return typeof value === 'string' && value in PET_SPECIES;
}
