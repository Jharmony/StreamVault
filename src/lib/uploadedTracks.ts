import type { Track } from '../context/PlayerContext';
import { preferredArweaveStreamUrl, resilientArweaveDataUrl } from './arweaveDataGateway';
import { trackSourceBadges } from './trackBadges';
import type { RoyaltySplit, UdlConfig, UdlInterval } from './udl';
import { UDL_LICENSE_TX_ID, UDL_LICENSE_URL } from './udl';

export type UploadedTrackUdlSummary = Pick<
  UdlConfig,
  | 'licenseId'
  | 'usage'
  | 'aiUse'
  | 'fee'
  | 'currency'
  | 'paymentAddress'
  | 'paymentMode'
  | 'interval'
  | 'commercialUse'
  | 'derivation'
  | 'dataModelTraining'
  | 'unknownUsageRights'
  | 'expiryYears'
  | 'attribution'
  | 'uri'
>;

export type UploadedTrackRecord = {
  txId: string;
  title: string;
  artist: string;
  permawebUrl?: string;
  arioUrl?: string;
  confirmed?: boolean;
  gatewayReady?: boolean;
  assetId?: string;
  createdAt: string;
  walletAddress?: string;
  tier?: 'sample' | 'full';
  dataTxOnly?: boolean;
  audiusTrackId?: string;
  description?: string;
  /** Optional Arweave tx id for separately uploaded artwork (cover/thumbnail). */
  artworkTxId?: string;
  artworkUrl?: string;
  contentType?: string;
  udl?: UploadedTrackUdlSummary;
  splits?: RoyaltySplit[];
};

function pickString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function parseUsage(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const items = value.map((item) => String(item).trim()).filter(Boolean);
    return items.length ? items : undefined;
  }
  if (typeof value === 'string') {
    const items = value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    return items.length ? items : undefined;
  }
  return undefined;
}

function parseStandardFee(value: unknown): { fee: string; interval: UdlInterval } | null {
  const raw = pickString(value);
  if (!raw) return null;
  const match = raw.match(/^(One-Time|Monthly)-(.+)$/i);
  if (!match) return { fee: raw, interval: 'per-stream' };
  return {
    fee: match[2] || '0',
    interval: match[1].toLowerCase() === 'monthly' ? 'per-month' : 'one-time',
  };
}

