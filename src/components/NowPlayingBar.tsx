import { useState } from 'react';
import { createPortal } from 'react-dom';
import { usePlayer } from '../context/PlayerContext';
import { useWallet } from '../context/WalletContext';
import { PublishModal } from './PublishModal';
import styles from './NowPlayingBar.module.css';

export function NowPlayingBar() {
  const { currentTrack, isPlaying, progress, toggle, seek } = usePlayer();
  const { walletType } = useWallet();
  const [isPublishOpen, setIsPublishOpen] = useState(false);

  if (!currentTrack) return null;

  return (
    <div className={styles.bar + ' glass-strong'}>
      <div className={styles.trackInfo}>
        {currentTrack.artwork ? (
          <img src={currentTrack.artwork} alt="" className={styles.artwork} />
        ) : (
          <div className={styles.artworkPlaceholder} aria-hidden="true" />
        )}
        <div className={styles.meta}>
          <span className={styles.title}>{currentTrack.title}</span>
          <span className={styles.artist}>{currentTrack.artist}</span>
        </div>
      </div>
      <div className={styles.controls}>
        <button type="button" className={styles.playBtn} onClick={toggle} aria-label={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          )}
        </button>
        <div className={styles.progressWrap}>
          <input
            type="range"
            min={0}
            max={100}
            value={progress}
            onChange={(e) => seek(Number(e.target.value))}
            className={styles.progress}
          />
        </div>
      </div>
      <div className={styles.badges}>
        <button
          type="button"
          className={styles.publishCta}
          onClick={() => setIsPublishOpen(true)}
          disabled={walletType !== 'arweave'}
          title={walletType !== 'arweave' ? 'Connect Wander to publish to Arweave' : 'Publish permanently to Arweave'}
        >
          Publish
        </button>
        {currentTrack.isPermanent && (
          <span className={styles.permaBadge} title="Permanently stored on Arweave">Permanent</span>
        )}
      </div>
      {isPublishOpen && typeof document !== 'undefined'
        ? createPortal(
            <PublishModal
              track={currentTrack}
              onClose={() => setIsPublishOpen(false)}
              onSuccess={() => setIsPublishOpen(false)}
            />,
            document.body
          )
        : null}
    </div>
  );
}
