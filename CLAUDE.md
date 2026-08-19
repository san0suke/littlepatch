# CLAUDE.md

Contexto para quem (ou o que) for mexer neste repositório. O `README.md` explica
como rodar; aqui ficam as decisões que não se leem no código.

**Little Patch** é um tamagotchi online: bicho virtual em Phaser 3, servidor
Node/Socket.IO como autoridade, Postgres guardando conta e bicho. O nome é
provisório.

A stack é a mesma do projeto de poker em `../experiment1`, por reaproveitamento
deliberado: escala de canvas no celular, CORS de rede local, autenticação JWT e
contrato de socket tipado já estavam resolvidos lá.

## Comandos

```bash
npm install                        # na raiz, resolve os 3 workspaces
npm run dev                        # server (:3000) + client (:5173)
npm run build
npm test                           # vitest em shared e server
npm run lint
npm run smoke -w @patch/server     # ida e volta de socket, precisa do servidor no ar
npm run prisma:migrate -w @patch/server -- --name <nome>
npm run prisma:studio -w @patch/server
```

## Arquitetura

### `shared` é o contrato, não uma pasta de utilitários

Tudo que client e server precisam concordar mora em `packages/shared`: os eventos
de socket (`ClientToServerEvents` / `ServerToClientEvents`), os payloads, os
medidores e a função de decaimento. Os dois lados importam as mesmas interfaces,
então mudar um payload quebra a compilação em vez de quebrar em produção.

Não é lugar de "coisas gerais". Se algo só o servidor usa, fica no servidor.

### O servidor é a autoridade — regra permanente

O cliente **sugere** ações (`pet:care`); quem decide se valem, quanto custam e o
que mudam é o servidor. Nunca mover para o cliente:

- o valor dos medidores e a passagem do tempo;
- o custo e a recompensa em moeda;
- as esperas entre ações;
- se o ovo já chocou, se o bicho está doente, em que estágio ele está.

O cliente simula por conta própria só para desenhar (ver abaixo), e joga o
palpite fora assim que o servidor manda o valor real.

### A simulação mora em `shared/pet/simulation.ts`

`advanceVitals(vitals, elapsedMs)` é pura: nenhuma leitura de relógio dentro
dela, o tempo decorrido entra como argumento. Isso a torna a mesma função nos
dois lados, com papéis diferentes:

- **Servidor**: guarda `simulatedAt` na linha do bicho e avança dali até agora em
  toda leitura. É isso que faz o bicho viver com o jogo fechado — sem processo
  nenhum cuidando das contas offline. Quem some por um dia recebe a queda do dia
  inteiro no próximo login, de uma vez.
- **Cliente**: avança a última foto recebida a cada quadro, para as barras
  escorrerem entre um `pet:state` e o próximo (`services/pet-store.ts`).

O tique do servidor (`pets/pet.ticker.ts`, 15s) **não** é o que faz o tempo
passar. Ele existe só para empurrar estado a quem está com a tela aberta e para
gravar de vez em quando. Percorre apenas quem está online, de propósito.

### Nada de data absoluta na rede

Para fora do servidor vai duração, nunca horário: `ageMs`, `cooldownsMs`,
`cheerCooldownMs`. O relógio do celular pode estar minutos — em aparelho com fuso
errado, horas — fora do relógio do servidor, e uma subtração entre os dois viraria
idade errada ou botão travado para sempre. O cliente conta a partir do que
recebeu, com `performance.now()` (monotônico; `Date.now()` daria salto se o
sistema ajustasse a hora no meio da sessão).

O smoke test tem uma checagem para isso: se um `bornAt` vazar para o payload, ela
falha.

### Onde ficam as regras de cuidado

`shared/pet/care.ts` tem a tabela (efeito, custo, recompensa, espera). Ela é
compartilhada porque o cliente precisa mostrar preço e desabilitar botão — mas a
decisão é do servidor, em `server/pets/care-rules.ts`, que é puro e testado
(`resolveCare` recebe uma foto e devolve um veredito). O `pet.service.ts` só faz o
que depende do banco: ler, cobrar, gravar a marca da espera, tudo numa transação.

