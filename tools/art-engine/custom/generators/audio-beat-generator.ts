/**
 * StreamVault Art Engine — Audio Beat Generator.
 * Generates beat/instrumental sequences from audio clips (e.g. Arweave sample bites).
 * Each item is a sequence of clip paths for the renderer to concatenate.
 */
import type GeneratorInterface from "@hashlips-lab/art-engine/dist/common/generators/generator.interface";
import type {
  GeneratorInitPropsInterface,
  ItemsAttributes,
} from "@hashlips-lab/art-engine/dist/common/generators/generator.interface";
import type InputsManager from "@hashlips-lab/art-engine/dist/utils/managers/inputs/inputs.manager";
import type { AudioClipsInputData } from "../inputs/audio-clips-input";

const KIND = "StreamVaultAudioBeat@v1";

export interface AudioBeatAttribute {
  clipPaths: string[];
}

function seededRandom(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  return () => {
    h = (Math.imul(16807, h) + 2147483647) % 2147483647;
    return (h - 1) / 2147483646;
  };
}

export class AudioBeatGenerator implements GeneratorInterface<AudioBeatAttribute> {
  inputsManager!: InputsManager;
  private seed: string = "";
  private startIndex: number;
  private endIndex: number;
  private minClips: number;
  private maxClips: number;

  constructor(options?: { startIndex?: number; endIndex?: number; minClips?: number; maxClips?: number }) {
    this.startIndex = options?.startIndex ?? 1;
    this.endIndex = options?.endIndex ?? 5;
    this.minClips = options?.minClips ?? 4;
    this.maxClips = options?.maxClips ?? 10;
  }

  async init(props: GeneratorInitPropsInterface): Promise<void> {
    this.inputsManager = props.inputsManager;
    this.seed = props.seed;
  }

  async generate(): Promise<ItemsAttributes<AudioBeatAttribute>> {
    const input = this.inputsManager.get("audioClips") as AudioClipsInputData;
    const clips = input?.clips ?? [];
    if (clips.length === 0) {
      console.warn("[AudioBeatGenerator] No clips from input. Add files to data/audio-clips/ or a manifest with Arweave URLs.");
      return {};
    }

    const random = seededRandom(this.seed);
    const items: ItemsAttributes<AudioBeatAttribute> = {};

    for (let i = this.startIndex; i <= this.endIndex; i++) {
      const itemUid = String(i);
      const len = this.minClips + Math.floor(random() * (this.maxClips - this.minClips + 1));
      const clipPaths: string[] = [];
      for (let j = 0; j < len; j++) {
        const clip = clips[Math.floor(random() * clips.length)];
        clipPaths.push(clip.path);
      }
      items[itemUid] = [{ kind: KIND, data: { clipPaths } }];
    }

    return items;
  }
}
