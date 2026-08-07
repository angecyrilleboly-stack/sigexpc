// ============================================================================
//  SIGEXPC - Routes de génération de documents (HTML imprimable + PDF)
//  On génère du HTML propre → imprimer via le navigateur (Ctrl+P) ou Puppeteer.
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
function esc(s) { return String(s || '').replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m])); }

// Base CSS commune pour les documents officiels
const DOC_CSS = `
  body { font-family: 'Times New Roman', Times, serif; margin: 0; padding: 25px; color: #000; }
  .header-table { width: 100%; font-size: 12px; font-weight: bold; margin-bottom: 18px; text-align: center; }
  .header-table td { width: 50%; vertical-align: top; padding: 5px; }
  .title-container { text-align: center; margin: 12px 0 22px; }
  .title { font-size: 19px; font-weight: bold; border: 2px solid black; padding: 9px 18px; display: inline-block; text-transform: uppercase; }
  .info-section { font-size: 12px; margin-bottom: 14px; font-weight: bold; line-height: 1.5; text-transform: uppercase; }
  .summary-section { font-size: 11px; margin-bottom: 18px; padding: 10px; border: 1px dashed black; background: #f8fafc; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .summary-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  .summary-table td { padding: 4px; border-bottom: 1px dotted #ccc; }
  .cand-table { width: 100%; border-collapse: collapse; margin-bottom: 28px; font-size: 10px; }
  .cand-table th, .cand-table td { border: 1px solid black; padding: 6px 5px; text-align: left; }
  .cand-table th { background: #808080; color: black; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .footer-table { width: 100%; text-align: center; font-size: 12px; font-weight: bold; margin-top: 38px; }
  .footer-table td { width: 50%; }
  @media print { body { padding: 0; } .no-print { display: none; } }
`;

function headerHTML(regionNom) {
  return `<table class="header-table"><tr>
    <td>Direction Générale des transports<br>Terrestres et de la Circulation<br>-------------<br>${esc(regionNom)}</td>
    <td>République de Côte d'Ivoire<br>Union-Discipline-Travail<br>-------------</td>
  </tr></table>`;
}

// Bouton impression (côté client)
const PRINT_BAR = `<div class="no-print" style="position:fixed;top:0;left:0;right:0;background:#1e3a8a;color:#fff;padding:12px;text-align:center;z-index:9999;font-family:sans-serif;">
  <button onclick="window.print()" style="background:#fff;color:#1e3a8a;border:none;padding:10px 24px;border-radius:8px;font-weight:bold;cursor:pointer;font-size:14px;">🖨️ Imprimer / Enregistrer en PDF</button>
  <button onclick="window.close()" style="background:transparent;color:#fff;border:1px solid #fff;padding:10px 24px;border-radius:8px;font-weight:bold;cursor:pointer;margin-left:10px;">Fermer</button>
</div>`;

