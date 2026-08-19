// ============================================================================
//  SIGEXPC - Routes de gestion des entités (adapté au schéma Excel réel)
// ============================================================================
const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');

function randCode(prefix, n = 6) {
  return prefix + '-' + Math.random().toString(36).substring(2, 2 + n).toUpperCase();
}
function randId(prefix, n = 4) {
  return `${prefix}-${Math.floor(Math.random() * 9 * Math.pow(10, n - 1) + Math.pow(10, n - 1))}`;
}
function cleanCat(c) { return String(c || '').replace(/Catégorie/i, '').trim() || 'ABCDE'; }
function fmtDateFR(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt)) return String(d);
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
}

// ============================================================================
// DIRECTIONS RÉGIONALES (SUPER_ADMIN)
// ============================================================================
router.get('/regions', requireAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, code_region, nom_region, admin_email, admin_nom, mot_de_passe AS code_acces, statut FROM directions_regionales ORDER BY nom_region');
    res.json({ success: true, list: rows });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

router.post('/regions', requireAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const { nom, email, telephone, adresse } = req.body;
    const id = randId('REG');
    const codeRegion = randCode('DIR');
    const code = randCode('PASS', 6);
    await pool.query(
      `INSERT INTO directions_regionales (id, code_region, nom_region, admin_email, admin_nom, mot_de_passe, date_inscription, statut)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now','localtime'), 'actif')`,
      [id, codeRegion, nom, email, telephone, code]
    );
    const [rows] = await pool.query('SELECT id, code_region, nom_region, admin_email, admin_nom, mot_de_passe AS code_acces, statut FROM directions_regionales ORDER BY nom_region');
    res.json({ success: true, code, list: rows });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

router.put('/regions/:id', requireAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const { nom, email, telephone, resetCode } = req.body;
    let code = null;
    if (resetCode) {
      code = randCode('PASS', 6);
      await pool.query('UPDATE directions_regionales SET mot_de_passe = ? WHERE id = ?', [code, req.params.id]);
    }
    await pool.query('UPDATE directions_regionales SET nom_region = ?, admin_email = ?, admin_nom = ? WHERE id = ?', [nom, email, telephone, req.params.id]);
    const [rows] = await pool.query('SELECT id, code_region, nom_region, admin_email, admin_nom, mot_de_passe AS code_acces, statut FROM directions_regionales ORDER BY nom_region');
    res.json({ success: true, list: rows, newCode: code });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

router.delete('/regions/:id', requireAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    await pool.query('DELETE FROM directions_regionales WHERE id = ?', [req.params.id]);
    const [rows] = await pool.query('SELECT id, code_region, nom_region, admin_email, admin_nom, mot_de_passe AS code_acces, statut FROM directions_regionales ORDER BY nom_region');
    res.json({ success: true, list: rows });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

// ============================================================================
// AUTO-ÉCOLES (REGION)
// ============================================================================
router.get('/auto-ecoles', requireAuth, async (req, res) => {
  try {
    const idRegion = req.session.user.role === 'SUPER_ADMIN' ? null : req.session.user.idRegion;
    let rows;
    if (idRegion) {
      [rows] = await pool.query('SELECT id, id_region, nom, email_admin, mot_de_passe AS code_acces, adresse, telephone, statut FROM auto_ecoles WHERE id_region = ? ORDER BY nom', [idRegion]);
    } else {
      [rows] = await pool.query('SELECT id, id_region, nom, email_admin, mot_de_passe AS code_acces, adresse, telephone, statut FROM auto_ecoles ORDER BY nom');
    }
    res.json({ success: true, list: rows });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

router.post('/auto-ecoles', requireAuth, requireRole('REGION', 'SUPER_ADMIN'), async (req, res) => {
  try {
    const { nom, email, telephone, adresse } = req.body;
    const idRegion = req.session.user.idRegion;
    const id = randId('AE');
    const code = randCode('PASS', 6);
    await pool.query(
      `INSERT INTO auto_ecoles (id, id_region, nom, email_admin, mot_de_passe, adresse, telephone, date_creation, statut)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'), 'actif')`,
      [id, idRegion, nom, email, code, adresse, telephone]
    );
    await pool.query(
      `INSERT INTO abonnements_auto_ecoles (id_ae, date_debut, date_fin, statut, montant_paye)
       VALUES (?, datetime('now','localtime'), datetime('now','localtime','+30 days'), 'actif', 200)`, [id]
    );
    const [rows] = await pool.query('SELECT id, id_region, nom, email_admin, mot_de_passe AS code_acces, adresse, telephone, statut FROM auto_ecoles WHERE id_region = ? ORDER BY nom', [idRegion]);
    res.json({ success: true, code, list: rows });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

router.put('/auto-ecoles/:id', requireAuth, requireRole('REGION', 'SUPER_ADMIN'), async (req, res) => {
  try {
    const { nom, email, telephone, adresse, resetCode } = req.body;
    const idRegion = req.session.user.idRegion;
    let code = null;
    if (resetCode) {
      code = randCode('PASS', 6);
      await pool.query('UPDATE auto_ecoles SET mot_de_passe = ? WHERE id = ?', [code, req.params.id]);
    }
    await pool.query('UPDATE auto_ecoles SET nom = ?, email_admin = ?, adresse = ?, telephone = ? WHERE id = ?', [nom, email, adresse, telephone, req.params.id]);
    const [rows] = await pool.query('SELECT id, id_region, nom, email_admin, mot_de_passe AS code_acces, adresse, telephone, statut FROM auto_ecoles WHERE id_region = ? ORDER BY nom', [idRegion]);
    res.json({ success: true, list: rows, newCode: code });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

router.delete('/auto-ecoles/:id', requireAuth, requireRole('REGION', 'SUPER_ADMIN'), async (req, res) => {
  try {
    const idRegion = req.session.user.idRegion;
    await pool.query('DELETE FROM auto_ecoles WHERE id = ?', [req.params.id]);
    const [rows] = await pool.query('SELECT id, id_region, nom, email_admin, mot_de_passe AS code_acces, adresse, telephone, statut FROM auto_ecoles WHERE id_region = ? ORDER BY nom', [idRegion]);
    res.json({ success: true, list: rows });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

// ============================================================================
// AGENTS VÉRIFICATEURS (REGION)
// ============================================================================
router.get('/agents', requireAuth, requireRole('REGION', 'SUPER_ADMIN'), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, id_region, nom, email, code_acces, specialite, statut FROM agents_verificateurs WHERE id_region = ? ORDER BY nom', [req.session.user.idRegion]);
    res.json({ success: true, list: rows });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

router.post('/agents', requireAuth, requireRole('REGION'), async (req, res) => {
  try {
    const { nom, email, specialite } = req.body;
    const idRegion = req.session.user.idRegion;
    const id = randId('AG');
    const code = randCode('AG', 6);
    await pool.query(
      `INSERT INTO agents_verificateurs (id, id_region, nom, email, code_acces, specialite, statut)
       VALUES (?, ?, ?, ?, ?, ?, 'actif')`, [id, idRegion, nom, email, code, specialite]
    );
    const [rows] = await pool.query('SELECT id, id_region, nom, email, code_acces, specialite, statut FROM agents_verificateurs WHERE id_region = ? ORDER BY nom', [idRegion]);
    res.json({ success: true, code, list: rows });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

router.put('/agents/:id', requireAuth, requireRole('REGION'), async (req, res) => {
  try {
    const { nom, email, specialite, resetCode } = req.body;
    const idRegion = req.session.user.idRegion;
    let code = null;
    if (resetCode) {
      code = randCode('AG', 6);
      await pool.query('UPDATE agents_verificateurs SET code_acces = ? WHERE id = ?', [code, req.params.id]);
    }
    await pool.query('UPDATE agents_verificateurs SET nom = ?, email = ?, specialite = ? WHERE id = ?', [nom, email, specialite, req.params.id]);
    const [rows] = await pool.query('SELECT id, id_region, nom, email, code_acces, specialite, statut FROM agents_verificateurs WHERE id_region = ? ORDER BY nom', [idRegion]);
    res.json({ success: true, list: rows, newCode: code });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

router.delete('/agents/:id', requireAuth, requireRole('REGION'), async (req, res) => {
  try {
    const idRegion = req.session.user.idRegion;
    await pool.query('DELETE FROM agents_verificateurs WHERE id = ?', [req.params.id]);
    const [rows] = await pool.query('SELECT id, id_region, nom, email, code_acces, specialite, statut FROM agents_verificateurs WHERE id_region = ? ORDER BY nom', [idRegion]);
    res.json({ success: true, list: rows });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

// ============================================================================
// STTC USERS (REGION)
// ============================================================================
router.get('/sttc-users', requireAuth, requireRole('REGION'), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, id_region, nom, email, code AS code_acces, statut FROM sttc_users WHERE id_region = ? ORDER BY nom', [req.session.user.idRegion]);
    res.json({ success: true, list: rows });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

router.post('/sttc-users', requireAuth, requireRole('REGION'), async (req, res) => {
  try {
    const { nom, email } = req.body;
    const idRegion = req.session.user.idRegion;
    const id = randId('STTC');
    const code = randCode('STTC', 6);
    await pool.query(
      `INSERT INTO sttc_users (id, id_region, nom, email, code, date, statut)
       VALUES (?, ?, ?, ?, ?, datetime('now','localtime'), 'actif')`, [id, idRegion, nom, email, code]
    );
    const [rows] = await pool.query('SELECT id, id_region, nom, email, code AS code_acces, statut FROM sttc_users WHERE id_region = ? ORDER BY nom', [idRegion]);
    res.json({ success: true, code, list: rows });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

router.put('/sttc-users/:id', requireAuth, requireRole('REGION'), async (req, res) => {
  try {
    const { nom, email, resetCode } = req.body;
    const idRegion = req.session.user.idRegion;
    let code = null;
    if (resetCode) {
      code = randCode('STTC', 6);
      await pool.query('UPDATE sttc_users SET code = ? WHERE id = ?', [code, req.params.id]);
    }
    await pool.query('UPDATE sttc_users SET nom = ?, email = ? WHERE id = ?', [nom, email, req.params.id]);
    const [rows] = await pool.query('SELECT id, id_region, nom, email, code AS code_acces, statut FROM sttc_users WHERE id_region = ? ORDER BY nom', [idRegion]);
    res.json({ success: true, list: rows, newCode: code });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

router.delete('/sttc-users/:id', requireAuth, requireRole('REGION'), async (req, res) => {
  try {
    const idRegion = req.session.user.idRegion;
    await pool.query('DELETE FROM sttc_users WHERE id = ?', [req.params.id]);
    const [rows] = await pool.query('SELECT id, id_region, nom, email, code AS code_acces, statut FROM sttc_users WHERE id_region = ? ORDER BY nom', [idRegion]);
    res.json({ success: true, list: rows });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

// ============================================================================
// CENTRES D'EXAMEN (REGION)
// ============================================================================
router.get('/centres', requireAuth, requireRole('REGION'), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, id_region, nom AS nom_centre FROM centres_examen WHERE id_region = ? ORDER BY nom', [req.session.user.idRegion]);
    res.json({ success: true, list: rows });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

router.post('/centres', requireAuth, requireRole('REGION'), async (req, res) => {
  try {
    const { nom } = req.body;
    const idRegion = req.session.user.idRegion;
    await pool.query('INSERT INTO centres_examen (id, id_region, nom) VALUES (?, ?, ?)', [randId('CEN', 5), idRegion, nom]);
    const [rows] = await pool.query('SELECT id, id_region, nom AS nom_centre FROM centres_examen WHERE id_region = ? ORDER BY nom', [idRegion]);
    res.json({ success: true, list: rows });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

router.delete('/centres/:id', requireAuth, requireRole('REGION'), async (req, res) => {
  try {
    const idRegion = req.session.user.idRegion;
    await pool.query('DELETE FROM centres_examen WHERE id = ?', [req.params.id]);
    const [rows] = await pool.query('SELECT id, id_region, nom AS nom_centre FROM centres_examen WHERE id_region = ? ORDER BY nom', [idRegion]);
    res.json({ success: true, list: rows });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

// ============================================================================
// PERSONNEL AUTO-ÉCOLE (staff)
// ============================================================================
router.get('/staff', requireAuth, requireRole('AUTO_ECOLE'), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, id_ae, nom, role FROM auto_ecoles_staff WHERE id_ae = ?', [req.session.user.id]);
    res.json({ success: true, list: rows });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

// Gestion des accès collaborateurs : réservée UNIQUEMENT au compte
// principal de l'auto-école (isMain). Ni un collaborateur GERANT, ni un
// SECRETAIRE ne peuvent créer ou supprimer des accès.
function requireGerant(req, res, next) {
  const u = req.session && req.session.user;
  if (!u) return res.status(401).json({ success: false, msg: 'Non connecté.' });
  if (!u.isMain) {
    return res.status(403).json({ success: false, msg: 'Accès refusé : réservé au compte principal de l\'auto-école.' });
  }
  next();
}

router.post('/staff', requireAuth, requireRole('AUTO_ECOLE'), requireGerant, async (req, res) => {
  try {
    const { nom, motDePasse, subRole } = req.body;
    if (!nom || !String(nom).trim()) return res.status(400).json({ success: false, msg: 'Le nom est obligatoire.' });
    if (!motDePasse || String(motDePasse).length < 6) {
      return res.status(400).json({ success: false, msg: 'Le mot de passe doit contenir au moins 6 caractères.' });
    }
    const idAE = req.session.user.id;
    const id = randId('STF', 5);
    // Pas d'email : le collaborateur se connecte avec l'email de l'auto-école
    // + le mot de passe DEFINI PAR l'auto-école. Ses accès dépendent de son rôle.
    const hash = await bcrypt.hash(String(motDePasse), 10);
    await pool.query(
      `INSERT INTO auto_ecoles_staff (id, id_ae, nom, email, code, role, statut, date)
       VALUES (?, ?, ?, NULL, ?, ?, 'actif', datetime('now','localtime'))`, [id, idAE, String(nom).trim(), hash, subRole || 'SECRETAIRE']
    );
    const [rows] = await pool.query('SELECT id, id_ae, nom, role FROM auto_ecoles_staff WHERE id_ae = ?', [idAE]);
    res.json({ success: true, list: rows });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

router.delete('/staff/:id', requireAuth, requireRole('AUTO_ECOLE'), requireGerant, async (req, res) => {
  try {
    const idAE = req.session.user.id;
    await pool.query('DELETE FROM auto_ecoles_staff WHERE id = ? AND id_ae = ?', [req.params.id, idAE]);
    const [rows] = await pool.query('SELECT id, id_ae, nom, role FROM auto_ecoles_staff WHERE id_ae = ?', [idAE]);
    res.json({ success: true, list: rows });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

module.exports = router;
