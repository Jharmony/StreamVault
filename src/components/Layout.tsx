import React from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import { useAudiusAuth } from '../context/AudiusAuthContext';
import styles from './Layout.module.css';

export function Layout({ children }: { children: React.ReactNode }) {
  const { walletType, address, connect, disconnect, isConnecting } = useWallet();
  const { audiusUser, login, logout, apiKeyConfigured } = useAudiusAuth();
  const [showWalletMenu, setShowWalletMenu] = React.useState(false);
  const [showAudiusMenu, setShowAudiusMenu] = React.useState(false);

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link to="/" className={styles.logo}>
            <img
              src="/streamvault-logo.png"
              alt="StreamVault"
              className={styles.logoMark}
            />
            <div className={styles.logoTextGroup}>
              <span className={styles.logoText}>StreamVault</span>
              <span className={styles.tagline}>Stream anywhere. Preserve forever.</span>
            </div>
          </Link>
          <nav className={styles.nav}>
            <Link to="/" className={styles.navLink}>Discover</Link>
            <Link to="/creator-tools" className={styles.navLink}>Creator tools</Link>
            {address && (
              <Link to={`/profile/${address}`} className={styles.navLink}>Profile</Link>
            )}
            {apiKeyConfigured && (
              <div className={styles.walletWrap}>
                {audiusUser ? (
                  <>
                    <button
                      type="button"
                      className={styles.walletBtn}
                      onClick={() => setShowAudiusMenu(!showAudiusMenu)}
                    >
                      @{audiusUser.handle}
                    </button>
                    {showAudiusMenu && (
                      <div className={styles.walletMenu + ' glass-strong'}>
                        <span className={styles.walletMenuType}>Audius</span>
                        <button type="button" className={styles.walletMenuAction} onClick={() => { logout(); setShowAudiusMenu(false); }}>
                          Log out
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <button type="button" className={styles.audiusLoginBtn} onClick={login}>
                    Log in with Audius
                  </button>
                )}
              </div>
            )}
            <div className={styles.walletWrap}>
              <button
                type="button"
                className={styles.walletBtn}
                onClick={() => setShowWalletMenu(!showWalletMenu)}
                disabled={isConnecting}
              >
                {isConnecting
                  ? 'Connecting…'
                  : address
                    ? `${address.slice(0, 6)}…${address.slice(-4)}`
                    : 'Connect wallet'}
              </button>
              {showWalletMenu && (
                <div className={styles.walletMenu + ' glass-strong'}>
                  {address ? (
                    <>
                      <span className={styles.walletMenuType}>{walletType}</span>
                      <button type="button" className={styles.walletMenuAction} onClick={() => { disconnect(); setShowWalletMenu(false); }}>
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" className={styles.walletMenuAction} onClick={() => { connect('arweave'); setShowWalletMenu(false); }}>
                        Arweave (Wander)
                      </button>
                      <button type="button" className={styles.walletMenuAction} onClick={() => { connect('ethereum'); setShowWalletMenu(false); }}>
                        Ethereum
                      </button>
                      <button type="button" className={styles.walletMenuAction} onClick={() => { connect('solana'); setShowWalletMenu(false); }}>
                        Solana
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </nav>
        </div>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
