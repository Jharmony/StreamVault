import { Link } from 'react-router-dom';
import { CoverArtGenerator } from '../components/CoverArtGenerator';
import { BeatGenerator } from '../components/BeatGenerator';
import styles from './CreatorTools.module.css';

export function CreatorTools() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Creator tools</h1>
        <p className={styles.subtitle}>Generate cover art, beats, and tools for StreamVault</p>
      </header>

      <CoverArtGenerator />

      <BeatGenerator />

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Generate beats with Art Engine (CLI)</h2>
        <p className={styles.text}>
          For heavier, offline generation you can run the Art Engine audio pipeline bundled in this repo.
          From the repo root: <code>cd tools/art-engine && npm run start:audio</code>.
        </p>
        <ol className={styles.steps}>
          <li>
            Put clips in <code>tools/art-engine/data/audio-clips/</code> or describe them in
            <code>tools/art-engine/data/audio-clips/manifest.json</code> (Arweave sample URLs are supported).
          </li>
          <li>
            Run <code>npm run start:audio</code> inside <code>tools/art-engine</code> to generate beats into
            <code>tools/art-engine/output/audio/</code>.
          </li>
          <li>
            Use those files as full audio in the Publish modal, or drag them into the beat generator above.
          </li>
        </ol>
      </section>

      <div className={styles.actions}>
        <Link className={styles.linkButton} to="/">
          Back to Home
        </Link>
      </div>
    </div>
  );
}
