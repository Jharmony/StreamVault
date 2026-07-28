import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { arweavePublicDataUrls } from '../lib/arweaveDataGateway';
import { resolveWayfinderDataUrls } from '../lib/wayfinder';

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

function streamCandidatesForTrack(track: Track): string[] {
  const urls: string[] = [];
  const push = (url?: string | null) => {
    const value = String(url || '').trim();
    if (value && !urls.includes(value)) urls.push(value);
  };
  const txId = track.permaTxId || (track.isPermanent ? track.id : '');
  if (txId) {
    for (const url of arweavePublicDataUrls(txId)) push(url);
  }
  push(track.streamUrl);
  return urls;
}

async function streamCandidatesWithWayfinder(track: Track): Promise<string[]> {
  const txId = track.permaTxId || (track.isPermanent ? track.id : '');
  if (!txId) return streamCandidatesForTrack(track);
  try {
    const wayfinderUrls = await resolveWayfinderDataUrls(txId);
    const urls: string[] = [];
    const push = (url?: string | null) => {
      const value = String(url || '').trim();
      if (value && !urls.includes(value)) urls.push(value);
    };
    for (const url of arweavePublicDataUrls(txId)) push(url);
    push(track.streamUrl);
    for (const url of wayfinderUrls) push(url);
    return urls;
  } catch {
    return streamCandidatesForTrack(track);
  }
}

interface PlayerContextValue {
  currentTrack: Track | null;
  isPlaying: boolean;
  progress: number;
  currentTime: number;
  duration: number;
  canSeek: boolean;
  play: (track: Track) => void;
  pause: () => void;
  toggle: () => void;
  seek: (value: number) => void;
  seekTo: (time: number) => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [canSeek, setCanSeek] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamCandidatesRef = useRef<string[]>([]);
  const streamIndexRef = useRef(0);
  const trackDurationRef = useRef(0);
  const pendingResumeTimeRef = useRef(0);

  const startStreamAt = useCallback((index: number, resumeAtSeconds = 0) => {
    const el = audioRef.current;
    const url = streamCandidatesRef.current[index];
    if (!el || !url) return;
    streamIndexRef.current = index;
    pendingResumeTimeRef.current = resumeAtSeconds;
    el.crossOrigin = 'anonymous';
    if (el.src !== url) {
      el.src = url;
      el.load();
    }
    void el.play().catch(console.error);
  }, []);

  const play = useCallback(
    (track: Track) => {
      setCurrentTrack(track);
      setIsPlaying(true);
      setCurrentTime(0);
      setProgress(0);
      const trackDuration = track.duration && Number.isFinite(track.duration) ? track.duration : 0;
      trackDurationRef.current = trackDuration;
      setDuration(trackDuration);
      setCanSeek(trackDuration > 0);
      // Start immediately on static candidates, then prefer Wayfinder when ready.
      const syncCandidates = streamCandidatesForTrack(track);
      streamCandidatesRef.current = syncCandidates;
      streamIndexRef.current = 0;
      if (syncCandidates.length === 0) return;
      startStreamAt(0);

      void streamCandidatesWithWayfinder(track).then((candidates) => {
        if (candidates.length === 0) return;
        streamCandidatesRef.current = candidates;
      });
    },
    [startStreamAt]
  );

  const pause = useCallback(() => {
    setIsPlaying(false);
    audioRef.current?.pause();
  }, []);

  const toggle = useCallback(() => {
    if (!currentTrack) return;
    if (isPlaying) pause();
    else {
      const candidates = streamCandidatesForTrack(currentTrack);
      streamCandidatesRef.current = candidates;
      if (candidates.length === 0) return;
      startStreamAt(streamIndexRef.current);
      setIsPlaying(true);
    }
  }, [currentTrack, isPlaying, pause, startStreamAt]);

  const seek = useCallback((value: number) => {
    setProgress(value);
    const el = audioRef.current;
    if (!el || !Number.isFinite(value)) return;
    const mediaDuration = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : duration;
    if (!mediaDuration) return;
    const nextTime = Math.max(0, Math.min(mediaDuration, (value / 100) * mediaDuration));
    el.currentTime = nextTime;
    setCurrentTime(nextTime);
  }, [duration]);

  const seekTo = useCallback((time: number) => {
    const el = audioRef.current;
    if (!Number.isFinite(time)) return;
    const mediaDuration = el && Number.isFinite(el.duration) && el.duration > 0 ? el.duration : duration;
    const nextTime = Math.max(0, mediaDuration ? Math.min(mediaDuration, time) : time);
    setCurrentTime(nextTime);
    setProgress(mediaDuration ? (nextTime / mediaDuration) * 100 : 0);
    if (el && mediaDuration) {
      try {
        if ('fastSeek' in el && typeof el.fastSeek === 'function') {
          el.fastSeek(nextTime);
        } else {
          el.currentTime = nextTime;
        }
      } catch {
        el.currentTime = nextTime;
      }
    }
  }, [duration]);

  const handleLoadedMetadata = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    const mediaDuration = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 0;
    const nextDuration = mediaDuration || trackDurationRef.current;
    setDuration(nextDuration);
    setCanSeek(nextDuration > 0);
    const resumeAt = pendingResumeTimeRef.current;
    pendingResumeTimeRef.current = 0;
    if (resumeAt > 0 && nextDuration && resumeAt < nextDuration) {
      el.currentTime = resumeAt;
      setCurrentTime(resumeAt);
      setProgress((resumeAt / nextDuration) * 100);
      return;
    }
    const nextTime = Number.isFinite(el.currentTime) ? el.currentTime : 0;
    setCurrentTime(nextTime);
    setProgress(nextDuration ? (nextTime / nextDuration) * 100 : 0);
  }, []);

  const handleDurationChange = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    const mediaDuration = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 0;
    const nextDuration = mediaDuration || trackDurationRef.current;
    setDuration(nextDuration);
    setCanSeek(nextDuration > 0);
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    const nextTime = Number.isFinite(el.currentTime) ? el.currentTime : 0;
    const mediaDuration = (Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 0) || duration || trackDurationRef.current;
    setCurrentTime(nextTime);
    if (mediaDuration) setProgress((nextTime / mediaDuration) * 100);
  }, [duration]);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    setProgress(100);
  }, []);

  const handleError = useCallback(() => {
    const el = audioRef.current;
    const next = streamIndexRef.current + 1;
    if (next < streamCandidatesRef.current.length) {
      startStreamAt(next, el && Number.isFinite(el.currentTime) ? el.currentTime : currentTime);
      return;
    }
    setIsPlaying(false);
  }, [currentTime, startStreamAt]);

  return (
    <PlayerContext.Provider
      value={{ currentTrack, isPlaying, progress, currentTime, duration, canSeek, play, pause, toggle, seek, seekTo }}
    >
      <audio
        ref={audioRef}
        preload="metadata"
        onLoadedMetadata={handleLoadedMetadata}
        onDurationChange={handleDurationChange}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onError={handleError}
        style={{ display: 'none' }}
      />
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}
