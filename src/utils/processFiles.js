import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { renderThumbnail } from './renderThumbnail';
import { analyzeGeometry } from './geometryAnalysis';
import { parseSTLHeader } from './stlHeaderParser';
import { tokenizeFilename } from './filenameTokenizer';
import { estimateWeight, getPrintSettings } from './printEstimate';
import { readFile } from './electronBridge';
import { classifyFile } from './categoryClassifier';

/**
 * Process an array of file info objects from the main-process directory scan.
 * Reads each file via IPC, generates thumbnail + metadata, then disposes geometry.
 * No binary data or geometry is kept in the returned entries.
 *
 * @param {Array<{fullPath: string, relativePath: string, sizeBytes: number, lastModified: number}>} fileInfos
 * @param {Object} callbacks
 * @param {function} callbacks.onFileProcessed - Called with processed entry after each file
 * @param {function} callbacks.onProgress - Called with {processed, currentName} after each file
 * @param {function} callbacks.onError - Called with (filename, error) on per-file failure
 * @param {function} [callbacks.shouldCancel] - Returns true to stop processing
 * @param {string} [callbacks.directoryId] - The directory ID these files belong to
 */
export async function processFiles(fileInfos, { onFileProcessed, onProgress, onError, shouldCancel, directoryId }) {
  const loader = new STLLoader();
  let processed = 0;

  for (const fileInfo of fileInfos) {
    if (shouldCancel?.()) break;

    // Yield to main thread between files
    await new Promise((r) => setTimeout(r, 0));

    const fileName = fileInfo.relativePath.split('/').pop();

    try {
      let arrayBuffer;
      if (fileInfo.fullPath) {
        const buffer = await readFile(fileInfo.fullPath);
        if (!buffer) throw new Error('File not found');
        arrayBuffer = buffer.buffer || buffer;
      } else if (fileInfo._browserFile) {
        arrayBuffer = await fileInfo._browserFile.arrayBuffer();
      } else {
        throw new Error('No file path or browser file available');
      }
      const geometry = loader.parse(arrayBuffer);
      geometry.computeVertexNormals();

      const thumbnail = renderThumbnail(geometry);
      const geoStats = analyzeGeometry(geometry);
      const headerText = parseSTLHeader(arrayBuffer);
      const suggestedTags = tokenizeFilename(fileName);

      geometry.dispose(); // Free immediately — only needed for thumbnail + analysis

      const settings = getPrintSettings();
      const estimatedGrams = estimateWeight(geoStats.volume, settings);
      const volumeCm3 = geoStats.volume != null ? +(geoStats.volume / 1000).toFixed(2) : null;

      // Auto-classify into structured categories
      const categories = classifyFile({
        relativePath: fileInfo.relativePath,
        filename: fileName,
        tokens: suggestedTags,
        geometry: geoStats,
      });

      const entry = {
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
