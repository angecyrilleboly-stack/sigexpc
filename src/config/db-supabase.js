// ============================================================================
//  SIGEXPC - Couche d'abstraction base de données PostgreSQL (Supabase)
//  Expose la MEME interface que mysql2/promise (.query, .getConnection, etc.)
//  afin que tous les fichiers de routes fonctionnent SANS MODIFICATION.
//
//  Utilisation : DATABASE_URL=postgresql://user:pass@host:5432/db
// ============================================================================
const { Pool } = require('pg');

// Construire la config depuis DATABASE_URL ou variables séparées
// Priorité aux variables séparées si DB_HOST est défini (évite les problèmes d'encodage @)
let poolConfig;
if (process.env.DB_HOST && process.env.DB_HOST.includes('supabase')) {
  // Variables séparées (recommandé pour les mots de passe avec caractères spéciaux)
  poolConfig = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'postgres',
    ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  };
} else if (process.env.DATABASE_URL) {
  try {
    const url = new URL(process.env.DATABASE_URL);
    poolConfig = {
      host: url.hostname,
      port: parseInt(url.port) || 5432,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace('/', ''),
      ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };
  } catch (e) {
    poolConfig = {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };
  }
} else {
  // Variables séparées (fallback)
  poolConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sigexpc',
    ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  };
}

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('❌ Erreur pool PostgreSQL:', err.message);
});

console.log('📦 Base de données : PostgreSQL (Supabase)');

// ----------------------------------------------------------------------------
// Traduction automatique des fonctions SQLite/MySQL vers PostgreSQL
// Le code existant utilise datetime('now','localtime'), INSERT OR REPLACE, etc.
// On convertit tout transparentment pour ne pas modifier les routes.
// ----------------------------------------------------------------------------
function translateSQL(sql) {
  let s = sql;
  // datetime('now','localtime') → CURRENT_TIMESTAMP
  s = s.replace(/datetime\s*\(\s*'now'\s*,\s*'localtime'\s*\)/gi, "CURRENT_TIMESTAMP");
  // datetime('now','localtime','+N days') → CURRENT_TIMESTAMP + INTERVAL 'N days'
  s = s.replace(/datetime\s*\(\s*'now'\s*,\s*'localtime'\s*,\s*'\+(\d+)\s*days'\s*\)/gi, "CURRENT_TIMESTAMP + INTERVAL '$1 days'");
  s = s.replace(/datetime\s*\(\s*'now'\s*,\s*'\+(\d+)\s*days'\s*\)/gi, "CURRENT_TIMESTAMP + INTERVAL '$1 days'");
  // NOW() → CURRENT_TIMESTAMP
  s = s.replace(/\bNOW\s*\(\s*\)/gi, "CURRENT_TIMESTAMP");
  // DATE_ADD(NOW(), INTERVAL N DAY) → CURRENT_TIMESTAMP + INTERVAL 'N days'
  s = s.replace(/DATE_ADD\s*\(\s*NOW\s*\(\s*\)\s*,\s*INTERVAL\s+(\d+)\s+DAY\s*\)/gi, "CURRENT_TIMESTAMP + INTERVAL '$1 days'");
  // CURDATE() → CURRENT_DATE
  s = s.replace(/\bCURDATE\s*\(\s*\)/gi, "CURRENT_DATE");
  // INSERT OR REPLACE INTO ... VALUES → INSERT INTO ... ON CONFLICT DO UPDATE
  // (cas simple : on le gère au cas par cas dans les routes, ici on gère le schéma)
  return s;
}

// ----------------------------------------------------------------------------
// Conversion automatique des ? en $1, $2, ... pour PostgreSQL
// ----------------------------------------------------------------------------
function convertParams(sql) {
  let idx = 0;
  // Remplacer chaque ? par $n (en respectant les chaînes littérales)
  let result = '';
  let inString = false;
  let stringChar = '';
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if ((c === "'" || c === '"') && (i === 0 || sql[i - 1] !== '\\')) {
      if (!inString) { inString = true; stringChar = c; }
      else if (c === stringChar) { inString = false; }
    }
    if (c === '?' && !inString) {
      idx++;
      result += '$' + idx;
    } else {
      result += c;
    }
  }
  return result;
}

// Wrapper pour exposer la même interface que mysql2
// mysql2 : const [rows] = await pool.query(sql, params)
// pg      : const { rows } = await pool.query(sql, params)
// On convertit pour retourner [rows] au lieu de { rows }
// ----------------------------------------------------------------------------
const dbWrapper = {
  async query(sql, params) {
    try {
      const pgSql = convertParams(translateSQL(sql));
      const result = await pool.query(pgSql, params || []);
      return [result.rows, result.fields || []];
    } catch (err) {
      console.error('SQL Error:', err.message);
      console.error('Query:', sql.substring(0, 100));
      throw err;
    }
  },

  async getConnection() {
    const client = await pool.connect();
    const wrappedClient = {
      async query(sql, params) {
        try {
          const pgSql = convertParams(translateSQL(sql));
          const result = await client.query(pgSql, params || []);
          return [result.rows, result.fields || []];
        } catch (err) {
          console.error('SQL Error:', err.message);
          throw err;
        }
      },
      release() { client.release(); },
      beginTransaction() { return client.query('BEGIN'); },
      commit() { return client.query('COMMIT'); },
      rollback() { return client.query('ROLLBACK'); }
    };
    return wrappedClient;
  },

  end() { return pool.end(); },
  _pool: pool
};

module.exports = dbWrapper;
