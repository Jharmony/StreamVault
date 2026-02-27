import { createContext, useContext, useState, useEffect } from 'react';
import Arweave from 'arweave';
import { connect, createDataItemSigner } from '@permaweb/aoconnect';
// @ts-expect-error - package has default export at runtime
import Permaweb from '@permaweb/libs';
import { useWallet } from './WalletContext';

interface PermawebContextValue {
  libs: ReturnType<typeof Permaweb.init> | null;
  isReady: boolean;
  walletAddress: string | null;
}

const PermawebContext = createContext<PermawebContextValue | null>(null);

export function PermawebProvider({ children }: { children: React.ReactNode }) {
  const { walletType, address } = useWallet();
  const [libs, setLibs] = useState<ReturnType<typeof Permaweb.init> | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  useEffect(() => {
    const wallet = (typeof window !== 'undefined' && (window as any).arweaveWallet) || null;
    const muUrl = (import.meta.env.VITE_AO_MU_URL as string | undefined) || 'https://push.forward.computer';
    const cuUrl = (import.meta.env.VITE_AO_CU_URL as string | undefined) || 'https://forward.computer';
    const gatewayUrl = (import.meta.env.VITE_AO_GATEWAY_URL as string | undefined) || 'https://arweave.net';
    const gqlUrl =
      (import.meta.env.VITE_AO_GQL_URL as string | undefined) ||
      'https://ao-search-gateway.goldsky.com/graphql';
    console.info('[ao] init', {
      muUrl,
      cuUrl,
      gatewayUrl,
      gqlUrl,
      hasWallet: Boolean(wallet),
    });
    const ao = connect({
      MU_URL: muUrl,
      CU_URL: cuUrl,
      GATEWAY_URL: gatewayUrl,
      GRAPHQL_URL: gqlUrl,
    });
    const baseDeps = {
      ao,
      arweave: Arweave.init({}),
    };

    if (!wallet) {
      setLibs(Permaweb.init(baseDeps));
      setWalletAddress(null);
      setIsReady(true);
      return;
    }

    (async () => {
      try {
        const addr = walletType === 'arweave' ? address : await wallet.getActiveAddress?.();
        setWalletAddress(addr || null);
        const useSigner = walletType === 'arweave' && addr;
        const deps = useSigner
          ? { ...baseDeps, signer: createDataItemSigner(wallet) }
          : baseDeps;
        setLibs(Permaweb.init(deps));
      } catch (e) {
        setLibs(Permaweb.init(baseDeps));
        setWalletAddress(null);
      } finally {
        setIsReady(true);
      }
    })();
  }, [walletType, address]);

  return (
    <PermawebContext.Provider value={{ libs, isReady, walletAddress }}>
      {children}
    </PermawebContext.Provider>
  );
}

export function usePermaweb() {
  const ctx = useContext(PermawebContext);
  if (!ctx) throw new Error('usePermaweb must be used within PermawebProvider');
  return ctx;
}
