export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function exportCanvasPng(
  canvas: HTMLCanvasElement,
  filename = 'dither.png',
) {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png'),
  )
  if (!blob) throw new Error('Failed to encode PNG')
  downloadBlob(blob, filename)
}

function pickMimeType(): string {
  const candidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
  ]
  for (const t of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) {
      return t
    }
  }
  return 'video/webm'
}

export interface VideoExportOptions {
  canvas: HTMLCanvasElement
  video: HTMLVideoElement
  fps?: number
  videoBitsPerSecond?: number
  onProgress?: (t: number) => void
  signal?: AbortSignal
}

/**
 * Re-play the video, capture processed frames from `canvas`, encode to WebM.
 * Caller must update `canvas` each frame via the provided `drawFrame` callback
 * pattern — we drive the video clock and sample the canvas.
 */
export async function exportProcessedVideo(
  opts: VideoExportOptions & {
    processFrame: () => void
  },
): Promise<Blob> {
  const { canvas, video, processFrame, onProgress, signal } = opts
  const fps = opts.fps ?? 30
  const mimeType = pickMimeType()
  const stream = canvas.captureStream(fps)
  const chunks: Blob[] = []

  const bitrate = opts.videoBitsPerSecond ?? 8_000_000
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: bitrate,
  })

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }

  const done = new Promise<Blob>((resolve, reject) => {
    recorder.onerror = () => reject(new Error('Recording failed'))
    recorder.onstop = () => {
      const ext = mimeType.includes('mp4') ? 'mp4' : 'webm'
      resolve(new Blob(chunks, { type: mimeType || `video/${ext}` }))
    }
  })

  const wasPlaying = !video.paused
  const startTime = video.currentTime
  video.pause()
  video.currentTime = 0

  await new Promise<void>((resolve, reject) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked)
      resolve()
    }
    video.addEventListener('seeked', onSeeked)
    video.addEventListener('error', () => reject(new Error('Video seek failed')), {
      once: true,
    })
  })

  recorder.start(100)

  const duration = video.duration
  const frameDuration = 1 / fps
  let t = 0

  try {
    while (t <= duration) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

      video.currentTime = t
      await new Promise<void>((resolve) => {
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked)
          resolve()
        }
        video.addEventListener('seeked', onSeeked)
      })

      processFrame()
      onProgress?.(duration > 0 ? t / duration : 1)
      t += frameDuration
      // Yield so MediaRecorder can flush
      await new Promise((r) => setTimeout(r, 0))
    }
  } finally {
    recorder.stop()
    video.currentTime = startTime
    if (wasPlaying) void video.play()
  }

  return done
}
