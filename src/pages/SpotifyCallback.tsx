import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSpotifyAuth } from '../context/SpotifyAuthContext';
import styles from './Home.module.css';

export function SpotifyCallback() {
  const navigate = useNavigate();
  const { completeFromRedirect } = useSpotifyAuth();
  const [message, setMessage] = useState('Completing Spotify connection…');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await completeFromRedirect();
        if (!cancelled) navigate('/', { replace: true });
      } catch (e: any) {
        if (!cancelled) {
          setMessage(String(e?.message || 'Spotify connection failed.'));
          // keep user on callback route so message is visible
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [completeFromRedirect, navigate]);

  return (
    <div className={styles.page}>
      <section className={styles.audiusSection} style={{ marginTop: '32px' }}>
        <h2 className={styles.sectionTitle}>Spotify</h2>
        <p className={styles.sectionSubtitle}>{message}</p>
      </section>
    </div>
  );
}

