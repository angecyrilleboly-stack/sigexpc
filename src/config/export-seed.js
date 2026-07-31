// ============================================================================
//  SIGEXPC - Export des données locales vers un fichier SQL d'insertion
//  Ce fichier sera committé sur GitHub et importé automatiquement sur Render.
//  Usage : node src/config/export-seed.js
// ============================================================================
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DB_FILE = path.join(__dirname, '..', '..', 'data', 'sigexpc.db');
const OUT_FILE = path.join(__dirname, 'seed-data.sql');

if (!fs.existsSync(DB_FILE)) {
  console.error('❌ Base locale introuvable:', DB_FILE);
  process.exit(1);
}

const db = new DatabaseSync(DB_FILE);

// Tables à exporter (dans l'ordre des dépendances)
const TABLES = [
  'super_admins',
  'directions_regionales',
  'auto_ecoles',
  'auto_ecoles_staff',
  'agents_verificateurs',
  'sttc_users',
  'candidats',
  'centres_examen',
  'examens_programmes',
  'inscriptions_examens',
  'parametres_abonnement',
  'abonnements_auto_ecoles',
  'recus_paiement',
  'parametres_region'
];

let sql = '-- SIGEXPC - Données exportées (généré automatiquement)\n';
sql += '-- Date: ' + new Date().toISOString() + '\n\n';

let totalRows = 0;

for (const table of TABLES) {
  try {
    const rows = db.prepare(`SELECT * FROM ${table}`).all();
    if (rows.length === 0) continue;

    totalRows += rows.length;
    sql += `\n-- ${table} (${rows.length} lignes)\n`;

    // Récupérer les noms de colonnes
    const cols = Object.keys(rows[0]);

    for (const row of rows) {
      const values = cols.map(c => {
        const v = row[c];
        if (v === null || v === undefined) return 'NULL';
        // Échapper les quotes
        const s = String(v).replace(/'/g, "''");
        return `'${s}'`;
      });
      sql += `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${values.join(', ')});\n`;
    }
  } catch (e) {
    console.error(`⚠️ Erreur table ${table}:`, e.message);
  }
}

db.close();

fs.writeFileSync(OUT_FILE, sql, 'utf8');
console.log(`✅ Export terminé: ${totalRows} lignes -> ${OUT_FILE}`);
console.log(`   Taille: ${(fs.statSync(OUT_FILE).size / 1024).toFixed(0)} KB`);
