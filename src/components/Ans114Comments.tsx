import { useCallback, useEffect, useMemo, useState } from 'react';
import { ans114CommentMaxChars, createAns114Comment, listAns114Comments, type Ans114Comment } from '../lib/ans114Comments';
import { arweaveExplorerUrl } from '../lib/arweaveDataGateway';
import { useWallet } from '../context/WalletContext';
import styles from './Ans114Comments.module.css';

function shortAddress(value: string): string {
  if (!value) return 'Unknown';
  return value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}

function formatDate(timestamp?: number): string {
  if (!timestamp) return 'Pending date';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(timestamp * 1000));
}

export function Ans114Comments({
  rootSource,
  title,
}: {
  rootSource: string;
  title: string;
}) {
  const { address, walletType, connect } = useWallet();
  const [comments, setComments] = useState<Ans114Comment[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const maxChars = ans114CommentMaxChars();
  const remaining = maxChars - body.length;
  const canPost = useMemo(
    () => Boolean(body.trim()) && remaining >= 0 && walletType === 'arweave' && Boolean(address) && !posting,
    [address, body, posting, remaining, walletType]
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setComments(await listAns114Comments(rootSource));
    } catch (e) {
      setError((e as Error)?.message || 'Could not load comments.');
    } finally {
      setLoading(false);
    }
  }, [rootSource]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!body.trim()) return;
    setPosting(true);
    setError(null);
    setNotice(null);
    try {
      const commentId = await createAns114Comment({
        body,
        dataSource: rootSource,
        rootSource,
        extraTags: [{ name: 'StreamVault-Track-Title', value: title }],
      });
      setBody('');
      setNotice(`Comment posted: ${shortAddress(commentId)}. It can take a few minutes to appear in GraphQL.`);
      await refresh();
    } catch (e) {
      setError((e as Error)?.message || 'Could not post comment.');
    } finally {
      setPosting(false);
    }
  };

  return (
    <section className={styles.comments + ' glass'}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Comments</h2>
          <p className={styles.note}>Public ANS-114 comments stored on Arweave.</p>
        </div>
        <button type="button" className={styles.refreshBtn} onClick={refresh} disabled={loading || posting}>
          Refresh
        </button>
      </div>

      {walletType === 'arweave' && address ? (
        <form className={styles.form} onSubmit={onSubmit}>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={maxChars}
            placeholder="Add feedback, context, or a note for this track."
            className={styles.textarea}
          />
          <div className={styles.formFooter}>
            <span className={remaining < 0 ? styles.countError : styles.count}>{remaining} characters left</span>
            <button type="submit" className={styles.postBtn} disabled={!canPost}>
              {posting ? 'Posting…' : 'Post comment'}
            </button>
          </div>
        </form>
      ) : (
        <div className={styles.connectBox}>
          <span>Connect Wander to add a public comment.</span>
          <button type="button" className={styles.postBtn} onClick={() => void connect('arweave')}>
            Connect Wander
          </button>
        </div>
      )}

      {notice && <p className={styles.notice}>{notice}</p>}
      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.list}>
        {loading ? (
          <p className={styles.empty}>Loading comments…</p>
        ) : comments.length ? (
          comments.map((comment) => (
            <article key={comment.id} className={styles.comment}>
              <div className={styles.commentMeta}>
                <span>{shortAddress(comment.owner)}</span>
                <span>{formatDate(comment.createdAt)}</span>
                <a href={arweaveExplorerUrl(comment.id)} target="_blank" rel="noopener noreferrer">
                  View
                </a>
              </div>
              <p className={styles.commentBody}>{comment.body}</p>
            </article>
          ))
        ) : (
          <p className={styles.empty}>No comments yet.</p>
        )}
      </div>
    </section>
  );
}
