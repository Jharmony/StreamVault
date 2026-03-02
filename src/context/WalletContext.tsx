import { createContext, useContext, useState, useCallback, useEffect } from 'react';

export type WalletType = 'arweave' | 'ethereum' | 'solana' | null;

const STORAGE_KEY = 'streamvault:walletType';

interface WalletContextValue {
  walletType: WalletType;
  address: string | null;
  isConnecting: boolean;
  /** Connects the given wallet type. Returns the address on success, null on failure. */
  connect: (type: WalletType) => Promise<string | null>;
  disconnect: () => void;
  isOwnerOfTrack: (artistId: string) => boolean;
}

const WalletContext = createContext<WalletContextValue | null>(null);

async function waitForWanderWallet(timeoutMs = 3000): Promise<any | null> {
  const win = typeof window !== 'undefined' ? (window as any) : null;
  if (win?.arweaveWallet) return win.arweaveWallet;

  return new Promise((resolve) => {
    let settled = false;
    const onLoaded = () => {
      if (settled) return;
      settled = true;
      resolve((window as any).arweaveWallet || null);
    };
    window.addEventListener('arweaveWalletLoaded', onLoaded, { once: true });
    window.setTimeout(() => {
      if (settled) return;
      settled = true;
      window.removeEventListener('arweaveWalletLoaded', onLoaded);
      resolve((window as any).arweaveWallet || null);
    }, timeoutMs);
  });
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [walletType, setWalletType] = useState<WalletType>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // On mount: try to silently restore the previously-connected wallet.
  // Wander will return the address immediately if permissions are still granted.
  // EVM/Solana wallets can also return accounts without prompting.
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as WalletType | null;
    if (!saved) return;

    let cancelled = false;
    (async () => {
      try {
        if (saved === 'arweave') {
          const wallet = await waitForWanderWallet(3000);
          if (cancelled || !wallet) return;
          // Try to get a previously-granted address silently (no popup).
          const addr: string | undefined = await wallet.getActiveAddress().catch(() => undefined);
          if (cancelled || !addr) return;
          setAddress(addr);
          setWalletType('arweave');
        } else if (saved === 'ethereum') {
          const eth = (window as any).ethereum;
          if (!eth || cancelled) return;
          // eth_accounts (no popup) returns already-authorised accounts.
          const accounts: string[] = await eth.request({ method: 'eth_accounts' });
          if (cancelled || !accounts?.length) return;
          setAddress(accounts[0]);
          setWalletType('ethereum');
        } else if (saved === 'solana') {
          const phantom = (window as any).phantom?.solana;
          if (!phantom || cancelled) return;
          // eagerly connect (no popup if already authorised).
          const resp = await phantom.connect({ onlyIfTrusted: true }).catch(() => null);
          if (cancelled || !resp) return;
          setAddress(resp.publicKey?.toString() || null);
          setWalletType('solana');
        }
      } catch {
        // Silently ignore — user will need to manually connect.
        localStorage.removeItem(STORAGE_KEY);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const connect = useCallback(async (type: WalletType): Promise<string | null> => {
    if (!type) return null;
    setIsConnecting(true);
    try {
      let addr: string | null = null;

      if (type === 'arweave') {
        const wallet = await waitForWanderWallet();
        if (!wallet) throw new Error('Wander wallet not detected. Please install the Wander extension.');
        await wallet.connect(['ACCESS_ADDRESS', 'SIGN_TRANSACTION', 'DISPATCH']);
        addr = await wallet.getActiveAddress();

      } else if (type === 'ethereum') {
        const eth = (window as any).ethereum;
        if (!eth) throw new Error('No Ethereum wallet detected. Install MetaMask.');
        const accounts: string[] = await eth.request({ method: 'eth_requestAccounts' });
        addr = accounts?.[0] ?? null;

      } else if (type === 'solana') {
        const phantom = (window as any).phantom?.solana;
        if (!phantom) throw new Error('Phantom wallet not detected.');
        const resp = await phantom.connect();
        addr = resp?.publicKey?.toString() ?? null;
      }

      if (addr) {
        setAddress(addr);
        setWalletType(type);
        localStorage.setItem(STORAGE_KEY, type);
      }
      return addr;
    } catch (e: any) {
      console.error('[wallet] Connect error', e);
      // Surface the error message so callers can display it.
      throw e;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setWalletType(null);
    setAddress(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const isOwnerOfTrack = useCallback(
    (artistId: string) => {
      if (!address) return false;
      return address.toLowerCase() === artistId?.toLowerCase();
    },
    [address]
  );

  return (
    <WalletContext.Provider
      value={{
        walletType,
        address,
        isConnecting,
        connect,
        disconnect,
        isOwnerOfTrack,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within WalletProvider');
  return ctx;
}