Essa divisão é o que torna o balanceamento testável: um teste roda dois dias de
descuido em um milissegundo.

### Estado no banco, não em memória

Diferente do poker (onde as mesas viviam em memória e só o saldo era persistido),
aqui **tudo** do bicho está no Postgres. Faz sentido porque a vida do bicho é
longa e o jogador entra e sai: um restart do servidor não pode zerar dias de
cuidado. O custo é uma escrita por ação, que nesta escala não é problema.

### Autenticação

JWT no header para REST (`Authorization: Bearer`) e no handshake do socket
(`socket.handshake.auth.token`). Senha com bcrypt. O socket recusa a conexão sem
token válido — testado no smoke.

### Configuração de rede (o jogo precisa abrir no celular)

`HOST=0.0.0.0` e o Vite com `host: true`. O cliente descobre o backend pelo host
da própria página (`services/backend-url.ts`), então "localhost" não vaza para o
celular, onde ele seria o próprio aparelho. Com `CORS_ORIGIN` vazio, o servidor
libera loopback, faixas privadas e Tailscale (`config/cors.ts`).

### Cliente: layout sem resolução fixa

Não existe design de 1280x720. O canvas tem o tamanho da área visível
multiplicado pela densidade da tela, e o `zoom` do Phaser o devolve ao tamanho de
CSS (`services/canvas-scale.ts`) — sem isso, o navegador amplia uma imagem menor
que a tela e tudo sai borrado. Cada cena lê as medidas em `ui/layout.ts` e se
desenha em cima delas.

Consequência para quem desenha: todo número cru pensado em pixel de CSS (44px de
toque, 600px de largura máxima) passa por `dp()` antes de ser somado ou comparado
a qualquer medida.

Telas com campo de texto (login, chocagem) são **DOM**, no overlay do
`index.html`, e não canvas: é o que dá teclado nativo no celular. Misturar as
duas coisas numa tela só as coloca em sistemas de coordenadas diferentes e elas
se sobrepõem quando o canvas é letterboxed.

### Empacotamento futuro condiciona o cliente

O plano é Capacitor (Android/iOS) e Electron depois. Por isso nada de caminho
absoluto de servidor no código, nada de API só de navegador desktop, e os alvos
de toque com no mínimo 44px de CSS.

## Arte

**Ainda não chegou.** O jogo é jogável sem ela: `ui/pet-sprite.ts` desenha o bicho
em formas quando a textura não existe, e é o único arquivo que sabe da diferença.
`config/assets.ts` é o manifesto — acrescentar uma imagem é colocar o arquivo em
`public/assets/` e escrever uma linha lá.

`expectedPetImages()` já monta a lista de nomes esperados
(`pet/<espécie>-<estágio>.png`), mas está fora de `IMAGE_ASSETS` de propósito:
carregar arquivo que não existe enche o console de 404 e atrasa a abertura.

Nomes, tamanhos recomendados e o caso de spritesheet estão em
`packages/client/public/assets/README.md`.

## Estado atual

Funciona ponta a ponta:

- conta (cadastro/login), sessão guardada, socket autenticado;
- chocar um ovo escolhendo espécie e nome;
- cinco medidores caindo em tempo real, com o bicho vivendo offline;
- alimentar, brincar, dar banho, remédio, dormir/acordar — com custo, recompensa
  e espera, tudo validado no servidor;
- crescimento de ovo a adulto, com aviso na tela quando muda de estágio;
- jardim com os bichos dos outros jogadores e o mimo entre eles;
- moedas ganhas e gastas, sincronizadas em todas as abas abertas.

Ainda não existe: som, loja, itens, mais de um bicho por conta, ranking, e a arte.

### Se voltar a dar "Cannot find module '@patch/shared'"

É o npm workspaces no Windows: o link em `node_modules/@patch/shared` some
quando um `npm install` roda de dentro de um pacote em vez da raiz. Rode
`npm install` na raiz de novo. O client não depende disso em tempo de execução —
o Vite resolve o alias direto para o fonte (`vite.config.ts`).
