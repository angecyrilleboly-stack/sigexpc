// ============================================================================
//  SIGEXPC - Couche d'abstraction base de données (SQLite via node:sqlite)
//  Expose la MEME interface que mysql2/promise (.query, .getConnection, etc.)
//  afin que tous les fichiers de routes fonctionnent SANS MODIFICATION.
// ============================================================================
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

// Emplacement du fichier de base SQLite
const DB_FILE = path.join(__dirname, '..', '..', 'data', 'sigexpc.db');
fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });

const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// ----------------------------------------------------------------------------
// Convertit les paramètres ? de mysql2 vers les paramètres nommés de node:sqlite
// node:sqlite supporte aussi "?" mais plus fiable via position. On garde "?".
// ----------------------------------------------------------------------------

// Petit helper : échappe la valeur pour l'affichage debug
function dbg(sql, params) { return `[SQL] ${sql.split(/\s+/).slice(0, 4).join(' ')}... (${(params||[]).length} params)`; }

// ----------------------------------------------------------------------------
// Wrapper query : simulate mysql2/promise interface
//   const [rows] = await pool.query(sql, params)
// Retourne toujours [rows, []]
// ----------------------------------------------------------------------------
async function query(sql, params = []) {
  // Normaliser params : mysql2 accepte un tableau simple
  if (params && !Array.isArray(params) && typeof params === 'object') {
    params = Object.values(params);
  }

  const stmt = db.prepare(sql);
  const trimmed = sql.trim().toUpperCase();

  if (trimmed.startsWith('SELECT') || trimmed.startsWith('PRAGMA') || trimmed.startsWith('WITH') || trimmed.startsWith('SHOW')) {
    const rows = stmt.all(...params);
    return [rows, []];
  } else {
    const info = stmt.run(...params);
    // Pour INSERT ... RETURNING ou si l'app attend des rows
    return [info, []];
  }
}

// ----------------------------------------------------------------------------
// getConnection : simulate pool.getConnection() pour les transactions
//   const conn = await pool.getConnection();
//   await conn.beginTransaction();
//   await conn.query(...);
//   await conn.commit();  // ou rollback()
//   conn.release();
// ----------------------------------------------------------------------------
function getConnection() {
  return Promise.resolve({
    async query(sql, params = []) {
      if (params && !Array.isArray(params) && typeof params === 'object') params = Object.values(params);
      const stmt = db.prepare(sql);
      const trimmed = sql.trim().toUpperCase();
      if (trimmed.startsWith('SELECT')) return [stmt.all(...params), []];
      return [stmt.run(...params), []];
    },
    async beginTransaction() {
      db.exec('BEGIN');
      return Promise.resolve();
    },
    async commit() {
      db.exec('COMMIT');
      return Promise.resolve();
    },
    async rollback() {
      try { db.exec('ROLLBACK'); } catch (e) {}
      return Promise.resolve();
    },
    release() { /* no-op pour SQLite : pas de pool de connexions */ }
  });
}

// ----------------------------------------------------------------------------
// end : ferme la base
// ----------------------------------------------------------------------------
function end() {
  try { db.close(); } catch (e) {}
  return Promise.resolve();
}

module.exports = { query, getConnection, end, _db: db };
