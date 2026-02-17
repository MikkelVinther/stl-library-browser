import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { renderThumbnail } from './renderThumbnail';
import { analyzeGeometry } from './geometryAnalysis';
import { parseSTLHeader } from './stlHeaderParser';
import { tokenizeFilename } from './filenameTokenizer';
import { estimateWeight, getPrintSettings } from './printEstimate';

/**
 * Streaming file processor. Accepts an AsyncIterable of {file, relativePath}
 * and processes files one at a time, yielding to the main thread between files.
 *
 * @param {AsyncIterable<{file: File, relativePath: string}>} source
 * @param {Object} callbacks
 * @param {function} callbacks.onFileProcessed - Called with processed entry after each file
 * @param {function} callbacks.onProgress - Called with {processed, total, currentName} after each file
 * @param {function} callbacks.onError - Called with (filename, error) on per-file failure
 * @param {function} [callbacks.shouldCancel] - Returns true to stop processing
 */
export async function processFiles(source, { onFileProcessed, onProgress, onError, shouldCancel }) {
  const loader = new STLLoader();
  let processed = 0;

  for await (const { file, relativePath } of source) {
    if (shouldCancel?.()) break;

    // Yield to main thread between files
    await new Promise((r) => setTimeout(r, 0));

    try {
      const buffer = await file.arrayBuffer();
      const geometry = loader.parse(buffer);
      geometry.computeVertexNormals();

      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      const thumbnail = renderThumbnail(geometry);
      const id = Date.now() + Math.random();

      const geoStats = analyzeGeometry(geometry);
      const headerText = parseSTLHeader(buffer);
      const suggestedTags = tokenizeFilename(file.name);
      const settings = getPrintSettings();
      const estimatedGrams = estimateWeight(geoStats.volume, settings);
      const volumeCm3 = geoStats.volume != null ? +(geoStats.volume / 1000).toFixed(2) : null;

      // Derive collection from top-level subfolder in relativePath
      const pathParts = relativePath.split('/');
      const collection = pathParts.length > 1 ? pathParts[0] : null;

      const entry = {
        id,
        name: file.name.replace(/\.stl$/i, '').replace(/[_-]/g, ' '),
        size: `${sizeMB} MB`,
        type: 'prop',
        tags: [],
        thumbnail,
        geometry,
        stlBuffer: buffer,
        metadata: {
          ...geoStats,
          headerText,
          originalFilename: file.name,
          suggestedTags,
          importedAt: Date.now(),
          lastModified: file.lastModified || null,
          collection,
          printEstimate: { volumeCm3, estimatedGrams },
        },
      };

      processed++;
      onFileProcessed(entry);
      onProgress({ processed, currentName: file.name });
    } catch (err) {
      processed++;
      onError(file.name, err);
      onProgress({ processed, currentName: file.name });
    }
  }
}
