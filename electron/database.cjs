const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

let database; // renamed from `db` to avoid shadowing in nested scopes
let dbPath;

// ── Schema versioning ──────────────────────────────────────────────────────────

const SCHEMA_VERSION = 2;

/**
 * Incremental migration list. Each entry moves the database from (version-1) to (version).
 * NEVER modify existing entries — only append new ones.
 *
 * Example future migration:
 *   { version: 3, up(db) { db.exec('ALTER TABLE files ADD COLUMN starred INTEGER DEFAULT 0'); } }
 */
const MIGRATIONS = [
  // Version 2 is the current baseline created by initSchema().
  // Future incremental migrations go here.
];

// ── Initialisation ─────────────────────────────────────────────────────────────

function getDB() {
  if (database) return database;
  dbPath = path.join(app.getPath('userData'), 'stl-library.db');
  database = new Database(dbPath);
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');
  migrateIfNeeded();
  return database;
}

function backupDB() {
  if (!dbPath || !fs.existsSync(dbPath)) return;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = dbPath.replace(/\.db$/, `-backup-${timestamp}.db`);
  try {
    fs.copyFileSync(dbPath, backupPath);
    console.log(`[database] Backed up database to: ${backupPath}`);
  } catch (e) {
    console.error('[database] Failed to create backup:', e);
  }
}

function migrateIfNeeded() {
  // Ensure version tracking table exists
  database.exec(`CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)`);
  const row = database.prepare('SELECT version FROM schema_version LIMIT 1').get();
  const current = row ? row.version : 0;

  if (current === 0) {
    // Brand-new database — create full schema directly
    initSchema();
    return;
  }

  if (current < 2) {
    // Pre-incremental-migration database (v1 or unknown legacy).
    // Back up and rebuild — one-time destructive path for old installs.
    console.warn(`[database] Legacy schema v${current} detected. Backing up and rebuilding.`);
    backupDB();
    database.exec(`
      DROP TABLE IF EXISTS tags;
      DROP TABLE IF EXISTS category_values;
      DROP TABLE IF EXISTS files;
      DROP TABLE IF EXISTS directories;
      DROP TABLE IF EXISTS schema_version;
    `);
    initSchema();
    return;
  }

  // Apply any pending incremental migrations (current < SCHEMA_VERSION)
  const pending = MIGRATIONS.filter((m) => m.version > current);
  if (pending.length === 0) return;

  backupDB();
  console.log(`[database] Applying ${pending.length} migration(s) (v${current} → v${SCHEMA_VERSION})`);

  const applyMigrations = database.transaction(() => {
    for (const migration of pending) {
      console.log(`[database] Running migration to v${migration.version}`);
      migration.up(database);
      database.prepare('UPDATE schema_version SET version = ?').run(migration.version);
    }
  });

  try {
    applyMigrations();
  } catch (e) {
    console.error('[database] Migration failed — database restored from backup on next launch:', e);
    throw e;
  }
}

