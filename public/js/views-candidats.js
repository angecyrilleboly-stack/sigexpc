// ============================================================================
//  SIGEXPC - Vues métier (partie 2) : Candidats, Examens, Inscriptions
// ============================================================================
// (Suite de views.js — utilise les mêmes helpers : setTitle, toast, etc.)

// ============================================================================
//  CANDIDATS (AUTO_ECOLE)
// ============================================================================
let _candidatsList = [];

async function openCandidats() {
  document.getElementById('pageTitle').innerText = 'Nouveaux Dossiers';
  const content = document.getElementById('content');
  content.innerHTML = loaderHTML();
  const res = await API.candidats();
  _candidatsList = res.list || [];
  _candidatsFilter = 'purs';
  renderCandidats();
}

let _candidatsFilter = 'purs';
let _editingCandId = null;

function renderCandidats(filter = '') {
  let baseList = _candidatsList;
  if (_candidatsFilter === 'purs') {
    baseList = _candidatsList.filter(c => {
      const st = String(c.statut);
      return st === 'En attente' || st === 'En attente (Code)';
    });
  }
  const list = baseList.filter(c => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return String(c.nom).toLowerCase().includes(q) || String(c.numero_piece).toLowerCase().includes(q);
  });

  const isEdit = _editingCandId !== null;
  const editCand = isEdit ? _candidatsList.find(c => c.id === _editingCandId) : null;

  document.getElementById('content').innerHTML = `<div class="fade-in">
    ${setTitle('Nouveaux Dossiers')}
    <div class="card">
      <h4 style="margin-top:0;color:var(--blue);font-size:1.2rem;"><i class="fas fa-user-edit" style="color:var(--yellow);"></i> ${isEdit ? 'Modifier le dossier' : 'Enregistrer un nouveau candidat'}</h4>
      <div class="form-row-grid">
        <input id="cNom" type="text" placeholder="Nom et Prénoms (ex: KOUASSI Ange)" value="${editCand ? esc(editCand.nom) : ''}">
        <input id="cPiece" type="text" placeholder="Identifiant (N° Pièce)" value="${editCand ? esc(editCand.numero_piece) : ''}">
        <select id="cCat">
          ${['A','AB','BCDE','ABCDE'].map(x => `<option value="${x}" ${editCand && editCand.categorie === x ? 'selected' : ''} ${!editCand && x === 'ABCDE' ? 'selected' : ''}>${x}</option>`).join('')}
        </select>
        <select id="cEtape">
          <option value="Code" ${!editCand || String(editCand.statut).includes('Code') ? 'selected' : ''}>Commencer par le Code</option>
          <option value="Conduite" ${editCand && String(editCand.statut).includes('Conduite') ? 'selected' : ''}>Commencer par la Conduite</option>
        </select>
      </div>
      <div style="display:flex;gap:10px;margin-top:10px;">
        <button class="btn btn-primary" onclick="executeCandidatSave()"><i class="fas fa-file-alt"></i> ${isEdit ? 'METTRE À JOUR LE DOSSIER' : 'ENREGISTRER LE DOSSIER'}</button>
        ${isEdit ? `<button class="btn btn-ghost" onclick="_editingCandId=null;renderCandidats()"><i class="fas fa-times"></i> ANNULER LA MODIFICATION</button>` : ''}
      </div>
    </div>
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:15px;">
        <h4 style="margin:0;color:var(--blue);"><i class="fas fa-folder-open" style="color:var(--yellow);"></i> Dossiers purs (En attente d'inscription)</h4>
        <div class="flex gap-8" style="flex-wrap:wrap;">
          <div class="search-box" style="width:250px;"><i class="fas fa-search" style="color:var(--light-blue);"></i><input id="candSearch" placeholder="Rechercher..." value="${esc(filter)}" oninput="renderCandidats(this.value)"></div>
          <select onchange="_candidatsFilter=this.value;renderCandidats('${esc(filter)}')" style="max-width:200px;">
            <option value="purs" ${_candidatsFilter === 'purs' ? 'selected' : ''}>Dossiers purs</option>
            <option value="tous" ${_candidatsFilter === 'tous' ? 'selected' : ''}>Tous les candidats</option>
          </select>
        </div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>N°</th><th>NOM ET PRÉNOMS</th><th>IDENTIFIANT</th><th>CATÉGORIE</th><th>ÉTAPE ACTUELLE</th><th>ACTIONS</th></tr></thead>
        <tbody>
        ${list.length === 0 ? `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--gray);">Aucun dossier en attente.</td></tr>` :
          list.map((c, i) => `<tr>
            <td style="color:var(--gray);font-weight:bold;">${i + 1}</td>
            <td><b style="font-size:1.05rem;">${esc(c.nom)}</b></td>
            <td style="font-family:monospace;font-size:1.1rem;color:var(--blue);font-weight:bold;">${esc(c.numero_piece)}</td>
            <td><span style="background:var(--bg);padding:4px 10px;border-radius:6px;font-weight:bold;font-size:0.85rem;border:1px solid var(--border-color);">${esc(c.categorie)}</span></td>
            <td><span class="badge badge-info"><i class="fas fa-hourglass-half"></i> En attente (Code)</span></td>
            <td><div class="action-btns">
              <button class="act-btn edit" onclick="editCandidatAction('${c.id}')" title="Modifier"><i class="fas fa-edit"></i></button>
              <button class="act-btn delete" onclick="deleteCandidat('${c.id}','${esc(c.nom)}')" title="Supprimer"><i class="fas fa-trash-alt"></i></button>
            </div></td>
          </tr>`).join('')}
        </tbody>
      </table></div>
    </div>
  </div>`;
}

function editCandidatAction(id) {
  _editingCandId = id;
  renderCandidats();
  document.querySelector('#content').scrollIntoView({ behavior: 'smooth' });
}

async function executeCandidatSave() {
  const nomPrenoms = document.getElementById('cNom').value.trim();
  const piece = document.getElementById('cPiece').value.trim();
  const categorie = document.getElementById('cCat').value;
  const etape = document.getElementById('cEtape').value;
  if (!nomPrenoms || !piece) return toast('Nom et identifiant obligatoires.', 'error');
  let res;
  if (_editingCandId) {
    res = await API.updateCandidat(_editingCandId, { nomPrenoms, piece, categorie, etape });
  } else {
    res = await API.createCandidat({ nomPrenoms, piece, categorie, etape });
  }
  if (res.success) {
    toast(_editingCandId ? 'Dossier mis à jour.' : 'Dossier enregistré.', 'success');
    _editingCandId = null;
    const r = await API.candidats();
    _candidatsList = r.list || [];
    renderCandidats();
  } else toast(res.msg || 'Erreur.', 'error');
}

async function deleteCandidat(id, name) {
  if (!await confirmModal('Supprimer', `Supprimer le candidat <b>${esc(name)}</b> ?<br>Ses inscriptions aux examens seront aussi supprimées.`, 'Supprimer', true)) return;
  const res = await API.deleteCandidat(id);
  if (res.success) { toast('Supprimé.', 'success'); openCandidats(); }
  else toast(res.msg || 'Erreur.', 'error');
}

// ============================================================================
//  EXAMENS (REGION) — planification complète avec statut 3 états
// ============================================================================
async function openExamens() {
  const content = document.getElementById('content');
  content.innerHTML = loaderHTML();
  const [exRes, centresRes] = await Promise.all([API.examens(), USER.role === 'REGION' ? API.centres() : Promise.resolve({ list: [] })]);
  const list = exRes.list || [];
  window._centresCache = centresRes.list || [];

  content.innerHTML = `<div class="fade-in">
    ${setTitle('Planification des examens', `
      <button class="btn btn-warning" onclick="openCentres()"><i class="fas fa-map-marked-alt"></i> Gérer les centres d'examen</button>
      <button class="btn btn-primary" onclick="examenForm()"><i class="fas fa-plus"></i> Programmer un examen</button>
    `)}
    <div class="card"><div class="table-wrap"><table>
      <thead><tr><th>Type et Date</th><th>Lieu</th><th>Inspecteur</th><th>Statut (bordereau)</th><th>Actions</th></tr></thead>
      <tbody>
      ${list.length === 0 ? `<tr><td colspan="5"><div class="empty-state"><i class="fas fa-calendar-days"></i><p>Aucun examen programmé.</p></div></td></tr>` :
        list.map(e => {
          const st = String(e.statut).trim();
          // Badge + bouton de bascule selon le statut (3 états)
          let badge, toggleBtn;
          if (st === 'ouvert') {
            badge = '<span class="badge badge-success"><i class="fas fa-unlock"></i> Liste ouverte</span>';
            toggleBtn = `<button class="btn btn-sm btn-ghost" onclick="setExamenStatut('${e.id}','rajout')" title="Ouvrir bordereau de rajout"><i class="fas fa-plus"></i> Ouvrir Rajout</button>`;
          } else if (st === 'rajout') {
            badge = '<span class="badge badge-warning"><i class="fas fa-plus-circle"></i> Bordereau de Rajout</span>';
            toggleBtn = `<button class="btn btn-sm btn-ghost" onclick="setExamenStatut('${e.id}','ferme')" title="Fermer les inscriptions"><i class="fas fa-lock"></i> Fermer tout</button>`;
          } else {
            badge = '<span class="badge badge-gray"><i class="fas fa-lock"></i> Inscriptions fermées</span>';
            toggleBtn = `<button class="btn btn-sm btn-ghost" onclick="setExamenStatut('${e.id}','ouvert')" title="Rouvrir"><i class="fas fa-unlock"></i> Rouvrir</button>`;
          }
          return `<tr>
            <td><b>${esc(e.type_examen)}</b><br><span class="text-muted" style="font-size:0.82rem;">${formatDateFR(e.date_examen)}</span></td>
            <td>${esc(e.lieu || '—')}</td>
            <td>${e.inspecteur_nom && e.inspecteur_nom !== 'À définir' ? `${esc(e.inspecteur_nom)}<br><span class="text-muted" style="font-size:0.78rem;">${esc(e.inspecteur_contact || '')}</span>` : '<span class="text-muted">—</span>'}</td>
            <td>${badge}</td>
            <td><div class="flex gap-8" style="flex-wrap:wrap;">
              ${toggleBtn}
              <button class="btn btn-sm btn-primary" onclick="goToSalle('${e.id}','${esc(e.type_examen)}','${formatDateFR(e.date_examen)}')"><i class="fas fa-door-open"></i> Gérer</button>
              <button class="act-btn edit" onclick='examenForm(${JSON.stringify(e)})'><i class="fas fa-pen"></i></button>
              <button class="act-btn delete" onclick="deleteExamen('${e.id}','${esc(e.type_examen)}')"><i class="fas fa-trash"></i></button>
            </div></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table></div></div>
  </div>`;
}

function goToSalle(id, type, date) { openSalleExam(id, type, date); }

async function examenForm(e = null) {
  const centres = window._centresCache || [];
  if (!centres.length) {
    if (!await confirmModal('Aucun centre', "Vous n'avez aucun centre d'examen enregistré. Voulez-vous en créer un d'abord ?", 'Créer un centre'))
      return;
    openCentres();
    return;
  }
  const today = dateToInput(new Date());
  const html = `
    <div class="form-group" style="grid-column:1/-1"><label>Type d'examen *</label><select name="type">
      <option value="Théorique (Code)" ${e && e.type_examen === 'Théorique (Code)' ? 'selected' : ''}>Théorique (Code)</option>
      <option value="Pratique (Conduite)" ${e && e.type_examen === 'Pratique (Conduite)' ? 'selected' : ''}>Pratique (Conduite)</option>
    </select></div>
    <div class="form-group"><label>Date prévue *</label><input name="date" type="date" value="${e ? dateToInput(e.date_examen) : today}"></div>
    <div class="form-group"><label>Lieu / Centre *</label><select name="lieu">
      <option value="">— Choisir un centre —</option>
      ${centres.map(c => `<option value="${esc(c.nom_centre || c.nom)}" ${e && e.lieu === (c.nom_centre || c.nom) ? 'selected' : ''}>${esc(c.nom_centre || c.nom)}</option>`).join('')}
    </select></div>
    <div class="form-group" style="grid-column:1/-1"><label>Inspecteur / Inspectrice (Nom et Prénoms)</label><input name="inspecteurNom" value="${e ? esc(e.inspecteur_nom || '') : ''}"></div>
    <div class="form-group" style="grid-column:1/-1"><label>Contact inspecteur (Téléphone / Email)</label><input name="inspecteurContact" value="${e ? esc(e.inspecteur_contact || '') : ''}"></div>
    <div class="form-group"><label>Agent 1</label><input name="agent1" value="${e ? esc(e.agent1 || '') : ''}"></div>
    <div class="form-group"><label>Agent 2</label><input name="agent2" value="${e ? esc(e.agent2 || '') : ''}"></div>
    <div class="form-group"><label>Agent 3</label><input name="agent3" value="${e ? esc(e.agent3 || '') : ''}"></div>
    <div class="form-group"><label>Agent 4</label><input name="agent4" value="${e ? esc(e.agent4 || '') : ''}"></div>
    <div class="form-group"><label>Agent 5</label><input name="agent5" value="${e ? esc(e.agent5 || '') : ''}"></div>
  `;
  const data = await formModal(e ? "Modifier la session d'examen" : 'Programmer une session', html, e ? 'Mettre à jour' : 'Créer la session');
  if (!data) return;
  if (!data.type || !data.date) return toast('Type et date obligatoires.', 'error');
  if (!data.lieu) return toast('Le lieu/centre est obligatoire.', 'error');
  let res;
  if (e) res = await API.updateExamen(e.id, data);
  else res = await API.createExamen(data);
  if (res.success) { toast('Session enregistrée.', 'success'); openExamens(); }
  else toast(res.msg || 'Erreur.', 'error');
}

async function setExamenStatut(id, statut) {
  const res = await API.setExamenStatus(id, statut);
  if (res.success) { toast('Statut modifié.', 'success'); openExamens(); }
  else toast(res.msg || 'Erreur.', 'error');
}

async function deleteExamen(id, type) {
  if (!await confirmModal('Supprimer', `Supprimer l'examen <b>${esc(type)}</b> ?<br><b class="text-danger">Les inscriptions associées seront supprimées.</b>`, 'Supprimer', true)) return;
  const res = await API.deleteExamen(id);
  if (res.success) { toast('Supprimé.', 'success'); openExamens(); }
  else toast(res.msg || 'Erreur.', 'error');
}

// ============================================================================
//  BORDEREAUX D'EXAMEN (REGION) - impression avant délibération
//  Sépare bordereau principal et bordereau de rajout (comme l'ancien)
// ============================================================================
async function openBordereaux() {
  const content = document.getElementById('content');
  content.innerHTML = loaderHTML();
  const res = await API.examens();
  const list = res.list || [];

  // Stats rapides
  const total = list.length;
  const ouverts = list.filter(e => String(e.statut) === 'ouvert' || String(e.statut) === 'rajout').length;
  const fermes = list.filter(e => String(e.statut) === 'ferme').length;

  content.innerHTML = `<div class="fade-in">
    ${setTitle("Bordereaux d'examen", `<button class="btn btn-sm btn-ghost" onclick="openBordereaux()"><i class="fas fa-sync"></i></button>`)}
    <div class="stats-grid" style="margin-bottom:20px;">
      <div class="stat-card" style="cursor:default;background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.15);">
        <i class="fas fa-file-lines stat-icon-bg" style="color:var(--blue);opacity:0.1;"></i>
        <div class="stat-label">Total examens</div>
        <div class="stat-value" style="color:var(--blue);">${total}</div>
      </div>
      <div class="stat-card" style="cursor:default;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.15);">
        <i class="fas fa-lock-open stat-icon-bg" style="color:var(--yellow);opacity:0.1;"></i>
        <div class="stat-label">Ouverts</div>
        <div class="stat-value" style="color:var(--yellow);">${ouverts}</div>
      </div>
      <div class="stat-card" style="cursor:default;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.15);">
        <i class="fas fa-lock stat-icon-bg" style="color:var(--danger);opacity:0.1;"></i>
        <div class="stat-label">Fermés</div>
        <div class="stat-value" style="color:var(--danger);">${fermes}</div>
      </div>
    </div>
    <div class="card">
      <div style="padding:18px 25px;border-bottom:1px solid var(--border);">
        <h3 style="margin:0;font-size:1.05rem;"><i class="fas fa-print" style="color:var(--blue);"></i> Impression des bordereaux</h3>
        <p style="margin:6px 0 0;font-size:0.82rem;color:var(--gray);">Cliquez sur <b style="color:var(--success);">Principal</b> pour la liste officielle ou <b style="color:var(--yellow);">Rajout</b> pour les ajouts de dernière minute.</p>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Session d'examen</th><th>Lieu</th><th>Statut</th><th style="text-align:center;">Bordereaux PDF</th></tr></thead>
        <tbody>
        ${list.length === 0 ? `<tr><td colspan="4"><div class="empty-state"><i class="fas fa-print"></i><p>Aucun examen programmé.</p></div></td></tr>` :
          list.map(e => {
            const st = String(e.statut);
            const icon = st === 'ouvert' ? 'fa-lock-open' : st === 'rajout' ? 'fa-plus-circle' : 'fa-lock';
            return `<tr style="transition:background 0.15s;" onmouseover="this.style.background='var(--table-hover)'" onmouseout="this.style.background=''">
              <td>
                <div style="display:flex;align-items:center;gap:10px;">
                  <div style="width:38px;height:38px;border-radius:10px;background:rgba(59,130,246,0.1);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                    <i class="fas ${String(e.type_examen).includes('Code') ? 'fa-book' : 'fa-car'}" style="color:var(--blue);font-size:0.9rem;"></i>
                  </div>
                  <div>
                    <b style="font-size:1rem;">${esc(e.type_examen)}</b><br>
                    <span style="font-size:0.8rem;color:var(--gray);"><i class="fas fa-calendar" style="font-size:0.7rem;"></i> ${formatDateFR(e.date_examen)}</span>
                  </div>
                </div>
              </td>
              <td><span style="font-size:0.88rem;color:var(--gray);"><i class="fas fa-map-marker-alt" style="font-size:0.75rem;"></i> ${esc(e.lieu || 'À définir')}</span></td>
              <td>${statutBadge(e.statut)}</td>
              <td>
                <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
                  <button class="btn btn-sm" style="background:var(--success);color:#fff;padding:8px 16px;border-radius:8px;font-weight:600;box-shadow:0 2px 8px rgba(16,185,129,0.25);" onclick="openDocument('/api/documents/bordereau/${e.id}')">
                    <i class="fas fa-file-pdf"></i> Principal
                  </button>
                  <button class="btn btn-sm" style="background:var(--yellow);color:#1a1a1a;padding:8px 16px;border-radius:8px;font-weight:600;box-shadow:0 2px 8px rgba(245,158,11,0.25);" onclick="openDocument('/api/documents/bordereau/${e.id}?rajout=1')">
                    <i class="fas fa-file-pdf"></i> Rajout
                  </button>
                </div>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table></div>
    </div>
  </div>`;
}

// ============================================================================
//  BORDEREAUX DÉLIBÉRÉS (REGION)
// ============================================================================
async function openDeliberes() {
  const content = document.getElementById('content');
  content.innerHTML = loaderHTML();
  // Uniquement les examens ayant des candidats délibérés
  const res = await API.examensDeliberes();
  const list = res.list || [];

  content.innerHTML = `<div class="fade-in">
    ${setTitle('Bordereaux délibérés')}
    <div class="card"><div class="table-wrap"><table>
      <thead><tr><th>Type et Date d'examen</th><th>Lieu</th><th style="text-align:center;">Action</th></tr></thead>
      <tbody>
      ${list.length === 0 ? `<tr><td colspan="3"><div class="empty-state"><i class="fas fa-check-double"></i><p>Aucun examen délibéré pour le moment.</p></div></td></tr>` :
        list.map(e => `<tr>
          <td>Examen de <b>${esc(e.type_examen)}</b> du <b>${formatDateFR(e.date_examen)}</b></td>
          <td><i class="fas fa-map-marker-alt" style="color:var(--gray)"></i> ${esc(e.lieu || '—')}</td>
          <td style="text-align:center;"><button class="btn btn-sm" style="background:var(--success);color:white;" onclick="openDocument('/api/documents/delibere/${e.id}')"><i class="fas fa-file-download"></i> BORDEREAU DÉLIBÉRÉ</button></td>
        </tr>`).join('')}
      </tbody>
    </table></div></div>
  </div>`;
}

// ============================================================================
//  SALLE D'EXAMEN (délibération) — version complète
//  - autorisation masse (liste principale / rajouts)
//  - filtre par auto-école
//  - import CSV
//  - délibération individuelle
// ============================================================================
let _salleData = { id: null, type: '', date: '', candidats: [], aeFilter: 'ALL', showOnlyRajout: false, searchText: '' };

async function openSalleExam(idExamen, type, date) {
  const content = document.getElementById('content');
  content.innerHTML = loaderHTML();
  _salleData = { id: idExamen, type, date, candidats: [], aeFilter: 'ALL', showOnlyRajout: false, searchText: '' };
  const res = await API.examCandidats(idExamen);
  _salleData.candidats = res.list || [];
  renderSalle();
}

function getFilteredSalle() {
  const { candidats, aeFilter, showOnlyRajout, searchText } = _salleData;
  return candidats.filter(c => {
    if (aeFilter !== 'ALL' && c.autoEcole !== aeFilter) return false;
    if (showOnlyRajout && !(c.statut === 'Rajout' || c.statut === 'En attente (Rajout)')) return false;
    if (searchText) {
      const q = searchText.toLowerCase();
      if (!String(c.nomPrenoms).toLowerCase().includes(q) && !String(c.piece).toLowerCase().includes(q) && !String(c.autoEcole).toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

function renderSalle() {
  const { id, type, date, candidats } = _salleData;
  const pendingPrincipal = candidats.filter(c => c.statut === 'En attente').length;
  const pendingRajout = candidats.filter(c => c.statut === 'Rajout' || c.statut === 'En attente (Rajout)').length;
  const hasValidated = candidats.some(c => c.statut === 'Validé');

  // Compteurs par auto-école (badges cliquables comme l'ancien)
  const aeCounts = {};
  candidats.forEach(c => { const ae = c.autoEcole || 'Inconnue'; aeCounts[ae] = (aeCounts[ae] || 0) + 1; });
  const sortedAE = Object.keys(aeCounts).sort();

  const summaryBadges = sortedAE.map(ae => {
    const count = aeCounts[ae];
    const active = _salleData.aeFilter === ae;
    return `<span class="badge ${active ? 'badge-info' : 'badge-gray'}" style="cursor:pointer;font-size:0.8rem;" onclick="_salleData.aeFilter='${esc(ae)}';renderSalle()">${esc(ae)} (${count})</span>`;
  }).join(' ');
  const allBadge = `<span class="badge ${_salleData.aeFilter === 'ALL' ? 'badge-info' : 'badge-gray'}" style="cursor:pointer;font-size:0.8rem;" onclick="_salleData.aeFilter='ALL';renderSalle()">Tous</span>`;

  const filtered = getFilteredSalle();

  document.getElementById('content').innerHTML = `<div class="fade-in">
    ${setTitle(`Salle d'examen — ${esc(type)}`, `
      ${pendingPrincipal ? `<button class="btn btn-sm btn-success" onclick="validerToutSalle('En attente')"><i class="fas fa-check-double"></i> Autoriser liste principale (${pendingPrincipal})</button>` : ''}
      ${pendingRajout ? `<button class="btn btn-sm btn-warning" onclick="validerToutSalle('Rajout')"><i class="fas fa-check-double"></i> Autoriser rajouts (${pendingRajout})</button>` : ''}
      ${hasValidated ? `<button class="btn btn-sm btn-primary" onclick="validerDeliberationMasse()"><i class="fas fa-gavel"></i> Valider la délibération</button>` : ''}
      <button class="btn btn-sm btn-ghost" onclick="exportTable('salleTable','examen_${id}')"><i class="fas fa-file-excel"></i> Export</button>
      <button class="btn btn-sm btn-ghost" onclick="openDocument('/api/documents/delibere/${id}')"><i class="fas fa-file-pdf"></i> Bordereau délibéré</button>
      <button class="btn btn-sm btn-ghost" onclick="openExamens()"><i class="fas fa-arrow-left"></i> Retour</button>
    `)}
    <div class="card">
      <div class="card-header" style="flex-wrap:wrap;gap:10px;">
        <div><b>${esc(type)}</b> du ${date} — <b style="color:var(--blue);">${candidats.length}</b> candidat(s)</div>
      </div>
      <!-- Résumé par auto-école (badges cliquables) -->
      <div style="padding:12px 20px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;border-bottom:1px solid var(--border);">
        <span style="font-weight:800;margin-right:6px;">Total : <span style="color:var(--blue);">${candidats.length}</span></span>
        ${summaryBadges}
        ${allBadge}
      </div>
      <!-- Barre d'outils -->
      <div style="padding:12px 20px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;border-bottom:1px solid var(--border);">
        <select id="aeFilterSelect" onchange="_salleData.aeFilter=this.value;renderSalleTableOnly()" style="max-width:220px;padding:8px;font-size:0.85rem;">
          <option value="ALL">-- Toutes les auto-écoles --</option>
          ${sortedAE.map(ae => `<option value="${esc(ae)}" ${_salleData.aeFilter === ae ? 'selected' : ''}>${esc(ae)} (${aeCounts[ae]})</option>`).join('')}
        </select>
        <div class="search-bar" style="flex:1;min-width:180px;"><i class="fas fa-search"></i><input placeholder="Rechercher nom, pièce..." value="${esc(_salleData.searchText)}" oninput="_salleData.searchText=this.value;renderSalleTableOnly()"></div>
        <button class="btn btn-sm btn-ghost" onclick="_salleData.showOnlyRajout=!_salleData.showOnlyRajout;renderSalle()"><i class="fas fa-filter"></i> ${_salleData.showOnlyRajout ? 'Tous' : 'Rajouts'}</button>
        <button class="btn btn-sm btn-ghost" onclick="openImportModal()"><i class="fas fa-file-import"></i> Import CSV</button>
      </div>
      <div id="salleTableWrap" class="table-wrap"></div>
    </div>
  </div>`;
  renderSalleTableOnly();
}

// Délibération en masse : collecte tous les selects renseignés
async function validerDeliberationMasse() {
  const selects = document.querySelectorAll('#salleTableWrap select[data-idinsc]');
  const results = [];
  selects.forEach(s => {
    if (s.value) results.push({ idInsc: s.getAttribute('data-idinsc'), result: s.value });
  });
  if (!results.length) return toast('Aucun résultat à enregistrer.', 'warning');
  if (!await confirmModal('Valider la délibération', `Enregistrer les résultats de <b>${results.length}</b> candidat(s) ?`, 'Valider')) return;
  const res = await API.deliberer(_salleData.id, results);
  if (res.success) { toast(`${results.length} résultat(s) enregistré(s).`, 'success'); await refreshSalle(); }
  else toast(res.msg || 'Erreur.', 'error');
}

function renderSalleTableOnly() {
  const filtered = getFilteredSalle();
  const el = document.getElementById('salleTableWrap');
  if (!el) return;
  el.innerHTML = `<table id="salleTable">
    <thead><tr><th>N°</th><th>NOM ET PRÉNOMS</th><th>IDENTIFIANT</th><th>CAT.</th><th>AUTO-ÉCOLE</th><th style="min-width:240px;">STATUT & DÉLIBÉRATION</th></tr></thead>
    <tbody>
    ${filtered.length === 0 ? `<tr><td colspan="6"><div class="empty-state"><i class="fas fa-users-slash"></i><p>Aucun candidat pour cette sélection.</p></div></td></tr>` :
      filtered.map((c, i) => {
        const st = String(c.statut).trim();
        const btnRetirer = `<button class="act-btn delete" title="Retirer de la salle" onclick="retirerCandSalle('${c.idInsc}','${esc(c.nomPrenoms)}')"><i class="fas fa-trash"></i></button>`;
        let actionCol = '';

        if (c.permisRetire === 'Retire' || st === 'Permis retiré') {
          actionCol = `<div style="display:flex;align-items:center;gap:6px;"><span class="badge badge-info" style="flex:1;justify-content:center;font-size:0.9rem;padding:8px;"><i class="fas fa-check-double"></i> Permis retiré</span>${btnRetirer}</div>`;
        } else if (['APTE','INAPTE','ABSENT','NON EVALUE'].includes(st)) {
          // Déjà délibéré : badge coloré + bouton corriger
          let badge = '';
          if (st === 'APTE') badge = `<span class="badge badge-success" style="flex:1;justify-content:center;font-size:0.9rem;padding:8px;"><i class="fas fa-check-circle"></i> APTE</span>`;
          else if (st === 'INAPTE') badge = `<span class="badge badge-danger" style="flex:1;justify-content:center;font-size:0.9rem;padding:8px;"><i class="fas fa-times-circle"></i> INAPTE</span>`;
          else if (st === 'ABSENT') badge = `<span class="badge badge-gray" style="flex:1;justify-content:center;font-size:0.9rem;padding:8px;"><i class="fas fa-user-slash"></i> ABSENT</span>`;
          else if (st === 'NON EVALUE') badge = `<span class="badge badge-warning" style="flex:1;justify-content:center;font-size:0.9rem;padding:8px;"><i class="fas fa-triangle-exclamation"></i> NON ÉVALUÉ</span>`;
          actionCol = `<div style="display:flex;align-items:center;gap:6px;width:100%;">${badge}<button class="act-btn edit" title="Corriger ce résultat" onclick="resetDelib('${c.idInsc}')"><i class="fas fa-pen"></i></button>${btnRetirer}</div>`;
        } else if (st === 'En attente') {
          actionCol = `<div style="display:flex;align-items:center;gap:8px;width:100%;"><span style="color:#b45309;font-weight:bold;font-size:0.85rem;flex:1;">En attente</span><button class="btn btn-sm btn-primary" onclick="validerUnSalle('${c.idInsc}')"><i class="fas fa-check"></i> Autoriser</button>${btnRetirer}</div>`;
        } else if (st === 'Rajout' || st === 'En attente (Rajout)') {
          actionCol = `<div style="display:flex;align-items:center;gap:8px;width:100%;"><span style="color:#d97706;font-weight:bold;font-size:0.85rem;flex:1;">Rajout</span><button class="btn btn-sm btn-warning" onclick="validerUnSalle('${c.idInsc}')"><i class="fas fa-check"></i> Autoriser</button>${btnRetirer}</div>`;
        } else if (st === 'Validé') {
          // Validé → select avec APTE par défaut (comme l'ancien)
          actionCol = `<div style="display:flex;align-items:center;gap:6px;width:100%;">
            <select data-idinsc="${c.idInsc}" onchange="delibererUn('${c.idInsc}', this.value)" style="flex:1;padding:8px;font-size:0.85rem;">
              <option value="APTE" selected>✅ APTE (Défaut)</option>
              <option value="INAPTE">❌ INAPTE</option>
              <option value="ABSENT">➖ ABSENT</option>
              <option value="NON EVALUE">❔ NON EVALUE</option>
            </select>${btnRetirer}</div>`;
        }

        return `<tr>
          <td style="color:var(--gray);font-weight:bold;">${i + 1}</td>
          <td><b style="font-size:1.05rem;">${esc(c.nomPrenoms)}</b></td>
          <td style="font-family:monospace;color:var(--blue);font-weight:bold;">${esc(c.piece)}</td>
          <td><span style="background:var(--bg);padding:4px 10px;border-radius:6px;font-weight:bold;font-size:0.85rem;border:1px solid var(--border);">${esc(c.cat)}</span></td>
          <td>${esc(c.autoEcole)}</td>
          <td>${actionCol}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>`;
}

async function validerUnSalle(idInsc) {
  const res = await API.validerInsc(idInsc);
  if (res.success) { toast('Candidat autorisé.', 'success'); await refreshSalle(); }
  else toast(res.msg || 'Erreur.', 'error');
}

async function validerToutSalle(targetStatus) {
  const label = targetStatus === 'Rajout' ? 'les rajouts' : 'la liste principale';
  if (!await confirmModal('Autorisation en masse', `Autoriser TOUS les candidats de ${label} ?`, 'Autoriser tout')) return;
  // L'API backend valider-tout filtre sur resultat='En attente'. Pour les rajouts,
  // on adapte : on valide individuellement ceux dont le statut est rajout.
  if (targetStatus === 'Rajout') {
    const rajouts = _salleData.candidats.filter(c => c.statut === 'Rajout' || c.statut === 'En attente (Rajout)');
    let ok = 0;
    for (const c of rajouts) { const r = await API.validerInsc(c.idInsc); if (r.success) ok++; }
    toast(`${ok} rajout(s) autorisé(s).`, 'success');
  } else {
    const res = await API.validerTout(_salleData.id);
    if (!res.success) return toast(res.msg || 'Erreur.', 'error');
    toast('Liste principale autorisée.', 'success');
  }
  await refreshSalle();
}

async function delibererUn(idInsc, result) {
  if (!result) return;
  const res = await API.deliberer(_salleData.id, [{ idInsc, result }]);
  if (res.success) { toast(`Résultat enregistré : ${result}`, 'success'); await refreshSalle(); }
  else toast(res.msg || 'Erreur.', 'error');
}

async function resetDelib(idInsc) {
  if (!await confirmModal('Corriger', 'Réinitialiser la délibération pour re-délibérer ce candidat ?', 'Corriger')) return;
  const res = await API.resetDelib(idInsc);
  if (res.success) { toast('Réinitialisé.', 'success'); await refreshSalle(); }
  else toast(res.msg || 'Erreur.', 'error');
}

async function retirerCandSalle(idInsc, name) {
  if (!await confirmModal('Retirer de la salle', `Retirer <b>${esc(name)}</b> de cet examen ?<br>Il retournera en attente.`, 'Retirer', true)) return;
  const res = await API.retirerCand(idInsc);
  if (res.success) { toast('Candidat retiré.', 'success'); await refreshSalle(); }
  else toast(res.msg || 'Erreur.', 'error');
}

async function refreshSalle() {
  const r = await API.examCandidats(_salleData.id);
  _salleData.candidats = r.list || [];
  renderSalle();
}

// ---- Import CSV via FICHIER (comme l'ancien) ----
async function openImportModal() {
  const aeRes = await API.autoEcoles();
  const aes = aeRes.list || [];
  const html = `
    <div class="form-group" style="grid-column:1/-1"><label>1. Auto-école d'origine *</label>
      <select name="idAE"><option value="">— Choisir l'auto-école —</option>${aes.sort((a,b)=>String(a.nom).localeCompare(String(b.nom))).map(a => `<option value="${a.id}">${esc(a.nom)}</option>`).join('')}</select>
    </div>
    <div class="form-group" style="grid-column:1/-1">
      <label>2. Fichier CSV *</label>
      <small class="text-muted">Colonnes attendues : <b>Nom et Prénoms | Identifiant | Catégorie (ex: ABCDE)</b></small>
      <input type="file" name="csvFile" accept=".csv" style="margin-top:8px;border:2px dashed var(--blue);padding:10px;border-radius:8px;">
    </div>
    <div class="form-group" style="grid-column:1/-1"><div style="background:#fffbeb;color:#b45309;padding:10px;border-radius:8px;border-left:4px solid var(--warning);font-size:0.85rem;"><b>Astuce :</b> Utilisez le format <b>CSV UTF-8</b> dans Excel si vous avez des accents.</div></div>
  `;
  const data = await formModal('Importer des candidats', html, 'Lancer l\'importation');
  if (!data) return;
  if (!data.idAE) return toast('Choisissez une auto-école.', 'error');
  // Le fichier est dans data.csvFile (le formModal renvoie la valeur, mais pour les fichiers input il faut récupérer via le DOM)
  const fileInput = document.querySelector('#modalBody input[type="file"]');
  if (!fileInput || !fileInput.files.length) return toast('Chargez un fichier CSV.', 'error');
  const file = fileInput.files[0];
  const text = await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.readAsText(file, 'windows-1252');
  });
  // Parser CSV (gère les quotes)
  function parseLine(line) {
    const result = []; let cur = ''; let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQ) { if (c === '"') { if (line[i+1] === '"') { cur += '"'; i++; } else inQ = false; } else cur += c; }
      else { if (c === '"') inQ = true; else if (c === ',' || c === ';') { result.push(cur.trim()); cur = ''; } else cur += c; }
    }
    result.push(cur.trim()); return result;
  }
  const lines = text.split(/\r\n|\n|\r/).filter(l => l.trim());
  const candidats = [];
  for (let i = 1; i < lines.length; i++) { // skip header
    const cols = parseLine(lines[i]);
    if (cols.length >= 2 && cols[0]) candidats.push({ nomPrenoms: cols[0], piece: cols[1] || '', cat: String(cols[2] || 'ABCDE').replace(/Catégorie/i,'').trim() || 'ABCDE' });
  }
  if (!candidats.length) return toast('Aucune ligne valide dans le fichier.', 'error');
  if (!await confirmModal('Importation', `Ajouter <b>${candidats.length}</b> candidat(s) au bordereau ?`, 'Importer')) return;
  const res = await API.importExam(_salleData.id, data.idAE, candidats);
  if (res.success) { toast(res.msg || 'Import réussi.', 'success'); await refreshSalle(); }
  else toast(res.msg || 'Erreur.', 'error');
}

// ============================================================================
//  INSCRIPTIONS SUR BORDEREAU (AUTO_ECOLE)
// ============================================================================
// ============================================================================
//  INSCRIPTIONS SUR LE BORDEREAU (AUTO_ECOLE) — design identique à l'ancien
//  Carte 1 : select déroulant des sessions ouvertes
//  Carte 2 : tableau des candidats avec boutons SUPPRIMER / SOUMETTRE
// ============================================================================
let _inscCandidats = [];
async function openInscriptions() {
  const content = document.getElementById('content');
  document.getElementById('pageTitle').innerText = 'Inscription sur le bordereau';
  content.innerHTML = loaderHTML();

  // Récupérer les sessions actives (non fermées)
  const res = await API.examens();
  const exams = (res.list || []).filter(e => String(e.statut) !== 'ferme');

  let examsHtml = '';
  if (!exams.length) {
    examsHtml = '<div style="padding:20px;background:#fee2e2;border:1px solid #f87171;border-radius:10px;color:#991b1b;font-weight:bold;"><i class="fas fa-exclamation-circle"></i> Aucune session n\'est actuellement ouverte par la Direction.</div>';
  } else {
    examsHtml = '<select id="selectedExam" onchange="loadCandidatsForExam(this.value)" style="border:2px solid var(--light-blue);font-weight:bold;color:var(--blue);font-size:1.1rem;">';
    exams.forEach(e => {
      const label = `${e.type_examen} - Prévu le ${formatDateFR(e.date_examen)}${String(e.statut).trim() === 'rajout' ? ' [BORDEREAU DE RAJOUT]' : ''}`;
      examsHtml += `<option value="${e.id}">${esc(label)}</option>`;
    });
    examsHtml += '</select>';
  }

  content.innerHTML = `<div class="fade-in">
    <div class="card">
      <h4 style="margin-top:0;color:var(--blue);font-size:1.2rem;"><i class="fas fa-calendar-check" style="color:var(--yellow);"></i> 1. Sélectionnez la session ouverte</h4>
      <div id="examSelectContainer">${examsHtml}</div>
    </div>
    <div class="card fade-in" style="padding:0;display:none;" id="inscTableCard">
      <div style="padding:20px 30px;border-bottom:1px solid var(--border-color);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:15px;">
        <h4 style="margin:0;color:var(--blue);"><i class="fas fa-user-plus" style="color:var(--light-blue);"></i> 2. Cochez les élèves à présenter</h4>
        <div class="search-box" style="width:250px;margin:0;"><i class="fas fa-search" style="color:var(--light-blue);"></i><input type="text" id="searchBordereauCand" oninput="filterBordereauCand()" placeholder="Rechercher un candidat..."></div>
        <div style="display:flex;gap:10px;">
          <button class="btn btn-danger" onclick="supprimerSelectionCandidats()"><i class="fas fa-trash-alt"></i> SUPPRIMER</button>
          <button class="btn btn-primary" onclick="soumettreBordereau()"><i class="fas fa-paper-plane"></i> SOUMETTRE LE BORDEREAU</button>
        </div>
      </div>
      <div id="listInscCandidats" style="padding:20px 30px;overflow-x:auto;"></div>
    </div>
  </div>`;

  if (exams.length) loadCandidatsForExam(exams[0].id);
}

async function loadCandidatsForExam(idExamen) {
  window._currentInscExam = idExamen;
  const card = document.getElementById('inscTableCard');
  if (!idExamen) { card.style.display = 'none'; return; }
  card.style.display = 'block';
  document.getElementById('listInscCandidats').innerHTML = loaderHTML('Chargement...');
  const res = await API.eligibles(idExamen);
  _inscCandidats = res.list || [];
  renderInscTable(_inscCandidats);
}

function filterBordereauCand() {
  const q = document.getElementById('searchBordereauCand').value.toLowerCase();
  renderInscTable(_inscCandidats.filter(c => String(c.nom).toLowerCase().includes(q) || String(c.piece).toLowerCase().includes(q)));
}

function renderInscTable(list) {
  list.sort((a, b) => String(a.nom).localeCompare(String(b.nom)));
  const el = document.getElementById('listInscCandidats');
  if (!el) return;
  let h = `<table><tr><th style="width:50px;text-align:center;"><input type="checkbox" onchange="document.querySelectorAll('.cand-chk').forEach(c=>{if(!c.disabled)c.checked=this.checked})" style="width:18px;height:18px;margin:0;"></th><th>NOM ET PRÉNOMS</th><th>IDENTIFIANT</th><th>CATÉGORIE</th><th>STATUT POUR CE BORDEREAU</th></tr>`;
  if (!list.length) {
    h += '<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--gray);">Vous n\'avez aucun candidat éligible pour ce type d\'examen.</td></tr>';
  } else {
    list.forEach(c => {
      let stDisp = '<span class="badge" style="background:rgba(59,130,246,0.1);color:var(--blue);border:1px solid var(--blue);"><i class="fas fa-hourglass-start"></i> Prêt à soumettre</span>';
      if (c.stGlobal === 'Admis Dernier Code') stDisp = '<span class="badge" style="background:#dcfce7;color:#065f46;border:1px solid #10b981;"><i class="fas fa-check-circle"></i> Apte au dernier Code</span>';
      else if (String(c.stGlobal).includes('Ajourné')) stDisp = `<span class="badge" style="background:#fee2e2;color:#991b1b;border:1px solid #f87171;"><i class="fas fa-history"></i> ${esc(c.stGlobal)}</span>`;

      if (c.isRegistered) {
        h += `<tr style="background:var(--table-hover);opacity:0.6;"><td style="text-align:center;"><i class="fas fa-check" style="color:var(--success);"></i></td><td><b>${esc(c.nom)}</b></td><td style="font-family:monospace;color:var(--blue);">${esc(c.piece)}</td><td><span style="background:var(--bg);padding:4px 10px;border-radius:6px;font-weight:bold;font-size:0.85rem;border:1px solid var(--border-color);">${esc(c.cat)}</span></td><td><span class="badge badge-success"><i class="fas fa-list-ul"></i> Déjà sur la liste</span></td></tr>`;
      } else {
        h += `<tr><td style="text-align:center;"><input type="checkbox" class="cand-chk" value="${c.id}"></td><td><b>${esc(c.nom)}</b></td><td style="font-family:monospace;font-size:1.1rem;color:var(--blue);">${esc(c.piece)}</td><td><span style="background:var(--bg);padding:4px 10px;border-radius:6px;font-weight:bold;font-size:0.85rem;border:1px solid var(--border-color);">${esc(c.cat)}</span></td><td>${stDisp}</td></tr>`;
      }
    });
  }
  el.innerHTML = h + '</table>';
}

async function soumettreBordereau() {
  const ids = Array.from(document.querySelectorAll('.cand-chk:checked')).map(c => c.value);
  if (!ids.length) return toast('Cochez au moins un candidat.', 'warning');
  if (!await confirmModal('Soumettre le bordereau', `Inscrire <b>${ids.length}</b> candidat(s) à cet examen ?`, 'SOUMETTRE')) return;
  const res = await API.inscrire(window._currentInscExam, ids);
  if (res.success) { toast(`${ids.length} candidat(s) inscrit(s).`, 'success'); loadCandidatsForExam(window._currentInscExam); }
  else toast(res.msg || 'Erreur.', 'error');
}

async function openInscriptionCandidats(idExamen, type, date) {
  const content = document.getElementById('content');
  content.innerHTML = loaderHTML();
  const res = await API.eligibles(idExamen);
  const list = res.list || [];
  const inscrits = list.filter(c => c.isRegistered);
  const eligibles = list.filter(c => !c.isRegistered);

  document.getElementById('content').innerHTML = `<div class="fade-in">
    ${setTitle(`Inscription — ${esc(type)}`, `<button class="btn btn-sm btn-ghost" onclick="openInscriptions()"><i class="fas fa-arrow-left"></i> Retour</button>`)}
    <div class="card">
      <div class="card-header">
        <div><b>${esc(type)}</b> du ${date} — <span class="text-muted">${eligibles.length} éligible(s), ${inscrits.length} déjà inscrit(s)</span></div>
        ${eligibles.length ? `<button class="btn btn-sm btn-success" onclick="inscrireSelection('${idExamen}')"><i class="fas fa-paper-plane"></i> Soumettre le bordereau (${eligibles.length})</button>` : ''}
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th><input type="checkbox" id="chkAll" onchange="toggleAllChk(this)" class="chk-input"></th><th>Nom</th><th>Pièce</th><th>Cat.</th><th>Statut pour ce bordereau</th></tr></thead>
        <tbody>
        ${list.length === 0 ? `<tr><td colspan="5"><div class="empty-state"><i class="fas fa-users-slash"></i><p>Aucun candidat éligible pour cet examen.</p></div></td></tr>` :
          list.map(c => {
            let stBadge;
            if (c.isRegistered) stBadge = '<span class="badge badge-success"><i class="fas fa-check"></i> Déjà sur la liste</span>';
            else if (c.stGlobal === 'Admis Dernier Code') stBadge = '<span class="badge badge-info"><i class="fas fa-star"></i> Admis au dernier Code</span>';
            else if (String(c.stGlobal).includes('Ajourné')) stBadge = '<span class="badge badge-warning"><i class="fas fa-rotate-right"></i> Ajourné (à représenter)</span>';
            else stBadge = '<span class="badge badge-info"><i class="fas fa-paper-plane"></i> Prêt à soumettre</span>';
            return `<tr>
              <td><input type="checkbox" class="cand-chk" value="${c.id}" ${c.isRegistered ? 'disabled' : ''}></td>
              <td><b>${esc(c.nom)}</b></td>
              <td style="font-family:monospace;">${esc(c.piece)}</td>
              <td><span class="badge badge-info">${esc(c.cat)}</span></td>
              <td>${stBadge}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table></div>
    </div>
  </div>`;
}

function toggleAllChk(master) {
  document.querySelectorAll('.cand-chk').forEach(c => { if (!c.disabled) c.checked = master.checked; });
}

async function inscrireSelection(idExamen) {
  const ids = Array.from(document.querySelectorAll('.cand-chk:checked')).map(c => c.value);
  if (!ids.length) return toast('Sélectionnez au moins un candidat.', 'warning');
  if (!await confirmModal('Soumettre le bordereau', `Inscrire <b>${ids.length}</b> candidat(s) à cet examen ?`, 'SOUMETTRE')) return;
  const res = await API.inscrire(idExamen, ids);
  if (res.success) { toast(`${ids.length} candidat(s) inscrit(s).`, 'success'); openInscriptions(); }
  else toast(res.msg || 'Erreur.', 'error');
}

// Suppression en masse de candidats (bouton SUPPRIMER)
async function supprimerSelectionCandidats() {
  const ids = Array.from(document.querySelectorAll('.cand-chk:checked')).map(c => c.value);
  if (!ids.length) return toast('Sélectionnez au moins un candidat.', 'warning');
  if (!await confirmModal('Supprimer les dossiers', `Supprimer définitivement <b>${ids.length}</b> candidat(s) ?`, 'SUPPRIMER', true)) return;
  const res = await API.deleteCandidatsMany(ids);
  if (res.success) { toast(`${ids.length} candidat(s) supprimé(s).`, 'success'); openInscriptionCandidats(window._currentInscExam || '', '', ''); }
  else toast(res.msg || 'Erreur.', 'error');
}

// ============================================================================
//  BORDEREAUX DÉLIBÉRÉS (AUTO_ECOLE) - lecture seule + PDF
// ============================================================================
async function openDeliberesAE() {
  const content = document.getElementById('content');
  content.innerHTML = loaderHTML();
  // Uniquement les examens où CETTE auto-école a des candidats délibérés
  const res = await API.examensDeliberesAE();
  const list = res.list || [];

  content.innerHTML = `<div class="fade-in">
    ${setTitle('Bordereaux délibérés')}
    <div class="card"><div class="table-wrap"><table>
      <thead><tr><th>Type et Date d'examen</th><th>Lieu</th><th style="text-align:center;">Action</th></tr></thead>
      <tbody>
      ${list.length === 0 ? `<tr><td colspan="3"><div class="empty-state"><i class="fas fa-check-double"></i><p>Aucun bordereau délibéré pour votre auto-école.</p></div></td></tr>` :
        list.map(e => `<tr>
          <td>Examen de <b>${esc(e.type_examen)}</b> du <b>${formatDateFR(e.date_examen)}</b></td>
          <td><i class="fas fa-map-marker-alt" style="color:var(--gray)"></i> ${esc(e.lieu || '—')}</td>
          <td style="text-align:center;"><button class="btn btn-sm" style="background:var(--success);color:white;" onclick="openDocument('/api/documents/delibere/${e.id}')"><i class="fas fa-file-download"></i> BORDEREAU DÉLIBÉRÉ</button></td>
        </tr>`).join('')}
      </tbody>
    </table></div></div>
  </div>`;
}
