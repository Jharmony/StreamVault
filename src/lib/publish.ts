/**
 * Publish flows: sample (data tx, <100kb) and full (atomic asset with metadata).
 * Uses Arweave wallet for signing and permaweb-libs for atomic assets.
 */

import type { PublishResult } from '../lib/arweave';

const GATEWAY = 'https://arweave.net';
const AR_IO_GATEWAY = 'https://ar-io.net';

interface PermawebLibs {
  createAtomicAsset?: (args: {
    name: string;
    description?: string;
    topics?: string[];
    creator: string;
    data: string;
    contentType: string;
    assetType: string;
    metadata?: Record<string, unknown>;
  }) => Promise<string>;
}

type TurboPaymentToken = 'arweave' | 'ethereum' | 'base-eth' | 'solana';

interface TurboUploadOptions {
  file: Blob;
  tags: { name: string; value: string }[];
  paymentToken: TurboPaymentToken;
}

async function uploadWithTurbo(args: TurboUploadOptions): Promise<string> {
  const win = typeof window !== 'undefined' ? (window as any) : null;
  const { TurboFactory, ArconnectSigner } = await import('@ardrive/turbo-sdk/web');

  let turbo;
  if (args.paymentToken === 'arweave') {
    const wallet = win?.arweaveWallet;
    if (!wallet) throw new Error('Wander wallet required for Turbo upload.');
    const signer = new ArconnectSigner(wallet);
    turbo = TurboFactory.authenticated({ signer });
  } else if (args.paymentToken === 'solana') {
    const walletAdapter = win?.solana;
    if (!walletAdapter) throw new Error('Solana wallet required for Turbo upload.');
    turbo = TurboFactory.authenticated({ walletAdapter, token: 'solana' });
  } else {
    const provider = win?.ethereum;
    if (!provider) throw new Error('Ethereum wallet required for Turbo upload.');
    const { BrowserProvider } = await import('ethers');
    const walletAdapter = new BrowserProvider(provider);
    turbo = TurboFactory.authenticated({ walletAdapter, token: args.paymentToken });
  }

  console.info('[turbo] Uploading file', { size: args.file.size });
  const result = await turbo.uploadFile({
    file: args.file,
    dataItemOpts: { tags: args.tags },
    events: {
      onUploadProgress: ({ totalBytes, processedBytes }) => {
        console.info('[turbo] Upload progress', { totalBytes, processedBytes });
      },
      onUploadError: (error) => {
        console.error('[turbo] Upload error', error);
      },
      onUploadSuccess: () => {
        console.info('[turbo] Upload success');
      },
    },
  });

  return result.id;
}

/** Upload raw data transaction. Returns txId or throws. */
async function uploadDataTx(
  data: ArrayBuffer,
  contentType: string,
  tags: { name: string; value: string }[]
): Promise<string> {
  const win = typeof window !== 'undefined' ? (window as any) : null;
  const wallet = win?.arweaveWallet;
  if (!wallet) throw new Error('Wander wallet required to publish.');

  const Arweave = (await import('arweave')).default;
  const arweave = Arweave.init({ host: 'arweave.net', port: 443, protocol: 'https' });
  const tx = await arweave.createTransaction({ data: new Uint8Array(data) });
  tags.forEach(({ name, value }) => tx.addTag(name, value));
  tx.addTag('Content-Type', contentType);

  console.info('[arweave] Signing transaction', { contentType, dataBytes: data.byteLength });
  const signedTx = await wallet.sign(tx);
  const txToPost = signedTx || tx;
  console.info('[arweave] Posting transaction', { id: (txToPost as any).id || tx.id });
  const response = await arweave.transactions.post(txToPost as any);
  if (response.status >= 400) throw new Error(`Upload failed: ${response.status}`);
  const txId = (txToPost as any).id || tx.id;
  console.info('[arweave] Transaction accepted', { status: response.status, txId });
  return txId;
}

/** Upload an image to Arweave; returns gateway URL for the uploaded image. */
export async function uploadImageTx(file: Blob, tags: { name: string; value: string }[] = []): Promise<string> {
  const data = await file.arrayBuffer();
  const contentType = file.type || 'image/png';
  const txId = await uploadDataTx(
    data,
    contentType,
    [
      { name: 'App-Name', value: 'StreamVault' },
      { name: 'Type', value: 'cover-art' },
      ...tags,
    ]
  );
  return `${GATEWAY}/${txId}`;
}

async function waitForConfirmation(txId: string, timeoutMs = 45_000): Promise<boolean> {
  const Arweave = (await import('arweave')).default;
  const arweave = Arweave.init({ host: 'arweave.net', port: 443, protocol: 'https' });
  const ario = Arweave.init({ host: 'ar-io.net', port: 443, protocol: 'https' });
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const status = await arweave.transactions.getStatus(txId);
      if (status.status === 200) return true;
    } catch {
      // ignore and retry
    }
    try {
      const status = await ario.transactions.getStatus(txId);
      if (status.status === 200) return true;
    } catch {
      // ignore and retry
    }
    await new Promise((r) => setTimeout(r, 2_000));
  }
  return false;
}

