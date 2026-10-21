// ============================================================================
//  SIGEXPC - Journal de sécurité (audit log)
//  Enregistre : tentatives de connexion, connexions réussies, déconnexions,
//  comptes bloqués, créations/suppressions de comptes, mots de passe modifiés.
//  Fire-and-forget : une erreur de journal ne doit JAMAIS bloquer une requête.
// ============================================================================
const pool = require('./db');

// Types d'événements (libellés côté client)
const TYPES = {
  CONNEXION_REUSSIE: 'Connexion réussie',
  CONNEXION_ECHOUEE: 'Connexion échouée',
  DECONNEXION: 'Déconnexion',
  COMPTE_BLOQUE: 'Compte bloqué',
  COMPTE_REACTIVE: 'Compte réactivé',
  COMPTE_CREE: 'Compte créé',
  COMPTE_SUPPRIME: 'Compte supprimé',
  MOT_DE_PASSE_MODIFIE: 'Mot de passe modifié',
  ACCES_REFUSE: 'Accès refusé'
};

// Extrait l'IP réelle (derrière proxy/CDN) et l'agent utilisateur
function contexte(req) {
  let ip = '';
  if (req) {
    const fwd = req.headers && req.headers['x-forwarded-for'];
    ip = (fwd ? String(fwd).split(',')[0].trim() : (req.socket && req.socket.remoteAddress) || '');
  }
  const ua = req && req.headers ? String(req.headers['user-agent'] || '').slice(0, 280) : '';
  return { ip: String(ip).slice(0, 55), ua };
}

/**
 * Enregistre un événement dans le journal de sécurité.
 * @param {object} e { type, role, utilisateur, identifiant, req, details }
 */
function journaliser(e) {
  try {
    const { ip, ua } = contexte(e.req);
    pool.query(
      `INSERT INTO journal_securite (type, role, utilisateur, identifiant, ip, user_agent, details)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [e.type || '', e.role || '', e.utilisateur || '', e.identifiant || '', ip, ua, e.details || '']
    ).catch(err => console.error('Journal écriture:', err.message));
  } catch (err) {
    console.error('Journal:', err.message);
  }
}

module.exports = { journaliser, TYPES };
