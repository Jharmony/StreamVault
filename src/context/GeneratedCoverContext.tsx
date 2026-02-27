import React, { createContext, useContext, useState, useCallback } from 'react';

type GeneratedCoverContextValue = {
  generatedCover: Blob | null;
  generatedCoverName: string | null;
  setGeneratedCover: (blob: Blob | null, name?: string) => void;
  clearGeneratedCover: () => void;
};

const GeneratedCoverContext = createContext<GeneratedCoverContextValue | null>(null);

export function GeneratedCoverProvider({ children }: { children: React.ReactNode }) {
  const [generatedCover, setCover] = useState<Blob | null>(null);
  const [generatedCoverName, setCoverName] = useState<string | null>(null);

  const setGeneratedCover = useCallback((blob: Blob | null, name?: string) => {
    setCover(blob);
    setCoverName(blob ? (name ?? 'generated-cover.png') : null);
  }, []);

  const clearGeneratedCover = useCallback(() => {
    setCover(null);
    setCoverName(null);
  }, []);

  return (
    <GeneratedCoverContext.Provider
      value={{
        generatedCover,
        generatedCoverName,
        setGeneratedCover,
        clearGeneratedCover,
      }}
    >
      {children}
    </GeneratedCoverContext.Provider>
  );
}

export function useGeneratedCover() {
  const ctx = useContext(GeneratedCoverContext);
  if (!ctx) throw new Error('useGeneratedCover must be used within GeneratedCoverProvider');
  return ctx;
}
