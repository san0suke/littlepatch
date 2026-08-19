/**
 * A paleta do jogo, em número (Phaser) e em texto (objetos de `Text`).
 *
 * As mesmas cores existem como variáveis CSS no `index.html`, para as telas de
 * formulário — que são DOM, não canvas — combinarem com o resto. Duas cópias,
 * porque não há como um `<style>` alimentar um `fillStyle` do Phaser sem custo;
 * quando uma mudar, a outra muda junto.
 */
export const COLORS = {
  sky: 0xbfe3f2,
  skyDeep: 0x8ecae0,
  grass: 0x7fbf63,
  grassDark: 0x4e8a3c,
  soil: 0x8a6244,
  bark: 0x4a3728,
  cream: 0xfdf6e3,
  bloom: 0xf2a2c0,
  sun: 0xf6c453,
  ink: 0x2f3b2c,
  danger: 0xe5695f,
  night: 0x2b3a5a,
} as const;

export const CSS_COLORS = {
  cream: '#fdf6e3',
  ink: '#2f3b2c',
  bark: '#4a3728',
  grassDark: '#4e8a3c',
  sun: '#f6c453',
  danger: '#e5695f',
  muted: '#7b8b74',
} as const;

/** Cor de cada medidor. Verde saudável, laranja atenção, vermelho urgente. */
export function meterColor(value: number): number {
  if (value <= 10) {
    return COLORS.danger;
  }
  if (value <= 30) {
    return 0xe89f4c;
  }
  return COLORS.grassDark;
}
