export type MediaKind = 'image' | 'video'

export type DitherAlgorithm =
  | 'floyd-steinberg'
  | 'atkinson'
  | 'bayer-2'
  | 'bayer-4'
  | 'bayer-8'
  | 'bayer-16'
  | 'threshold'
  | 'jarvis'
  | 'stucki'
  | 'burkes'
  | 'sierra'
  | 'sierra-2row'
  | 'sierra-lite'
  | 'false-fs'
  | 'clustered-4'
  | 'clustered-8'
  | 'random'

export type OutputMode = 'pixel' | 'ascii'

export type PaletteId =
  | 'mono'
  | 'paper'
  | 'gameboy'
  | 'cga'
  | 'sepia'
  | 'amber'
  | 'phosphor'
  | 'nord'
  | 'ocean'
  | 'sunset'
  | 'cherry'
  | 'lavender'
  | 'ice'
  | 'retro'

/** Export-only resolution. Preview stays capped for live performance. */
export type ExportQuality = 'preview' | 'high' | 'max'

export const EXPORT_QUALITY_META: Record<
  ExportQuality,
  { label: string; maxEdge: number | null; hint: string }
> = {
  preview: {
    label: 'Preview',
    maxEdge: 960,
    hint: 'Match live preview',
  },
  high: {
    label: 'High',
    maxEdge: 1920,
    hint: 'Up to 1920px edge',
  },
  max: {
    label: 'Max',
    maxEdge: null,
    hint: 'Full source resolution',
  },
}

export const DEFAULT_EXPORT_QUALITY: ExportQuality = 'high'

export interface ProcessSettings {
  algorithm: DitherAlgorithm
  mode: OutputMode
  palette: PaletteId
  scale: number
  contrast: number
  brightness: number
  invert: boolean
  asciiCharset: string
  cellSize: number
  /** Temporal smoothing 0–1. Higher = more stable video, less responsive motion. */
  temporalSmooth: number
  /** Motion sensitivity 0–1. Emphasizes moving regions in ASCII/video. */
  motionBoost: number
  /** Character hysteresis: min luminance delta (0–1) before ASCII char changes. */
  charHysteresis: number
}

export interface Rgb {
  r: number
  g: number
  b: number
}

export const DEFAULT_SETTINGS: ProcessSettings = {
  algorithm: 'bayer-8',
  mode: 'pixel',
  palette: 'mono',
  scale: 1,
  contrast: 1,
  brightness: 0,
  invert: false,
  asciiCharset: ' .:-=+*#%@',
  cellSize: 8,
  temporalSmooth: 0.35,
  motionBoost: 0.4,
  charHysteresis: 0.08,
}

export const ALGORITHM_META: Record<
  DitherAlgorithm,
  { label: string; stable: boolean; primary: boolean; bestFor: string }
> = {
  'floyd-steinberg': {
    label: 'Floyd–Steinberg',
    stable: false,
    primary: true,
    bestFor: 'Photos — organic detail',
  },
  atkinson: {
    label: 'Atkinson',
    stable: false,
    primary: true,
    bestFor: 'Classic Mac look',
  },
  'bayer-4': {
    label: 'Bayer 4×4',
    stable: true,
    primary: true,
    bestFor: 'Iconic ordered dither',
  },
  'bayer-8': {
    label: 'Bayer 8×8',
    stable: true,
    primary: true,
    bestFor: 'Video — smooth & stable',
  },
  threshold: {
    label: 'Threshold',
    stable: true,
    primary: true,
    bestFor: 'Hard 1-bit cut',
  },
  'bayer-2': {
    label: 'Bayer 2×2',
    stable: true,
    primary: false,
    bestFor: 'Bold pattern, video-safe',
  },
  'bayer-16': {
    label: 'Bayer 16×16',
    stable: true,
    primary: false,
    bestFor: 'Finest ordered tones',
  },
  jarvis: {
    label: 'Jarvis–Judice–Ninke',
    stable: false,
    primary: false,
    bestFor: 'Soft diffusion, wide spread',
  },
  stucki: {
    label: 'Stucki',
    stable: false,
    primary: false,
    bestFor: 'Sharp diffusion, less bleed',
  },
  burkes: {
    label: 'Burkes',
    stable: false,
    primary: false,
    bestFor: 'Fast, clean error spread',
  },
  sierra: {
    label: 'Sierra',
    stable: false,
    primary: false,
    bestFor: 'Balanced photo dither',
  },
  'sierra-2row': {
    label: 'Sierra Two-Row',
    stable: false,
    primary: false,
    bestFor: 'Lighter Sierra variant',
  },
  'sierra-lite': {
    label: 'Sierra Lite',
    stable: false,
    primary: false,
    bestFor: 'Minimal, fast diffusion',
  },
  'false-fs': {
    label: 'False Floyd–Steinberg',
    stable: false,
    primary: false,
    bestFor: 'Simple 3-neighbor spread',
  },
  'clustered-4': {
    label: 'Clustered 4×4',
    stable: true,
    primary: false,
    bestFor: 'Halftone dots, print look',
  },
  'clustered-8': {
    label: 'Clustered 8×8',
    stable: true,
    primary: false,
    bestFor: 'Larger halftone grain',
  },
  random: {
    label: 'Random',
    stable: false,
    primary: false,
    bestFor: 'Noisy film grain',
  },
}
