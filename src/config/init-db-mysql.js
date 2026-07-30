// ============================================================================
//  SIGEXPC - Initialisation MySQL (alternative, nécessite un serveur MySQL)
//  Usage : DB_USE_MYSQL=true npm run init-db
// ============================================================================
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function initDatabase() {
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'sigexpc';

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  SIGEXPC - Initialisation MySQL');
  console.log(`  ${user}@${host}:${port}/${database}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  let conn;
  try {
    conn = await mysql.createConnection({ host, port, user, password, multipleStatements: true });
  } catch (err) {
    console.error('❌ Impossible de se connecter à MySQL :', err.message);
    process.exit(1);
  }
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  try {
    await conn.query(sql);
    console.log('✅ Base MySQL créée.');
  } catch (err) {
    console.error('❌ Erreur :', err.message);
    process.exit(1);
  } finally { await conn.end(); }
}
initDatabase();