function initSchema() {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL);
    INSERT INTO schema_version (version) VALUES (${SCHEMA_VERSION});

    CREATE TABLE IF NOT EXISTS directories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL UNIQUE,
      added_at INTEGER NOT NULL,
      last_scanned_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      directory_id TEXT REFERENCES directories(id) ON DELETE CASCADE,
      relative_path TEXT NOT NULL,
      name TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      full_path TEXT,
      size_bytes INTEGER NOT NULL,
      size_display TEXT NOT NULL,
      thumbnail TEXT,
      import_status TEXT NOT NULL DEFAULT 'confirmed',
      imported_at INTEGER NOT NULL,
      last_modified INTEGER,
      metadata_json TEXT,
      UNIQUE(directory_id, relative_path)
    );

    CREATE TABLE IF NOT EXISTS tags (
      file_id TEXT REFERENCES files(id) ON DELETE CASCADE,
      tag TEXT NOT NULL,
      PRIMARY KEY (file_id, tag)
    );

    CREATE TABLE IF NOT EXISTS category_values (
      file_id TEXT REFERENCES files(id) ON DELETE CASCADE,
      category_id TEXT NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (file_id, category_id)
    );

    CREATE INDEX IF NOT EXISTS idx_files_directory ON files(directory_id);
    CREATE INDEX IF NOT EXISTS idx_files_status ON files(import_status);
    CREATE INDEX IF NOT EXISTS idx_tags_tag ON tags(tag);
    CREATE INDEX IF NOT EXISTS idx_catval_category ON category_values(category_id);
    CREATE INDEX IF NOT EXISTS idx_catval_value ON category_values(category_id, value);
  `);
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function filesToEntries(rows) {
  if (rows.length === 0) return [];
  const db = getDB();

  // Batch-fetch tags and categories in 2 queries instead of 2×N
  const ids = rows.map((r) => r.id);
  const placeholders = ids.map(() => '?').join(',');

  const allTagRows = db.prepare(`SELECT file_id, tag FROM tags WHERE file_id IN (${placeholders})`).all(ids);
  const tagsByFileId = {};
  for (const { file_id, tag } of allTagRows) {
    if (!tagsByFileId[file_id]) tagsByFileId[file_id] = [];
    tagsByFileId[file_id].push(tag);
  }

  const allCatRows = db.prepare(`SELECT file_id, category_id, value FROM category_values WHERE file_id IN (${placeholders})`).all(ids);
  const catsByFileId = {};
  for (const { file_id, category_id, value } of allCatRows) {
    if (!catsByFileId[file_id]) catsByFileId[file_id] = {};
    catsByFileId[file_id][category_id] = value;
  }

  return rows.map((row) => {
    let metadata = null;
    if (row.metadata_json) {
      try { metadata = JSON.parse(row.metadata_json); }
      catch (e) { console.error(`[database] Failed to parse metadata_json for file ${row.id}:`, e); }
    }
    return {
      id: row.id,
      name: row.name,
      originalFilename: row.original_filename,
      relativePath: row.relative_path,
      fullPath: row.full_path,
      directoryId: row.directory_id,
      size: row.size_display,
      sizeBytes: row.size_bytes,
      thumbnail: row.thumbnail,
      tags: tagsByFileId[row.id] || [],
      categories: catsByFileId[row.id] || {},
      metadata,
      importedAt: row.imported_at,
      lastModified: row.last_modified,
    };
  });
}

/** Internal helper: replace all tags for a file in one transaction */
function saveFileTags(fileId, tags) {
  const db = getDB();
  const deleteStmt = db.prepare('DELETE FROM tags WHERE file_id = ?');
  const insertStmt = db.prepare('INSERT OR IGNORE INTO tags (file_id, tag) VALUES (?, ?)');
  deleteStmt.run(fileId);
  for (const tag of tags) insertStmt.run(fileId, tag);
}

/** Internal helper: replace all category values for a file */
function saveFileCategoryValues(fileId, categories) {
  const db = getDB();
  const deleteStmt = db.prepare('DELETE FROM category_values WHERE file_id = ?');
  const insertStmt = db.prepare('INSERT OR REPLACE INTO category_values (file_id, category_id, value) VALUES (?, ?, ?)');
  deleteStmt.run(fileId);
  for (const [catId, value] of Object.entries(categories)) {
    if (value != null && value !== '') insertStmt.run(fileId, catId, value);
  }
}

/**
 * Internal: write a file row with the given import_status.
 * Returns the effective DB id (may differ from data.id on re-import upsert).
 */
function saveFileWithStatus(data, status) {
  const db = getDB();
  const metadataJson = data.metadata ? JSON.stringify(data.metadata) : null;

  let effectiveId;

  if (status === 'pending') {
    // For pending writes: if a confirmed file with the same path already exists,
    // update geometry/metadata but preserve import_status = 'confirmed' so
    // re-scanning doesn't downgrade user-confirmed files back to pending.
    // RETURNING id gives us the canonical row id even when the upsert resolves a conflict.
    const row = db.prepare(`
      INSERT INTO files
        (id, directory_id, relative_path, name, original_filename, full_path,
         size_bytes, size_display, thumbnail, import_status, imported_at, last_modified, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(directory_id, relative_path) DO UPDATE SET
        name = excluded.name,
        original_filename = excluded.original_filename,
        full_path = excluded.full_path,
        size_bytes = excluded.size_bytes,
        size_display = excluded.size_display,
        thumbnail = excluded.thumbnail,
        last_modified = excluded.last_modified,
        metadata_json = excluded.metadata_json,
        import_status = CASE
          WHEN import_status = 'confirmed' THEN 'confirmed'
          ELSE excluded.import_status
        END
      RETURNING id
    `).get(
      data.id, data.directoryId || null, data.relativePath || '', data.name,
      data.metadata?.originalFilename || data.name, data.fullPath || null,
      data.sizeBytes || 0, data.size || '0 MB',
      data.thumbnail || null, status,
      data.metadata?.importedAt || Date.now(),
      data.lastModified || null, metadataJson
    );
    effectiveId = row.id;
  } else {
    // For confirmed/direct saves: full replace is acceptable
    db.prepare(`
      INSERT OR REPLACE INTO files
        (id, directory_id, relative_path, name, original_filename, full_path,
         size_bytes, size_display, thumbnail, import_status, imported_at, last_modified, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.id, data.directoryId || null, data.relativePath || '', data.name,
      data.metadata?.originalFilename || data.name, data.fullPath || null,
      data.sizeBytes || 0, data.size || '0 MB',
      data.thumbnail || null, status,
      data.metadata?.importedAt || Date.now(),
      data.lastModified || null, metadataJson
    );
    effectiveId = data.id;
  }

  // Use effectiveId for FK-linked tables so tags/categories reference the canonical row
  if (data.tags) saveFileTags(effectiveId, data.tags);
  if (data.categories) saveFileCategoryValues(effectiveId, data.categories);

  return effectiveId;
}

