# Audio clips for beat/instrumental generation

This folder feeds the **audio pipeline** (`npm run start:audio`). You can use local files and/or Arweave permaweb URLs (e.g. 15s sample bites published from StreamVault).

## Option 1: Local files

Drop audio files (`.mp3`, `.wav`, `.ogg`, `.m4a`) here. The pipeline will discover them and use them as clips to build beats.

## Option 2: Manifest with Arweave URLs

Create `manifest.json` in this folder:

```json
{
  "clips": [
    { "id": "vocal-chop", "url": "https://arweave.net/YOUR_15S_SAMPLE_TX_ID" },
    { "id": "loop1", "path": "loop.wav" }
  ]
}
```

- **url**: Permaweb URL of an audio file (e.g. a 15s sample you published from StreamVault). It will be downloaded and cached.
- **path**: Path relative to this folder (local file).

After running `npm run start:audio`, output beats are in `output/audio/` (e.g. `1.mp3` … `5.mp3`) and `output/audio/manifest.json`.
