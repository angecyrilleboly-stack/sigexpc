// ============================================================================
//  SIGEXPC - Sélection automatique du moteur de base de données
//  - Par défaut : SQLite (node:sqlite natif Node.js 24, AUCUNE installation)
//  - Si DB_USE_MYSQL=true dans .env ET mysql2 connectable : MySQL
//  L'objet exporté expose l'interface commune : query, getConnection, end
// ============================================================================
require('dotenv').config();

const useMysql = (process.env.DB_USE_MYSQL === 'true');

if (useMysql) {
  // Mode MySQL (nécessite un serveur MySQL installé et démarré)
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
} else {
  // Mode SQLite par défaut (aucune installation requise)
  console.log('📦 Base de données : SQLite (fichier data/sigexpc.db)');
  module.exports = require('./db-sqlite');
}
