// ============================================================================
//  SIGEXPC - Job d'envoi des rappels d'expiration d'abonnement (J-3)
//  Scanne les abonnements qui expirent dans X jours et envoie un email.
// ============================================================================
const pool = require('../config/db');
const { sendRappelExpiration, isMailConfigured } = require('../config/mailer');

function fmtDateFR(d) {
  const dt = new Date(d);
  if (isNaN(dt)) return String(d);
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
}

// Scanne toutes les AE et envoie un rappel à celles qui expirent dans `seuilJours` jours
async function envoyerRappelsExpiration(seuilJours) {
  seuilJours = seuilJours || parseInt(process.env.RAPPEL_JOURS) || 3;
  const maintenant = new Date();
  const limite = new Date(maintenant);
  limite.setDate(limite.getDate() + seuilJours);

  // Date au format YYYY-MM-DD pour comparer
  const limiteStr = limite.toISOString().slice(0, 10);
  const maintenantStr = maintenant.toISOString().slice(0, 10);

  // Récupère les AE actives dont l'abonnement expire dans `seuilJours` jours
  const [rows] = await pool.query(`
    SELECT ae.id, ae.nom, ae.email_admin, abo.date_fin
    FROM auto_ecoles ae
    JOIN abonnements_auto_ecoles abo ON abo.id_ae = ae.id
    WHERE ae.statut = 'actif'
      AND abo.statut = 'actif'
      AND DATE(abo.date_fin) = ?
    ORDER BY ae.nom
  `, [limiteStr]);

  console.log(`📧 [Rappel J-${seuilJours}] ${rows.length} auto-école(s) à rappeler.`);

  let envoyes = 0;
  for (const ae of rows) {
    if (!ae.email_admin) continue;
    try {
      await sendRappelExpiration({
        to: ae.email_admin,
        aeNom: ae.nom,
        joursRestants: seuilJours,
        dateFin: fmtDateFR(ae.date_fin)
      });
      envoyes++;
    } catch (e) {
      console.error(`Erreur envoi rappel à ${ae.email_admin}:`, e.message);
    }
  }

  console.log(`✅ ${envoyes} rappel(s) envoyé(s).`);
  return { total: rows.length, envoyes };
}

// Démarre le job automatique : vérifie tous les jours à 08h00 (et au démarrage)
let _intervalId = null;
function demarrerJobRappel() {
  // Lancer une fois au démarrage (après un délai pour laisser la DB s'initialiser)
  setTimeout(async () => {
    try {
      if (isMailConfigured()) {
        console.log('📧 Vérification initiale des rappels d\'abonnement...');
        await envoyerRappelsExpiration();
      } else {
        console.log('📧 SMTP non configuré - les rappels d\'abonnement sont désactivés. Configurez SMTP_* dans .env');
      }
    } catch (e) {
      console.error('Erreur job rappel initial:', e.message);
    }
  }, 10000); // 10s après le démarrage

  // Puis vérifier toutes les 24h
  _intervalId = setInterval(async () => {
    try {
      if (isMailConfigured()) {
        await envoyerRappelsExpiration();
      }
    } catch (e) {
      console.error('Erreur job rappel périodique:', e.message);
    }
  }, 24 * 60 * 60 * 1000); // 24h
}

function arreterJobRappel() {
  if (_intervalId) clearInterval(_intervalId);
}

module.exports = { envoyerRappelsExpiration, demarrerJobRappel, arreterJobRappel };
