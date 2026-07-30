// ============================================================================
//  SIGEXPC - Script d'initialisation de la base de données
//  Détecte automatiquement SQLite (par défaut) ou MySQL (si DB_USE_MYSQL=true)
//  Usage : npm run init-db
// ============================================================================
require('dotenv').config();

const useMysql = (process.env.DB_USE_MYSQL === 'true');

if (useMysql) {
  require('./init-db-mysql.js');
} else {
  require('./init-db-sqlite.js');
}
