import type RendererInterface from "@hashlips-lab/art-engine/dist/common/renderers/renderer.interface";
import type { RendererInitPropsInterface, ItemsRenders } from "@hashlips-lab/art-engine/dist/common/renderers/renderer.interface";
export interface AudioRenderData {
    path: string;
}
export declare class AudioMixRenderer implements RendererInterface<AudioRenderData> {
    attributesGetter: RendererInitPropsInterface["attributesGetter"];
    private cachePath;
    private tempDir;
    init(props: RendererInitPropsInterface): Promise<void>;
    render(): Promise<ItemsRenders<AudioRenderData>>;
    private getFfmpeg;
    private concatClips;
}
//# sourceMappingURL=audio-mix-renderer.d.ts.map