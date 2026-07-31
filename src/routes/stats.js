// ============================================================================
//  SIGEXPC - Routes Statistiques, Dashboard & Analyse (TCD)
//  Adapté au schéma Excel réel (validation_region = résultat délibération)
// ============================================================================
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');

function fmtDateFR(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt)) return String(d);
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
}
function cleanCat(c) { return String(c || '').replace(/Catégorie/i, '').trim() || 'ABCDE'; }

// ============================================================================
// DONNÉES D'INITIALISATION DU DASHBOARD
// ============================================================================
router.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const { role, id, idRegion } = req.session.user;
    let stats = {};
    let exams = [];
    let inscriptions = [];

    if (role === 'SUPER_ADMIN') {
      const [[d]] = await pool.query('SELECT COUNT(*) c FROM directions_regionales');
      const [[a]] = await pool.query('SELECT COUNT(*) c FROM auto_ecoles');
      const [[c]] = await pool.query('SELECT COUNT(*) c FROM candidats');
      stats = { dir: d.c, ae: a.c, can: c.c };
    } else if (role === 'REGION') {
      const [[ae]] = await pool.query('SELECT COUNT(*) c FROM auto_ecoles WHERE id_region = ?', [idRegion]);
      const [[ag]] = await pool.query('SELECT COUNT(*) c FROM agents_verificateurs WHERE id_region = ?', [idRegion]);
      const [[can]] = await pool.query(
        `SELECT COUNT(DISTINCT c.id) c FROM candidats c JOIN auto_ecoles ae ON c.id_autoecole = ae.id WHERE ae.id_region = ?`,
        [idRegion]
      );
      stats = { ae: ae.c, ag: ag.c, can: can.c };
    } else if (role === 'AUTO_ECOLE') {
      const [[total]] = await pool.query('SELECT COUNT(*) c FROM candidats WHERE id_autoecole = ?', [id]);
      const [[valid]] = await pool.query(
        `SELECT COUNT(*) c FROM candidats WHERE id_autoecole = ? AND (statut_inscription LIKE 'Validé%' OR statut_inscription LIKE 'APTE%' OR statut_inscription LIKE 'Permis%' OR statut_inscription LIKE 'Admis%')`,
        [id]
      );
      stats = { total: total.c, valid: valid.c, attente: total.c - valid.c };
    } else if (role === 'AGENT' || role === 'STTC') {
      let regionId = idRegion;
      const [rows] = await pool.query(
        `SELECT COUNT(*) c FROM inscriptions_examens ins
         JOIN candidats c ON ins.id_candidat = c.id
         JOIN auto_ecoles ae ON c.id_autoecole = ae.id
         WHERE ae.id_region = ? AND ins.validation_region = 'APTE'`,
        [regionId]
      );
      const [rows2] = await pool.query(
        `SELECT COUNT(*) c FROM inscriptions_examens ins
         JOIN candidats c ON ins.id_candidat = c.id
         JOIN auto_ecoles ae ON c.id_autoecole = ae.id
         WHERE ae.id_region = ? AND ins.validation_region = 'Permis retiré'`,
        [regionId]
      );
      stats = { aptes: rows[0].c, retires: rows2[0].c };
    }

    // Examens (sauf SUPER_ADMIN)
    if (role !== 'SUPER_ADMIN') {
      let rid = idRegion;
      if (role === 'AUTO_ECOLE') {
        const [ae] = await pool.query('SELECT id_region FROM auto_ecoles WHERE id = ?', [id]);
        rid = ae[0] ? ae[0].id_region : '';
      }
      [exams] = await pool.query('SELECT * FROM examens_programmes WHERE id_region = ? ORDER BY date_examen DESC', [rid]);
      if (role === 'AGENT') {
        exams = exams.filter(e => String(e.type_examen).trim() === 'Pratique (Conduite)');
      }
    }

    // Inscriptions pour le tableau de consultation (tous rôles sauf SUPER_ADMIN)
    if (role !== 'SUPER_ADMIN') {
      if (role === 'AUTO_ECOLE') {
        [inscriptions] = await pool.query(
          `SELECT ins.id AS idInsc, ins.id_examen, ins.validation_region,
                  c.nom AS nomPrenoms, c.numero_piece AS piece, c.categorie_permis AS cat,
                  ae.nom AS autoEcole, e.type_examen, e.date_examen
           FROM inscriptions_examens ins
           JOIN candidats c ON ins.id_candidat = c.id
           JOIN auto_ecoles ae ON c.id_autoecole = ae.id
           JOIN examens_programmes e ON ins.id_examen = e.id
           WHERE c.id_autoecole = ?
           ORDER BY e.date_examen DESC, c.nom`,
          [id]
        );
      } else {
        // REGION ou AGENT : candidats de la région
        [inscriptions] = await pool.query(
          `SELECT ins.id AS idInsc, ins.id_examen, ins.validation_region,
                  c.nom AS nomPrenoms, c.numero_piece AS piece, c.categorie_permis AS cat,
                  ae.nom AS autoEcole, e.type_examen, e.date_examen
           FROM inscriptions_examens ins
           JOIN candidats c ON ins.id_candidat = c.id
           JOIN auto_ecoles ae ON c.id_autoecole = ae.id
           JOIN examens_programmes e ON ins.id_examen = e.id
           WHERE ae.id_region = ?
           ORDER BY e.date_examen DESC, c.nom`,
          [idRegion]
        );
      }
      // Mapper le statut d'affichage
      inscriptions = inscriptions.map(i => {
        let st = i.validation_region;
        if (!st || st === '') st = 'En attente';
        return {
          idInsc: i.idInsc, idExamen: i.id_examen,
          nomPrenoms: i.nomPrenoms, piece: i.piece,
          cat: cleanCat(i.cat), autoEcole: i.autoEcole,
          examLabel: `${i.type_examen} du ${fmtDateFR(i.date_examen)}`,
          statut: st
        };
      });
    }

    res.json({ success: true, stats, exams, inscriptions });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

