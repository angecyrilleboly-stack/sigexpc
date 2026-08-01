// ============================================================================
//  SIGEXPC - Initialisation de la base SQLite pour Render
//  Lancé automatiquement au démarrage du serveur (require depuis server.js)
//  - Crée toutes les tables (si elles n'existent pas)
//  - Insère un super admin par défaut (configurable via variables d'env)
//  - Insère les paramètres d'abonnement par défaut
// ============================================================================
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

// IMPORTANT : Utiliser le MÊME module db-sqlite.js que le serveur
// pour éviter les conflits de verrous (deux connexions sur le même fichier).
const { DatabaseSync } = require('node:sqlite');

const DB_FILE = path.join(__dirname, '..', '..', 'data', 'sigexpc.db');
fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  SIGEXPC - Vérification base SQLite');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// 1. Créer les tables depuis le schéma (si elles n'existent pas)
try {
  const schemaPath = path.join(__dirname, 'schema-sqlite.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(sql);
  console.log('✅ Tables vérifiées/créées.');
} catch (err) {
  console.error('❌ Erreur schéma:', err.message);
}

// 2. Vérifier s'il y a déjà des données (compter candidats = grosse table)
let existingData;
try {
  existingData = db.prepare('SELECT COUNT(*) as cnt FROM candidats').get();
} catch (e) {
  existingData = { cnt: 0 };
}

if (existingData && Number(existingData.cnt) > 0) {
  console.log(`ℹ️  La base contient déjà ${existingData.cnt} candidats. OK.`);
} else {
  // 3. Importer les vraies données depuis seed-data.sql si disponible
  const seedFile = path.join(__dirname, 'seed-data.sql');
  if (fs.existsSync(seedFile)) {
    console.log('📥 Import des données réelles depuis seed-data.sql...');
    try {
      const seedSql = fs.readFileSync(seedFile, 'utf8');
      db.exec('PRAGMA foreign_keys = OFF;');
      db.exec('PRAGMA synchronous = OFF;'); // Vitesse maximale pour l'import
      db.exec('BEGIN TRANSACTION;');
      // Importer instruction par instruction (ignorer les doublons UNIQUE)
      const statements = seedSql.split('\n').filter(l => l.trim().startsWith('INSERT INTO'));
      let imported = 0, skipped = 0;
      for (const stmt of statements) {
        try {
          db.exec(stmt);
          imported++;
        } catch (e) {
          skipped++; // doublon ou contrainte, on ignore
        }
      }
      db.exec('COMMIT;');
      db.exec('PRAGMA foreign_keys = ON;');
      const cnt = db.prepare('SELECT COUNT(*) as cnt FROM candidats').get();
      console.log(`✅ ${imported} importés, ${skipped} ignorés. ${cnt.cnt} candidats.`);
    } catch (e) {
      console.error('⚠️ Erreur import seed:', e.message);
      try { db.exec('ROLLBACK;'); } catch(_) {}
      creerDonneesDefaut(db);
    }
  } else {
    console.log('ℹ️  Pas de seed-data.sql. Création de données par défaut...');
    creerDonneesDefaut(db);
  }
}

// Fonction : créer un super admin + données minimales par défaut
function creerDonneesDefaut(db) {
  // 3. Créer un super admin par défaut
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@sigexpc.ci';
  const adminPass = process.env.ADMIN_PASSWORD || 'ADMIN123';
  const adminName = process.env.ADMIN_NAME || 'Administrateur SIGEXPC';
  const adminId = 'SA-' + Math.floor(Math.random() * 9000 + 1000);

  try {
    const hashedPass = bcrypt.hashSync(adminPass, 10);
    db.prepare('INSERT INTO super_admins (id, nom, email, code_acces) VALUES (?, ?, ?, ?)')
      .run(adminId, adminName, adminEmail, hashedPass);
    console.log(`✅ Super admin créé : ${adminEmail}`);
  } catch (e) {
    console.error('⚠️ Erreur création super admin:', e.message);
  }

  // 4. Créer les paramètres d'abonnement par défaut
  try {
    db.prepare('INSERT OR IGNORE INTO parametres_abonnement (montant, duree_jours) VALUES (?, ?)')
      .run(300, 30);
    console.log('✅ Paramètres d\'abonnement créés (300 FCFA / 30 jours).');
  } catch (e) {
    console.error('⚠️ Erreur paramètres abonnement:', e.message);
  }

  // 5. Créer une direction régionale par défaut
  try {
    db.prepare(`INSERT OR IGNORE INTO directions_regionales (id, nom_region, directeur, admin_email, mot_de_passe, statut)
      VALUES (?, ?, ?, ?, ?, ?)`)
      .run('REG-DEFAULT', 'Direction Régionale par défaut', '', 'region@sigexpc.ci', bcrypt.hashSync('REGION123', 10), 'actif');
    console.log('✅ Direction régionale par défaut créée.');
  } catch (e) {
    console.error('⚠️ Erreur direction régionale:', e.message);
  }
}

// 6. Lister les tables
try {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
  console.log(`📊 ${tables.length} tables prêtes.`);
} catch (e) {}

// ATTENTION : NE JAMAIS fermer cette DB si chargé depuis server.js (require)
// car db-sqlite.js a déjà ouvert sa propre connexion sur le même fichier.
// Fermer créerait des conflits. On ne ferme qu'en standalone (npm run init-db).
if (require.main === module) {
  db.close();
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Base initialisée avec succès !');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}
