import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import { usePermaweb } from '../context/PermawebContext';
import { useAudiusAuth } from '../context/AudiusAuthContext';
import { LogoSpinner } from '../components/LogoSpinner';
import { searchUsers, type AudiusUser } from '../lib/audius';
import { CreateProfileModal } from '../components/CreateProfileModal';
import styles from './Profile.module.css';

type PermaProfile = {
  id?: string | null;
  walletAddress?: string;
  username?: string;
  displayName?: string;
  description?: string;
  thumbnail?: string | null;
  banner?: string | null;
  assets?: any[];
};

type LocalSample = {
  txId: string;
  title: string;
  artist: string;
  permawebUrl?: string;
  arioUrl?: string;
  createdAt: string;
};

type ProfileOption = {
  id: string;
  timestamp?: number;
};
function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export function Profile() {
  const { address } = useParams<{ address: string }>();
  const { address: connectedAddress, walletType } = useWallet();
  const { audiusUser } = useAudiusAuth();
  const isOwn = connectedAddress && address && connectedAddress.toLowerCase() === address.toLowerCase();
  const resolvedAddress = isOwn ? connectedAddress : address;
  const { libs, isReady } = usePermaweb();

  const [profile, setProfile] = useState<PermaProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localSamples, setLocalSamples] = useState<LocalSample[]>([]);
  const [copiedTxId, setCopiedTxId] = useState<string | null>(null);
  const [audiusProfile, setAudiusProfile] = useState<AudiusUser | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [profileOverrideId, setProfileOverrideId] = useState<string>('');
  const [profileOverrideInput, setProfileOverrideInput] = useState<string>('');
  const [profileOptions, setProfileOptions] = useState<ProfileOption[]>([]);
  const [autoProfileId, setAutoProfileId] = useState<string>('');
  const [newSampleTxId, setNewSampleTxId] = useState('');
  const [newSampleTitle, setNewSampleTitle] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const normalizedProfile = useMemo(() => {
    const storeRaw = (profile as any)?.store || (profile as any)?.Store || null;
    const store = libs?.mapFromProcessCase ? libs.mapFromProcessCase(storeRaw || {}) : storeRaw || {};
    const merged = {
      ...profile,
      ...store,
    } as any;
    return merged;
  }, [profile, libs]);

  const avatarSource = useMemo(() => {
    const raw =
      normalizedProfile?.thumbnail ||
      normalizedProfile?.avatar ||
      normalizedProfile?.image ||
      null;
    if (!raw) return null;
    if (typeof raw !== 'string') return null;
    if (raw.startsWith('http')) return raw;
    if (raw.startsWith('data:')) return raw;
    return `https://arweave.net/${raw}`;
  }, [normalizedProfile]);

  const bannerSource = useMemo(() => {
    const raw = normalizedProfile?.banner || null;
    if (!raw || typeof raw !== 'string') return null;
    if (raw.startsWith('http')) return raw;
    if (raw.startsWith('data:')) return raw;
    return `https://arweave.net/${raw}`;
  }, [normalizedProfile]);

  const audiusProof = useMemo(() => {
    const raw = normalizedProfile?.audiusProof;
    if (!raw) return null;
    if (typeof raw === 'object') return raw;
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
    return null;
  }, [normalizedProfile]);

  const toBase64 = (bytes: Uint8Array) => {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  };

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/#/profile/${address}`;
  }, [address]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isReady || !libs || !resolvedAddress) return;
      if (isOwn && !walletType) return;
      if (!libs.getProfileByWalletAddress) return;
      setLoading(true);
      setError(null);
      try {
        console.info('[profile] fetch start', { address: resolvedAddress });
        const overrideId =
          (typeof window !== 'undefined' &&
            localStorage.getItem(`streamvault:profileId:${resolvedAddress.toLowerCase()}`)) ||
          '';
        if (overrideId) {
          setProfileOverrideId(overrideId);
          setProfileOverrideInput(overrideId);
        }
        const p = overrideId && libs.getProfileById
          ? await libs.getProfileById(overrideId)
          : await libs.getProfileByWalletAddress(resolvedAddress);
        console.info('[profile] data', p);
        console.info('[profile] fetch result', { hasProfile: Boolean(p?.id) });
        if (!cancelled) setProfile(p || { id: null });
      } catch (e: any) {
        console.error('[profile] fetch failed', e);
        if (!cancelled) setError(e?.message || 'Failed to load profile');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isReady, walletType, libs, resolvedAddress, isOwn]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!libs?.getGQLData || !resolvedAddress) return;
      if (isOwn && !walletType) return;
      try {
        console.info('[profile] options fetch start', { address: resolvedAddress });
        const gql = await libs.getGQLData({
          tags: [
            { name: 'Data-Protocol', values: ['Zone'] },
            { name: 'Zone-Type', values: ['User'] },
          ],
          owners: [resolvedAddress],
          gateway: 'ao-search-gateway.goldsky.com',
        });
        const gqlAlt = await libs.getGQLData({
          tags: [
            { name: 'data-protocol', values: ['Zone'] },
            { name: 'zone-type', values: ['User'] },
          ],
          owners: [resolvedAddress],
          gateway: 'ao-search-gateway.goldsky.com',
        });
        const mergedData = [...(gql?.data || []), ...(gqlAlt?.data || [])];
        console.info('[profile] options fetch result', { primary: gql, secondary: gqlAlt });
        const options = mergedData
          .map((entry: any) => ({
            id: entry?.node?.id,
            timestamp: entry?.node?.block?.timestamp ? entry.node.block.timestamp * 1000 : undefined,
          }))
          .filter((entry: ProfileOption) => Boolean(entry.id));
        options.sort((a: ProfileOption, b: ProfileOption) => (b.timestamp || 0) - (a.timestamp || 0));
        if (!cancelled) setProfileOptions(options);
        if (!cancelled && options.length > 0 && !profileOverrideId && libs.getProfileById) {
          const candidates = options.slice(0, 5);
          let best: { id: string; score: number } | null = null;
          for (const candidate of candidates) {
            const data = await libs.getProfileById(candidate.id);
            const score =
              (data?.thumbnail ? 3 : 0) +
              (data?.displayName ? 2 : 0) +
              (data?.username ? 1 : 0) +
              (data?.description ? 1 : 0);
            if (!best || score > best.score) {
              best = { id: candidate.id, score };
              if (score >= 4) break;
            }
          }
          if (best) {
            const data = await libs.getProfileById(best.id);
            setProfile(data || { id: null });
            setAutoProfileId(best.id);
          }
        }
      } catch (e) {
        console.error('[profile] options fetch failed', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [libs, resolvedAddress, profileOverrideId, isOwn, walletType]);

  useEffect(() => {
    let cancelled = false;
    if (!profile?.audiusHandle) {
      setAudiusProfile(null);
      return;
    }
    (async () => {
      try {
        const results = await searchUsers(profile.audiusHandle, 1);
        if (!cancelled) setAudiusProfile(results[0] || null);
      } catch {
        if (!cancelled) setAudiusProfile(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.audiusHandle]);

  useEffect(() => {
    if (!address || typeof window === 'undefined') return;
    try {
      const key = `streamvault:samples:${address.toLowerCase()}`;
      const stored = JSON.parse(localStorage.getItem(key) || '[]') as LocalSample[];
      setLocalSamples(stored);
    } catch {
      setLocalSamples([]);
    }
  }, [address]);

  const onChainSamples = useMemo(() => {
    const raw = normalizedProfile?.samples || normalizedProfile?.Samples || [];
    return Array.isArray(raw) ? (raw as LocalSample[]) : [];
  }, [normalizedProfile]);

  const handleAddSample = async () => {
    if (!libs?.addToZone || !normalizedProfile?.id || walletType !== 'arweave') return;
    const txId = newSampleTxId.trim();
    if (!txId) return;
    try {
      await libs.addToZone(
        {
          path: 'Samples[]',
          data: {
            txId,
            title: newSampleTitle.trim() || undefined,
            createdAt: new Date().toISOString(),
          },
        },
        normalizedProfile.id
      );
      setNewSampleTxId('');
      setNewSampleTitle('');
    } catch (e) {
      console.error('[profile] add sample failed', e);
    }
  };

  const handleVerifyAudius = async () => {
    if (!normalizedProfile?.audiusHandle || !normalizedProfile?.id || !libs?.updateZone) return;
    if (!address || !walletType) return;
    setVerifying(true);
    setVerifyError(null);
    try {
      const message = `StreamVault Audius verification\nHandle: ${normalizedProfile.audiusHandle}\nWallet: ${address}\nTimestamp: ${new Date().toISOString()}`;
      let signature: string | null = null;
      if (walletType === 'ethereum' && (window as any).ethereum) {
        signature = await (window as any).ethereum.request({
          method: 'personal_sign',
          params: [message, address],
        });
      } else if (walletType === 'solana' && (window as any).solana?.signMessage) {
        const encoded = new TextEncoder().encode(message);
        const signed = await (window as any).solana.signMessage(encoded, 'utf8');
        signature = toBase64(signed.signature);
      } else if (walletType === 'arweave' && (window as any).arweaveWallet?.signMessage) {
        const encoded = new TextEncoder().encode(message);
        const signed = await (window as any).arweaveWallet.signMessage(encoded);
        signature = typeof signed === 'string' ? signed : toBase64(signed);
      } else {
        throw new Error('Wallet does not support message signing.');
      }
      const proof = {
        handle: normalizedProfile.audiusHandle,
        walletType,
        address,
        message,
        signature,
        createdAt: new Date().toISOString(),
      };
      await libs.updateZone(
        {
          AudiusHandle: normalizedProfile.audiusHandle,
          AudiusProof: JSON.stringify(proof),
        },
        normalizedProfile.id
      );
    } catch (e: any) {
      setVerifyError(e?.message || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const handleProfileOverride = async (nextId?: string) => {
    if (!resolvedAddress || !libs?.getProfileById) return;
    const id = (nextId || profileOverrideInput).trim();
    if (!id) return;
    try {
      setLoading(true);
      const p = await libs.getProfileById(id);
      setProfile(p || { id: null });
      setProfileOverrideId(id);
      setAutoProfileId('');
      if (typeof window !== 'undefined') {
        localStorage.setItem(`streamvault:profileId:${resolvedAddress.toLowerCase()}`, id);
      }
    } catch (e) {
      console.error('[profile] override failed', e);
    } finally {
      setLoading(false);
    }
  };

  const handleClearOverride = async () => {
    if (!resolvedAddress || !libs?.getProfileByWalletAddress) return;
    try {
      setLoading(true);
      const p = await libs.getProfileByWalletAddress(resolvedAddress);
      setProfile(p || { id: null });
      setProfileOverrideId('');
      setProfileOverrideInput('');
      setAutoProfileId('');
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`streamvault:profileId:${resolvedAddress.toLowerCase()}`);
      }
    } catch (e) {
      console.error('[profile] clear override failed', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyTxId = async (txId: string) => {
    try {
      await navigator.clipboard.writeText(txId);
      setCopiedTxId(txId);
      window.setTimeout(() => setCopiedTxId(null), 1500);
    } catch (e) {
      console.warn('[profile] Clipboard copy failed', e);
    }
  };

  const handleCreateProfile = async (form: {
    username: string;
    displayName: string;
    description: string;
    audiusHandle?: string;
    thumbnail?: File | null;
    banner?: File | null;
  }) => {
    if (!libs?.createProfile || !address) return;
    setCreating(true);
    setError(null);
    try {
      console.info('[profile] create start', { address, audiusHandle: form.audiusHandle });
      if (libs.getProfileByWalletAddress) {
        const existing = await libs.getProfileByWalletAddress(address);
        if (existing?.id) {
          console.info('[profile] existing profile found', { profileId: existing.id });
          setProfile(existing);
          setCreateOpen(false);
          return;
        }
      }
      const args: any = {
        username: form.username.trim(),
        displayName: form.displayName.trim(),
        description: form.description.trim(),
      };
      if (form.thumbnail) args.thumbnail = await fileToDataURL(form.thumbnail);
      if (form.banner) args.banner = await fileToDataURL(form.banner);

      const profileId = await libs.createProfile(args);
      console.info('[profile] create success', { profileId });
      if (profileId && libs.updateZone && form.audiusHandle) {
        const update: Record<string, string> = {};
        if (form.audiusHandle) update.AudiusHandle = form.audiusHandle;
        await libs.updateZone(update, profileId);
        console.info('[profile] profile updated', { profileId });
      }
      setProfile({ id: profileId, walletAddress: address, username: args.username, displayName: args.displayName, description: args.description });
      setCreateOpen(false);

      if (profileId && localSamples.length > 0 && libs.addToZone) {
        setSyncing(true);
        try {
          for (const sample of localSamples) {
            await libs.addToZone(
              {
                path: 'Samples[]',
                data: sample,
              },
              profileId
            );
          }
          console.info('[profile] local samples synced', { count: localSamples.length });
        } catch (e) {
          console.warn('[profile] Failed to sync samples', e);
        } finally {
          setSyncing(false);
        }
      }

      // Best-effort refresh (indexing may lag)
      try {
        const fresh = await libs.getProfileByWalletAddress(address);
        if (fresh) setProfile(fresh);
      } catch {
        // ignore - eventual consistency
      }
    } catch (e: any) {
      console.error('[profile] create failed', e);
      const msg = String(e?.message || '');
      if (msg.includes('not allowed on this SU') || msg.includes('Process') && msg.includes('not allowed')) {
        setError('Permaweb profile creation is not available on this node right now. Try again later or use an AO mainnet-enabled environment.');
      } else {
        setError(msg || 'Profile creation failed');
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className={styles.page}>
      {bannerSource && (
        <div className={styles.bannerWrap}>
          <img className={styles.bannerImg} src={bannerSource} alt="" />
        </div>
      )}
      <header className={styles.header + ' glass'}>
        {avatarSource ? (
          <img className={styles.avatarImg} src={avatarSource} alt="" />
        ) : (
          <div className={styles.avatarPlaceholder} />
        )}
        <div>
          <h1 className={styles.title}>
            {isOwn ? 'Your profile' : 'Creator profile'}
          </h1>
          <p className={styles.address}>{address?.slice(0, 8)}…{address?.slice(-8)}</p>
          {walletType && <span className={styles.walletType}>{walletType}</span>}
        </div>
      </header>
      {audiusProfile && (
        <section className={styles.section}>
          <div className={styles.profileCard}>
            <div>
              <p className={styles.profileName}>{audiusProfile.name}</p>
              <p className={styles.subtext}>Audius · @{audiusProfile.handle}</p>
            </div>
            <div className={styles.profileMeta}>
              <span className={styles.mono}>{audiusProfile.track_count} tracks</span>
              {typeof audiusProfile.playlist_count === 'number' && (
                <span className={styles.monoValue}>{audiusProfile.playlist_count} playlists</span>
              )}
            </div>
          </div>
        </section>
      )}
      <section className={styles.section}>
        <p className={styles.text}>
          Share your profile: <strong>{shareUrl}</strong>
        </p>
        <p className={styles.subtext}>
          Permanently published tracks and atomic assets you create will appear here. Connect with the same wallet you use as the verified artist to publish.
        </p>
      </section>

      <section className={styles.section + ' ' + styles.sectionTight}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Generate cover art with Art Engine</h2>
        </div>
        <p className={styles.subtext}>
          Use the Art Engine in this repo to create unique layered artwork. Generate cover art in the browser (Creator tools), then use it when publishing to Arweave (Full — Cover image).
        </p>
        <a href="#/creator-tools" className={styles.link}>
          Creator tools &amp; full steps →
        </a>
      </section>

      <section className={styles.section + ' ' + styles.sectionTight}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Permaweb profile</h2>
          {walletType === 'arweave' && isOwn && (
            <button type="button" className={styles.primaryBtn} onClick={() => setCreateOpen(true)}>
            {normalizedProfile?.id ? 'Update (soon)' : 'Create profile'}
          </button>
        )}
      </div>

        {walletType !== 'arweave' ? (
          <p className={styles.subtext}>Connect <strong>Wander</strong> to create and manage your permaweb profile.</p>
        ) : loading ? (
          <LogoSpinner />
        ) : error ? (
          <p className={styles.error}>{error}</p>
        ) : normalizedProfile?.id ? (
          <div className={styles.profileCard}>
            <div>
              <p className={styles.profileName}>{normalizedProfile.displayName || normalizedProfile.username || 'Unnamed'}</p>
              <p className={styles.subtext}>{normalizedProfile.description || 'No description yet.'}</p>
            </div>
            <div className={styles.profileMeta}>
              <span className={styles.mono}>Profile ID</span>
              <span className={styles.monoValue}>{String(normalizedProfile.id).slice(0, 12)}…</span>
            </div>
          </div>
        ) : (
          <p className={styles.subtext}>
            No permaweb profile found for this wallet yet. Create one to make your identity permanent and creator-first.
          </p>
        )}
      </section>

      {normalizedProfile?.audiusHandle && normalizedProfile?.id && (
        <section className={styles.section + ' ' + styles.sectionTight}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Audius verification</h2>
          </div>
          <p className={styles.subtext}>
            Link your Audius handle with a wallet signature for community trust.
          </p>
          {audiusProof && (
            <p className={styles.subtext}>Verified with {audiusProof.walletType} wallet.</p>
          )}
          {verifyError && <p className={styles.error}>{verifyError}</p>}
          <button
            type="button"
            className={styles.primaryBtn}
            disabled={!walletType || verifying}
            onClick={handleVerifyAudius}
          >
            {verifying ? 'Verifying…' : audiusProof ? 'Re-verify' : 'Verify Audius handle'}
          </button>
        </section>
      )}

      <section className={styles.section + ' ' + styles.sectionTight}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Profile source</h2>
        </div>
        <p className={styles.subtext}>
          {profileOverrideId
            ? `Using profile id: ${profileOverrideId}`
            : autoProfileId
              ? `Auto-selected profile id: ${autoProfileId}`
              : 'Using latest profile for this wallet.'}
        </p>
        {profileOptions.length > 0 && (
          <div className={styles.profileList}>
            {profileOptions.map((option, index) => (
              <div key={option.id} className={styles.profileListItem}>
                <div>
                  <span className={styles.mono}>Profile ID</span>
                  <span className={styles.monoValue}>{option.id.slice(0, 12)}…</span>
                  {option.timestamp && (
                    <span className={styles.profileDate}>
                      {new Date(option.timestamp).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => {
                    setProfileOverrideInput(option.id);
                    handleProfileOverride(option.id);
                  }}
                  disabled={profileOverrideId === option.id || (!profileOverrideId && profile?.id === option.id)}
                >
                  {profileOverrideId === option.id || (!profileOverrideId && profile?.id === option.id) ? 'Active' : 'Use'}
                </button>
              </div>
            ))}
          </div>
        )}
        {profileOptions.length === 0 && (
          <p className={styles.subtext}>
            No profile list returned yet. Check console for options fetch logs.
          </p>
        )}
        <div className={styles.overrideRow}>
          <input
            className={styles.input}
            value={profileOverrideInput}
            onChange={(e) => setProfileOverrideInput(e.target.value)}
            placeholder="Profile ID (optional)"
          />
          <button type="button" className={styles.primaryBtn} onClick={() => handleProfileOverride()}>
            Load by ID
          </button>
          <button type="button" className={styles.secondaryBtn} onClick={handleClearOverride}>
            Clear
          </button>
        </div>
      </section>

      {onChainSamples.length > 0 && (
        <section className={styles.section + ' ' + styles.sectionTight}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Sound bites</h2>
          </div>
          <p className={styles.subtext}>
            Sound bites attached to your permaweb profile. Use them in the{' '}
            <a href="#/creator-tools" className={styles.link}>Beat generator</a> (Creator tools) to build a new track.
          </p>
          <div className={styles.sampleList}>
            {onChainSamples.map((sample) => (
              <div key={sample.txId} className={styles.sampleItem}>
                <div>
                  <span className={styles.mono}>{sample.title}</span>
                  <span className={styles.monoValue}>{sample.txId.slice(0, 12)}…</span>
                </div>
                <div className={styles.sampleLinks}>
                  <a
                    className={styles.link}
                    href={`https://arweave.net/${sample.txId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    arweave.net
                  </a>
                  {sample.arioUrl && (
                    <a className={styles.link} href={sample.arioUrl} target="_blank" rel="noopener noreferrer">
                      ar.io
                    </a>
                  )}
                  <button
                    type="button"
                    className={styles.copyBtn}
                    onClick={() => handleCopyTxId(sample.txId)}
                  >
                    {copiedTxId === sample.txId ? 'Copied' : 'Copy tx id'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {normalizedProfile?.id && (
        <section className={styles.section + ' ' + styles.sectionTight}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Add existing upload</h2>
          </div>
          <p className={styles.subtext}>
            Paste a transaction id to attach a past upload to your profile.
          </p>
          <div className={styles.overrideRow}>
            <input
              className={styles.input}
              value={newSampleTxId}
              onChange={(e) => setNewSampleTxId(e.target.value)}
              placeholder="Arweave tx id"
            />
            <input
              className={styles.input}
              value={newSampleTitle}
              onChange={(e) => setNewSampleTitle(e.target.value)}
              placeholder="Title (optional)"
            />
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={handleAddSample}
              disabled={walletType !== 'arweave' || !newSampleTxId.trim()}
              title={walletType !== 'arweave' ? 'Connect Wander (Arweave) to attach uploads' : undefined}
            >
              Add to profile
            </button>
          </div>
        </section>
      )}

      {onChainSamples.length === 0 && localSamples.length > 0 && (
        <section className={styles.section + ' ' + styles.sectionTight}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Local uploads</h2>
          </div>
          <p className={styles.subtext}>
            Recent sound bites saved on this device. Create a permaweb profile to store them on-chain.
          </p>
          <button
            type="button"
            className={styles.primaryBtn}
            disabled={walletType !== 'arweave' || syncing}
            onClick={() => setCreateOpen(true)}
            title={walletType !== 'arweave' ? 'Connect Wander (Arweave) to sync' : undefined}
          >
            {walletType !== 'arweave' ? 'Connect Wander' : syncing ? 'Syncing…' : 'Sync to Arweave'}
          </button>
          <div className={styles.sampleList}>
            {localSamples.map((sample) => (
              <div key={sample.txId} className={styles.sampleItem}>
                <div>
                  <span className={styles.mono}>{sample.title}</span>
                  <span className={styles.monoValue}>{sample.txId.slice(0, 12)}…</span>
                </div>
                <div className={styles.sampleLinks}>
                  <a
                    className={styles.link}
                    href={`https://arweave.net/${sample.txId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    arweave.net
                  </a>
                  {sample.arioUrl && (
                    <a className={styles.link} href={sample.arioUrl} target="_blank" rel="noopener noreferrer">
                      ar.io
                    </a>
                  )}
                  <button
                    type="button"
                    className={styles.copyBtn}
                    onClick={() => handleCopyTxId(sample.txId)}
                  >
                    {copiedTxId === sample.txId ? 'Copied' : 'Copy tx id'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {createOpen && (
        <CreateProfileModal
          creating={creating}
          onClose={() => setCreateOpen(false)}
          initialAudiusHandle={audiusProfile?.handle ?? audiusUser?.handle}
          onCreate={handleCreateProfile}
        />
      )}
    </div>
  );
}
