#!/usr/bin/env node

import fs from 'node:fs';
import { createStreamVaultClient } from '../packages/streamvault-sdk/dist/index.js';

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

loadEnvFile();

const supabaseUrl = env('SUPABASE_URL', 'VITE_SUPABASE_URL');
const supabaseKey = env('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL and SUPABASE_ANON_KEY in .env.local.');
  process.exit(1);
}

const streamvault = createStreamVaultClient({
  index: {
    supabaseUrl,
    supabaseKey,
  },
});

const handle = process.argv[2] || 'lto';
const profile = await streamvault.getProfileByHandle(handle);
const handleTracks = await streamvault.getTracksByHandle(handle, { limit: 5 });
const searchTracks = await streamvault.searchTracks({ q: process.argv[3] || 'hoodrat', limit: 5 });

console.log(
  JSON.stringify(
    {
      profile: profile
        ? {
            id: profile.id,
            handle: profile.handle,
            displayName: profile.displayName,
            walletAddress: profile.walletAddress,
          }
        : null,
      handleTracks: handleTracks.map((track) => ({
        title: track.title,
        artist: track.artist,
        audioTxId: track.audioTxId,
        streamUrl: track.streamUrl,
      })),
      searchTracks: searchTracks.map((track) => ({
        title: track.title,
        artist: track.artist,
        audioTxId: track.audioTxId,
      })),
    },
    null,
    2
  )
);

