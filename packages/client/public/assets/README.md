# Assets

**Estado: só as telas de entrada têm arte** (`ui/logo.webp`, `ui/plank.webp`,
`ui/backdrop.webp` e `ui/menu-backdrop.webp`).
O resto o jogo desenha em formas — `src/ui/pet-sprite.ts` para o bicho,
`src/ui/backdrop.ts` para o cenário, `src/ui/brand.ts` para o letreiro. Isso é de
propósito: dá para jogar, sentir o ritmo dos medidores e testar no celular antes
de a arte inteira entrar, e depois trocar peça por peça.

## Como entra uma imagem

1. Coloque o arquivo na pasta certa (abaixo).
2. Acrescente uma linha em `src/config/assets.ts`, em `IMAGE_ASSETS`.

Só isso. Nenhuma cena muda: elas perguntam `hasTexture()` e usam o desenho
provisório enquanto a resposta for não.

## Pastas

| Pasta   | O que vai nela | Versionado |
| ------- | -------------- | ---------- |
| `pet/`  | Os bichos, um desenho por espécie e estágio | sim |
| `room/` | Fundo do quarto/jardim (dia e noite) | sim |
| `ui/`   | Letreiro, fundo das telas de entrada, botões, molduras, ícones | sim |
| `audio/`| Música e efeitos | **não** (ver abaixo) |

## `ui/` — o que já está lá

| Arquivo              | Chave              | Onde aparece |
| -------------------- | ------------------ | ------------ |
| `logo.webp`          | `ui-logo`          | Carregamento, menu e — por `<img>` — login e chocagem |
| `plank.webp`         | `ui-plank`         | A tábua com a frase do jogo, embaixo do letreiro |
| `backdrop.webp`      | `ui-backdrop`      | Fundo da tela de carregamento |
| `menu-backdrop.webp` | `ui-menu-backdrop` | Fundo do menu inicial |

A tábua é **recortada na margem transparente** antes de virar `.webp`: o código
posiciona a frase por fração do tamanho da imagem, e margem vazia sobrando
desloca o texto. Se a arte da placa mudar, dois conjuntos de números em
`src/ui/brand.ts` precisam ser remedidos na imagem nova:

- `PLANK_TEXT_AREA` — a área plana de madeira, sem as folhas das pontas;
- `PLANK_ARC` — o arco da face clara, que a frase acompanha letra a letra;
- `PLANK_FACE` — onde passa o meio da madeira no ponto mais alto do arco, e
  quanta altura de letra cabe ali.

Os dois fundos são pinturas deitadas (3:2). No celular em pé o enquadramento
corta as laterais para cobrir a tela sem deformar a arte — quem desenhar um
cenário novo deve deixar o que importa perto do centro.

**Converta para `.webp` antes de versionar.** O letreiro sai de 630 KB para
120 KB e o fundo de 2,3 MB para 255 KB, sem diferença visível — e são os
primeiros arquivos que o celular baixa. Qualidade 0,86–0,92 basta; o tamanho de
origem não precisa passar de ~1600px no maior lado (o canvas nunca desenha mais
do que isso, nem em tela de densidade 3).

O `<img>` das telas de DOM aponta para o mesmo arquivo do canvas — uma imagem só,
dois consumidores.

## `pet/` — nomes dos arquivos

O código monta a chave sozinho: `pet-<espécie>-<estágio>`. Os arquivos seguem o
mesmo padrão, com o `spriteKey` da espécie (`shared/pet/species.ts`):

```
pet/sprout-egg.png    pet/sprout-baby.png   pet/sprout-child.png
pet/sprout-teen.png   pet/sprout-adult.png
pet/ember-*.png
pet/pebble-*.png
```

Espécies: `sprout`, `ember`, `pebble`. Estágios: `egg`, `baby`, `child`, `teen`,
`adult`. Não precisa ter todos de uma vez — o que faltar cai no provisório.

Recomendações para o desenho:

- **PNG com fundo transparente**, quadrado, olhando para a frente.
- **512×512** é folgado o bastante para tela de densidade 3 sem pesar no celular.
- O bicho cresce na tela pela escala do estágio (`shared/pet/stage.ts`), então os
  cinco arquivos podem ter o mesmo tamanho de canvas.
- Se a arte for pixel art, ligue `pixelArt: true` em `src/config/game-config.ts` —
  senão o antialias borra as bordas.

Se um dia um bicho precisar de mais de uma pose (dormindo, doente, comendo), o
caminho é uma spritesheet por estágio; `ui/pet-sprite.ts` é o único arquivo que
muda, porque é ele que decide entre imagem e desenho.

## `audio/` — **não** versionado

Trilha e efeitos costumam vir de pacotes licenciados para uso em projetos e não
para redistribuição, e os originais são grandes demais para o git guardar cada
versão. Ficam locais; num clone novo esta pasta vem vazia e o jogo roda sem som.

Converta antes de copiar — `.wav` de dezenas de MB travam o carregamento no
celular:

```bash
ffmpeg -i "tema.wav" -c:a libvorbis -b:a 112k tema.ogg
ffmpeg -i "tema.wav" -c:a libmp3lame -b:a 128k tema.mp3
```

O `.ogg` cobre Chrome, Firefox e Android; o `.mp3` é o fallback do Safari. Nomes
com espaço e maiúscula viram URL no navegador — renomeie para minúsculas com
hífen ao converter.

## Créditos

A lista precisa existir antes do lançamento, mesmo para licenças que não exigem
atribuição. Preencher conforme a arte for entrando.
