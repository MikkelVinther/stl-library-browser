const fs = require('fs');
const path = require('path');

/**
 * Recursively scan for .stl files, returning an array of
 * {relativePath, fullPath, sizeBytes, lastModified}
 */
exports.scanDirectory = (rootPath) => {
  const results = [];
  function walk(dir, rel) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isFile() && entry.name.toLowerCase().endsWith('.stl')) {
        const stat = fs.statSync(fullPath);
        results.push({
          relativePath: relPath,
          fullPath,
          sizeBytes: stat.size,
          lastModified: stat.mtimeMs,
        });
      } else if (entry.isDirectory()) {
        walk(fullPath, relPath);
      }
    }
  }
  walk(rootPath, '');
  return results;
};

/**
 * Read a file as a Buffer (transferred to renderer as ArrayBuffer-like)
 */
exports.readFile = (filePath) => {
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath);
};

/**
 * Count .stl files in a directory tree without reading them
 */
exports.countSTLFiles = (rootPath) => {
  let count = 0;
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.toLowerCase().endsWith('.stl')) count++;
      else if (entry.isDirectory()) walk(path.join(dir, entry.name));
    }
  }
  walk(rootPath);
  return count;
};