function parseSplits(value: unknown): RoyaltySplit[] | undefined {
  if (Array.isArray(value)) return value as RoyaltySplit[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as RoyaltySplit[]) : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function udlToSummary(udl?: UdlConfig | null): UploadedTrackUdlSummary | undefined {
  if (!udl) return undefined;
  return {
    licenseId: udl.licenseId,
    usage: Array.isArray(udl.usage) ? udl.usage : [],
    aiUse: udl.aiUse,
    fee: udl.fee,
    currency: udl.currency,
    interval: udl.interval,
    attribution: udl.attribution,
    uri: udl.uri,
  };
}

export function normalizeUploadedTrackRecord(raw: unknown): UploadedTrackRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const txId = pickString(row.txId) || pickString(row.TxId) || pickString(row.audioTxId) || pickString(row.AudioTxId);
  if (!txId) return null;
  const title = pickString(row.title) || pickString(row.Title) || 'Untitled';
  const artist = pickString(row.artist) || pickString(row.Artist) || '';
  const permawebUrl = pickString(row.permawebUrl) || pickString(row.PermawebUrl);
  const arioUrl = pickString(row.arioUrl) || pickString(row.ArioUrl);
  const createdAt =
    pickString(row.createdAt) ||
    pickString(row.CreatedAt) ||
    new Date(0).toISOString();
  const udlSource = (row.udl || row.UDL) as UdlConfig | UploadedTrackUdlSummary | undefined;
  const usage = parseUsage((udlSource as any)?.usage ?? row['License-Use'] ?? row.licenseUse);
  const standardFee = parseStandardFee(row['Access-Fee'] ?? row['License-Fee']);
  const normalizedUdl =
    udlSource && typeof udlSource === 'object'
      ? {
          licenseId:
            pickString((udlSource as any).licenseId) ||
            pickString((udlSource as any).License) ||
            pickString(row.License) ||
            UDL_LICENSE_TX_ID,
          usage: usage || [],
          aiUse:
            (pickString((udlSource as any).aiUse) ||
              pickString(row['License-AI-Use']) ||
              'deny') as UploadedTrackUdlSummary['aiUse'],
          fee:
            pickString((udlSource as any).fee) ||
            standardFee?.fee ||
            '0',
          currency:
            pickString((udlSource as any).currency) ||
            pickString(row.Currency) ||
            pickString(row['License-Currency']) ||
            'MATIC',
          paymentAddress:
            pickString((udlSource as any).paymentAddress) ||
            pickString(row['Payment-Address']) ||
            pickString(row['License-Fee-Recipient']),
          paymentMode:
            (pickString((udlSource as any).paymentMode) || pickString(row['Payment-Mode'])) as UploadedTrackUdlSummary['paymentMode'],
          interval:
            (pickString((udlSource as any).interval) ||
              standardFee?.interval ||
              pickString(row['License-Fee-Unit']) ||
              'per-stream') as UploadedTrackUdlSummary['interval'],
          commercialUse:
            (pickString((udlSource as any).commercialUse) || pickString(row['Commercial-Use'])) as UploadedTrackUdlSummary['commercialUse'],
          derivation:
            (pickString((udlSource as any).derivation) ||
              pickString(row.Derivation) ||
              pickString(row.Derivations)) as UploadedTrackUdlSummary['derivation'],
          dataModelTraining:
            (pickString((udlSource as any).dataModelTraining) ||
              pickString(row['Data-Model-Training'])) as UploadedTrackUdlSummary['dataModelTraining'],
          unknownUsageRights:
            (pickString((udlSource as any).unknownUsageRights) ||
              pickString(row['Unknown-Usage-Rights'])) as UploadedTrackUdlSummary['unknownUsageRights'],
          expiryYears:
            pickString((udlSource as any).expiryYears) ||
            pickString(row.Expiry),
          attribution:
            (pickString((udlSource as any).attribution) ||
              pickString(row['License-Attribution'])) as UploadedTrackUdlSummary['attribution'],
          uri:
            pickString((udlSource as any).uri) ||
            pickString(row['License-URI']) ||
            UDL_LICENSE_URL,
        }
      : pickString(row.License) || pickString(row['License-Use']) || pickString(row['License-AI-Use'])
        ? {
            licenseId: pickString(row.License) || UDL_LICENSE_TX_ID,
            usage: usage || [],
            aiUse: (pickString(row['License-AI-Use']) || 'deny') as UploadedTrackUdlSummary['aiUse'],
            fee: standardFee?.fee || '0',
            currency: pickString(row.Currency) || pickString(row['License-Currency']) || 'MATIC',
            paymentAddress: pickString(row['Payment-Address']) || pickString(row['License-Fee-Recipient']),
            paymentMode: pickString(row['Payment-Mode']) as UploadedTrackUdlSummary['paymentMode'],
            interval: (standardFee?.interval || pickString(row['License-Fee-Unit']) || 'per-stream') as UploadedTrackUdlSummary['interval'],
            commercialUse: pickString(row['Commercial-Use']) as UploadedTrackUdlSummary['commercialUse'],
            derivation: (pickString(row.Derivation) || pickString(row.Derivations)) as UploadedTrackUdlSummary['derivation'],
            dataModelTraining: pickString(row['Data-Model-Training']) as UploadedTrackUdlSummary['dataModelTraining'],
            unknownUsageRights: pickString(row['Unknown-Usage-Rights']) as UploadedTrackUdlSummary['unknownUsageRights'],
            expiryYears: pickString(row.Expiry),
            attribution: pickString(row['License-Attribution']) as UploadedTrackUdlSummary['attribution'],
            uri: pickString(row['License-URI']) || UDL_LICENSE_URL,
          }
        : undefined;

  return {
    txId,
    title,
    artist,
    permawebUrl,
    arioUrl,
    confirmed: typeof row.confirmed === 'boolean' ? row.confirmed : undefined,
    gatewayReady: typeof row.gatewayReady === 'boolean' ? row.gatewayReady : undefined,
    assetId: pickString(row.assetId) || pickString(row.AssetId),
    createdAt,
    walletAddress: pickString(row.walletAddress) || pickString(row.WalletAddress),
    tier: row.tier === 'sample' || row.tier === 'full' ? row.tier : undefined,
    dataTxOnly: typeof row.dataTxOnly === 'boolean' ? row.dataTxOnly : undefined,
    audiusTrackId: pickString(row.audiusTrackId) || pickString(row['Audius-Track-Id']),
    description: pickString(row.description) || pickString(row.Description),
    artworkTxId:
      pickString(row.artworkTxId) ||
      pickString(row.ArtworkTxId) ||
      pickString(row['Artwork-Tx-Id']) ||
      pickString(row['Cover-Art-Tx-Id']) ||
      pickString(row['Thumbnail-Tx-Id']),
    artworkUrl: pickString(row.artworkUrl) || pickString(row.ArtworkUrl),
    contentType: pickString(row.contentType) || pickString(row['Content-Type']),
    udl: normalizedUdl,
    splits: parseSplits(row.splits || row.Splits || row['Royalties-Splits']),
  };
}

