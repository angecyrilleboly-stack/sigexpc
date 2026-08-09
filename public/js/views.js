// ============================================================================
//  SIGEXPC - Vues métier (Dashboard, CRUD, Examens, Stats, etc.)
// ============================================================================

// Helper pour rendre un titre de page
function setTitle(title, actionsHtml = '') {
  document.getElementById('pageTitle').innerText = title;
  return `<div class="page-title-row">
    <h2 style="margin:0;font-size:1.4rem;">${esc(title)}</h2>
    <div class="flex gap-8">${actionsHtml}</div>
  </div>`;
}

// ============================================================================
//  DASHBOARD
// ============================================================================
async function openDashboard() {
  const content = document.getElementById('content');
  content.innerHTML = loaderHTML('Chargement du tableau de bord...');
  const res = await API.dashboard();
  if (!res.success) { content.innerHTML = emptyState('Impossible de charger les données.'); return; }
  const { stats } = res;
  const r = USER.role;

  let cards = '';
  if (r === 'SUPER_ADMIN') {
    cards = `
      ${statCard(stats.dir, 'Directions Régionales', 'fa-building', '')}
      ${statCard(stats.ae, 'Auto-Écoles', 'fa-school', 'yellow')}
      ${statCard(stats.can, 'Candidats', 'fa-users', 'green')}`;
  } else if (r === 'REGION') {
    cards = `
      ${statCard(stats.ae, 'Auto-Écoles', 'fa-school', '')}
      ${statCard(stats.ag, 'Agents', 'fa-user-shield', 'yellow')}
      ${statCard(stats.can, 'Candidats', 'fa-users', 'green')}`;
  } else if (r === 'AUTO_ECOLE') {
    cards = `
      ${statCard(stats.total, 'Total Candidats', 'fa-users', '')}
      ${statCard(stats.valid, 'Validés', 'fa-circle-check', 'green')}
      ${statCard(stats.attente, 'En attente', 'fa-clock', 'yellow')}`;
  } else if (r === 'AGENT' || r === 'STTC') {
    cards = `
      ${statCard(stats.aptes, 'Aptes (à remettre)', 'fa-id-card', 'green')}
      ${statCard(stats.retires, 'Permis remis', 'fa-check-double', '')}`;
  }

  // Liste des examens récents (pour REGION, AGENT, AUTO_ECOLE)
    let examsHtml = '';
  if (res.exams && res.exams.length) {
    examsHtml = `<div class="card">
      <div class="card-header"><h3><i class="fas fa-calendar-days" style="color:var(--blue)"></i> Examens récents</h3></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Type</th><th>Date</th><th>Lieu</th><th>Statut</th></tr></thead>
        <tbody>
        ${res.exams.slice(0, 8).map(e => `<tr>
          <td><b>${esc(e.type_examen)}</b></td>
          <td>${formatDateFR(e.date_examen)}</td>
          <td>${esc(e.lieu || '—')}</td>
          <td>${statutBadge(e.statut)}</td>
        </tr>`).join('')}
        </tbody>
      </table></div>
    </div>`;
  }

  // Sauvegarde globale Excel (SUPER_ADMIN uniquement)
  let backupHtml = '';
  if (r === 'SUPER_ADMIN') {
    backupHtml = `<div class="card" style="border-left:5px solid #8b5cf6;"><div class="card-body text-center">
      <i class="fas fa-database" style="font-size:2.5rem;color:#8b5cf6;"></i>
      <h4 style="margin:12px 0 6px;">Sauvegarde complète</h4>
      <p class="text-muted" style="margin-bottom:14px;">Téléchargez une copie Excel de toute la base (toutes régions, auto-écoles, candidats, examens).</p>
      <button class="btn btn-primary" style="background:linear-gradient(135deg,#8b5cf6,#a78bfa);" onclick="sauvegardeGlobale()"><i class="fas fa-download"></i> Télécharger la sauvegarde (Excel)</button>
    </div></div>`;
  }

  // Tableau de consultation des candidats (REGION, AUTO_ECOLE, AGENT)
  let tableHtml = '';
  if (r !== 'SUPER_ADMIN' && r !== 'STTC' && res.inscriptions) {
    const inss = res.inscriptions;
    const examsForSelect = res.exams || [];
    const isAgent = (r === 'AGENT');
    tableHtml = `<div class="card">
      <div class="card-header"><h3><i class="fas fa-list-alt" style="color:var(--blue)"></i> ${isAgent ? 'Candidats APTES et remise de permis' : 'Recherche et consultation des candidats'}</h3></div>
      <div style="padding:14px 20px;display:flex;gap:12px;flex-wrap:wrap;align-items:center;">
        <select id="dashExamFilter" onchange="applyDashFilter()" style="max-width:240px;"><option value="">-- Tous les examens --</option>${examsForSelect.map(e => `<option value="${e.id}">${esc(e.type_examen)} - ${formatDateFR(e.date_examen)}</option>`).join('')}</select>
        <div class="search-bar" style="flex:1;"><i class="fas fa-search"></i><input id="dashSearch" placeholder="Rechercher nom, pièce, auto-école..." oninput="applyDashFilter()"></div>
      </div>
      <div id="dashTable" class="table-wrap" style="padding:0 20px 20px;"></div>
    </div>`;
    // Stocker pour filtrage
    window._dashInscriptions = inss;
    window._dashIsAgent = isAgent;
  }

  content.innerHTML = `
    <div class="fade-in">
      ${setTitle('Tableau de bord')}
      <div class="stats-grid">${cards}</div>
      ${tableHtml}
      ${examsHtml}
      ${backupHtml}
      <div class="card"><div class="card-body">
        <h4 style="margin-top:0;"><i class="fas fa-circle-info" style="color:var(--blue)"></i> Bienvenue sur SIGEXPC 2.0</h4>
        <p class="text-muted" style="line-height:1.7;">Cette plateforme moderne remplace l'ancien système Google Apps Script.
        Elle utilise une <b>base de données SQLite/MySQL</b> pour des performances optimales, une <b>API Node.js</b> robuste,
        et une <b>interface repensée</b> avec un thème inspiré de la signalisation routière.</p>
      </div></div>
    </div>`;
  // Rendre le tableau du dashboard si présent
  if (window._dashInscriptions) setTimeout(applyDashFilter, 50);
}

