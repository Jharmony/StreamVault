import { useEffect, useState, type CSSProperties } from 'react';
import { usePlayer } from '../context/PlayerContext';
import styles from './NowPlayingBar.module.css';

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function NowPlayingBar() {
  const { currentTrack, isPlaying, progress, currentTime, duration, canSeek, toggle, seekTo } = usePlayer();
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [draftTime, setDraftTime] = useState(0);

  useEffect(() => {
    if (!isScrubbing) setDraftTime(currentTime);
  }, [currentTime, isScrubbing]);

  if (!currentTrack) return null;
  const sliderValue = canSeek ? (isScrubbing ? draftTime : currentTime) : 0;
  const sliderProgress = duration ? (sliderValue / duration) * 100 : progress;
  const commitSeek = (value: number) => {
    setIsScrubbing(false);
    setDraftTime(value);
    seekTo(value);
  };

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
            max={duration || 100}
            step={0.1}
            value={sliderValue}
            onPointerDown={() => setIsScrubbing(true)}
            onPointerUp={(e) => commitSeek(Number(e.currentTarget.value))}
            onTouchEnd={(e) => commitSeek(Number(e.currentTarget.value))}
            onBlur={(e) => {
              if (isScrubbing) commitSeek(Number(e.currentTarget.value));
            }}
            onKeyUp={(e) => commitSeek(Number(e.currentTarget.value))}
            onChange={(e) => {
              const next = Number(e.target.value);
              setDraftTime(next);
              if (!isScrubbing) seekTo(next);
            }}
            className={styles.progress}
            disabled={!canSeek}
            style={{ '--progress': `${Math.max(0, Math.min(100, sliderProgress))}%` } as CSSProperties}
            aria-label="Seek track"
          />
          <div className={styles.timeRow}>
            <span>{formatTime(currentTime)}</span>
            <span>{duration ? formatTime(duration) : '--:--'}</span>
          </div>
        </div>
      </div>
      <div className={styles.badges}>
        {currentTrack.isPermanent && (
          <span className={styles.permaBadge} title="Stored on Arweave">On Arweave</span>
        )}
      </div>
    </div>
  );
}