function wrapDoc(title, body, regionNom) {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>${esc(title)}</title><style>${DOC_CSS}</style></head><body>${PRINT_BAR}${headerHTML(regionNom)}${body}</body></html>`;
}

// Récupère le nom de la région
async function getRegionNom(idRegion) {
  const [r] = await pool.query('SELECT nom_region FROM directions_regionales WHERE id = ?', [idRegion]);
  return r[0] ? r[0].nom_region : 'Direction Régionale';
}

// Nettoie un nom de signataire : retire les préfixes comme "Directeur Régional||" ou "||"
function cleanSignataire(nom) {
  if (!nom) return '';
  let n = String(nom).trim();
  // Retirer tout ce qui est avant un "||" (ex: "Directeur Régional||DIOMANDE" → "DIOMANDE")
  if (n.includes('||')) n = n.split('||').pop().trim();
  // Retirer les préfixes connus
  n = n.replace(/^(Directeur(\s*Régional(\s*e)?)?|Directrice(\s*Régional(\s*e)?)?|Chef\s*STTC|Coordonnateur)\s*[:\-]?\s*/i, '').trim();
  return n;
}

// ============================================================================
// BORDEREAU D'EXAMEN (avant délibération)
// ============================================================================
async function getBordereauData(idExamen, idReg, isRajout) {
  const [exams] = await pool.query('SELECT * FROM examens_programmes WHERE id = ?', [idExamen]);
  if (!exams.length) return { success: false, msg: 'Examen introuvable.' };
  const exam = exams[0];
  const regionNom = await getRegionNom(idReg);

  // Récupérer le nom du directeur régional (signataire) — nettoyé du préfixe
  let directeurNom = '';
  try {
    const [pr] = await pool.query('SELECT directeur_regional FROM parametres_region WHERE id_region = ?', [idReg]);
    if (pr.length && pr[0].directeur_regional) directeurNom = cleanSignataire(pr[0].directeur_regional);
  } catch (e) {}

  const [rows] = await pool.query(
    `SELECT ins.resultat, ins.validation_region, c.nom, c.numero_piece, c.categorie_permis, ae.nom AS ae
     FROM inscriptions_examens ins
     JOIN candidats c ON ins.id_candidat = c.id
     JOIN auto_ecoles ae ON c.id_autoecole = ae.id
     WHERE ins.id_examen = ? AND ins.resultat = 'Validé'`, [idExamen]
  );
  let candidats = rows.filter(r => {
    if (String(r.resultat) === 'En attente (Rajout)') return isRajout;
    return !isRajout;
  }).map(r => ({
    nom: r.nom, piece: r.numero_piece, cat: cleanCat(r.categorie_permis), ae: r.ae
  }));
  if (!candidats.length) return { success: false, msg: "Aucun candidat validé pour ce bordereau." };
  candidats.sort((a, b) => a.nom.localeCompare(b.nom));

  return {
    success: true,
    regionNom,
    exam: { date: fmtDateFR(exam.date_examen), lieu: exam.lieu || 'À définir', type: exam.type_examen, inspecteur: exam.inspecteur_nom || '' },
    inspecteurNom: (exam.inspecteur_nom && exam.inspecteur_nom !== 'À définir') ? exam.inspecteur_nom : '',
    directeurNom,
    candidats
  };
}

router.get('/bordereau/:idExamen', requireAuth, requireRole('REGION', 'SUPER_ADMIN'), async (req, res) => {
  try {
    const isRajout = req.query.rajout === '1';
    const idReg = req.session.user.role === 'SUPER_ADMIN' ? (req.query.idReg || '') : req.session.user.idRegion;
    const data = await getBordereauData(req.params.idExamen, idReg, isRajout);
    if (!data.success) return res.status(404).send(esc(data.msg));

    const typeExam = data.exam.type.toUpperCase().includes('CODE') ? 'CODE' : 'CONDUITE';
    const title = (isRajout ? "BORDEREAU RAJOUT D'EXAMEN DE " : "BORDEREAU D'EXAMEN DE ") + typeExam;

    const aeStats = {};
    data.candidats.forEach(c => { aeStats[c.ae] = (aeStats[c.ae] || 0) + 1; });
    const aeNames = Object.keys(aeStats).sort();

    let body = `<div class="title-container"><div class="title">${title}</div></div>`;
    body += `<div class="info-section">DATE: ${esc(data.exam.date)}<br>LOCALITE: ${esc(data.exam.lieu)}</div>`;

    body += `<div class="summary-section"><div style="font-weight:bold;text-decoration:underline;margin-bottom:5px;">RÉCAPITULATIF DES EFFECTIFS :</div><table class="summary-table">`;
    for (let i = 0; i < aeNames.length; i += 2) {
      body += '<tr>';
      body += `<td>- <b>${esc(aeNames[i])}</b> : ${aeStats[aeNames[i]]} candidat(s)</td>`;
      body += (i + 1 < aeNames.length) ? `<td>- <b>${esc(aeNames[i + 1])}</b> : ${aeStats[aeNames[i + 1]]} candidat(s)</td>` : '<td></td>';
      body += '</tr>';
    }
    body += `</table><div style="font-weight:bold;border-top:1px solid black;padding-top:5px;display:inline-block;">TOTAL GÉNÉRAL : ${data.candidats.length} CANDIDAT(S)</div></div>`;

    body += `<table class="cand-table"><tr><th style="width:5%;text-align:center;">N°</th><th style="width:30%;">NOMS ET PRÉNOMS</th><th style="width:20%;">IDENTIFIANTS</th><th style="width:10%;text-align:center;">CAT.</th><th style="width:20%;">AUTO-ÉCOLES</th><th style="width:15%;">EMARGEMENT</th></tr>`;
    data.candidats.forEach((c, i) => {
      body += `<tr><td style="text-align:center;">${i + 1}</td><td>${esc(c.nom)}</td><td style="font-family:monospace;font-weight:bold;">${esc(c.piece)}</td><td style="text-align:center;">${esc(c.cat)}</td><td>${esc(c.ae)}</td><td></td></tr>`;
    });
    body += `</table><table class="footer-table"><tr><td style="width:50%;text-align:center;vertical-align:top;"><div style="margin-bottom:50px;"><b>L'INSPECTEUR</b></div>${data.inspecteurNom ? `<div style="font-weight:bold;font-size:15px;">${esc(data.inspecteurNom)}</div>` : ''}</td><td style="width:50%;text-align:center;vertical-align:top;"><div style="margin-bottom:50px;"><b>LE DIRECTEUR REGIONAL</b></div><div style="font-weight:bold;">${esc(data.directeurNom)}</div></td></tr></table>`;

    res.send(wrapDoc(title, body, data.regionNom));
  } catch ( e) { res.status(500).send('Erreur: ' + esc(e.message)); }
});

