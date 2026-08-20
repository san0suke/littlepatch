import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { defineConfig } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));

// A versão mostrada no rodapé do menu sai do `package.json`, e não de uma
// constante no código: duas cópias do número acabariam divergindo, e a errada
// seria justamente a que o jogador vê.
const { version } = JSON.parse(readFileSync(resolve(here, 'package.json'), 'utf8')) as {
  version: string;
};

export default defineConfig({
  // .env lives at the monorepo root, shared with the server.
  envDir: resolve(here, '../..'),
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  resolve: {
    alias: {
      // Point at the source so shared types/logic go through Vite's pipeline (no build step).
      '@patch/shared': resolve(here, '../shared/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    // Bind to every interface so phones and other devices on the network can reach it.
    host: true,
    // Fail loudly instead of drifting to 5174 — a silent port change looks like
    // "the site is down" when you're typing the URL into a phone.
    strictPort: true,
  },
});
