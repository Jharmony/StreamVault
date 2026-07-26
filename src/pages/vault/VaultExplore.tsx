import { useMemo, useState } from 'react';
import { arweaveArtistPath } from '../../lib/arweaveArtist';
import { queryAudioTransactions, queryAudioByTag, aoRecordsToTracks } from '../../lib/arweaveDiscovery';
import { searchTracksOnAO } from '../../lib/aoMusicRegistry';
import { TrackCard } from '../../components/TrackCard';
import type { Track } from '../../context/PlayerContext';
import { createStreamVaultClient, type StreamVaultTrack } from '../../../packages/streamvault-sdk/src';
import styles from './Vault.module.css';

type ExploreTrack = Track & { streamVaultProfileId?: string };

function indexedTrackToTrack(track: StreamVaultTrack): ExploreTrack {
  return {
    id: track.audioTxId,
    title: track.title,
    artist: track.artist,
    artistId: track.artistId,
    artwork: track.artworkUrl,
    streamUrl: track.streamUrl,
    isPermanent: track.isPermanent,
    permaTxId: track.audioTxId,
    assetId: track.assetId,
    streamVaultProfileId: track.artistId && track.artistId.length === 43 ? track.artistId : undefined,
  };
}

export function VaultExplore() {
  const [query, setQuery] = useState('');
  const [tagName, setTagName] = useState('');
  const [tagValue, setTagValue] = useState('');
  const [tracks, setTracks] = useState<ExploreTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const streamVaultIndexConfig = useMemo(() => {
    const indexUrl = import.meta.env.VITE_STREAMVAULT_INDEX_URL || (import.meta.env.PROD ? '/api' : '');
    const supabaseUrl =
      import.meta.env.VITE_STREAMVAULT_INDEX_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || '';
    const supabaseKey =
      import.meta.env.VITE_STREAMVAULT_INDEX_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    return {
      indexUrl: indexUrl || undefined,
      index: supabaseUrl && supabaseKey ? { supabaseUrl, supabaseKey } : undefined,
    };
  }, []);
  const streamVaultClient = useMemo(
    () => createStreamVaultClient(streamVaultIndexConfig),
    [streamVaultIndexConfig]
  );

  const handleSearch = async () => {
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const hasTag = tagName.trim() && tagValue.trim();
      let gqlTracks: ExploreTrack[] = [];
      let aoTracks: ExploreTrack[] = [];
      let indexedTracks: ExploreTrack[] = [];
      if (hasTag) {
        gqlTracks = await queryAudioByTag(tagName.trim(), tagValue.trim(), 50);
        const aoRecords = await searchTracksOnAO({ tagName: tagName.trim(), tagValue: tagValue.trim() });
        aoTracks = aoRecordsToTracks(aoRecords);
      } else {
        gqlTracks = await queryAudioTransactions({ limit: 50 });
        const aoRecords = await searchTracksOnAO({});
        aoTracks = aoRecordsToTracks(aoRecords);
        if (query.trim() && (streamVaultIndexConfig.indexUrl || streamVaultIndexConfig.index)) {
          indexedTracks = (await streamVaultClient.searchTracks({ q: query.trim(), limit: 50 })).map(indexedTrackToTrack);
        }
      }
      const byId = new Map<string, ExploreTrack>();
      indexedTracks.forEach((t) => byId.set(t.id, t));
      gqlTracks.forEach((t) => byId.set(t.id, t));
      aoTracks.forEach((t) => {
        if (!byId.has(t.id)) byId.set(t.id, t);
      });
      let result = Array.from(byId.values());
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        result = result.filter(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            t.artist.toLowerCase().includes(q)
        );
      }
      setTracks(result);
    } catch (e: any) {
      setError(e?.message ?? 'Search failed.');
      setTracks([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h1 className={styles.sectionTitle}>Explore</h1>
      <p className={styles.sectionSubtitle}>
        Search by keyword or filter by tag (e.g. Genre, Mood, BPM).
      </p>
      <div className={styles.searchRow}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search by title or artist"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Tag name (e.g. Genre)"
          value={tagName}
          onChange={(e) => setTagName(e.target.value)}
        />
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Tag value"
          value={tagValue}
          onChange={(e) => setTagValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button
          type="button"
          className={styles.searchBtn}
          onClick={handleSearch}
          disabled={loading}
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
      </div>
      {error && <p className={styles.errorText}>{error}</p>}
      {loading ? (
        <p className={styles.loading}>Loading…</p>
      ) : (
        <section className={styles.grid}>
          {tracks.map((track) => (
            <TrackCard
              key={track.id}
              track={track}
              artistHref={
                track.streamVaultProfileId
                  ? `/profile/${track.streamVaultProfileId}`
                  : track.artistId && track.artistId.length > 20
                    ? arweaveArtistPath(track.artistId)
                    : undefined
              }
            />
          ))}
        </section>
      )}
      {searched && !loading && !error && tracks.length === 0 && (
        <p className={styles.placeholderBox}>No tracks match your search.</p>
      )}
    </>
  );
}
