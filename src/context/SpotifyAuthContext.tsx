import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  beginSpotifyLogin,
  clearSpotifyOAuthSession,
  exchangeSpotifyCodeForTokens,
  fetchSpotifyMe,
  fetchSpotifySavedTracks,
  finalizeSpotifyOAuthUrlCleanup,
  getSpotifyRedirectUriForExchange,
  getDefaultSpotifyRedirectUri,
  getExpectedSpotifyState,
  isTokenExpired,
  loadStoredSpotifyTokens,
  markSpotifyOAuthCodeProcessed,
  parseOAuthParams,
  refreshSpotifyAccessToken,
  storeSpotifyTokens,
  wasSpotifyOAuthCodeProcessed,
  normalizeSpotifyRedirectUri,
  type SpotifyAuthTokens,
  type SpotifySavedTrackItem,
  type SpotifyUserProfile,
} from '../lib/spotify';

type SpotifyAuthStatus = 'configured' | 'connecting' | 'connected' | 'error';

type SpotifyImportItem = {
  id: string;
  title: string;
  subtitle: string;
  imageUrl?: string;
  spotifyUrl?: string;
};

interface SpotifyAuthContextValue {
  status: SpotifyAuthStatus;
  isInitialized: boolean;
  authError: string | null;
  clientIdConfigured: boolean;
  profile: SpotifyUserProfile | null;
  imports: SpotifyImportItem[];
  importsLoading: boolean;
  connect: () => void;
  disconnect: () => void;
  completeFromRedirect: () => Promise<void>;
  refreshIfNeeded: () => Promise<SpotifyAuthTokens | null>;
  loadImports: () => Promise<void>;
}

const SpotifyAuthContext = createContext<SpotifyAuthContextValue | null>(null);

function mapSavedTracks(items: SpotifySavedTrackItem[]): SpotifyImportItem[] {
  return items.map((item) => {
    const t = item.track;
    const imageUrl = t.album?.images?.[0]?.url;
    const subtitle = `${t.artists?.map((a) => a.name).join(', ') || 'Unknown artist'} • ${t.album?.name || 'Unknown album'}`;
    return {
      id: t.id,
      title: t.name,
      subtitle,
      imageUrl,
      spotifyUrl: t.external_urls?.spotify,
    };
  });
}