// ============================================================================
// STATISTIQUES AVANCÉES (REGION)
// ============================================================================
router.get('/avancees', requireAuth, requireRole('REGION', 'SUPER_ADMIN'), async (req, res) => {
  try {
    const idRegion = req.session.user.idRegion;
    const [exams] = await pool.query('SELECT * FROM examens_programmes WHERE id_region = ? ORDER BY date_examen DESC', [idRegion]);
    const [aes] = await pool.query('SELECT * FROM auto_ecoles WHERE id_region = ?', [idRegion]);
    const regionAEIds = aes.map(a => a.id);

    const global = { apte_code: 0, apte_conduite: 0, inapte: 0, absent: 0, non_evalue: 0 };
    const examStats = {};
    exams.forEach(e => {
      examStats[e.id] = {
        label: `${e.type_examen} du ${fmtDateFR(e.date_examen)}`,
        type: String(e.type_examen).trim(),
        apte_code: 0, apte_conduite: 0, inapte: 0, absent: 0, non_evalue: 0
      };
    });
    const aeStats = {};
    aes.forEach(a => { aeStats[a.id] = { nom: a.nom, apte_code: 0, apte_conduite: 0 }; });

    const [insc] = await pool.query(
      `SELECT ins.id_examen, ins.validation_region, c.id_autoecole
       FROM inscriptions_examens ins JOIN candidats c ON ins.id_candidat = c.id
       WHERE ins.validation_region IN ('APTE','INAPTE','ABSENT','NON EVALUE')`
    );
    insc.forEach(i => {
      if (!regionAEIds.includes(i.id_autoecole)) return;
      const ex = examStats[i.id_examen];
      if (!ex) return;
      const r = i.validation_region;
      if (r === 'APTE') {
        if (ex.type.includes('Code')) { global.apte_code++; ex.apte_code++; if (aeStats[i.id_autoecole]) aeStats[i.id_autoecole].apte_code++; }
        else { global.apte_conduite++; ex.apte_conduite++; if (aeStats[i.id_autoecole]) aeStats[i.id_autoecole].apte_conduite++; }
      } else if (r === 'INAPTE') { global.inapte++; ex.inapte++; }
      else if (r === 'ABSENT') { global.absent++; ex.absent++; }
      else if (r === 'NON EVALUE') { global.non_evalue++; ex.non_evalue++; }
    });

    res.json({
      success: true,
      global,
      exams: exams.map(e => examStats[e.id]).filter(Boolean),
      aeStats: Object.values(aeStats).sort((a, b) => a.nom.localeCompare(b.nom))
    });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

// ============================================================================
// ANALYSE DE DONNÉES (TCD)
// ============================================================================
router.get('/analyse', requireAuth, async (req, res) => {
  try {
    const { role, id, idRegion } = req.session.user;
    let sql, params;
    if (role === 'AUTO_ECOLE') {
      sql = `SELECT e.date_examen AS d, e.type_examen AS type, ins.validation_region AS s, c.nom, c.numero_piece AS piece, c.categorie_permis AS cat,
                    ae.nom AS ae
             FROM inscriptions_examens ins
             JOIN candidats c ON ins.id_candidat = c.id
             JOIN auto_ecoles ae ON c.id_autoecole = ae.id
             JOIN examens_programmes e ON ins.id_examen = e.id
             WHERE c.id_autoecole = ? AND ins.validation_region IN ('APTE','INAPTE','ABSENT','NON EVALUE')`;
      params = [id];
    } else {
      sql = `SELECT e.date_examen AS d, e.type_examen AS type, ins.validation_region AS s, c.nom, c.numero_piece AS piece, c.categorie_permis AS cat,
                    ae.nom AS ae, dr.nom_region AS region
             FROM inscriptions_examens ins
             JOIN candidats c ON ins.id_candidat = c.id
             JOIN auto_ecoles ae ON c.id_autoecole = ae.id
             JOIN examens_programmes e ON ins.id_examen = e.id
             JOIN directions_regionales dr ON e.id_region = dr.id
             WHERE e.id_region = ? AND ins.validation_region IN ('APTE','INAPTE','ABSENT','NON EVALUE')`;
      params = [idRegion];
    }
    const [rows] = await pool.query(sql, params);
    const result = rows.map(r => ({
      d: r.d, s: r.s, nom: r.nom, piece: r.piece,
      cat: cleanCat(r.cat), ae: r.ae,
      exam: `${r.type} du ${fmtDateFR(r.d)}`,
      region: r.region || ''
    }));
    res.json({ success: true, list: result });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

// ============================================================================
// PERMIS RETIRÉS (AGENT)
// ============================================================================
router.get('/permis-retires', requireAuth, requireRole('AGENT'), async (req, res) => {
  try {
    const idRegion = req.session.user.idRegion;
    const [rows] = await pool.query(
      `SELECT c.nom, c.numero_piece AS piece, c.categorie_permis AS cat, ae.nom AS autoEcole
       FROM inscriptions_examens ins
       JOIN candidats c ON ins.id_candidat = c.id
       JOIN auto_ecoles ae ON c.id_autoecole = ae.id
       WHERE ins.validation_region = 'Permis retiré' AND ae.id_region = ?
       ORDER BY c.nom`,
      [idRegion]
    );
    const list = rows.map(r => ({ nomPrenoms: r.nom, piece: r.piece, cat: cleanCat(r.cat), autoEcole: r.autoEcole }));
    res.json({ success: true, list });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

// Liste des APTES en attente de remise (pour l'AGENT)
router.get('/permis-a-remettre', requireAuth, requireRole('AGENT'), async (req, res) => {
  try {
    const idRegion = req.session.user.idRegion;
    const [rows] = await pool.query(
      `SELECT ins.id AS idInsc, c.nom, c.numero_piece AS piece, c.categorie_permis AS cat, ae.nom AS autoEcole
       FROM inscriptions_examens ins
       JOIN candidats c ON ins.id_candidat = c.id
       JOIN auto_ecoles ae ON c.id_autoecole = ae.id
       JOIN examens_programmes e ON ins.id_examen = e.id
       WHERE ins.validation_region = 'APTE' AND e.type_examen LIKE '%Conduite%' AND ae.id_region = ?
       ORDER BY c.nom`,
      [idRegion]
    );
    const list = rows.map(r => ({ idInsc: r.idInsc, nomPrenoms: r.nom, piece: r.piece, cat: cleanCat(r.cat), autoEcole: r.autoEcole }));
    res.json({ success: true, list });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

// ============================================================================
// RESPONSABLES RÉGIONAUX (signataires)
// ============================================================================
router.get('/responsables', requireAuth, requireRole('REGION'), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM parametres_region WHERE id_region = ?', [req.session.user.idRegion]);
    res.json({ success: true, data: rows[0] || { chef_sttc: '', coordonnateur: '', directeur_regional: '' } });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

router.post('/responsables', requireAuth, requireRole('REGION'), async (req, res) => {
  try {
    const { chefSttc, coordonnateur, directeurRegional } = req.body;
    const idRegion = req.session.user.idRegion;
    await pool.query(
      `INSERT INTO parametres_region (id_region, chef_sttc, coordonnateur, directeur_regional)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (id_region) DO UPDATE SET
         chef_sttc = EXCLUDED.chef_sttc,
         coordonnateur = EXCLUDED.coordonnateur,
         directeur_regional = EXCLUDED.directeur_regional`,
      [idRegion, chefSttc, coordonnateur, directeurRegional]
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

module.exports = router;
