# BASSX

**Bass intelligence for the web.** A premium, installable bass booster and audio experience built with React, TypeScript, the Web Audio API and Vite.

BASSX processes audio you open inside the app — local files and a built-in demo — through a real DSP chain: sub-bass shaping, an 18-band parametric equalizer, headroom management, soft saturation and a final limiter. Every knob, fader and preset changes the actual audio graph. The animated spectrum is driven by a live `AnalyserNode`, not a decorative loop.

It also has a **Connected Music** hub: real Spotify and Apple Music authorization, your actual library, and transport controls for the providers’ own official players, all inside the same interface.

> **Honest by design:** a website cannot capture system-wide audio, and protected Spotify/Apple streams cannot be routed through the Web Audio graph. BASSX does not pretend otherwise. Connected services play through their native web players with DSP bypassed; local audio gets the full engine. See [Connected music](#connected-music) and [What a browser can and cannot process](#what-a-browser-can-and-cannot-process).

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
| **Connected music** | Spotify via OAuth 2.0 + PKCE and the Web Playback SDK; Apple Music via MusicKit JS. Real libraries, real playback, unified transport, honest capability matrix. |
| **Unified library** | Recently played, playlists, albums, favorites and artists from each connected service, with artwork and one-tap playback. |
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

## Connected music

Open **Music** in the bottom navigation. BASSX only integrates providers that publish an official web API or SDK, and only claims the capabilities those documents actually grant.

### Spotify — real OAuth 2.0 + PKCE

BASSX uses the Authorization Code flow with PKCE, so **no client secret exists in the app**. You supply your own public **Client ID** from the [Spotify developer dashboard](https://developer.spotify.com/dashboard).

1. Create an app in the Spotify dashboard.
2. Add the exact **Redirect URI** shown in BASSX. On the hosted app it is `https://<owner>.github.io/BASSX/music`; locally it is `http://localhost:5173/music` (or whichever dev port you use).
3. Under **Users and Access**, add every Spotify account that will connect while the app is in Development Mode.
4. Paste the app’s **Client ID** into BASSX and press **Connect**.
4. Approve the requested scopes on Spotify’s own page. BASSX never sees your password.

What works:

- Your real profile, recently played, playlists, saved albums, favorite tracks and followed artists.
- Playback through the **Spotify Web Playback SDK** when the browser supports Encrypted Media Extensions and the account is Premium.
- Automatic fallback to the **Web API remote-device flow** when the SDK is unavailable, so playback can be sent to an already-open Spotify app.
- Play / pause, previous / next, seek and a live now-playing card.

What does not: BASSX DSP on Spotify audio. Spotify’s Developer Policy prohibits modifying or re-mixing Spotify content, and the SDK’s protected pipeline is not exposed to Web Audio. The UI labels these streams **Protected stream · DSP bypassed**.

Spotify also requires **Premium** for in-app playback, excludes mobile-only Premium plans from the SDK, and limits Development Mode apps to five listeners. These are Spotify’s rules, not BASSX limits.

### Apple Music — real MusicKit JS

Apple signs MusicKit **developer tokens** with a private key (`.p8`). That key must never ship to a browser, so BASSX asks for a token endpoint instead:

```http
GET https://your-server.example/apple-music-token
Content-Type: application/json

{ "token": "<signed developer JWT>" }
```

A plain-text JWT response is also accepted. BASSX validates the `exp` claim before use and refreshes the token when it nears expiry. For quick testing you can paste a developer token directly; it is kept in **sessionStorage only** and is never written to the persistent config.

After the token is configured, press **Authorize Apple Music**. Apple’s own sign-in sheet grants a Music User Token through MusicKit. BASSX then reads your library (recently played, playlists, albums, songs, artists) and controls playback with MusicKit’s official player.

Apple Music requires an active subscription for full playback. MusicKit audio is protected and cannot be captured by the Web Audio API, so BASSX DSP is bypassed here too.

### Providers that cannot be connected honestly

| Service | Why not |
| --- | --- |
| **YouTube Music** | Google publishes no YouTube Music library, playlist or playback API. The YouTube Data API covers public video metadata only. |
| **SoundCloud** | Official OAuth uses confidential clients with a `client_secret`. A static site cannot keep that secret, and faking it is not acceptable. |
| **Tidal** | No official browser playback API for third-party web apps. |
| **Deezer** | Metadata APIs exist, but not an official in-app web player for this use case. |
| **Amazon Music** | Requires a private partner agreement; no public consumer web SDK. |

These are shown as **Unavailable** with the exact reason. BASSX never scrapes, extracts streams, bypasses DRM or pretends a connection succeeded.

### Tokens, privacy and sessions

- Spotify access and refresh tokens live in **sessionStorage** by default. Turn on **Remember Spotify on this device** to use localStorage instead.
- Apple developer tokens live in sessionStorage. Apple Music User Tokens are managed by MusicKit.
- Tokens are only sent to the provider’s official endpoints. They are never logged or uploaded to BASSX.
- Expired or revoked sessions move to a **Reconnect needed** state with an explanation; library data is cleared rather than shown stale.
- Disconnect removes the tokens, stops provider playback and clears that service’s library.

### Playback behavior

- Connected playback and local playback are mutually exclusive. Starting one pauses the other so audio never mixes.
- The bottom mini-player and the unified deck show artwork, title, artist, service, progress and a protected-stream badge when applicable.
- On the Player page, connected streams show a **Protected audio** explanation in place of the spectrum. The local library and full DSP remain available below.
- The Web Playback SDK needs HTTPS or `localhost`, a supported browser, EME and Premium. iOS Safari support varies; the Web API fallback keeps remote control working.

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
   ├─ music/
   │  ├─ MusicProvider.tsx    # Connections, libraries, provider transport
   │  ├─ useUnifiedPlayback.ts# Local + connected transport facade
   │  ├─ ServiceLogo.tsx      # Inline SVG brand marks
   │  ├─ config.ts            # Public config + redirect URI
   │  ├─ types.ts             # Service/capability/library types
   │  ├─ auth/
   │  │  ├─ pkce.ts           # RFC 7636 verifier/challenge + state
   │  │  ├─ spotifyAuth.ts    # OAuth exchange, refresh, session storage
   │  │  ├─ appleToken.ts     # JWT validation + token endpoint fetch
   │  │  └─ tokenStore.ts     # Session/local token persistence
   │  └─ providers/
   │     ├─ registry.ts       # Capability matrix + honest limitations
   │     ├─ spotifyApi.ts     # Web API client and mappings
   │     ├─ spotifyPlayer.ts  # Web Playback SDK wrapper
   │     └─ appleMusic.ts     # MusicKit loader and mappings
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
   │  ├─ MusicPage.tsx        # Connected music, setup, unified library
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

**Can play, but not process:**

- Spotify through the Web Playback SDK or a remote Spotify device.
- Apple Music through MusicKit.

These use protected media pipelines owned by the provider. BASSX controls their transport but deliberately keeps their audio out of the Web Audio graph, so bass, EQ and the analyser are bypassed. That is a platform and policy boundary, not a missing feature.

**Cannot process or play:**

- System-wide audio.
- YouTube Music, SoundCloud, Tidal, Deezer or Amazon Music libraries (no supported official integration).
- DRM-protected streams outside the provider’s own player.
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

Connected-music settings are separate: the public Spotify Client ID and Apple token endpoint live under `bassx.music.config.v1` in `localStorage`. Spotify tokens use `bassx.token.session.*` by default, or `bassx.token.local.*` when **Remember** is enabled. Apple developer tokens use `bassx.music.apple.devtoken` in `sessionStorage`.

The persisted schema is validated on load. Unknown or malformed bands and presets are discarded rather than crashing the app. **Settings → Reset BASSX** clears the audio state key and restores factory defaults; use **Disconnect** in Music to remove provider tokens. Audio files are never uploaded or persisted.

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
| Spotify says “Invalid redirect URI” | Copy the exact URI from the BASSX setup sheet into the Spotify dashboard, including `https`, the `/BASSX/` path and `/music`. Scheme, host, port and trailing path must all match. |
| Spotify connects but cannot play | In-app playback needs Premium and a browser with Encrypted Media Extensions. Open Spotify on another device to use remote control, or use a supported Chromium browser. |
| Spotify “no active device” | Start Spotify on a phone, desktop or the BASSX player first; the Web API can only control an existing device. |
| Apple Music token rejected | The developer token must be a signed JWT with a future `exp`. Regenerate it from your endpoint and make sure the endpoint allows CORS from the BASSX origin. |
| Connected service reconnect loop | Disconnect and reconnect. Revoked or expired sessions are cleared so BASSX cannot keep showing a stale library. |
| No bass/EQ on Spotify or Apple Music | Expected. Provider audio is protected and stays outside the DSP graph; use local files for the full engine. |
| Blank page after changing hosting | Rebuild with the correct `VITE_BASE` for the URL path. |
| Install button does nothing | Use the browser’s own install/add-to-home-screen action; iOS has no programmatic install prompt. |

---

## Credits

- UI and DSP: BASSX.
- Fonts: [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk) and [Inter](https://fonts.google.com/specimen/Inter), bundled via Fontsource.
- Icons: [Lucide](https://lucide.dev).
- Provider integration follows the official [Spotify Web API](https://developer.spotify.com/documentation/web-api), [Spotify Web Playback SDK](https://developer.spotify.com/documentation/web-playback-sdk) and [Apple MusicKit JS](https://developer.apple.com/documentation/musickitjs) documentation.
- Demo track, app icons and splash screens are generated locally by the scripts in `scripts/`.
