// ============================================================================
//  SIGEXPC - Routes Abonnements & Reçus (adapté au schéma Excel réel)
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
function daysBetween(d1, d2) {
  return Math.ceil((new Date(d2) - new Date(d1)) / (1000 * 60 * 60 * 24));
}

// Statut d'abonnement d'une AE
async function getAboStatus(idAE) {
  const [rows] = await pool.query(
    'SELECT * FROM abonnements_auto_ecoles WHERE id_ae = ? ORDER BY date_fin DESC LIMIT 1', [idAE]
  );
  if (!rows.length) return { estActif: false, joursRestants: 0, dateFin: null };
  const abo = rows[0];
  const now = new Date();
  const fin = new Date(abo.date_fin);
  const estActif = abo.statut === 'actif' && fin > now;
  return { estActif, joursRestants: Math.max(0, daysBetween(now, fin)), dateFin: abo.date_fin };
}

// ============================================================================
// PARAMÈTRES D'ABONNEMENT
// ============================================================================
router.get('/params', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM parametres_abonnement ORDER BY id DESC LIMIT 1');
    const p = rows[0] || { montant: 15000, duree_jours: 30 };
    res.json({ success: true, montant: Number(p.montant), duree_jours: p.duree_jours });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

router.post('/params', requireAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    let { montant, dureeJours } = req.body;
    // Validation : s'assurer qu'on a des nombres valides (SQLite refuse null/undefined)
    montant = parseInt(montant);
    dureeJours = parseInt(dureeJours);
    if (!montant || montant <= 0) return res.status(400).json({ success: false, msg: 'Montant invalide. Veuillez saisir un nombre supérieur à 0.' });
    if (!dureeJours || dureeJours <= 0) return res.status(400).json({ success: false, msg: 'Durée invalide. Veuillez saisir un nombre de jours supérieur à 0.' });

    // Mettre à jour la ligne existante, ou l'insérer si elle n'existe pas encore
    const [exist] = await pool.query('SELECT id FROM parametres_abonnement ORDER BY id DESC LIMIT 1');
    if (exist.length) {
      await pool.query('UPDATE parametres_abonnement SET montant = ?, duree_jours = ?', [montant, dureeJours]);
    } else {
      await pool.query('INSERT INTO parametres_abonnement (montant, duree_jours) VALUES (?, ?)', [montant, dureeJours]);
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

// ============================================================================
// LISTE DE TOUTES LES AUTO-ÉCOLES (SUPER_ADMIN)
// ============================================================================
router.get('/liste', requireAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const [aes] = await pool.query(
      `SELECT ae.id, ae.nom, ae.email_admin, ae.telephone, ae.statut, ae.id_region,
              dr.nom_region
       FROM auto_ecoles ae
       LEFT JOIN directions_regionales dr ON ae.id_region = dr.id
       ORDER BY ae.nom`
    );
    const list = [];
    for (const ae of aes) {
      const abo = await getAboStatus(ae.id);
      list.push({
        id: ae.id,
        region: ae.nom_region || '—',
        nom: ae.nom,
        email: ae.email_admin,
        tel: ae.telephone,
        statut: ae.statut,
        joursRestants: abo.joursRestants,
        estActif: abo.estActif,
        dateFin: abo.dateFin ? fmtDateFR(abo.dateFin) : 'N/A'
      });
    }
    res.json({ success: true, list });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

// Activer / Bloquer une AE
router.post('/:idAE/toggle', requireAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const { newStatus } = req.body;
    const idAE = req.params.idAE;

    // 1. Mettre à jour le statut de l'AE
    await pool.query('UPDATE auto_ecoles SET statut = ? WHERE id = ?', [newStatus, idAE]);

    if (newStatus === 'actif') {
      // 2. Créer/mettre à jour l'abonnement
      const [params] = await pool.query('SELECT montant, duree_jours FROM parametres_abonnement ORDER BY id DESC LIMIT 1');
      const p = params[0] || { montant: 200, duree_jours: 30 };
      const now = new Date();
      const fin = new Date(now); fin.setDate(fin.getDate() + p.duree_jours);
      const nowStr = now.toISOString().slice(0, 19).replace('T', ' ');
      const finStr = fin.toISOString().slice(0, 19).replace('T', ' ');

      const [exist] = await pool.query('SELECT id FROM abonnements_auto_ecoles WHERE id_ae = ? ORDER BY id DESC LIMIT 1', [idAE]);
      if (exist.length) {
        await pool.query('UPDATE abonnements_auto_ecoles SET date_debut = ?, date_fin = ?, statut = ?, montant_paye = ? WHERE id = ?',
          [nowStr, finStr, 'actif', p.montant, exist[0].id]);
      } else {
        await pool.query('INSERT INTO abonnements_auto_ecoles (id_ae, date_debut, date_fin, statut, montant_paye) VALUES (?, ?, ?, ?, ?)',
          [idAE, nowStr, finStr, 'actif', p.montant]);
      }

      // 3. Créer un reçu
      const numRecu = `REC-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(idAE).replace('AE-', '')}`;
      const recuId = `REC-${Math.floor(Math.random() * 900000 + 100000)}`;
      await pool.query('INSERT INTO recus_paiement (id, id_ae, date_emission, montant, date_debut, date_fin, statut, num_recu) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [recuId, idAE, nowStr, p.montant, nowStr, finStr, 'actif', numRecu]);
    } else {
      // Bloquer : marquer l'abonnement comme expiré
      await pool.query('UPDATE abonnements_auto_ecoles SET statut = ? WHERE id_ae = ?', ['expire', idAE]);
    }

    // Invalider le cache d'abonnement pour cette AE
    try {
      const { invalidateAboCache } = require('../middleware/checkAbonnement');
      invalidateAboCache(idAE);
    } catch (e) { /* non bloquant */ }

    res.json({ success: true });
  } catch (e) {
    console.error('Erreur toggle abo:', e.message);
    res.status(500).json({ success: false, msg: e.message });
  }
});

// ============================================================================
// MON ABONNEMENT (AUTO_ECOLE)
// ============================================================================
// "Mon abonnement" : réservé au compte principal de l'auto-école
function requireMainAE(req, res, next) {
  const u = req.session && req.session.user;
  if (!u) return res.status(401).json({ success: false, msg: 'Non connecté.' });
  if (u.role !== 'AUTO_ECOLE' || !u.isMain) {
    return res.status(403).json({ success: false, msg: 'Accès refusé : réservé au compte principal de l\'auto-école.' });
  }
  next();
}

router.get('/mon-abonnement', requireAuth, requireRole('AUTO_ECOLE'), requireMainAE, async (req, res) => {
  try {
    const idAE = req.session.user.id;
    const [aes] = await pool.query('SELECT * FROM auto_ecoles WHERE id = ?', [idAE]);
    if (!aes.length) return res.json({ success: false, msg: 'AE introuvable.' });
    const ae = aes[0];
    const abo = await getAboStatus(idAE);
    const [params] = await pool.query('SELECT montant, duree_jours FROM parametres_abonnement ORDER BY id DESC LIMIT 1');
    const p = params[0] || { montant: 200, duree_jours: 30 };
    res.json({
      success: true,
      ae: { nom: ae.nom, email: ae.email_admin, tel: ae.telephone, adresse: ae.adresse },
      abonnement: abo,
      montant: Number(p.montant)
    });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

// ============================================================================
// PAIEMENT GENIUSPAY - Initier une session de paiement (PUBLIC, pas de session)
// L'AE bloquée n'a pas de session valide, donc on accepte l'aeId dans le body
// ============================================================================
router.post('/initier-paiement', async (req, res) => {
  try {
    // Récupérer l'idAE depuis le body (cas AE bloquée) ou la session (cas AE connectée)
    let idAE = req.body.aeId || (req.session && req.session.user ? req.session.user.id : null);
    if (!idAE) return res.json({ success: false, msg: 'Auto-école non identifiée.' });

    const [aes] = await pool.query('SELECT * FROM auto_ecoles WHERE id = ?', [idAE]);
    if (!aes.length) return res.json({ success: false, msg: 'Auto-école introuvable.' });
    const ae = aes[0];

    // Montant DYNAMIQUE défini par le super admin (pas 15000 en dur !)
    const [params] = await pool.query('SELECT montant, duree_jours FROM parametres_abonnement ORDER BY id DESC LIMIT 1');
    const montant = Number(params[0]?.montant) || 200;

    // Clés API GeniusPay : à configurer dans le fichier .env (jamais en dur dans le code)
    const apiKey = process.env.GENIUSPAY_API_KEY;
    const apiSecret = process.env.GENIUSPAY_API_SECRET;
    if (!apiKey || !apiSecret) {
      return res.json({ success: false, msg: 'Configuration API de paiement manquante. Contactez l\'administrateur. (Variables GENIUSPAY_API_KEY et GENIUSPAY_API_SECRET requises dans .env)' });
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    // Après paiement, une auto-école est TOUJOURS redirigée vers sa page dédiée /autoecole
    // (quelle que soit la page d'origine du paiement).
    const returnUrl = '/autoecole';
    const payload = {
      amount: montant,
      currency: 'XOF',
      description: `Abonnement SIGEXPC - ${ae.nom} (${idAE}) - ${montant} FCFA`,
      customer: { email: ae.email_admin || '', name: ae.nom },
      success_url: `${baseUrl}/api/abonnements/retour-paiement?status=success&autoEcoleId=${encodeURIComponent(idAE)}&return=${encodeURIComponent(returnUrl)}`,
      error_url: `${baseUrl}/api/abonnements/retour-paiement?status=failure&autoEcoleId=${encodeURIComponent(idAE)}&return=${encodeURIComponent(returnUrl)}`,
      metadata: { autoEcoleId: idAE, autoEcoleNom: ae.nom }
    };

    const https = require('https');
    const body = JSON.stringify(payload);
    const apiRes = await new Promise((resolve, reject) => {
      const r = https.request('https://geniuspay.ci/api/v1/merchant/payments', {
        method: 'POST',
        headers: {
          'X-API-Key': apiKey,
          'X-API-Secret': apiSecret,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      }, resp => {
        let d = ''; resp.on('data', c => d += c); resp.on('end', () => resolve({ code: resp.statusCode, body: d }));
      });
      r.on('error', reject);
      r.write(body); r.end();
    });

    if (apiRes.code !== 200 && apiRes.code !== 201) {
      let errMsg = `Erreur API GeniusPay (code ${apiRes.code})`;
      try { const j = JSON.parse(apiRes.body); if (j.message) errMsg = j.message; else if (j.error) errMsg = j.error; } catch (e) {}
      console.error('GeniusPay erreur:', apiRes.code, apiRes.body.slice(0, 200));
      return res.json({ success: false, msg: errMsg });
    }

    const data = JSON.parse(apiRes.body);
    const checkoutUrl = data.data?.checkout_url || data.data?.payment_url;
    if (!checkoutUrl) return res.json({ success: false, msg: 'Réponse API invalide : aucune URL de paiement.' });

    console.log('🔗 Lien GeniusPay généré pour', ae.nom, ':', checkoutUrl);
    res.json({ success: true, checkoutUrl: String(checkoutUrl) });
  } catch (err) {
    console.error('Erreur initier-paiement:', err.message);
    res.json({ success: false, msg: 'Erreur technique : ' + err.message });
  }
});

// Route de RETOUR paiement (GeniusPay redirige ici après paiement)
// Si succès : réactive l'auto-école, prolonge l'abonnement, enregistre le reçu
router.get('/retour-paiement', async (req, res) => {
  // GeniusPay peut renvoyer status en double (?status=success&...&status=success)
  // ce qui transforme req.query.status en tableau. On normalise.
  let status = req.query.status;
  if (Array.isArray(status)) status = status[0];
  status = String(status || '').toLowerCase();
  const autoEcoleId = req.query.autoEcoleId;
  // Une auto-école est TOUJOURS redirigée vers sa page dédiée /autoecole après paiement,
  // quelle que soit l'URL de retour envoyée par GeniusPay.
  const returnUrl = '/autoecole';
  console.log('Retour paiement reçu:', { status, autoEcoleId, returnUrl, reference: req.query.reference });
  let ok = false;
  if (status === 'success' && autoEcoleId) {
    try {
      await reactiverAbonnement(autoEcoleId);
      ok = true;
      console.log('✅ Abonnement réactivé pour', autoEcoleId);
    } catch (e) { console.error('Erreur retour paiement:', e.message); }
  }
  // Page de succès/échec avec décompte avant redirection vers /autoecole
  const paidParam = ok ? 'success' : 'failure';
  if (ok) {
    // Récupérer les infos pour afficher le reçu
    let aeNom = 'Auto-école', montant = 0, dateFin = '';
    try {
      const [aes] = await pool.query('SELECT nom FROM auto_ecoles WHERE id = ?', [autoEcoleId]);
      if (aes.length) aeNom = aes[0].nom;
      const [abo] = await pool.query('SELECT montant_paye, date_fin FROM abonnements_auto_ecoles WHERE id_ae = ? ORDER BY id DESC LIMIT 1', [autoEcoleId]);
      if (abo.length) { montant = Number(abo[0].montant_paye) || 0; dateFin = fmtDateFR(abo[0].date_fin); }
    } catch (e) {}
    res.send(pageSuccesPaiementHTML({ aeNom, montant, dateFin, autoEcoleId }));
  } else {
    res.send(pageEchecPaiementHTML());
  }
});

// ============================================================================
// PAGES HTML DE CONFIRMATION (après paiement GeniusPay)
// ============================================================================
function pageSuccesPaiementHTML({ aeNom, montant, dateFin, autoEcoleId }) {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Paiement confirmé - SIGEXPC</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; font-family:'Segoe UI',Tahoma,sans-serif; }
    body { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:20px;
      background:linear-gradient(135deg,#0f172a 0%,#1e3a8a 50%,#1e40af 100%); position:relative; overflow:hidden; }
    body::before { content:''; position:absolute; inset:0;
      background:radial-gradient(circle at 20% 50%, rgba(245,158,11,0.15) 0%, transparent 50%),
                 radial-gradient(circle at 80% 80%, rgba(16,185,129,0.15) 0%, transparent 50%); }
    .card { position:relative; z-index:2; background:#fff; border-radius:24px; padding:45px 40px;
      max-width:480px; width:100%; text-align:center;
      box-shadow:0 25px 60px rgba(0,0,0,0.4); border-top:6px solid #EAB221;
      animation:cardIn 0.6s cubic-bezier(0.34,1.56,0.64,1); }
    @keyframes cardIn { from{opacity:0;transform:translateY(40px) scale(0.9);} to{opacity:1;transform:translateY(0) scale(1);} }
    .logo { width:110px; height:110px; border-radius:50%; margin:0 auto 20px; display:block;
      box-shadow:0 10px 25px rgba(0,0,0,0.2); object-fit:cover; }
    .check-circle { width:90px; height:90px; margin:0 auto 20px; border-radius:50%;
      background:linear-gradient(135deg,#10b981,#059669); display:flex; align-items:center; justify-content:center;
      box-shadow:0 10px 30px rgba(16,185,129,0.4); animation:pop 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.3s both; }
    @keyframes pop { from{transform:scale(0);} to{transform:scale(1);} }
    .check-circle i { font-size:3rem; color:#fff; }
    .check-circle::after { content:''; position:absolute; width:90px; height:90px; border-radius:50%;
      border:3px solid #10b981; animation:ripple 1.5s ease-out infinite; }
    @keyframes ripple { 0%{transform:scale(1);opacity:1;} 100%{transform:scale(1.8);opacity:0;} }
    h1 { color:#0f172a; font-size:1.6rem; margin-bottom:8px; font-weight:800; }
    .sub { color:#64748b; font-size:1rem; margin-bottom:25px; }
    .recu { background:#f8fafc; border:1px solid #e2e8f0; border-radius:14px; padding:20px;
      margin-bottom:25px; text-align:left; }
    .recu-row { display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px dashed #e2e8f0; font-size:0.92rem; }
    .recu-row:last-child { border-bottom:none; }
    .recu-row .lbl { color:#64748b; }
    .recu-row .val { color:#0f172a; font-weight:700; }
    .recu-row .val.big { color:#059669; font-size:1.3rem; }
    .countdown-box { background:linear-gradient(135deg,#1e3a8a,#3b82f6); color:#fff; border-radius:14px;
      padding:16px; margin-bottom:20px; }
    .countdown-box .label { font-size:0.82rem; text-transform:uppercase; letter-spacing:1px; opacity:0.9; }
    .countdown-box .count { font-size:2.2rem; font-weight:900; margin-top:4px; }
    .countdown-box .count span { display:inline-block; animation:bounce 1s infinite; }
    @keyframes bounce { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-6px);} }
    .redirect-link { display:inline-block; margin-top:8px; color:#1e3a8a; text-decoration:none;
      font-weight:600; font-size:0.9rem; }
    .redirect-link:hover { text-decoration:underline; }
    .badge { display:inline-block; background:#dcfce7; color:#065f46; padding:4px 12px;
      border-radius:20px; font-size:0.78rem; font-weight:700; margin-bottom:12px; }
    .footer-note { font-size:0.78rem; color:#94a3b8; margin-top:15px; }
    @media (max-width:480px){ .card{padding:35px 25px;} h1{font-size:1.3rem;} }
  </style></head>
  <body>
    <div class="card">
      <img src="/img/logo.png" alt="SIGEXPC" class="logo">
      <div class="check-circle"><i class="fas fa-check"></i></div>
      <div class="badge">PAIEMENT CONFIRMÉ</div>
      <h1>Paiement réalisé avec succès !</h1>
      <p class="sub">Votre abonnement à SIGEXPC a été réactivé.<br>Un reçu a été envoyé à votre adresse email.</p>
      <div class="recu">
        <div class="recu-row"><span class="lbl"><i class="fas fa-car"></i> Auto-école</span><span class="val">${aeNom}</span></div>
        <div class="recu-row"><span class="lbl"><i class="fas fa-money-bill-wave"></i> Montant payé</span><span class="val">${montant.toLocaleString('fr-FR')} FCFA</span></div>
        <div class="recu-row"><span class="lbl"><i class="fas fa-calendar-check"></i> Valide jusqu'au</span><span class="val">${dateFin}</span></div>
        <div class="recu-row"><span class="lbl"><i class="fas fa-circle-check"></i> Statut</span><span class="val big">ACTIF</span></div>
      </div>
      <div class="countdown-box">
        <div class="label">Redirection vers la page d'accueil dans</div>
        <div class="count"><span id="cd">5</span> seconde(s)</div>
      </div>
      <a href="/autoecole" class="redirect-link"><i class="fas fa-arrow-right"></i> Cliquez ici pour y accéder immédiatement</a>
      <p class="footer-note">Vous pouvez maintenant vous reconnecter avec vos identifiants.</p>
    </div>
    <script>
      let s = 5;
      const el = document.getElementById('cd');
      const t = setInterval(() => {
        s--; if (el) el.textContent = s;
        if (s <= 0) { clearInterval(t); window.location.href = '/autoecole'; }
      }, 1000);
    </script>
  </body></html>`;
}

function pageEchecPaiementHTML() {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Paiement échoué - SIGEXPC</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; font-family:'Segoe UI',Tahoma,sans-serif; }
    body { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:20px;
      background:linear-gradient(135deg,#0f172a 0%,#7f1d1d 100%); }
    .card { background:#fff; border-radius:24px; padding:45px 40px; max-width:480px; width:100%;
      text-align:center; box-shadow:0 25px 60px rgba(0,0,0,0.4); border-top:6px solid #dc2626;
      animation:cardIn 0.6s cubic-bezier(0.34,1.56,0.64,1); }
    @keyframes cardIn { from{opacity:0;transform:translateY(40px) scale(0.9);} to{opacity:1;transform:translateY(0) scale(1);} }
    .logo { width:110px; height:110px; border-radius:50%; margin:0 auto 20px; display:block; box-shadow:0 10px 25px rgba(0,0,0,0.2); }
    .x-circle { width:90px; height:90px; margin:0 auto 20px; border-radius:50%;
      background:linear-gradient(135deg,#ef4444,#dc2626); display:flex; align-items:center; justify-content:center;
      box-shadow:0 10px 30px rgba(239,68,68,0.4); }
    .x-circle i { font-size:3rem; color:#fff; }
    h1 { color:#0f172a; font-size:1.6rem; margin-bottom:8px; }
    .sub { color:#64748b; font-size:1rem; margin-bottom:25px; }
    .btn { display:inline-block; background:linear-gradient(135deg,#1e3a8a,#3b82f6); color:#fff;
      padding:14px 30px; border-radius:12px; text-decoration:none; font-weight:700; margin-top:8px; }
    .countdown-box { background:#f1f5f9; color:#475569; border-radius:14px; padding:14px; margin-bottom:20px; font-size:0.9rem; }
  </style></head>
  <body>
    <div class="card">
      <img src="/img/logo.png" alt="SIGEXPC" class="logo">
      <div class="x-circle"><i class="fas fa-xmark"></i></div>
      <h1>Le paiement n'a pas abouti</h1>
      <p class="sub">Votre transaction a échoué ou a été annulée.<br>Aucun montant n'a été débité. Veuillez réessayer.</p>
      <div class="countdown-box">Redirection dans <b id="cd">5</b> seconde(s)...</div>
      <a href="/autoecole" class="btn"><i class="fas fa-rotate-right"></i> Réessayer le paiement</a>
    </div>
    <script>
      let s = 5;
      const t = setInterval(() => { s--; document.getElementById('cd').textContent = s;
        if (s <= 0) { clearInterval(t); window.location.href = '/autoecole'; } }, 1000);
    </script>
  </body></html>`;
}

// Fonction utilitaire : réactiver un abonnement (après paiement réussi)
async function reactiverAbonnement(idAE) {
  const [params] = await pool.query('SELECT montant, duree_jours FROM parametres_abonnement ORDER BY id DESC LIMIT 1');
  const p = params[0] || { montant: 200, duree_jours: 30 };
  const maintenant = new Date();
  const dateFin = new Date(maintenant); dateFin.setDate(dateFin.getDate() + p.duree_jours);
  // Convertir en chaînes ISO pour SQLite (qui ne supporte pas les objets Date)
  const nowStr = maintenant.toISOString().slice(0, 19).replace('T', ' ');
  const finStr = dateFin.toISOString().slice(0, 19).replace('T', ' ');

  // 1. Mettre à jour le statut de l'AE
  await pool.query('UPDATE auto_ecoles SET statut = ? WHERE id = ?', ['actif', idAE]);

  // 2. Mettre à jour ou créer l'abonnement
  const [exist] = await pool.query('SELECT id FROM abonnements_auto_ecoles WHERE id_ae = ? ORDER BY id DESC LIMIT 1', [idAE]);
  if (exist.length) {
    await pool.query('UPDATE abonnements_auto_ecoles SET date_debut = ?, date_fin = ?, statut = ?, montant_paye = ? WHERE id = ?',
      [nowStr, finStr, 'actif', p.montant, exist[0].id]);
  } else {
    await pool.query('INSERT INTO abonnements_auto_ecoles (id_ae, date_debut, date_fin, statut, montant_paye) VALUES (?, ?, ?, ?, ?)',
      [idAE, nowStr, finStr, 'actif', p.montant]);
  }

  // 3. Enregistrer le reçu
  const numRecu = `REC-${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, '0')}-${String(maintenant.getDate()).padStart(2, '0')}-${String(idAE).replace('AE-', '')}`;
  const recuId = `REC-${Math.floor(Math.random() * 900000 + 100000)}`;
  await pool.query('INSERT INTO recus_paiement (id, id_ae, date_emission, montant, periode_debut, periode_fin, statut, num_recu) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [recuId, idAE, nowStr, p.montant, nowStr, finStr, 'actif', numRecu]);

  // 4. Invalider le cache d'abonnement pour cette AE
  try {
    const { invalidateAboCache } = require('../middleware/checkAbonnement');
    invalidateAboCache(idAE);
  } catch (e) { /* non bloquant */ }

  // 5. Envoyer le reçu par email à l'auto-école
  try {
    const { sendRecuPaiement } = require('../config/mailer');
    const [aeInfo] = await pool.query('SELECT nom, email_admin FROM auto_ecoles WHERE id = ?', [idAE]);
    if (aeInfo.length && aeInfo[0].email_admin) {
      await sendRecuPaiement({
        to: aeInfo[0].email_admin,
        aeNom: aeInfo[0].nom,
        montant: p.montant,
        dateDebut: fmtDateFR(nowStr),
        dateFin: fmtDateFR(finStr),
        numRecu
      });
    }
  } catch (e) { console.error('Erreur envoi reçu email:', e.message); /* non bloquant */ }
}

// ============================================================================
// ENVOI MANUEL DES RAPPELS D'EXPIRATION (SUPER_ADMIN)
// ============================================================================
router.post('/envoyer-rappels', requireAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const { envoyerRappelsExpiration } = require('../config/rappelJob');
    const result = await envoyerRappelsExpiration();
    res.json({ success: true, ...result });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

// ============================================================================
// REÇUS (SUPER_ADMIN)
// ============================================================================
router.get('/recus', requireAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT r.*, ae.nom AS ae_nom FROM recus_paiement r JOIN auto_ecoles ae ON r.id_ae = ae.id ORDER BY r.created_at DESC`
    );
    res.json({ success: true, list: rows });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

// Suppression d'un reçu (SUPER_ADMIN)
router.delete('/recus/:id', requireAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    await pool.query('DELETE FROM recus_paiement WHERE id = ?', [req.params.id]);
    const [rows] = await pool.query(`SELECT r.*, ae.nom AS ae_nom FROM recus_paiement r JOIN auto_ecoles ae ON r.id_ae = ae.id ORDER BY r.created_at DESC`);
    res.json({ success: true, list: rows });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

// Historique des reçus de l'auto-école connectée (AUTO_ECOLE)
router.get('/mes-recus', requireAuth, requireRole('AUTO_ECOLE'), async (req, res) => {
  try {
    const idAE = req.session.user.id;
    const [rows] = await pool.query(
      'SELECT * FROM recus_paiement WHERE id_ae = ? ORDER BY created_at DESC', [idAE]
    );
    res.json({ success: true, list: rows });
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

// Sauvegarde globale Excel (SUPER_ADMIN) — renvoie un fichier .xlsx
router.get('/backup', requireAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const XLSX = require('xlsx');
    const tables = ['super_admins', 'directions_regionales', 'auto_ecoles', 'auto_ecoles_staff',
      'agents_verificateurs', 'sttc_users', 'candidats', 'centres_examen', 'examens_programmes',
      'inscriptions_examens', 'abonnements_auto_ecoles', 'recus_paiement', 'parametres_region'];
    const wb = XLSX.utils.book_new();
    for (const t of tables) {
      try {
        const [rows] = await pool.query(`SELECT * FROM ${t}`);
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, t.slice(0, 31));
      } catch (e) { /* table vide ou inexistante */ }
    }
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="sigexpc_backup.xlsx"');
    res.send(buf);
  } catch (e) { res.status(500).json({ success: false, msg: e.message }); }
});

module.exports = router;
