// ============================================================================
//  SIGEXPC - Migration des données Excel (.xlsx) vers la base de données
//  Fonctionne avec SQLite (par défaut) ou MySQL.
//  Usage : npm run migrate "C:\chemin\vers\fichier.xlsx"
// ============================================================================
const XLSX = require('xlsx');
const pool = require('./db');

function excelDate(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) return v;
  if (typeof v === 'number') {
    const dt = new Date(Math.round((v - 25569) * 86400 * 1000));
    return isNaN(dt) ? null : dt;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) { const dt = new Date(m[3], m[2] - 1, m[1]); return isNaN(dt) ? null : dt; }
  const dt = new Date(s);
  return isNaN(dt) ? null : dt;
}
function fmtSQLDate(v) {
  const d = excelDate(v);
  if (!d) return null;
  return d.toISOString().slice(0, 19).replace('T', ' ');
}
function toStr(v) { return v == null || v === '' ? null : String(v).trim(); }
function toNum(v, def = null) { const n = Number(v); return isNaN(n) ? def : n; }
function readSheet(wb, name) {
  if (!wb.Sheets[name]) return [];
  return XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '' });
}

// Helper upsert : INSERT OR REPLACE (SQLite) — écrase la ligne existante sur PK
async function upsert(table, cols, values) {
  const placeholders = values.map(() => '?').join(', ');
  await pool.query(`INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`, values);
}

// Helper insert simple (ignore si existe)
async function insertIgnore(table, cols, values) {
  const placeholders = values.map(() => '?').join(', ');
  await pool.query(`INSERT OR IGNORE INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`, values);
}

