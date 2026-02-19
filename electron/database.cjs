const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

let db;

const SCHEMA_VERSION = 2; // Bump this to clear and rebuild the database

function getDB() {
  if (db) return db;
  const dbPath = path.join(app.getPath('userData'), 'stl-library.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrateIfNeeded();
  return db;
}

function migrateIfNeeded() {
  // Create version tracking table
  db.exec(`CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)`);
  const row = db.prepare('SELECT version FROM schema_version LIMIT 1').get();
  const current = row ? row.version : 0;

  if (current < SCHEMA_VERSION) {
    // Drop everything and rebuild — fresh start
    db.exec(`
      DROP TABLE IF EXISTS tags;
      DROP TABLE IF EXISTS category_values;
      DROP TABLE IF EXISTS files;
      DROP TABLE IF EXISTS directories;
      DROP TABLE IF EXISTS schema_version;
    `);
    initSchema();
  }
}

function initSchema() {
  db.exec(`
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

// ── Helpers ──

function filesToEntries(rows) {
  const db = getDB();
  const getTagsStmt = db.prepare('SELECT tag FROM tags WHERE file_id = ?');
  const getCatsStmt = db.prepare('SELECT category_id, value FROM category_values WHERE file_id = ?');
  return rows.map((row) => {
    const tags = getTagsStmt.all(row.id).map((t) => t.tag);
    const catRows = getCatsStmt.all(row.id);
    const categories = {};
    for (const r of catRows) categories[r.category_id] = r.value;
    const metadata = row.metadata_json ? JSON.parse(row.metadata_json) : null;
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
      tags,
      categories,
      metadata,
      importedAt: row.imported_at,
      lastModified: row.last_modified,
    };
  });
}

function saveTags(fileId, tags) {
  const db = getDB();
  const deleteStmt = db.prepare('DELETE FROM tags WHERE file_id = ?');
  const insertStmt = db.prepare('INSERT OR IGNORE INTO tags (file_id, tag) VALUES (?, ?)');
  deleteStmt.run(fileId);
  for (const tag of tags) {
    insertStmt.run(fileId, tag);
  }
}

function saveCategoryValues(fileId, categories) {
  const db = getDB();
  const deleteStmt = db.prepare('DELETE FROM category_values WHERE file_id = ?');
  const insertStmt = db.prepare('INSERT OR REPLACE INTO category_values (file_id, category_id, value) VALUES (?, ?, ?)');
  deleteStmt.run(fileId);
  for (const [catId, value] of Object.entries(categories)) {
    if (value != null && value !== '') {
      insertStmt.run(fileId, catId, value);
    }
  }
}

// ── CRUD exports ──

exports.getAllFiles = () => {
  const db = getDB();
  const rows = db.prepare(
    "SELECT * FROM files WHERE import_status = 'confirmed' ORDER BY imported_at DESC"
  ).all();
  return filesToEntries(rows);
};

exports.saveFile = (data) => {
  const db = getDB();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO files
      (id, directory_id, relative_path, name, original_filename, full_path,
       size_bytes, size_display, thumbnail, import_status, imported_at, last_modified, metadata_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, ?)
  `);
  const metadataJson = data.metadata ? JSON.stringify(data.metadata) : null;
  stmt.run(
    data.id, data.directoryId || null, data.relativePath || '', data.name,
    data.metadata?.originalFilename || data.name, data.fullPath || null,
    data.sizeBytes || 0, data.size || '0 MB',
    data.thumbnail || null, data.metadata?.importedAt || Date.now(),
    data.lastModified || null, metadataJson
  );
  if (data.tags) saveTags(data.id, data.tags);
  if (data.categories) saveCategoryValues(data.id, data.categories);
};

exports.updateFile = (id, updates) => {
  const db = getDB();
  const row = db.prepare('SELECT * FROM files WHERE id = ?').get(id);
  if (!row) return;

  if (updates.tags) {
    saveTags(id, updates.tags);
  }
  if (updates.categories) {
    saveCategoryValues(id, updates.categories);
  }
  if (updates.metadata) {
    const existing = row.metadata_json ? JSON.parse(row.metadata_json) : {};
    const merged = { ...existing, ...updates.metadata };
    db.prepare('UPDATE files SET metadata_json = ? WHERE id = ?').run(JSON.stringify(merged), id);
  }
};

exports.deleteFile = (id) => {
  const db = getDB();
  db.prepare('DELETE FROM files WHERE id = ?').run(id);
};

exports.savePendingFile = (data) => {
  const db = getDB();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO files
      (id, directory_id, relative_path, name, original_filename, full_path,
       size_bytes, size_display, thumbnail, import_status, imported_at, last_modified, metadata_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
  `);
  const metadataJson = data.metadata ? JSON.stringify(data.metadata) : null;
  stmt.run(
    data.id, data.directoryId || null, data.relativePath || '', data.name,
    data.metadata?.originalFilename || data.name, data.fullPath || null,
    data.sizeBytes || 0, data.size || '0 MB',
    data.thumbnail || null, data.metadata?.importedAt || Date.now(),
    data.lastModified || null, metadataJson
  );
  if (data.tags) saveTags(data.id, data.tags);
  if (data.categories) saveCategoryValues(data.id, data.categories);
};

exports.confirmPendingFiles = (ids) => {
  const db = getDB();
  const stmt = db.prepare("UPDATE files SET import_status = 'confirmed' WHERE id = ?");
  const txn = db.transaction(() => {
    for (const id of ids) stmt.run(id);
  });
  txn();
};

exports.cancelPendingFiles = () => {
  const db = getDB();
  db.prepare("DELETE FROM files WHERE import_status = 'pending'").run();
};

// ── Category-specific CRUD ──

exports.getCategoryValues = (fileId) => {
  const db = getDB();
  const rows = db.prepare('SELECT category_id, value FROM category_values WHERE file_id = ?').all(fileId);
  const result = {};
  for (const r of rows) result[r.category_id] = r.value;
  return result;
};

exports.setCategoryValues = (fileId, valuesObj) => {
  saveCategoryValues(fileId, valuesObj);
};

exports.bulkSetCategoryValue = (fileIds, categoryId, value) => {
  const db = getDB();
  const stmt = db.prepare('INSERT OR REPLACE INTO category_values (file_id, category_id, value) VALUES (?, ?, ?)');
  const txn = db.transaction(() => {
    for (const fileId of fileIds) {
      stmt.run(fileId, categoryId, value);
    }
  });
  txn();
};

exports.bulkSetCategoryValues = (entries) => {
  const db = getDB();
  const stmt = db.prepare('INSERT OR REPLACE INTO category_values (file_id, category_id, value) VALUES (?, ?, ?)');
  const txn = db.transaction(() => {
    for (const { fileId, categories } of entries) {
      for (const [catId, value] of Object.entries(categories)) {
        if (value != null && value !== '') {
          stmt.run(fileId, catId, value);
        }
      }
    }
  });
  txn();
};

// ── Directory CRUD ──

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
  db.prepare(`
    INSERT OR REPLACE INTO directories (id, name, path, added_at, last_scanned_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(data.id, data.name, data.path, data.addedAt || Date.now(), data.lastScannedAt || null);
};

exports.deleteDirectory = (id) => {
  const db = getDB();
  db.prepare('DELETE FROM directories WHERE id = ?').run(id);
};
