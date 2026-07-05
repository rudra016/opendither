import { ArrayBufferTarget, Muxer } from 'webm-muxer'

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

/** Browsers don't expose source frame rate; 30 is a sensible default. */
export function resolveExportFps(
  _video: HTMLVideoElement,
  override?: number,
): number {
  if (override != null && override > 0) return override
  return 30
}

function canUseWebCodecsExport(): boolean {
  return (
    typeof VideoEncoder !== 'undefined' &&
    typeof VideoFrame !== 'undefined' &&
    typeof VideoEncoder.isConfigSupported === 'function'
  )
}

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

async function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  if (Math.abs(video.currentTime - time) < 1e-4) return
  await new Promise<void>((resolve, reject) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked)
      resolve()
    }
    video.addEventListener('seeked', onSeeked)
    video.addEventListener(
      'error',
      () => reject(new Error('Video seek failed')),
      { once: true },
    )
    video.currentTime = time
  })
}

const VP9_CODEC = 'vp09.00.10.08'

async function exportWithWebCodecs(
  opts: VideoExportOptions & { processFrame: () => void },
): Promise<Blob> {
  const { canvas, video, processFrame, onProgress, signal } = opts
  const fps = resolveExportFps(video, opts.fps)
  const bitrate = opts.videoBitsPerSecond ?? 8_000_000
  const duration = video.duration
  const frameDuration = 1 / fps
  const frameDurationUs = Math.round(1_000_000 / fps)

  const wasPlaying = !video.paused
  const startTime = video.currentTime
  video.pause()
  await seekVideo(video, 0)

  processFrame()
  await waitForPaint()

  const width = canvas.width
  const height = canvas.height
  if (!width || !height) throw new Error('Canvas has no dimensions')

  const support = await VideoEncoder.isConfigSupported({
    codec: VP9_CODEC,
    width,
    height,
    bitrate,
    framerate: fps,
  })
  if (!support.supported) {
    throw new Error('VP9 encoder not supported')
  }

  const target = new ArrayBufferTarget()
  const muxer = new Muxer({
    target,
    video: {
      codec: 'V_VP9',
      width,
      height,
      frameRate: fps,
    },
  })

  let encodeError: Error | null = null
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => {
      encodeError = e instanceof Error ? e : new Error(String(e))
    },
  })

  encoder.configure({
    codec: VP9_CODEC,
    width,
    height,
    bitrate,
    framerate: fps,
  })

  const keyframeInterval = Math.max(1, Math.round(fps * 2))

  try {
    for (let i = 0; i * frameDuration <= duration; i++) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      if (encodeError) throw encodeError

      const t = Math.min(i * frameDuration, duration)
      await seekVideo(video, t)
      processFrame()
      await waitForPaint()

      const timestampUs = Math.round((i * 1_000_000) / fps)
      const frame = new VideoFrame(canvas, {
        timestamp: timestampUs,
        duration: frameDurationUs,
      })

      encoder.encode(frame, { keyFrame: i % keyframeInterval === 0 })
      frame.close()

      onProgress?.(duration > 0 ? t / duration : 1)
    }

    await encoder.flush()
    muxer.finalize()
  } finally {
    if (encoder.state !== 'closed') encoder.close()
    await seekVideo(video, startTime)
    if (wasPlaying) void video.play()
  }

  if (encodeError) throw encodeError

  return new Blob([target.buffer], { type: 'video/webm' })
}

/**
 * Legacy real-time capture. Timestamps follow wall clock, so heavy per-frame
 * processing can make the output play back slower than the source.
 */
async function exportWithMediaRecorder(
  opts: VideoExportOptions & { processFrame: () => void },
): Promise<Blob> {
  const { canvas, video, processFrame, onProgress, signal } = opts
  const fps = resolveExportFps(video, opts.fps)
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
  await seekVideo(video, 0)

  recorder.start(100)

  const duration = video.duration
  const frameDuration = 1 / fps

  try {
    for (let t = 0; t <= duration; t += frameDuration) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

      await seekVideo(video, t)
      processFrame()
      onProgress?.(duration > 0 ? t / duration : 1)
      await new Promise((r) => setTimeout(r, 0))
    }
  } finally {
    recorder.stop()
    await seekVideo(video, startTime)
    if (wasPlaying) void video.play()
  }

  return done
}

/**
 * Export processed video frames with correct playback speed.
 * Uses WebCodecs + webm-muxer when available (offline encode with explicit
 * timestamps). Falls back to MediaRecorder on unsupported browsers.
 */
export async function exportProcessedVideo(
  opts: VideoExportOptions & {
    processFrame: () => void
  },
): Promise<Blob> {
  if (canUseWebCodecsExport()) {
    try {
      return await exportWithWebCodecs(opts)
    } catch (e) {
      console.warn('WebCodecs export failed, falling back to MediaRecorder', e)
    }
  }
  return exportWithMediaRecorder(opts)
}
