import { createContext, useContext, useState, useCallback } from 'react';

export type WalletType = 'arweave' | 'ethereum' | 'solana' | null;

interface WalletContextValue {
  walletType: WalletType;
  address: string | null;
  isConnecting: boolean;
  connect: (type: WalletType) => Promise<void>;
  disconnect: () => void;
  isOwnerOfTrack: (artistId: string) => boolean;
}

const WalletContext = createContext<WalletContextValue | null>(null);

async function waitForWanderWallet(timeoutMs = 2500): Promise<any | null> {
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

  const connect = useCallback(async (type: WalletType) => {
    if (!type) return;
    setIsConnecting(true);
    try {
      if (type === 'arweave') {
        const wallet = await waitForWanderWallet();
        if (!wallet) throw new Error('Wander wallet not detected.');
        await wallet.connect(['ACCESS_ADDRESS', 'SIGN_TRANSACTION', 'DISPATCH']);
        const addr = await wallet.getActiveAddress();
        setAddress(addr);
        setWalletType('arweave');
      } else if (type === 'ethereum') {
        if ((window as any).ethereum) {
          const accounts = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
          setAddress(accounts[0] || null);
          setWalletType('ethereum');
        }
      } else if (type === 'solana') {
        if ((window as any).phantom?.solana) {
          const resp = await (window as any).phantom.solana.connect();
          setAddress(resp.publicKey?.toString() || null);
          setWalletType('solana');
        }
      }
    } catch (e) {
      console.error('Wallet connect error', e);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setWalletType(null);
    setAddress(null);
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
