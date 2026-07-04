export interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

export type AspectPreset = 'free' | '1:1' | '4:3' | '16:9' | '3:2' | 'original'

export function aspectRatio(
  preset: AspectPreset,
  imageWidth: number,
  imageHeight: number,
): number | null {
  switch (preset) {
    case 'free':
      return null
    case '1:1':
      return 1
    case '4:3':
      return 4 / 3
    case '16:9':
      return 16 / 9
    case '3:2':
      return 3 / 2
    case 'original':
      return imageWidth / imageHeight
  }
}

/** Largest centered crop of `ratio` that fits inside the image. */
export function defaultCrop(
  imageWidth: number,
  imageHeight: number,
  ratio: number | null = null,
): CropRect {
  if (ratio == null) {
    return { x: 0, y: 0, width: imageWidth, height: imageHeight }
  }

  const imageRatio = imageWidth / imageHeight
  let width: number
  let height: number
  if (imageRatio > ratio) {
    height = imageHeight
    width = height * ratio
  } else {
    width = imageWidth
    height = width / ratio
  }

  return {
    x: (imageWidth - width) / 2,
    y: (imageHeight - height) / 2,
    width,
    height,
  }
}

export function clampCrop(
  crop: CropRect,
  imageWidth: number,
  imageHeight: number,
  minSize = 32,
): CropRect {
  let { x, y, width, height } = crop
  width = Math.min(imageWidth, Math.max(minSize, width))
  height = Math.min(imageHeight, Math.max(minSize, height))
  x = Math.min(imageWidth - width, Math.max(0, x))
  y = Math.min(imageHeight - height, Math.max(0, y))
  return { x, y, width, height }
}

export function applyAspect(
  crop: CropRect,
  ratio: number,
  imageWidth: number,
  imageHeight: number,
  anchor: 'center' | 'top-left' = 'center',
): CropRect {
  const cx = crop.x + crop.width / 2
  const cy = crop.y + crop.height / 2

  let width = crop.width
  let height = width / ratio
  if (height > imageHeight) {
    height = imageHeight
    width = height * ratio
  }
  if (width > imageWidth) {
    width = imageWidth
    height = width / ratio
  }

  let x: number
  let y: number
  if (anchor === 'center') {
    x = cx - width / 2
    y = cy - height / 2
  } else {
    x = crop.x
    y = crop.y
  }

  return clampCrop({ x, y, width, height }, imageWidth, imageHeight)
}

export async function cropToBlob(
  image: HTMLImageElement,
  crop: CropRect,
): Promise<Blob> {
  const width = Math.max(1, Math.round(crop.width))
  const height = Math.max(1, Math.round(crop.height))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    width,
    height,
  )

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png'),
  )
  if (!blob) throw new Error('Crop failed')
  return blob
}