// Filtre du tableau de candidats du dashboard
function applyDashFilter() {
  const examFilter = document.getElementById('dashExamFilter');
  const searchInput = document.getElementById('dashSearch');
  const wrap = document.getElementById('dashTable');
  if (!wrap) return;
  const exId = examFilter ? examFilter.value : '';
  const q = searchInput ? searchInput.value.toLowerCase() : '';
  let list = window._dashInscriptions || [];
  if (exId) list = list.filter(c => c.idExamen === exId);
  if (q) list = list.filter(c => String(c.nomPrenoms).toLowerCase().includes(q) || String(c.piece).toLowerCase().includes(q) || String(c.autoEcole).toLowerCase().includes(q));
  const isAgent = window._dashIsAgent;
  list.sort((a,b)=>String(a.nomPrenoms).localeCompare(String(b.nomPrenoms)));
  wrap.innerHTML = `<table>
    <thead><tr><th>N°</th><th>Nom</th><th>Identifiant</th><th>Cat.</th><th>Auto-école</th><th>Examen</th><th>Statut</th>${isAgent ? '<th style="text-align:center;">Action</th>' : ''}</tr></thead>
    <tbody>
    ${list.length === 0 ? `<tr><td colspan="${isAgent?8:7}"><div class="empty-state"><i class="fas fa-folder-open"></i><p>Aucun candidat pour cette sélection.</p></div></td></tr>` :
      list.slice(0, 500).map((c,i) => `<tr>
        <td>${i+1}</td>
        <td><b>${esc(c.nomPrenoms)}</b></td>
        <td style="font-family:monospace;">${esc(c.piece)}</td>
        <td><span class="badge badge-info">${esc(c.cat)}</span></td>
        <td>${esc(c.autoEcole)}</td>
        <td>${esc(c.examLabel)}</td>
        <td>${statutBadge(c.statut)}</td>
        ${isAgent ? `<td style="text-align:center;">${c.statut==='APTE' ? `<button class="btn btn-sm btn-success" onclick="remettrePermis('${c.idInsc}','${esc(c.nomPrenoms)}')"><i class="fas fa-id-card"></i> Remettre</button>` : ''}</td>` : ''}
      </tr>`).join('')}
    </tbody>
  </table>${list.length>500?`<p class="text-muted" style="text-align:center;padding:10px;">Affichage des 500 premiers sur ${list.length}. Utilisez la recherche pour filtrer.</p>`:''}`;
}

