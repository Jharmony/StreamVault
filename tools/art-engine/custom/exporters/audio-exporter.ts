/**
 * StreamVault Art Engine — Audio Exporter.
 * Writes rendered beat/instrumental files to output/audio/ and a manifest for use in StreamVault.
 */
import * as path from "path";
import { promises as fs } from "fs";

import type ExporterInterface from "@hashlips-lab/art-engine/dist/common/exporters/exporter.interface";
import type { ExporterInitPropsInterface } from "@hashlips-lab/art-engine/dist/common/exporters/exporter.interface";
import type { ItemPropertiesInterface } from "@hashlips-lab/art-engine/dist/utils/managers/items-data/items-data.interface";
import type { AudioRenderData } from "../renderers/audio-mix-renderer";

const RENDER_KIND = "StreamVaultAudioRender@v1";

export class AudioExporter implements ExporterInterface {
  private rendersGetter!: ExporterInitPropsInterface["rendersGetter"];
  private outputPath: string = "";

  async init(props: ExporterInitPropsInterface): Promise<void> {
    this.rendersGetter = props.rendersGetter;
    this.outputPath = props.outputPath;
  }

  async export(): Promise<void> {
    const audioDir = path.join(this.outputPath, "audio");
    await fs.mkdir(audioDir, { recursive: true });

    const manifest: { items: Array<{ id: string; file: string }> } = { items: [] };

    for (const [itemUid, renders] of Object.entries(this.rendersGetter())) {
      const render = (renders as ItemPropertiesInterface<AudioRenderData>[]).find(
        (r) => r.kind === RENDER_KIND
      ) as ItemPropertiesInterface<AudioRenderData> | undefined;
      if (!render?.data?.path) continue;

      const src = render.data.path;
      const dest = path.join(audioDir, `${itemUid}.mp3`);
      try {
        await fs.copyFile(src, dest);
        manifest.items.push({ id: itemUid, file: `${itemUid}.mp3` });
      } catch (e) {
        console.warn(`[AudioExporter] Copy failed for item ${itemUid}:`, e);
      }
    }

    await fs.writeFile(
      path.join(audioDir, "manifest.json"),
      JSON.stringify(manifest, null, 2),
      "utf-8"
    );
  }
}