// ── CRUD exports ──────────────────────────────────────────────────────────────

exports.getAllFiles = () => {
  const db = getDB();
  const rows = db.prepare(
    "SELECT * FROM files WHERE import_status = 'confirmed' ORDER BY imported_at DESC"
  ).all();
  return filesToEntries(rows);
};

exports.saveFile = (data) => saveFileWithStatus(data, 'confirmed');

/** Writes a pending file and returns the canonical DB id for this row. */
exports.savePendingFile = (data) => saveFileWithStatus(data, 'pending');

exports.updateFile = (id, updates) => {
  const db = getDB();
  const row = db.prepare('SELECT * FROM files WHERE id = ?').get(id);
  if (!row) return;

  if (updates.tags) saveFileTags(id, updates.tags);
  if (updates.categories) saveFileCategoryValues(id, updates.categories);
  if (updates.metadata) {
    let existing = {};
    if (row.metadata_json) {
      try { existing = JSON.parse(row.metadata_json); }
      catch (e) { console.error(`[database] Failed to parse metadata_json for file ${id}:`, e); }
    }
    const merged = { ...existing, ...updates.metadata };
    db.prepare('UPDATE files SET metadata_json = ? WHERE id = ?').run(JSON.stringify(merged), id);
  }
};

exports.deleteFile = (id) => {
  const db = getDB();
  db.prepare('DELETE FROM files WHERE id = ?').run(id);
};

exports.confirmPendingFiles = (ids) => {
  const db = getDB();
  const stmt = db.prepare("UPDATE files SET import_status = 'confirmed' WHERE id = ?");
  db.transaction(() => { for (const id of ids) stmt.run(id); })();
};

/**
 * Delete pending files. When sessionIds is provided, only deletes rows whose id is in
 * that list — preventing accidental deletion of another concurrent import session's data.
 * Falls back to deleting all pending rows if no sessionIds are supplied.
 */
exports.cancelPendingFiles = (sessionIds) => {
  const db = getDB();
  if (sessionIds && sessionIds.length > 0) {
    const placeholders = sessionIds.map(() => '?').join(', ');
    db.prepare(
      `DELETE FROM files WHERE import_status = 'pending' AND id IN (${placeholders})`
    ).run(...sessionIds);
  } else {
    db.prepare("DELETE FROM files WHERE import_status = 'pending'").run();
  }
};

// ── Category-specific CRUD ────────────────────────────────────────────────────

exports.getCategoryValues = (fileId) => {
  const db = getDB();
  const rows = db.prepare('SELECT category_id, value FROM category_values WHERE file_id = ?').all(fileId);
  const result = {};
  for (const r of rows) result[r.category_id] = r.value;
  return result;
};

exports.setCategoryValues = (fileId, valuesObj) => {
  saveFileCategoryValues(fileId, valuesObj);
};

exports.bulkSetCategoryValue = (fileIds, categoryId, value) => {
  const db = getDB();
  const stmt = db.prepare('INSERT OR REPLACE INTO category_values (file_id, category_id, value) VALUES (?, ?, ?)');
  db.transaction(() => { for (const fileId of fileIds) stmt.run(fileId, categoryId, value); })();
};

exports.bulkSetCategoryValues = (entries) => {
  const db = getDB();
  const stmt = db.prepare('INSERT OR REPLACE INTO category_values (file_id, category_id, value) VALUES (?, ?, ?)');
  db.transaction(() => {
    for (const { fileId, categories } of entries) {
      for (const [catId, value] of Object.entries(categories)) {
        if (value != null && value !== '') stmt.run(fileId, catId, value);
      }
    }
  })();
};

// ── Directory CRUD ────────────────────────────────────────────────────────────

exports.getAllDirectories = () => {
  const db = getDB();
  const rows = db.prepare('SELECT * FROM directories ORDER BY added_at DESC').all();
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    path: r.path,
    addedAt: r.added_at,
    lastScannedAt: r.last_scanned_at,
  }));
};

exports.saveDirectory = (data) => {
  const db = getDB();
  // Use UPSERT: if path already exists, update name/timestamp but keep the original id (and all FK-linked files).
  db.prepare(`
    INSERT INTO directories (id, name, path, added_at, last_scanned_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(path) DO UPDATE SET
      name = excluded.name,
      last_scanned_at = excluded.last_scanned_at
  `).run(data.id, data.name, data.path, data.addedAt || Date.now(), data.lastScannedAt || null);

  // Return the canonical row (existing id on re-import, newly inserted id on first import)
  const row = db.prepare('SELECT * FROM directories WHERE path = ?').get(data.path);
  return {
    id: row.id,
    name: row.name,
    path: row.path,
    addedAt: row.added_at,
    lastScannedAt: row.last_scanned_at,
  };
};

exports.deleteDirectory = (id) => {
  const db = getDB();
  db.prepare('DELETE FROM directories WHERE id = ?').run(id);
};
