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
exports.AudioClipsInput = void 0;
/**
 * StreamVault Art Engine — Audio Clips Input.
 * Loads audio clips from a folder and/or a manifest that can include Arweave permaweb URLs
 * (e.g. 15s samples published from StreamVault). Used by the audio beat/instrumental pipeline.
 */
const path = __importStar(require("path"));
const fs_1 = require("fs");
const AUDIO_EXT = [".mp3", ".wav", ".ogg", ".m4a"];
const DEFAULT_BASE = path.join(__dirname, "..", "..", "..", "data", "audio-clips");
const CACHE_CLIPS = "audio-clips-downloads";
class AudioClipsInput {
    basePath;
    cachePath;
    seed = "";
    constructor(options) {
        this.basePath = options?.assetsBasePath ?? DEFAULT_BASE;
        this.cachePath = options?.cachePath ?? path.join(__dirname, "..", "..", "..", "cache", CACHE_CLIPS);
    }
    async init(props) {
        this.seed = props.seed;
        await fs_1.promises.mkdir(this.cachePath, { recursive: true });
    }
    async load() {
        const clips = [];
        const manifestPath = path.join(this.basePath, "manifest.json");
        try {
            const raw = await fs_1.promises.readFile(manifestPath, "utf-8");
            const manifest = JSON.parse(raw);
            const list = manifest.clips ?? [];
            for (let i = 0; i < list.length; i++) {
                const entry = list[i];
                const id = entry.id || `clip-${i + 1}`;
                if (entry.url) {
                    const localPath = path.join(this.cachePath, `${id}.mp3`);
                    try {
                        await this.download(entry.url, localPath);
                        clips.push({ id, path: localPath });
                    }
                    catch (e) {
                        console.warn(`[AudioClipsInput] Failed to download ${entry.url}:`, e);
                    }
                }
                else if (entry.path) {
                    const fullPath = path.isAbsolute(entry.path)
                        ? entry.path
                        : path.join(this.basePath, entry.path);
                    try {
                        await fs_1.promises.access(fullPath);
                        clips.push({ id, path: fullPath });
                    }
                    catch {
                        console.warn(`[AudioClipsInput] File not found: ${fullPath}`);
                    }
                }
            }
        }
        catch (err) {
            if (err?.code !== "ENOENT")
                throw err;
            // No manifest: scan folder for audio files
            const files = await fs_1.promises.readdir(this.basePath).catch(() => []);
            let idx = 0;
            for (const name of files) {
                const ext = path.extname(name).toLowerCase();
                if (AUDIO_EXT.includes(ext)) {
                    const id = path.basename(name, ext);
                    clips.push({ id: id || `clip-${++idx}`, path: path.join(this.basePath, name) });
                }
            }
        }
        return { clips };
    }
    async download(url, destPath) {
        const res = await fetch(url, { redirect: "follow" });
        if (!res.ok)
            throw new Error(`HTTP ${res.status}`);
        const buf = await res.arrayBuffer();
        await fs_1.promises.writeFile(destPath, Buffer.from(buf));
    }
}
exports.AudioClipsInput = AudioClipsInput;
