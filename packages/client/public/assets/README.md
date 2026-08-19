# Assets

**Estado: a arte ainda não chegou.** O jogo roda assim mesmo — cada tela desenha
uma versão provisória em formas (`src/ui/pet-sprite.ts`) quando a imagem não
existe. Isso é de propósito: dá para jogar, sentir o ritmo dos medidores e testar
no celular antes de a primeira imagem entrar, e depois trocar peça por peça.

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
| `ui/`   | Botões, molduras, ícones | sim |
| `audio/`| Música e efeitos | **não** (ver abaixo) |

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
