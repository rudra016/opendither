import { Pause, Play } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from 'react'
import type { MediaSource } from '../hooks/useMediaSource'
import { DitherPipeline, fitSize } from '../lib/pipeline'
import type { ProcessSettings } from '../lib/types'
import { Loader } from './Loader'

interface Props {
  source: MediaSource
  settings: ProcessSettings
  pipelineRef: RefObject<DitherPipeline | null>
  displayCanvasRef: RefObject<HTMLCanvasElement | null>
  exporting?: boolean
  bgRemoving?: boolean
  bgRemoveLabel?: string
}

const MAX_PROCESS_EDGE = 960

export function Preview({
  source,
  settings,
  pipelineRef,
  displayCanvasRef,
  exporting = false,
  bgRemoving = false,
  bgRemoveLabel,
}: Props) {
  const imgRef = useRef<HTMLImageElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const rafRef = useRef<number>(0)
  const [playing, setPlaying] = useState(true)
  const [ready, setReady] = useState(false)

  const processOnce = useCallback(() => {
    const pipeline = pipelineRef.current
    const display = displayCanvasRef.current
    if (!pipeline || !display) return false

    const isVideo = source.kind === 'video'
    const el = isVideo ? videoRef.current : imgRef.current
    if (!el) return false

    const srcW = isVideo
      ? (el as HTMLVideoElement).videoWidth
      : (el as HTMLImageElement).naturalWidth
    const srcH = isVideo
      ? (el as HTMLVideoElement).videoHeight
      : (el as HTMLImageElement).naturalHeight
    if (!srcW || !srcH) return false

    const fitted = fitSize(srcW, srcH, MAX_PROCESS_EDGE)
    const out = pipeline.process(el, fitted.width, fitted.height, settings, {
      isVideo,
    })

    if (display.width !== out.width || display.height !== out.height) {
      display.width = out.width
      display.height = out.height
    }
    const ctx = display.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, display.width, display.height)
    ctx.drawImage(out, 0, 0)
    return true
  }, [source, settings, pipelineRef, displayCanvasRef])

  // Media is preloaded in useMediaSource, so onLoad often never fires.
  // Detect readiness from the element itself after mount / URL change.
  useEffect(() => {
    pipelineRef.current?.reset()
    setReady(false)
    setPlaying(true)

    let cancelled = false

    const markReady = () => {
      if (cancelled) return
      setReady(true)
    }

    if (source.kind === 'image') {
      const img = imgRef.current
      if (!img) return

      if (img.complete && img.naturalWidth > 0) {
        markReady()
        return
      }

      const onLoad = () => markReady()
      const onError = () => markReady()
      img.addEventListener('load', onLoad)
      img.addEventListener('error', onError)
      return () => {
        cancelled = true
        img.removeEventListener('load', onLoad)
        img.removeEventListener('error', onError)
      }
    }

    const video = videoRef.current
    if (!video) return

    const onReady = () => {
      markReady()
      void video.play().catch(() => {})
    }

    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      onReady()
      return
    }

    video.addEventListener('loadeddata', onReady)
    video.addEventListener('error', markReady)
    return () => {
      cancelled = true
      video.removeEventListener('loadeddata', onReady)
      video.removeEventListener('error', markReady)
    }
  }, [source.url, source.kind, pipelineRef])

  // Reprocess image when settings change
  useEffect(() => {
    if (source.kind !== 'image' || !ready) return
    processOnce()
  }, [source.kind, settings, ready, processOnce])

  // Video render loop
  useEffect(() => {
    if (source.kind !== 'video' || !ready) return

    const video = videoRef.current
    if (!video) return

    const tick = () => {
      if (!video.paused && !video.ended) {
        processOnce()
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [source.kind, ready, processOnce])

  // Process first video frame when paused / settings change
  useEffect(() => {
    if (source.kind !== 'video' || !ready) return
    processOnce()
  }, [source.kind, settings, ready, processOnce])

  const togglePlay = async () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      await video.play()
      setPlaying(true)
    } else {
      video.pause()
      setPlaying(false)
    }
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {/* Hidden source elements */}
      {source.kind === 'image' ? (
        <img ref={imgRef} src={source.url} alt="" className="hidden" />
      ) : (
        <video
          ref={videoRef}
          src={source.url}
          className="hidden"
          muted
          loop
          playsInline
          autoPlay
        />
      )}

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_center,#1a1a17_0%,#0a0a0a_70%)] p-6">
        <canvas
          ref={displayCanvasRef}
          className={`max-h-full max-w-full rounded-sm ${ready ? '' : 'invisible'}`}
          style={{ imageRendering: 'pixelated' }}
        />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader />
          </div>
        )}
        {exporting && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader />
          </div>
        )}
        {bgRemoving && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink/70">
            <Loader />
            {bgRemoveLabel && (
              <p className="font-mono text-xs text-muted">{bgRemoveLabel}</p>
            )}
          </div>
        )}
      </div>

      {source.kind === 'video' && (
        <div className="flex items-center gap-3 border-t border-line bg-panel px-4 py-2">
          <button
            type="button"
            onClick={() => void togglePlay()}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-line bg-panel-2 text-paper hover:border-muted"
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <span className="truncate font-mono text-xs text-muted">
            {source.name}
          </span>
          <span className="ml-auto font-mono text-[11px] text-muted">
            {source.width}×{source.height}
          </span>
        </div>
      )}

      {source.kind === 'image' && (
        <div className="flex items-center gap-3 border-t border-line bg-panel px-4 py-2">
          <span className="truncate font-mono text-xs text-muted">
            {source.name}
          </span>
          <span className="ml-auto font-mono text-[11px] text-muted">
            {source.width}×{source.height}
          </span>
        </div>
      )}
    </div>
  )
}
