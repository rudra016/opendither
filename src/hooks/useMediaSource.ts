import { useCallback, useEffect, useRef, useState } from 'react'
import { cropToBlob, type CropRect } from '../lib/crop'
import type { MediaKind } from '../lib/types'

export interface MediaSource {
  kind: MediaKind
  url: string
  name: string
  width: number
  height: number
  /** True when PNG has transparency (e.g. after background removal). */
  hasAlpha?: boolean
}

export interface PendingImage {
  url: string
  name: string
  width: number
  height: number
}

export function useMediaSource() {
  const [source, setSource] = useState<MediaSource | null>(null)
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const sourceUrlRef = useRef<string | null>(null)
  const pendingUrlRef = useRef<string | null>(null)

  const revokeSource = useCallback(() => {
    if (sourceUrlRef.current) {
      URL.revokeObjectURL(sourceUrlRef.current)
      sourceUrlRef.current = null
    }
  }, [])

  const revokePending = useCallback(() => {
    if (pendingUrlRef.current) {
      URL.revokeObjectURL(pendingUrlRef.current)
      pendingUrlRef.current = null
    }
  }, [])

  const clear = useCallback(() => {
    revokeSource()
    revokePending()
    setSource(null)
    setPendingImage(null)
    setError(null)
  }, [revokeSource, revokePending])

  useEffect(
    () => () => {
      revokeSource()
      revokePending()
    },
    [revokeSource, revokePending],
  )

  const commitSource = useCallback(
    (next: MediaSource) => {
      revokeSource()
      sourceUrlRef.current = next.url
      setSource(next)
      setPendingImage(null)
      pendingUrlRef.current = null
    },
    [revokeSource],
  )

  const loadFile = useCallback(
    async (file: File) => {
      setError(null)
      const isVideo = file.type.startsWith('video/')
      const isImage = file.type.startsWith('image/')
      if (!isVideo && !isImage) {
        setError('Please drop an image or video file.')
        return
      }

      const url = URL.createObjectURL(file)

      try {
        if (isImage) {
          const img = await loadImage(url)
          revokePending()
          pendingUrlRef.current = url
          setPendingImage({
            url,
            name: file.name,
            width: img.naturalWidth,
            height: img.naturalHeight,
          })
        } else {
          const meta = await loadVideoMeta(url)
          revokePending()
          commitSource({
            kind: 'video',
            url,
            name: file.name,
            width: meta.width,
            height: meta.height,
          })
        }
      } catch {
        setError('Could not read that file.')
        URL.revokeObjectURL(url)
      }
    },
    [commitSource, revokePending],
  )

  const applyCrop = useCallback(
    async (crop: CropRect) => {
      if (!pendingImage) return
      setError(null)

      try {
        const img = await loadImage(pendingImage.url)
        const isFull =
          crop.x <= 0.5 &&
          crop.y <= 0.5 &&
          crop.width >= pendingImage.width - 1 &&
          crop.height >= pendingImage.height - 1

        if (isFull) {
          const url = pendingImage.url
          pendingUrlRef.current = null
          commitSource({
            kind: 'image',
            url,
            name: pendingImage.name,
            width: pendingImage.width,
            height: pendingImage.height,
          })
          return
        }

        const blob = await cropToBlob(img, crop)
        const url = URL.createObjectURL(blob)
        const base = pendingImage.name.replace(/\.[^.]+$/, '')
        revokePending()
        commitSource({
          kind: 'image',
          url,
          name: `${base}-crop.png`,
          width: Math.round(crop.width),
          height: Math.round(crop.height),
        })
      } catch {
        setError('Could not crop that image.')
      }
    },
    [pendingImage, commitSource, revokePending],
  )

  const skipCrop = useCallback(() => {
    if (!pendingImage) return
    const url = pendingImage.url
    pendingUrlRef.current = null
    commitSource({
      kind: 'image',
      url,
      name: pendingImage.name,
      width: pendingImage.width,
      height: pendingImage.height,
    })
  }, [pendingImage, commitSource])

  const cancelCrop = useCallback(() => {
    revokePending()
    setPendingImage(null)
    setError(null)
  }, [revokePending])

  const replaceImage = useCallback(
    async (blob: Blob, opts: { nameSuffix?: string; hasAlpha?: boolean } = {}) => {
      if (!source || source.kind !== 'image') return false
      setError(null)

      const previewUrl = URL.createObjectURL(blob)
      try {
        const img = await loadImage(previewUrl)
        URL.revokeObjectURL(previewUrl)

        const url = URL.createObjectURL(blob)
        const base = source.name.replace(/\.[^.]+$/, '')
        const suffix = opts.nameSuffix ?? '-nobg'
        commitSource({
          kind: 'image',
          url,
          name: `${base}${suffix}.png`,
          width: img.naturalWidth,
          height: img.naturalHeight,
          hasAlpha: opts.hasAlpha ?? false,
        })
        return true
      } catch {
        URL.revokeObjectURL(previewUrl)
        setError('Could not apply that image.')
        return false
      }
    },
    [source, commitSource],
  )

  return {
    source,
    pendingImage,
    error,
    loadFile,
    applyCrop,
    skipCrop,
    cancelCrop,
    replaceImage,
    clear,
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image'))
    img.src = url
  })
}

function loadVideoMeta(
  url: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      resolve({
        width: video.videoWidth,
        height: video.videoHeight,
      })
    }
    video.onerror = () => reject(new Error('video'))
    video.src = url
  })
}
