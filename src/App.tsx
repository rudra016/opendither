import { useCallback, useEffect, useRef, useState } from 'react'
import { Analytics } from '@vercel/analytics/react'
import { Controls } from './components/Controls'
import { DropZone } from './components/DropZone'
import { ImageCropper } from './components/ImageCropper'
import { MobileBottomBar, type MobileTab } from './components/MobileBottomBar'
import { Preview } from './components/Preview'
import { useMediaSource } from './hooks/useMediaSource'
import {
  downloadBlob,
  exportCanvasPng,
  exportProcessedVideo,
} from './lib/export'
import { DitherPipeline, fitExportSize } from './lib/pipeline'
import {
  formatBgProgress,
  removeBackgroundFromImage,
  type BgRemovalProgress,
} from './lib/removeBackground'
import { SITE } from './lib/site'
import {
  DEFAULT_EXPORT_QUALITY,
  DEFAULT_SETTINGS,
  EXPORT_QUALITY_META,
  type ExportQuality,
  type ProcessSettings,
} from './lib/types'

function GitHubIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  )
}

export default function App() {
  const {
    source,
    pendingImage,
    error,
    loadFile,
    applyCrop,
    skipCrop,
    cancelCrop,
    replaceImage,
    clear,
  } = useMediaSource()
  const [settings, setSettings] = useState<ProcessSettings>(() => ({
    ...DEFAULT_SETTINGS,
  }))
  const [exportQuality, setExportQuality] = useState<ExportQuality>(
    DEFAULT_EXPORT_QUALITY,
  )
  const [exporting, setExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState<number | null>(null)
  const [bgRemoving, setBgRemoving] = useState(false)
  const [bgRemoveProgress, setBgRemoveProgress] =
    useState<BgRemovalProgress | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [mobileTab, setMobileTab] = useState<MobileTab>('preview')

  const pipelineRef = useRef<DitherPipeline | null>(null)
  const displayCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    pipelineRef.current = new DitherPipeline()
  }, [])

  // Sensible defaults when media kind changes
  useEffect(() => {
    if (!source) return
    if (source.kind === 'video') {
      setSettings((s) => ({
        ...s,
        mode: s.mode === 'pixel' ? 'ascii' : s.mode,
        algorithm: 'bayer-8',
        scale: 0.55,
        cellSize: 8,
      }))
    } else {
      setSettings((s) => ({
        ...s,
        mode: 'pixel',
        algorithm: 'floyd-steinberg',
        scale: 1,
      }))
    }
    pipelineRef.current?.reset()
  }, [source?.kind, source?.url])

  useEffect(() => {
    if (source) setMobileTab('preview')
  }, [source?.url])

  const onChange = useCallback((patch: Partial<ProcessSettings>) => {
    setSettings((s) => ({ ...s, ...patch }))
  }, [])

  const showToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2800)
  }

  const onRemoveBackground = async () => {
    if (!source || source.kind !== 'image' || bgRemoving || exporting) return
    setBgRemoving(true)
    setBgRemoveProgress(null)
    pipelineRef.current?.reset()

    try {
      const blob = await removeBackgroundFromImage(
        source.url,
        setBgRemoveProgress,
      )
      const ok = await replaceImage(blob, {
        nameSuffix: '-nobg',
        hasAlpha: false,
      })
      if (ok) showToast('Background removed')
    } catch (e) {
      console.error(e)
      showToast('Background removal failed')
    } finally {
      setBgRemoving(false)
      setBgRemoveProgress(null)
    }
  }

  const onExport = async () => {
    if (!source) return
    setExporting(true)
    setExportProgress(null)

    const maxEdge = EXPORT_QUALITY_META[exportQuality].maxEdge
    const base = source.name.replace(/\.[^.]+$/, '')

    try {
      if (source.kind === 'image') {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const el = new Image()
          el.onload = () => resolve(el)
          el.onerror = () => reject(new Error('Image load failed'))
          el.src = source.url
        })

        const fitted = fitExportSize(
          img.naturalWidth,
          img.naturalHeight,
          maxEdge,
        )
        const pipeline = new DitherPipeline()
        const out = pipeline.process(
          img,
          fitted.width,
          fitted.height,
          settings,
          { isVideo: false },
        )
        await exportCanvasPng(out, `${base}-dither.png`)
        showToast('PNG downloaded')
      } else {
        const video = document.createElement('video')
        video.src = source.url
        video.muted = true
        video.playsInline = true
        await new Promise<void>((resolve, reject) => {
          video.onloadeddata = () => resolve()
          video.onerror = () => reject(new Error('Video load failed'))
        })

        const pipeline = new DitherPipeline()
        const fitted = fitExportSize(
          video.videoWidth,
          video.videoHeight,
          maxEdge,
        )
        const exportCanvas = document.createElement('canvas')
        const exportCtx = exportCanvas.getContext('2d')!

        const controller = new AbortController()
        abortRef.current = controller

        const bitrate =
          exportQuality === 'max'
            ? 16_000_000
            : exportQuality === 'high'
              ? 12_000_000
              : 8_000_000

        const blob = await exportProcessedVideo({
          canvas: exportCanvas,
          video,
          fps: 24,
          videoBitsPerSecond: bitrate,
          signal: controller.signal,
          onProgress: setExportProgress,
          processFrame: () => {
            const out = pipeline.process(
              video,
              fitted.width,
              fitted.height,
              settings,
              { isVideo: true },
            )
            if (
              exportCanvas.width !== out.width ||
              exportCanvas.height !== out.height
            ) {
              exportCanvas.width = out.width
              exportCanvas.height = out.height
            }
            exportCtx.imageSmoothingEnabled = false
            exportCtx.clearRect(0, 0, exportCanvas.width, exportCanvas.height)
            exportCtx.drawImage(out, 0, 0)
          },
        })

        const ext = blob.type.includes('mp4') ? 'mp4' : 'webm'
        downloadBlob(blob, `${base}-dither.${ext}`)
        showToast('Video downloaded')
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        showToast('Export cancelled')
      } else {
        console.error(e)
        showToast('Export failed')
      }
    } finally {
      setExporting(false)
      setExportProgress(null)
      abortRef.current = null
    }
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      <header
        className="shrink-0 border-b border-line px-3 py-2.5 sm:px-5 sm:py-3"
        style={{ paddingTop: 'max(0.625rem, env(safe-area-inset-top))' }}
      >
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex min-w-0 items-center gap-2">
            <div
              className="grid h-6 w-6 shrink-0 grid-cols-3 grid-rows-3 gap-px"
              aria-hidden
            >
              {Array.from({ length: 9 }, (_, i) => (
                <span
                  key={i}
                  className={
                    [0, 2, 4, 6, 8].includes(i) ? 'bg-accent' : 'bg-line'
                  }
                />
              ))}
            </div>
            <h1 className="truncate text-sm font-semibold tracking-tight">
              {SITE.name}
            </h1>
          </div>
          <span className="hidden text-xs text-muted md:inline">
            Open source · image & video · ASCII + motion
          </span>
          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
            {source && (
              <>
                <DropZone onFile={loadFile} compact />
                <button
                  type="button"
                  onClick={clear}
                  className="rounded-md border border-line px-2.5 py-1.5 text-sm text-muted hover:border-muted hover:text-paper sm:px-3"
                >
                  <span className="hidden sm:inline">Clear</span>
                  <span className="sm:hidden">×</span>
                </button>
              </>
            )}
            <a
              href={SITE.github}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${SITE.name} on GitHub`}
              title="Source on GitHub"
              className="flex h-8 w-8 items-center justify-center rounded-md border border-line text-muted transition hover:border-muted hover:text-paper"
            >
              <GitHubIcon size={16} />
            </a>
          </div>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_320px]">
        <main
          className={[
            'min-h-0 p-3 sm:p-4 lg:p-5',
            source && mobileTab === 'adjust' ? 'hidden lg:block' : '',
          ].join(' ')}
        >
          {!source ? (
            <DropZone onFile={loadFile} />
          ) : (
            <div className="flex h-full min-h-[42dvh] flex-col overflow-hidden rounded-xl border border-line lg:min-h-0">
              <Preview
                source={source}
                settings={settings}
                pipelineRef={pipelineRef}
                displayCanvasRef={displayCanvasRef}
                exporting={exporting}
                bgRemoving={bgRemoving}
                bgRemoveLabel={formatBgProgress(bgRemoveProgress)}
              />
            </div>
          )}
          {error && (
            <p className="mt-3 text-center text-sm text-red-400">{error}</p>
          )}
        </main>

        <Controls
          className={[
            !source ? 'hidden lg:flex' : '',
            source && mobileTab === 'preview' ? 'hidden lg:flex' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          settings={settings}
          kind={source?.kind ?? null}
          hasAlpha={source?.kind === 'image' ? source.hasAlpha : false}
          onChange={onChange}
          exportQuality={exportQuality}
          onExportQualityChange={setExportQuality}
          onExport={() => void onExport()}
          onRemoveBackground={() => void onRemoveBackground()}
          exporting={exporting}
          bgRemoving={bgRemoving}
          exportProgress={exportProgress}
        />
      </div>

      {source && (
        <MobileBottomBar
          tab={mobileTab}
          onTab={setMobileTab}
          onExport={() => void onExport()}
          exporting={exporting}
          exportProgress={exportProgress}
          bgRemoving={bgRemoving}
          kind={source.kind}
        />
      )}

      {toast && (
        <div
          className="pointer-events-none fixed left-1/2 z-50 -translate-x-1/2 rounded-full border border-line bg-panel-2 px-4 py-2 text-sm text-paper shadow-lg bottom-[calc(4.5rem+env(safe-area-inset-bottom))] lg:bottom-6"
        >
          {toast}
        </div>
      )}

      {pendingImage && (
        <ImageCropper
          url={pendingImage.url}
          width={pendingImage.width}
          height={pendingImage.height}
          name={pendingImage.name}
          onApply={(crop) => void applyCrop(crop)}
          onSkip={skipCrop}
          onCancel={cancelCrop}
        />
      )}

      <Analytics />
    </div>
  )
}
