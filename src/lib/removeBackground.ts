export type BgRemovalProgress = {
  phase: 'prepare' | 'api' | 'flatten'
  key: string
  current: number
  total: number
}

export type BgRemovalProgressCallback = (p: BgRemovalProgress) => void

const FLATTEN_BG = '#ffffff'
const REMOVE_BG_URL = 'https://api.remove.bg/v1.0/removebg'

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Image load failed'))
    img.src = url
  })
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Export failed'))),
      'image/png',
    )
  })
}

/** Rasterize image to an opaque PNG (internal export before API). */
export async function rasterizeImage(imageUrl: string): Promise<Blob> {
  const img = await loadImage(imageUrl)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = FLATTEN_BG
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0)
  return canvasToBlob(canvas)
}

/** Composite a transparent cutout onto a solid background. */
export async function flattenOntoBackground(
  cutoutBlob: Blob,
  background = FLATTEN_BG,
): Promise<Blob> {
  const url = URL.createObjectURL(cutoutBlob)
  try {
    const img = await loadImage(url)
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = background
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0)
    return canvasToBlob(canvas)
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function runRemoveBg(input: Blob): Promise<Blob> {
  const apiKey = import.meta.env.VITE_REMOVE_BG_API_KEY
  if (!apiKey) {
    throw new Error(
      'Missing VITE_REMOVE_BG_API_KEY. Add it to your .env file and restart the dev server.',
    )
  }

  const formData = new FormData()
  formData.append('size', 'auto')
  formData.append('image_file', input, 'image.png')

  const response = await fetch(REMOVE_BG_URL, {
    method: 'POST',
    headers: { 'X-Api-Key': apiKey },
    body: formData,
  })

  if (!response.ok) {
    let detail = response.statusText
    try {
      const err = (await response.json()) as {
        errors?: { title?: string }[]
      }
      detail = err.errors?.[0]?.title ?? detail
    } catch {
      /* non-JSON error body */
    }
    throw new Error(`${response.status}: ${detail}`)
  }

  return response.blob()
}

/**
 * 1. Rasterize source to opaque PNG
 * 2. remove.bg API on that export
 * 3. Flatten cutout onto white for clean dithering
 */
export async function removeBackgroundFromImage(
  imageUrl: string,
  onProgress?: BgRemovalProgressCallback,
): Promise<Blob> {
  onProgress?.({ phase: 'prepare', key: 'raster', current: 0, total: 1 })

  const raster = await rasterizeImage(imageUrl)

  onProgress?.({ phase: 'api', key: 'removebg', current: 0, total: 1 })
  const cutout = await runRemoveBg(raster)

  onProgress?.({ phase: 'flatten', key: 'flatten', current: 0, total: 1 })
  return flattenOntoBackground(cutout)
}

export function formatBgProgress(p: BgRemovalProgress | null): string {
  if (!p) return 'Removing background…'
  if (p.phase === 'prepare') return 'Preparing image…'
  if (p.phase === 'api') return 'Removing background…'
  if (p.phase === 'flatten') return 'Flattening on white…'
  return 'Removing background…'
}
