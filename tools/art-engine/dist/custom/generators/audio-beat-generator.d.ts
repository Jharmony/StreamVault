/**
 * StreamVault Art Engine — Audio Beat Generator.
 * Generates beat/instrumental sequences from audio clips (e.g. Arweave sample bites).
 * Each item is a sequence of clip paths for the renderer to concatenate.
 */
import type GeneratorInterface from "@hashlips-lab/art-engine/dist/common/generators/generator.interface";
import type { GeneratorInitPropsInterface, ItemsAttributes } from "@hashlips-lab/art-engine/dist/common/generators/generator.interface";
import type InputsManager from "@hashlips-lab/art-engine/dist/utils/managers/inputs/inputs.manager";
export interface AudioBeatAttribute {
    clipPaths: string[];
}
export declare class AudioBeatGenerator implements GeneratorInterface<AudioBeatAttribute> {
    inputsManager: InputsManager;
    private seed;
    private startIndex;
    private endIndex;
    private minClips;
    private maxClips;
    constructor(options?: {
        startIndex?: number;
        endIndex?: number;
        minClips?: number;
        maxClips?: number;
    });
    init(props: GeneratorInitPropsInterface): Promise<void>;
    generate(): Promise<ItemsAttributes<AudioBeatAttribute>>;
}
//# sourceMappingURL=audio-beat-generator.d.ts.map