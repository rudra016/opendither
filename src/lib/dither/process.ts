import { PALETTES, quantizeToPalette } from '../palette'
import type { DitherAlgorithm, PaletteId, ProcessSettings, Rgb } from '../types'
import { bayerThreshold } from './bayer'
import { clusteredThreshold, hashNoise } from './matrices'

export function toLuma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

export function applyTone(
  luma: number,
  contrast: number,
  brightness: number,
  invert: boolean,
): number {
  let v = luma / 255
  v = (v - 0.5) * contrast + 0.5 + brightness
  v = Math.min(1, Math.max(0, v))
  if (invert) v = 1 - v
  return v * 255
}

function writePixel(
  out: Uint8ClampedArray,
  i: number,
  color: Rgb,
  alpha: number,
) {
  out[i] = color.r
  out[i + 1] = color.g
  out[i + 2] = color.b
  out[i + 3] = alpha
}

type KernelTap = readonly [dx: number, dy: number, weight: number]

function errorDiffuse(
  luma: Float32Array,
  width: number,
  height: number,
  palette: Rgb[],
  out: Uint8ClampedArray,
  alpha: Uint8ClampedArray,
  kernel: readonly KernelTap[],
  divisor: number,
) {
  const buf = new Float32Array(luma)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      const old = buf[idx]
      const { color, quantized } = quantizeToPalette(old, palette)
      const err = old - quantized
      writePixel(out, idx * 4, color, alpha[idx])

      for (const [dx, dy, w] of kernel) {
        const nx = x + dx
        const ny = y + dy
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          buf[ny * width + nx] += (err * w) / divisor
        }
      }
    }
  }
}

/** Atkinson distributes 6/8 of the error (not a standard divisor kernel). */
function atkinson(
  luma: Float32Array,
  width: number,
  height: number,
  palette: Rgb[],
  out: Uint8ClampedArray,
  alpha: Uint8ClampedArray,
) {
  const buf = new Float32Array(luma)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      const old = buf[idx]
      const { color, quantized } = quantizeToPalette(old, palette)
      const err = (old - quantized) / 8
      writePixel(out, idx * 4, color, alpha[idx])

      if (x + 1 < width) buf[idx + 1] += err
      if (x + 2 < width) buf[idx + 2] += err
      if (y + 1 < height) {
        if (x > 0) buf[idx + width - 1] += err
        buf[idx + width] += err
        if (x + 1 < width) buf[idx + width + 1] += err
      }
      if (y + 2 < height) buf[idx + width * 2] += err
    }
  }
}

type ThresholdFn = (x: number, y: number) => number

function orderedDither(
  luma: Float32Array,
  width: number,
  height: number,
  palette: Rgb[],
  out: Uint8ClampedArray,
  alpha: Uint8ClampedArray,
  thresholdAt: ThresholdFn | null,
) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      let v = luma[idx]

      if (thresholdAt) {
        const levels = palette.length
        if (levels === 2) {
          v = v < thresholdAt(x, y) * 255 ? 0 : 255
        } else {
          const step = 255 / (levels - 1)
          const t = (thresholdAt(x, y) - 0.5) * step
          v = Math.min(255, Math.max(0, v + t))
        }
      } else {
        v = v < 128 ? 0 : 255
      }

      const { color } = quantizeToPalette(v, palette)
      writePixel(out, idx * 4, color, alpha[idx])
    }
  }
}

const KERNELS: Partial<
  Record<DitherAlgorithm, { kernel: readonly KernelTap[]; divisor: number }>