// ============================================================================
// BORDEREAU DÉLIBÉRÉ (après résultats)
// ============================================================================
router.get('/delibere/:idExamen', requireAuth, async (req, res) => {
  try {
    const idExamen = req.params.idExamen;
    const idReg = req.session.user.role === 'SUPER_ADMIN' ? (req.query.idReg || '') : req.session.user.idRegion;
    const idAE = req.session.user.role === 'AUTO_ECOLE' ? req.session.user.id : null;
    const [exams] = await pool.query('SELECT * FROM examens_programmes WHERE id = ?', [idExamen]);
    if (!exams.length) return res.status(404).send('Examen introuvable.');
    const exam = exams[0];
    const regionNom = await getRegionNom(idReg);

    // Récupérer le nom du directeur régional (signataire)
    let directeurNom = '';
    try {
      const [pr] = await pool.query('SELECT directeur_regional FROM parametres_region WHERE id_region = ?', [idReg]);
      if (pr.length && pr[0].directeur_regional) directeurNom = pr[0].directeur_regional;
    } catch (e) {}
    const inspecteurNom = (exam.inspecteur_nom && exam.inspecteur_nom !== 'À définir') ? exam.inspecteur_nom : '';

    // Si AUTO_ECOLE, filtrer par son id_autoecole (confidentialité)
    const aeFilter = idAE ? `AND c.id_autoecole = '${idAE.replace(/'/g, "''")}'` : '';
    const [rows] = await pool.query(
      `SELECT ins.validation_region, c.nom, c.numero_piece, c.categorie_permis, ae.nom AS ae
       FROM inscriptions_examens ins
       JOIN candidats c ON ins.id_candidat = c.id
       JOIN auto_ecoles ae ON c.id_autoecole = ae.id
       WHERE ins.id_examen = ? AND ins.validation_region IN ('APTE','INAPTE','ABSENT','NON EVALUE') ${aeFilter}`, [idExamen]
    );
    if (!rows.length) return res.status(404).send('Aucun candidat délibéré.');

    const candidats = rows.map(r => {
      const st = String(r.validation_region);
      let emargement = st === 'ABSENT' ? 'ABSENT' : ['APTE', 'INAPTE', 'NON EVALUE'].includes(st) ? 'PRÉSENT' : '';
      let resultat = st === 'NON EVALUE' ? 'N.E.' : st;
      return { nom: r.nom, piece: r.numero_piece, cat: cleanCat(r.categorie_permis), ae: r.ae, emargement, resultat };
    }).sort((a, b) => a.nom.localeCompare(b.nom));

    const typeExam = exam.type_examen.toUpperCase().includes('CODE') ? 'CODE' : 'CONDUITE';
    const title = "BORDEREAU DÉLIBÉRÉ D'EXAMEN DE " + typeExam;

    const aeStats = {};
    const total = { total: 0, APTE: 0, INAPTE: 0, ABSENT: 0, NE: 0 };
    candidats.forEach(c => {
      if (!aeStats[c.ae]) aeStats[c.ae] = { total: 0, APTE: 0, INAPTE: 0, ABSENT: 0, NE: 0 };
      aeStats[c.ae].total++; total.total++;
      if (c.resultat === 'APTE') { aeStats[c.ae].APTE++; total.APTE++; }
      else if (c.resultat === 'INAPTE') { aeStats[c.ae].INAPTE++; total.INAPTE++; }
      else if (c.resultat === 'ABSENT') { aeStats[c.ae].ABSENT++; total.ABSENT++; }
      else { aeStats[c.ae].NE++; total.NE++; }
    });

    let body = `<div class="title-container"><div class="title">${title}</div></div>`;
    body += `<div class="info-section">DATE: ${esc(fmtDateFR(exam.date_examen))}<br>LOCALITE: ${esc(exam.lieu || 'À définir')}</div>`;

    body += `<div class="summary-section"><div style="font-weight:bold;text-decoration:underline;margin-bottom:8px;font-size:13px;">RÉCAPITULATIF DES RÉSULTATS :</div><table class="summary-table">`;
    Object.keys(aeStats).sort().forEach(ae => {
      const s = aeStats[ae]; const details = [];
      if (s.APTE) details.push(`<span style="color:green;">${s.APTE} Apte(s)</span>`);
      if (s.INAPTE) details.push(`<span style="color:red;">${s.INAPTE} Inapte(s)</span>`);
      if (s.ABSENT) details.push(`<span style="color:gray;">${s.ABSENT} Absent(s)</span>`);
      if (s.NE) details.push(`<span style="color:#b45309;">${s.NE} N.E.</span>`);
      body += `<tr><td style="width:40%;"><b>${esc(ae)}</b></td><td style="width:20%;"><b>${s.total}</b> inscrit(s)</td><td style="width:40%;">${details.join(' | ')}</td></tr>`;
    });
    const gd = [];
    if (total.APTE) gd.push(`<span style="color:green;">${total.APTE} Aptes</span>`);
    if (total.INAPTE) gd.push(`<span style="color:red;">${total.INAPTE} Inaptes</span>`);
    if (total.ABSENT) gd.push(`<span style="color:gray;">${total.ABSENT} Absents</span>`);
    if (total.NE) gd.push(`<span style="color:#b45309;">${total.NE} N.E.</span>`);
    body += `</table><div style="font-weight:bold;border-top:1px solid black;padding-top:8px;font-size:13px;">TOTAL GÉNÉRAL : ${total.total} CANDIDATS (${gd.join(' | ')})</div></div>`;

    body += `<table class="cand-table"><tr><th style="width:5%;text-align:center;">N°</th><th style="width:28%;">NOMS ET PRÉNOMS</th><th style="width:18%;">IDENTIFIANTS</th><th style="width:8%;text-align:center;">CAT.</th><th style="width:18%;">AUTO-ÉCOLES</th><th style="width:10%;text-align:center;">EMARG.</th><th style="width:13%;text-align:center;">RÉSULTATS</th></tr>`;
    candidats.forEach((c, i) => {
      const stEm = c.emargement === 'ABSENT' ? 'color:red;' : 'color:green;';
      let stR = '';
      if (c.resultat === 'APTE') stR = 'color:green;font-weight:bold;';
      else if (c.resultat === 'INAPTE') stR = 'color:red;font-weight:bold;';
      else if (c.resultat === 'ABSENT') stR = 'color:gray;font-weight:bold;';
      else if (c.resultat === 'N.E.') stR = 'color:#b45309;font-weight:bold;';
      body += `<tr><td style="text-align:center;">${i + 1}</td><td>${esc(c.nom)}</td><td style="font-family:monospace;font-weight:bold;">${esc(c.piece)}</td><td style="text-align:center;">${esc(c.cat)}</td><td>${esc(c.ae)}</td><td style="text-align:center;font-weight:bold;${stEm}">${esc(c.emargement)}</td><td style="text-align:center;${stR}">${esc(c.resultat)}</td></tr>`;
    });
    body += `</table><table class="footer-table"><tr><td style="width:50%;text-align:center;vertical-align:top;"><div style="margin-bottom:50px;"><b>L'INSPECTEUR</b></div>${inspecteurNom ? `<div style="font-weight:bold;font-size:15px;">${esc(inspecteurNom)}</div>` : ''}</td><td style="width:50%;text-align:center;vertical-align:top;"><div style="margin-bottom:50px;"><b>LE DIRECTEUR REGIONAL</b></div><div style="font-weight:bold;">${esc(directeurNom)}</div></td></tr></table>`;

    res.send(wrapDoc(title, body, regionNom));
  } catch (e) { res.status(500).send('Erreur: ' + esc(e.message)); }
});

