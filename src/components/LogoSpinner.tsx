import styles from './LogoSpinner.module.css';

export function LogoSpinner() {
  return (
    <div className={styles.wrapper}>
      <div className={styles.ring}>
        <img
          src="/streamvault-logo.png"
          alt="StreamVault logo"
          className={styles.logo}
        />
      </div>
    </div>
  );
}

