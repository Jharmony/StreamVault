"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioBeatGenerator = void 0;
const KIND = "StreamVaultAudioBeat@v1";
function seededRandom(seed) {
    let h = 0;
    for (let i = 0; i < seed.length; i++)
        h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
    return () => {
        h = (Math.imul(16807, h) + 2147483647) % 2147483647;
        return (h - 1) / 2147483646;
    };
}
class AudioBeatGenerator {
    inputsManager;
    seed = "";
    startIndex;
    endIndex;
    minClips;
    maxClips;
    constructor(options) {
        this.startIndex = options?.startIndex ?? 1;
        this.endIndex = options?.endIndex ?? 5;
        this.minClips = options?.minClips ?? 4;
        this.maxClips = options?.maxClips ?? 10;
    }
    async init(props) {
        this.inputsManager = props.inputsManager;
        this.seed = props.seed;
    }
    async generate() {
        const input = this.inputsManager.get("audioClips");
        const clips = input?.clips ?? [];
        if (clips.length === 0) {
            console.warn("[AudioBeatGenerator] No clips from input. Add files to data/audio-clips/ or a manifest with Arweave URLs.");
            return {};
        }
        const random = seededRandom(this.seed);
        const items = {};
        for (let i = this.startIndex; i <= this.endIndex; i++) {
            const itemUid = String(i);
            const len = this.minClips + Math.floor(random() * (this.maxClips - this.minClips + 1));
            const clipPaths = [];
            for (let j = 0; j < len; j++) {
                const clip = clips[Math.floor(random() * clips.length)];
                clipPaths.push(clip.path);
            }
            items[itemUid] = [{ kind: KIND, data: { clipPaths } }];
        }
        return items;
    }
}
exports.AudioBeatGenerator = AudioBeatGenerator;
