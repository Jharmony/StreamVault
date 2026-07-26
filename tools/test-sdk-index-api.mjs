import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { createStreamVaultClient } from '../packages/streamvault-sdk/dist/index.js';
import {
  getProfileByHandle,
  getTracksByProfileId,
  getTracksByWallet,
  getTrendingTracks,
  searchProfiles,
  searchTracks,
} from '../api/_streamvault-index.js';

function loadDotenv(file) {
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.trim().replace(/^['"]|['"]$/g, '');
  }
}

function send(res, status, body) {
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  });
  res.end(JSON.stringify(body));
}

async function route(req, res) {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  const limit = url.searchParams.get('limit') || undefined;
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts[0] === 'api') parts.shift();
  try {
    if (parts[0] === 'profiles' && parts[1] === 'handle' && parts[2]) {
      send(res, 200, { profile: await getProfileByHandle(decodeURIComponent(parts[2])) });
      return;
    }
    if (parts[0] === 'profiles' && parts[1] === 'search') {
      send(res, 200, { profiles: await searchProfiles(url.searchParams.get('q'), limit) });
      return;
    }
    if (parts[0] === 'profiles' && parts[1] && parts[2] === 'tracks') {
      send(res, 200, { tracks: await getTracksByProfileId(decodeURIComponent(parts[1]), limit) });
      return;
    }
    if (parts[0] === 'wallets' && parts[1] && parts[2] === 'tracks') {
      send(res, 200, { tracks: await getTracksByWallet(decodeURIComponent(parts[1]), limit) });
      return;
    }
    if (parts[0] === 'tracks' && parts[1] === 'search') {
      send(res, 200, { tracks: await searchTracks(url.searchParams.get('q'), limit) });
      return;
    }
    if (parts[0] === 'tracks' && parts[1] === 'trending') {
      send(res, 200, { tracks: await getTrendingTracks(limit) });
      return;
    }
    send(res, 404, { error: 'Not found' });
  } catch (error) {
    send(res, 500, { error: error?.message || 'Test API failed' });
  }
}

loadDotenv(path.resolve(process.cwd(), '.env.local'));

const server = http.createServer((req, res) => {
  void route(req, res);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
const indexUrl = `http://127.0.0.1:${address.port}`;
const originalLocation = globalThis.location;

try {
  const streamvault = createStreamVaultClient({ indexUrl });
  Object.defineProperty(globalThis, 'location', {
    value: { origin: indexUrl },
    configurable: true,
  });
  const relativeApiStreamvault = createStreamVaultClient({ indexUrl: '/api' });
  const profile = await streamvault.getProfileByHandle('lto');
  const handleTracks = await streamvault.getTracksByHandle('lto', { limit: 3 });
  const trackSearch = await streamvault.searchTracks({ q: 'hoodrat', limit: 3 });
  const profileSearch = await streamvault.searchProfiles({ q: 'lto', limit: 3 });
  const relativeProfile = await relativeApiStreamvault.getProfileByHandle('lto');

  if (!profile?.id) throw new Error('Expected lto profile through indexUrl.');
  if (handleTracks.length === 0) throw new Error('Expected tracks by handle through indexUrl.');
  if (trackSearch.length === 0) throw new Error('Expected track search results through indexUrl.');
  if (profileSearch.length === 0) throw new Error('Expected profile search results through indexUrl.');
  if (!relativeProfile?.id) throw new Error('Expected lto profile through relative /api indexUrl.');

  console.log(
    JSON.stringify(
      {
        indexUrl,
        profile: { id: profile.id, handle: profile.handle, displayName: profile.displayName },
        handleTrackCount: handleTracks.length,
        trackSearchCount: trackSearch.length,
        relativeApiProfile: { id: relativeProfile.id, handle: relativeProfile.handle },
        firstTrack: { title: trackSearch[0].title, artist: trackSearch[0].artist },
      },
      null,
      2
    )
  );
} finally {
  if (originalLocation) {
    Object.defineProperty(globalThis, 'location', {
      value: originalLocation,
      configurable: true,
    });
  } else {
    delete globalThis.location;
  }
  server.close();
}
