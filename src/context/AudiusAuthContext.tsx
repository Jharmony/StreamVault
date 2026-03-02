/**
 * Log in with Audius (OAuth) — full Audius experience.
 * Persists user in localStorage; pre-fills permaweb profile Audius handle.
 */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'streamvault:audius_user';

export interface AudiusAuthUser {
  userId: number;
  sub: number;
  handle: string;
  name: string;
  email?: string;
  verified: boolean;
  profilePicture?: { '150x150'?: string; '480x480'?: string; '1000x1000'?: string } | null;
  iat?: string;
}

interface AudiusAuthContextValue {
  audiusUser: AudiusAuthUser | null;
  isInitialized: boolean;
  login: () => void;
  logout: () => void;
  apiKeyConfigured: boolean;
}

const AudiusAuthContext = createContext<AudiusAuthContextValue | null>(null);

function loadStoredUser(): AudiusAuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AudiusAuthUser;
  } catch {
    return null;
  }
}

function storeUser(user: AudiusAuthUser | null) {
  if (typeof window === 'undefined') return;
  if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  else localStorage.removeItem(STORAGE_KEY);
}

export function AudiusAuthProvider({ children }: { children: React.ReactNode }) {
  const [audiusUser, setAudiusUser] = useState<AudiusAuthUser | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const apiKey = typeof import.meta !== 'undefined' && import.meta.env?.VITE_AUDIUS_API_KEY;
  const apiKeyConfigured = Boolean(apiKey?.trim());

  useEffect(() => {
    setAudiusUser(loadStoredUser());
    setIsInitialized(true);
  }, []);

  const login = useCallback(() => {
    if (!apiKey?.trim()) {
      console.warn('[AudiusAuth] No VITE_AUDIUS_API_KEY set. Get one at https://audius.co/settings');
      return;
    }
    (async () => {
      try {
        const { sdk } = await import('@audius/sdk');
        const appName = import.meta.env?.VITE_AUDIUS_APP_NAME ?? 'StreamVault';
        const audiusSdk = sdk({
          apiKey: apiKey.trim(),
          appName,
        });
        if (!audiusSdk.oauth) {
          console.error('[AudiusAuth] OAuth not available');
          return;
        }
        audiusSdk.oauth.init({
          // Audius SDK types use a decoded JWT profile where userId/sub may be strings.
          successCallback: (profile: any, _encodedJwt: string) => {
            const rawUserId = profile?.userId ?? profile?.sub;
            const rawSub = profile?.sub ?? profile?.userId;
            const userId = Number(rawUserId);
            const sub = Number(rawSub);
            const user: AudiusAuthUser = {
              userId: Number.isFinite(userId) ? userId : 0,
              sub: Number.isFinite(sub) ? sub : Number.isFinite(userId) ? userId : 0,
              handle: String(profile?.handle ?? ''),
              name: String(profile?.name ?? ''),
              email: profile.email,
              verified: Boolean(profile?.verified),
              profilePicture: profile.profilePicture ?? null,
              iat: profile.iat,
            };
            setAudiusUser(user);
            storeUser(user);
          },
          errorCallback: (err: string) => {
            console.error('[AudiusAuth] Login error:', err);
          },
        });
        audiusSdk.oauth.login({ scope: 'read' });
      } catch (e) {
        console.error('[AudiusAuth] SDK init or login failed', e);
      }
    })();
  }, [apiKey]);

  const logout = useCallback(() => {
    setAudiusUser(null);
    storeUser(null);
  }, []);

  return (
    <AudiusAuthContext.Provider
      value={{
        audiusUser,
        isInitialized,
        login,
        logout,
        apiKeyConfigured,
      }}
    >
      {children}
    </AudiusAuthContext.Provider>
  );
}

export function useAudiusAuth() {
  const ctx = useContext(AudiusAuthContext);
  if (!ctx) throw new Error('useAudiusAuth must be used within AudiusAuthProvider');
  return ctx;
}
