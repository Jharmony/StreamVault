import { createContext, useContext, useState, useEffect } from 'react';
import Arweave from 'arweave';
import { connect, createDataItemSigner } from '@permaweb/aoconnect';
// @ts-expect-error - package has default export at runtime
import Permaweb from '@permaweb/libs';
import { useWallet } from './WalletContext';
import { useApi } from '@arweave-wallet-kit/react';
import { runHbNodeDiagnostics } from '../lib/hbNode';

interface PermawebContextValue {
  libs: ReturnType<typeof Permaweb.init> | null;
  isReady: boolean;
  walletAddress: string | null;
  getWritableLibs: () => Promise<ReturnType<typeof Permaweb.init> | null>;
}

const PermawebContext = createContext<PermawebContextValue | null>(null);
const DEFAULT_MAINNET_AO_URL = 'https://push.forward.computer';
const DEFAULT_MAINNET_AO_AUTHORITY = 'YUsEnCSlxvOMxRd1qG6rkaPwMgi3xOorfDfYJoMDndA';
const DEFAULT_MAINNET_AO_SCHEDULER = 'n_XZJhUnmldNFo4dhajoPZWhBXuJk-OcQr5JQ49c4Zo';
const AUTH_DISCOVERY_CACHE = new Map<string, { at: number; authority: string | null }>();
const AUTH_DISCOVERY_TTL_MS = 5 * 60 * 1000;

function toGatewayHost(input: string | undefined): string {
  const fallback = 'https://ao-search-gateway.goldsky.com';
  if (!input) return fallback;
  const trimmed = input.trim();
  if (!trimmed) return fallback;
  if (trimmed.endsWith('/graphql')) return trimmed.slice(0, -8);
  return trimmed;
}

function cleanEnv(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

async function discoverNodeAuthority(url: string): Promise<string | null> {
  const cached = AUTH_DISCOVERY_CACHE.get(url);
  const fresh = cached && Date.now() - cached.at < AUTH_DISCOVERY_TTL_MS;
  if (fresh) return cached?.authority || null;
  try {
    const endpoint = `${url.replace(/\/$/, '')}/~meta@1.0/info/address`;
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: { Accept: 'text/plain,application/json' },
    });
    const text = (await res.text()).trim();
    const authority = res.ok && text ? text : null;
    AUTH_DISCOVERY_CACHE.set(url, { at: Date.now(), authority });
    return authority;
  } catch {
    AUTH_DISCOVERY_CACHE.set(url, { at: Date.now(), authority: null });
    return null;
  }
}

