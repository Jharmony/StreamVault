/**
 * StreamVault Art Engine — Audio beat/instrumental pipeline.
 * Uses audio clips (local or Arweave permaweb URLs, e.g. 15s sample bites from StreamVault)
 * to generate beats/instrumentals. Add clips to data/audio-clips/ or a manifest with URLs.
 * Run: npm run start:audio
 */
export {};
const { ArtEngine } = require("@hashlips-lab/art-engine");
const path = require("path");

const BASE_PATH = path.join(__dirname, "..");

const { AudioClipsInput } = require("./custom/inputs/audio-clips-input");
const { AudioBeatGenerator } = require("./custom/generators/audio-beat-generator");
const { AudioMixRenderer } = require("./custom/renderers/audio-mix-renderer");
const { AudioExporter } = require("./custom/exporters/audio-exporter");

const ae = new ArtEngine({
  cachePath: `${BASE_PATH}/cache`,
  outputPath: `${BASE_PATH}/output`,
  useCache: false,

  inputs: {
    audioClips: new AudioClipsInput({
      assetsBasePath: path.join(BASE_PATH, "data", "audio-clips"),
      cachePath: path.join(BASE_PATH, "cache", "audio-clips-downloads"),
    }),
  },

  generators: [
    new AudioBeatGenerator({
      startIndex: 1,
      endIndex: 5,
      minClips: 4,
      maxClips: 10,
    }),
  ],

  renderers: [new AudioMixRenderer()],

  exporters: [new AudioExporter()],
});

(async () => {
  await ae.run();
  await ae.printPerformance();
})();
