import { Router } from 'express';
import type { AuthResponse } from '@patch/shared';
import { createUser, signJwt, validateCredentials } from './auth.service.js';

export const authRouter = Router();

authRouter.post('/register', async (req, res) => {
  const { username, email, password } = req.body ?? {};

  if (typeof username !== 'string' || username.length < 3) {
    return res.status(400).json({ message: 'O usuário precisa de ao menos 3 caracteres' });
  }
  if (typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ message: 'Informe um e-mail válido' });
  }
  if (typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ message: 'A senha precisa de ao menos 6 caracteres' });
  }

  try {
    const user = await createUser({ username, email, password });
    const response: AuthResponse = { token: signJwt(user), user };
    return res.status(201).json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha no cadastro';
    return res.status(409).json({ message });
  }
});

authRouter.post('/login', async (req, res) => {
  const { username, password } = req.body ?? {};

  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ message: 'Usuário e senha são obrigatórios' });
  }

  const user = await validateCredentials(username, password);
  if (!user) {
    return res.status(401).json({ message: 'Usuário ou senha inválidos' });
  }

  const response: AuthResponse = { token: signJwt(user), user };
  return res.json(response);
});
