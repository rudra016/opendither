import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  applyAspect,
  aspectRatio,
  clampCrop,
  defaultCrop,
  type AspectPreset,
  type CropRect,
} from '../lib/crop'

interface Props {
  url: string
  width: number
  height: number
  name: string
  onApply: (crop: CropRect) => void
  onSkip: () => void
  onCancel: () => void
}

type Handle = 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w'

const ASPECTS: { id: AspectPreset; label: string }[] = [
  { id: 'free', label: 'Free' },
  { id: 'original', label: 'Original' },
  { id: '1:1', label: '1:1' },
  { id: '4:3', label: '4:3' },
  { id: '3:2', label: '3:2' },
  { id: '16:9', label: '16:9' },
]

export function ImageCropper({
  url,
  width: imageWidth,
  height: imageHeight,
  name,
  onApply,
  onSkip,
  onCancel,
}: Props) {
  const stageRef = useRef<HTMLDivElement>(null)
  const [display, setDisplay] = useState({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    scale: 1,
  })
  const [crop, setCrop] = useState<CropRect>(() =>
    defaultCrop(imageWidth, imageHeight),
  )
  const [preset, setPreset] = useState<AspectPreset>('free')
  const dragRef = useRef<{
    handle: Handle
    startX: number
    startY: number
    origin: CropRect
  } | null>(null)

  const layout = useCallback(() => {
    const stage = stageRef.current
    if (!stage) return
    const pad = 24
    const availW = Math.max(1, stage.clientWidth - pad * 2)
    const availH = Math.max(1, stage.clientHeight - pad * 2)
    const scale = Math.min(availW / imageWidth, availH / imageHeight)
    const width = imageWidth * scale
    const height = imageHeight * scale
    setDisplay({
      left: (stage.clientWidth - width) / 2,
      top: (stage.clientHeight - height) / 2,
      width,
      height,
      scale,
    })
  }, [imageWidth, imageHeight])

  useEffect(() => {
    layout()
    const stage = stageRef.current
    if (!stage) return
    const ro = new ResizeObserver(layout)
    ro.observe(stage)
    return () => ro.disconnect()
  }, [layout])

  const setPresetAndCrop = (next: AspectPreset) => {
    setPreset(next)
    const ratio = aspectRatio(next, imageWidth, imageHeight)
    if (ratio == null) return
    setCrop(defaultCrop(imageWidth, imageHeight, ratio))
  }

  const onPointerDown = (handle: Handle) => (e: ReactPointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    dragRef.current = {
      handle,
      startX: e.clientX,
      startY: e.clientY,
      origin: crop,
    }
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    const drag = dragRef.current
    if (!drag || display.scale <= 0) return

    const dx = (e.clientX - drag.startX) / display.scale
    const dy = (e.clientY - drag.startY) / display.scale
    const o = drag.origin
    const ratio = aspectRatio(preset, imageWidth, imageHeight)
    let next: CropRect = { ...o }

    if (drag.handle === 'move') {
      next = clampCrop(
        { ...o, x: o.x + dx, y: o.y + dy },
        imageWidth,
        imageHeight,
      )
    } else {
      let { x, y, width, height } = o
      const right = o.x + o.width
      const bottom = o.y + o.height

      if (drag.handle.includes('e')) width = o.width + dx
      if (drag.handle.includes('s')) height = o.height + dy
      if (drag.handle.includes('w')) {
        x = o.x + dx
        width = o.width - dx
      }
      if (drag.handle.includes('n')) {
        y = o.y + dy
        height = o.height - dy
      }

      if (ratio != null) {
        if (drag.handle === 'e' || drag.handle === 'w') {
          height = width / ratio
          y = o.y + (o.height - height) / 2
        } else if (drag.handle === 'n' || drag.handle === 's') {
          width = height * ratio
          x = o.x + (o.width - width) / 2
        } else if (drag.handle === 'se') {
          height = width / ratio
        } else if (drag.handle === 'sw') {
          height = width / ratio
          x = right - width
        } else if (drag.handle === 'ne') {
          height = width / ratio
          y = bottom - height
        } else if (drag.handle === 'nw') {
          height = width / ratio
          x = right - width
          y = bottom - height
        }
      }

      next = clampCrop({ x, y, width, height }, imageWidth, imageHeight)
      if (ratio != null) {
        next = applyAspect(next, ratio, imageWidth, imageHeight, 'top-left')
        // Keep the active corner anchored when possible
        if (drag.handle.includes('w')) {
          next.x = Math.min(right - next.width, Math.max(0, right - next.width))
        }
        if (drag.handle.includes('n')) {
          next.y = Math.min(
            bottom - next.height,
            Math.max(0, bottom - next.height),
          )
        }
        next = clampCrop(next, imageWidth, imageHeight)
      }
    }

    setCrop(next)
  }

  const onPointerUp = () => {
    dragRef.current = null
  }

  const box = {
    left: display.left + crop.x * display.scale,
    top: display.top + crop.y * display.scale,
    width: crop.width * display.scale,
    height: crop.height * display.scale,
  }

  const handles: Handle[] = ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w']

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink/95 backdrop-blur-sm">
      <header className="flex items-center gap-3 border-b border-line px-5 py-3">
        <div>
          <h2 className="text-sm font-semibold text-paper">Crop image</h2>
          <p className="font-mono text-[11px] text-muted">
            {name} · {imageWidth}×{imageHeight}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1">
          {ASPECTS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setPresetAndCrop(a.id)}
              className={[
                'rounded-md px-2.5 py-1 text-xs font-medium transition',
                preset === a.id
                  ? 'bg-paper text-ink'
                  : 'text-muted hover:bg-panel-2 hover:text-paper',
              ].join(' ')}
            >
              {a.label}
            </button>
          ))}
        </div>
      </header>

      <div
        ref={stageRef}
        className="relative min-h-0 flex-1 overflow-hidden touch-none select-none"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {display.width > 0 && (
          <>
            <img
              src={url}
              alt=""
              draggable={false}
              className="pointer-events-none absolute max-w-none"
              style={{
                left: display.left,
                top: display.top,
                width: display.width,
                height: display.height,
              }}
            />

            <div
              className="absolute cursor-move border border-accent"
              style={{
                left: box.left,
                top: box.top,
                width: box.width,
                height: box.height,
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.65)',
              }}
              onPointerDown={onPointerDown('move')}
            >
              {/* Rule of thirds */}
              <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                {Array.from({ length: 9 }, (_, i) => (
                  <div key={i} className="border border-white/10" />
                ))}
              </div>

              {handles.map((h) => {
                const isCorner = h.length === 2
                const pos: CSSProperties = {
                  position: 'absolute',
                  width: isCorner ? 12 : h === 'n' || h === 's' ? 28 : 10,
                  height: isCorner ? 12 : h === 'e' || h === 'w' ? 28 : 10,
                  background: '#c8ff3d',
                  border: '2px solid #0a0a0a',
                  borderRadius: 2,
                  ...handlePosition(h),
                }
                return (
                  <div
                    key={h}
                    style={pos}
                    className={handleCursor(h)}
                    onPointerDown={onPointerDown(h)}
                  />
                )
              })}
            </div>
          </>
        )}
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
        <p className="font-mono text-xs text-muted">
          {Math.round(crop.width)}×{Math.round(crop.height)}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-line px-3 py-2 text-sm text-muted hover:border-muted hover:text-paper"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="rounded-md border border-line px-3 py-2 text-sm text-paper hover:border-muted"
          >
            Use full image
          </button>
          <button
            type="button"
            onClick={() => onApply(crop)}
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-ink hover:brightness-110"
          >
            Apply crop
          </button>
        </div>
      </footer>
    </div>
  )
}

function handlePosition(h: Handle): CSSProperties {
  const edge = -6
  switch (h) {
    case 'nw':
      return { left: edge, top: edge }
    case 'ne':
      return { right: edge, top: edge }
    case 'sw':
      return { left: edge, bottom: edge }
    case 'se':
      return { right: edge, bottom: edge }
    case 'n':
      return { left: '50%', top: edge, transform: 'translateX(-50%)' }
    case 's':
      return { left: '50%', bottom: edge, transform: 'translateX(-50%)' }
    case 'e':
      return { right: edge, top: '50%', transform: 'translateY(-50%)' }
    case 'w':
      return { left: edge, top: '50%', transform: 'translateY(-50%)' }
    default:
      return {}
  }
}

function handleCursor(h: Handle): string {
  const map: Record<Handle, string> = {
    move: 'cursor-move',
    n: 'cursor-n-resize',
    s: 'cursor-s-resize',
    e: 'cursor-e-resize',
    w: 'cursor-w-resize',
    ne: 'cursor-ne-resize',
    nw: 'cursor-nw-resize',
    se: 'cursor-se-resize',
    sw: 'cursor-sw-resize',
  }
  return map[h]
}
