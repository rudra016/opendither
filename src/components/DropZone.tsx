import { ImageIcon, Upload, Video } from 'lucide-react'
import { useCallback, useState, type DragEvent } from 'react'

interface Props {
  onFile: (file: File) => void
  compact?: boolean
}

export function DropZone({ onFile, compact }: Props) {
  const [over, setOver] = useState(false)

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0]
      if (file) onFile(file)
    },
    [onFile],
  )

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    handleFiles(e.dataTransfer.files)
  }

  if (compact) {
    return (
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-line bg-panel-2 px-3 py-1.5 text-sm text-paper transition hover:border-muted">
        <Upload size={14} />
        Replace
        <input
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </label>
    )
  }

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={[
        'flex h-full min-h-[420px] cursor-pointer flex-col items-center justify-center gap-5 rounded-xl border border-dashed px-8 text-center transition',
        over
          ? 'border-accent bg-accent/5'
          : 'border-line bg-panel hover:border-muted',
      ].join(' ')}
    >
      <div className="flex gap-3 text-muted">
        <ImageIcon size={28} strokeWidth={1.5} />
        <Video size={28} strokeWidth={1.5} />
      </div>
      <div>
        <p className="text-lg font-medium text-paper">
          Drop an image or video to dither
        </p>
        <p className="mt-1 text-sm text-muted">
          Free in-browser dithering · PNG, JPG, WebP, GIF · MP4, WebM, MOV
        </p>
      </div>
      <span className="rounded-md bg-paper px-4 py-2 text-sm font-medium text-ink">
        Browse files
      </span>
      <input
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </label>
  )
}
