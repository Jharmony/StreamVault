import React, { createContext, useContext, useState, useCallback } from 'react';

type GeneratedAudioContextValue = {
  generatedAudio: Blob | null;
  setGeneratedAudio: (blob: Blob | null) => void;
  clearGeneratedAudio: () => void;
};

const GeneratedAudioContext = createContext<GeneratedAudioContextValue | null>(null);

export function GeneratedAudioProvider({ children }: { children: React.ReactNode }) {
  const [generatedAudio, setGeneratedAudioState] = useState<Blob | null>(null);
  const setGeneratedAudio = useCallback((blob: Blob | null) => setGeneratedAudioState(blob), []);
  const clearGeneratedAudio = useCallback(() => setGeneratedAudioState(null), []);

  return (
    <GeneratedAudioContext.Provider value={{ generatedAudio, setGeneratedAudio, clearGeneratedAudio }}>
      {children}
    </GeneratedAudioContext.Provider>
  );
}

export function useGeneratedAudio() {
  const ctx = useContext(GeneratedAudioContext);
  if (!ctx) throw new Error('useGeneratedAudio must be used within GeneratedAudioProvider');
  return ctx;
}
