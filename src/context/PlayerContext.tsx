import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

export interface Track {
  id: string;
  title: string;
  artist: string;
  artistId: string;
  artwork?: string;
  streamUrl?: string;
  duration?: number;
  isPermanent?: boolean;
  permaTxId?: string;
  assetId?: string;
}

interface PlayerContextValue {
  currentTrack: Track | null;
  isPlaying: boolean;
  progress: number;
  play: (track: Track) => void;
  pause: () => void;
  toggle: () => void;
  seek: (value: number) => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const play = useCallback((track: Track) => {
    setCurrentTrack(track);
    setIsPlaying(true);
    if (track.streamUrl) {
      if (!audioRef.current) audioRef.current = new Audio();
      audioRef.current.crossOrigin = 'anonymous';
      audioRef.current.src = track.streamUrl;
      audioRef.current.play().catch(console.error);
    }
  }, []);

  const pause = useCallback(() => {
    setIsPlaying(false);
    audioRef.current?.pause();
  }, []);

  const toggle = useCallback(() => {
    if (!currentTrack) return;
    if (isPlaying) pause();
    else if (currentTrack.streamUrl) {
      if (!audioRef.current) audioRef.current = new Audio();
      audioRef.current.crossOrigin = 'anonymous';
      audioRef.current.src = currentTrack.streamUrl;
      audioRef.current.play().catch(console.error);
      setIsPlaying(true);
    }
  }, [currentTrack, isPlaying, pause]);

  const seek = useCallback((value: number) => {
    setProgress(value);
    if (audioRef.current && !isNaN(value)) {
      const t = (value / 100) * (audioRef.current.duration || 0);
      audioRef.current.currentTime = t;
    }
  }, []);

  React.useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTimeUpdate = () => {
      if (el.duration) setProgress((el.currentTime / el.duration) * 100);
    };
    const onEnded = () => setIsPlaying(false);
    el.addEventListener('timeupdate', onTimeUpdate);
    el.addEventListener('ended', onEnded);
    return () => {
      el.removeEventListener('timeupdate', onTimeUpdate);
      el.removeEventListener('ended', onEnded);
    };
  }, [currentTrack?.id]);

  return (
    <PlayerContext.Provider
      value={{ currentTrack, isPlaying, progress, play, pause, toggle, seek }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}
