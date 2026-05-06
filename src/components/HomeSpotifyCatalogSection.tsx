import { useState } from 'react';
import {
  fetchSpotifyCatalogSearch,
  spotifyTrackArtUrl,
  spotifyTrackArtistsLabel,
  spotifyTrackOpenUrl,
  type SpotifyCatalogTrack,
} from '../lib/spotify';
import styles from '../pages/Home.module.css';

export function HomeSpotifyCatalogSection() {
  const [spotifyQuery, setSpotifyQuery] = useState('');
  const [spotifyResults, setSpotifyResults] = useState<SpotifyCatalogTrack[]>([]);
  const [spotifyLoading, setSpotifyLoading] = useState(false);
  const [spotifyError, setSpotifyError] = useState<string | null>(null);

  const handleSpotifySearch = async () => {
    const q = spotifyQuery.trim();
    if (!q) {
      setSpotifyResults([]);
      setSpotifyError(null);
      return;
    }
    setSpotifyLoading(true);
    setSpotifyError(null);
    try {
      const data = await fetchSpotifyCatalogSearch(q, { type: 'track' });
      setSpotifyResults(data.tracks?.items ?? []);
    } catch (e: unknown) {
      setSpotifyResults([]);
      setSpotifyError(e instanceof Error ? e.message : 'Spotify search failed.');
    } finally {
      setSpotifyLoading(false);
    }
  };

  return (
    <section className={styles.audiusSection} style={{ marginTop: '32px' }}>
      <div className={styles.audiusHeader}>
        <div className={styles.audiusIntro}>
          <h2 className={styles.sectionTitle}>Spotify catalog search</h2>
          <p className={styles.sectionSubtitle}>
            Search public tracks (app-only token on the server). Use results as reference links; audio still uploads from
            your files to Arweave.
          </p>
        </div>
        <div className={styles.audiusSearch}>
          <input
            className={styles.audiusInput}
            value={spotifyQuery}
            onChange={(e) => setSpotifyQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleSpotifySearch();
            }}
            placeholder="Track or artist name"
          />
          <button
            type="button"
            className={styles.audiusBtn}
            onClick={() => void handleSpotifySearch()}
            disabled={spotifyLoading || !spotifyQuery.trim()}
          >
            {spotifyLoading ? 'Searching…' : 'Search'}
          </button>
        </div>
      </div>

      {spotifyError && <p className={styles.errorText}>{spotifyError}</p>}

      {spotifyResults.length > 0 && (
        <div className={styles.importGrid}>
          {spotifyResults.map((track) => {
            const art = spotifyTrackArtUrl(track);
            const openUrl = spotifyTrackOpenUrl(track);
            return (
              <div key={track.id} className={styles.importCard}>
                <div className={styles.importThumb}>
                  {art ? <img src={art} alt="" loading="lazy" /> : null}
                </div>
                <div className={styles.importMeta}>
                  <div className={styles.importTitle} title={track.name}>
                    {track.name}
                  </div>
                  <div className={styles.importSubtitle} title={track.album?.name}>
                    {spotifyTrackArtistsLabel(track)}
                    {track.album?.name ? ` · ${track.album.name}` : ''}
                  </div>
                  {openUrl && (
                    <a className={styles.importLink} href={openUrl} target="_blank" rel="noopener noreferrer">
                      Open in Spotify
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
