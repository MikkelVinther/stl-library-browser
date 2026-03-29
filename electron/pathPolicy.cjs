const fs = require('fs');
const path = require('path');

/**
 * Filesystem path policy for defense-in-depth.
 *
 * Maintains a set of approved root directories. All IPC file operations
 * must validate paths against this set before proceeding.
 *
 * Design decisions:
 * - Approved roots are stored in canonical (realpath) form at registration time.
 * - Requested paths are resolved via fs.realpathSync at validation time (not cached),
 *   because symlink targets can change after a root is approved.
 * - Denied access fails closed (throws) and logs a policy denial reason.
 */

/** @type {Set<string>} Canonical paths of approved root directories */
const approvedRoots = new Set();

/**
 * Canonicalize a path and add it as an approved root.
 * @param {string} dirPath - Directory path to approve
 */
function addApprovedRoot(dirPath) {
  try {
    const canonical = fs.realpathSync(dirPath);
    approvedRoots.add(canonical);
  } catch (e) {
    // Directory may not exist yet (e.g. seeded from DB after deletion).
    // Store the normalized (but not canonicalized) path as a fallback.
    approvedRoots.add(path.resolve(dirPath));
  }
}

/**
 * Seed approved roots from an array of directory records (e.g. from DB).
 * @param {Array<{path: string}>} directories
 */
function seedFromDirectories(directories) {
  for (const dir of directories) {
    addApprovedRoot(dir.path);
  }
}

/**
 * Validate that a requested path falls within an approved root.
 * Resolves the requested path via fs.realpathSync to defeat symlink traversal.
 *
 * @param {string} requestedPath - Path from renderer
 * @param {{ requireExtension?: string }} [options] - Optional constraints
 * @returns {string} The canonical (validated) path
 * @throws {Error} If path is outside approved roots or fails extension check
 */
function validatePath(requestedPath, options = {}) {
  // Extension check (e.g. '.stl' for readFile)
  if (options.requireExtension) {
    const ext = path.extname(requestedPath).toLowerCase();
    if (ext !== options.requireExtension.toLowerCase()) {
      const msg = `[pathPolicy] DENIED: extension "${ext}" not allowed (required: ${options.requireExtension}) for "${requestedPath}"`;
      console.error(msg);
      throw new Error(msg);
    }
  }

  // Canonicalize the requested path to resolve symlinks and ../ traversal
  let canonical;
  try {
    canonical = fs.realpathSync(requestedPath);
  } catch (e) {
    const msg = `[pathPolicy] DENIED: cannot resolve path "${requestedPath}" — ${e.message}`;
    console.error(msg);
    throw new Error(msg);
  }

  // Check that canonical path is within at least one approved root
  for (const root of approvedRoots) {
    // Ensure exact directory boundary: root must end with separator,
    // or canonical must be exactly root, or canonical starts with root + separator
    if (canonical === root || canonical.startsWith(root + path.sep)) {
      return canonical;
    }
  }

  const msg = `[pathPolicy] DENIED: path "${canonical}" is not within any approved root`;
  console.error(msg);
  throw new Error(msg);
}

/**
 * Validate a directory path (for scanDirectory / countSTLFiles).
 * Same as validatePath but also allows the path to be an approved root itself.
 *
 * @param {string} requestedPath
 * @returns {string} The canonical (validated) path
 */
function validateDirectoryPath(requestedPath) {
  return validatePath(requestedPath);
}

/** Clear all approved roots (for testing). */
function _clearRoots() {
  approvedRoots.clear();
}

/** Get current approved roots (for testing/debugging). */
function _getRoots() {
  return new Set(approvedRoots);
}

module.exports = {
  addApprovedRoot,
  seedFromDirectories,
  validatePath,
  validateDirectoryPath,
  _clearRoots,
  _getRoots,
};
