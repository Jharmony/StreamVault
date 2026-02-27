import { useState } from 'react';
import type { Track } from '../context/PlayerContext';
import { usePermaweb } from '../context/PermawebContext';
import { useWallet } from '../context/WalletContext';
import { useGeneratedCover } from '../context/GeneratedCoverContext';
import { useGeneratedAudio } from '../context/GeneratedAudioContext';
import {
  PublishTier,
  type PublishResult,
} from '../lib/arweave';
import { publishSampleToArweave, publishFullAsAtomicAsset } from '../lib/publish';
import styles from './PublishModal.module.css';

interface PublishModalProps {
  track: Track;
  onClose: () => void;
  onSuccess?: (result: PublishResult) => void;
}

export function PublishModal({ track, onClose, onSuccess }: PublishModalProps) {
  const { libs } = usePermaweb();
  const { address, walletType } = useWallet();
  const { generatedCover, clearGeneratedCover } = useGeneratedCover();
  const { generatedAudio, clearGeneratedAudio } = useGeneratedAudio();
  const [tier, setTier] = useState<PublishTier>('sample');
  const [status, setStatus] = useState<'idle' | 'uploading' | 'confirming' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<PublishResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sampleFile, setSampleFile] = useState<File | null>(null);
  const [fullFile, setFullFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [royaltiesBps, setRoyaltiesBps] = useState<number>(500);
  const [useTurbo, setUseTurbo] = useState(false);
  const [turboToken, setTurboToken] = useState<'arweave' | 'ethereum' | 'base-eth' | 'solana'>('arweave');
  const [isAutoSample, setIsAutoSample] = useState(true);
  const [copiedTxId, setCopiedTxId] = useState(false);
  const [appendWarning, setAppendWarning] = useState<string | null>(null);

  const SAMPLE_MAX_BYTES = 100 * 1024;

  const handleCopyTxId = async (txId: string) => {
    try {
      await navigator.clipboard.writeText(txId);
      setCopiedTxId(true);
      window.setTimeout(() => setCopiedTxId(false), 1500);
    } catch (e) {
      console.warn('[publish] Clipboard copy failed', e);
    }
  };

  const fetchSampleFromStream = async (streamUrl: string, maxBytes = SAMPLE_MAX_BYTES) => {
    const res = await fetch(streamUrl, {
      headers: { Range: `bytes=0-${maxBytes - 1}` },
    });
    if (!res.ok) throw new Error('Unable to fetch a sample from the stream.');
    const contentType = res.headers.get('content-type') || 'audio/mpeg';
    if (!contentType.startsWith('audio/')) {
      throw new Error('Stream did not return audio data.');
    }
    const data = await res.arrayBuffer();
    return new Blob([data.slice(0, maxBytes)], { type: contentType });
  };

  const handlePublish = async () => {
    if (walletType !== 'arweave' || !address || !libs) {
      setErrorMessage('Connect Wander (Arweave) to publish permanently.');
      setStatus('error');
      return;
    }
    setStatus('uploading');
    setErrorMessage(null);
    setAppendWarning(null);
    try {
      let res: PublishResult;
      if (tier === 'sample') {
        let sample = sampleFile;
        if (!sample && isAutoSample && track.streamUrl) {
          sample = await fetchSampleFromStream(track.streamUrl);
        }
        if (!sample) {
          setStatus('error');
          setErrorMessage('Upload a short sound bite under 100KB or use auto-sample.');
          return;
        }
        if (sample.type && !sample.type.startsWith('audio/')) {
          setStatus('error');
          setErrorMessage('Sample must be an audio file.');
          return;
        }
        if (sample.size > SAMPLE_MAX_BYTES) {
          setStatus('error');
          setErrorMessage('Sample must be under 100KB. Try exporting a smaller MP3/OPUS.');
          return;
        }
        res = await publishSampleToArweave({
          sample,
          title: `${track.title} (15s sample)`,
          artist: track.artist,
          durationSeconds: 15,
        });
      } else {
        const effectiveAudio = fullFile || (generatedAudio ? new File([generatedAudio], 'generated-beat.wav', { type: 'audio/wav' }) : null);
        if (!effectiveAudio) {
          setStatus('error');
          setErrorMessage('Choose an audio file to publish as an Atomic Asset, or generate a beat in Creator tools and use "Use in Publish".');
          return;
        }
        if (useTurbo) {
          const needWallet =
            turboToken === 'arweave'
              ? walletType === 'arweave'
              : turboToken === 'solana'
                ? walletType === 'solana'
                : walletType === 'ethereum';
          if (!needWallet) {
            setStatus('error');
            setErrorMessage('Connect the matching wallet for the selected Turbo payment option.');
            return;
          }
        }
        if (!useTurbo && effectiveAudio.size > 10 * 1024 * 1024) {
          setStatus('error');
          setErrorMessage('Full asset must be under ~10MB unless using Turbo.');
          return;
        }
        res = await publishFullAsAtomicAsset(
          {
            audio: effectiveAudio,
            title: track.title,
            artist: track.artist,
            description: description.trim() || undefined,
            artworkUrl: (coverFile || generatedCover) ? undefined : track.artwork,
            artworkFile: (coverFile || generatedCover) || undefined,
            royaltiesBps: Number.isFinite(royaltiesBps) ? royaltiesBps : undefined,
            useTurbo,
            turboPaymentToken: turboToken,
          },
          address,
          { libs }
        );
      }
      if (res.success && tier === 'full') {
        clearGeneratedCover();
        clearGeneratedAudio();
      }
      setResult(res);
      setStatus(res.success ? 'done' : 'error');
      if (res.error) setErrorMessage(res.error);
      console.info('[publish] Result', res);
      if (res.success && res.txId && address) {
        try {
          if (walletType === 'arweave' && libs?.getProfileByWalletAddress && libs?.addToZone) {
            const profile = await libs.getProfileByWalletAddress(address);
            if (profile?.id) {
              await libs.addToZone(
                {
                  path: 'Samples[]',
                  data: {
                    txId: res.txId,
                    title: track.title,
                    artist: track.artist,
                    permawebUrl: res.permawebUrl,
                    arioUrl: res.arioUrl,
                    createdAt: new Date().toISOString(),
                  },
                },
                profile.id
              );
            } else {
              setAppendWarning('Create a permaweb profile to store this on-chain.');
            }
          } else if (walletType === 'arweave') {
            setAppendWarning('Permaweb profile tools are not ready yet. Try again later.');
          }
          const key = `streamvault:samples:${address.toLowerCase()}`;
          const existing = JSON.parse(localStorage.getItem(key) || '[]') as Array<Record<string, any>>;
          const entry = {
            txId: res.txId,
            title: track.title,
            artist: track.artist,
            permawebUrl: res.permawebUrl,
            arioUrl: res.arioUrl,
            createdAt: new Date().toISOString(),
          };
          localStorage.setItem(key, JSON.stringify([entry, ...existing].slice(0, 50)));
        } catch (e) {
          console.warn('[publish] Failed to persist local record', e);
          setAppendWarning('Upload saved locally only. Create a permaweb profile to store it on-chain.');
        }
      }
      if (res.success && onSuccess) onSuccess(res);
    } catch (e: any) {
      setResult({ success: false, error: e?.message || 'Publish failed' });
      setErrorMessage(e?.message || 'Publish failed');
      setStatus('error');
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal + ' glass-strong'} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Publish to Arweave</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">×</button>
        </div>
        <p className={styles.subtitle}>Creator-first: choose how to preserve this track permanently.</p>
        {status === 'uploading' && (
          <p className={styles.hint}>
            {tier === 'sample'
              ? 'Uploading sample to Arweave…'
              : 'Uploading audio & minting atomic asset on Arweave…'}
          </p>
        )}

        <div className={styles.trackPreview}>
          {track.artwork ? (
            <img src={track.artwork} alt="" className={styles.previewArt} />
          ) : (
            <div className={styles.previewArtPlaceholder} aria-hidden="true" />
          )}
          <div>
            <strong>{track.title}</strong>
            <span className={styles.previewArtist}>{track.artist}</span>
          </div>
        </div>

        <div className={styles.tiers}>
          <label className={styles.tierCard + (tier === 'sample' ? ' ' + styles.tierActive : '')}>
            <input type="radio" name="tier" checked={tier === 'sample'} onChange={() => setTier('sample')} />
            <span className={styles.tierTitle}>Sample — Free</span>
            <span className={styles.tierDesc}>15s preview · Under 100KB · Permanent link · Collectible in-app</span>
          </label>
          <label className={styles.tierCard + (tier === 'full' ? ' ' + styles.tierActive : '')}>
            <input type="radio" name="tier" checked={tier === 'full'} onChange={() => setTier('full')} />
            <span className={styles.tierTitle}>Full — Atomic Asset</span>
            <span className={styles.tierDesc}>Up to ~10MB · Metadata, artwork, royalties · Composable asset</span>
          </label>
        </div>

        <div className={styles.form}>
          {tier === 'sample' ? (
            <>
              <label className={styles.label}>
                Sample sound bite (under 100KB)
                <input
                  className={styles.file}
                  type="file"
                  accept="audio/*"
                  onChange={(e) => setSampleFile(e.target.files?.[0] || null)}
                />
              </label>
              <label className={styles.checkLabel}>
                <input
                  type="checkbox"
                  checked={isAutoSample}
                  onChange={(e) => setIsAutoSample(e.target.checked)}
                />
                <span>Auto-sample from the track stream when available.</span>
              </label>
              <p className={styles.hint}>
                Tip: export a short MP3 clip to hit the free tier target.
              </p>
            </>
          ) : (
            <>
              <label className={styles.label}>
                Full audio file (up to ~10MB)
                <input
                  className={styles.file}
                  type="file"
                  accept="audio/*"
                  onChange={(e) => setFullFile(e.target.files?.[0] || null)}
                />
              </label>
              {generatedAudio && !fullFile && (
                <p className={styles.generatedCoverNote}>
                  Using generated beat from Creator tools.{' '}
                  <button type="button" className={styles.clearGeneratedBtn} onClick={clearGeneratedAudio}>
                    Clear
                  </button>
                </p>
              )}
              <label className={styles.label}>
                Cover image (optional)
                <input
                  className={styles.file}
                  type="file"
                  accept="image/*"
                  onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                />
              </label>
              {generatedCover && !coverFile && (
                <p className={styles.generatedCoverNote}>
                  Using generated cover from Creator tools.{' '}
                  <button type="button" className={styles.clearGeneratedBtn} onClick={clearGeneratedCover}>
                    Clear
                  </button>
                </p>
              )}
              <p className={styles.hint}>
                Upload an image, or{' '}
                <a href="#/creator-tools" className={styles.creatorToolsLink}>
                  generate cover art in the browser
                </a>
                {' '}(layers + composite).
              </p>
              <label className={styles.label}>
                Description (optional)
                <textarea
                  className={styles.textarea}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Release notes, credits, intent…"
                />
              </label>
              <label className={styles.label}>
                Royalties (bps)
                <input
                  className={styles.input}
                  type="number"
                  min={0}
                  max={5000}
                  value={royaltiesBps}
                  onChange={(e) => setRoyaltiesBps(Number(e.target.value))}
                />
              </label>
              <label className={styles.checkLabel}>
                <input
                  type="checkbox"
                  checked={useTurbo}
                  onChange={(e) => setUseTurbo(e.target.checked)}
                />
                <span>Use Turbo paid upload (credits/AR). Recommended for files over 10MB.</span>
              </label>
              {useTurbo && (
                <label className={styles.label}>
                  Turbo payment
                  <select
                    className={styles.select}
                    value={turboToken}
                    onChange={(e) => setTurboToken(e.target.value as typeof turboToken)}
                  >
                    <option value="arweave">Arweave (Wander)</option>
                    <option value="ethereum">Ethereum (ETH wallet)</option>
                    <option value="base-eth">Base (ETH wallet)</option>
                    <option value="solana">Solana (Phantom)</option>
                  </select>
                </label>
              )}
              <p className={styles.hint}>
                Turbo uses the selected wallet for payment and credits.
              </p>
              <p className={styles.hint}>
                Royalties are stored in atomic asset metadata for future distribution/DEX integration.
              </p>
            </>
          )}
        </div>

        {status === 'done' && result?.success && (
          <div className={styles.success}>
            <span className={styles.successBadge}>Permanent</span>
            {result.confirmed === false && (
              <span className={styles.pendingBadge}>Pending</span>
            )}
            <p className={styles.successText}>Upload complete. Your sound bite is now on-chain.</p>
            {result.permawebUrl && (
              <a href={result.permawebUrl} target="_blank" rel="noopener noreferrer" className={styles.link}>
                View on permaweb
              </a>
            )}
            {result.arioUrl && (
              <a href={result.arioUrl} target="_blank" rel="noopener noreferrer" className={styles.link}>
                View on ar.io
              </a>
            )}
            {result.txId && <p className={styles.assetId}>Tx ID: {result.txId.slice(0, 12)}…</p>}
            {result.txId && (
              <button type="button" className={styles.copyBtn} onClick={() => handleCopyTxId(result.txId)}>
                {copiedTxId ? 'Copied' : 'Copy tx id'}
              </button>
            )}
            {appendWarning && (
              <div className={styles.warning}>
                <p className={styles.warningText}>{appendWarning}</p>
                <a
                  className={styles.warningLink}
                  href={address ? `/#/profile/${address}` : '/#/profile'}
                >
                  Go to profile
                </a>
              </div>
            )}
            {result.assetId && <p className={styles.assetId}>Asset ID: {result.assetId.slice(0, 12)}…</p>}
          </div>
        )}
        {status === 'error' && errorMessage && (
          <p className={styles.error}>{errorMessage}</p>
        )}

        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button
            type="button"
            className={styles.publishBtn}
            onClick={handlePublish}
            disabled={status === 'uploading' || status === 'confirming'}
          >
            {status === 'uploading' || status === 'confirming'
              ? 'Publishing…'
              : status === 'done'
                ? 'Done'
                : `Publish ${tier === 'sample' ? 'sample' : 'full asset'}`}
          </button>
        </div>
      </div>
    </div>
  );
}
