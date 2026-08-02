// ============================================================================
//  SIGEXPC - Routes Candidats & Inscriptions (adapté au schéma Excel réel)
//  IMPORTANT : inscriptions_examens a :
//    - resultat         = 'En attente' | 'Validé'  (validation bordereau)
//    - validation_region = 'APTE'|'INAPTE'|'ABSENT'|'NON EVALUE'|'Permis retiré'|'Validé'|''  (résultat délibération)
// ============================================================================
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');

function randId(prefix, n = 5) {
  return `${prefix}-${Math.floor(Math.random() * 9 * Math.pow(10, n - 1) + Math.pow(10, n - 1))}`;
}
function cleanCat(c) { return String(c || '').replace(/Catégorie/i, '').trim() || 'ABCDE'; }
function fmtDateFR(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt)) return String(d);
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
}
function parseDate(v) {
  // Gère les dates Excel (nombres) ET les chaînes ISO
  if (v == null || v === '') return null;
  if (typeof v === 'number') {
    // Série Excel : jours depuis 1899-12-30
    const dt = new Date(Math.round((v - 25569) * 86400 * 1000));
    return isNaN(dt) ? null : dt;
  }
  const dt = new Date(v);
  return isNaN(dt) ? null : dt;
}

// ============================================================================
// CANDIDATS (AUTO_ECOLE)
// ============================================================================
router.get('/', requireAuth, requireRole('AUTO_ECOLE'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, id_autoecole, nom, prenoms, numero_piece, categorie_permis AS categorie, telephone, statut_inscription AS statut
       FROM candidats WHERE id_autoecole = ? ORDER BY nom`, [req.session.user.id]
    );
    res.json({ success: true, list: rows });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

router.post('/', requireAuth, requireRole('AUTO_ECOLE'), async (req, res) => {
  try {
    const { nomPrenoms, piece, categorie, etape } = req.body;
    const idAE = req.session.user.id;
    const [exists] = await pool.query(
      'SELECT id FROM candidats WHERE LOWER(nom) = ? AND numero_piece = ? LIMIT 1',
      [String(nomPrenoms).trim().toLowerCase(), piece]
    );
    if (exists.length) return res.json({ success: false, msg: 'Doublon détecté : Ce candidat existe déjà.' });

    const id = randId('CAN');
    const startStatus = etape === 'Conduite' ? 'En attente (Conduite)' : 'En attente (Code)';
    await pool.query(
      `INSERT INTO candidats (id, id_autoecole, nom, prenoms, numero_piece, categorie_permis, telephone, date_inscription, statut_inscription)
       VALUES (?, ?, ?, '', ?, ?, '', datetime('now','localtime'), ?)`,
      [id, idAE, nomPrenoms, piece, cleanCat(categorie), startStatus]
    );
    const [rows] = await pool.query(
      'SELECT id, id_autoecole, nom, prenoms, numero_piece, categorie_permis AS categorie, telephone, statut_inscription AS statut FROM candidats WHERE id_autoecole = ? ORDER BY nom', [idAE]
    );
    res.json({ success: true, list: rows });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

router.put('/:id', requireAuth, requireRole('AUTO_ECOLE'), async (req, res) => {
  try {
    const { nomPrenoms, piece, categorie, etape } = req.body;
    const idAE = req.session.user.id;
    const [cur] = await pool.query('SELECT statut_inscription FROM candidats WHERE id = ?', [req.params.id]);
    const st = cur[0] ? String(cur[0].statut_inscription) : '';
    let newStatus = undefined;
    if (st === 'En attente' || st === 'En attente (Code)' || st === 'En attente (Conduite)') {
      newStatus = etape === 'Conduite' ? 'En attente (Conduite)' : 'En attente (Code)';
    }
    if (newStatus) {
      await pool.query('UPDATE candidats SET nom = ?, numero_piece = ?, categorie_permis = ?, statut_inscription = ? WHERE id = ?', [nomPrenoms, piece, cleanCat(categorie), newStatus, req.params.id]);
    } else {
      await pool.query('UPDATE candidats SET nom = ?, numero_piece = ?, categorie_permis = ? WHERE id = ?', [nomPrenoms, piece, cleanCat(categorie), req.params.id]);
    }
    const [rows] = await pool.query('SELECT id, id_autoecole, nom, prenoms, numero_piece, categorie_permis AS categorie, telephone, statut_inscription AS statut FROM candidats WHERE id_autoecole = ? ORDER BY nom', [idAE]);
    res.json({ success: true, list: rows });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

router.delete('/:id', requireAuth, requireRole('AUTO_ECOLE'), async (req, res) => {
  try {
    const idAE = req.session.user.id;
    await pool.query('DELETE FROM candidats WHERE id = ? AND id_autoecole = ?', [req.params.id, idAE]);
    const [rows] = await pool.query('SELECT id, id_autoecole, nom, prenoms, numero_piece, categorie_permis AS categorie, telephone, statut_inscription AS statut FROM candidats WHERE id_autoecole = ? ORDER BY nom', [idAE]);
    res.json({ success: true, list: rows });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

router.post('/delete-many', requireAuth, requireRole('AUTO_ECOLE'), async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) return res.json({ success: false, msg: 'Aucun ID.' });
    const idAE = req.session.user.id;
    await pool.query('DELETE FROM candidats WHERE id IN (?) AND id_autoecole = ?', [ids, idAE]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

// ============================================================================
// EXAMENS (REGION)
// ============================================================================
router.get('/examens/list', requireAuth, async (req, res) => {
  try {
    const role = req.session.user.role;
    let idRegion = req.session.user.idRegion;
    let rows;
    if (role === 'AUTO_ECOLE') {
      const [aeRows] = await pool.query('SELECT id_region FROM auto_ecoles WHERE id = ?', [req.session.user.id]);
      idRegion = aeRows[0] ? aeRows[0].id_region : '';
    }
    [rows] = await pool.query('SELECT * FROM examens_programmes WHERE id_region = ? ORDER BY date_examen DESC', [idRegion]);
    res.json({ success: true, list: rows });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

router.post('/examens', requireAuth, requireRole('REGION'), async (req, res) => {
  try {
    const { type, date, lieu, inspecteurNom, inspecteurContact, agent1, agent2, agent3, agent4, agent5 } = req.body;
    const idRegion = req.session.user.idRegion;
    const id = randId('EX', 4);
    await pool.query(
      `INSERT INTO examens_programmes
        (id, id_region, type_examen, date_examen, heure, lieu, inspecteur_nom, inspecteur_contact,
         agent1, agent2, agent3, agent4, agent5, places_max, places_prises, statut)
       VALUES (?, ?, ?, ?, '08:00:00', ?, ?, ?, ?, ?, ?, ?, ?, 50, 0, 'ouvert')`,
      [id, idRegion, type, date, lieu, inspecteurNom, inspecteurContact, agent1 || '', agent2 || '', agent3 || '', agent4 || '', agent5 || '']
    );
    const [rows] = await pool.query('SELECT * FROM examens_programmes WHERE id_region = ? ORDER BY date_examen DESC', [idRegion]);
    res.json({ success: true, list: rows });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

router.put('/examens/:id', requireAuth, requireRole('REGION'), async (req, res) => {
  try {
    const { type, date, lieu, inspecteurNom, inspecteurContact, agent1, agent2, agent3, agent4, agent5 } = req.body;
    const idRegion = req.session.user.idRegion;
    await pool.query(
      `UPDATE examens_programmes SET type_examen=?, date_examen=?, lieu=?, inspecteur_nom=?, inspecteur_contact=?,
        agent1=?, agent2=?, agent3=?, agent4=?, agent5=? WHERE id=?`,
      [type, date, lieu, inspecteurNom, inspecteurContact, agent1||'', agent2||'', agent3||'', agent4||'', agent5||'', req.params.id]
    );
    const [rows] = await pool.query('SELECT * FROM examens_programmes WHERE id_region = ? ORDER BY date_examen DESC', [idRegion]);
    res.json({ success: true, list: rows });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

router.post('/examens/:id/status', requireAuth, requireRole('REGION'), async (req, res) => {
  try {
    const { statut } = req.body;
    await pool.query('UPDATE examens_programmes SET statut = ? WHERE id = ?', [statut, req.params.id]);
    const [rows] = await pool.query('SELECT * FROM examens_programmes WHERE id_region = ? ORDER BY date_examen DESC', [req.session.user.idRegion]);
    res.json({ success: true, list: rows });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

router.delete('/examens/:id', requireAuth, requireRole('REGION'), async (req, res) => {
  try {
    await pool.query('DELETE FROM examens_programmes WHERE id = ?', [req.params.id]);
    const [rows] = await pool.query('SELECT * FROM examens_programmes WHERE id_region = ? ORDER BY date_examen DESC', [req.session.user.idRegion]);
    res.json({ success: true, list: rows });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

// ============================================================================
// CANDIDATS ÉLIGIBLES POUR INSCRIPTION (AUTO_ECOLE)
// ============================================================================
router.get('/examens/:idExamen/eligibles', requireAuth, requireRole('AUTO_ECOLE'), async (req, res) => {
  try {
    const { idExamen } = req.params;
    const idAE = req.session.user.id;
    const [examRows] = await pool.query('SELECT * FROM examens_programmes WHERE id = ?', [idExamen]);
    if (!examRows.length) return res.json({ success: false, msg: 'Examen introuvable.' });
    const exam = examRows[0];
    const examType = String(exam.type_examen).trim();
    const examLabel = `${examType} ${fmtDateFR(exam.date_examen)}`;

    const [registered] = await pool.query('SELECT id_candidat FROM inscriptions_examens WHERE id_examen = ?', [idExamen]);
    const registeredIds = new Set(registered.map(r => r.id_candidat));

    let aptesLastCode = new Set();
    if (examType === 'Pratique (Conduite)') {
      const [codeExams] = await pool.query(
        `SELECT id FROM examens_programmes WHERE id_region = ? AND type_examen = 'Théorique (Code)' ORDER BY date_examen DESC`, [exam.id_region]
      );
      if (codeExams.length) {
        const [aptes] = await pool.query(`SELECT id_candidat FROM inscriptions_examens WHERE id_examen = ? AND validation_region = 'APTE'`, [codeExams[0].id]);
        aptesLastCode = new Set(aptes.map(a => a.id_candidat));
      }
    }
    const [cands] = await pool.query('SELECT * FROM candidats WHERE id_autoecole = ?', [idAE]);
    const [allInsc] = await pool.query('SELECT DISTINCT id_candidat FROM inscriptions_examens');
    const withHistory = new Set(allInsc.map(i => i.id_candidat));

    const eligible = cands.filter(c => {
      const st = String(c.statut_inscription).trim();
      if (examType === 'Théorique (Code)') {
        const fail = st.includes('Ajourné (Code)') || (st.includes('Code') && (st.includes('INAPTE')||st.includes('ABSENT')||st.includes('NON EVALUE'))) || ['INAPTE','ABSENT','NON EVALUE'].includes(st);
        return st === 'En attente' || st === 'En attente (Code)' || fail;
      }
      if (examType === 'Pratique (Conduite)') {
        const apteCode = aptesLastCode.has(c.id);
        const direct = (st === 'En attente (Conduite)' && !withHistory.has(c.id));
        const fail = st.includes('Ajourné (Conduite)') || (st.includes('Conduite') && (st.includes('INAPTE')||st.includes('ABSENT')||st.includes('NON EVALUE')));
        return apteCode || direct || fail;
      }
      return false;
    });

    const result = eligible.map(c => {
      let displayStatus = String(c.statut_inscription).trim();
      if (aptesLastCode.has(c.id)) displayStatus = 'Admis Dernier Code';
      return { id: c.id, nom: c.nom, piece: c.numero_piece, cat: cleanCat(c.categorie_permis), stGlobal: displayStatus, isRegistered: registeredIds.has(c.id), examStr: examLabel };
    });
    res.json({ success: true, list: result, examLabel });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

// ============================================================================
// EXAMENS DÉLIBÉRÉS — uniquement les examens ayant au moins un candidat délibéré
// ============================================================================
router.get('/examens/deliberes', requireAuth, requireRole('REGION', 'SUPER_ADMIN'), async (req, res) => {
  try {
    const idRegion = req.session.user.idRegion;
    const [rows] = await pool.query(
      `SELECT e.* FROM examens_programmes e
       WHERE e.id_region = ?
         AND EXISTS (
           SELECT 1 FROM inscriptions_examens ins
           WHERE ins.id_examen = e.id
             AND ins.validation_region IN ('APTE','INAPTE','ABSENT','NON EVALUE')
         )
       ORDER BY e.date_examen DESC`,
      [idRegion]
    );
    res.json({ success: true, list: rows });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

// ============================================================================
// EXAMENS DÉLIBÉRÉS pour une AUTO-ÉCOLE (filtre par AE + candidats délibérés)
// ============================================================================
router.get('/examens/deliberes-ae', requireAuth, requireRole('AUTO_ECOLE'), async (req, res) => {
  try {
    const idAE = req.session.user.id;
    const [rows] = await pool.query(
      `SELECT DISTINCT e.* FROM examens_programmes e
       JOIN inscriptions_examens ins ON ins.id_examen = e.id
       JOIN candidats c ON ins.id_candidat = c.id
       WHERE c.id_autoecole = ?
         AND ins.validation_region IN ('APTE','INAPTE','ABSENT','NON EVALUE')
       ORDER BY e.date_examen DESC`,
      [idAE]
    );
    res.json({ success: true, list: rows });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

// ============================================================================
// INSCRIPTIONS - Enregistrer des candidats à un examen (AUTO_ECOLE)
// ============================================================================
router.post('/examens/:idExamen/inscrire', requireAuth, requireRole('AUTO_ECOLE'), async (req, res) => {
  try {
    const { idExamen } = req.params;
    const { candidatIds } = req.body;
    if (!Array.isArray(candidatIds) || !candidatIds.length) return res.json({ success: false, msg: 'Aucun candidat.' });
    const [examRows] = await pool.query('SELECT * FROM examens_programmes WHERE id = ?', [idExamen]);
    const exam = examRows[0];
    if (!exam) return res.json({ success: false, msg: 'Examen introuvable.' });
    const examLabel = `${exam.type_examen} ${fmtDateFR(exam.date_examen)}`;
    const isRajout = String(exam.statut).trim() === 'rajout';

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      for (const cId of candidatIds) {
        const inscId = randId('INS');
        await conn.query(
          `INSERT INTO inscriptions_examens (id, id_candidat, id_examen, date_inscription, resultat, validation_region)
           VALUES (?, ?, ?, datetime('now','localtime'), ?, '')`,
          [inscId, cId, idExamen, isRajout ? 'En attente (Rajout)' : 'En attente']
        );
        await conn.query('UPDATE candidats SET statut_inscription = ? WHERE id = ?', [`Envoyé pour (${examLabel})${isRajout ? ' [Rajout]' : ''}`, cId]);
      }
      await conn.commit();
    } catch (err) { await conn.rollback(); throw err; } finally { conn.release(); }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

// ============================================================================
// SALLE D'EXAMEN - Liste des candidats d'un examen (REGION)
// ============================================================================
router.get('/examens/:idExamen/candidats', requireAuth, requireRole('REGION', 'STTC'), async (req, res) => {
  try {
    const { idExamen } = req.params;
    const [rows] = await pool.query(
      `SELECT ins.id AS id_insc, ins.resultat, ins.validation_region,
              c.id AS id_candidat, c.nom, c.numero_piece, c.categorie_permis,
              ae.nom AS auto_ecole
       FROM inscriptions_examens ins
       JOIN candidats c ON ins.id_candidat = c.id
       JOIN auto_ecoles ae ON c.id_autoecole = ae.id
       WHERE ins.id_examen = ? ORDER BY c.nom`, [idExamen]
    );
    const list = rows.map(r => ({
      idInsc: r.id_insc,
      nomPrenoms: r.nom,
      piece: r.numero_piece,
      cat: cleanCat(r.categorie_permis),
      autoEcole: r.auto_ecole,
      // statut validation bordereau
      statut: r.resultat === 'Validé' ? (r.validation_region || 'Validé') : 'En attente',
      resultat: r.validation_region || '',
      permisRetire: r.validation_region === 'Permis retiré' ? 'Retire' : ''
    }));
    res.json({ success: true, list });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

// Valider une inscription (region approuve le bordereau)
router.post('/inscriptions/:idInsc/valider', requireAuth, requireRole('REGION'), async (req, res) => {
  try {
    const [inscRows] = await pool.query(
      `SELECT ins.id_candidat, e.type_examen, e.date_examen FROM inscriptions_examens ins JOIN examens_programmes e ON ins.id_examen = e.id WHERE ins.id = ?`, [req.params.idInsc]
    );
    if (!inscRows.length) return res.json({ success: false, msg: 'Inscription introuvable.' });
    const insc = inscRows[0];
    const examLabel = `${insc.type_examen} ${fmtDateFR(insc.date_examen)}`;
    await pool.query('UPDATE inscriptions_examens SET resultat = ?, validation_region = ? WHERE id = ?', ['Validé', 'APTE', req.params.idInsc]);
    await pool.query('UPDATE candidats SET statut_inscription = ? WHERE id = ?', [`Validé (${examLabel})`, insc.id_candidat]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

router.post('/examens/:idExamen/valider-tout', requireAuth, requireRole('REGION'), async (req, res) => {
  try {
    const { idExamen } = req.params;
    const [examRows] = await pool.query('SELECT type_examen, date_examen FROM examens_programmes WHERE id = ?', [idExamen]);
    if (!examRows.length) return res.json({ success: false, msg: 'Examen introuvable.' });
    const examLabel = `${examRows[0].type_examen} ${fmtDateFR(examRows[0].date_examen)}`;
    const [attente] = await pool.query(
      `SELECT ins.id_candidat FROM inscriptions_examens ins WHERE ins.id_examen = ? AND ins.resultat = 'En attente'`, [idExamen]
    );
    await pool.query('UPDATE inscriptions_examens SET resultat = ?, validation_region = ? WHERE id_examen = ? AND resultat = ?', ['Validé', 'APTE', idExamen, 'En attente']);
    for (const a of attente) await pool.query('UPDATE candidats SET statut_inscription = ? WHERE id = ?', [`Validé (${examLabel})`, a.id_candidat]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

// Sauvegarder les résultats de délibération (bulk)
router.post('/examens/:idExamen/deliberer', requireAuth, requireRole('REGION'), async (req, res) => {
  try {
    const { results } = req.body;
    const [examRows] = await pool.query('SELECT type_examen, date_examen FROM examens_programmes WHERE id = ?', [req.params.idExamen]);
    if (!examRows.length) return res.json({ success: false, msg: 'Examen introuvable.' });
    const exam = examRows[0];
    const examLabel = `${exam.type_examen} ${fmtDateFR(exam.date_examen)}`;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      for (const item of results) {
        await conn.query('UPDATE inscriptions_examens SET validation_region = ?, resultat = ? WHERE id = ?', [item.result, 'Validé', item.idInsc]);
        const [c] = await conn.query('SELECT id_candidat FROM inscriptions_examens WHERE id = ?', [item.idInsc]);
        if (c[0]) {
          let newStatus;
          if (exam.type_examen === 'Théorique (Code)') newStatus = item.result === 'APTE' ? `APTE (${examLabel})` : 'Ajourné (Code)';
          else newStatus = item.result === 'APTE' ? 'APTE' : 'Ajourné (Conduite)';
          await conn.query('UPDATE candidats SET statut_inscription = ? WHERE id = ?', [newStatus, c[0].id_candidat]);
        }
      }
      await conn.commit();
    } catch (err) { await conn.rollback(); throw err; } finally { conn.release(); }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

router.post('/inscriptions/:idInsc/reset', requireAuth, requireRole('REGION'), async (req, res) => {
  try {
    const [inscRows] = await pool.query(
      `SELECT ins.id_candidat, e.type_examen, e.date_examen FROM inscriptions_examens ins JOIN examens_programmes e ON ins.id_examen = e.id WHERE ins.id = ?`, [req.params.idInsc]
    );
    if (!inscRows.length) return res.json({ success: false, msg: 'Introuvable.' });
    const insc = inscRows[0];
    const examLabel = `${insc.type_examen} ${fmtDateFR(insc.date_examen)}`;
    await pool.query('UPDATE inscriptions_examens SET validation_region = ?, resultat = ? WHERE id = ?', ['', 'Validé', req.params.idInsc]);
    await pool.query('UPDATE candidats SET statut_inscription = ? WHERE id = ?', [`Validé (${examLabel})`, insc.id_candidat]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

router.delete('/inscriptions/:idInsc', requireAuth, requireRole('REGION'), async (req, res) => {
  try {
    const [inscRows] = await pool.query(
      `SELECT ins.id_candidat, e.type_examen FROM inscriptions_examens ins JOIN examens_programmes e ON ins.id_examen = e.id WHERE ins.id = ?`, [req.params.idInsc]
    );
    if (!inscRows.length) return res.json({ success: false, msg: 'Introuvable.' });
    const insc = inscRows[0];
    await pool.query('DELETE FROM inscriptions_examens WHERE id = ?', [req.params.idInsc]);
    const resetStatus = String(insc.type_examen).includes('Code') ? 'En attente (Code)' : 'En attente (Conduite)';
    await pool.query('UPDATE candidats SET statut_inscription = ? WHERE id = ?', [resetStatus, insc.id_candidat]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

// ============================================================================
// REMISE DE PERMIS (AGENT)
// ============================================================================
router.post('/inscriptions/:idInsc/permis', requireAuth, requireRole('AGENT'), async (req, res) => {
  try {
    const [inscRows] = await pool.query('SELECT id_candidat FROM inscriptions_examens WHERE id = ?', [req.params.idInsc]);
    if (!inscRows.length) return res.json({ success: false, msg: 'Inscription introuvable.' });
    await pool.query('UPDATE inscriptions_examens SET validation_region = ? WHERE id = ?', ['Permis retiré', req.params.idInsc]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

// ============================================================================
// IMPORT CSV de candidats vers un examen (REGION) — accès à TOUTES les AE
// Crée les candidats + inscriptions directement validées.
// ============================================================================
router.post('/examens/:idExamen/import', requireAuth, requireRole('REGION'), async (req, res) => {
  try {
    const { idExamen } = req.params;
    const { idAE, candidats } = req.body; // [{ nomPrenoms, piece, cat }]
    if (!Array.isArray(candidats) || !candidats.length) return res.json({ success: false, msg: 'Aucun candidat à importer.' });
    const [examRows] = await pool.query('SELECT type_examen, date_examen FROM examens_programmes WHERE id = ?', [idExamen]);
    if (!examRows.length) return res.json({ success: false, msg: 'Examen introuvable.' });
    const examLabel = `${examRows[0].type_examen} ${fmtDateFR(examRows[0].date_examen)}`;

    let imported = 0;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      for (const c of candidats) {
        const newCandId = randId('CAN', 6);
        // Nettoyer la catégorie comme l'ancien code : retirer "Catégorie" et trimmer
        let cat = String(c.cat || 'ABCDE').replace(/Catégorie/i, '').trim();
        if (!cat) cat = 'ABCDE';
        await conn.query(
          `INSERT INTO candidats (id, id_autoecole, nom, prenoms, numero_piece, categorie_permis, telephone, date_inscription, statut_inscription)
           VALUES (?, ?, ?, '', ?, ?, '', datetime('now','localtime'), ?)`,
          [newCandId, idAE, c.nomPrenoms, c.piece, cat, `Validé (${examLabel})`]
        );
        const newInscId = randId('INS', 6);
        await conn.query(
          `INSERT INTO inscriptions_examens (id, id_candidat, id_examen, date_inscription, resultat, validation_region)
           VALUES (?, ?, ?, datetime('now','localtime'), 'Validé', 'Validé')`,
          [newInscId, newCandId, idExamen]
        );
        imported++;
      }
      await conn.commit();
    } catch (err) { await conn.rollback(); throw err; } finally { conn.release(); }

    let msg = `${imported} candidat(s) importé(s) avec succès.`;
    res.json({ success: true, msg });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

module.exports = router;
