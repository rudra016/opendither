/** Recursively build a Bayer threshold matrix of size n×n (n must be power of 2). */
function buildBayer(n: number): Float32Array {
  const m = new Float32Array(n * n)
  if (n === 1) {
    m[0] = 0
    return m
  }
  const half = n / 2
  const sub = buildBayer(half)
  const offsets = [0, 2, 3, 1]
  for (let y = 0; y < half; y++) {
    for (let x = 0; x < half; x++) {
      const v = sub[y * half + x]
      for (let q = 0; q < 4; q++) {
        const ox = (q & 1) * half
        const oy = (q >> 1) * half
        m[(y + oy) * n + (x + ox)] = 4 * v + offsets[q]
      }
    }
  }
  return m
}

function normalize(matrix: Float32Array): Float32Array {
  const n = matrix.length
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    out[i] = (matrix[i] + 0.5) / n
  }
  return out
}

const CACHE = new Map<number, Float32Array>()

export function getBayerMatrix(size: 2 | 4 | 8 | 16): Float32Array {
  let m = CACHE.get(size)
  if (!m) {
    m = normalize(buildBayer(size))
    CACHE.set(size, m)
  }
  return m
}

export function bayerThreshold(
  x: number,
  y: number,
  size: 2 | 4 | 8 | 16,
): number {
  const m = getBayerMatrix(size)
  return m[(y % size) * size + (x % size)]
}
