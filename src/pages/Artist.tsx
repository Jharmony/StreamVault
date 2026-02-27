import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getUserById, getUserTracks, getStreamUrl, getArtworkUrl, type AudiusTrack } from '../lib/audius';
import type { Track } from '../context/PlayerContext';
import { TrackCard } from '../components/TrackCard';
import { PublishModal } from '../components/PublishModal';
import styles from './Artist.module.css';

function mapAudiusToTrack(a: AudiusTrack): Track {
  return {
    id: a.id,
    title: a.title,
    artist: a.user.name,
    artistId: a.user.id,
    artwork: getArtworkUrl(a) || undefined,
    streamUrl: getStreamUrl(a),
    duration: a.duration,
  };
}

export function Artist() {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<any | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishTrack, setPublishTrack] = useState<Track | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [u, t] = await Promise.all([getUserById(id), getUserTracks(id)]);
        if (!cancelled) {
          setUser(u || null);
          setTracks((t || []).map(mapAudiusToTrack));
        }
      } catch (e) {
        if (!cancelled) { setUser(null); setTracks([]); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) return <div className={styles.loading}>Loading…</div>;
  if (!user) return <div className={styles.loading}>Artist not found.</div>;

  return (
    <div className={styles.page}>
      <header className={styles.header + ' glass'}>
        <div
          className={styles.banner}
          style={{
            backgroundImage: user.cover_photo?.['640x'] ? `url(${user.cover_photo['640x']})` : undefined,
          }}
        />
        <div className={styles.profile}>
          {user.profile_picture?.['150x150'] ? (
            <img src={user.profile_picture['150x150']} alt="" className={styles.avatar} />
          ) : (
            <div className={styles.avatarPlaceholder} aria-hidden="true" />
          )}
          <div>
            <h1 className={styles.name}>{user.name}</h1>
            <p className={styles.handle}>@{user.handle}</p>
            <p className={styles.meta}>{user.track_count} tracks</p>
          </div>
        </div>
      </header>

      <section className={styles.tracks}>
        <h2 className={styles.sectionTitle}>Tracks</h2>
        <div className={styles.grid}>
          {tracks.map((track) => (
            <TrackCard
              key={track.id}
              track={track}
              onPublishClick={() => setPublishTrack(track)}
            />
          ))}
        </div>
      </section>

      {publishTrack && (
        <PublishModal
          track={publishTrack}
          onClose={() => setPublishTrack(null)}
          onSuccess={() => setPublishTrack(null)}
        />
      )}
    </div>
  );
}