export function PermawebProvider({ children }: { children: React.ReactNode }) {
  const { walletType, address } = useWallet();
  const arweaveApi = useApi();
  const hasWalletKitApi = Boolean(arweaveApi && (arweaveApi as any).getActiveAddress);
  const aoDebug = import.meta.env.DEV && String(import.meta.env.VITE_DEBUG_AO || '') === '1';
  const [libs, setLibs] = useState<ReturnType<typeof Permaweb.init> | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletInjectEpoch, setWalletInjectEpoch] = useState(0);

  const getWritableLibs = async (): Promise<ReturnType<typeof Permaweb.init> | null> => {
    const injectedWallet = (typeof window !== 'undefined' && (window as any).arweaveWallet) || null;
    const signerWallet = injectedWallet || (hasWalletKitApi ? arweaveApi : null);
    if (!signerWallet || walletType !== 'arweave' || !address) return null;

    const aoMode = ((import.meta.env.VITE_AO_MODE as string | undefined) || 'mainnet').toLowerCase();
    const muUrl = cleanEnv(import.meta.env.VITE_AO_MU_URL as string | undefined) || DEFAULT_MAINNET_AO_URL;
    const cuUrl = cleanEnv(import.meta.env.VITE_AO_CU_URL as string | undefined) || 'https://forward.computer';
    const gatewayUrl = cleanEnv(import.meta.env.VITE_AO_GATEWAY_URL as string | undefined) || 'https://arweave.net';
    const gqlUrlRaw =
      cleanEnv(import.meta.env.VITE_AO_GQL_URL as string | undefined) ||
      'https://ao-search-gateway.goldsky.com/graphql';
    const aoUrl = cleanEnv(import.meta.env.VITE_AO_URL as string | undefined) || DEFAULT_MAINNET_AO_URL;
    const aoScheduler =
      cleanEnv(import.meta.env.VITE_AO_SCHEDULER as string | undefined) ||
      DEFAULT_MAINNET_AO_SCHEDULER;
    const discoveredAuthority = aoMode === 'mainnet' ? await discoverNodeAuthority(aoUrl) : null;
    const aoAuthority =
      discoveredAuthority ||
      cleanEnv(import.meta.env.VITE_AO_AUTHORITY as string | undefined) ||
      DEFAULT_MAINNET_AO_AUTHORITY;
    const profileGateway = toGatewayHost(gqlUrlRaw);

    const ao =
      aoMode === 'mainnet'
        ? connect({
          MODE: 'mainnet',
          URL: aoUrl,
          SCHEDULER: aoScheduler,
        } as any)
        : connect({
          MODE: 'legacy',
          MU_URL: muUrl,
          CU_URL: cuUrl,
          GATEWAY_URL: gatewayUrl,
          GRAPHQL_URL: gqlUrlRaw,
        });

    return Permaweb.init({
      ao,
      arweave: Arweave.init({}),
      gateway: profileGateway,
      node: {
        url: aoUrl,
        authority: aoAuthority,
        scheduler: aoScheduler,
      },
      signer: createDataItemSigner(signerWallet),
    });
  };

  useEffect(() => {
    const onWalletLoaded = () => setWalletInjectEpoch((n) => n + 1);
    if (typeof window !== 'undefined') {
      window.addEventListener('arweaveWalletLoaded', onWalletLoaded as any);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('arweaveWalletLoaded', onWalletLoaded as any);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const injectedWallet = (typeof window !== 'undefined' && (window as any).arweaveWallet) || null;
      const signerWallet = injectedWallet || (hasWalletKitApi ? arweaveApi : null);
      const aoMode = ((import.meta.env.VITE_AO_MODE as string | undefined) || 'mainnet').toLowerCase();
      const muUrl = cleanEnv(import.meta.env.VITE_AO_MU_URL as string | undefined) || 'https://push.forward.computer';
      const cuUrl = cleanEnv(import.meta.env.VITE_AO_CU_URL as string | undefined) || 'https://forward.computer';
      const gatewayUrl = cleanEnv(import.meta.env.VITE_AO_GATEWAY_URL as string | undefined) || 'https://arweave.net';
      const gqlUrlRaw =
        cleanEnv(import.meta.env.VITE_AO_GQL_URL as string | undefined) ||
        'https://ao-search-gateway.goldsky.com/graphql';
      const aoUrl = cleanEnv(import.meta.env.VITE_AO_URL as string | undefined) || DEFAULT_MAINNET_AO_URL;
      const aoScheduler =
        cleanEnv(import.meta.env.VITE_AO_SCHEDULER as string | undefined) ||
        DEFAULT_MAINNET_AO_SCHEDULER;
      let aoAuthority =
        cleanEnv(import.meta.env.VITE_AO_AUTHORITY as string | undefined) ||
        DEFAULT_MAINNET_AO_AUTHORITY;
      const gqlUrl = gqlUrlRaw;
      const profileGateway = toGatewayHost(gqlUrlRaw);

      // If authority is intentionally left blank (or default likely wrong for custom local node),
      // try to discover it from the node's meta endpoint.
      if (aoMode === 'mainnet') {
        aoAuthority = (await discoverNodeAuthority(aoUrl)) || aoAuthority;
      }

      if (aoDebug) {
        console.info('[ao] init', {
          aoMode,
          muUrl,
          cuUrl,
          aoUrl,
          aoScheduler,
          aoAuthority,
          gatewayUrl,
          gqlUrl,
          profileGateway,
          hasWallet: Boolean(signerWallet),
        });
      }
      const ao =
        aoMode === 'mainnet'
          ? connect({
            MODE: 'mainnet',
            URL: aoUrl,
            SCHEDULER: aoScheduler,
          } as any)
          : connect({
            MODE: 'legacy',
            MU_URL: muUrl,
            CU_URL: cuUrl,
            GATEWAY_URL: gatewayUrl,
            GRAPHQL_URL: gqlUrl,
          });
      const baseDeps = {
        ao,
        arweave: Arweave.init({}),
        gateway: profileGateway,
        node: {
          url: aoUrl,
          authority: aoAuthority,
          scheduler: aoScheduler,
        },
      };

      if (!signerWallet) {
        if (cancelled) return;
        setLibs(Permaweb.init(baseDeps));
        setWalletAddress(null);
        setIsReady(true);
        return;
      }

      try {
        const addr = walletType === 'arweave' ? address : await signerWallet.getActiveAddress?.();
        if (cancelled) return;
        setWalletAddress(addr || null);
        const useSigner = walletType === 'arweave' && addr;
        const deps = useSigner
          ? { ...baseDeps, signer: createDataItemSigner(signerWallet) }
          : baseDeps;
        setLibs(Permaweb.init(deps));
      } catch {
        if (cancelled) return;
        setLibs(Permaweb.init(baseDeps));
        setWalletAddress(null);
      } finally {
        if (!cancelled) setIsReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [walletType, address, walletInjectEpoch, hasWalletKitApi]);

  useEffect(() => {
    if (!(import.meta.env.DEV && String(import.meta.env.VITE_RUN_HB_DIAG || '') === '1')) return;
    const pid =
      String(import.meta.env.VITE_HB_DIAG_PID || '').trim() ||
      '7lKyXPtsnJBVCcoz9QFpU2ZKbJD_wUKdxmzz7Rs9e-k';
    const node =
      String(import.meta.env.VITE_AO_URL || '').trim() ||
      DEFAULT_MAINNET_AO_URL;
    runHbNodeDiagnostics(pid, node).catch((e) => {
      console.warn('[hb:diag] failed', e);
    });
  }, []);

  return (
    <PermawebContext.Provider value={{ libs, isReady, walletAddress, getWritableLibs }}>
      {children}
    </PermawebContext.Provider>
  );
}

export function usePermaweb() {
  const ctx = useContext(PermawebContext);
  if (!ctx) throw new Error('usePermaweb must be used within PermawebProvider');
  return ctx;
}
