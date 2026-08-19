import { advanceVitals, moodFor, type PetMood, type PetState, type PetVitals } from '@patch/shared';

/**
 * A última foto do bicho recebida do servidor, e o tempo que passou desde ela.
 *
 * O servidor manda estado a cada 15 segundos. Desenhar exatamente o que chegou
 * deixaria as barras congeladas por 15s e o jogo pareceria travado — a passagem
 * do tempo **é** o jogo. Então a tela desenha a foto avançada até agora, com a
 * mesma função pura que o servidor usa (`advanceVitals`, no `shared`).
 *
 * Isso é palpite de desenho, nunca verdade: nada daqui volta para o servidor, e
 * o próximo `pet:state` sobrescreve o palpite. Se as duas contas divergirem um
 * pouco, o jogador vê a barra corrigir alguns pixels — e não uma partida
 * decidida no cliente.
 *
 * Tudo em duração, nunca em data: `receivedAt` é um `performance.now()`, um
 * relógio monotônico do próprio aparelho. `Date.now()` daria salto se o sistema
 * ajustasse a hora no meio da sessão.
 */
type Listener = (pet: PetState) => void;

class PetStore {
  private state: PetState | null = null;
  private receivedAt = 0;
  private listeners = new Set<Listener>();

  receive(pet: PetState): void {
    this.state = pet;
    this.receivedAt = performance.now();
    for (const listener of this.listeners) {
      listener(pet);
    }
  }

  clear(): void {
    this.state = null;
    this.receivedAt = 0;
  }

  /** A foto crua, como veio do servidor. Use para nome, espécie, dono. */
  get raw(): PetState | null {
    return this.state;
  }

  /** Há quanto tempo, em ms, a última foto chegou. */
  elapsedMs(): number {
    return this.state ? performance.now() - this.receivedAt : 0;
  }

  /** Os medidores como estariam agora. É isto que as barras desenham. */
  vitals(): PetVitals | null {
    if (!this.state) {
      return null;
    }
    const snapshot: PetVitals = {
      stats: this.state.stats,
      asleep: this.state.asleep,
      ageMs: this.state.ageMs,
    };
    return advanceVitals(snapshot, this.elapsedMs());
  }

  mood(): PetMood | null {
    const vitals = this.vitals();
    return vitals ? moodFor(vitals) : null;
  }

  /** Espera restante de uma ação, já descontado o tempo desde a última foto. */
  cooldownMs(action: keyof NonNullable<PetState['cooldownsMs']>): number {
    const remaining = this.state?.cooldownsMs?.[action] ?? 0;
    return Math.max(0, remaining - this.elapsedMs());
  }

  /** Avisa quando uma foto nova chega. Devolve a função de cancelar. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const petStore = new PetStore();
