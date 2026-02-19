import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { renderThumbnail } from './renderThumbnail';
import { analyzeGeometry } from './geometryAnalysis';
import { parseSTLHeader } from './stlHeaderParser';
import { tokenizeFilename } from './filenameTokenizer';
import { estimateWeight, getPrintSettings } from './printEstimate';
import { readFile } from './electronBridge';

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
      const buffer = await readFile(fileInfo.fullPath);
      if (!buffer) throw new Error('File not found');

      // buffer from IPC is a Uint8Array — get its underlying ArrayBuffer for STLLoader
      const arrayBuffer = buffer.buffer || buffer;
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

      const pathParts = fileInfo.relativePath.split('/');
      const collection = pathParts.length > 1 ? pathParts[0] : null;

      const entry = {
        id: crypto.randomUUID(),
        name: fileName.replace(/\.stl$/i, '').replace(/[_-]/g, ' '),
        relativePath: fileInfo.relativePath,
        fullPath: fileInfo.fullPath,
        directoryId,
        size: `${(fileInfo.sizeBytes / (1024 * 1024)).toFixed(1)} MB`,
        sizeBytes: fileInfo.sizeBytes,
        type: 'prop',
        tags: [],
        thumbnail,
        metadata: {
          ...geoStats,
          headerText,
          originalFilename: fileName,
          suggestedTags,
          importedAt: Date.now(),
          lastModified: fileInfo.lastModified,
          fileSize: fileInfo.sizeBytes,
          collection,
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
