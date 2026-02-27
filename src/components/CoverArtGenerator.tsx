import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGeneratedCover } from '../context/GeneratedCoverContext';
import styles from './CoverArtGenerator.module.css';

const MAX_LAYERS = 5;
const OUTPUT_SIZE = 1024;

type Layer = {
  id: string;
  file: File | null;
  preview: string | null;
  opacity: number;
};

function createLayer(id: string): Layer {
  return { id, file: null, preview: null, opacity: 100 };
}

export function CoverArtGenerator() {
  const navigate = useNavigate();
  const { setGeneratedCover } = useGeneratedCover();
  const [layers, setLayers] = useState<Layer[]>(() =>
    Array.from({ length: MAX_LAYERS }, (_, i) => createLayer(`layer-${i}`))
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const resultBlobRef = useRef<Blob | null>(null);

  const setLayer = useCallback((index: number, updater: (prev: Layer) => Partial<Layer>) => {
    setLayers((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updater(next[index]) };
      return next;
    });
  }, []);

  const handleLayerFile = useCallback(
    (index: number, file: File | null) => {
      if (!file || !file.type.startsWith('image/')) {
        setLayer(index, () => ({ file: null, preview: null }));
        return;
      }
      const url = URL.createObjectURL(file);
      setLayer(index, () => ({ file, preview: url }));
    },
    [setLayer]
  );

  const handleGenerate = useCallback(async () => {
    const withFiles = layers.filter((l) => l.file);
    if (withFiles.length === 0) {
      setError('Add at least one layer image.');
      return;
    }
    setGenerating(true);
    setError(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    resultBlobRef.current = null;

    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setError('Canvas not supported.');
      setGenerating(false);
      return;
    }

    try {
      for (let i = 0; i < layers.length; i++) {
        const layer = layers[i];
        if (!layer.file || !layer.preview) continue;
        const img = await loadImage(layer.preview);
        ctx.globalAlpha = layer.opacity / 100;
        ctx.drawImage(img, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
      }
      ctx.globalAlpha = 1;

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/png', 1)
      );
      if (blob) {
        resultBlobRef.current = blob;
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        if (canvasRef.current) {
          const refCtx = canvasRef.current.getContext('2d');
          if (refCtx) {
            canvasRef.current.width = OUTPUT_SIZE;
            canvasRef.current.height = OUTPUT_SIZE;
            refCtx.drawImage(canvas, 0, 0);
          }
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to generate image.');
    } finally {
      setGenerating(false);
    }
  }, [layers, previewUrl]);

  const handleUseInPublish = useCallback(() => {
    const blob = resultBlobRef.current;
    if (blob) {
      setGeneratedCover(blob, 'generated-cover.png');
      navigate('/');
    }
  }, [setGeneratedCover, navigate]);

  const handleDownload = useCallback(() => {
    const blob = resultBlobRef.current;
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'streamvault-cover.png';
    a.click();
    URL.revokeObjectURL(a.href);
  }, []);

  const hasResult = Boolean(previewUrl && resultBlobRef.current);

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Generate cover art in the browser</h2>
      <p className={styles.text}>
        Upload up to {MAX_LAYERS} images as layers (first = back, last = front). Set opacity per layer, then generate and use in Publish or download.
      </p>

      <div className={styles.layerGrid}>
        {layers.map((layer, index) => (
          <div key={layer.id} className={styles.layerCard}>
            <span className={styles.layerLabel}>Layer {index + 1} (back → front)</span>
            <label className={styles.fileLabel}>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleLayerFile(index, e.target.files?.[0] ?? null)}
              />
              {layer.preview ? (
                <img src={layer.preview} alt="" className={styles.layerPreview} />
              ) : (
                <div className={styles.layerPlaceholder}>+ Image</div>
              )}
            </label>
            <label className={styles.opacityLabel}>
              Opacity %
              <input
                type="range"
                min={0}
                max={100}
                value={layer.opacity}
                onChange={(e) => setLayer(index, () => ({ opacity: Number(e.target.value) }))}
              />
              <span>{layer.opacity}%</span>
            </label>
          </div>
        ))}
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primaryBtn}
          onClick={handleGenerate}
          disabled={generating || layers.every((l) => !l.file)}
        >
          {generating ? 'Generating…' : 'Generate preview'}
        </button>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {hasResult && (
        <div className={styles.previewSection}>
          <p className={styles.previewLabel}>Output (1024×1024)</p>
          {previewUrl && (
            <img src={previewUrl} alt="Generated cover" className={styles.previewImg} />
          )}
          <div className={styles.previewActions}>
            <button type="button" className={styles.primaryBtn} onClick={handleUseInPublish}>
              Use in Publish →
            </button>
            <button type="button" className={styles.secondaryBtn} onClick={handleDownload}>
              Download PNG
            </button>
          </div>
          <p className={styles.hint}>
            &quot;Use in Publish&quot; saves this image for the next time you open Publish to Arweave (Full — Cover image).
          </p>
        </div>
      )}
    </section>
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}