> = {
  'floyd-steinberg': {
    divisor: 16,
    kernel: [
      [1, 0, 7],
      [-1, 1, 3],
      [0, 1, 5],
      [1, 1, 1],
    ],
  },
  jarvis: {
    divisor: 48,
    kernel: [
      [1, 0, 7],
      [2, 0, 5],
      [-2, 1, 3],
      [-1, 1, 5],
      [0, 1, 7],
      [1, 1, 5],
      [2, 1, 3],
      [-2, 2, 1],
      [-1, 2, 3],
      [0, 2, 5],
      [1, 2, 3],
      [2, 2, 1],
    ],
  },
  stucki: {
    divisor: 42,
    kernel: [
      [1, 0, 8],
      [2, 0, 4],
      [-2, 1, 2],
      [-1, 1, 4],
      [0, 1, 8],
      [1, 1, 4],
      [2, 1, 2],
      [-2, 2, 1],
      [-1, 2, 2],
      [0, 2, 4],
      [1, 2, 2],
      [2, 2, 1],
    ],
  },
  burkes: {
    divisor: 32,
    kernel: [
      [1, 0, 8],
      [2, 0, 4],
      [-2, 1, 2],
      [-1, 1, 4],
      [0, 1, 8],
      [1, 1, 4],
      [2, 1, 2],
    ],
  },
  sierra: {
    divisor: 32,
    kernel: [
      [1, 0, 5],
      [2, 0, 3],
      [-2, 1, 2],
      [-1, 1, 4],
      [0, 1, 5],
      [1, 1, 4],
      [2, 1, 2],
      [-1, 2, 2],
      [0, 2, 3],
      [1, 2, 2],
    ],
  },
  'sierra-2row': {
    divisor: 16,
    kernel: [
      [1, 0, 4],
      [2, 0, 3],
      [-2, 1, 1],
      [-1, 1, 2],
      [0, 1, 3],
      [1, 1, 2],
      [2, 1, 1],
    ],
  },
  'sierra-lite': {
    divisor: 4,
    kernel: [
      [1, 0, 2],
      [-1, 1, 1],
      [0, 1, 1],
    ],
  },
  'false-fs': {
    divisor: 8,
    kernel: [
      [1, 0, 3],
      [0, 1, 3],
      [1, 1, 2],
    ],
  },
}

function thresholdFor(algorithm: DitherAlgorithm): ThresholdFn | null {
  switch (algorithm) {
    case 'bayer-2':
      return (x, y) => bayerThreshold(x, y, 2)
    case 'bayer-4':
      return (x, y) => bayerThreshold(x, y, 4)
    case 'bayer-8':
      return (x, y) => bayerThreshold(x, y, 8)
    case 'bayer-16':
      return (x, y) => bayerThreshold(x, y, 16)
    case 'clustered-4':
      return (x, y) => clusteredThreshold(x, y, 4)
    case 'clustered-8':
      return (x, y) => clusteredThreshold(x, y, 8)
    case 'random':
      return (x, y) => hashNoise(x, y)
    case 'threshold':
      return null
    default:
      return null
  }
}

export interface PixelFrame {
  width: number
  height: number
  /** Pre-tone luminance 0–255, length width*height */
  luma: Float32Array
  alpha: Uint8ClampedArray
}

/** Extract luminance from ImageData with tone controls. */
export function extractLuma(
  imageData: ImageData,
  settings: Pick<ProcessSettings, 'contrast' | 'brightness' | 'invert'>,
): PixelFrame {
  const { width, height, data } = imageData
  const luma = new Float32Array(width * height)
  const alpha = new Uint8ClampedArray(width * height)

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const raw = toLuma(data[i], data[i + 1], data[i + 2])
    luma[p] = applyTone(
      raw,
      settings.contrast,
      settings.brightness,
      settings.invert,
    )
    alpha[p] = data[i + 3]
  }

  return { width, height, luma, alpha }
}

/** Dither a luminance frame to RGBA ImageData. */
export function ditherFrame(
  frame: PixelFrame,
  algorithm: DitherAlgorithm,
  paletteId: PaletteId,
): ImageData {
  const { width, height, luma, alpha } = frame
  const out = new Uint8ClampedArray(width * height * 4)
  const palette = PALETTES[paletteId]

  if (algorithm === 'atkinson') {
    atkinson(luma, width, height, palette, out, alpha)
  } else if (KERNELS[algorithm]) {
    const { kernel, divisor } = KERNELS[algorithm]!
    errorDiffuse(luma, width, height, palette, out, alpha, kernel, divisor)
  } else {
    orderedDither(
      luma,
      width,
      height,
      palette,
      out,
      alpha,
      thresholdFor(algorithm),
    )
  }

  return new ImageData(out, width, height)
}

/** Full pixel-dither pipeline from source ImageData. */
export function processPixelDither(
  imageData: ImageData,
  settings: ProcessSettings,
): ImageData {
  const frame = extractLuma(imageData, settings)
  return ditherFrame(frame, settings.algorithm, settings.palette)
}
