import { SlidersHorizontal, Sparkles } from 'lucide-react'
import type { MediaKind } from '../lib/types'

export type MobileTab = 'preview' | 'adjust'

interface Props {
  tab: MobileTab
  onTab: (tab: MobileTab) => void
  onExport: () => void
  exporting: boolean
  exportProgress: number | null
  bgRemoving: boolean
  kind: MediaKind | null
}

export function MobileBottomBar({
  tab,
  onTab,
  onExport,
  exporting,
  exportProgress,
  bgRemoving,
  kind,
}: Props) {
  const busy = exporting || bgRemoving
  const exportLabel = exporting
    ? exportProgress != null
      ? `${Math.round(exportProgress * 100)}%`
      : 'Export…'
    : kind === 'video'
      ? 'Export'
      : 'Export'

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-panel/95 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
    >
      <div className="flex items-center gap-1.5 px-3 py-2">
        <button
          type="button"
          onClick={() => onTab('preview')}
          className={[
            'flex flex-1 items-center justify-center gap-1.5 rounded-md py-2.5 text-xs font-medium transition',
            tab === 'preview'
              ? 'bg-paper text-ink'
              : 'text-muted hover:text-paper',
          ].join(' ')}
        >
          <Sparkles size={14} />
          Preview
        </button>
        <button
          type="button"
          onClick={() => onTab('adjust')}
          className={[
            'flex flex-1 items-center justify-center gap-1.5 rounded-md py-2.5 text-xs font-medium transition',
            tab === 'adjust'
              ? 'bg-paper text-ink'
              : 'text-muted hover:text-paper',
          ].join(' ')}
        >
          <SlidersHorizontal size={14} />
          Adjust
        </button>
        <button
          type="button"
          disabled={!kind || busy}
          onClick={onExport}
          className="min-w-[5.5rem] flex-1 rounded-md bg-accent px-3 py-2.5 text-xs font-semibold text-ink transition enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {exportLabel}
        </button>
      </div>
    </nav>
  )
}
