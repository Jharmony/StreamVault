import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { ThemeProvider } from './context/ThemeContext';
import { WalletProvider } from './context/WalletContext';
import { PlayerProvider } from './context/PlayerContext';
import { PermawebProvider } from './context/PermawebContext';
import { GeneratedCoverProvider } from './context/GeneratedCoverContext';
import { GeneratedAudioProvider } from './context/GeneratedAudioContext';
import { AudiusAuthProvider } from './context/AudiusAuthContext';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <ThemeProvider>
        <AudiusAuthProvider>
          <WalletProvider>
            <PermawebProvider>
              <GeneratedCoverProvider>
                <GeneratedAudioProvider>
                  <PlayerProvider>
                    <App />
                  </PlayerProvider>
                </GeneratedAudioProvider>
              </GeneratedCoverProvider>
            </PermawebProvider>
          </WalletProvider>
        </AudiusAuthProvider>
      </ThemeProvider>
    </HashRouter>
  </React.StrictMode>
);
