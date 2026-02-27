# StreamVault

**Stream anywhere. Preserve forever.**

A next-generation decentralized music streaming app inspired by Apple Music’s clean, premium UI. It uses the **Open Audio Protocol (Audius)** for discovery and streaming, and **Arweave** for permanent publishing.

## Features

- **Discovery** — Home feed of trending tracks from Audius
- **Streaming** — Play tracks from the Open Audio Protocol
- **Artist profiles** — View artist pages and track lists
- **Now Playing** — Persistent player bar with progress
- **Publish to Arweave** (creator-only):
  - **Sample** — 15s preview under 100KB, free upload, permaweb link, collectible in-app
  - **Full** — Up to ~10MB as an **Atomic Asset** (permaweb-libs), with metadata, artwork, royalties-ready
- **Wallets** — Arweave (Wander), Ethereum (EVM), Solana
- **Shareable profile links** — `/profile/:address` for creators

## Tech stack

- **Vite** + **React 18** + **React Router** (HashRouter for perma-app)
- **Audius API** — `api.audius.co` for tracks and streaming
- **Arweave** — Data transactions for uploads; **@permaweb/libs** for atomic assets
- **@permaweb/aoconnect** — AO signer for atomic asset creation

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Build (perma-app ready)

```bash
npm run build
```

Output is in `dist/`. The app uses `base: './'` and **HashRouter** so it works when deployed to a static host or Arweave.

## Deploy to Arweave (perma-app)

1. Build: `npm run build`
2. Upload the `dist/` folder to Arweave:
   - **Using Permaweb skills** (from repo root):
     ```bash
     use arweave to upload ./dist
     ```
   - Or **upload-site** with wallet:
     ```bash
     node skills/arweave/index.mjs upload-site ./dist --wallet ./wallet.json
     ```
   - Or **arx** (Turbo):
     ```bash
     npx @permaweb/arx upload-dir ./dist --index-file index.html -t arweave -w ./wallet.json
     ```
3. Attach the returned transaction ID to an ArNS name if desired:
   ```bash
   use arweave to attach <txId> myname
   ```

## Environment

- `VITE_AUDIUS_APP_NAME` — Optional app name for Audius API
- `VITE_AO` — Optional AO mode (`legacy` | `mainnet`) for permaweb-libs

## Architecture notes

- **Free uploads under 100KB** — Sample tier uses a single Arweave data transaction (signed with Wander).
- **Larger files** — Full tier uploads the file as a data tx then creates an atomic asset with metadata pointing to the file; for production, consider **bundled uploads** (e.g. Turbo/ARX) for larger payloads.
- **Atomic assets** — `libs.createAtomicAsset()` with `assetType: 'audio'`, metadata (e.g. `audioTxId`, `streamUrl`, `artwork`) for future DEX/royalty integration.
- **Creator verification** — “Publish to Arweave” is shown only when the connected wallet matches the track’s artist (Audius user id compared with connected address where applicable).

## License

MIT
