import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  getProfileByHandle,
  getTracksByProfileId,
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

loadDotenv(path.resolve(process.cwd(), '.env.local'));

const handle = process.argv[2] || 'lto';
const trackQuery = process.argv[3] || 'hoodrat';

const profile = await getProfileByHandle(handle);
if (!profile?.id) {
  throw new Error(`Expected profile for handle "${handle}".`);
}

const profileSearch = await searchProfiles(handle, 5);
const profileTracks = await getTracksByProfileId(profile.id, 5);
const trackSearch = await searchTracks(trackQuery, 5);

console.log(
  JSON.stringify(
    {
      handle,
      profile: {
        id: profile.id,
        handle: profile.handle,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
      },
      profileSearchCount: profileSearch.length,
      profileTrackCount: profileTracks.length,
      trackQuery,
      trackSearchCount: trackSearch.length,
      firstTrack: trackSearch[0]
        ? {
            title: trackSearch[0].title,
            artist: trackSearch[0].artist,
            audioTxId: trackSearch[0].audioTxId,
            streamUrl: trackSearch[0].streamUrl,
          }
        : null,
    },
    null,
    2
  )
);