// Sauvegarde Excel globale (SUPER_ADMIN)
function sauvegardeGlobale() {
  toast('Génération de la sauvegarde Excel...', 'info');
  window.open('/api/abonnements/backup', '_blank');
}

function statCard(value, label, icon, color = '') {
  return `<div class="stat-card ${color}">
    <i class="fas ${icon} stat-icon-bg"></i>
    <div class="stat-label">${label}</div>
    <div class="stat-value">${value ?? 0}</div>
  </div>`;
}

// ============================================================================
//  DIRECTIONS RÉGIONALES (SUPER_ADMIN)
// ============================================================================
async function openRegions() {
  const content = document.getElementById('content');
  content.innerHTML = loaderHTML();
  const res = await API.regions();
  const list = res.list || [];

  content.innerHTML = `<div class="fade-in">
    ${setTitle('Directions Régionales', `<button class="btn btn-primary" onclick="regionForm()"><i class="fas fa-plus"></i> Nouvelle région</button>`)}
    <div class="card"><div class="table-wrap"><table>
      <thead><tr><th>Nom</th><th>Email</th><th>Téléphone</th><th>Adresse</th><th>Code secret</th><th>Statut</th><th>Actions</th></tr></thead>
      <tbody>
      ${list.length === 0 ? `<tr><td colspan="7">${emptyState('Aucune direction régionale.', 'fa-building').outerHTML}</td></tr>` :
        list.map(r => `<tr>
          <td><b>${esc(r.nom_region)}</b></td>
          <td>${esc(r.admin_email || '—')}</td>
          <td>${esc(r.admin_nom || '—')}</td>
          <td>${esc(r.adresse || '—')}</td>
          <td><span class="badge badge-info"><i class="fas fa-key"></i> ${esc(r.code_acces || '—')}</span></td>
          <td>${statutBadge(r.statut)}</td>
          <td><div class="action-btns">
            <button class="act-btn edit" onclick='regionForm(${JSON.stringify(r)})' title="Modifier"><i class="fas fa-pen"></i></button>
            <button class="act-btn delete" onclick="deleteRegion('${r.id}','${esc(r.nom_region)}')" title="Supprimer"><i class="fas fa-trash"></i></button>
          </div></td>
        </tr>`).join('')}
      </tbody>
    </table></div></div>
  </div>`;
}

async function regionForm(r = null) {
  const html = `
    <div class="form-group"><label>Nom de la direction *</label><input name="nom" value="${r ? esc(r.nom_region) : ''}"></div>
    <div class="form-group"><label>Email</label><input name="email" type="email" value="${r ? esc(r.admin_email || '') : ''}"></div>
    <div class="form-group"><label>Téléphone / Contact</label><input name="telephone" value="${r ? esc(r.admin_nom || '') : ''}"></div>
    <div class="form-group"><label>Adresse</label><input name="adresse" value="${r ? esc(r.adresse || '') : ''}"></div>
    ${r ? `<div class="form-group" style="grid-column:1/-1"><label class="chk"><input type="checkbox" name="resetCode"> Réinitialiser le mot de passe</label></div>` : ''}
  `;
  const data = await formModal(r ? 'Modifier la direction' : 'Nouvelle direction régionale', html);
  if (!data) return;
  if (!data.nom) return toast('Le nom est obligatoire.', 'error');
  let res;
  if (r) {
    res = await API.updateRegion(r.id, data);
    if (res.success && res.newCode) alertModal('Nouveau mot de passe', `Transmettez ce mot de passe à la direction :<br><br><b style="font-size:1.8rem;color:var(--blue);font-family:monospace;letter-spacing:2px;">${res.newCode}</b>`, 'fa-key', 'success');
  } else {
    res = await API.createRegion(data);
    if (res.success && res.code) alertModal('Accès créé', `Transmettez ce mot de passe à la direction :<br><br><b style="font-size:1.8rem;color:var(--blue);font-family:monospace;letter-spacing:2px;">${res.code}</b>`, 'fa-key', 'success');
  }
  if (res.success) { toast('Enregistré avec succès.', 'success'); openRegions(); }
  else toast(res.msg || 'Erreur.', 'error');
}

