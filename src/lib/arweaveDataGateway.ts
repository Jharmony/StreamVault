/** Default Arweave HTTP gateway: GraphQL, `/{txId}`, `/tx/{txId}`, and `Arweave.init` API host. */
export const ARWEAVE_DATA_GATEWAY_BASE = 'https://arweave.net';
/**
 * Gateways used for availability probes (`Range` GET + `/tx/.../status`).
 * Stick to the canonical gateway only: turbo mirrors often 404 or redirect in ways that
 * confuse readiness checks and do not reflect whether `arweave.net/{id}` is live yet.
 */
export const ARWEAVE_FALLBACK_DATA_GATEWAY_BASES = ['https://arweave.net'] as const;

/** Public Turbo CDN base for optional secondary links (same id as `arweave.net/{id}` for bundled items). */
export const TURBO_PUBLIC_DATA_GATEWAY_BASE = 'https://turbo-gateway.com';

const TX_ID_LIKE = /[a-zA-Z0-9_-]{43}/;

/** Extract a 43-char tx / data-item id if the caller passed a full URL or path. */
export function normalizeArweaveTxId(raw: string): string {
  const s = String(raw || '').trim();
  if (!s) return s;
  if (s.length === 43 && TX_ID_LIKE.test(s)) return s;
  const m = s.match(TX_ID_LIKE);
  return m ? m[0] : s;
}

export function arweaveDataGatewayHost(): {
  host: string;
  port: number;
  protocol: 'https';
} {
  return { host: 'arweave.net', port: 443, protocol: 'https' };
}

export function arweaveTxDataUrl(txId: string): string {
  const id = normalizeArweaveTxId(txId);
  return `${ARWEAVE_DATA_GATEWAY_BASE}/${id}`;
}

export function arweaveTxDataUrls(txId: string): string[] {
  const id = normalizeArweaveTxId(txId);
  return ARWEAVE_FALLBACK_DATA_GATEWAY_BASES.map((base) => `${base}/${id}`);
}

export function turboTxDataUrl(txId: string): string {
  const id = normalizeArweaveTxId(txId);
  return `${TURBO_PUBLIC_DATA_GATEWAY_BASE}/${id}`;
}

export function arweaveTxMetaUrl(txId: string): string {
  const id = normalizeArweaveTxId(txId);
  return `${ARWEAVE_DATA_GATEWAY_BASE}/tx/${id}`;
}

export function arweaveTxStatusUrls(txId: string): string[] {
  const id = normalizeArweaveTxId(txId);
  return ARWEAVE_FALLBACK_DATA_GATEWAY_BASES.map((base) => `${base}/tx/${id}/status`);
}

export function arweaveGraphqlEndpoint(): string {
  return `${ARWEAVE_DATA_GATEWAY_BASE}/graphql`;
}
