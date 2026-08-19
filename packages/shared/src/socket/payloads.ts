import type { CareAction } from '../pet/care.js';
import type { PetSpeciesId } from '../pet/species.js';
import type { PetStage } from '../pet/stage.js';
import type { PetStats } from '../pet/stats.js';

/** Identity attached to an authenticated socket, decoded from the JWT. */
export interface AuthenticatedUser {
  id: string;
  username: string;
}

/**
 * O bicho como ele viaja na rede.
 *
 * Repare que **não há nenhuma data aqui**: nem nascimento, nem "disponível às
 * 20h32". Só durações. O relógio do celular pode estar minutos fora do relógio
 * do servidor — em aparelho com fuso errado, horas — e qualquer subtração entre
 * os dois viraria uma idade errada ou um botão travado para sempre. O servidor
 * manda "faltam tantos ms" no instante em que este estado saiu, e o cliente
 * conta a partir do que recebeu.
 */
export interface PetState {
  id: string;
  ownerId: string;
  ownerName: string;
  name: string;
  species: PetSpeciesId;
  /** Idade acumulada em ms, no instante em que este estado saiu do servidor. */
  ageMs: number;
  stage: PetStage;
  stats: PetStats;
  asleep: boolean;
  /**
   * Espera restante de cada ação, em ms. Ausente = disponível agora. Só as ações
   * em espera aparecem, para o payload não crescer com o catálogo.
   */
  cooldownsMs: Partial<Record<CareAction, number>>;
}

/** Um bicho de outro jogador, como aparece na lista do jardim. */
export interface GardenPetSummary {
  petId: string;
  ownerId: string;
  ownerName: string;
  name: string;
  species: PetSpeciesId;
  stage: PetStage;
  ageMs: number;
  /** O dono está com o jogo aberto agora. */
  online: boolean;
  /** Espera restante até poder mimar este bicho de novo, em ms. */
  cheerCooldownMs: number;
}

export interface CreatePetPayload {
  name: string;
  species: PetSpeciesId;
}

export interface CarePayload {
  action: CareAction;
}

/**
 * O que a ação fez, para o cliente animar.
 *
 * O estado novo vem no `pet:state` que acompanha este evento; aqui vai só o
 * suficiente para a animação (qual ação, quanto mudou, quanto custou). Sem isso a
 * tela só veria as barras saltarem, sem saber o que causou o quê.
 */
export interface CareAppliedPayload {
  action: CareAction;
  /** Diferença aplicada em cada medidor, já com os limites de 0..100. */
  delta: Partial<PetStats>;
  coinsSpent: number;
  coinsEarned: number;
}

/** O bicho passou de estágio. Vale uma comemoração na tela. */
export interface StageChangedPayload {
  petId: string;
  from: PetStage;
  to: PetStage;
}

/** Mimo de outro jogador: alegria de graça para o bicho visitado. */
export interface CheerPayload {
  petId: string;
}

export interface CheerReceivedPayload {
  /** Quem mandou o mimo. */
  fromUsername: string;
  joyGained: number;
}

/** Saldo de moedas do jogador, empurrado quando o jogo mexe nele. */
export interface CoinsUpdatedPayload {
  coins: number;
}

export interface SocketErrorPayload {
  code: string;
  message: string;
}
