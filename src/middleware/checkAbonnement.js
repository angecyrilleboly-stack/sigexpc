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

  // Auto-marquer l'AE comme 'inactif' (abonnement expiré) en DB si expirée.
  // IMPORTANT : on utilise 'inactif' (expiration automatique) et NON 'bloque'
  // qui est réservé au blocage MANUEL par le super admin.
  if (blocked && aes.length && aes[0].statut === 'actif') {
    try {
      await pool.query("UPDATE auto_ecoles SET statut = 'inactif' WHERE id = ?", [idAE]);
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

module.exports = { requireActiveAbonnement, checkAboAE, invalidateAboCache };
