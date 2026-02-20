const fs = require('fs');
const path = require('path');

/**
 * Recursively scan for .stl files, returning an array of
 * {relativePath, fullPath, sizeBytes, lastModified}
 */
exports.scanDirectory = async (rootPath) => {
  const results = [];

  async function walk(dir, rel) {
    let entries;
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch (e) {
      console.error(`[filesystem] Cannot read directory "${dir}":`, e.message);
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      try {
        if (entry.isFile() && entry.name.toLowerCase().endsWith('.stl')) {
          const stat = await fs.promises.stat(fullPath);
          results.push({
            relativePath: relPath,
            fullPath,
            sizeBytes: stat.size,
            lastModified: stat.mtimeMs,
          });
        } else if (entry.isDirectory()) {
          await walk(fullPath, relPath);
        }
      } catch (e) {
        console.error(`[filesystem] Skipping "${fullPath}":`, e.message);
      }
    }
  }

  try {
    await walk(rootPath, '');
  } catch (e) {
    console.error(`[filesystem] scanDirectory failed for "${rootPath}":`, e.message);
  }
  return results;
};

/**
 * Read a file as a Buffer (transferred to renderer as ArrayBuffer-like)
 */
exports.readFile = async (filePath) => {
  try {
    await fs.promises.access(filePath);
    return fs.promises.readFile(filePath);
  } catch (e) {
    console.error(`[filesystem] readFile failed for "${filePath}":`, e.message);
    return null;
  }
};

/**
 * Count .stl files in a directory tree without reading them
 */
exports.countSTLFiles = async (rootPath) => {
  let count = 0;

  async function walk(dir) {
    let entries;
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch (e) {
      console.error(`[filesystem] Cannot read directory "${dir}":`, e.message);
      return;
    }
    for (const entry of entries) {
      try {
        if (entry.isFile() && entry.name.toLowerCase().endsWith('.stl')) count++;
        else if (entry.isDirectory()) await walk(path.join(dir, entry.name));
      } catch (e) {
        console.error(`[filesystem] Skipping entry "${entry.name}":`, e.message);
      }
    }
  }

  try {
    await walk(rootPath);
  } catch (e) {
    console.error(`[filesystem] countSTLFiles failed for "${rootPath}":`, e.message);
  }
  return count;
};
