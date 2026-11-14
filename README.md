# BASSX

**Bass intelligence for the web.** A premium, installable bass booster and audio experience built with React, TypeScript, the Web Audio API and Vite.

BASSX processes audio you open inside the app — local files and a built-in demo — through a real DSP chain: sub-bass shaping, an 18-band parametric equalizer, headroom management, soft saturation and a final limiter. Every knob, fader and preset changes the actual audio graph. The animated spectrum is driven by a live `AnalyserNode`, not a decorative loop.

> **Honest by design:** a website cannot capture system-wide audio from Spotify, Apple Music, YouTube Music or other apps. BASSX does not pretend otherwise. See [What a browser can and cannot process](#what-a-browser-can-and-cannot-process).

---

## Highlights

| | |
| --- | --- |
| **Real bass engine** | Low-shelf and bell filters for sub / deep / mid bass, master intensity, input gain, output trim, soft saturation and a limiter. |
| **18-band EQ** | 20 Hz → 20 kHz: 20, 30, 40, 60, 80, 100, 150, 200, 300, 400, 500, 1k, 2k, 4k, 8k, 12k, 16k, 20k. Drag the curve or the faders. |
| **12 signature presets** | Deep Bass, Extreme Bass, Subwoofer, Punchy Bass, Hip-Hop, Trap, EDM, Techno, Rock, Pop, Vocal Boost and Flat. Each one writes real filter and gain values. |
| **Custom presets** | Capture the current sound, rename it, refresh it with the current curve, or delete it. Saved locally. |
| **Headphone profiles** | Manual tunings for AirPods, Beats, JBL, Sony, Galaxy Buds and Studio Reference — plus your own profiles. No fake auto-detection. |
| **Music player** | Local file import, play / pause, skip, seek, volume, repeat, shuffle, track metadata and embedded artwork, Media Session lock-screen controls. |
| **Reactive visualizer** | Spectrum, waveform, orb and mirror styles, all analyser-driven with neon glow and reduced-motion support. |
| **PWA** | Installable on iOS, Android and desktop, offline caching, app icons, splash screens and a standalone display mode. |
| **Persistent** | Settings, EQ curve, presets, profiles, volume, repeat and shuffle are restored from `localStorage` on reload. |
| **Mobile-first** | Safe-area aware, no horizontal page overflow at 320 px, touch-friendly targets, bottom navigation. |

---

## Quick start

Requirements: **Node.js 20+** and npm.

```bash
git clone https://github.com/NovaTweaksOfficial/BASSX.git
cd BASSX
npm install
npm run dev
```

Open the printed local URL (default `http://localhost:5173`). Click **Play demo** or **Add music** to load a track. Browsers require a user gesture before audio can start — BASSX arms the audio context on the first tap, click or keypress.

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server. |
| `npm run build` | Type-check, then build the production PWA into `dist/`. |
| `npm run preview` | Serve the production build locally. |
| `npm run icons` | Regenerate icons, favicon and splash screens (no external dependencies). |
| `npm run demo` | Regenerate the built-in “Sub Zero” demo WAV. |

### Production build

```bash
npm run build
npm run preview
```

`vite-plugin-pwa` generates the web manifest and service worker. The build also copies `index.html` to `404.html` so GitHub Pages can boot deep links such as `/presets`.

---

## Deploying to GitHub Pages

This repository includes `.github/workflows/deploy.yml`. It builds the app and publishes it at:

```text
https://<owner>.github.io/BASSX/
```

Setup:

1. Push this repository to `main`.
2. Open **Settings → Pages** and set **Source** to **GitHub Actions**.
3. The **Deploy BASSX to GitHub Pages** workflow runs automatically on every push to `main` (or manually from the Actions tab).
4. Open `https://<owner>.github.io/BASSX/` on a phone and use **Add to Home Screen** / **Install app**.

The workflow sets:

```bash
VITE_BASE=/${GITHUB_REPOSITORY_NAME}/
```

To host at a custom domain root instead, build with `VITE_BASE=/` (or omit it) and upload `dist` as the site root.

### Local build with a subpath

```bash
VITE_BASE=/BASSX/ npm run build
```

Vite rewrites asset URLs, the PWA manifest, the service worker scope and navigation fallback from this value.

---

## The audio chain

```text
<audio> element
      │
      ▼
Input trim (dB)
      │
      ├─ 32 Hz low shelf        ← sub-bass
      ├─ 70 Hz bell             ← deep bass
      ├─ 140 Hz bell            ← mid bass
      ├─ 18-band peaking EQ     ← 20 Hz … 20 kHz, ±12 dB
      ▼
Pre-gain / headroom trim
      │
      ▼
Compressor
      │
      ▼
Soft saturation (tanh curve)
      │
      ▼
Makeup gain
      │
      ▼
Output gain
      │
      ▼
Limiter
      │
      ▼
AnalyserNode  → visualizer
      │
      ▼
Master volume → destination
```

Headroom protection uses automatic pre-gain and the final limiter to avoid digital clipping when the EQ adds a lot of low end. It can be disabled in **Settings → Processing**.

The engine is a singleton (`src/audio/engine.ts`) with a plain API (`setBass`, `setBands`, `setVolume`, `setSmoothing`, `playTestTone`), so a future native app can reuse the same control surface without the UI.

---

## Project structure

```text
BASSX/
├─ index.html                 # Shell, meta, iOS splash links
├─ vite.config.ts             # base path, PWA manifest, 404 fallback
├─ public/
│  ├─ favicon.svg
│  ├─ apple-touch-icon.png
│  ├─ icons/                  # 192, 512, maskable, 1024
│  ├─ splash/                 # iPhone + iPad startup images
│  └─ demo/
│     ├─ bassx-demo.wav       # Generated 24 s demo ("Sub Zero")
│     └─ sub-zero.svg         # Demo artwork
├─ scripts/
│  ├─ gen-assets.mjs          # PNG icon / splash generator (zlib only)
│  └─ gen-demo.mjs            # WAV demo generator
└─ src/
   ├─ main.tsx                # React root + providers
   ├─ App.tsx                 # Router and shell
   ├─ constants.ts
   ├─ audio/
   │  ├─ engine.ts            # Web Audio graph, DSP, analyser, test sweep
   │  ├─ EngineProvider.tsx   # Context, unlock gestures, lifecycle
   │  ├─ presets.ts           # 12 presets + 6 headphone profiles
   │  ├─ id3.ts               # Lightweight ID3v2 metadata/artwork reader
   │  └─ types.ts             # Frequencies, settings, clamp/format helpers
   ├─ player/
   │  └─ PlayerProvider.tsx   # Audio element, playlist, Media Session
   ├─ pwa/
   │  └─ useInstallPrompt.ts  # beforeinstallprompt + installed state
   ├─ state/
   │  ├─ AppProvider.tsx      # App state, engine sync, preset/profile CRUD
   │  └─ storage.ts           # Versioned localStorage schema + validation
   ├─ lib/
   │  ├─ curve.ts             # Log-frequency mapping and smooth SVG paths
   │  └─ platform.ts          # iOS detection, vibration, download helper
   ├─ pages/
   │  ├─ HomePage.tsx         # Dashboard, knob, spectrum, quick links
   │  ├─ EqualizerPage.tsx    # Curve, faders, bass contour, save preset
   │  ├─ PlayerPage.tsx       # Deck, transport, library
   │  ├─ PresetsPage.tsx      # Presets, profiles, CRUD modals
   │  └─ SettingsPage.tsx     # Appearance, engine, levels, install, about
   ├─ ui/                     # AppShell, nav, knob, canvases, modals, toasts
   └─ styles/
      └─ global.css           # Design system, layout, responsive rules
```

---

## What a browser can and cannot process

**Can process:**

- Audio files you explicitly open in BASSX (MP3, M4A/AAC, WAV, FLAC, OGG, OPUS and anything else the browser can decode).
- The built-in demo track.
- Audio captured through `getUserMedia` — not currently enabled, but the engine is ready for an input node.

**Cannot process:**

- System-wide audio.
- Spotify, Apple Music, YouTube Music, Tidal or any other app’s playback.
- DRM-protected streams.
- Audio from another browser tab or another website.

No browser exposes a system audio capture API for websites, and BASSX does not simulate it. A native iOS/Android build could support additional platform-permitted routing in the future; the engine is intentionally modular for that.

### Browser and device notes

- **Autoplay:** audio starts only after a tap, click or keypress. The header shows **Tap to arm** until the context is unlocked.
- **iOS/Safari:** the hardware volume buttons and Control Center always have the final say. Master volume in the app is applied after the limiter. Background playback and lock-screen controls use the Media Session API where available.
- **Codecs:** support varies by browser (notably FLAC/OGG on older Safari). A clear error appears if a file cannot be decoded.
- **Bluetooth:** headphones and speakers add their own latency and tuning; BASSX neither detects nor claims to correct that.
- **Hearing safety:** start at a comfortable level. Bass boost plus high output can be loud.

---

## Presets and profiles

Built-in presets are generated from control points on a log-frequency axis, so their curves stay smooth and musical across all 18 bands. They are read-only.

Custom presets store a complete snapshot: bass contour, all 18 band gains and the output trim. Rename, refresh and delete actions are available on each custom card.

Headphone profiles are manual. Applying one writes its saved bass contour and EQ curve into the engine. BASSX never attempts to identify connected hardware.

---

## Persistence

State is stored under `bassx.state.v1` in `localStorage`:

- theme accent, visualizer style, smoothing, default bass, headroom, haptics, reduced motion
- bass settings and the 18-band EQ
- active preset / profile IDs
- custom presets and custom headphone profiles
- volume, repeat mode and shuffle

The persisted schema is validated on load. Unknown or malformed bands and presets are discarded rather than crashing the app. **Settings → Reset BASSX** clears this key and restores factory defaults. Audio files are never uploaded or persisted.

---

## PWA installation

- **iOS/iPadOS Safari:** Share → **Add to Home Screen**.
- **Android Chrome:** menu → **Install app** / **Add to Home screen**.
- **Desktop Chrome/Edge:** install icon in the address bar, or menu → **Install BASSX**.

The service worker precaches the app shell, fonts and icons. The demo track is runtime-cached after playback when the browser allows media range requests to be cached. The manifest uses `display: standalone`, a black theme and maskable icons.

---

## Accessibility and motion

- Semantic landmarks, labelled controls and visible focus states.
- Sliders expose numeric values and EQ bands have descriptive labels.
- All animation respects **Reduce motion** (also honours the OS preference via the app setting).
- Zoom is not disabled; the layout remains usable at 320 px wide and reflows for tablet and desktop.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| No sound | Tap the page once to arm audio, press play, and check the system volume. |
| Silent after using another tab | Return to BASSX and press play; mobile browsers suspend audio contexts in the background. |
| A file will not load | Try MP3, M4A/AAC or WAV. The browser’s decoder determines support. |
| Deep link 404 on GitHub Pages | Ensure the workflow deployed and that Pages is set to **GitHub Actions**; the build ships `404.html`. |
| Blank page after changing hosting | Rebuild with the correct `VITE_BASE` for the URL path. |
| Install button does nothing | Use the browser’s own install/add-to-home-screen action; iOS has no programmatic install prompt. |

---

## Credits

- UI and DSP: BASSX.
- Fonts: [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk) and [Inter](https://fonts.google.com/specimen/Inter), bundled via Fontsource.
- Icons: [Lucide](https://lucide.dev).
- Demo track, app icons and splash screens are generated locally by the scripts in `scripts/`.