async function deleteRegion(id, name) {
  if (!await confirmModal('Supprimer', `Supprimer la direction <b>${esc(name)}</b> ?<br><b class="text-danger">Toutes les auto-écoles et candidats liés seront supprimés.</b>`, 'Supprimer', true)) return;
  const res = await API.deleteRegion(id);
  if (res.success) { toast('Supprimé.', 'success'); openRegions(); }
  else toast(res.msg || 'Erreur.', 'error');
}

// ============================================================================
//  AUTO-ÉCOLES (REGION)
// ============================================================================
async function openAutoEcoles() {
  const content = document.getElementById('content');
  content.innerHTML = loaderHTML();
  const res = await API.autoEcoles();
  const list = res.list || [];
  content.innerHTML = `<div class="fade-in">
    ${setTitle('Auto-Écoles agrées', `<button class="btn btn-primary" onclick="aeForm()"><i class="fas fa-plus"></i> Nouvelle auto-école</button>`)}
    <div class="card"><div class="table-wrap"><table>
      <thead><tr><th>Nom</th><th>Email</th><th>Téléphone</th><th>Adresse</th><th>Code secret</th><th>Statut</th><th>Actions</th></tr></thead>
      <tbody>
      ${list.length === 0 ? `<tr><td colspan="7"><div class="empty-state"><i class="fas fa-school"></i><p>Aucune auto-école.</p></div></td></tr>` :
        list.map(a => `<tr>
          <td><b>${esc(a.nom)}</b></td>
          <td>${esc(a.email_admin || '—')}</td>
          <td>${esc(a.telephone || '—')}</td>
          <td>${esc(a.adresse || '—')}</td>
          <td><span class="badge badge-info"><i class="fas fa-key"></i> ${esc(a.code_acces || '—')}</span></td>
          <td>${statutBadge(a.statut)}</td>
          <td><div class="action-btns">
            <button class="act-btn edit" onclick='aeForm(${JSON.stringify(a)})'><i class="fas fa-pen"></i></button>
            <button class="act-btn delete" onclick="deleteAE('${a.id}','${esc(a.nom)}')"><i class="fas fa-trash"></i></button>
          </div></td>
        </tr>`).join('')}
      </tbody>
    </table></div></div>
  </div>`;
}

async function aeForm(a = null) {
  const html = `
    <div class="form-group"><label>Nom *</label><input name="nom" value="${a ? esc(a.nom) : ''}"></div>
    <div class="form-group"><label>Email</label><input name="email" type="email" value="${a ? esc(a.email || '') : ''}"></div>
    <div class="form-group"><label>Téléphone</label><input name="telephone" value="${a ? esc(a.telephone || '') : ''}"></div>
    <div class="form-group"><label>Adresse</label><input name="adresse" value="${a ? esc(a.adresse || '') : ''}"></div>
    ${a ? `<div class="form-group" style="grid-column:1/-1"><label class="chk"><input type="checkbox" name="resetCode"> Générer un nouveau mot de passe</label></div>` : ''}
  `;
  const data = await formModal(a ? "Modifier l'auto-école" : 'Nouvelle auto-école', html);
  if (!data) return;
  if (!data.nom) return toast('Le nom est obligatoire.', 'error');
  let res;
  if (a) {
    res = await API.updateAE(a.id, data);
    if (res.success && res.newCode) toast(`Nouveau mot de passe : ${res.newCode}`, 'success', 8000);
  } else {
    res = await API.createAE(data);
    if (res.success && res.code) toast(`Mot de passe généré : ${res.code}`, 'success', 8000);
  }
  if (res.success) { toast('Enregistré.', 'success'); openAutoEcoles(); }
  else toast(res.msg || 'Erreur.', 'error');
}

