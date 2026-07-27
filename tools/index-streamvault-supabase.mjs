#!/usr/bin/env node

import fs from 'node:fs';

const DEFAULT_ARWEAVE_GQL_ENDPOINTS = [
  'https://arweave.net/graphql',
  'https://arweave-search.goldsky.com/graphql',
];
const DEFAULT_AO_GQL_ENDPOINT = 'https://ao-search-gateway.goldsky.com/graphql';
const DEFAULT_HB_NODES = ['https://app-1.forward.computer', 'https://hb.portalinto.com'];
const DEFAULT_LIMIT = 100;

function loadEnvFile(path = '.env.local') {
  if (!fs.existsSync(path)) return;
  const lines = fs.readFileSync(path, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function getEnv(...keys) {
  for (const key of keys) {
    const value = process.env[key];
    if (value) return value;
  }
  return '';
}

function normalizeLimit(raw) {
  const value = Number(raw || DEFAULT_LIMIT);
  if (!Number.isFinite(value)) return DEFAULT_LIMIT;
  return Math.min(Math.max(1, Math.floor(value)), 100);
}

function pickString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function tagValue(tags, names) {
  const wanted = new Set(names.map((name) => name.toLowerCase()));
  for (const tag of tags || []) {
    if (wanted.has(String(tag?.name || '').toLowerCase())) {
      const value = pickString(tag?.value);
      if (value) return value;
    }
  }
  return null;
}

function normalizeTxId(raw) {
  const value = String(raw || '').trim();
  const match = value.match(/[A-Za-z0-9_-]{43}/);
  return match?.[0] || value;
}

function isLikelyTxId(value) {
  return Boolean(value && /^[A-Za-z0-9_-]{43}$/.test(value));
}

function publicDataUrls(txId) {
  const id = normalizeTxId(txId);
  return [
    `https://arweave.net/${id}`,
    `https://turbo-gateway.com/${id}`,
    `https://g8way.io/${id}`,
    `https://akrd.net/${id}`,
    `https://ardrive.net/${id}`,
  ];
}

function mediaUrl(raw) {
  if (raw && typeof raw === 'object') {
    return mediaUrl(raw.url || raw.src || raw.href || raw.txId || raw.id);
  }
  const value = pickString(raw);
  if (!value || value === 'None') return null;
  const fromUrl = value.match(/\/([A-Za-z0-9_-]{43})(?:$|[?#/])/);
  if (fromUrl?.[1]) return publicDataUrls(fromUrl[1])[0];
  if (/^https?:\/\//i.test(value)) return value;
  const arId = value.startsWith('ar://') ? value.slice(5) : value;
  if (isLikelyTxId(arId)) return publicDataUrls(arId)[0];
  return isLikelyTxId(value) ? publicDataUrls(value)[0] : null;
}

function pickProfileField(profile, keys) {
  for (const key of keys) {
    const value = profile?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (value && typeof value === 'object') return value;
  }
  return null;
}

async function gql(endpoint, query, variables) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) throw new Error(`${endpoint} HTTP ${response.status}`);
  const json = await response.json();
  if (json?.errors?.length) {
    throw new Error(`${endpoint} GraphQL ${json.errors[0]?.message || 'error'}`);
  }
  return json;
}

async function gqlWithFallback(endpoints, query, variables) {
  const errors = [];
  for (const endpoint of endpoints) {
    try {
      return await gql(endpoint, query, variables);
    } catch (error) {
      errors.push(error?.message || String(error));
    }
  }
  throw new Error(errors.join(' | '));
}

function audioNodeToTrackRow(node, profileByWallet) {
  const tags = node?.tags || [];
  const audioTxId = String(node?.id || '').trim();
  const wallet = String(node?.owner?.address || tagValue(tags, ['Creator', 'Artist-Address']) || '').trim() || null;
  const profile = wallet ? profileByWallet.get(wallet.toLowerCase()) : null;
  const artworkTxId = tagValue(tags, ['Artwork-Tx-Id', 'Cover-Art-Tx-Id', 'Thumbnail-Tx-Id']);
  const streamUrls = publicDataUrls(audioTxId);
  return {
    audio_tx_id: audioTxId,
    asset_id: tagValue(tags, ['Track-Id', 'Asset-Id', 'Atomic-Asset', 'Process-Id']),
    profile_id: profile?.profile_id || null,
    owner_wallet: wallet,
    title: tagValue(tags, ['Title', 'Bootloader-Name', 'Name']) || 'Untitled',
    artist:
      tagValue(tags, ['Artist', 'Bootloader-Artist', 'Creator']) ||
      profile?.display_name ||
      profile?.handle ||
      'Unknown artist',
    artwork_url: mediaUrl(artworkTxId),
    stream_url: streamUrls[0],
    stream_urls: streamUrls,
    is_atomic: Boolean(tagValue(tags, ['Track-Id', 'Asset-Id', 'Atomic-Asset', 'Process-Id'])),
    is_permanent: true,
    source: 'streamvault',
    raw: node,
    created_at: node?.block?.timestamp ? new Date(node.block.timestamp * 1000).toISOString() : null,
    indexed_at: new Date().toISOString(),
  };
}

function profileNodeToRow(node) {
  const tags = node?.tags || [];
  const profileId = String(node?.id || '').trim();
  const wallet = String(node?.owner?.address || '').trim() || null;
  const handle = tagValue(tags, ['Bootloader-Username', 'Username', 'username', 'Handle', 'handle']);
  const displayName = tagValue(tags, ['Bootloader-DisplayName', 'Display-Name', 'DisplayName', 'Name']);
  return {
    profile_id: profileId,
    wallet_address: wallet,
    handle,
    handle_normalized: handle ? handle.replace(/^@+/, '').toLowerCase() : null,
    display_name: displayName,
    bio: tagValue(tags, ['Bootloader-Description', 'Description', 'description']),
    avatar_url: mediaUrl(tagValue(tags, ['Bootloader-Thumbnail', 'Thumbnail', 'thumbnail', 'Avatar', 'avatar'])),
    banner_url: mediaUrl(tagValue(tags, ['Bootloader-Banner', 'Banner', 'banner', 'Cover', 'cover'])),
    source: 'streamvault',
    raw: node,
    indexed_at: new Date().toISOString(),
  };
}

async function fetchJson(url, timeoutMs = 7000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'accept-bundle': 'true',
        'require-codec': 'application/json',
      },
      signal: controller.signal,
    });
    const text = await response.text();
    if (!text.trim()) return null;
    const firstBrace = text.search(/[{[]/);
    const candidate = firstBrace > -1 ? text.slice(firstBrace) : text;
    return JSON.parse(candidate);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function linkedId(value) {
  const id = pickString(value);
  return isLikelyTxId(id) ? id : null;
}

function mergeProfileState(row, state) {
  if (!state || typeof state !== 'object') return row;
  const handle = pickString(pickProfileField(state, ['handle', 'Handle', 'username', 'Username'])) || row.handle;
  const displayName =
    pickString(pickProfileField(state, ['displayName', 'DisplayName', 'name', 'Name'])) || row.display_name;
  const bio = pickString(pickProfileField(state, ['bio', 'Bio', 'description', 'Description'])) || row.bio;
  const avatar =
    mediaUrl(pickProfileField(state, ['avatar', 'thumbnail', 'image', 'Avatar', 'Thumbnail', 'Image', 'profileImage', 'ProfileImage'])) ||
    row.avatar_url;
  const banner =
    mediaUrl(pickProfileField(state, ['banner', 'cover', 'Banner', 'Cover', 'coverImage', 'CoverImage'])) ||
    row.banner_url;
  return {
    ...row,
    handle,
    handle_normalized: handle ? handle.replace(/^@+/, '').toLowerCase() : row.handle_normalized,
    display_name: displayName,
    bio,
    avatar_url: avatar,
    banner_url: banner,
    raw: {
      spawn: row.raw,
      state,
    },
  };
}

async function fetchProfileState(profileId, hbNodes) {
  for (const node of hbNodes) {
    const base = String(node || '').replace(/\/+$/, '');
    if (!base) continue;
    const direct = await fetchJson(`${base}/${profileId}~process@1.0/compute/cache/zone`);
    if (direct && typeof direct === 'object') return direct;
    const compute = await fetchJson(`${base}/${profileId}~process@1.0/compute`);
    const zoneLink = linkedId(compute?.['zone+link']);
    if (!zoneLink) continue;
    const zone = await fetchJson(`${base}/${zoneLink}`);
    const storeLink = linkedId(zone?.['Store+link']);
    if (!storeLink) continue;
    const store = await fetchJson(`${base}/${storeLink}`);
    if (store && typeof store === 'object') {
      return {
        id: profileId,
        owner: zone?.Owner || zone?.owner || null,
        ...store,
      };
    }
  }
  return null;
}

async function fetchStreamVaultAudio(limit, arweaveGqlEndpoints) {
  const query = `
    query StreamVaultAudio($tags: [TagFilter!]!, $first: Int!) {
      transactions(tags: $tags, first: $first, sort: HEIGHT_DESC) {
        edges {
          node {
            id
            tags { name value }
            block { height timestamp }
            owner { address }
          }
        }
      }
    }
  `;
  const json = await gqlWithFallback(arweaveGqlEndpoints, query, {
    tags: [
      { name: 'App-Name', values: ['StreamVault'] },
      { name: 'Type', values: ['music'] },
    ],
    first: limit,
  });
  return (json?.data?.transactions?.edges || []).map((edge) => edge.node).filter((node) => node?.id);
}

async function fetchProfilesForWallets(wallets, aoGqlEndpoint) {
  const byWallet = new Map();
  if (!wallets.length) return byWallet;
  const query = `
    query StreamVaultProfiles($tags: [TagFilter!]!, $owners: [String!], $first: Int!) {
      transactions(tags: $tags, owners: $owners, first: $first, sort: HEIGHT_DESC) {
        edges {
          node {
            id
            tags { name value }
            block { height timestamp }
            owner { address }
          }
        }
      }
    }
  `;
  for (let i = 0; i < wallets.length; i += 25) {
    const batch = wallets.slice(i, i + 25);
    const json = await gql(aoGqlEndpoint, query, {
      tags: [
        { name: 'Data-Protocol', values: ['ao'] },
        { name: 'Zone-Type', values: ['User'] },
      ],
      owners: batch,
      first: Math.max(batch.length * 5, 25),
    }).catch(() => null);
    const nodes = (json?.data?.transactions?.edges || []).map((edge) => edge.node).filter((node) => node?.id);
    for (const node of nodes) {
      const row = profileNodeToRow(node);
      if (!row.wallet_address) continue;
      const key = row.wallet_address.toLowerCase();
      const current = byWallet.get(key);
      const timestamp = node?.block?.timestamp || 0;
      if (!current || timestamp > (current.raw?.block?.timestamp || 0)) {
        byWallet.set(key, row);
      }
    }
  }
  return byWallet;
}

async function enrichProfilesWithState(profilesByWallet, hbNodes) {
  const entries = Array.from(profilesByWallet.entries());
  await Promise.all(
    entries.map(async ([wallet, row]) => {
      const state = await fetchProfileState(row.profile_id, hbNodes);
      profilesByWallet.set(wallet, mergeProfileState(row, state));
    })
  );
  return profilesByWallet;
}

async function supabaseRequest({ url, key, table, method, body, query = '' }) {
  const endpoint = `${url.replace(/\/+$/, '')}/rest/v1/${table}${query}`;
  const response = await fetch(endpoint, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  if (!response.ok) {
    throw new Error(`${table} ${method} HTTP ${response.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

async function upsertRows({ url, key, table, rows, onConflict }) {
  if (!rows.length) return [];
  return supabaseRequest({
    url,
    key,
    table,
    method: 'POST',
    query: `?on_conflict=${encodeURIComponent(onConflict)}`,
    body: rows,
  });
}

export async function runStreamVaultSupabaseIndexer(options = {}) {
  if (options.loadEnv !== false) loadEnvFile();
  const supabaseUrl = options.supabaseUrl || getEnv('SUPABASE_URL', 'VITE_SUPABASE_URL');
  const serviceKey = options.serviceKey || getEnv('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY');
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  }

  const limit = normalizeLimit(options.limit || process.env.STREAMVAULT_INDEX_LIMIT || process.argv[2]);
  const arweaveGqlEndpoints = (options.arweaveGqlUrls || process.env.STREAMVAULT_ARWEAVE_GQL_URLS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const audioNodes = await fetchStreamVaultAudio(
    limit,
    arweaveGqlEndpoints.length ? arweaveGqlEndpoints : DEFAULT_ARWEAVE_GQL_ENDPOINTS
  );
  const wallets = Array.from(
    new Set(audioNodes.map((node) => String(node?.owner?.address || '').trim()).filter(Boolean))
  );
  const profilesByWallet = await fetchProfilesForWallets(
    wallets,
    options.aoGqlUrl || process.env.STREAMVAULT_AO_GQL_URL || DEFAULT_AO_GQL_ENDPOINT
  );
  const hbNodes = (options.hbNodes || process.env.STREAMVAULT_HB_NODES || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  await enrichProfilesWithState(profilesByWallet, hbNodes.length ? hbNodes : DEFAULT_HB_NODES);
  const profileRows = Array.from(profilesByWallet.values());
  const trackRows = audioNodes
    .map((node) => audioNodeToTrackRow(node, profilesByWallet))
    .filter((row) => row.audio_tx_id);

  const runRows = await supabaseRequest({
    url: supabaseUrl,
    key: serviceKey,
    table: 'indexer_runs',
    method: 'POST',
    body: [{ status: 'running', cursor_value: `limit:${limit}` }],
  });
  const runId = runRows?.[0]?.id;

  try {
    if (profileRows.length) {
      await upsertRows({
        url: supabaseUrl,
        key: serviceKey,
        table: 'profiles',
        rows: profileRows,
        onConflict: 'profile_id',
      });
    }
    if (trackRows.length) {
      await upsertRows({
        url: supabaseUrl,
        key: serviceKey,
        table: 'tracks',
        rows: trackRows,
        onConflict: 'audio_tx_id',
      });
    }
    if (runId) {
      await supabaseRequest({
        url: supabaseUrl,
        key: serviceKey,
        table: 'indexer_runs',
        method: 'PATCH',
        query: `?id=eq.${encodeURIComponent(runId)}`,
        body: {
          status: 'ok',
          finished_at: new Date().toISOString(),
          profiles_upserted: profileRows.length,
          tracks_upserted: trackRows.length,
        },
      });
    }
    return {
      status: 'ok',
      profilesUpserted: profileRows.length,
      tracksUpserted: trackRows.length,
      walletsFound: wallets.length,
    };
  } catch (error) {
    if (runId) {
      await supabaseRequest({
        url: supabaseUrl,
        key: serviceKey,
        table: 'indexer_runs',
        method: 'PATCH',
        query: `?id=eq.${encodeURIComponent(runId)}`,
        body: {
          status: 'error',
          finished_at: new Date().toISOString(),
          error: error?.message || String(error),
        },
      }).catch(() => {});
    }
    throw error;
  }
}

async function main() {
  const result = await runStreamVaultSupabaseIndexer();
  console.log(JSON.stringify(result, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error?.message || error);
    process.exit(1);
  });
}
