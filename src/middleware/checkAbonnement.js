// ============================================================================
//  SIGEXPC - Middleware de vérification d'abonnement pour les AUTO_ECOLES
//  Bloque l'accès d'une AE dont l'abonnement a expiré (même en cours de session)
// ============================================================================
const pool = require('../config/db');

// Cache mémoire court (30s) pour éviter de requêter la DB à chaque appel
const _cache = new Map(); // clé: idAE -> { exp, blocked, montant }
const CACHE_TTL = 30 * 1000; // 30 secondes

// Vérifie si une AE a son abonnement actif.
// Renvoie { blocked: boolean, montant: number }
async function checkAboAE(idAE) {
  // Cache
  const cached = _cache.get(idAE);
  const now = Date.now();
  if (cached && cached.exp > now) return cached;

  // Récupère le statut déclaré de l'AE + la dernière période d'abonnement
  const [aes] = await pool.query('SELECT statut FROM auto_ecoles WHERE id = ? LIMIT 1', [idAE]);
  const [abos] = await pool.query(
    'SELECT date_fin, statut FROM abonnements_auto_ecoles WHERE id_ae = ? ORDER BY date_fin DESC LIMIT 1', [idAE]
  );
  const [params] = await pool.query('SELECT montant FROM parametres_abonnement ORDER BY id DESC LIMIT 1');
  const montant = Number(params[0]?.montant) || 200;

  let blocked = true;
  const nowDt = new Date();
  if (aes.length && aes[0].statut === 'actif' && abos.length) {
    const fin = new Date(abos[0].date_fin);
    // Actif seulement si date_fin dans le futur ET statut actif
    blocked = !(abos[0].statut === 'actif' && fin > nowDt);
  }

  // Auto-marquer l'AE comme 'bloque' en DB si son abonnement a expiré.
  // Une AE bloquée ne peut être réactivée QUE par :
  //   1. Le super admin (bouton Réactiver dans le panel Abonnements)
  //   2. Le paiement d'un nouvel abonnement (GeniusPay)
  if (blocked && aes.length && aes[0].statut === 'actif') {
    try {
      await pool.query("UPDATE auto_ecoles SET statut = 'bloque' WHERE id = ?", [idAE]);
    } catch (e) { /* non bloquant */ }
  }

  const result = { blocked, montant, exp: now + CACHE_TTL };
  _cache.set(idAE, result);
  return result;
}

// Middleware Express : bloque les AE dont l'abonnement a expiré
function requireActiveAbonnement(req, res, next) {
  const u = req.session && req.session.user;
  if (!u) return next(); // requireAuth gère l'auth
  if (u.role !== 'AUTO_ECOLE') return next(); // les autres rôles ne sont pas concernés

  checkAboAE(u.id).then(({ blocked, montant }) => {
    if (blocked) {
      // Détruire la session pour forcer une reconnexion (sur /autoecole)
      req.session.destroy(() => {});
      return res.status(402).json({
        success: false,
        abonnementExpire: true,
        isBlocked: true,
        aeId: u.id,
        aeName: u.nom,
        montant,
        error: 'Abonnement expiré. Veuillez régulariser votre situation.'
      });
    }
    next();
  }).catch(() => next()); // en cas d'erreur DB, on laisse passer (ne pas bloquer par défaut)
}

// Invalide le cache pour une AE (à appeler après paiement/réactivation)
function invalidateAboCache(idAE) {
  _cache.delete(idAE);
}

// ============================================================================
// Scan global : passe toutes les AE expirées à 'bloque'
// À appeler au démarrage du serveur + périodiquement.
// ============================================================================
async function scannerEtBloquerAExpirées() {
  try {
    // Trouver toutes les AE actives dont l'abonnement a expiré (date_fin dépassée)
    const [expirees] = await pool.query(`
      SELECT ae.id, ae.nom, abo.date_fin
      FROM auto_ecoles ae
      JOIN abonnements_auto_ecoles abo ON abo.id_ae = ae.id
      WHERE ae.statut = 'actif'
        AND abo.statut = 'actif'
        AND abo.date_fin < ?
    `, [new Date().toISOString().slice(0, 19).replace('T', ' ')]);

    if (expirees.length === 0) return 0;

    // Bloquer chaque AE expirée + marquer son abonnement comme expiré
    for (const ae of expirees) {
      try {
        await pool.query("UPDATE auto_ecoles SET statut = 'bloque' WHERE id = ?", [ae.id]);
        await pool.query("UPDATE abonnements_auto_ecoles SET statut = 'expire' WHERE id_ae = ? AND statut = 'actif'", [ae.id]);
        _cache.delete(ae.id); // invalider le cache
      } catch (e) { /* non bloquant */ }
    }

    console.log(`🔒 ${expirees.length} auto-école(s) expirée(s) bloquée(s) automatiquement.`);
    return expirees.length;
  } catch (e) {
    console.error('Erreur scan expiration:', e.message);
    return 0;
  }
}

module.exports = { requireActiveAbonnement, checkAboAE, invalidateAboCache, scannerEtBloquerAExpirées };