async function deleteAE(id, name) {
  if (!await confirmModal('Supprimer', `Supprimer l'auto-école <b>${esc(name)}</b> ?<br><b class="text-danger">Tous ses candidats seront supprimés.</b>`, 'Supprimer', true)) return;
  const res = await API.deleteAE(id);
  if (res.success) { toast('Supprimé.', 'success'); openAutoEcoles(); }
  else toast(res.msg || 'Erreur.', 'error');
}

// ============================================================================
//  AGENTS VÉRIFICATEURS (REGION)
// ============================================================================
async function openAgents() {
  const content = document.getElementById('content');
  content.innerHTML = loaderHTML();
  const res = await API.agents();
  const list = res.list || [];
  content.innerHTML = `<div class="fade-in">
    ${setTitle('Agents vérificateurs', `<button class="btn btn-primary" onclick="agentForm()"><i class="fas fa-plus"></i> Nouvel agent</button>`)}
    <div class="card"><div class="table-wrap"><table>
      <thead><tr><th>Nom</th><th>Email</th><th>Spécialité</th><th>Code secret</th><th>Statut</th><th>Actions</th></tr></thead>
      <tbody>
      ${list.length === 0 ? `<tr><td colspan="6"><div class="empty-state"><i class="fas fa-user-shield"></i><p>Aucun agent.</p></div></td></tr>` :
        list.map(a => `<tr>
          <td><b>${esc(a.nom)}</b></td>
          <td>${esc(a.email || '—')}</td>
          <td>${esc(a.specialite || '—')}</td>
          <td><span class="badge badge-info"><i class="fas fa-key"></i> ${esc(a.code_acces || '—')}</span></td>
          <td>${statutBadge(a.statut)}</td>
          <td><div class="action-btns">
            <button class="act-btn edit" onclick='agentForm(${JSON.stringify(a)})'><i class="fas fa-pen"></i></button>
            <button class="act-btn delete" onclick="deleteAgent('${a.id}','${esc(a.nom)}')"><i class="fas fa-trash"></i></button>
          </div></td>
        </tr>`).join('')}
      </tbody>
    </table></div></div>
  </div>`;
}

async function agentForm(a = null) {
  const html = `
    <div class="form-group" style="grid-column:1/-1"><label>Nom et prénoms *</label><input name="nom" value="${a ? esc(a.nom) : ''}"></div>
    <div class="form-group" style="grid-column:1/-1"><label>Email</label><input name="email" type="email" value="${a ? esc(a.email || '') : ''}"></div>
    <div class="form-group" style="grid-column:1/-1"><label>Spécialité</label><input name="specialite" placeholder="Code, Conduite..." value="${a ? esc(a.specialite || '') : ''}"></div>
    ${a ? `<div class="form-group" style="grid-column:1/-1"><label class="chk"><input type="checkbox" name="resetCode"> Réinitialiser le mot de passe</label></div>` : ''}
  `;
  const data = await formModal(a ? "Modifier l'agent" : 'Nouvel agent', html);
  if (!data) return;
  if (!data.nom) return toast('Le nom est obligatoire.', 'error');
  let res;
  if (a) {
    res = await API.updateAgent(a.id, data);
    if (res.success && res.newCode) toast(`Nouveau mot de passe : ${res.newCode}`, 'success', 8000);
  } else {
    res = await API.createAgent(data);
    if (res.success && res.code) toast(`Mot de passe généré : ${res.code}`, 'success', 8000);
  }
  if (res.success) { toast('Enregistré.', 'success'); openAgents(); }
  else toast(res.msg || 'Erreur.', 'error');
}

