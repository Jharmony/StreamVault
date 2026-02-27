/**
 * StreamVault Art Engine — Audio Clips Input.
 * Loads audio clips from a folder and/or a manifest that can include Arweave permaweb URLs
 * (e.g. 15s samples published from StreamVault). Used by the audio beat/instrumental pipeline.
 */
import * as path from "path";
import { promises as fs } from "fs";

import type InputInterface from "@hashlips-lab/art-engine/dist/common/inputs/input.interface";
import type { InputInitPropsInterface } from "@hashlips-lab/art-engine/dist/common/inputs/input.interface";

const AUDIO_EXT = [".mp3", ".wav", ".ogg", ".m4a"];

export interface AudioClipRef {
  id: string;
  path: string;
}

export interface AudioClipsInputData {
  clips: AudioClipRef[];
}

const DEFAULT_BASE = path.join(__dirname, "..", "..", "..", "data", "audio-clips");
const CACHE_CLIPS = "audio-clips-downloads";

export class AudioClipsInput implements InputInterface<AudioClipsInputData> {
  private basePath: string;
  private cachePath: string;
  private seed: string = "";

  constructor(options?: { assetsBasePath?: string; cachePath?: string }) {
    this.basePath = options?.assetsBasePath ?? DEFAULT_BASE;
    this.cachePath = options?.cachePath ?? path.join(__dirname, "..", "..", "..", "cache", CACHE_CLIPS);
  }

  async init(props: InputInitPropsInterface): Promise<void> {
    this.seed = props.seed;
    await fs.mkdir(this.cachePath, { recursive: true });
  }

  async load(): Promise<AudioClipsInputData> {
    const clips: AudioClipRef[] = [];
    const manifestPath = path.join(this.basePath, "manifest.json");

    try {
      const raw = await fs.readFile(manifestPath, "utf-8") as string;
      const manifest = JSON.parse(raw) as {
        clips?: Array<{ id: string; url?: string; path?: string }>;
      };
      const list = manifest.clips ?? [];
      for (let i = 0; i < list.length; i++) {
        const entry = list[i];
        const id = entry.id || `clip-${i + 1}`;
        if (entry.url) {
          const localPath = path.join(this.cachePath, `${id}.mp3`);
          try {
            await this.download(entry.url, localPath);
            clips.push({ id, path: localPath });
          } catch (e) {
            console.warn(`[AudioClipsInput] Failed to download ${entry.url}:`, e);
          }
        } else if (entry.path) {
          const fullPath = path.isAbsolute(entry.path)
            ? entry.path
            : path.join(this.basePath, entry.path);
          try {
            await fs.access(fullPath);
            clips.push({ id, path: fullPath });
          } catch {
            console.warn(`[AudioClipsInput] File not found: ${fullPath}`);
          }
        }
      }
    } catch (err: any) {
      if (err?.code !== "ENOENT") throw err;
      // No manifest: scan folder for audio files
      const files = await fs.readdir(this.basePath).catch(() => []);
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

  private async download(url: string, destPath: string): Promise<void> {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    await fs.writeFile(destPath, Buffer.from(buf));
  }
}
