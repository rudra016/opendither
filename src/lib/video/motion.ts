/**
 * Temporal luminance buffer for video stability.
 * Ordered dither alone is stable; error-diffusion still benefits from EMA.
 * Motion map drives ASCII detail boost.
 */

export class TemporalBuffer {
  private prev: Float32Array | null = null
  private motion: Float32Array | null = null
  private w = 0
  private h = 0

  reset() {
    this.prev = null
    this.motion = null
    this.w = 0
    this.h = 0
  }

  /**
   * Blend current luma with previous frame.
   * Returns smoothed luma (mutates a copy) and fills motion magnitudes 0–1.
   */
  apply(
    luma: Float32Array,
    width: number,
    height: number,
    smooth: number,
  ): { luma: Float32Array; motion: Float32Array } {
    const n = width * height
    if (this.w !== width || this.h !== height || !this.prev || !this.motion) {
      this.w = width
      this.h = height
      this.prev = new Float32Array(luma)
      this.motion = new Float32Array(n)
      return { luma: new Float32Array(luma), motion: this.motion }
    }

    const out = new Float32Array(n)
    const a = Math.min(0.95, Math.max(0, smooth))

    for (let i = 0; i < n; i++) {
      const curr = luma[i]
      const prev = this.prev[i]
      const delta = Math.abs(curr - prev)
      this.motion[i] = Math.min(1, delta / 48)
      // Less smoothing where motion is high so action stays crisp
      const localSmooth = a * (1 - this.motion[i] * 0.7)
      out[i] = prev * localSmooth + curr * (1 - localSmooth)
      this.prev[i] = out[i]
    }

    return { luma: out, motion: this.motion }
  }
}
