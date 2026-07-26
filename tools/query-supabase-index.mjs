#!/usr/bin/env node

import fs from 'node:fs';

function loadEnvFile(path = '.env.local') {
  if (!fs.existsSync(path)) return;
  for (const line of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
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

function env(...keys) {
  for (const key of keys) {
    if (process.env[key]) return process.env[key];
  }
  return '';
}

async function select(url, key, table, query) {
  const response = await fetch(`${url.replace(/\/+$/, '')}/rest/v1/${table}${query}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
    },
  });
  const json = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${table} HTTP ${response.status}: ${JSON.stringify(json)}`);
  return json;
}

loadEnvFile();

const url = env('SUPABASE_URL', 'VITE_SUPABASE_URL');
const key = env('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY');
if (!url || !key) {
  console.error('Missing SUPABASE_URL and SUPABASE_ANON_KEY in .env.local.');
  process.exit(1);
}

const profiles = await select(
  url,
  key,
  'profiles',
  '?select=profile_id,wallet_address,handle,display_name&order=indexed_at.desc&limit=5'
);
const tracks = await select(
  url,
  key,
  'tracks',
  '?select=audio_tx_id,title,artist,owner_wallet,profile_id,artwork_url,stream_url&order=created_at.desc.nullslast&limit=5'
);

console.log(JSON.stringify({ profiles, tracks }, null, 2));