export function SpotifyAuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SpotifyAuthStatus>('configured');
  const [isInitialized, setIsInitialized] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [tokens, setTokens] = useState<SpotifyAuthTokens | null>(null);
  const [profile, setProfile] = useState<SpotifyUserProfile | null>(null);
  const [imports, setImports] = useState<SpotifyImportItem[]>([]);
  const [importsLoading, setImportsLoading] = useState(false);

  const clientId = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_SPOTIFY_CLIENT_ID : undefined;
  const clientIdConfigured = Boolean(clientId?.trim());
  const redirectUri = useMemo(() => {
    const override = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_SPOTIFY_REDIRECT_URI : undefined;
    const raw = String(override || '').trim() || getDefaultSpotifyRedirectUri();
    return normalizeSpotifyRedirectUri(raw) || getDefaultSpotifyRedirectUri();
  }, []);

  const scope = useMemo(
    () =>
      [
        'user-read-email',
        'user-read-private',
        'user-library-read',
      ].join(' '),
    []
  );

  useEffect(() => {
    const stored = loadStoredSpotifyTokens();
    setTokens(stored);
    setIsInitialized(true);
  }, []);

  const refreshIfNeeded = useCallback(async () => {
    if (!clientId?.trim()) return null;
    const current = loadStoredSpotifyTokens();
    if (!current) return null;
    if (!isTokenExpired(current)) return current;
    if (!current.refreshToken) return null;
    const next = await refreshSpotifyAccessToken({ clientId: clientId.trim(), refreshToken: current.refreshToken });
    storeSpotifyTokens(next);
    setTokens(next);
    return next;
  }, [clientId]);

  const hydrateProfile = useCallback(
    async (accessToken: string) => {
      const me = await fetchSpotifyMe(accessToken);
      setProfile(me);
      setStatus('connected');
      setAuthError(null);
    },
    []
  );

  useEffect(() => {
    if (!isInitialized) return;
    if (!tokens?.accessToken) {
      setProfile(null);
      setImports([]);
      setStatus(clientIdConfigured ? 'configured' : 'error');
      if (!clientIdConfigured) setAuthError('Set VITE_SPOTIFY_CLIENT_ID to enable Spotify connect.');
      return;
    }

    refreshIfNeeded()
      .then((t) => (t?.accessToken ? hydrateProfile(t.accessToken) : null))
      .catch(() => {
        storeSpotifyTokens(null);
        setTokens(null);
        setProfile(null);
        setImports([]);
        setStatus(clientIdConfigured ? 'configured' : 'error');
      });
  }, [clientIdConfigured, hydrateProfile, isInitialized, refreshIfNeeded, tokens?.accessToken]);

  const connect = useCallback(() => {
    if (!clientId?.trim()) {
      setAuthError('Spotify client id is missing.');
      setStatus('error');
      return;
    }
    setAuthError(null);
    setStatus('connecting');
    beginSpotifyLogin({ clientId: clientId.trim(), redirectUri, scope }).catch((e: any) => {
      setAuthError(String(e?.message || 'Failed to start Spotify OAuth.'));
      setStatus('error');
    });
  }, [clientId, redirectUri, scope]);

  const disconnect = useCallback(() => {
    storeSpotifyTokens(null);
    setTokens(null);
    setProfile(null);
    setImports([]);
    setAuthError(null);
    setStatus(clientIdConfigured ? 'configured' : 'error');
  }, [clientIdConfigured]);

  const completeFromRedirect = useCallback(async () => {
    if (!clientId?.trim()) throw new Error('Spotify client id is missing.');

    const { code, state, error } = parseOAuthParams(
      typeof window !== 'undefined' ? window.location.search : '',
      typeof window !== 'undefined' ? window.location.hash : ''
    );

    if (error) {
      setAuthError(`Spotify OAuth error: ${error}`);
      setStatus('error');
      return;
    }

    if (!code || !state) {
      setAuthError('Missing Spotify OAuth response parameters.');
      setStatus('error');
      return;
    }

    // In dev, React.StrictMode runs effects twice, which can trigger two exchanges for the same one-time code.
    // Also, our /spotify/callback -> /#/spotify/callback shim can cause rapid re-entry during redirects.
    if (wasSpotifyOAuthCodeProcessed(code)) {
      clearSpotifyOAuthSession();
      finalizeSpotifyOAuthUrlCleanup();
      return;
    }

    const expected = getExpectedSpotifyState();
    if (!expected || expected !== state) {
      setAuthError('Spotify OAuth state mismatch. Please try again.');
      setStatus('error');
      return;
    }

    setStatus('connecting');
    try {
      markSpotifyOAuthCodeProcessed(code);
      const next = await exchangeSpotifyCodeForTokens({
        clientId: clientId.trim(),
        redirectUri: getSpotifyRedirectUriForExchange(redirectUri),
        code,
      });
      if (!next.accessToken) throw new Error('Spotify returned an empty access token.');
      storeSpotifyTokens(next);
      setTokens(next);
      await hydrateProfile(next.accessToken);
    } finally {
      clearSpotifyOAuthSession();
      finalizeSpotifyOAuthUrlCleanup();
    }
  }, [clientId, hydrateProfile, redirectUri]);

  const loadImports = useCallback(async () => {
    if (!clientId?.trim()) return;
    setImportsLoading(true);
    try {
      const t = await refreshIfNeeded();
      if (!t?.accessToken) throw new Error('Connect Spotify to import metadata.');
      const saved = await fetchSpotifySavedTracks(t.accessToken, 12);
      setImports(mapSavedTracks(saved));
      setAuthError(null);
    } catch (e: any) {
      setAuthError(String(e?.message || 'Failed to load Spotify imports.'));
      setImports([]);
    } finally {
      setImportsLoading(false);
    }
  }, [clientId, refreshIfNeeded]);

  const value: SpotifyAuthContextValue = useMemo(
    () => ({
      status,
      isInitialized,
      authError,
      clientIdConfigured,
      profile,
      imports,
      importsLoading,
      connect,
      disconnect,
      completeFromRedirect,
      refreshIfNeeded,
      loadImports,
    }),
    [
      status,
      isInitialized,
      authError,
      clientIdConfigured,
      profile,
      imports,
      importsLoading,
      connect,
      disconnect,
      completeFromRedirect,
      refreshIfNeeded,
      loadImports,
    ]
  );

  return <SpotifyAuthContext.Provider value={value}>{children}</SpotifyAuthContext.Provider>;
}

export function useSpotifyAuth() {
  const ctx = useContext(SpotifyAuthContext);
  if (!ctx) throw new Error('useSpotifyAuth must be used within SpotifyAuthProvider');
  return ctx;
}

