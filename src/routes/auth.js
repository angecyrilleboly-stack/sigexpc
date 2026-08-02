// ============================================================================
//  SIGEXPC - Routes d'authentification (adapté au schéma Excel réel)
// ============================================================================
const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const pool = require('../config/db');

// Configuration des tables par rôle (fidèle au fichier Excel d'origine)
const ROLE_CONFIG = {
  SUPER_ADMIN: {
    table: 'super_admins',
    emailCol: 'email', passCol: 'code_acces',
    idCol: 'id', nameCol: 'nom'
  },
  REGION: {
    table: 'directions_regionales',
    emailCol: 'admin_email', passCol: 'mot_de_passe',
    idCol: 'id', nameCol: 'nom_region', regionCol: 'id'
  },
  AGENT: {
    table: 'agents_verificateurs',
    emailCol: 'email', passCol: 'code_acces',
    idCol: 'id', nameCol: 'nom', regionCol: 'id_region'
  },
  STTC: {
    table: 'sttc_users',
    emailCol: 'email', passCol: 'code',
    idCol: 'id', nameCol: 'nom', regionCol: 'id_region'
  },
  AUTO_ECOLE: {
    table: 'auto_ecoles',
    emailCol: 'email_admin', passCol: 'mot_de_passe',
    idCol: 'id', nameCol: 'nom', regionCol: 'id_region'
  }
};

// Vérifie un mot de passe : bcrypt OU texte brut (compatible données migrées)
async function checkPass(input, stored) {
  if (!stored) return false;
  if (String(stored).startsWith('$2')) return bcrypt.compare(input, stored);
  return input === String(stored);
}

// ----------------------------------------------------------------------------
// POST /api/auth/login
// ----------------------------------------------------------------------------
router.post('/login', async (req, res) => {
  try {
    const { email, motDePasse, role } = req.body;
    if (!email || !motDePasse || !role) {
      return res.status(400).json({ success: false, error: 'Email, mot de passe et rôle sont obligatoires.' });
    }
    const cfg = ROLE_CONFIG[role];
    if (!cfg) return res.status(400).json({ success: false, error: 'Rôle invalide.' });

    // Recherche dans la table principale
    const [rows] = await pool.query(
      `SELECT * FROM ${cfg.table} WHERE LOWER(${cfg.emailCol}) = ? LIMIT 1`,
      [String(email).trim().toLowerCase()]
    );
    let row = rows[0];

    // AUTO_ECOLE : chercher aussi dans le staff
    if (role === 'AUTO_ECOLE' && !row) {
      const [staffRows] = await pool.query(
        `SELECT s.*, ae.id_region, ae.statut AS ae_statut FROM auto_ecoles_staff s
         JOIN auto_ecoles ae ON s.id_ae = ae.id
         WHERE LOWER(s.email) = ? LIMIT 1`,
        [String(email).trim().toLowerCase()]
      );
      if (staffRows[0]) {
        const s = staffRows[0];
        if (!(await checkPass(motDePasse, s.code))) {
          return res.json({ success: false, msg: 'Identifiants incorrects.' });
        }
        // AE bloquée par admin OU abonnement expiré (inactif)
        if (s.ae_statut === 'bloque' || s.ae_statut === 'inactif') {
          try {
            const [p] = await pool.query('SELECT montant FROM parametres_abonnement ORDER BY id DESC LIMIT 1');
            const montant = Number(p[0]?.montant) || 200;
            return res.json({ success: false, isBlocked: true, aeName: s.nom, aeId: s.id_ae, montant });
          } catch (e) {
            return res.json({ success: false, isBlocked: true, aeName: s.nom, aeId: s.id_ae, montant: 200 });
          }
        }
        const user = {
          id: s.id_ae, staffId: s.id, nom: s.nom,
          role: 'AUTO_ECOLE', idRegion: s.id_region || '',
          isMain: false, subRole: s.role
        };
        req.session.user = user;
        return res.json({ success: true, user });
      }
    }

    if (!row) return res.json({ success: false, msg: 'Identifiants incorrects.' });
    if (!(await checkPass(motDePasse, row[cfg.passCol]))) {
      return res.json({ success: false, msg: 'Identifiants incorrects.' });
    }

    // AUTO_ECOLE bloquée ? (bloque = par admin, inactif = abonnement expiré)
    // Récupérer le montant dynamique pour l'afficher
    if (role === 'AUTO_ECOLE' && (row.statut === 'bloque' || row.statut === 'inactif')) {
      try {
        const [p] = await pool.query('SELECT montant FROM parametres_abonnement ORDER BY id DESC LIMIT 1');
        const montant = Number(p[0]?.montant) || 200;
        return res.json({ success: false, isBlocked: true, aeName: row[cfg.nameCol], aeId: row[cfg.idCol], montant });
      } catch(e) {
        return res.json({ success: false, isBlocked: true, aeName: row[cfg.nameCol], aeId: row[cfg.idCol], montant: 200 });
      }
    }

    const user = {
      id: row[cfg.idCol],
      nom: row[cfg.nameCol],
      role,
      idRegion: cfg.regionCol ? row[cfg.regionCol] : '',
      isMain: role === 'AUTO_ECOLE',
      subRole: role === 'AUTO_ECOLE' ? 'GERANT' : null
    };
    req.session.user = user;
    req.session.save((err) => {
      if (err) {
        console.error('Erreur save session:', err);
        return res.status(500).json({ success: false, error: 'Erreur de session: ' + err.message });
      }
      res.json({ success: true, user });
    });
  } catch (err) {
    console.error('Erreur login:', err);
    res.status(500).json({ success: false, error: 'Erreur serveur: ' + err.message });
  }
});

// ----------------------------------------------------------------------------
router.get('/me', (req, res) => {
  if (!req.session || !req.session.user) return res.json({ success: false });
  res.json({ success: true, user: req.session.user });
});

// ----------------------------------------------------------------------------
router.post('/logout', (req, res) => {
  req.session.destroy(() => { res.clearCookie('sigexpc_sid'); res.json({ success: true }); });
});

// ----------------------------------------------------------------------------
// POST /api/auth/password - Changer le mot de passe (AUTO_ECOLE)
// ----------------------------------------------------------------------------
router.post('/password', async (req, res) => {
  try {
    const u = req.session && req.session.user;
    if (!u) return res.status(401).json({ success: false, msg: 'Non connecté.' });
    const { oldPass, newPass, isMain, staffId, id } = req.body;

    if (isMain) {
      const [rows] = await pool.query('SELECT * FROM auto_ecoles WHERE id = ? LIMIT 1', [id]);
      if (!rows.length) return res.json({ success: false, msg: 'Utilisateur introuvable.' });
      if (!(await checkPass(oldPass, rows[0].mot_de_passe))) {
        return res.json({ success: false, msg: "L'ancien mot de passe est incorrect." });
      }
      const hash = await bcrypt.hash(newPass, 10);
      await pool.query('UPDATE auto_ecoles SET mot_de_passe = ? WHERE id = ?', [hash, id]);
    } else {
      const [rows] = await pool.query('SELECT * FROM auto_ecoles_staff WHERE id = ? LIMIT 1', [staffId]);
      if (!rows.length) return res.json({ success: false, msg: 'Utilisateur introuvable.' });
      if (!(await checkPass(oldPass, rows[0].code))) {
        return res.json({ success: false, msg: "L'ancien mot de passe est incorrect." });
      }
      const hash = await bcrypt.hash(newPass, 10);
      await pool.query('UPDATE auto_ecoles_staff SET code = ? WHERE id = ?', [hash, staffId]);
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, msg: err.message }); }
});

module.exports = router;
