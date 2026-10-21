// ============================================================================
//  SIGEXPC - Journal de sécurité : API de consultation (SUPER ADMIN uniquement)
//  GET /api/journal          -> événements paginés avec filtres
//  GET /api/journal/stats    -> compteurs par type (période)
// ============================================================================
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');

// Guard : SUPER_ADMIN uniquement
function requireSuperAdmin(req, res, next) {
  const u = req.session && req.session.user;
  if (!u || u.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ success: false, msg: 'Accès refusé : réservé au Super Admin.' });
  }
  next();
}

const TYPES_VALIDES = [
  'CONNEXION_REUSSIE', 'CONNEXION_ECHOUEE', 'DECONNEXION', 'COMPTE_BLOQUE',
  'COMPTE_REACTIVE', 'COMPTE_CREE', 'COMPTE_SUPPRIME', 'MOT_DE_PASSE_MODIFIE', 'ACCES_REFUSE'
];

// GET /api/journal?type=&q=&role=&periode=7&page=1&limit=25
router.get('/', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { type, q, role, periode } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(5, parseInt(req.query.limit) || 25));
    const offset = (page - 1) * limit;

    const where = [];
    const params = [];
    const add = (clause, valeur) => { params.push(valeur); where.push(clause.replace('?', '$' + params.length)); };

    if (type && TYPES_VALIDES.includes(type)) add('type = ?', type);
    if (role) add('role = ?', String(role));
    if (periode && ['1', '7', '30', '90'].includes(String(periode))) {
      add(`date_evenement >= CURRENT_TIMESTAMP - INTERVAL '${parseInt(periode)} days'`, parseInt(periode));
    }
    if (q) {
      const like = '%' + String(q).slice(0, 100) + '%';
      params.push(like); const p1 = '$' + params.length;
      params.push(like); const p2 = '$' + params.length;
      params.push(like); const p3 = '$' + params.length;
      params.push(like); const p4 = '$' + params.length;
      where.push(`(utilisateur ILIKE ${p1} OR identifiant ILIKE ${p2} OR ip ILIKE ${p3} OR details ILIKE ${p4})`);
    }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const [count] = await pool.query(`SELECT COUNT(*)::int AS total FROM journal_securite ${whereSql}`, params);
    const [rows] = await pool.query(
      `SELECT id, date_evenement, type, role, utilisateur, identifiant, ip, details
       FROM journal_securite ${whereSql}
       ORDER BY date_evenement DESC, id DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    res.json({
      success: true,
      total: count[0] ? count[0].total : 0,
      page,
      limit,
      events: rows
    });
  } catch (e) {
    console.error('Journal lecture:', e.message);
    res.status(500).json({ success: false, msg: e.message });
  }
});

// GET /api/journal/stats?periode=7 -> compteurs par type
router.get('/stats', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const periode = ['1', '7', '30', '90'].includes(String(req.query.periode)) ? parseInt(req.query.periode) : 7;
    const [rows] = await pool.query(
      `SELECT type, COUNT(*)::int AS n FROM journal_securite
       WHERE date_evenement >= CURRENT_TIMESTAMP - INTERVAL '${periode} days'
       GROUP BY type`
    );
    const stats = {};
    for (const r of rows) stats[r.type] = r.n;
    res.json({ success: true, periode, stats });
  } catch (e) {
    res.status(500).json({ success: false, msg: e.message });
  }
});

module.exports = router;
