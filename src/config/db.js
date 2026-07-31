// ============================================================================
//  SIGEXPC - Sélection automatique du moteur de base de données
//  Priorité :
//    1. PostgreSQL/Supabase si DATABASE_URL est défini (PRODUCTION)
//    2. MySQL si DB_USE_MYSQL=true
//    3. SQLite par défaut (DÉVELOPPEMENT LOCAL)
//  L'objet exporté expose l'interface commune : query, getConnection, end
// ============================================================================
require('dotenv').config();

// 1. PostgreSQL / Supabase (production sur Render)
if (process.env.DATABASE_URL) {
  module.exports = require('./db-supabase');
}
// 2. MySQL (si demandé explicitement)
else if (process.env.DB_USE_MYSQL === 'true') {
  try {
    const mysql = require('mysql2/promise');
    const pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'sigexpc',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: 'utf8mb4_unicode_ci',
      dateStrings: true
    });
    console.log('📦 Base de données : MySQL');
    module.exports = pool;
  } catch (e) {
    console.warn('⚠️  MySQL demandé mais indisponible, fallback SQLite :', e.message);
    module.exports = require('./db-sqlite');
  }
}
// 3. SQLite par défaut (développement local)
else {
  module.exports = require('./db-sqlite');
}
