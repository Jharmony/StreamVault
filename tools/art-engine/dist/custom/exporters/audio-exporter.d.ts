import type ExporterInterface from "@hashlips-lab/art-engine/dist/common/exporters/exporter.interface";
import type { ExporterInitPropsInterface } from "@hashlips-lab/art-engine/dist/common/exporters/exporter.interface";
export declare class AudioExporter implements ExporterInterface {
    private rendersGetter;
    private outputPath;
    init(props: ExporterInitPropsInterface): Promise<void>;
    export(): Promise<void>;
}
//# sourceMappingURL=audio-exporter.d.ts.map