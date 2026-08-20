import Phaser from 'phaser';

/**
 * Uma linha de texto assentada sobre um arco.
 *
 * Existe por causa da tábua da frase do jogo (`ui/brand.ts`): a madeira é
 * arqueada, e uma linha reta em cima dela sobe nas pontas e parece flutuar fora
 * da placa. O Phaser não tem texto curvo — o jeito é medir letra por letra e
 * posicionar cada uma na curva, inclinada pela tangente.
 *
 * O custo é um objeto de texto por letra, cada um com a sua textura. Aceitável
 * porque isto é montado uma vez por desenho da tela (e de novo quando o aparelho
 * gira), nunca a cada quadro — e são algumas dezenas de letras, não um parágrafo.
 * Para texto que muda toda hora, use um `Text` comum.
 *
 * A curva é uma parábola com o ponto mais alto em `apex` e queda `sag` na ponta
 * esquerda: os dois números saem da medida da arte, e não de tentativa e erro.
 * A linha nasce com o **ponto mais alto** em y = 0, e não com o meio da caixa:
 * é ele que precisa cair sobre o centro da madeira, e as pontas descem junto com
 * a tábua a partir dali.
 * O espaçamento entre letras é a soma das larguras individuais, então o kerning
 * do par se perde — imperceptível numa frase curta, e é o preço de curvar.
 */
export interface CurvedTextConfig {
  text: string;
  style: Phaser.Types.GameObjects.Text.TextStyle;
  /** Onde fica o ponto mais alto, em fração da largura da linha. */
  apex: number;
  /** Quanto a ponta esquerda desce em relação ao ponto mais alto, em unidades do canvas. */
  sag: number;
}

export interface CurvedText {
  /** As letras, centradas na horizontal e apoiadas em y = 0 no ponto mais alto. */
  container: Phaser.GameObjects.Container;
  /** Largura da linha inteira. */
  width: number;
  /** Altura de uma letra. A do container inclui a curva; esta, não. */
  lineHeight: number;
  /**
   * Refaz a curva com outra queda, sem recriar as letras.
   *
   * Serve para compensar uma escala aplicada depois: encolher o container
   * encolhe a curva junto, mas a superfície onde a linha se apoia continua do
   * mesmo tamanho — então a queda tem que ser dividida pela escala.
   */
  setSag(sag: number): void;
}

export function createCurvedText(scene: Phaser.Scene, config: CurvedTextConfig): CurvedText {
  const { text, style, apex, sag } = config;

  const letters = [...text].map((character) =>
    scene.add.text(0, 0, character, style).setOrigin(0.5),
  );
  const widths = letters.map((letter) => letter.width);
  const width = widths.reduce((sum, value) => sum + value, 0);
  const lineHeight = letters.reduce((tallest, letter) => Math.max(tallest, letter.height), 0);

  // Queda em u = 0 vale `sag`; daí sai o coeficiente da parábola, e a mesma
  // conta dá a queda em qualquer ponto — inclusive à direita do topo, onde a
  // distância até ele é menor e a queda, proporcionalmente, também.
  const drop = (u: number, currentSag: number): number => currentSag * ((u - apex) / apex) ** 2;
  // Inclinação da letra: a derivada da curva no ponto, em radianos.
  const slope = (u: number, currentSag: number): number =>
    Math.atan2((2 * currentSag * (u - apex)) / apex ** 2, width);

  const container = scene.add.container(0, 0, letters);

  const place = (currentSag: number): void => {
    let cursor = 0;
    let top = Infinity;
    let bottom = -Infinity;

    letters.forEach((letter, index) => {
      const center = cursor + widths[index] / 2;
      cursor += widths[index];

      const u = width > 0 ? center / width : 0;
      const y = drop(u, currentSag);
      // Só o x é deslocado para o meio: na vertical o zero já é o ponto mais
      // alto da curva, que é onde quem chama quer encostar a linha.
      letter.setPosition(center - width / 2, y);
      letter.setRotation(slope(u, currentSag));

      top = Math.min(top, y - letter.height / 2);
      bottom = Math.max(bottom, y + letter.height / 2);
    });

    container.setSize(width, bottom - top);
  };

  place(sag);

  return { container, width, lineHeight, setSag: place };
}
