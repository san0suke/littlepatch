import Phaser from 'phaser';
import {
  PET_SPECIES,
  stageDefinition,
  type PetMood,
  type PetSpeciesId,
  type PetStage,
} from '@patch/shared';
import { hasTexture, petTextureKey } from '../config/assets.js';
import { dp, type Layout } from './layout.js';

/**
 * O bicho na tela — e o ponto de troca entre o desenho provisório e a arte.
 *
 * Se existir a textura `pet-<espécie>-<estágio>` (ver `config/assets.ts`), é ela
 * que aparece. Se não, o bicho é desenhado com formas e as cores da espécie.
 * Nenhuma cena precisa saber qual dos dois está em uso: todas pedem um
 * `PetSprite` e recebem algo com `setMood()` e `setStage()`.
 *
 * O provisório não é um quadrado cinza de propósito. Sem arte ainda dá para
 * jogar, sentir o ritmo dos medidores e testar no celular — e quando as imagens
 * chegarem, o que muda é uma linha de manifesto, não a cena.
 */
export interface PetSprite {
  container: Phaser.GameObjects.Container;
  setMood(mood: PetMood): void;
  setStage(stage: PetStage): void;
  /** Pulinho de reação a um cuidado. */
  react(): void;
}

export function createPetSprite(
  scene: Phaser.Scene,
  layout: Layout,
  config: { x: number; y: number; species: PetSpeciesId; stage: PetStage; size: number },
): PetSprite {
  const species = PET_SPECIES[config.species];
  const container = scene.add.container(config.x, config.y);

  let stage = config.stage;
  let mood: PetMood = 'happy';

  // Um `Image` quando há arte; um `Graphics` quando não há. As duas pontas
  // respondem ao mesmo `redraw`.
  const image = scene.add.image(0, 0, petTextureKey(config.species, stage)).setVisible(false);
  const drawing = scene.add.graphics();
  const face = scene.add.graphics();
  container.add([image, drawing, face]);

  const redraw = (): void => {
    const scale = stageDefinition(stage).scale;
    const size = config.size * scale;
    const key = petTextureKey(config.species, stage);

    if (hasTexture(scene, key)) {
      image.setTexture(key).setVisible(true).setDisplaySize(size, size);
      drawing.setVisible(false);
      face.setVisible(false);
      image.setAlpha(mood === 'sick' ? 0.75 : 1);
      return;
    }

    image.setVisible(false);
    drawing.setVisible(true).clear();
    face.setVisible(true).clear();

    if (stage === 'egg') {
      drawEgg(drawing, size, species.placeholder);
      return;
    }

    drawBody(drawing, size, species.placeholder, mood);
    drawFace(face, size, mood);
  };

  redraw();

  // Respiração: sobe e desce de leve, para o bicho não parecer um adesivo.
  scene.tweens.add({
    targets: container,
    y: config.y - dp(layout, 4),
    duration: 1800,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  return {
    container,
    setMood(next) {
      if (next !== mood) {
        mood = next;
        redraw();
      }
    },
    setStage(next) {
      if (next !== stage) {
        stage = next;
        redraw();
      }
    },
    react() {
      scene.tweens.add({
        targets: container,
        scale: 1.08,
        duration: 140,
        yoyo: true,
        ease: 'Quad.easeOut',
      });
    },
  };
}

type Placeholder = (typeof PET_SPECIES)[PetSpeciesId]['placeholder'];

function drawEgg(g: Phaser.GameObjects.Graphics, size: number, colors: Placeholder): void {
  const w = size * 0.62;
  const h = size * 0.8;
  g.fillStyle(0xfff8ea, 1);
  g.fillEllipse(0, 0, w, h);
  g.lineStyle(Math.max(2, size * 0.012), colors.accent, 1);
  g.strokeEllipse(0, 0, w, h);
  // Manchinhas da casca, na cor da espécie: o ovo já entrega quem vai nascer.
  g.fillStyle(colors.body, 0.55);
  g.fillCircle(-w * 0.18, h * 0.1, size * 0.05);
  g.fillCircle(w * 0.14, -h * 0.06, size * 0.038);
  g.fillCircle(w * 0.02, h * 0.24, size * 0.03);
}

function drawBody(
  g: Phaser.GameObjects.Graphics,
  size: number,
  colors: Placeholder,
  mood: PetMood,
): void {
  const w = size * 0.8;
  const h = size * 0.7;
  const dim = mood === 'sick' ? 0.75 : 1;

  // Pés, antes do corpo, para ficarem por baixo.
  g.fillStyle(colors.accent, dim);
  g.fillEllipse(-w * 0.22, h * 0.46, w * 0.26, h * 0.16);
  g.fillEllipse(w * 0.22, h * 0.46, w * 0.26, h * 0.16);

  g.fillStyle(colors.body, dim);
  g.fillEllipse(0, 0, w, h);

  // Orelhinhas.
  g.fillTriangle(-w * 0.3, -h * 0.36, -w * 0.12, -h * 0.62, -w * 0.02, -h * 0.3);
  g.fillTriangle(w * 0.3, -h * 0.36, w * 0.12, -h * 0.62, w * 0.02, -h * 0.3);

  g.fillStyle(colors.belly, dim);
  g.fillEllipse(0, h * 0.14, w * 0.5, h * 0.42);
}

function drawFace(g: Phaser.GameObjects.Graphics, size: number, mood: PetMood): void {
  const w = size * 0.8;
  const h = size * 0.7;
  const eyeY = -h * 0.1;
  const eyeX = w * 0.17;
  const eye = size * 0.035;

  g.fillStyle(0x2f3b2c, 1);

  if (mood === 'sleeping') {
    // Olhos fechados: dois traços.
    const line = Math.max(2, size * 0.014);
    g.fillRect(-eyeX - eye, eyeY, eye * 2, line);
    g.fillRect(eyeX - eye, eyeY, eye * 2, line);
  } else {
    g.fillCircle(-eyeX, eyeY, eye);
    g.fillCircle(eyeX, eyeY, eye);
  }

  const mouthY = h * 0.12;
  const mouthW = w * 0.16;
  const thickness = Math.max(2, size * 0.016);

  if (mood === 'happy') {
    // Sorriso: um arco fino, desenhado como traço.
    g.lineStyle(thickness, 0x2f3b2c, 1);
    g.beginPath();
    g.arc(0, mouthY - mouthW * 0.4, mouthW, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(160));
    g.strokePath();
  } else if (mood === 'sick' || mood === 'sad') {
    g.lineStyle(thickness, 0x2f3b2c, 1);
    g.beginPath();
    g.arc(
      0,
      mouthY + mouthW * 0.6,
      mouthW,
      Phaser.Math.DegToRad(200),
      Phaser.Math.DegToRad(340),
    );
    g.strokePath();
  } else {
    g.fillRect(-mouthW * 0.5, mouthY, mouthW, thickness);
  }
}