/**
 * Playback URL for stored uploads. Prefer `arioUrl` (Turbo CDN / turbo-gateway) when present so
 * fresh Turbo data items play before `arweave.net/{id}` finishes propagating.
 */
export function uploadedTrackShareUrl(track: Pick<UploadedTrackRecord, 'txId' | 'permawebUrl' | 'arioUrl'>): string {
  const arioUrl = String(track.arioUrl || '').trim();
  if (arioUrl && !/^https:\/\/(?:www\.)?arweave\.net\//i.test(arioUrl)) return arioUrl;
  return resilientArweaveDataUrl(track.txId) || track.permawebUrl || arioUrl;
}

function normalizeText(value: string | undefined): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function matchUploadedTrackToAudiusTrack(
  uploads: UploadedTrackRecord[],
  track: Pick<Track, 'id' | 'title' | 'artist'>
): UploadedTrackRecord | null {
  const id = String(track.id || '');
  const byId = uploads.find((upload) => upload.audiusTrackId === id);
  if (byId) return byId;
  const title = normalizeText(track.title);
  const artist = normalizeText(track.artist);
  const candidates = uploads.filter(
    (upload) =>
      !upload.audiusTrackId &&
      normalizeText(upload.title) === title &&
      normalizeText(upload.artist) === artist
  );
  return candidates.length === 1 ? candidates[0] : null;
}

export function uploadedTrackToPlayerTrack(track: UploadedTrackRecord): Track {
  const artwork = track.artworkTxId
    ? preferredArweaveStreamUrl(track.artworkTxId)
    : track.artworkUrl;
  return {
    id: track.txId,
    title: track.title,
    artist: track.artist || 'Unknown artist',
    artistId: track.walletAddress || track.txId,
    artwork,
    streamUrl: uploadedTrackShareUrl(track),
    isPermanent: true,
    permaTxId: track.txId,
    assetId: track.assetId,
  };
}

/** Keep the Audius track id for UI keys, but play from the persisted Arweave upload when present. */
export function mergeAudiusTrackWithPersistedUpload(audiusTrack: Track, upload: UploadedTrackRecord): Track {
  const p = uploadedTrackToPlayerTrack(upload);
  return {
    ...audiusTrack,
    streamUrl: p.streamUrl,
    artwork: p.artwork ?? audiusTrack.artwork,
    isPermanent: true,
    permaTxId: p.permaTxId,
    assetId: p.assetId ?? audiusTrack.assetId,
  };
}

export function uploadedTrackLicenseBadges(track: UploadedTrackRecord): string[] {
  const badges = trackSourceBadges({ assetId: track.assetId, isPermanent: true });
  if (track.udl?.usage?.length) badges.push(`Use: ${track.udl.usage.join(', ')}`);
  if (track.udl?.aiUse) badges.push(`AI: ${track.udl.aiUse}`);
  if (track.udl?.fee && track.udl?.currency) {
    badges.push(`Fee: ${track.udl.fee} ${track.udl.currency}/${track.udl.interval || 'per-stream'}`);
  }
  return badges;
}

/** Short badges for compact track cards (Atomic Asset only — Arweave pill already signals permanence). */
export function uploadedTrackCompactBadges(track: UploadedTrackRecord): string[] {
  return trackSourceBadges({ assetId: track.assetId, isPermanent: false });
}
