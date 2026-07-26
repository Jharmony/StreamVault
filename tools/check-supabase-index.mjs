#!/usr/bin/env node

import fs from 'node:fs';

const REQUIRED_TABLES = ['profiles', 'tracks', 'profile_assets', 'indexer_runs'];

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

async function checkTable({ url, key, table }) {
  const endpoint = `${url.replace(/\/+$/, '')}/rest/v1/${table}?select=*&limit=1`;
  const response = await fetch(endpoint, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return {
    table,
    ok: response.ok,
    status: response.status,
    code: body?.code || null,
    message: body?.message || null,
  };
}

loadEnvFile();

const supabaseUrl = getEnv('SUPABASE_URL', 'VITE_SUPABASE_URL');
const supabaseKey = getEnv(
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SECRET_KEY',
  'SUPABASE_ANON_KEY',
  'VITE_SUPABASE_ANON_KEY'
);

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL and a Supabase key in .env.local.');
  process.exit(1);
}

try {
  new URL(supabaseUrl);
} catch {
  console.error('SUPABASE_URL must be the full project URL, for example https://PROJECT_REF.supabase.co.');
  process.exit(1);
}

const results = [];
for (const table of REQUIRED_TABLES) {
  results.push(await checkTable({ url: supabaseUrl, key: supabaseKey, table }));
}

for (const result of results) {
  const suffix = result.ok
    ? 'ok'
    : `${result.status}${result.code ? ` ${result.code}` : ''}${result.message ? ` - ${result.message}` : ''}`;
  console.log(`${result.table}: ${suffix}`);
}

if (results.some((result) => !result.ok)) {
  process.exit(1);
}