// ============================================================================
// COMPTE RENDU STTC
// ============================================================================
router.get('/compte-rendu/:idExamen', requireAuth, requireRole('REGION', 'STTC', 'SUPER_ADMIN'), async (req, res) => {
  try {
    const idExamen = req.params.idExamen;
    const idReg = req.session.user.idRegion;
    const [exams] = await pool.query('SELECT * FROM examens_programmes WHERE id = ?', [idExamen]);
    if (!exams.length) return res.status(404).send('Examen introuvable.');
    const exam = exams[0];
    const regionNom = await getRegionNom(idReg);

    // Trouver le code associé (prochain code après cette conduite)
    const [codeExams] = await pool.query(
      `SELECT * FROM examens_programmes WHERE id_region = ? AND type_examen = 'Théorique (Code)' AND date_examen >= ? ORDER BY date_examen ASC LIMIT 1`,
      [idReg, exam.date_examen]
    );
    const codeExam = codeExams[0] || null;

    function statsFor(examId) {
      return pool.query(
        `SELECT ins.validation_region, COUNT(DISTINCT c.id) AS cnt FROM inscriptions_examens ins
         JOIN candidats c ON ins.id_candidat = c.id
         WHERE ins.id_examen = ? AND ins.validation_region IN ('APTE','INAPTE','ABSENT','NON EVALUE')
         GROUP BY ins.validation_region`, [examId]
      ).then(([r]) => {
        const s = { total: 0, aptes: 0, inaptes: 0, absentsNE: 0 };
        r.forEach(x => { s.total += x.cnt; if (x.validation_region === 'APTE') s.aptes += x.cnt; else if (x.validation_region === 'INAPTE') s.inaptes += x.cnt; else s.absentsNE += x.cnt; });
        return s;
      });
    }
    const statsConduite = await statsFor(idExamen);
    const statsCode = codeExam ? await statsFor(codeExam.id) : { total: 0, aptes: 0, inaptes: 0, absentsNE: 0 };

    // Liste des AE participantes
    const [aes] = await pool.query(
      `SELECT DISTINCT ae.nom FROM inscriptions_examens ins
       JOIN candidats c ON ins.id_candidat = c.id JOIN auto_ecoles ae ON c.id_autoecole = ae.id
       WHERE (ins.id_examen = ? ${codeExam ? 'OR ins.id_examen = ?' : ''})`, codeExam ? [idExamen, codeExam.id] : [idExamen]
    );
    const aeListStr = aes.map(a => a.nom).join(', ');

    const [resp] = await pool.query('SELECT * FROM parametres_region WHERE id_region = ?', [idReg]);
    const r = resp[0] || {};

    const CR_CSS = DOC_CSS + `
      .title { text-align:center;font-size:16px;font-weight:bold;text-decoration:underline;margin:18px 0 28px; }
      .text-content { line-height:1.8;text-align:justify;margin-bottom:28px;font-size:14px; }
      .stats-table { width:100%;border-collapse:collapse;margin-bottom:28px;font-size:13px;text-align:center; }
      .stats-table th, .stats-table td { border:1px solid black;padding:10px; }
      .stats-table th { background:#f1f5f9;font-weight:bold; }
    `;

    let body = `<div class="title">COMPTE RENDU DES EXAMENS THÉORIQUES ET PRATIQUES DU PERMIS DE CONDUIRE</div>`;
    body += `<div class="text-content">Les examens de conduite et de code se sont déroulés du <b>${esc(fmtDateFR(exam.date_examen))}</b> au <b>${esc(codeExam ? fmtDateFR(codeExam.date_examen) : 'N/A')}</b> à <b>${esc(exam.lieu || 'À définir')}</b>.<br><br>`;
    body += `Concernant la phase de code et de conduite nous avons enregistré la participation de <b>${aes.length}</b> auto-écoles à savoir : <b>${esc(aeListStr)}</b>.</div>`;
    body += `<p style="font-weight:bold;font-size:14px;text-decoration:underline;">Ci-dessous le tableau récapitulatif de l'examen théorique et pratique :</p>`;
    body += `<table class="stats-table">
      <tr><th colspan="3" style="background:#808080;color:black;-webkit-print-color-adjust:exact;print-color-adjust:exact;">Bordereaux de code : ${statsCode.total} candidats</th><th colspan="3" style="background:#808080;color:black;-webkit-print-color-adjust:exact;print-color-adjust:exact;">Bordereaux de conduite : ${statsConduite.total} candidats</th></tr>
      <tr><th>Absents & N.E.</th><th>Aptes</th><th>Inaptes</th><th>Absents & N.E.</th><th>Aptes</th><th>Inaptes</th></tr>
      <tr><td style="font-weight:bold;font-size:16px;">${statsCode.absentsNE}</td><td style="font-weight:bold;font-size:16px;">${statsCode.aptes}</td><td style="font-weight:bold;font-size:16px;">${statsCode.inaptes}</td><td style="font-weight:bold;font-size:16px;">${statsConduite.absentsNE}</td><td style="font-weight:bold;font-size:16px;">${statsConduite.aptes}</td><td style="font-weight:bold;font-size:16px;">${statsConduite.inaptes}</td></tr>
    </table>`;
    body += `<div class="text-content">Notons que dans l'ensemble, les examens se sont bien déroulés. Aucun dysfonctionnement majeur n'a été signalé.</div>`;
    body += `<table class="footer-table"><tr>
      <td><b>Chef de Service TTC (STTC)</b><br><br><br><br><br><b style="text-transform:uppercase;">${esc(r.chef_sttc || '..........')}</b></td>
      <td><b>Coordonnateur des examens du permis de conduire</b><br><br><br><br><br><b style="text-transform:uppercase;">${esc(r.coordonnateur || '..........')}</b></td>
    </tr></table>`;

    res.send(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Compte Rendu</title><style>${CR_CSS}</style></head><body>${PRINT_BAR}${headerHTML(regionNom)}${body}</body></html>`);
  } catch (e) { res.status(500).send('Erreur: ' + esc(e.message)); }
});

// ============================================================================
// REÇU DE PAIEMENT (AUTO_ECOLE)
// ============================================================================
router.get('/recu/:idAE', requireAuth, async (req, res) => {
  try {
    const idAE = req.params.idAE;
    const [aes] = await pool.query('SELECT * FROM auto_ecoles WHERE id = ?', [idAE]);
    if (!aes.length) return res.status(404).send('Auto-école introuvable.');
    const ae = aes[0];

    // Dernier abonnement
    const [abos] = await pool.query('SELECT * FROM abonnements_auto_ecoles WHERE id_ae = ? ORDER BY id DESC LIMIT 1', [idAE]);
    const abo = abos[0];
    if (!abo) return res.status(404).send('Aucun abonnement trouvé.');
    const now = new Date();
    const numRecu = `REC-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(idAE).replace('AE-', '')}`;

    const RECU_CSS = `
      body { font-family:'Times New Roman',serif;margin:0;padding:40px;color:#000;background:#fff; }
      .recu-container { max-width:700px;margin:0 auto;border:2px solid #1e3a8a;padding:30px;border-radius:8px; }
      .header { text-align:center;border-bottom:3px double #1e3a8a;padding-bottom:20px;margin-bottom:25px; }
      .header h1 { color:#1e3a8a;margin:0;font-size:28px;letter-spacing:2px; }
      .header p { color:#64748b;margin:5px 0 0;font-size:14px; }
      .info-row { display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dashed #e2e8f0; }
      .info-row .label { color:#64748b;font-weight:600; }
      .info-row .value { font-weight:700;color:#0f172a; }
      .montant { font-size:32px;color:#16a34a;text-align:center;padding:20px 0;font-weight:900; }
      .footer { text-align:center;margin-top:30px;padding-top:20px;border-top:2px solid #e2e8f0;color:#94a3b8;font-size:12px; }
      .badge-success { background:#dcfce7;color:#16a34a;padding:4px 15px;border-radius:20px;font-weight:700;display:inline-block; }
      @media print { body { padding: 0; } .no-print { display:none; } }
    `;

    const body = `
      <div class="recu-container">
        <div class="header"><h1>📄 REÇU DE PAIEMENT</h1><p>SIGEXPC - Système de Gestion des Examens du Permis de Conduire</p></div>
        <div class="info-row"><span class="label">Numéro de reçu</span><span class="value">${esc(numRecu)}</span></div>
        <div class="info-row"><span class="label">Date d'émission</span><span class="value">${esc(fmtDateFR(now))}</span></div>
        <div class="info-row"><span class="label">Auto-École</span><span class="value">${esc(ae.nom)}</span></div>
        <div class="info-row"><span class="label">Email</span><span class="value">${esc(ae.email_admin || '')}</span></div>
        <div class="info-row"><span class="label">Téléphone</span><span class="value">${esc(ae.telephone || '')}</span></div>
        ${ae.adresse ? `<div class="info-row"><span class="label">Adresse</span><span class="value">${esc(ae.adresse)}</span></div>` : ''}
        <div class="info-row"><span class="label">Date de début</span><span class="value">${esc(fmtDateFR(abo.date_debut))}</span></div>
        <div class="info-row"><span class="label">Date d'expiration</span><span class="value">${esc(fmtDateFR(abo.date_fin))}</span></div>
        <div class="info-row"><span class="label">Statut</span><span class="value"><span class="badge-success">✓ ${esc(abo.statut === 'actif' ? 'Actif' : 'Expiré')}</span></span></div>
        <div class="montant">${Number(abo.montant_paye).toLocaleString('fr-FR')} FCFA</div>
        <p style="text-align:center;color:#475569;margin-top:-10px;">Montant payé pour l'abonnement mensuel</p>
        <div style="text-align:center;margin-top:20px;padding-top:20px;border-top:1px solid #e2e8f0;">
          <p style="color:#475569;font-size:14px;margin:0;">✓ Paiement confirmé - Merci pour votre confiance</p>
        </div>
        <div class="footer">Ce reçu est généré automatiquement par SIGEXPC.<br>Pour toute question, veuillez contacter votre Direction Régionale.</div>
      </div>`;

    res.send(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Reçu de paiement</title><style>${RECU_CSS}</style></head><body>${PRINT_BAR}${body}</body></html>`);
  } catch (e) { res.status(500).send('Erreur: ' + esc(e.message)); }
});

// ============================================================================
// RAPPORT OFFICIEL (AUTO_ECOLE) - période T1/T2/T3/T4/S1/S2/Année
// Renvoie du JSON (données structurées) pour rendu inline côté frontend
// ============================================================================
router.get('/rapport', requireAuth, requireRole('AUTO_ECOLE'), async (req, res) => {
  try {
    const idAE = req.session.user.id;
    const period = req.query.period || 'YEAR';
    const [aes] = await pool.query('SELECT ae.*, dr.nom_region FROM auto_ecoles ae JOIN directions_regionales dr ON ae.id_region = dr.id WHERE ae.id = ?', [idAE]);
    if (!aes.length) return res.status(404).json({ error: 'Auto-école introuvable.' });
    const ae = aes[0];

    // Récupérer les résultats délibérés de cette AE
    const [rows] = await pool.query(
      `SELECT ins.validation_region, e.type_examen, e.date_examen
       FROM inscriptions_examens ins
       JOIN candidats c ON ins.id_candidat = c.id
       JOIN examens_programmes e ON ins.id_examen = e.id
       WHERE c.id_autoecole = ? AND ins.validation_region IN ('APTE','INAPTE','ABSENT','NON EVALUE')`,
      [idAE]
    );

    // Filtrer par période
    const now = new Date();
    const year = now.getFullYear();
    const filtered = rows.filter(r => {
      const dt = new Date(r.date_examen); if (isNaN(dt)) return false;
      if (period === 'YEAR') return dt.getFullYear() === year;
      if (period === 'ALL') return true;
      const q = Math.floor(dt.getMonth() / 3) + 1;
      if (period === 'T1') return dt.getFullYear() === year && q === 1;
      if (period === 'T2') return dt.getFullYear() === year && q === 2;
      if (period === 'T3') return dt.getFullYear() === year && q === 3;
      if (period === 'T4') return dt.getFullYear() === year && q === 4;
      if (period === 'S1') return dt.getFullYear() === year && dt.getMonth() < 6;
      if (period === 'S2') return dt.getFullYear() === year && dt.getMonth() >= 6;
      return true;
    });

    let apteCode = 0, apteCond = 0, inapte = 0, absent = 0, ne = 0;
    filtered.forEach(r => {
      if (r.validation_region === 'APTE') {
        if (String(r.type_examen).includes('Code')) apteCode++;
        else apteCond++;
      } else if (r.validation_region === 'INAPTE') inapte++;
      else if (r.validation_region === 'ABSENT') absent++;
      else if (r.validation_region === 'NON EVALUE') ne++;
    });

    res.json({
      apteCode,
      apteCond,
      inapte,
      absent,
      ne,
      regionDisplay: ae.nom_region || 'Direction Régionale des Transports et des Affaires Maritimes',
      autoEcoleNom: ae.nom || ''
    });
  } catch (e) { res.status(500).json({ error: esc(e.message) }); }
});

module.exports = router;
