import type { PaletteId, Rgb } from './types'

export interface PaletteMeta {
  label: string
  colors: Rgb[]
}

/** Ordered dark → light for clean dither ramps. */
export const PALETTE_META: Record<PaletteId, PaletteMeta> = {
  mono: {
    label: 'Mono',
    colors: [
      { r: 0, g: 0, b: 0 },
      { r: 255, g: 255, b: 255 },
    ],
  },
  paper: {
    label: 'Paper',
    colors: [
      { r: 20, g: 18, b: 14 },
      { r: 245, g: 240, b: 228 },
    ],
  },
  gameboy: {
    label: 'Game Boy',
    colors: [
      { r: 15, g: 56, b: 15 },
      { r: 48, g: 98, b: 48 },
      { r: 139, g: 172, b: 15 },
      { r: 155, g: 188, b: 15 },
    ],
  },
  cga: {
    label: 'CGA',
    colors: [
      { r: 0, g: 0, b: 0 },
      { r: 85, g: 255, b: 255 },
      { r: 255, g: 85, b: 255 },
      { r: 255, g: 255, b: 255 },
    ],
  },
  sepia: {
    label: 'Sepia',
    colors: [
      { r: 28, g: 18, b: 10 },
      { r: 92, g: 58, b: 32 },
      { r: 168, g: 124, b: 72 },
      { r: 236, g: 214, b: 176 },
    ],
  },
  amber: {
    label: 'Amber',
    colors: [
      { r: 12, g: 8, b: 0 },
      { r: 120, g: 72, b: 8 },
      { r: 220, g: 148, b: 24 },
      { r: 255, g: 220, b: 120 },
    ],
  },
  phosphor: {
    label: 'Phosphor',
    colors: [
      { r: 4, g: 12, b: 4 },
      { r: 16, g: 64, b: 24 },
      { r: 48, g: 180, b: 72 },
      { r: 180, g: 255, b: 160 },
    ],
  },
  nord: {
    label: 'Nord',
    colors: [
      { r: 46, g: 52, b: 64 },
      { r: 76, g: 86, b: 106 },
      { r: 136, g: 192, b: 208 },
      { r: 236, g: 239, b: 244 },
    ],
  },
  ocean: {
    label: 'Ocean',
    colors: [
      { r: 8, g: 24, b: 40 },
      { r: 16, g: 72, b: 104 },
      { r: 48, g: 152, b: 168 },
      { r: 200, g: 236, b: 232 },
    ],
  },
  sunset: {
    label: 'Sunset',
    colors: [
      { r: 36, g: 12, b: 40 },
      { r: 148, g: 40, b: 88 },
      { r: 236, g: 108, b: 64 },
      { r: 255, g: 212, b: 140 },
    ],
  },
  cherry: {
    label: 'Cherry',
    colors: [
      { r: 28, g: 8, b: 16 },
      { r: 112, g: 24, b: 48 },
      { r: 220, g: 72, b: 104 },
      { r: 255, g: 200, b: 208 },
    ],
  },
  lavender: {
    label: 'Lavender',
    colors: [
      { r: 24, g: 16, b: 40 },
      { r: 88, g: 64, b: 140 },
      { r: 168, g: 140, b: 220 },
      { r: 236, g: 228, b: 255 },
    ],
  },
  ice: {
    label: 'Ice',
    colors: [
      { r: 12, g: 20, b: 32 },
      { r: 64, g: 104, b: 140 },
      { r: 148, g: 196, b: 220 },
      { r: 232, g: 244, b: 252 },
    ],
  },
  retro: {
    label: 'Retro',
    colors: [
      { r: 32, g: 16, b: 48 },
      { r: 240, g: 96, b: 144 },
      { r: 80, g: 220, b: 200 },
      { r: 255, g: 236, b: 180 },
    ],
  },
}

export const PALETTE_IDS = Object.keys(PALETTE_META) as PaletteId[]

export const PALETTES: Record<PaletteId, Rgb[]> = Object.fromEntries(
  PALETTE_IDS.map((id) => [id, PALETTE_META[id].colors]),
) as Record<PaletteId, Rgb[]>

export function rgbCss(c: Rgb): string {
  return `rgb(${c.r}, ${c.g}, ${c.b})`
}

export function nearestPaletteColor(luma: number, palette: Rgb[]): Rgb {
  if (palette.length === 2) {
    const mid = (luminance(palette[0]) + luminance(palette[1])) / 2
    return luma < mid ? palette[0] : palette[1]
  }

  let best = palette[0]
  let bestDist = Infinity
  for (const c of palette) {
    const d = Math.abs(luma - luminance(c))
    if (d < bestDist) {
      bestDist = d
      best = c
    }
  }
  return best
}

export function luminance(c: Rgb): number {
  return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b
}

/** Darkest / lightest colors for ASCII fg/bg. */
export function paletteFgBg(palette: Rgb[]): { fg: Rgb; bg: Rgb } {
  let bg = palette[0]
  let fg = palette[0]
  let minL = Infinity
  let maxL = -Infinity
  for (const c of palette) {
    const l = luminance(c)
    if (l < minL) {
      minL = l
      bg = c
    }
    if (l > maxL) {
      maxL = l
      fg = c
    }
  }
  return { fg, bg }
}

export function quantizeToPalette(
  luma: number,
  palette: Rgb[],
): { color: Rgb; quantized: number } {
  const color = nearestPaletteColor(luma, palette)
  return { color, quantized: luminance(color) }
}
