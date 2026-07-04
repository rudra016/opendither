import {
  createAsciiState,
  renderAscii,
  type AsciiState,
} from './ascii/render'
import { ditherFrame, extractLuma } from './dither/process'
import type { ProcessSettings } from './types'
import { TemporalBuffer } from './video/motion'

export class DitherPipeline {
  private temporal = new TemporalBuffer()
  private asciiState: AsciiState = createAsciiState()
  private sourceCanvas: HTMLCanvasElement
  private sourceCtx: CanvasRenderingContext2D
  private outputCanvas: HTMLCanvasElement
  private outputCtx: CanvasRenderingContext2D

  constructor() {
    this.sourceCanvas = document.createElement('canvas')
    this.sourceCtx = this.sourceCanvas.getContext('2d', {
      willReadFrequently: true,
    })!
    this.outputCanvas = document.createElement('canvas')
    this.outputCtx = this.outputCanvas.getContext('2d')!
  }

  reset() {
    this.temporal.reset()
    this.asciiState = createAsciiState()
  }

  getOutputCanvas() {
    return this.outputCanvas
  }

  /**
   * Draw source into working resolution and process.
   * `scale` < 1 downsamples for speed / chunkier pixels.
   */
  process(
    source: CanvasImageSource,
    srcW: number,
    srcH: number,
    settings: ProcessSettings,
    opts: { isVideo?: boolean } = {},
  ): HTMLCanvasElement {
    const scale = Math.min(1, Math.max(0.1, settings.scale))
    const w = Math.max(1, Math.round(srcW * scale))
    const h = Math.max(1, Math.round(srcH * scale))

    if (this.sourceCanvas.width !== w || this.sourceCanvas.height !== h) {
      this.sourceCanvas.width = w
      this.sourceCanvas.height = h
    }

    this.sourceCtx.drawImage(source, 0, 0, w, h)
    const imageData = this.sourceCtx.getImageData(0, 0, w, h)
    let frame = extractLuma(imageData, settings)

    if (opts.isVideo) {
      const { luma } = this.temporal.apply(
        frame.luma,
        frame.width,
        frame.height,
        settings.temporalSmooth,
      )
      frame = { ...frame, luma }
    }

    let result: ImageData
    if (settings.mode === 'ascii') {
      result = renderAscii(
        frame.luma,
        frame.width,
        frame.height,
        settings,
        this.asciiState,
      ).imageData
    } else {
      result = ditherFrame(frame, settings.algorithm, settings.palette)
    }

    if (
      this.outputCanvas.width !== result.width ||
      this.outputCanvas.height !== result.height
    ) {
      this.outputCanvas.width = result.width
      this.outputCanvas.height = result.height
    }

    this.outputCtx.putImageData(result, 0, 0)
    return this.outputCanvas
  }
}

/** Downscale source dimensions for processing while preserving aspect. */
export function fitSize(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  const edge = Math.max(width, height)
  if (edge <= maxEdge) return { width, height }
  const s = maxEdge / edge
  return {
    width: Math.max(1, Math.round(width * s)),
    height: Math.max(1, Math.round(height * s)),
  }
}

/** Resolve working size for export. `null` maxEdge = full source. */
export function fitExportSize(
  width: number,
  height: number,
  maxEdge: number | null,
): { width: number; height: number } {
  if (maxEdge == null) return { width, height }
  return fitSize(width, height, maxEdge)
}
