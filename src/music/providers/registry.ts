import type { ServiceDefinition, ServiceId } from '../types'

/**
 * Provider registry.
 *
 * These descriptions were written against the providers' public developer
 * documentation (links below). They are intentionally conservative: if a
 * capability is not explicitly supported by an official API or SDK, it is
 * marked as unavailable instead of being simulated.
 */
export const SERVICES: ServiceDefinition[] = [
  {
    id: 'spotify',
    name: 'Spotify',
    shortName: 'Spotify',
    tagline: 'Your library, playlists and Premium playback.',
    description:
      'Connect with Spotify’s official OAuth 2.0 + PKCE flow, browse your library and play through the Web Playback SDK or an active Spotify device.',
    brand: '#1ed760',
    brandInk: '#04140a',
    docsUrl: 'https://developer.spotify.com/documentation/web-api',
    availability: 'requires-setup',
    availabilityReason:
      'Requires your own Spotify app Client ID. A Client ID is public, not a secret, and is stored on this device.',
    authModel: 'OAuth 2.0 Authorization Code + PKCE (no client secret)',
    requirements: [
      'A Spotify account with Premium for in-app playback',
      'A Spotify developer app with this exact Redirect URI added',
      'The app owner must have Premium while the app is in Development Mode',
    ],
    capabilities: {
      authorize: 'full',
      library: 'full',
      metadata: 'full',
      playback: 'limited',
      search: 'none',
      dsp: 'none',
    },
    limitations: [
      'Spotify Premium is required for playback inside BASSX. Mobile-only Premium plans are excluded by Spotify.',
      'Playback runs through Spotify’s Web Playback SDK when the browser supports encrypted media; otherwise BASSX sends playback to your active Spotify device.',
      'BASSX DSP cannot be applied to Spotify audio. Spotify’s Developer Policy prohibits mixing, re-mixing or modifying Spotify content.',
      'Development Mode apps are limited to 5 listeners. Extended access requires Spotify approval.',
    ],
    setup: 'spotify-client',
  },
  {
    id: 'appleMusic',
    name: 'Apple Music',
    shortName: 'Apple Music',
    tagline: 'Your library and full tracks via MusicKit.',
    description:
      'Sign in with Apple through MusicKit JS, browse your library and play full tracks with an Apple Music subscription.',
    brand: '#fa2d48',
    brandInk: '#fff5f6',
    docsUrl: 'https://developer.apple.com/documentation/musickitjs',
    availability: 'requires-setup',
    availabilityReason:
      'Requires a MusicKit developer token. Apple signs these server-side, so BASSX uses your token endpoint instead of shipping a private key.',
    authModel: 'MusicKit JS + Apple ID authorization (Music User Token)',
    requirements: [
      'An Apple Music subscription for full-length playback',
      'A MusicKit-enabled Apple Developer key',
      'A small token endpoint that returns a signed developer token',
    ],
    capabilities: {
      authorize: 'full',
      library: 'full',
      metadata: 'full',
      playback: 'limited',
      search: 'none',
      dsp: 'none',
    },
    limitations: [
      'Apple Music requires an active subscription for full playback.',
      'The MusicKit developer token must be signed with your Apple private key on a server. BASSX never asks for that key.',
      'MusicKit plays through Apple’s protected media pipeline. That audio cannot be captured by the Web Audio API, so BASSX DSP is bypassed.',
      'Developer tokens expire; BASSX checks expiry and asks you to reconnect when needed.',
    ],
    setup: 'apple-token',
  },
  {
    id: 'youtubeMusic',
    name: 'YouTube Music',
    shortName: 'YT Music',
    tagline: 'Not connectable — no official API.',
    description:
      'Google does not publish a YouTube Music library, playlist or playback API for third-party apps.',
    brand: '#ff0033',
    brandInk: '#ffffff',
    docsUrl: 'https://developers.google.com/youtube/apis',
    availability: 'unavailable',
    availabilityReason:
      'No official YouTube Music API exists. The YouTube Data API covers public video metadata only — not YT Music likes, playlists or audio streams.',
    authModel: 'No supported OAuth flow for YouTube Music library access',
    requirements: [],
    capabilities: {
      authorize: 'none',
      library: 'none',
      metadata: 'none',
      playback: 'none',
      search: 'none',
      dsp: 'none',
    },
    limitations: [
      'There is no official way to read YouTube Music liked songs, playlists or “recently played”.',
      'Scraping the site or extracting protected streams would violate YouTube’s Terms of Service, so BASSX does not do it.',
      'Official YouTube embeds can play public videos, but they are not a YouTube Music account connection and cannot be processed by BASSX.',
    ],
    setup: null,
  },
  {
    id: 'soundcloud',
    name: 'SoundCloud',
    shortName: 'SoundCloud',
    tagline: 'Requires a server-side broker.',
    description:
      'SoundCloud’s official API uses confidential OAuth clients, which need a server-side secret exchange.',
    brand: '#ff5500',
    brandInk: '#1a0800',
    docsUrl: 'https://developers.soundcloud.com/docs/api/guide',
    availability: 'unavailable',
    availabilityReason:
      'SoundCloud treats every API client as confidential: token exchange requires a client secret, which cannot be embedded in a static site.',
    authModel: 'OAuth (confidential client + client secret)',
    requirements: [],
    capabilities: {
      authorize: 'none',
      library: 'none',
      metadata: 'none',
      playback: 'none',
      search: 'none',
      dsp: 'none',
    },
    limitations: [
      'SoundCloud’s docs state all clients are confidential, so a browser-only app cannot complete the token exchange safely.',
      'A SoundCloud app also requires an Artist Pro subscription, and playback streams are restricted per track.',
      'A legitimate integration needs a small backend that holds the client secret and proxies token exchange. BASSX does not ship secrets.',
    ],
    setup: null,
  },
  {
    id: 'tidal',
    name: 'Tidal',
    shortName: 'Tidal',
    tagline: 'No web playback SDK.',
    description:
      'Tidal offers OAuth and catalogue APIs, but no official browser playback SDK.',
    brand: '#00d3ff',
    brandInk: '#001014',
    docsUrl: 'https://developer.tidal.com/',
    availability: 'unavailable',
    availabilityReason:
      'Tidal’s official playback SDKs target native platforms. There is no supported way to play Tidal audio in a web app.',
    authModel: 'OAuth 2.0 (catalogue only on the web)',
    requirements: [],
    capabilities: {
      authorize: 'none',
      library: 'none',
      metadata: 'none',
      playback: 'none',
      search: 'none',
      dsp: 'none',
    },
    limitations: ['Catalogue metadata alone would not make Tidal music playable in BASSX.'],
    setup: null,
    secondary: true,
  },
  {
    id: 'deezer',
    name: 'Deezer',
    shortName: 'Deezer',
    tagline: 'No web playback SDK.',
    description:
      'Deezer’s public API covers catalogue and user data, but not third-party web playback.',
    brand: '#a238ff',
    brandInk: '#ffffff',
    docsUrl: 'https://developers.deezer.com/',
    availability: 'unavailable',
    availabilityReason:
      'Deezer does not provide an official web playback SDK or licensed audio streams for third-party players.',
    authModel: 'OAuth 2.0 (metadata only on the web)',
    requirements: [],
    capabilities: {
      authorize: 'none',
      library: 'none',
      metadata: 'none',
      playback: 'none',
      search: 'none',
      dsp: 'none',
    },
    limitations: ['Metadata access cannot be turned into in-app playback without an official player.'],
    setup: null,
    secondary: true,
  },
  {
    id: 'amazonMusic',
    name: 'Amazon Music',
    shortName: 'Amazon',
    tagline: 'No public developer API.',
    description:
      'Amazon Music does not publish a public library or playback API for third-party web apps.',
    brand: '#25d1da',
    brandInk: '#001416',
    docsUrl: 'https://developer.amazon.com/',
    availability: 'unavailable',
    availabilityReason:
      'There is no public Amazon Music developer API for library access or playback.',
    authModel: 'Not available',
    requirements: [],
    capabilities: {
      authorize: 'none',
      library: 'none',
      metadata: 'none',
      playback: 'none',
      search: 'none',
      dsp: 'none',
    },
    limitations: ['An integration would require a private partner agreement with Amazon.'],
    setup: null,
    secondary: true,
  },
]

/** Primary cards shown first on the Connected Music page. */
export const PRIMARY_SERVICES = SERVICES.filter((service) => !service.secondary)

/** Services we researched but cannot support on the static web build. */
export const SECONDARY_SERVICES = SERVICES.filter((service) => service.secondary)

export const SERVICE_BY_ID: Record<string, ServiceDefinition> = Object.fromEntries(
  SERVICES.map((service) => [service.id, service]),
)

export function getService(id: ServiceId): ServiceDefinition {
  return SERVICE_BY_ID[id]
}

export const DSP_POLICY_NOTE =
  'BASSX only processes local audio files and its own test signal. Protected streams from Spotify or Apple Music are played by the provider’s official player and never routed through the BASSX DSP.'
