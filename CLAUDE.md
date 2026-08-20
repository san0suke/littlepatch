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

### O caminho até o bicho

`BootScene` (carregamento) → `LoginScene` → `MenuScene` → `RoomScene` /
`GardenScene`. O menu existe porque o jogo passou a ter mais de um lugar: cair
direto no bicho escondia o resto. Quem já tem sessão pula o login — a checagem de
token está nos dois, porque também se chega ao login pelo "sair da conta", que é
uma ação do menu.

O `GardenScene` recebe de onde veio (`scene.start('GardenScene', { from })`), senão
o "Voltar" mandaria para o quarto quem entrou pelo menu.

O menu lista também o que ainda não foi feito, marcado com "Em breve" e ainda
tocável: um item que não responde a toque parece tela travada, e esconder o que
falta faria o menu mentir sobre o tamanho do jogo.

### A tela de carregamento não é só enfeite

Ela carrega a arte (`IMAGE_ASSETS`) e se redesenha a cada arquivo que chega — o
letreiro e o cenário que ela mostra são justamente o que ela está baixando, então
sem isso a abertura inteira ficaria na versão de reserva.

A barra mostra o progresso real do carregador, mas nunca termina antes de
`MIN_SPLASH_MS`: com poucos arquivos o carregamento acaba no primeiro quadro, e
uma tela que aparece e some no mesmo piscar é pior do que não existir. O desenho
é atualizado no evento do carregador, e não no `update()` — este só começa a
rodar depois do `create()`, ou seja, depois que tudo já carregou.

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

**Chegou a das telas de entrada.** O letreiro (`ui/logo.webp`), a tábua da frase
(`ui/plank.webp`) e as duas pinturas de fundo — a estrada no carregamento
(`ui/backdrop.webp`) e o quintal no menu (`ui/menu-backdrop.webp`) — já estão em
`public/assets/`, listadas em `config/assets.ts`. Bichos, quarto e ícones ainda
não.

A tábua é medida a partir do texto, e não o contrário: a frase é sempre a mesma,
mas o corpo da letra muda com a densidade e o tamanho do aparelho. **A frase é
sempre uma linha só** — quando a tábua bate no limite (a largura da tela, ou 1,15
vez o letreiro, para a legenda não ficar maior que a marca), quem cede é o corpo
da letra. Quebrar em duas linhas descolaria o texto do arco, que é de uma linha.

A madeira é arqueada, então a frase também é (`ui/curved-text.ts`): cada letra é
um objeto posicionado sobre a mesma parábola da tábua e girado pela tangente.
Reta, ela subia nas pontas e parecia flutuar fora da placa. O custo é um objeto
de texto por letra — aceitável porque a linha é montada uma vez por desenho da
tela, nunca a cada quadro.

A frase é alinhada pelo **ponto mais alto do arco**, que é por onde passa o meio
da madeira (`PLANK_FACE`); alinhar pela caixa do texto a deixaria baixa, porque a
curva só empurra para baixo. E parece entalhada, não pintada: a letra escura é o
fundo do sulco e a sombra clara logo abaixo é a luz batendo na borda do corte.

Os números da curva (`PLANK_ARC`), da face (`PLANK_FACE`) e da área escrita
(`PLANK_TEXT_AREA`) saem de medir a imagem, não de tentativa e erro — e estão em
coordenadas do texto, que é só a faixa central da placa.

`.webp` e não `.png`: o letreiro pesa 120 KB em vez de 630 KB, e cada fundo 255 a
360 KB em vez de 2,3 MB — e é a primeira coisa que o celular baixa. Safari 14+,
Chrome, Firefox e Android leem, o que cobre tudo que roda o jogo, aqui e dentro
do Capacitor. Os originais em PNG ficam fora do repositório; o README de
`public/assets/` explica como refazer a conversão.

O jogo continua jogável sem o resto: `ui/pet-sprite.ts` desenha o bicho em formas
quando a textura não existe, `ui/backdrop.ts` faz o mesmo com o cenário e
`ui/brand.ts` com o letreiro — cada um é o único arquivo que sabe da diferença.
`config/assets.ts` é o manifesto: acrescentar uma imagem é colocar o arquivo em
`public/assets/` e escrever uma linha lá.

A fonte do canvas é uma só (`config/theme.ts`, `FONT_STACK`): o padrão do Phaser é
`Courier`, e sem apontar a fonte em cada estilo o jogo trocava de letra entre as
telas de canvas e as de DOM.

`expectedPetImages()` já monta a lista de nomes esperados
(`pet/<espécie>-<estágio>.png`), mas está fora de `IMAGE_ASSETS` de propósito:
carregar arquivo que não existe enche o console de 404 e atrasa a abertura.

Nomes, tamanhos recomendados e o caso de spritesheet estão em
`packages/client/public/assets/README.md`.

## Estado atual

Funciona ponta a ponta:

- tela de carregamento e menu inicial, com o letreiro e o cenário pintados;
- conta (cadastro/login), sessão guardada, socket autenticado;
- chocar um ovo escolhendo espécie e nome;
- cinco medidores caindo em tempo real, com o bicho vivendo offline;
- alimentar, brincar, dar banho, remédio, dormir/acordar — com custo, recompensa
  e espera, tudo validado no servidor;
- crescimento de ovo a adulto, com aviso na tela quando muda de estágio;
- jardim com os bichos dos outros jogadores e o mimo entre eles;
- moedas ganhas e gastas, sincronizadas em todas as abas abertas.

Ainda não existe: som, loja, itens, missões, configurações, mais de um bicho por
conta, ranking, e o resto da arte. O que está no menu marcado como "Em breve" é
essa lista.

### Se voltar a dar "Cannot find module '@patch/shared'"

É o npm workspaces no Windows: o link em `node_modules/@patch/shared` some
quando um `npm install` roda de dentro de um pacote em vez da raiz. Rode
`npm install` na raiz de novo. O client não depende disso em tempo de execução —
o Vite resolve o alias direto para o fonte (`vite.config.ts`).