async function deleteAgent(id, name) {
  if (!await confirmModal('Supprimer', `Supprimer l'agent <b>${esc(name)}</b> ?`, 'Supprimer', true)) return;
  const res = await API.deleteAgent(id);
  if (res.success) { toast('Supprimé.', 'success'); openAgents(); }
  else toast(res.msg || 'Erreur.', 'error');
}

// ============================================================================
//  STTC USERS (REGION)
// ============================================================================
async function openSTTCUsers() {
  const content = document.getElementById('content');
  content.innerHTML = loaderHTML();
  const res = await API.sttcUsers();
  const list = res.list || [];
  content.innerHTML = `<div class="fade-in">
    ${setTitle('Agents STTC', `<button class="btn btn-primary" onclick="sttcForm()"><i class="fas fa-plus"></i> Nouvel agent</button>`)}
    <div class="card"><div class="table-wrap"><table>
      <thead><tr><th>Nom</th><th>Email</th><th>Code secret</th><th>Statut</th><th>Actions</th></tr></thead>
      <tbody>
      ${list.length === 0 ? `<tr><td colspan="5"><div class="empty-state"><i class="fas fa-users-cog"></i><p>Aucun agent STTC.</p></div></td></tr>` :
        list.map(a => `<tr>
          <td><b>${esc(a.nom)}</b></td>
          <td>${esc(a.email || '—')}</td>
          <td><span class="badge badge-info"><i class="fas fa-key"></i> ${esc(a.code_acces || '—')}</span></td>
          <td>${statutBadge(a.statut)}</td>
          <td><div class="action-btns">
            <button class="act-btn edit" onclick='sttcForm(${JSON.stringify(a)})'><i class="fas fa-pen"></i></button>
            <button class="act-btn delete" onclick="deleteSTTC('${a.id}','${esc(a.nom)}')"><i class="fas fa-trash"></i></button>
          </div></td>
        </tr>`).join('')}
      </tbody>
    </table></div></div>
  </div>`;
}

async function sttcForm(a = null) {
  const html = `
    <div class="form-group" style="grid-column:1/-1"><label>Nom et prénoms *</label><input name="nom" value="${a ? esc(a.nom) : ''}"></div>
    <div class="form-group" style="grid-column:1/-1"><label>Email</label><input name="email" type="email" value="${a ? esc(a.email || '') : ''}"></div>
    ${a ? `<div class="form-group" style="grid-column:1/-1"><label class="chk"><input type="checkbox" name="resetCode"> Réinitialiser le mot de passe</label></div>` : ''}
  `;
  const data = await formModal(a ? "Modifier l'agent STTC" : 'Nouvel agent STTC', html);
  if (!data) return;
  if (!data.nom) return toast('Le nom est obligatoire.', 'error');
  let res;
  if (a) {
    res = await API.updateSTTC(a.id, data);
    if (res.success && res.newCode) toast(`Nouveau mot de passe : ${res.newCode}`, 'success', 8000);
  } else {
    res = await API.createSTTC(data);
    if (res.success && res.code) toast(`Mot de passe généré : ${res.code}`, 'success', 8000);
  }
  if (res.success) { toast('Enregistré.', 'success'); openSTTCUsers(); }
  else toast(res.msg || 'Erreur.', 'error');
}

async function deleteSTTC(id, name) {
  if (!await confirmModal('Supprimer', `Supprimer <b>${esc(name)}</b> ?`, 'Supprimer', true)) return;
  const res = await API.deleteSTTC(id);
  if (res.success) { toast('Supprimé.', 'success'); openSTTCUsers(); }
  else toast(res.msg || 'Erreur.', 'error');
}

