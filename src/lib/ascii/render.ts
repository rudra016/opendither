import { bayerThreshold } from '../dither/bayer'
import { PALETTES, paletteFgBg } from '../palette'
import type { ProcessSettings } from '../types'

export interface AsciiState {
  /** Previous cell luminances for hysteresis / temporal smooth */
  prevLuma: Float32Array | null
  /** Previous character indices */
  prevChars: Int16Array | null
  cols: number
  rows: number
  canvas: HTMLCanvasElement | null
  ctx: CanvasRenderingContext2D | null
}

export function createAsciiState(): AsciiState {
  return {
    prevLuma: null,
    prevChars: null,
    cols: 0,
    rows: 0,
    canvas: null,
    ctx: null,
  }
}

function ensureState(state: AsciiState, cols: number, rows: number) {
  if (state.cols !== cols || state.rows !== rows || !state.prevLuma) {
    state.cols = cols
    state.rows = rows
    state.prevLuma = new Float32Array(cols * rows)
    state.prevChars = new Int16Array(cols * rows).fill(-1)
  }
}

function sampleCell(
  luma: Float32Array,
  width: number,
  height: number,
  cx: number,
  cy: number,
  cellW: number,
  cellH: number,
): number {
  const x0 = cx * cellW
  const y0 = cy * cellH
  const x1 = Math.min(width, x0 + cellW)
  const y1 = Math.min(height, y0 + cellH)
  let sum = 0
  let n = 0
  for (let y = y0; y < y1; y++) {
    const row = y * width
    for (let x = x0; x < x1; x++) {
      sum += luma[row + x]
      n++
    }
  }
  return n > 0 ? sum / n : 0
}

function motionMagnitude(
  curr: number,
  prev: number,
): number {
  return Math.min(1, Math.abs(curr - prev) / 64)
}

/**
 * Map luminance to charset index with ordered-dither sub-levels.
 * This gives smooth gradients without temporal shimmer (Bayer is positional).
 */
function charIndexForLuma(
  luma: number,
  x: number,
  y: number,
  charsetLen: number,
  motion: number,
  motionBoost: number,
): number {
  if (charsetLen <= 1) return 0

  // Motion boost slightly increases local contrast so moving edges read sharper
  const boost = 1 + motion * motionBoost * 0.6
  let v = ((luma / 255 - 0.5) * boost + 0.5) * (charsetLen - 1)

  // Sub-character ordered dither for intermediate tones
  const frac = v - Math.floor(v)
  const t = bayerThreshold(x, y, 4)
  const idx = frac > t ? Math.ceil(v) : Math.floor(v)
  return Math.min(charsetLen - 1, Math.max(0, idx))
}

function applyHysteresis(
  nextIdx: number,
  prevIdx: number,
  currLuma: number,
  prevLuma: number,
  threshold: number,
): number {
  if (prevIdx < 0) return nextIdx
  const delta = Math.abs(currLuma - prevLuma) / 255
  if (delta < threshold) return prevIdx
  return nextIdx
}

export interface AsciiRenderResult {
  imageData: ImageData
  cols: number
  rows: number
}

/**
 * Render ASCII+dither frame with motion-aware temporal stability.
 * `luma` is width*height Float32Array (0–255).
 */
export function renderAscii(
  luma: Float32Array,
  width: number,
  height: number,
  settings: ProcessSettings,
  state: AsciiState,
): AsciiRenderResult {
  const cell = Math.max(4, Math.round(settings.cellSize))
  const cols = Math.max(1, Math.floor(width / cell))
  const rows = Math.max(1, Math.floor(height / cell))
  const outW = cols * cell
  const outH = rows * cell

  ensureState(state, cols, rows)

  const charset = settings.asciiCharset.length
    ? settings.asciiCharset
    : ' .:-=+*#%@'
  const { fg, bg } = paletteFgBg(PALETTES[settings.palette])

  if (!state.canvas || !state.ctx) {
    state.canvas = document.createElement('canvas')
    state.ctx = state.canvas.getContext('2d')!
  }
  const canvas = state.canvas
  const ctx = state.ctx
  if (canvas.width !== outW || canvas.height !== outH) {
    canvas.width = outW
    canvas.height = outH
  }

  ctx.fillStyle = `rgb(${bg.r},${bg.g},${bg.b})`
  ctx.fillRect(0, 0, outW, outH)
  ctx.fillStyle = `rgb(${fg.r},${fg.g},${fg.b})`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `600 ${Math.floor(cell * 0.95)}px "IBM Plex Mono", ui-monospace, monospace`

  const smooth = settings.temporalSmooth
  const hyst = settings.charHysteresis

  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const i = cy * cols + cx
      let cellLuma = sampleCell(luma, width, height, cx, cy, cell, cell)

      const prev = state.prevLuma![i]
      const hasPrev = state.prevChars![i] >= 0

      // Temporal EMA for stable video
      if (hasPrev && smooth > 0) {
        cellLuma = prev * smooth + cellLuma * (1 - smooth)
      }

      const motion = hasPrev ? motionMagnitude(cellLuma, prev) : 0

      let idx = charIndexForLuma(
        cellLuma,
        cx,
        cy,
        charset.length,
        motion,
        settings.motionBoost,
      )

      idx = applyHysteresis(
        idx,
        state.prevChars![i],
        cellLuma,
        prev,
        hyst,
      )

      state.prevLuma![i] = cellLuma
      state.prevChars![i] = idx

      const ch = charset[idx]
      if (ch && ch !== ' ') {
        ctx.fillText(ch, cx * cell + cell / 2, cy * cell + cell / 2 + 0.5)
      }
    }
  }

  return {
    imageData: ctx.getImageData(0, 0, outW, outH),
    cols,
    rows,
  }
}
