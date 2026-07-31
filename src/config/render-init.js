// ============================================================================
//  SIGEXPC - Initialisation de la base SQLite pour Render
//  Lancé automatiquement par Render via "npm run render-build"
//  - Crée toutes les tables (si elles n'existent pas)
//  - Insère un super admin par défaut (configurable via variables d'env)
//  - Insère les paramètres d'abonnement par défaut
// ============================================================================
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');

const DB_FILE = path.join(__dirname, '..', '..', 'data', 'sigexpc.db');
fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });

const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA foreign_keys = ON;');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  SIGEXPC - Initialisation base (Render)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// 1. Créer les tables depuis le schéma
try {
  const schemaPath = path.join(__dirname, 'schema-sqlite.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(sql);
  console.log('✅ Tables créées.');
} catch (err) {
  console.error('❌ Erreur schéma:', err.message);
}

// 2. Vérifier s'il y a déjà un super admin
const [existingAdmins] = [db.prepare('SELECT COUNT(*) as cnt FROM super_admins').get()];
if (existingAdmins && existingAdmins.cnt > 0) {
  console.log('ℹ️  La base contient déjà des données. Initialisation ignorée.');
  db.close();
  process.exit(0);
}

// 3. Créer un super admin par défaut
//    Configurable via les variables d'environnement Render :
//    ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME
const adminEmail = process.env.ADMIN_EMAIL || 'admin@sigexpc.ci';
const adminPass = process.env.ADMIN_PASSWORD || 'ADMIN123';
const adminName = process.env.ADMIN_NAME || 'Administrateur SIGEXPC';
const adminId = 'SA-' + Math.floor(Math.random() * 9000 + 1000);

try {
  const hashedPass = bcrypt.hashSync(adminPass, 10);
  db.prepare('INSERT INTO super_admins (id, nom, email, code_acces) VALUES (?, ?, ?, ?)')
    .run(adminId, adminName, adminEmail, hashedPass);
  console.log(`✅ Super admin créé : ${adminEmail} (mot de passe : ${adminPass})`);
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

// 5. Créer une direction régionale de test (pour pouvoir créer des AE)
try {
  db.prepare(`INSERT OR IGNORE INTO directions_regionales (id, nom_region, directeur, admin_email, mot_de_passe, statut)
    VALUES (?, ?, ?, ?, ?, ?)`)
    .run('REG-DEFAULT', 'Direction Régionale par défaut', '', 'region@sigexpc.ci', bcrypt.hashSync('REGION123', 10), 'actif');
  console.log('✅ Direction régionale par défaut créée : region@sigexpc.ci / REGION123');
} catch (e) {
  console.error('⚠️ Erreur direction régionale:', e.message);
}

// 6. Lister les tables
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
console.log(`\n📊 ${tables.length} tables prêtes.`);
// ATTENTION : ne pas fermer la DB si on est chargé depuis server.js (require),
// car db-sqlite.js gère sa propre connexion. On ne ferme que si exécuté en standalone.
if (require.main === module) {
  db.close();
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  Base initialisée avec succès !');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
