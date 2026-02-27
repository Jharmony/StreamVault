import type InputInterface from "@hashlips-lab/art-engine/dist/common/inputs/input.interface";
import type { InputInitPropsInterface } from "@hashlips-lab/art-engine/dist/common/inputs/input.interface";
export interface AudioClipRef {
    id: string;
    path: string;
}
export interface AudioClipsInputData {
    clips: AudioClipRef[];
}
export declare class AudioClipsInput implements InputInterface<AudioClipsInputData> {
    private basePath;
    private cachePath;
    private seed;
    constructor(options?: {
        assetsBasePath?: string;
        cachePath?: string;
    });
    init(props: InputInitPropsInterface): Promise<void>;
    load(): Promise<AudioClipsInputData>;
    private download;
}
//# sourceMappingURL=audio-clips-input.d.ts.map