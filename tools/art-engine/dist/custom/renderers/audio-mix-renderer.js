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
exports.AudioMixRenderer = void 0;
/**
 * StreamVault Art Engine — Audio Mix Renderer.
 * Concatenates audio clips (e.g. from Arweave sample bites) into a single beat/instrumental file.
 */
const path = __importStar(require("path"));
const fs_1 = require("fs");
const GENERATOR_KIND = "StreamVaultAudioBeat@v1";
const RENDER_KIND = "StreamVaultAudioRender@v1";
class AudioMixRenderer {
    attributesGetter;
    cachePath = "";
    tempDir;
    async init(props) {
        this.attributesGetter = props.attributesGetter;
        this.cachePath = props.cachePath;
        this.tempDir = path.join(this.cachePath, "audio-mix");
        await fs_1.promises.mkdir(this.tempDir, { recursive: true });
    }
    async render() {
        const ffmpeg = await this.getFfmpeg();
        const renders = {};
        const attributes = this.attributesGetter();
        for (const [itemUid, attrs] of Object.entries(attributes)) {
            const beatAttr = attrs.find((a) => a.kind === GENERATOR_KIND);
            if (!beatAttr?.data?.clipPaths?.length)
                continue;
            const outPath = path.join(this.tempDir, `${itemUid}.mp3`);
            await this.concatClips(ffmpeg, beatAttr.data.clipPaths, outPath);
            renders[itemUid] = [{ kind: RENDER_KIND, data: { path: outPath } }];
        }
        return renders;
    }
    async getFfmpeg() {
        try {
            const ffmpegStatic = require("ffmpeg-static");
            return { path: ffmpegStatic };
        }
        catch {
            return { path: "ffmpeg" };
        }
    }
    async concatClips(ffmpeg, clipPaths, outPath) {
        const listPath = path.join(this.tempDir, `list-${Date.now()}.txt`);
        const listContent = clipPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n");
        await fs_1.promises.writeFile(listPath, listContent, "utf-8");
        const { promisify } = await Promise.resolve().then(() => __importStar(require("util")));
        const execFile = promisify(require("child_process").execFile);
        await execFile(ffmpeg.path, [
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            listPath,
            "-c",
            "copy",
            outPath,
        ]).catch(async (e) => {
            await fs_1.promises.unlink(listPath).catch(() => { });
            throw e;
        });
        await fs_1.promises.unlink(listPath).catch(() => { });
    }
}
exports.AudioMixRenderer = AudioMixRenderer;
