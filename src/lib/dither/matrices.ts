/** Classic clustered-dot / halftone threshold matrices (0…n²−1). */

function normalize(raw: number[], size: number): Float32Array {
  const n = size * size
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    out[i] = (raw[i] + 0.5) / n
  }
  return out
}

/** 4×4 clustered-dot (spiral). */
const CLUSTERED_4 = normalize(
  [12, 5, 6, 13, 4, 0, 1, 7, 11, 3, 2, 8, 15, 10, 9, 14],
  4,
)

/** 8×8 clustered-dot. */
const CLUSTERED_8 = normalize(
  [
    24, 10, 12, 26, 35, 47, 49, 37, 8, 0, 2, 14, 45, 59, 61, 51, 22, 6, 4, 16,
    43, 57, 63, 53, 30, 20, 18, 28, 33, 41, 55, 39, 34, 46, 48, 36, 25, 11, 13,
    27, 44, 58, 60, 50, 9, 1, 3, 15, 42, 56, 62, 52, 23, 7, 5, 17, 32, 40, 54,
    38, 31, 21, 19, 29,
  ],
  8,
)

export function clusteredThreshold(
  x: number,
  y: number,
  size: 4 | 8,
): number {
  const m = size === 4 ? CLUSTERED_4 : CLUSTERED_8
  return m[(y % size) * size + (x % size)]
}

/**
 * Deterministic hash noise in 0–1 (stable per pixel, not frame-stable for video
 * if content moves — still marked unstable because it reads as grain).
 */
export function hashNoise(x: number, y: number): number {
  let n = x * 374761393 + y * 668265263
  n = (n ^ (n >>> 13)) * 1274126177
  n = n ^ (n >>> 16)
  return (n >>> 0) / 4294967295
}