/** Publish sample blob to Arweave as data tx; return permaweb link. */
export async function publishSampleToArweave(
  args: {
    sample: Blob;
    title: string;
    artist: string;
    durationSeconds: number;
  }
): Promise<PublishResult> {
  try {
    console.info('[publish] Sample publish started', { title: args.title, artist: args.artist });
    const data = await args.sample.arrayBuffer();
    const txId = await uploadDataTx(
      data,
      args.sample.type || 'audio/mpeg',
      [
        { name: 'App-Name', value: 'StreamVault' },
        { name: 'Type', value: 'audio-sample' },
        { name: 'Title', value: args.title },
        { name: 'Artist', value: args.artist },
        { name: 'Duration-Seconds', value: String(args.durationSeconds) },
      ]
    );
    const confirmed = await waitForConfirmation(txId).catch(() => false);
    const permawebUrl = `${GATEWAY}/${txId}`;
    console.info('[publish] Sample publish complete', { txId, permawebUrl });
    return { success: true, txId, permawebUrl, arioUrl: `${AR_IO_GATEWAY}/${txId}`, confirmed };
  } catch (e: any) {
    console.error('[publish] Sample publish failed', e);
    return { success: false, error: e?.message || 'Sample upload failed' };
  }
}

/** Publish full audio blob as atomic asset. Uploads file first, then creates asset with metadata. */
export async function publishFullAsAtomicAsset(
  args: {
    audio: Blob;
    title: string;
    artist: string;
    description?: string;
    artworkUrl?: string;
    artworkFile?: Blob;
    royaltiesBps?: number;
    useTurbo?: boolean;
    turboPaymentToken?: TurboPaymentToken;
  },
  creatorAddress: string,
  ctx: { libs: PermawebLibs | null }
): Promise<PublishResult> {
  const libs = ctx.libs;
  if (!libs?.createAtomicAsset) return { success: false, error: 'Atomic asset creation not available.' };

  try {
    console.info('[publish] Full asset publish started', { title: args.title, artist: args.artist });
    let artworkUrlToUse = args.artworkUrl;
    if (args.artworkFile) {
      console.info('[publish] Uploading cover image to Arweave');
      artworkUrlToUse = await uploadImageTx(args.artworkFile, [
        { name: 'Title', value: args.title },
        { name: 'Artist', value: args.artist },
      ]);
    }
    let txId: string;
    if (args.useTurbo) {
      txId = await uploadWithTurbo({
        file: args.audio,
        tags: [
          { name: 'App-Name', value: 'StreamVault' },
          { name: 'Type', value: 'audio-full' },
          { name: 'Title', value: args.title },
          { name: 'Artist', value: args.artist },
          { name: 'Content-Type', value: args.audio.type || 'audio/mpeg' },
        ],
        paymentToken: args.turboPaymentToken || 'arweave',
      });
    } else {
      const data = await args.audio.arrayBuffer();
      if (data.byteLength > 10 * 1024 * 1024) return { success: false, error: 'File too large (max ~10MB).' };

      txId = await uploadDataTx(
        data,
        args.audio.type || 'audio/mpeg',
        [
          { name: 'App-Name', value: 'StreamVault' },
          { name: 'Type', value: 'audio-full' },
          { name: 'Title', value: args.title },
          { name: 'Artist', value: args.artist },
        ]
      );
    }
    const confirmed = await waitForConfirmation(txId).catch(() => false);
    const permawebUrl = `${GATEWAY}/${txId}`;

    const metadata = {
      audioTxId: txId,
      artist: args.artist,
      artwork: artworkUrlToUse || undefined,
      royaltiesBps: args.royaltiesBps ?? undefined,
    };
    const assetId = await libs.createAtomicAsset({
      name: args.title,
      description: args.description || `Permanent release by ${args.artist}`,
      topics: ['Music', 'StreamVault', 'Atomic-Asset'],
      creator: creatorAddress,
      data: permawebUrl,
      contentType: 'text/plain',
      assetType: 'audio',
      metadata,
    });

    console.info('[publish] Full asset publish complete', { txId, assetId, permawebUrl });
    return {
      success: true,
      txId,
      assetId,
      permawebUrl,
      arioUrl: `${AR_IO_GATEWAY}/${txId}`,
      confirmed,
    };
  } catch (e: any) {
    console.error('[publish] Full asset publish failed', e);
    return { success: false, error: e?.message || 'Full asset publish failed' };
  }
}
