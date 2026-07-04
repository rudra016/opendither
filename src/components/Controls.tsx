import { ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { PALETTE_IDS, PALETTE_META, rgbCss } from '../lib/palette'
import type { ExportQuality, MediaKind, ProcessSettings } from '../lib/types'
import {
  ALGORITHM_META,
  EXPORT_QUALITY_META,
  type DitherAlgorithm,
  type OutputMode,
} from '../lib/types'

interface Props {
  settings: ProcessSettings
  kind: MediaKind | null
  hasAlpha?: boolean
  onChange: (patch: Partial<ProcessSettings>) => void
  exportQuality: ExportQuality
  onExportQualityChange: (q: ExportQuality) => void
  onExport: () => void
  onRemoveBackground?: () => void
  exporting: boolean
  bgRemoving?: boolean
  exportProgress: number | null
}

const CHARSETS = [
  { id: 'standard', label: 'Standard', value: ' .:-=+*#%@' },
  { id: 'blocks', label: 'Blocks', value: ' ░▒▓█' },
  { id: 'dense', label: 'Dense', value: ' .\'`^",:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$' },
  { id: 'minimal', label: 'Minimal', value: ' ·•●' },
  { id: 'binary', label: 'Binary', value: ' 01' },
]

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  display,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  display?: string
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className="font-mono text-paper/80">{display ?? value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  )
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { id: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex rounded-md border border-line bg-ink p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={[
            'flex-1 rounded px-2 py-1.5 text-xs font-medium transition',
            value === o.id
              ? 'bg-paper text-ink'
              : 'text-muted hover:text-paper',
          ].join(' ')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Controls({
  settings,
  kind,
  hasAlpha = false,
  onChange,
  exportQuality,
  onExportQualityChange,
  onExport,
  onRemoveBackground,
  exporting,
  bgRemoving = false,
  exportProgress,
}: Props) {
  const [showMoreAlgos, setShowMoreAlgos] = useState(false)
  const isVideo = kind === 'video'
  const isAscii = settings.mode === 'ascii'

  // Auto-pick stable algorithm for video pixel mode if user is on error-diffusion
  const algorithms = (
    Object.keys(ALGORITHM_META) as DitherAlgorithm[]
  ).filter((id) => {
    if (isVideo && !isAscii) return ALGORITHM_META[id].stable
    return true
  })

  const visibleAlgorithms = showMoreAlgos
    ? algorithms
    : algorithms.filter(
        (id) => ALGORITHM_META[id].primary || id === settings.algorithm,
      )
  const hasMoreAlgorithms = algorithms.some((id) => !ALGORITHM_META[id].primary)

  return (
    <aside className="flex h-full flex-col gap-5 overflow-y-auto border-l border-line bg-panel p-5">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
          Output
        </h2>
        <div className="mt-2">
          <Segmented<OutputMode>
            value={settings.mode}
            onChange={(mode) => {
              const patch: Partial<ProcessSettings> = { mode }
              // Video + pixel → prefer Bayer for stability
              if (mode === 'pixel' && isVideo && !ALGORITHM_META[settings.algorithm].stable) {
                patch.algorithm = 'bayer-8'
              }
              onChange(patch)
            }}
            options={[
              { id: 'pixel', label: 'Pixel dither' },
              { id: 'ascii', label: 'ASCII + dither' },
            ]}
          />
        </div>
        {isVideo && settings.mode === 'pixel' && (
          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            Ordered (Bayer) algorithms only — error diffusion shimmers frame-to-frame.
          </p>
        )}
        {isVideo && settings.mode === 'ascii' && (
          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            ASCII uses ordered sub-dither, temporal smoothing, and motion-aware character hysteresis.
          </p>
        )}
      </div>

      {!isAscii && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
            Algorithm
          </h2>
          <div className="mt-2 grid gap-1">
            {visibleAlgorithms.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => onChange({ algorithm: id })}
                className={[
                  'rounded-md border px-3 py-2 text-left transition',
                  settings.algorithm === id
                    ? 'border-accent/40 bg-accent/10'
                    : 'border-transparent bg-panel-2 hover:border-line',
                ].join(' ')}
              >
                <div className="text-sm font-medium">{ALGORITHM_META[id].label}</div>
                <div className="text-[11px] text-muted">{ALGORITHM_META[id].bestFor}</div>
              </button>
            ))}
          </div>
          {hasMoreAlgorithms && (
            <button
              type="button"
              onClick={() => setShowMoreAlgos((v) => !v)}
              className="mt-1.5 flex w-full items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs text-muted transition hover:bg-panel-2 hover:text-paper"
            >
              {showMoreAlgos ? (
                <>
                  Show less <ChevronUp size={14} />
                </>
              ) : (
                <>
                  View more <ChevronDown size={14} />
                </>
              )}
            </button>
          )}
        </div>
      )}

      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
          Palette
        </h2>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {PALETTE_IDS.map((id) => {
            const meta = PALETTE_META[id]
            const selected = settings.palette === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => onChange({ palette: id })}
                className={[
                  'flex items-center gap-2 rounded-md border px-2 py-1.5 text-left transition',
                  selected
                    ? 'border-accent/40 bg-accent/10'
                    : 'border-transparent bg-panel-2 hover:border-line',
                ].join(' ')}
              >
                <span
                  className="flex h-5 shrink-0 overflow-hidden rounded-sm border border-black/40"
                  aria-hidden
                >
                  {meta.colors.map((c, i) => (
                    <span
                      key={i}
                      className="h-full w-2.5"
                      style={{ backgroundColor: rgbCss(c) }}
                    />
                  ))}
                </span>
                <span className="truncate text-xs font-medium text-paper">
                  {meta.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {kind === 'image' && onRemoveBackground && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
            Image
          </h2>
          <button
            type="button"
            disabled={bgRemoving || exporting}
            onClick={onRemoveBackground}
            className="mt-2 w-full rounded-md border border-line bg-panel-2 px-3 py-2.5 text-left text-sm transition enabled:hover:border-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="font-medium text-paper">
              {hasAlpha ? 'Remove background again' : 'Remove background'}
            </span>
            <span className="mt-0.5 block text-[11px] leading-relaxed text-muted">
              Exports a raster, calls remove.bg, then flattens onto white for
              clean dithering. Requires API key in .env.
            </span>
          </button>
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
          Tone
        </h2>
        <Slider
          label="Detail"
          value={settings.scale}
          min={0.15}
          max={1}
          step={0.05}
          display={`${Math.round(settings.scale * 100)}%`}
          onChange={(scale) => onChange({ scale })}
        />
        <Slider
          label="Contrast"
          value={settings.contrast}
          min={0.4}
          max={2.5}
          step={0.05}
          display={settings.contrast.toFixed(2)}
          onChange={(contrast) => onChange({ contrast })}
        />
        <Slider
          label="Brightness"
          value={settings.brightness}
          min={-0.4}
          max={0.4}
          step={0.02}
          display={settings.brightness.toFixed(2)}
          onChange={(brightness) => onChange({ brightness })}
        />
        <label className="flex cursor-pointer items-center justify-between text-sm">
          <span className="text-muted">Invert</span>
          <input
            type="checkbox"
            checked={settings.invert}
            onChange={(e) => onChange({ invert: e.target.checked })}
            className="accent-accent"
          />
        </label>
      </div>

      {isAscii && (
        <div className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
            ASCII
          </h2>
          <Slider
            label="Cell size"
            value={settings.cellSize}
            min={4}
            max={20}
            step={1}
            display={`${settings.cellSize}px`}
            onChange={(cellSize) => onChange({ cellSize })}
          />
          <div>
            <div className="mb-1.5 text-xs text-muted">Charset</div>
            <div className="grid grid-cols-2 gap-1">
              {CHARSETS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onChange({ asciiCharset: c.value })}
                  className={[
                    'rounded-md border px-2 py-1.5 text-left text-xs transition',
                    settings.asciiCharset === c.value
                      ? 'border-accent/40 bg-accent/10'
                      : 'border-line bg-panel-2 hover:border-muted',
                  ].join(' ')}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={settings.asciiCharset}
              onChange={(e) => onChange({ asciiCharset: e.target.value })}
              className="mt-2 w-full rounded-md border border-line bg-ink px-2 py-1.5 font-mono text-xs text-paper outline-none focus:border-muted"
              spellCheck={false}
            />
          </div>
        </div>
      )}

      {isVideo && (
        <div className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
            Motion
          </h2>
          <Slider
            label="Temporal smooth"
            value={settings.temporalSmooth}
            min={0}
            max={0.85}
            step={0.05}
            display={settings.temporalSmooth.toFixed(2)}
            onChange={(temporalSmooth) => onChange({ temporalSmooth })}
          />
          {isAscii && (
            <>
              <Slider
                label="Motion boost"
                value={settings.motionBoost}
                min={0}
                max={1}
                step={0.05}
                display={settings.motionBoost.toFixed(2)}
                onChange={(motionBoost) => onChange({ motionBoost })}
              />
              <Slider
                label="Char hysteresis"
                value={settings.charHysteresis}
                min={0}
                max={0.25}
                step={0.01}
                display={settings.charHysteresis.toFixed(2)}
                onChange={(charHysteresis) => onChange({ charHysteresis })}
              />
            </>
          )}
          <p className="text-[11px] leading-relaxed text-muted">
            Smooth reduces flicker. Motion boost sharpens moving edges. Hysteresis
            stops characters from flickering on tiny luminance changes.
          </p>
        </div>
      )}

      <div className="mt-auto space-y-3 border-t border-line pt-4">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
            Export quality
          </h2>
          <div className="mt-2">
            <Segmented<ExportQuality>
              value={exportQuality}
              onChange={onExportQualityChange}
              options={(
                Object.keys(EXPORT_QUALITY_META) as ExportQuality[]
              ).map((id) => ({
                id,
                label: EXPORT_QUALITY_META[id].label,
              }))}
            />
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            {EXPORT_QUALITY_META[exportQuality].hint}. Live preview stays at
            preview resolution for speed.
          </p>
        </div>
        <button
          type="button"
          disabled={!kind || exporting || bgRemoving}
          onClick={onExport}
          className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-ink transition enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {exporting
            ? exportProgress != null
              ? `Exporting ${Math.round(exportProgress * 100)}%`
              : 'Exporting…'
            : kind === 'video'
              ? 'Export video'
              : 'Export PNG'}
        </button>
      </div>
    </aside>
  )
}
