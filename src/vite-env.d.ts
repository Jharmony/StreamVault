/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AUDIUS_APP_NAME?: string;
  readonly VITE_AO?: string;
  /** Set to `1` to enable Home Spotify catalog search UI and `/api/spotify-search` client calls. */
  readonly VITE_SPOTIFY_CATALOG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
