"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioExporter = void 0;
/**
 * StreamVault Art Engine — Audio Exporter.
 * Writes rendered beat/instrumental files to output/audio/ and a manifest for use in StreamVault.
 */
const path = __importStar(require("path"));
const fs_1 = require("fs");
const RENDER_KIND = "StreamVaultAudioRender@v1";
class AudioExporter {
    rendersGetter;
    outputPath = "";
    async init(props) {
        this.rendersGetter = props.rendersGetter;
        this.outputPath = props.outputPath;
    }
    async export() {
        const audioDir = path.join(this.outputPath, "audio");
        await fs_1.promises.mkdir(audioDir, { recursive: true });
        const manifest = { items: [] };
        for (const [itemUid, renders] of Object.entries(this.rendersGetter())) {
            const render = renders.find((r) => r.kind === RENDER_KIND);
            if (!render?.data?.path)
                continue;
            const src = render.data.path;
            const dest = path.join(audioDir, `${itemUid}.mp3`);
            try {
                await fs_1.promises.copyFile(src, dest);
                manifest.items.push({ id: itemUid, file: `${itemUid}.mp3` });
            }
            catch (e) {
                console.warn(`[AudioExporter] Copy failed for item ${itemUid}:`, e);
            }
        }
        await fs_1.promises.writeFile(path.join(audioDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf-8");
    }
}
exports.AudioExporter = AudioExporter;
