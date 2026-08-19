/** Public user shape — never includes the password hash. */
export interface PublicUser {
  id: string;
  username: string;
  email: string;
  /** Moeda do jogo. Comida custa, cuidar bem rende. */
  coins: number;
}

export interface AuthResponse {
  token: string;
  user: PublicUser;
}
