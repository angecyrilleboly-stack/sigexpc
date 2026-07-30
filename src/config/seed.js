// ============================================================================
//  SIGEXPC - Peuplement de la base avec des données de démonstration
//  ATTENTION : À utiliser seulement pour des tests. Pour vos VRAIES données,
//  utilisez plutôt : npm run migrate "votre_fichier.xlsx"
//  Usage : npm run seed
// ============================================================================
const bcrypt = require('bcryptjs');
const pool = require('./db');

function genId(prefix, n = 4) {
  const num = Math.floor(Math.random() * Math.pow(10, n) + Math.pow(10, n));
  return `${prefix}-${num}`;
}

async function hash(pwd) { return bcrypt.hash(pwd, 10); }

async function seed() {
  console.log('\n🌱 SIGEXPC - Peuplement des données de DÉMONSTRATION...');
  console.log('   (Pour vos données réelles, utilisez : npm run migrate fichier.xlsx)\n');

  // SUPER ADMIN
  const saPwd = await hash('admin123');
  await pool.query(
    `INSERT INTO super_admins (id, email, nom, code_acces) VALUES ('SA-01', 'admin@sigexpc.ci', 'Super Administrateur', ?)
     ON DUPLICATE KEY UPDATE code_acces = VALUES(code_acces)`, [saPwd]
  );
  console.log('✓ Super Admin : admin@sigexpc.ci / admin123');

  // DIRECTION RÉGIONALE
  const regPwd = await hash('region123');
  const regId = 'REG-DEMO';
  await pool.query(
    `INSERT INTO directions_regionales (id, code_region, nom_region, admin_email, admin_nom, mot_de_passe, date_inscription, statut)
     VALUES (?, 'DIR-DEMO', 'Direction Régionale des Transports et des Affaires Maritimes (Démo)', 'region@sigexpc.ci', 'Directeur Régional', ?, NOW(), 'actif')
     ON DUPLICATE KEY UPDATE mot_de_passe = VALUES(mot_de_passe)`, [regId, regPwd]
  );
  console.log('✓ Direction Rég. : region@sigexpc.ci / region123');

  await pool.query(
    `INSERT INTO parametres_region (id_region, chef_sttc, coordonnateur, directeur_regional)
     VALUES (?, 'M. DEMO Chef', 'Mme DEMO Coord', 'M. DEMO Directeur')
     ON DUPLICATE KEY UPDATE chef_sttc = VALUES(chef_sttc)`, [regId]
  );

  // AUTO-ÉCOLES
  const aePwd = await hash('ecole123');
  const aes = [
    { id: 'AE-DEMO1', nom: 'Auto-École Démo Excellence', email: 'demo1@sigexpc.ci' },
    { id: 'AE-DEMO2', nom: 'Auto-École Démo Étoile', email: 'demo2@sigexpc.ci' }
  ];
  for (const ae of aes) {
    await pool.query(
      `INSERT INTO auto_ecoles (id, id_region, nom, email_admin, mot_de_passe, adresse, telephone, date_creation, statut)
       VALUES (?, ?, ?, ?, ?, 'Abidjan', '07 00 00 00', NOW(), 'actif')
       ON DUPLICATE KEY UPDATE mot_de_passe = VALUES(mot_de_passe)`, [ae.id, regId, ae.nom, ae.email, aePwd]
    );
    await pool.query(
      `INSERT INTO abonnements_auto_ecoles (id_ae, date_debut, date_fin, statut, montant_paye)
       VALUES (?, NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), 'actif', 200)`, [ae.id]
    );
  }
  console.log('✓ Auto-Écoles : demo1@sigexpc.ci, demo2@sigexpc.ci / ecole123');

  // AGENTS
  const agPwd = await hash('agent123');
  await pool.query(
    `INSERT INTO agents_verificateurs (id, id_region, nom, email, code_acces, specialite, statut)
     VALUES ('AG-DEMO', ?, 'Agent Démo', 'agent@sigexpc.ci', ?, 'Conduite', 'actif')
     ON DUPLICATE KEY UPDATE code_acces = VALUES(code_acces)`, [regId, agPwd]
  );
  console.log('✓ Agent : agent@sigexpc.ci / agent123');

  // STTC
  const sttcPwd = await hash('sttc123');
  await pool.query(
    `INSERT INTO sttc_users (id, id_region, nom, email, code, date, statut)
     VALUES ('STTC-DEMO', ?, 'STTC Démo', 'sttc@sigexpc.ci', ?, NOW(), 'actif')
     ON DUPLICATE KEY UPDATE code = VALUES(code)`, [regId, sttcPwd]
  );
  console.log('✓ STTC : sttc@sigexpc.ci / sttc123');

  // CANDIDATS
  const noms = ['Kouassi', 'Diallo', 'Traoré', 'Cissé', 'Yapi'];
  for (let i = 0; i < 8; i++) {
    await pool.query(
      `INSERT IGNORE INTO candidats (id, id_autoecole, nom, prenoms, numero_piece, categorie_permis, telephone, date_inscription, statut_inscription)
       VALUES (?, ?, ?, '', ?, 'ABCDE', '', NOW(), 'En attente (Code)')`,
      [genId('CAN', 5), i % 2 ? 'AE-DEMO2' : 'AE-DEMO1', noms[i % noms.length], 'CNI' + (1000000 + i)]
    );
  }

  // EXAMENS
  await pool.query(
    `INSERT IGNORE INTO examens_programmes (id, id_region, type_examen, date_examen, heure, lieu, inspecteur_nom, places_max, places_prises, statut)
     VALUES ('EX-DEMO1', ?, 'Théorique (Code)', DATE_ADD(CURDATE(), INTERVAL 7 DAY), '08:00:00', 'Centre Démo', 'Inspecteur Démo', 50, 0, 'ouvert')`, [regId]
  );
  await pool.query(
    `INSERT IGNORE INTO examens_programmes (id, id_region, type_examen, date_examen, heure, lieu, inspecteur_nom, places_max, places_prises, statut)
     VALUES ('EX-DEMO2', ?, 'Pratique (Conduite)', DATE_ADD(CURDATE(), INTERVAL 14 DAY), '08:00:00', 'Centre Démo', 'Inspecteur Démo', 50, 0, 'ouvert')`, [regId]
  );

  console.log('\n✅ Données de démonstration insérées !');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Connectez-vous avec l\'un des comptes ci-dessus.');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  await pool.end();
}

seed().catch(err => { console.error('❌ Erreur :', err.message); process.exit(1); });
