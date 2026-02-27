/**
 * StreamVault Art Engine — generative cover art.
 * Configured for a small set (1–10) and 1K output for quick cover options.
 * Add layers under data/, run npm run start, then use output/images/ in the app.
 */
export {};
const {
  ArtEngine,
  inputs,
  generators,
  renderers,
  exporters,
} = require("@hashlips-lab/art-engine");
const path = require("path");

const BASE_PATH = path.join(__dirname, "..");

const ae = new ArtEngine({
  cachePath: `${BASE_PATH}/cache`,
  outputPath: `${BASE_PATH}/output`,
  useCache: false,

  inputs: {
    covers: new inputs.ImageLayersInput({
      assetsBasePath: `${BASE_PATH}/data`,
    }),
  },

  generators: [
    new generators.ImageLayersAttributesGenerator({
      dataSet: "covers",
      startIndex: 1,
      endIndex: 10,
    }),
  ],

  renderers: [
    new renderers.ItemAttributesRenderer({
      name: (itemUid: string) => `Cover ${itemUid}`,
      description: (attributes: any) => {
        const parts = attributes ? Object.entries(attributes).map(([k, v]: [string, any]) => `${k}: ${(v && v[0]) || ""}`) : [];
        return parts.length ? `StreamVault cover. ${parts.join(", ")}` : "StreamVault generative cover art.";
      },
    }),
    new renderers.ImageLayersRenderer({
      width: 1024,
      height: 1024,
    }),
  ],

  exporters: [
    new exporters.ImagesExporter(),
    new exporters.Erc721MetadataExporter({
      imageUriPrefix: "ipfs://__CID__/",
    }),
  ],
});

(async () => {
  await ae.run();
  await ae.printPerformance();
})();
