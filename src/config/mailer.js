// ============================================================================
//  SIGEXPC - Module d'envoi d'emails (reçus + rappels d'abonnement)
// ============================================================================
const nodemailer = require('nodemailer');

let _transporter = null;

// Crée/configure le transporteur SMTP
function getTransporter() {
  if (_transporter) return _transporter;

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  // Si pas de config SMTP, on retourne null (les emails seront juste loggés)
  if (!host || !user || !pass || user.includes('votre.email')) {
    return null;
  }

  _transporter = nodemailer.createTransport({
    host: host,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user, pass }
  });

  return _transporter;
}

// Vérifie si le SMTP est configuré
function isMailConfigured() {
  return getTransporter() !== null;
}

// Envoie un email générique
async function sendMail(to, subject, html) {
  const transporter = getTransporter();
  const fromName = process.env.SMTP_FROM_NAME || 'SIGEXPC';
  const fromEmail = process.env.SMTP_FROM_EMAIL || 'noreply@sigexpc.ci';

  if (!transporter) {
    // Mode démo : pas de SMTP configuré, on logge juste
    console.log(`📧 [MAIL DEMO] À: ${to} | Sujet: ${subject}`);
    console.log(`   (Configurez SMTP_HOST/SMTP_USER/SMTP_PASS dans .env pour l'envoi réel)`);
    return { demo: true, to, subject };
  }

  const info = await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject,
    html
  });

  console.log(`✅ Email envoyé à ${to}: ${subject}`);
  return info;
}