// ============================================================================
//  CENTRES D'EXAMEN (REGION)
// ============================================================================
async function openCentres() {
  const content = document.getElementById('content');
  content.innerHTML = loaderHTML();
  const res = await API.centres();
  const list = res.list || [];
  content.innerHTML = `<div class="fade-in">
    ${setTitle("Centres d'examen", `<button class="btn btn-ghost" onclick="openExamens()"><i class="fas fa-arrow-left"></i> Retour aux examens</button><button class="btn btn-primary" onclick="centreForm()"><i class="fas fa-plus"></i> Nouveau centre</button>`)}
    <div class="card"><div class="table-wrap"><table>
      <thead><tr><th>Nom du centre</th><th>Actions</th></tr></thead>
      <tbody>
      ${list.length === 0 ? `<tr><td colspan="2"><div class="empty-state"><i class="fas fa-map-marker-alt"></i><p>Aucun centre.</p></div></td></tr>` :
        list.map(c => `<tr>
          <td><b>${esc(c.nom_centre || c.nom)}</b></td>
          <td><button class="act-btn delete" onclick="deleteCentre('${c.id}','${esc(c.nom_centre || c.nom)}')"><i class="fas fa-trash"></i></button></td>
        </tr>`).join('')}
      </tbody>
    </table></div></div>
  </div>`;
}

async function centreForm() {
  const data = await formModal('Nouveau centre', `<div class="form-group" style="grid-column:1/-1"><label>Nom du centre *</label><input name="nom"></div>`);
  if (!data) return;
  if (!data.nom) return toast('Le nom est obligatoire.', 'error');
  const res = await API.createCentre(data);
  if (res.success) { toast('Centre ajouté.', 'success'); openCentres(); }
  else toast(res.msg || 'Erreur.', 'error');
}

async function deleteCentre(id, name) {
  if (!await confirmModal('Supprimer', `Supprimer le centre <b>${esc(name)}</b> ?`, 'Supprimer', true)) return;
  const res = await API.deleteCentre(id);
  if (res.success) { toast('Supprimé.', 'success'); openCentres(); }
  else toast(res.msg || 'Erreur.', 'error');
}

