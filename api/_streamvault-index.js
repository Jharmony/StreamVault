const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function env(name) {
  return String(process.env[name] || '').trim();
}

function indexConfig() {
  return {
    url: env('SUPABASE_URL') || env('VITE_SUPABASE_URL') || env('VITE_STREAMVAULT_INDEX_SUPABASE_URL'),
    key:
      env('SUPABASE_SERVICE_ROLE_KEY') ||
      env('SUPABASE_SECRET_KEY') ||
      env('SUPABASE_ANON_KEY') ||
      env('VITE_SUPABASE_ANON_KEY') ||
      env('VITE_STREAMVAULT_INDEX_SUPABASE_ANON_KEY'),
  };
}

function limitValue(value, fallback = DEFAULT_LIMIT) {
  const n = Math.floor(Number(value || fallback));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(1, n), MAX_LIMIT);
}

function pickString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeHandle(handle) {
  return String(handle || '').trim().replace(/^@+/, '').toLowerCase();
}

function encodeFilterValue(value) {
  return encodeURIComponent(String(value || '').replace(/"/g, '\\"'));
}

function publicDataUrls(txId) {
  const id = String(txId || '').trim();
  return [
    `https://arweave.net/${id}`,
    `https://turbo-gateway.com/${id}`,
    `https://g8way.io/${id}`,
    `https://akrd.net/${id}`,
    `https://ardrive.net/${id}`,
  ];
}

export function applyCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export function sendJson(res, status, body) {
  res.status(status).json(body);
}

export function readQuery(req, key) {
  const value = req.query?.[key];
  return Array.isArray(value) ? value[0] : value;
}

export function readParam(req, key) {
  return readQuery(req, key);
}

export function methodGuard(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return false;
  }
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return false;
  }
  return true;
}

async function supabaseSelect(table, query) {
  const { url, key } = indexConfig();
  const base = String(url || '').replace(/\/+$/, '');
  if (!base || !key) {
    const err = new Error('StreamVault index is not configured.');
    err.statusCode = 503;
    throw err;
  }
  const response = await fetch(`${base}/rest/v1/${table}${query}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
    },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    const err = new Error(`Index query failed with HTTP ${response.status}`);
    err.statusCode = response.status;
    err.detail = detail.slice(0, 300);
    throw err;
  }
  const json = await response.json().catch(() => null);
  return Array.isArray(json) ? json : [];
}

export function profileFromRow(row) {
  if (!row?.profile_id) return null;
  return {
    id: String(row.profile_id),
    walletAddress: pickString(row.wallet_address),
    displayName: pickString(row.display_name),
    handle: pickString(row.handle),
    bio: pickString(row.bio),
    avatarUrl: pickString(row.avatar_url),
    bannerUrl: pickString(row.banner_url),
    assets: [],
    raw: row.raw || row,
  };
}

export function trackFromRow(row) {
  const audioTxId = pickString(row?.audio_tx_id);
  if (!audioTxId) return null;
  const streamUrls = Array.isArray(row.stream_urls) && row.stream_urls.length ? row.stream_urls : publicDataUrls(audioTxId);
  return {
    id: pickString(row.id) || audioTxId,
    audioTxId,
    title: pickString(row.title) || 'Untitled',
    artist: pickString(row.artist) || 'Unknown artist',
    artistId: pickString(row.profile_id) || pickString(row.owner_wallet) || audioTxId,
    streamUrl: pickString(row.stream_url) || streamUrls[0],
    streamUrls,
    artworkUrl: pickString(row.artwork_url) || undefined,
    assetId: pickString(row.asset_id) || undefined,
    isPermanent: row.is_permanent !== false,
    source: 'arweave',
    raw: row.raw || row,
  };
}

export async function getProfileByHandle(handle) {
  const normalized = normalizeHandle(handle);
  if (!normalized) return null;
  const rows = await supabaseSelect(
    'profiles',
    `?handle_normalized=eq.${encodeFilterValue(normalized)}&select=*&limit=1`
  );
  return profileFromRow(rows[0]);
}

export async function getProfileById(profileId) {
  const id = String(profileId || '').trim();
  if (!id) return null;
  const rows = await supabaseSelect('profiles', `?profile_id=eq.${encodeFilterValue(id)}&select=*&limit=1`);
  return profileFromRow(rows[0]);
}

export async function getProfileByWallet(wallet) {
  const address = String(wallet || '').trim();
  if (!address) return null;
  const rows = await supabaseSelect(
    'profiles',
    `?wallet_address=eq.${encodeFilterValue(address)}&select=*&order=indexed_at.desc&limit=1`
  );
  return profileFromRow(rows[0]);
}

export async function searchProfiles(q, limit) {
  const query = String(q || '').trim();
  if (!query) return [];
  const rows = await supabaseSelect(
    'profiles',
    `?or=(handle_normalized.ilike.*${encodeFilterValue(normalizeHandle(query))}*,display_name.ilike.*${encodeFilterValue(
      query
    )}*)&select=*&order=indexed_at.desc&limit=${limitValue(limit)}`
  );
  return rows.map(profileFromRow).filter(Boolean);
}

export async function getTracksByProfileId(profileId, limit) {
  const id = String(profileId || '').trim();
  if (!id) return [];
  const rows = await supabaseSelect(
    'tracks',
    `?profile_id=eq.${encodeFilterValue(id)}&select=*&order=created_at.desc.nullslast&limit=${limitValue(limit, 50)}`
  );
  return rows.map(trackFromRow).filter(Boolean);
}

export async function getTracksByWallet(wallet, limit) {
  const address = String(wallet || '').trim();
  if (!address) return [];
  const rows = await supabaseSelect(
    'tracks',
    `?owner_wallet=eq.${encodeFilterValue(address)}&select=*&order=created_at.desc.nullslast&limit=${limitValue(limit, 50)}`
  );
  return rows.map(trackFromRow).filter(Boolean);
}

export async function searchTracks(q, limit) {
  const query = String(q || '').trim();
  if (!query) return [];
  const rows = await supabaseSelect(
    'tracks',
    `?or=(title.ilike.*${encodeFilterValue(query)}*,artist.ilike.*${encodeFilterValue(
      query
    )}*)&select=*&order=created_at.desc.nullslast&limit=${limitValue(limit)}`
  );
  return rows.map(trackFromRow).filter(Boolean);
}

export async function getTrendingTracks(limit) {
  const rows = await supabaseSelect(
    'tracks',
    `?select=*&order=created_at.desc.nullslast&limit=${limitValue(limit, 24)}`
  );
  return rows.map(trackFromRow).filter(Boolean);
}

export function handleError(res, error) {
  const status = Number(error?.statusCode) || 500;
  sendJson(res, status, {
    error: error?.message || 'StreamVault index request failed.',
    detail: error?.detail,
  });
}
