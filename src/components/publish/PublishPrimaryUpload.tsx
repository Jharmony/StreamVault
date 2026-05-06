import { useRef } from 'react';
import styles from '../PublishModal.module.css';

type Props = {
  fullFile: File | null;
  onFileChange: (file: File | null) => void;
  coverFile: File | null;
  onCoverChange: (file: File | null) => void;
  hasGeneratedCover: boolean;
  onClearGeneratedCover: () => void;
  hasGeneratedAudio: boolean;
  onClearGeneratedAudio: () => void;
  disabled?: boolean;
};

export function PublishPrimaryUpload({
  fullFile,
  onFileChange,
  coverFile,
  onCoverChange,
  hasGeneratedCover,
  onClearGeneratedCover,
  hasGeneratedAudio,
  onClearGeneratedAudio,
  disabled,
}: Props) {
  const audioInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const displayName = fullFile?.name ?? (hasGeneratedAudio ? 'Generated beat (Creator tools)' : null);
  const coverDisplayName = coverFile?.name ?? (hasGeneratedCover ? 'Generated cover (Creator tools)' : null);

  return (
    <div className={styles.primaryUploadWrap}>
      <input
        ref={audioInputRef}
        className={styles.primaryUploadInput}
        type="file"
        accept="audio/*"
        disabled={disabled}
        onChange={(e) => onFileChange(e.target.files?.[0] || null)}
      />
      <input
        ref={coverInputRef}
        className={styles.primaryUploadInput}
        type="file"
        accept="image/*"
        disabled={disabled}
        onChange={(e) => onCoverChange(e.target.files?.[0] || null)}
      />
      <button
        type="button"
        className={styles.primaryUploadBtn}
        disabled={disabled}
        onClick={() => audioInputRef.current?.click()}
      >
        {displayName ? 'Change audio file' : 'Choose audio file'}
      </button>
      <button
        type="button"
        className={styles.primaryUploadBtn}
        disabled={disabled}
        onClick={() => coverInputRef.current?.click()}
      >
        {coverDisplayName ? 'Change cover image' : 'Choose cover image'}
      </button>
      {displayName && (
        <p className={styles.primaryUploadFileName} title={displayName}>
          {displayName}
        </p>
      )}
      {coverDisplayName && (
        <p className={styles.primaryUploadFileName} title={coverDisplayName}>
          {coverDisplayName}
        </p>
      )}
      {!fullFile && hasGeneratedAudio && (
        <p className={styles.generatedCoverNote}>
          Using generated beat from Creator tools.{' '}
          <button type="button" className={styles.clearGeneratedBtn} onClick={onClearGeneratedAudio}>
            Clear
          </button>
        </p>
      )}
      {!coverFile && hasGeneratedCover && (
        <p className={styles.generatedCoverNote}>
          Using generated cover from Creator tools.{' '}
          <button type="button" className={styles.clearGeneratedBtn} onClick={onClearGeneratedCover}>
            Clear
          </button>
        </p>
      )}
    </div>
  );
}