// ============================================================================
//  CONFIGURATION (DIRECTION RÉGIONALE)
// ============================================================================
async function openConfigRegion() {
  const content = document.getElementById('content');
  document.getElementById('pageTitle').innerText = 'Configuration';
  content.innerHTML = loaderHTML();

  let info = { email: '', nom: '', whatsapp: '', directeur: '', directeurEmail: '', directeurWhatsapp: '' };
  try {
    const res = await fetch('/api/auth/config-region', { credentials: 'include' }).then(r => r.json());
    if (res.success) info = res.info;
  } catch (e) {}

  content.innerHTML = `<div class="fade-in">
    ${setTitle('Configuration', `<button class="btn btn-sm btn-ghost" onclick="openConfigRegion()"><i class="fas fa-sync"></i></button>`)}

    <div class="card" style="margin-bottom:20px;">
      <div style="padding:18px 25px;border-bottom:1px solid var(--border);">
        <h3 style="margin:0;font-size:1.05rem;"><i class="fas fa-building" style="color:var(--blue);"></i> Informations de la direction</h3>
        <p style="margin:5px 0 0;font-size:0.82rem;color:var(--gray);">Coordonnées de votre direction regionale.</p>
      </div>
      <div style="padding:25px;">
        <div class="form-row-grid">
          <div class="form-group">
            <label><i class="fas fa-user" style="color:var(--blue);"></i> Nom du responsable</label>
            <input id="cfgNom" type="text" value="${esc(info.nom || '')}" placeholder="Nom du responsable">
          </div>
          <div class="form-group">
            <label><i class="fas fa-envelope" style="color:var(--blue);"></i> Email de la direction</label>
            <input id="cfgEmail" type="email" value="${esc(info.email || '')}" placeholder="email@direction.ci">
          </div>
          <div class="form-group">
            <label><i class="fab fa-whatsapp" style="color:var(--green);"></i> WhatsApp de la direction</label>
            <input id="cfgWhatsapp" type="tel" value="${esc(info.whatsapp || '')}" placeholder="+225 07 00 00 00 00">
          </div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:20px;">
      <div style="padding:18px 25px;border-bottom:1px solid var(--border);">
        <h3 style="margin:0;font-size:1.05rem;"><i class="fas fa-user-tie" style="color:var(--yellow);"></i> Directeur / Directrice regional(e)</h3>
        <p style="margin:5px 0 0;font-size:0.82rem;color:var(--gray);">Ces informations apparaissent automatiquement sur les bordereaux et documents officiels.</p>
      </div>
      <div style="padding:25px;">
        <div class="form-row-grid">
          <div class="form-group">
            <label><i class="fas fa-id-badge" style="color:var(--yellow);"></i> Nom et prenoms</label>
            <input id="cfgDirecteur" type="text" value="${esc(info.directeur || '')}" placeholder="Ex: DIOMANDE AHMED">
          </div>
          <div class="form-group">
            <label><i class="fas fa-envelope" style="color:var(--yellow);"></i> Email du directeur</label>
            <input id="cfgDirecteurEmail" type="email" value="${esc(info.directeurEmail || '')}" placeholder="directeur@direction.ci">
          </div>
          <div class="form-group">
            <label><i class="fab fa-whatsapp" style="color:var(--green);"></i> WhatsApp du directeur</label>
            <input id="cfgDirecteurWhatsapp" type="tel" value="${esc(info.directeurWhatsapp || '')}" placeholder="+225 07 00 00 00 00">
          </div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:20px;">
      <div style="padding:18px 25px;border-bottom:1px solid var(--border);">
        <h3 style="margin:0;font-size:1.05rem;"><i class="fas fa-lock" style="color:var(--danger);"></i> Securite - Changer le mot de passe</h3>
        <p style="margin:5px 0 0;font-size:0.82rem;color:var(--gray);">Laissez vide si vous ne souhaitez pas changer le mot de passe.</p>
      </div>
      <div style="padding:25px;">
        <div class="form-row-grid">
          <div class="form-group">
            <label><i class="fas fa-key" style="color:var(--danger);"></i> Ancien mot de passe</label>
            <input id="cfgOldPass" type="password" placeholder="Votre mot de passe actuel">
          </div>
          <div class="form-group">
            <label><i class="fas fa-lock" style="color:var(--danger);"></i> Nouveau mot de passe</label>
            <input id="cfgNewPass" type="password" placeholder="Nouveau mot de passe">
          </div>
        </div>
      </div>
    </div>

    <div style="text-align:center;padding:10px 0 30px;">
      <button class="btn btn-primary" style="padding:14px 50px;font-size:1.05rem;border-radius:30px;" onclick="saveConfigRegion()">
        <i class="fas fa-save"></i> ENREGISTRER LES MODIFICATIONS
      </button>
    </div>
  </div>`;
}

async function saveConfigRegion() {
  const data = {
    nom: document.getElementById('cfgNom').value.trim(),
    email: document.getElementById('cfgEmail').value.trim(),
    whatsapp: document.getElementById('cfgWhatsapp').value.trim(),
    directeur: document.getElementById('cfgDirecteur').value.trim(),
    directeurEmail: document.getElementById('cfgDirecteurEmail').value.trim(),
    directeurWhatsapp: document.getElementById('cfgDirecteurWhatsapp').value.trim(),
    oldPass: document.getElementById('cfgOldPass').value,
    newPass: document.getElementById('cfgNewPass').value
  };

  if (data.newPass && !data.oldPass) {
    return toast('Veuillez saisir votre ancien mot de passe.', 'error');
  }

  try {
    const res = await fetch('/api/auth/config-region', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data)
    }).then(r => r.json());

    if (res.success) {
      toast('Configuration enregistree avec succes.', 'success');
      document.getElementById('cfgOldPass').value = '';
      document.getElementById('cfgNewPass').value = '';
    } else {
      toast(res.msg || 'Erreur lors de l\'enregistrement.', 'error');
    }
  } catch (e) {
    toast('Erreur reseau: ' + e.message, 'error');
  }
}
