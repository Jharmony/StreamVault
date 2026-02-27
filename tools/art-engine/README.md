# StreamVault Art Engine

Generative cover art for [StreamVault](https://github.com/...) using [Hashlips Art Engine 2.0](https://lab.hashlips.io/docs/art-engine).

## Requirements

- **Node.js 20+** (use `nvm use 20` or install from nodejs.org).

## Quick start

1. **Add layers**  
   Put your image layers in `data/`, organized by trait (e.g. `data/Background/`, `data/Frame/`).  
   See [data/README.md](data/README.md) for naming (`__z`, `__w`) and structure.

2. **Generate**  
   From this directory:
   ```bash
   npm install
   npm run start
   ```
   Output images go to `output/images/` (e.g. `1.png` … `10.png`).

3. **Use in StreamVault**  
   In the app: **Publish to Arweave** → Full — Atomic Asset → **Cover image** → choose a file from `output/images/`. The image is uploaded to Arweave and attached to your release.

## Config

- **Count**: 1–10 images (edit `endIndex` in `index.ts`).
- **Size**: 1024×1024 (edit `width`/`height` in `ImageLayersRenderer`).
- **Dataset**: Single input `covers` from `data/`.

## Audio pipeline (beats / instrumentals)

A **plugin** in this repo lets you generate beats or instrumentals from audio clips—including the 15s sample bites you publish to Arweave from StreamVault.

1. **Add clips**  
   Put audio files in `data/audio-clips/`, or create `data/audio-clips/manifest.json` with Arweave permaweb URLs (e.g. your published 15s samples). See [data/audio-clips/README.md](data/audio-clips/README.md).

2. **Generate**  
   From this directory:
   ```bash
   npm run start:audio
   ```
   Output goes to `output/audio/` (e.g. `1.mp3` … `5.mp3` and `manifest.json`).

The pipeline uses custom Art Engine plugins: **AudioClipsInput** (load from folder or manifest + download from Arweave), **AudioBeatGenerator** (sequence clips), **AudioMixRenderer** (concat with ffmpeg), **AudioExporter** (write to `output/audio/`).

## Windows

If `rm -rf ./dist` fails, run:
```bash
npx rimraf dist && tsc && node dist/index.js
```
or add `rimraf` as a dev dependency and use it in the `start` script.
