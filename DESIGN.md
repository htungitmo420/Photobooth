# Khoảnh Khắc: Design Direction (35mm Darkroom & Archival Contact-Sheet)

Shared visual direction for **Khoảnh Khắc Photobooth** and **Khoảnh Khắc LiveGallery**.

- **Dial:** `ENERGY 3 / RHYTHM 3 / MOTION 2`
- **Default Theme:** Matte 35mm Darkroom (`:root`), paired with a full Archival Light mode (`[data-theme='light']`) persisted via `localStorage['khoanhkhac-theme']`.
- **Identity Motif:** 35mm filmstrip sprocket rails, numbered contact-sheet frames (`01..08`), and precision camera viewfinder corner brackets surrounding physical white-bordered photo prints.

## Color System (2 Neutral Darkroom/Paper Cores + 1 Deliberate Accent)

### Matte 35mm Darkroom (`:root`, default)

- `--bg: #11100f` (Matte darkroom workbench background)
- `--surface: #191816` (Console panels and tool surfaces)
- `--surface-2: #24221e` (Recessed trays and segmented control tracks)
- `--stage: #090807` (Optical light-table, camera viewfinder housing, and print stage)
- `--ink: #f3efe6` (Warm archival primary ink, > 15:1 contrast on `--bg` and `--surface`)
- `--muted: #aba499` (Secondary copy, > 6.2:1 contrast across all darkroom surfaces, WCAG AA)
- `--line: #2e2b26` (Crisp 1px structural divider)
- `--line-strong: #464139` (Interactive and active border hairline)
- `--accent: #e5a93c` (Kodak film gold accent for primary shutter CTA and active selections)
- `--accent-hover: #f0bc58` (Brightened gold hover state)
- `--accent-ink: #11100f` (Deep ink on gold buttons, > 8.5:1 contrast)
- `--accent-soft: rgba(229, 169, 60, 0.14)` (Subtle active selection tint)
- `--print-paper: #f7f3eb` (Physical matte photo print stock)
- `--print-ink: #171412` (Ink printed onto physical photo paper)

### Archival Light Mode (`[data-theme='light']`)

- `--bg: #f3efe6` (Warm archival paper background)
- `--surface: #fcfaf5` (Elevated paper panel surface)
- `--surface-2: #e7e0d2` (Recessed control tray)
- `--stage: #141210` (Matte darkroom light-table and camera housing, preserved for visual drama and print contrast)
- `--ink: #171412` (Primary ink, > 15:1 contrast)
- `--muted: #5c534a` (Secondary copy, > 5.8:1 contrast across all light surfaces)
- `--line: #d6cbb9` (Structural divider)
- `--line-strong: #b6a791` (Interactive hairline)
- `--accent: #b84222` (Archival vermilion accent, 6.0:1 with `#ffffff`)
- `--accent-hover: #993418` (Pressed and hover vermilion)
- `--accent-ink: #ffffff` (Primary CTA text on vermilion)
- `--accent-soft: #f7e6df` (Subtle active selection fill)
- `--print-paper: #fcfaf5` (Physical white print paper)
- `--print-ink: #171412` (Print caption ink)

## Typography

- **Display / Editorial Titles:** `Fraunces` (optical editorial serif for headlines, booth titles, and print footers)
- **UI / Body / Vietnamese Diacritics:** `Be Vietnam Pro` (clean, legible Vietnamese diacritics on kiosks and phones)
- **Telemetry / Codes:** `IBM Plex Mono` (used strictly for real 35mm frame numbers `01..08`, countdown timers, pixel resolutions `900 × 2400 PX`, and LiveGallery share codes)

## Geometry, Elevation & Motion Rules

- **Radius:** `--radius-xs: 2px` (photo prints, contact-sheet thumbnails, frame swatches), `--radius-sm: 6px` (inputs, buttons, segmented controls), `--radius-md: 10px` (studio panels, camera housing, modals), and `50%` reserved strictly for circular physical shutter button, lens aperture brand mark, and circular close/navigation buttons.
- **Elevation:** Panels sit flat with crisp 1px borders. Elevation shadows appear strictly on physical photo prints (`--shadow-print`) and modal overlays (`--shadow-modal`).
- **Glassmorphism:** Avoided on structural panels and modals; capped at 1 translucent darkroom HUD indicator inside the live camera viewfinder.
- **Motion (MOTION 2):** Purposeful transitions on live print specimen layout changes, shutter actuation, and view transitions; fully respected under `prefers-reduced-motion: reduce`.
