"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const { ArtEngine, inputs, generators, renderers, exporters, } = require("@hashlips-lab/art-engine");
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
            name: (itemUid) => `Cover ${itemUid}`,
            description: (attributes) => {
                const parts = attributes ? Object.entries(attributes).map(([k, v]) => `${k}: ${(v && v[0]) || ""}`) : [];
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
