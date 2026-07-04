# Dither

Browser-native image & video dithering tool. Pixel dither for stills, ASCII + ordered dither with motion-stable processing for video.

## Stack

- Vite 8 + React 19 + TypeScript
- Tailwind CSS 4
- Canvas 2D processing (no server, no uploads)

## Features

**Image**
- Floyd–Steinberg, Atkinson, Bayer 2/4/8/16, hard threshold
- Palettes: Mono, Paper, Game Boy, CGA
- Contrast, brightness, invert, resolution scale
- PNG export

**Video**
- Ordered (Bayer) dither only in pixel mode — no frame-to-frame shimmer
- ASCII + dither mode with:
  - Positional Bayer sub-character dither
  - Temporal EMA (motion-adaptive smoothing)
  - Character hysteresis (stops glyph flicker)
  - Motion boost (sharper edges on moving regions)
- WebM/MP4 export via `MediaRecorder`

## Develop

```bash
npm install
npm run dev
```

```bash
npm run build
npm run preview
```

Everything runs locally in the browser. Drop an image or video to start.