async function migrate() {
  const filePath = process.argv[2] || 'C:/Users/AORUS GAMING/Downloads/SOFT PERMIS BON SIGEXPC (2).xlsx';
  console.log('\n📦 SIGEXPC - Migration Excel → Base de données');
  console.log('   Fichier source :', filePath);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const wb = XLSX.readFile(filePath);
  const stats = {};

  // 1. SUPER ADMINS
  console.log('▸ Super admins...');
  const admins = readSheet(wb, 'super_admins').filter(r => r.id);
  for (const r of admins) {
    await upsert('super_admins', ['id', 'email', 'nom', 'code_acces'], [toStr(r.id), toStr(r.email), toStr(r.nom), toStr(r.code_acces)]);
  }
  stats.admins = admins.length;
  console.log('  ✓ ' + admins.length + ' super admin(s)');

  // 2. DIRECTIONS RÉGIONALES
  console.log('▸ Directions régionales...');
  const regions = readSheet(wb, 'directions_regionales').filter(r => r.id);
  for (const r of regions) {
    await upsert('directions_regionales',
      ['id', 'code_region', 'nom_region', 'admin_email', 'admin_nom', 'mot_de_passe', 'date_inscription', 'statut'],
      [toStr(r.id), toStr(r.code_region), toStr(r.nom_region), toStr(r.admin_email), toStr(r.admin_nom), toStr(r.code_acces), fmtSQLDate(r.date_inscription), toStr(r.statut) || 'actif']
    );
  }
  stats.regions = regions.length;
  console.log('  ✓ ' + regions.length + ' direction(s) régionale(s)');

  // 3. AUTO-ÉCOLES
  console.log('▸ Auto-écoles...');
  const aes = readSheet(wb, 'auto_ecoles').filter(r => r.id);
  for (const r of aes) {
    await upsert('auto_ecoles',
      ['id', 'id_region', 'nom', 'email_admin', 'mot_de_passe', 'adresse', 'telephone', 'date_creation', 'statut'],
      [toStr(r.id), toStr(r.id_region), toStr(r.nom_autoecole), toStr(r.email_admin), toStr(r.code_acces), toStr(r.adresse), toStr(r.telephone), fmtSQLDate(r.date_creation), toStr(r.statut) || 'actif']
    );
  }
  stats.aes = aes.length;
  console.log('  ✓ ' + aes.length + ' auto-école(s)');

  // 4. STAFF
  console.log('▸ Personnel auto-écoles...');
  const staff = readSheet(wb, 'auto_ecoles_staff').filter(r => r.id);
  for (const r of staff) {
    await upsert('auto_ecoles_staff', ['id', 'id_ae', 'nom', 'email', 'code', 'role', 'statut', 'date'],
      [toStr(r.id), toStr(r.id_ae), toStr(r.nom), toStr(r.email), toStr(r.code), toStr(r.role) || 'SECRETAIRE', toStr(r.statut) || 'actif', fmtSQLDate(r.date)]);
  }
  stats.staff = staff.length;
  console.log('  ✓ ' + staff.length + ' collaborateur(s)');

  // 5. AGENTS
  console.log('▸ Agents vérificateurs...');
  const agents = readSheet(wb, 'agents_verificateurs').filter(r => r.id);
  for (const r of agents) {
    await upsert('agents_verificateurs', ['id', 'id_region', 'nom', 'email', 'code_acces', 'specialite', 'statut'],
      [toStr(r.id), toStr(r.ID_REGION || r.id_region), toStr(r.NOM || r.nom), toStr(r.EMAIL || r.email), toStr(r.CODE || r.code_acces), toStr(r.specialite), toStr(r.STATUT || r.statut) || 'actif']);
  }
  stats.agents = agents.length;
  console.log('  ✓ ' + agents.length + ' agent(s)');

  // 6. STTC
  console.log('▸ Utilisateurs STTC...');
  const sttc = readSheet(wb, 'sttc_users').filter(r => r.ID || r.id);
  for (const r of sttc) {
    await upsert('sttc_users', ['id', 'id_region', 'nom', 'email', 'code', 'date', 'statut'],
      [toStr(r.ID || r.id), toStr(r.ID_REGION || r.id_region), toStr(r.NOM || r.nom), toStr(r.EMAIL || r.email), toStr(r.CODE || r.code), fmtSQLDate(r.DATE || r.date), toStr(r.STATUT || r.statut) || 'actif']);
  }
  stats.sttc = sttc.length;
  console.log('  ✓ ' + sttc.length + ' utilisateur(s) STTC');

  // 7. CENTRES
  console.log('▸ Centres d\'examen...');
  const centres = readSheet(wb, 'centres_examen').filter(r => r.id);
  for (const r of centres) {
    await upsert('centres_examen', ['id', 'id_region', 'nom'], [toStr(r.id), toStr(r.id_region), toStr(r.nom_centre)]);
  }
  stats.centres = centres.length;
  console.log('  ✓ ' + centres.length + ' centre(s)');

  // 8. CANDIDATS
  console.log('▸ Candidats...');
  const candidats = readSheet(wb, 'candidats').filter(r => r.id);
  let candCount = 0;
  for (const r of candidats) {
    try {
      await upsert('candidats', ['id', 'id_autoecole', 'nom', 'prenoms', 'numero_piece', 'categorie_permis', 'telephone', 'date_inscription', 'statut_inscription'],
        [toStr(r.id), toStr(r.id_autoecole), toStr(r.nom), toStr(r.prenoms), toStr(r.numero_piece), toStr(r.categorie_permis) || 'ABCDE', toStr(r.telephone), fmtSQLDate(r.date_inscription), toStr(r.statut_inscription) || 'En attente (Code)']);
      candCount++;
    } catch (e) { /* ignore doublons */ }
  }
  stats.candidats = candCount;
  console.log('  ✓ ' + candCount + ' candidat(s)');

  // 9. EXAMENS
  console.log('▸ Examens programmés...');
  const examens = readSheet(wb, 'examens_programmes').filter(r => r.id);
  for (const r of examens) {
    await upsert('examens_programmes',
      ['id', 'id_region', 'type_examen', 'date_examen', 'heure', 'lieu', 'inspecteur_nom', 'inspecteur_contact', 'agent1', 'agent2', 'agent3', 'agent4', 'agent5', 'places_max', 'places_prises', 'statut'],
      [toStr(r.id), toStr(r.id_region), toStr(r.type_examen), fmtSQLDate(r.date_examen), toStr(r.heure) || '08:00:00',
       toStr(r.lieu), toStr(r.inspecteur_nom), toStr(r.inspecteur_contact),
       toStr(r.agent1), toStr(r.agent2), toStr(r.agent3), toStr(r.agent4), toStr(r.agent5),
       toNum(r.places_max, 50), toNum(r.places_prises, 0), toStr(r.statut) || 'ouvert']);
  }
  stats.examens = examens.length;
  console.log('  ✓ ' + examens.length + ' examen(s)');

  // 10. INSCRIPTIONS
  console.log('▸ Inscriptions examens...');
  const inscriptions = readSheet(wb, 'inscriptions_examens').filter(r => r.id);
  let inscCount = 0;
  for (const r of inscriptions) {
    try {
      await upsert('inscriptions_examens', ['id', 'id_candidat', 'id_examen', 'date_inscription', 'resultat', 'notes', 'observations', 'validation_region'],
        [toStr(r.id), toStr(r.id_candidat), toStr(r.id_examen), fmtSQLDate(r.date_inscription), toStr(r.resultat) || 'En attente', toStr(r.notes), toStr(r.observations), toStr(r.validation_region)]);
      inscCount++;
    } catch (e) { /* ignore FK cassées / doublons */ }
  }
  stats.inscriptions = inscCount;
  console.log('  ✓ ' + inscCount + ' inscription(s)');

  // 11. PARAMÈTRES ABONNEMENT
  console.log('▸ Paramètres abonnement...');
  const params = readSheet(wb, 'parametres_abonnement');
  if (params[0]) {
    const p = params[0];
    await upsert('parametres_abonnement', ['id', 'montant', 'duree_jours'], [1, toNum(p.montant, 200), toNum(p.duree_jours, 30)]);
  }
  console.log('  ✓ Paramètres mis à jour');

  // 12. ABONNEMENTS
  console.log('▸ Abonnements auto-écoles...');
  const abos = readSheet(wb, 'abonnements_auto_ecoles');
  for (const r of abos) {
    if (!r.id_ae) continue;
    await pool.query('INSERT INTO abonnements_auto_ecoles (id_ae, date_debut, date_fin, statut, montant_paye) VALUES (?, ?, ?, ?, ?)',
      [toStr(r.id_ae), fmtSQLDate(r.date_debut), fmtSQLDate(r.date_fin), toStr(r.statut) || 'actif', toNum(r.montant_paye, 200)]);
  }
  stats.abos = abos.length;
  console.log('  ✓ ' + abos.length + ' abonnement(s)');

  // 13. REÇUS
  console.log('▸ Reçus de paiement...');
  const recus = readSheet(wb, 'recus_paiement').filter(r => r.id);
  for (const r of recus) {
    await upsert('recus_paiement', ['id', 'id_ae', 'date_emission', 'montant', 'periode_debut', 'periode_fin', 'statut', 'num_recu'],
      [toStr(r.id), toStr(r.id_ae), fmtSQLDate(r.date_emission), toNum(r.montant, 200), fmtSQLDate(r.periode_debut), fmtSQLDate(r.periode_fin), toStr(r.statut) || 'actif', toStr(r.num_recu)]);
  }
  stats.recus = recus.length;
  console.log('  ✓ ' + recus.length + ' reçu(s)');

  // 14. PARAMÈTRES RÉGION
  console.log('▸ Paramètres région (signataires)...');
  const paramReg = readSheet(wb, 'parametres_region').filter(r => r.id_region);
  for (const r of paramReg) {
    // Conserver le format complet "Directeur Régional||Nom" attendu par le frontend
    let dir = toStr(r.directeur_regional) || '';
    // Si seul le nom est stocké (sans préfixe), ajouter le préfixe par défaut
    if (dir && !dir.includes('||')) dir = 'Directeur Régional||' + dir.trim();
    await upsert('parametres_region', ['id_region', 'chef_sttc', 'coordonnateur', 'directeur_regional'],
      [toStr(r.id_region), toStr(r.chef_sttc), toStr(r.coordonnateur), dir]);
  }
  console.log('  ✓ ' + paramReg.length + ' paramètre(s) région');

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  ✅ MIGRATION TERMINÉE AVEC SUCCÈS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Récapitulatif :');
  Object.entries(stats).forEach(([k, v]) => console.log(`    • ${k} : ${v}`));
  console.log('\n  Démarrez l\'application : npm start');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await pool.end();
}

migrate().catch(err => {
  console.error('\n❌ Erreur de migration :', err.message);
  process.exit(1);
});
