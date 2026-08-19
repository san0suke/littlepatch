import type {
  AuthenticatedUser,
  CarePayload,
  CareAppliedPayload,
  CheerPayload,
  CheerReceivedPayload,
  CoinsUpdatedPayload,
  CreatePetPayload,
  GardenPetSummary,
  PetState,
  SocketErrorPayload,
  StageChangedPayload,
} from './payloads.js';

/** Events the client emits to the server. Callbacks are Socket.IO acknowledgements. */
export interface ClientToServerEvents {
  /** Estado do próprio bicho. `null` = a conta ainda não chocou nenhum. */
  'pet:get': (ack: (pet: PetState | null) => void) => void;
  'pet:create': (payload: CreatePetPayload, ack: (pet: PetState | null) => void) => void;
  /** Alimentar, brincar, banho, remédio, dormir/acordar. O servidor valida tudo. */
  'pet:care': (payload: CarePayload) => void;
  /** Lista os bichos dos outros jogadores. */
  'garden:list': (ack: (pets: GardenPetSummary[]) => void) => void;
  /** Manda um mimo para o bicho de outro jogador. */
  'garden:cheer': (payload: CheerPayload) => void;
}

/** Events the server pushes to clients. */
export interface ServerToClientEvents {
  /** A verdade sobre o bicho. Chega depois de cada ação e a cada tique do servidor. */
  'pet:state': (pet: PetState) => void;
  'pet:care-applied': (payload: CareAppliedPayload) => void;
  'pet:stage-changed': (payload: StageChangedPayload) => void;
  'garden:updated': (pets: GardenPetSummary[]) => void;
  /** Alguém mimou o bicho deste jogador. Só para o socket do dono. */
  'garden:cheer-received': (payload: CheerReceivedPayload) => void;
  /** Moedas da conta depois que o jogo mexeu nelas. Só para o socket do dono. */
  'user:coins': (payload: CoinsUpdatedPayload) => void;
  'server:error': (error: SocketErrorPayload) => void;
}

/** Reserved for multi-node scaling later (Redis adapter). */
export type InterServerEvents = Record<string, never>;

/** Per-socket server-side data, populated by the auth middleware. */
export interface SocketData {
  user: AuthenticatedUser;
}