// ============================================================================
//  REÇU DE PAIEMENT (envoyé après un paiement réussi)
// ============================================================================
async function sendRecuPaiement({ to, aeNom, montant, dateDebut, dateFin, numRecu }) {
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
  <body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f1f5f9;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
      <!-- En-tête -->
      <div style="background:linear-gradient(135deg,#1e3a8a,#3b82f6);padding:30px;text-align:center;">
        <div style="font-size:2.5rem;">🚦</div>
        <h1 style="color:#fff;margin:10px 0 5px;font-size:1.5rem;">SIGEXPC</h1>
        <p style="color:rgba(255,255,255,0.85);margin:0;font-size:0.85rem;">Reçu de paiement d'abonnement</p>
      </div>

      <!-- Corps -->
      <div style="padding:30px;">
        <div style="background:#dcfce7;border:1px solid #86efac;border-radius:10px;padding:15px;text-align:center;margin-bottom:25px;">
          <span style="font-size:1.8rem;">✅</span>
          <p style="color:#065f46;font-weight:700;margin:5px 0 0;font-size:1.1rem;">Paiement confirmé avec succès</p>
        </div>

        <p style="color:#475569;font-size:0.95rem;line-height:1.6;">Bonjour,</p>
        <p style="color:#475569;font-size:0.95rem;line-height:1.6;">Nous accusons réception de votre paiement d'abonnement à la plateforme <b>SIGEXPC</b>. Voici le détail de votre transaction :</p>

        <table style="width:100%;border-collapse:collapse;margin:20px 0;">
          <tr style="background:#f8fafc;"><td style="padding:10px 15px;border:1px solid #e2e8f0;color:#64748b;font-size:0.9rem;">Auto-école</td><td style="padding:10px 15px;border:1px solid #e2e8f0;font-weight:700;color:#0f172a;">${aeNom}</td></tr>
          <tr><td style="padding:10px 15px;border:1px solid #e2e8f0;color:#64748b;font-size:0.9rem;">N° Reçu</td><td style="padding:10px 15px;border:1px solid #e2e8f0;font-weight:700;color:#0f172a;font-family:monospace;">${numRecu}</td></tr>
          <tr><td style="padding:10px 15px;border:1px solid #e2e8f0;color:#64748b;font-size:0.9rem;">Montant payé</td><td style="padding:10px 15px;border:1px solid #e2e8f0;font-weight:700;color:#059669;font-size:1.1rem;">${montant.toLocaleString('fr-FR')} FCFA</td></tr>
          <tr><td style="padding:10px 15px;border:1px solid #e2e8f0;color:#64748b;font-size:0.9rem;">Période</td><td style="padding:10px 15px;border:1px solid #e2e8f0;font-weight:700;color:#0f172a;">Du ${dateDebut} au ${dateFin}</td></tr>
          <tr><td style="padding:10px 15px;border:1px solid #e2e8f0;color:#64748b;font-size:0.9rem;">Statut</td><td style="padding:10px 15px;border:1px solid #e2e8f0;"><span style="background:#dcfce7;color:#065f46;padding:4px 10px;border-radius:6px;font-weight:700;font-size:0.85rem;">ACTIF</span></td></tr>
        </table>

        <p style="color:#475569;font-size:0.95rem;line-height:1.6;">Votre abonnement est désormais actif. Vous pouvez vous reconnecter à la plateforme avec vos identifiants habituels.</p>

        <div style="text-align:center;margin:25px 0;">
          <a href="http://localhost:3000/autoecole" style="display:inline-block;background:linear-gradient(135deg,#1e3a8a,#3b82f6);color:#fff;text-decoration:none;padding:12px 30px;border-radius:10px;font-weight:700;font-size:0.95rem;">Se connecter à SIGEXPC</a>
        </div>

        <p style="color:#94a3b8;font-size:0.78rem;margin-top:20px;border-top:1px solid #e2e8f0;padding-top:15px;">Cet email est généré automatiquement, merci de ne pas y répondre. Conservez ce reçu pour vos archives.</p>
      </div>
    </div>
  </body></html>`;

  return sendMail(to, `Reçu de paiement SIGEXPC - ${aeNom}`, html);
}

// ============================================================================
//  RAPPEL D'EXPIRATION (envoyé J-X jours avant l'expiration)
// ============================================================================
async function sendRappelExpiration({ to, aeNom, joursRestants, dateFin }) {
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
  <body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f1f5f9;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
      <!-- En-tête -->
      <div style="background:linear-gradient(135deg,#b45309,#f59e0b);padding:30px;text-align:center;">
        <div style="font-size:2.5rem;">⏰</div>
        <h1 style="color:#fff;margin:10px 0 5px;font-size:1.5rem;">SIGEXPC</h1>
        <p style="color:rgba(255,255,255,0.9);margin:0;font-size:0.85rem;">Rappel d'expiration d'abonnement</p>
      </div>

      <!-- Corps -->
      <div style="padding:30px;">
        <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:10px;padding:15px;text-align:center;margin-bottom:25px;">
          <span style="font-size:1.8rem;">⚠️</span>
          <p style="color:#92400e;font-weight:700;margin:5px 0 0;font-size:1.1rem;">Il vous reste ${joursRestants} jour(s) d'abonnement</p>
        </div>

        <p style="color:#475569;font-size:0.95rem;line-height:1.6;">Bonjour,</p>
        <p style="color:#475569;font-size:0.95rem;line-height:1.6;">Nous vous informons que l'abonnement de l'auto-école <b>${aeNom}</b> à la plateforme <b>SIGEXPC</b> arrive à échéance.</p>

        <table style="width:100%;border-collapse:collapse;margin:20px 0;">
          <tr><td style="padding:10px 15px;border:1px solid #e2e8f0;color:#64748b;font-size:0.9rem;">Auto-école</td><td style="padding:10px 15px;border:1px solid #e2e8f0;font-weight:700;color:#0f172a;">${aeNom}</td></tr>
          <tr><td style="padding:10px 15px;border:1px solid #e2e8f0;color:#64748b;font-size:0.9rem;">Date d'expiration</td><td style="padding:10px 15px;border:1px solid #e2e8f0;font-weight:700;color:#dc2626;">${dateFin}</td></tr>
          <tr><td style="padding:10px 15px;border:1px solid #e2e8f0;color:#64748b;font-size:0.9rem;">Jours restants</td><td style="padding:10px 15px;border:1px solid #e2e8f0;font-weight:800;color:#b45309;font-size:1.2rem;">${joursRestants} jour(s)</td></tr>
        </table>

        <div style="background:#fef2f2;border-left:4px solid #dc2626;border-radius:8px;padding:15px;margin:20px 0;">
          <p style="color:#991b1b;font-size:0.9rem;line-height:1.6;margin:0;"><b>⚠️ Attention :</b> Passé ce délai, vous n'aurez plus accès à la plateforme SIGEXPC. Vos candidats, inscriptions et données ne seront plus accessibles tant que vous n'aurez pas régularisé votre abonnement.</p>
        </div>

        <p style="color:#475569;font-size:0.95rem;line-height:1.6;">Pour éviter toute interruption de service, nous vous invitons à renouveler votre abonnement dès maintenant.</p>

        <div style="text-align:center;margin:25px 0;">
          <a href="http://localhost:3000/autoecole" style="display:inline-block;background:linear-gradient(135deg,#b45309,#f59e0b);color:#fff;text-decoration:none;padding:12px 30px;border-radius:10px;font-weight:700;font-size:0.95rem;">Renouveler mon abonnement</a>
        </div>

        <p style="color:#94a3b8;font-size:0.78rem;margin-top:20px;border-top:1px solid #e2e8f0;padding-top:15px;">Cet email est un rappel automatique envoyé par SIGEXPC. Si vous avez déjà réglé votre abonnement, ignorez ce message.</p>
      </div>
    </div>
  </body></html>`;

  return sendMail(to, `⚠️ Rappel : votre abonnement SIGEXPC expire dans ${joursRestants} jour(s)`, html);
}

module.exports = { sendMail, sendRecuPaiement, sendRappelExpiration, isMailConfigured };
