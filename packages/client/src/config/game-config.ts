import Phaser from 'phaser';
import { BootScene } from '../scenes/BootScene.js';
import { LoginScene } from '../scenes/LoginScene.js';
import { MenuScene } from '../scenes/MenuScene.js';
import { HatchScene } from '../scenes/HatchScene.js';
import { RoomScene } from '../scenes/RoomScene.js';
import { GardenScene } from '../scenes/GardenScene.js';

/**
 * `NONE`, e não `FIT` nem `RESIZE`.
 *
 * Com uma resolução de projeto fixa o celular em pé recebe uma faixa letterboxed
 * no meio da tela — texto minúsculo e duas tarjas ocupando a maior parte do
 * aparelho. O `RESIZE` resolve isso, mas dimensiona o canvas em pixels de CSS e
 * ignora o `zoom`: numa tela de densidade 2 ou 3 o jogo desenha menos pixels do
 * que a tela tem e o navegador amplia o resultado, que é o que faz tudo parecer
 * de baixa resolução.
 *
 * Então o tamanho é controlado por `services/canvas-scale.ts`, que a cada
 * mudança da área visível chama `scale.resize()` com o tamanho já multiplicado
 * pela densidade. As cenas se redesenham a partir das medidas reais
 * (`ui/layout.ts`), então retrato e paisagem recebem layouts próprios.
 *
 * É uma função, e não uma constante: as medidas iniciais só valem depois que o
 * `--app-height` foi calculado, no começo do `main.ts`.
 */
export function createGameConfig(): Phaser.Types.Core.GameConfig {
  const ratio = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
  const visual = window.visualViewport;
  const width = visual ? visual.width : window.innerWidth;
  const height = visual ? visual.height : window.innerHeight;

  return {
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#bfe3f2',
    render: {
      /*
       * Precisa vir escrito: o Phaser liga o modo pixel art sozinho sempre que o
       * zoom é diferente de 1 — e aqui ele nunca é, porque é justamente o zoom
       * que devolve o canvas ao tamanho de CSS. Ligado, ele desliga o antialias
       * e deixa as barras e o contorno do bicho serrilhados.
       *
       * Se a arte que vier for pixel art de verdade, este é o lugar de ligar.
       */
      pixelArt: false,
    },
    scale: {
      mode: Phaser.Scale.NONE,
      width: Math.round(width * ratio),
      height: Math.round(height * ratio),
      zoom: 1 / ratio,
    },
    scene: [BootScene, LoginScene, MenuScene, HatchScene, RoomScene, GardenScene],
  };
}
