import { loadSTLLoader } from './loadSTLLoader';
import { renderThumbnail } from './renderThumbnail';
import { analyzeGeometry } from './geometryAnalysis';
import { parseSTLHeader } from './stlHeaderParser';
import { tokenizeFilename } from './filenameTokenizer';
import { estimateWeight, getPrintSettings } from './printEstimate';
import { readFile } from './electronBridge';
import { classifyFile } from './categoryClassifier';
import { toArrayBuffer } from './bufferUtils';
import type { STLFile, FileInfo } from '../types/index';

interface ProcessCallbacks {
  onFileProcessed: (entry: STLFile) => void;
  onProgress: (info: { processed: number; currentName: string }) => void;
  onError: (name: string, err: unknown) => void;
  shouldCancel?: () => boolean;
  directoryId?: string;
}

// Yield to the main thread every N files instead of every single file.
// Per-file setTimeout(0) adds ~4ms of timer overhead each; chunked yielding amortises this.
const YIELD_CHUNK = 5;

/**
 * Process an array of file info objects from the main-process directory scan.
 * Reads each file via IPC, generates thumbnail + metadata, then disposes geometry.
 * No binary data or geometry is kept in the returned entries.
 */
export async function processFiles(fileInfos: FileInfo[], {
  onFileProcessed, onProgress, onError, shouldCancel, directoryId,
}: ProcessCallbacks): Promise<void> {
  const { STLLoader } = await loadSTLLoader();
  const loader = new STLLoader();
  let processed = 0;

  // Hoist settings read out of the per-file loop (avoids repeated localStorage access)
  const settings = getPrintSettings();

  for (const fileInfo of fileInfos) {
    if (shouldCancel?.()) break;

    // Yield to main thread every YIELD_CHUNK files to keep the UI responsive
    if (processed % YIELD_CHUNK === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }

    const fileName = fileInfo.relativePath.split('/').pop() ?? fileInfo.relativePath;

    try {
      let arrayBuffer: ArrayBuffer;
      if (fileInfo.fullPath) {
        const buffer = await readFile(fileInfo.fullPath);
        if (!buffer) throw new Error('File not found');
        arrayBuffer = toArrayBuffer(buffer);
      } else if (fileInfo._browserFile) {
        arrayBuffer = await fileInfo._browserFile.arrayBuffer();
      } else {
        throw new Error('No file path or browser file available');
      }
      const geometry = loader.parse(arrayBuffer);
      // computeVertexNormals is not needed here:
      // - analyzeGeometry uses only position/index/boundingBox
      // - prepareScene (inside renderThumbnail) calls it on a clone

      const thumbnail = renderThumbnail(geometry);
      const geoStats = analyzeGeometry(geometry);
      const headerText = parseSTLHeader(arrayBuffer);
      const suggestedTags = tokenizeFilename(fileName);

      geometry.dispose(); // Free immediately — only needed for thumbnail + analysis

      const estimatedGrams = estimateWeight(geoStats.volume, settings);
      const volumeCm3 = geoStats.volume != null ? +(geoStats.volume / 1000).toFixed(2) : null;

      // Auto-classify into structured categories
      const categories = classifyFile({
        relativePath: fileInfo.relativePath,
        filename: fileName,
        tokens: suggestedTags,
        geometry: geoStats,
      });

      const entry: STLFile = {
        id: crypto.randomUUID(),
        name: fileName.replace(/\.stl$/i, '').replace(/[_-]/g, ' '),
        relativePath: fileInfo.relativePath,
        fullPath: fileInfo.fullPath,
        directoryId,
        size: `${(fileInfo.sizeBytes / (1024 * 1024)).toFixed(1)} MB`,
        sizeBytes: fileInfo.sizeBytes,
        tags: [],
        categories,
        thumbnail,
        metadata: {
          ...geoStats,
          headerText,
          originalFilename: fileName,
          suggestedTags,
          importedAt: Date.now(),
          lastModified: fileInfo.lastModified,
          fileSize: fileInfo.sizeBytes,
          printEstimate: { volumeCm3, estimatedGrams },
        },
      };

      processed++;
      onFileProcessed(entry);
      onProgress({ processed, currentName: entry.name });
    } catch (err) {
      processed++;
      onError(fileName, err);
      onProgress({ processed, currentName: fileName });
    }
  }
}
