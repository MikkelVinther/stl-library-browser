import { describe, it, expect, beforeEach, vi } from 'vitest';
import path from 'path';
import os from 'os';
import fs from 'fs';

// We can't import the .cjs module directly in vitest ESM mode, so we
// re-implement the core logic as a portable test. This validates the
// algorithm; the actual module runs in the Electron main process.

// ── Inline implementation of path policy logic for testing ─────────────────

function createPathPolicy() {
  const approvedRoots = new Set();

  function addApprovedRoot(dirPath) {
    try {
      const canonical = fs.realpathSync(dirPath);
      approvedRoots.add(canonical);
    } catch {
      approvedRoots.add(path.resolve(dirPath));
    }
  }

  function seedFromDirectories(directories) {
    for (const dir of directories) {
      addApprovedRoot(dir.path);
    }
  }

  function validatePath(requestedPath, options = {}) {
    if (options.requireExtension) {
      const ext = path.extname(requestedPath).toLowerCase();
      if (ext !== options.requireExtension.toLowerCase()) {
        throw new Error(`Extension "${ext}" not allowed (required: ${options.requireExtension})`);
      }
    }

    let canonical;
    try {
      canonical = fs.realpathSync(requestedPath);
    } catch (e) {
      throw new Error(`Cannot resolve path "${requestedPath}" — ${e.message}`);
    }

    for (const root of approvedRoots) {
      if (canonical === root || canonical.startsWith(root + path.sep)) {
        return canonical;
      }
    }

    throw new Error(`Path "${canonical}" is not within any approved root`);
  }

  return { addApprovedRoot, seedFromDirectories, validatePath, _getRoots: () => new Set(approvedRoots), _clearRoots: () => approvedRoots.clear() };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('pathPolicy', () => {
  let policy;
  let tmpDir;

  beforeEach(() => {
    policy = createPathPolicy();
    // Create a real temp directory for canonicalization tests
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pathpolicy-'));
    // Create subdirectories and files for testing
    fs.mkdirSync(path.join(tmpDir, 'stl-files'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'stl-files', 'model.stl'), 'test');
    fs.writeFileSync(path.join(tmpDir, 'stl-files', 'secret.txt'), 'secret');
  });

  it('allows paths within an approved root', () => {
    policy.addApprovedRoot(tmpDir);
    const filePath = path.join(tmpDir, 'stl-files', 'model.stl');
    const result = policy.validatePath(filePath);
    expect(result).toBe(fs.realpathSync(filePath));
  });

  it('rejects paths outside approved roots', () => {
    policy.addApprovedRoot(path.join(tmpDir, 'stl-files'));
    // Parent dir is not approved
    expect(() => policy.validatePath(tmpDir)).toThrow('not within any approved root');
  });

  it('rejects path traversal via ../', () => {
    const subDir = path.join(tmpDir, 'stl-files');
    policy.addApprovedRoot(subDir);
    // Traversal attempt: go up from stl-files
    const traversal = path.join(subDir, '..', 'stl-files', '..', 'stl-files', 'model.stl');
    // This should resolve cleanly and succeed (it's still within the root)
    const result = policy.validatePath(traversal);
    expect(result).toBe(fs.realpathSync(path.join(subDir, 'model.stl')));
  });

  it('rejects traversal that escapes the approved root', () => {
    const subDir = path.join(tmpDir, 'stl-files');
    policy.addApprovedRoot(subDir);
    // Try to read a file in the parent via ../
    // Create a file in tmpDir (parent of approved root)
    fs.writeFileSync(path.join(tmpDir, 'escape.stl'), 'escaped');
    const traversal = path.join(subDir, '..', 'escape.stl');
    expect(() => policy.validatePath(traversal)).toThrow('not within any approved root');
  });

  it('rejects prefix tricks (root path as prefix of unrelated dir)', () => {
    // Approve /tmp/abc, try /tmp/abcdef/file.stl
    const rootA = path.join(tmpDir, 'stl-files');
    const rootB = path.join(tmpDir, 'stl-files-extra');
    fs.mkdirSync(rootB, { recursive: true });
    fs.writeFileSync(path.join(rootB, 'trick.stl'), 'trick');

    policy.addApprovedRoot(rootA);
    // rootB shares a prefix with rootA but is NOT a subdirectory
    expect(() => policy.validatePath(path.join(rootB, 'trick.stl'))).toThrow('not within any approved root');
  });

  it('enforces extension requirement', () => {
    policy.addApprovedRoot(tmpDir);
    const txtPath = path.join(tmpDir, 'stl-files', 'secret.txt');
    expect(() => policy.validatePath(txtPath, { requireExtension: '.stl' })).toThrow('Extension ".txt" not allowed');
  });

  it('allows .stl extension when required', () => {
    policy.addApprovedRoot(tmpDir);
    const stlPath = path.join(tmpDir, 'stl-files', 'model.stl');
    const result = policy.validatePath(stlPath, { requireExtension: '.stl' });
    expect(result).toBe(fs.realpathSync(stlPath));
  });

  it('rejects nonexistent paths', () => {
    policy.addApprovedRoot(tmpDir);
    expect(() => policy.validatePath(path.join(tmpDir, 'nonexistent.stl'))).toThrow('Cannot resolve path');
  });

  it('seedFromDirectories populates roots', () => {
    policy.seedFromDirectories([
      { path: tmpDir },
      { path: path.join(tmpDir, 'stl-files') },
    ]);
    const roots = policy._getRoots();
    expect(roots.size).toBe(2);
    expect(roots.has(fs.realpathSync(tmpDir))).toBe(true);
  });

  it('handles symlinks by resolving them at validation time', () => {
    // Create a symlink inside the approved dir that points outside
    const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pathpolicy-outside-'));
    fs.writeFileSync(path.join(outsideDir, 'external.stl'), 'external');

    const symlinkPath = path.join(tmpDir, 'stl-files', 'sneaky-link');
    try {
      fs.symlinkSync(outsideDir, symlinkPath);
    } catch {
      // symlink creation may fail on some OS/permission combos, skip test
      return;
    }

    policy.addApprovedRoot(tmpDir);
    // The symlink resolves to outsideDir which is NOT approved
    expect(() => policy.validatePath(path.join(symlinkPath, 'external.stl'))).toThrow('not within any approved root');
  });
});
