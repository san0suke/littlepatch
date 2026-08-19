# Little Patch — tamagotchi online

Bicho virtual 2D para navegador, com um jardim onde os bichos dos outros
jogadores aparecem. O bicho vive em tempo real: ele tem fome, sono e saudade com
o jogo fechado, e o estado é do servidor — não do aparelho. A base já está
preparada para ser empacotada depois para Android/iOS (Capacitor) e desktop
(Electron).

> O nome é provisório.

## Stack

| Parte         | Tecnologia                 |
| ------------- | -------------------------- |
| Jogo          | TypeScript + Phaser 3      |
| Bundler       | Vite                       |
| Tempo real    | Socket.IO (WebSockets)     |
| Backend       | Node.js + Express + TS     |
| Banco         | PostgreSQL + Prisma        |
| Autenticação  | JWT + bcrypt               |

A mesma do projeto de poker (`../experiment1`), de propósito: o que é
infraestrutura — escala do canvas no celular, CORS de rede local, autenticação,
contrato tipado de socket — já estava resolvido e foi reaproveitado.

## Estrutura

Monorepo com npm workspaces:

```
packages/
  shared/   @patch/shared  — medidores, decaimento, estágios, contratos de socket
  server/   @patch/server  — API REST, autenticação, servidor Socket.IO, simulação
  client/   @patch/client  — jogo em Phaser
```

O pacote `shared` é a fonte única de verdade dos contratos entre client e server:
os eventos de socket são tipados nos dois lados a partir das mesmas interfaces,
então uma mudança de payload quebra a compilação em vez de quebrar em produção.
A simulação do bicho também mora lá — o servidor a usa como autoridade e o
cliente como palpite de desenho entre um estado e outro.

## Setup

Requer Node 20+ e PostgreSQL rodando localmente.

```bash
# 1. Instalar dependências (na raiz, resolve os 3 workspaces)
npm install

# 2. Configurar o ambiente
cp .env.example .env
#    ajuste DATABASE_URL com a senha do seu Postgres e troque JWT_SECRET

# 3. Criar o banco e aplicar o schema
npm run prisma:migrate -w @patch/server -- --name init
```

## Rodando

```bash
npm run dev     # sobe server (:3000) e client (:5173) juntos
```

Abra <http://localhost:5173>, crie uma conta e choque o ovo.
Para ver o jardim funcionando, abra uma segunda aba anônima com outra conta.

### Jogando de outros aparelhos (celular, tablet, outro PC)

Ao subir, o servidor imprime os endereços de rede. Use um deles no aparelho, na
porta do cliente:

```
http://192.168.0.190:5173
```

O cliente descobre o backend a partir do host da própria página
(`src/services/backend-url.ts`), então não há nada para configurar. Com
`CORS_ORIGIN` vazio, o servidor libera origens de rede local e Tailscale.

## Comandos

```bash
npm run dev                        # server + client
npm run build                      # compila os três pacotes
npm test                           # testes de shared e server
npm run lint                       # eslint em tudo
npm run smoke -w @patch/server     # ida e volta de socket, com o servidor no ar
npm run prisma:studio -w @patch/server
```

## Como o bicho vive

- Cinco medidores de 0 a 100, todos apontando para o mesmo lado (100 é bom):
  saciedade, energia, higiene, alegria e saúde.
- Os quatro primeiros caem com o tempo; a saúde não cai sozinha — ela paga a
  conta quando os outros ficam no chão, e volta a subir quando tudo se ajeita.
- Dormir recupera energia e desacelera o resto, sem congelar nada.
- Cuidar custa e rende moeda: comida e remédio saem do bolso, brincar e dar
  banho pagam.
- O bicho envelhece de ovo a adulto e cresce na tela junto.
- No jardim dá para mimar o bicho dos outros: alegria para ele, uma moeda para
  quem visita.

**Nada disso é contado pelo cliente.** O servidor guarda os medidores e o
instante até onde eles valem, e aplica o tempo que passou em cada leitura — é o
que faz o bicho viver com o jogo fechado, sem um processo cuidando de cada conta.

## Arte

A arte ainda não entrou. O jogo desenha uma versão provisória em formas enquanto
uma imagem não existe, e trocar depois é colocar o arquivo na pasta e acrescentar
uma linha em `packages/client/src/config/assets.ts`.

Os nomes de arquivo esperados e as recomendações de tamanho estão em
[`packages/client/public/assets/README.md`](packages/client/public/assets/README.md).
