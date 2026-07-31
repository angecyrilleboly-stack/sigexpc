// ============================================================================
//  SIGEXPC - Initialisation de la base PostgreSQL (Supabase)
//  - Crée toutes les tables (si elles n'existent pas)
//  - Insère un super admin par défaut
//  - Insère les paramètres d'abonnement
// ============================================================================
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const pool = require('./db');

async function initSupabase() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  SIGEXPC - Initialisation base PostgreSQL');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // 1. Créer les tables
  try {
    const schemaPath = path.join(__dirname, 'schema-supabase.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(sql);
    console.log('✅ Tables créées.');
  } catch (err) {
    console.error('❌ Erreur création tables:', err.message);
  }

  // 2. Vérifier s'il y a déjà un super admin
  const [existing] = await pool.query('SELECT COUNT(*) as cnt FROM super_admins');
  if (existing[0] && Number(existing[0].cnt) > 0) {
    console.log('ℹ️  La base contient déjà des données. Initialisation ignorée.');
    return;
  }

  // 3. Créer un super admin par défaut
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@sigexpc.ci';
  const adminPass = process.env.ADMIN_PASSWORD || 'ADMIN123';
  const adminName = process.env.ADMIN_NAME || 'Administrateur SIGEXPC';
  const adminId = 'SA-' + Math.floor(Math.random() * 9000 + 1000);

  try {
    const hashedPass = bcrypt.hashSync(adminPass, 10);
    await pool.query('INSERT INTO super_admins (id, nom, email, code_acces) VALUES ($1, $2, $3, $4)',
      [adminId, adminName, adminEmail, hashedPass]);
    console.log(`✅ Super admin créé : ${adminEmail}`);
  } catch (e) {
    console.error('⚠️ Erreur création super admin:', e.message);
  }

  // 4. Créer une direction régionale par défaut
  try {
    await pool.query(
      `INSERT INTO directions_regionales (id, nom_region, admin_email, mot_de_passe, statut)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO NOTHING`,
      ['REG-DEFAULT', 'Direction Régionale par défaut', 'region@sigexpc.ci', bcrypt.hashSync('REGION123', 10), 'actif']
    );
    console.log('✅ Direction régionale par défaut créée.');
  } catch (e) {
    console.error('⚠️ Erreur direction régionale:', e.message);
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Base PostgreSQL initialisée !');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

// Exécution
initSupabase().catch(e => {
  console.error('Erreur initialisation Supabase:', e.message);
});

module.exports = initSupabase;
