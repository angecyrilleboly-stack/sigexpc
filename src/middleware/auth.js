// ============================================================================
//  SIGEXPC - Middleware d'authentification (sessions)
// ============================================================================
const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  REGION: 'REGION',
  AUTO_ECOLE: 'AUTO_ECOLE',
  AGENT: 'AGENT',
  STTC: 'STTC'
};

// Vérifie qu'un utilisateur est connecté
function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ success: false, error: 'Non authentifié. Veuillez vous connecter.' });
  }
  next();
}

// Vérifie que l'utilisateur a l'un des rôles autorisés
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ success: false, error: 'Non authentifié.' });
    }
    if (!roles.includes(req.session.user.role)) {
      return res.status(403).json({ success: false, error: 'Accès refusé : permissions insuffisantes.' });
    }
    next();
  };
}

// Attache req.user pour simplifier les contrôleurs
function attachUser(req, res, next) {
  req.user = req.session && req.session.user ? req.session.user : null;
  next();
}

module.exports = { requireAuth, requireRole, attachUser, ROLES };
