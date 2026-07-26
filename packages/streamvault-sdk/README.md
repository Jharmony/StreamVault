# @streamvault/sdk

Read-only SDK for StreamVault profiles, Arweave music uploads, AO atomic assets, and UCM marketplace context.

This package is an alpha release. The reliable indexed surface supports Zone profile handle/display-name lookup, track title/artist search, wallet/profile id lookup, and playable music tracks from StreamVault uploads.

## Install

```bash
npm install @streamvault/sdk@alpha @permaweb/libs @permaweb/aoconnect arweave
```

npm package page: https://www.npmjs.com/package/@streamvault/sdk

## Quick Start

```ts
import Arweave from 'arweave';
import Permaweb from '@permaweb/libs';
import { connect } from '@permaweb/aoconnect';
import { createStreamVaultClient } from '@streamvault/sdk';

const ao = connect({ MODE: 'mainnet' });
const permaweb = Permaweb.init({
  ao,
  arweave: Arweave.init({}),
  gateway: 'https://ao-search-gateway.goldsky.com',
});

const streamvault = createStreamVaultClient({ permaweb });
const result = await streamvault.resolveProfile(walletOrProfileId);
const tracks = result.profile
  ? await streamvault.getTracksByProfile(result.profile, { limit: 50 })
  : [];

for (const track of tracks) {
  console.log(track.title, track.streamUrl, track.assetId);
}
```

## Core API

### `createStreamVaultClient(options)`

Creates the SDK client.

```ts
const streamvault = createStreamVaultClient({ permaweb });
```

Options:

- `permaweb`: permaweb-libs instance. Required for profile reads.
- `index.supabaseUrl`: optional StreamVault public Supabase index URL for fast handle/search reads.
- `index.supabaseKey`: optional Supabase publishable/anon key for public index reads.
- `gqlUrl`: optional Arweave L1 GraphQL endpoint override.
- `aoGatewayUrl`: optional AO GraphQL gateway override.
- `hbReadNodes`: optional HyperBEAM read node list.

### Profile Methods

- `resolveProfile(ref)`: resolves an Arweave wallet address or profile zone id.
- `getProfileByWallet(walletAddress)`: loads the newest profile zone for a wallet.
- `getProfileById(profileId)`: loads a profile zone directly.
- `getProfileByHandle(handle)`: loads a profile from the StreamVault index when configured.
- `searchProfiles({ q, limit })`: searches indexed profiles by handle or display name.

Handle lookup requires the StreamVault index configuration. Without it, wallet and profile id lookup still fall back to direct Arweave/AO reads.

### Music Methods

- `getTracksByProfile(profile, { limit })`: loads wallet uploads and profile-zone music atomic assets.
- `getTracksByProfileId(profileId, { limit })`: loads indexed/direct tracks for a profile zone id.
- `getTracksByHandle(handle, { limit })`: loads tracks by indexed Zone profile handle.
- `getTracksByWallet(walletAddress, { limit })`: loads StreamVault Arweave uploads owned by a wallet.
- `searchTracks({ q, handle, walletAddress, profileId, limit })`: searches indexed tracks or routes to specific indexed lookups.
- `getTrendingTracks({ limit })`: loads recent public StreamVault music uploads.
- `getStreamUrls(audioTxId)`: returns public Arweave gateway URLs for playback.
- `getPreferredStreamUrl(audioTxId)`: returns the default playback URL.

### Atomic Asset Methods

- `getAtomicAsset(assetId)`: resolves an AO atomic asset to its audio tx id and display metadata.
- `getAssetUcmMarketStatus(assetId)`: returns UCM marketplace status shape.
- `getAssetUcmAsks(assetId)`: returns current readable ask orders when indexed.
- `getMarketplaceListings({ limit })`: reserved for broader marketplace discovery.

## Using Returned Data

Partner apps can render players, track cards, playlist rows, or competition entries directly from `StreamVaultTrack`.

```ts
const result = await streamvault.resolveProfile(walletOrProfileId);
const tracks = result.profile
  ? await streamvault.getTracksByProfile(result.profile, { limit: 50 })
  : await streamvault.getTracksByWallet(walletOrProfileId, { limit: 50 });

for (const track of tracks) {
  console.log({
    title: track.title,
    artist: track.artist,
    audioTxId: track.audioTxId,
    audioUrl: track.streamUrl,
    coverArtUrl: track.artworkUrl,
    atomicAssetId: track.assetId,
  });
}
```

## Indexed Lookup

For Audius-like partner flows, configure the public StreamVault index:

```ts
const streamvault = createStreamVaultClient({
  permaweb,
  index: {
    supabaseUrl: 'https://YOUR_PROJECT_REF.supabase.co',
    supabaseKey: 'sb_publishable_or_anon_key',
  },
});

const profile = await streamvault.getProfileByHandle('lto');
const tracks = await streamvault.getTracksByHandle('lto', { limit: 20 });
const searchResults = await streamvault.searchTracks({ q: 'hoodrat', limit: 20 });
```

The index supports profile handle/display-name lookup and track title/artist search. The index is a searchable mirror. Arweave/AO remain the source of truth.

Field usage:

- `track.audioTxId`: permanent Arweave transaction id for the uploaded audio.
- `track.streamUrl`: default playable gateway URL for an audio element.
- `track.streamUrls`: fallback gateway URLs if a partner wants retry logic.
- `track.artworkUrl`: cover art URL for cards, players, and playlist rows.
- `track.assetId`: AO atomic asset id for license context, ownership, or UCM lookups.
- `track.title` and `track.artist`: normalized display metadata.
- `profile.displayName`, `profile.handle`, and `profile.avatarUrl`: profile UI metadata.

Gateway usage:

The SDK returns `track.streamUrl`, `track.streamUrls`, and `track.artworkUrl` so partners usually do not need to build URLs manually. If a partner wants to choose a gateway, append the Arweave transaction id to any compatible raw-data gateway URL.

```ts
const audioUrl = `https://arweave.net/${track.audioTxId}`;
const fallbackAudioUrl = `https://aoweave.tech/${track.audioTxId}`;
const coverArtUrl = track.artworkUrl;
```

## Types

- `StreamVaultProfile`: normalized profile id, wallet, display name, handle, media, and profile asset refs.
- `StreamVaultTrack`: playable track model with audio tx id, stream URLs, artwork, artist, and atomic asset id.
- `StreamVaultProfileResolution`: result from `resolveProfile`.
- `StreamVaultAtomicAsset`: atomic asset metadata and linked audio tx id.
- `AssetUcmMarketStatus`: UCM marketplace status shape for a music asset.

## Alpha Notes

- Public Arweave uploads are playable by anyone.
- UDL metadata describes usage terms but does not enforce playback restrictions.
- Indexed handle lookup is active for Zone profile handles.
- UCM marketplace status is present as a stable type, but deeper listing discovery will expand after the first alpha.
