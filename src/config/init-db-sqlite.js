// ============================================================================
//  SIGEXPC - Initialisation de la base SQLite (sans serveur)
//  Lit schema-sqlite.sql et crée toutes les tables.
//  Usage : npm run init-db
// ============================================================================
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DB_FILE = path.join(__dirname, '..', '..', 'data', 'sigexpc.db');
fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  SIGEXPC - Initialisation de la base SQLite');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`  Fichier : ${DB_FILE}\n`);

const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA foreign_keys = ON;');

const schemaPath = path.join(__dirname, 'schema-sqlite.sql');
const sql = fs.readFileSync(schemaPath, 'utf8');

try {
  // Exécuter chaque instruction séparément (SQLite exec gère les multiples)
  db.exec(sql);
  console.log('✅ Tables créées avec succès.');

  // Lister les tables
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
  console.log(`\n   ${tables.length} tables :`);
  tables.forEach(t => console.log(`     • ${t.name}`));
} catch (err) {
  console.error('❌ Erreur lors de la création du schéma :', err.message);
  process.exit(1);
} finally {
  db.close();
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  Base prête. Pour migrer vos données Excel :');
console.log('  npm run migrate "votre_fichier.xlsx"');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
