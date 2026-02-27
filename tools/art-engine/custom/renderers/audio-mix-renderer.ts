/**
 * StreamVault Art Engine — Audio Mix Renderer.
 * Concatenates audio clips (e.g. from Arweave sample bites) into a single beat/instrumental file.
 */
import * as path from "path";
import { promises as fs } from "fs";

import type RendererInterface from "@hashlips-lab/art-engine/dist/common/renderers/renderer.interface";
import type {
  RendererInitPropsInterface,
  ItemsRenders,
} from "@hashlips-lab/art-engine/dist/common/renderers/renderer.interface";
import type { ItemPropertiesInterface } from "@hashlips-lab/art-engine/dist/utils/managers/items-data/items-data.interface";
import type { AudioBeatAttribute } from "../generators/audio-beat-generator";

const GENERATOR_KIND = "StreamVaultAudioBeat@v1";
const RENDER_KIND = "StreamVaultAudioRender@v1";

export interface AudioRenderData {
  path: string;
}

export class AudioMixRenderer implements RendererInterface<AudioRenderData> {
  attributesGetter!: RendererInitPropsInterface["attributesGetter"];
  private cachePath: string = "";
  private tempDir!: string;

  async init(props: RendererInitPropsInterface): Promise<void> {
    this.attributesGetter = props.attributesGetter;
    this.cachePath = props.cachePath;
    this.tempDir = path.join(this.cachePath, "audio-mix");
    await fs.mkdir(this.tempDir, { recursive: true });
  }

  async render(): Promise<ItemsRenders<AudioRenderData>> {
    const ffmpeg = await this.getFfmpeg();
    const renders: ItemsRenders<AudioRenderData> = {};
    const attributes = this.attributesGetter();

    for (const [itemUid, attrs] of Object.entries(attributes)) {
      const beatAttr = (attrs as ItemPropertiesInterface<AudioBeatAttribute>[]).find(
        (a) => a.kind === GENERATOR_KIND
      ) as ItemPropertiesInterface<AudioBeatAttribute> | undefined;
      if (!beatAttr?.data?.clipPaths?.length) continue;

      const outPath = path.join(this.tempDir, `${itemUid}.mp3`);
      await this.concatClips(ffmpeg, beatAttr.data.clipPaths, outPath);
      renders[itemUid] = [{ kind: RENDER_KIND, data: { path: outPath } }];
    }

    return renders;
  }

  private async getFfmpeg(): Promise<{ path: string }> {
    try {
      const ffmpegStatic = require("ffmpeg-static");
      return { path: ffmpegStatic };
    } catch {
      return { path: "ffmpeg" };
    }
  }

  private async concatClips(
    ffmpeg: { path: string },
    clipPaths: string[],
    outPath: string
  ): Promise<void> {
    const listPath = path.join(this.tempDir, `list-${Date.now()}.txt`);
    const listContent = clipPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n");
    await fs.writeFile(listPath, listContent, "utf-8");

    const { promisify } = await import("util");
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
    ]).catch(async (e: Error) => {
      await fs.unlink(listPath).catch(() => {});
      throw e;
    });
    await fs.unlink(listPath).catch(() => {});
  }
}
