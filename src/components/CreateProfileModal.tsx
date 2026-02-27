import { useState } from 'react';
import styles from '../pages/Profile.module.css';

export function CreateProfileModal(props: {
  creating: boolean;
  onClose: () => void;
  initialAudiusHandle?: string | null;
  onCreate: (form: {
    username: string;
    displayName: string;
    description: string;
    audiusHandle?: string;
    thumbnail?: File | null;
    banner?: File | null;
  }) => void;
}) {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [audiusHandle, setAudiusHandle] = useState(props.initialAudiusHandle || '');
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [banner, setBanner] = useState<File | null>(null);

  return (
    <div className={styles.modalOverlay} onClick={props.onClose}>
      <div className={styles.modal + ' glass-strong'} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>Create permaweb profile</h3>
          <button type="button" className={styles.modalClose} onClick={props.onClose} aria-label="Close">
            ×
          </button>
        </div>
        <p className={styles.subtext}>This creates a permanent identity using permaweb-libs. Indexing can take a moment.</p>

        <div className={styles.form}>
          <label className={styles.label}>
            Username
            <input className={styles.input} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="streamvault" />
          </label>
          <label className={styles.label}>
            Display name
            <input className={styles.input} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="StreamVault Artist" />
          </label>
          <label className={styles.label}>
            Bio
            <textarea className={styles.textarea} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Creator-first. Permanent by design." />
          </label>
          <label className={styles.label}>
            Audius handle (optional)
            <input
              className={styles.input}
              value={audiusHandle}
              onChange={(e) => setAudiusHandle(e.target.value)}
              placeholder="@artist"
            />
          </label>
          <div className={styles.fileRow}>
            <label className={styles.file}>
              Thumbnail
              <input type="file" accept="image/*" onChange={(e) => setThumbnail(e.target.files?.[0] || null)} />
            </label>
            <label className={styles.file}>
              Banner
              <input type="file" accept="image/*" onChange={(e) => setBanner(e.target.files?.[0] || null)} />
            </label>
          </div>
        </div>

        <div className={styles.modalActions}>
          <button type="button" className={styles.secondaryBtn} onClick={props.onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.primaryBtn}
            disabled={props.creating || !username.trim() || !displayName.trim()}
            onClick={() =>
              props.onCreate({
                username,
                displayName,
                description,
                audiusHandle: audiusHandle.trim() || undefined,
                thumbnail,
                banner,
              })
            }
          >
            {props.creating ? 'Creating…' : 'Create profile'}
          </button>
        </div>
      </div>
    </div>
  );
}
