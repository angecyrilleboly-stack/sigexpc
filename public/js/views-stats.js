// ============================================================================
//  SIGEXPC - Vues métier (partie 3) : Stats, Analyse, STTC, Permis, Abos
// ============================================================================

// ============================================================================
//  STATISTIQUES AVANCÉES (REGION)
// ============================================================================
let _charts = [];
function destroyCharts() { _charts.forEach(c => { try { c.destroy(); } catch (e) {} }); _charts = []; }

async function openStatistiques() {
  const content = document.getElementById('content');
  content.innerHTML = loaderHTML();
  destroyCharts();
  const res = await API.avances();
  if (!res.success) { content.innerHTML = emptyState('Impossible de charger les statistiques.'); return; }
  const { global, exams, aeStats } = res;

  content.innerHTML = `<div class="fade-in">
    ${setTitle('Bilan & Statistiques', `
      <button class="btn btn-sm btn-ghost" onclick="exportTable('tableStats','bilan_sessions')"><i class="fas fa-file-excel"></i> Exporter sessions</button>
      <button class="btn btn-sm btn-ghost" onclick="exportTable('tableStatsAE','palmares_ae')"><i class="fas fa-file-excel"></i> Exporter palmarès</button>
    `)}
    <h4 style="margin:0 0 12px;color:var(--text-soft);">Bilan global du centre</h4>
    <div class="stats-grid">
      ${statCard(global.apte_code, 'Aptes (Code)', 'fa-file-pen', 'green')}
      ${statCard(global.apte_conduite, 'Aptes (Conduite)', 'fa-car', 'green')}
      ${statCard(global.inapte, 'Inaptes', 'fa-xmark', 'red')}
      ${statCard(global.absent, 'Absents', 'fa-user-slash', 'yellow')}
      ${statCard(global.non_evalue, 'Non évalués', 'fa-question', 'yellow')}
    </div>
    <div class="card"><div class="card-body">
      <h4 style="margin-top:0;"><i class="fas fa-chart-pie" style="color:var(--blue)"></i> Répartition globale des résultats</h4>
      <div style="max-width:420px;margin:0 auto;"><canvas id="chartGlobal" height="220"></canvas></div>
    </div></div>
    <div class="card">
      <div class="card-header"><h3>Détail par session</h3></div>
      <div class="table-wrap"><table id="tableStats">
        <thead><tr><th>Session</th><th>Aptes (Code)</th><th>Aptes (Conduite)</th><th>Inaptes</th><th>Absents</th><th>Non évalués</th></tr></thead>
        <tbody>
        ${exams.length === 0 ? `<tr><td colspan="6"><div class="empty-state"><i class="fas fa-table"></i><p>Aucune session délibérée.</p></div></td></tr>` :
          exams.map(e => `<tr>
            <td><b>${esc(e.label)}</b></td>
            <td class="text-success"><b>${e.apte_code}</b></td>
            <td class="text-success"><b>${e.apte_conduite}</b></td>
            <td class="text-danger">${e.inapte}</td>
            <td class="text-muted">${e.absent || 0}</td>
            <td class="text-muted">${e.non_evalue}</td>
          </tr>`).join('')}
        </tbody>
      </table></div>
    </div>
    <div class="card">
      <div class="card-header"><h3>Palmarès des auto-écoles (Aptes)</h3></div>
      <div class="table-wrap"><table id="tableStatsAE">
        <thead><tr><th>Auto-école</th><th>Aptes (Code)</th><th>Aptes (Conduite)</th><th>Total aptes</th></tr></thead>
        <tbody>
        ${aeStats.length === 0 ? `<tr><td colspan="4"><div class="empty-state"><i class="fas fa-school"></i><p>Aucune donnée.</p></div></td></tr>` :
          aeStats.map(a => `<tr>
            <td><b>${esc(a.nom)}</b></td>
            <td class="text-success"><b>${a.apte_code}</b></td>
            <td class="text-success"><b>${a.apte_conduite}</b></td>
            <td><b>${a.apte_code + a.apte_conduite}</b></td>
          </tr>`).join('')}
        </tbody>
      </table></div>
    </div>
    <div class="card"><div class="card-body">
      <h4 style="margin-top:0;"><i class="fas fa-school" style="color:var(--blue)"></i> Performance par auto-école</h4>
      <div style="max-width:700px;margin:0 auto;"><canvas id="chartAE" height="180"></canvas></div>
    </div></div>
  </div>`;

  // Graphique global
  const ctxG = document.getElementById('chartGlobal');
  if (ctxG) {
    _charts.push(new Chart(ctxG, {
      type: 'doughnut',
      data: {
        labels: ['Aptes (Code)', 'Aptes (Conduite)', 'Inaptes', 'Absents', 'Non évalués'],
        datasets: [{ data: [global.apte_code, global.apte_conduite, global.inapte, global.absent, global.non_evalue],
          backgroundColor: ['#10b981', '#06402B', '#ef4444', '#f59e0b', '#a78bfa'], borderWidth: 2, borderColor: '#fff' }]
      },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    }));
  }
  const ctxA = document.getElementById('chartAE');
  if (ctxA) {
    _charts.push(new Chart(ctxA, {
      type: 'bar',
      data: {
        labels: aeStats.map(a => a.nom),
        datasets: [
          { label: 'Aptes (Code)', data: aeStats.map(a => a.apte_code), backgroundColor: '#10b981' },
          { label: 'Aptes (Conduite)', data: aeStats.map(a => a.apte_conduite), backgroundColor: '#06402B' }
        ]
      },
      options: { responsive: true, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } }, plugins: { legend: { position: 'bottom' } } }
    }));
  }
}

// Export d'un tableau en CSV (ouvre dans Excel)
function exportTable(tableId, filename) {
  let csv = [];
  const rows = document.querySelectorAll('#' + tableId + ' tr');
  for (const row of rows) {
    const cells = row.querySelectorAll('td, th');
    const line = [];
    for (const cell of cells) line.push('"' + cell.innerText.replace(/"/g, '""').trim() + '"');
    csv.push(line.join(';'));
  }
  const blob = new Blob(['\ufeff' + csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename + '.csv';
  a.click();
}

// ============================================================================
//  ANALYSE DE DONNÉES (TCD) — avec filtres de période + cartes cliquables
// ============================================================================
let _analyseData = [];
let _analysePeriod = 'ALL';
let _analyseDetailType = null;

async function openAnalyse() {
  const content = document.getElementById('content');
  content.innerHTML = loaderHTML();
  destroyCharts();
  const res = await API.analyse();
  _analyseData = res.list || [];
  _analysePeriod = 'ALL';
  _analyseDetailType = null;
  renderAnalyse();
}

// Filtre les données selon la période sélectionnée
function filterByPeriod(data, period) {
  if (period === 'ALL') return data;
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  return data.filter(d => {
    const dt = new Date(d.d);
    if (isNaN(dt)) return false;
    if (period === 'YEAR') return dt.getFullYear() === year;
    if (period === 'MONTH') return dt.getFullYear() === year && dt.getMonth() === month;
    const q = Math.floor(dt.getMonth() / 3) + 1;
    if (period === 'T1') return dt.getFullYear() === year && q === 1;
    if (period === 'T2') return dt.getFullYear() === year && q === 2;
    if (period === 'T3') return dt.getFullYear() === year && q === 3;
    if (period === 'T4') return dt.getFullYear() === year && q === 4;
    if (period === 'S1') return dt.getFullYear() === year && dt.getMonth() < 6;
    if (period === 'S2') return dt.getFullYear() === year && dt.getMonth() >= 6;
    return true;
  });
}

function renderAnalyse() {
  const periodData = filterByPeriod(_analyseData, _analysePeriod);
  // Compteurs par statut (comme l'ancien : 4 cartes - pas de carte Non Évalués)
  const counts = { apte_conduite: 0, apte_code: 0, inapte: 0, absent: 0, ne: 0 };
  periodData.forEach(d => {
    if (d.s === 'APTE') {
      if (String(d.exam).includes('Conduite')) counts.apte_conduite++;
      else counts.apte_code++;
    } else if (d.s === 'INAPTE') counts.inapte++;
    else if (d.s === 'ABSENT') counts.absent++;
    else counts.ne++;
  });

  // Boutons de période avec libellés longs (comme l'ancien)
  const periodBtns = [
    ['ALL', 'TOUT L\'HISTORIQUE', 'fa-globe'],
    ['YEAR', 'CETTE ANNÉE', 'fa-calendar'],
    ['MONTH', 'CE MOIS', 'fa-calendar-day'],
    ['T1', '1ER TRIM.', 'fa-chart-pie'],
    ['T2', '2ÈME TRIM.', 'fa-chart-pie'],
    ['T3', '3ÈME TRIM.', 'fa-chart-pie'],
    ['T4', '4ÈME TRIM.', 'fa-chart-pie'],
    ['S1', '1ER SEM.', 'fa-adjust'],
    ['S2', '2ÈME SEM.', 'fa-adjust']
  ];

  // 4 cartes avec couleurs de fond claires (comme l'ancien)
  const cards = [
    ['APTE_CONDUITE', 'ADMIS (CONDUITE)', '#10b981', counts.apte_conduite],
    ['APTE_CODE', 'ADMIS (CODE)', '#06402B', counts.apte_code],
    ['INAPTE', 'INAPTES', '#ef4444', counts.inapte],
    ['ABSENT', 'ABSENTS', '#64748b', counts.absent]
  ];

  document.getElementById('content').innerHTML = `<div class="fade-in">
    ${setTitle('Analyse des Performances (TCD)')}
    <div class="card" style="border-top:5px solid var(--blue);padding:30px;">
      <div style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin-bottom:30px;" id="tcdButtons">
        ${periodBtns.map(([k, label, icon]) => `<button class="btn-main tcd-btn" style="width:auto;padding:10px 15px;font-size:0.9rem;${_analysePeriod === k ? 'background:linear-gradient(to right, var(--blue), var(--light-blue));box-shadow:0 4px 6px rgba(37,99,235,0.2);' : 'background:var(--gray);box-shadow:none;'}" onclick="_analysePeriod='${k}';renderAnalyse()"><i class="fas ${icon}"></i> ${label}</button>`).join('')}
      </div>
      <div id="tcdCards" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:20px;margin-bottom:40px;">
        ${cards.map(([type, label, color, val]) => `
          <div class="card stat-card" style="border:1px solid ${color};padding:20px;background:${color}1a;cursor:pointer;" onclick="showTcdDetails('${type}')" title="Cliquez pour voir la liste">
            <p style="color:${color};font-weight:bold;margin-bottom:5px;">${label}</p>
            <h2 style="margin:0;color:${color};font-size:2.5rem;">${val}</h2>
          </div>`).join('')}
      </div>
      <div style="position:relative;height:400px;width:100%;margin-bottom:40px;"><canvas id="chartTCD"></canvas></div>
      <div id="tcdDetails"></div>
    </div>
  </div>`;

  // Graphique plein écran (comme l'ancien)
  const ctx = document.getElementById('chartTCD');
  if (ctx) {
    const isDark = document.body.classList.contains('dark-mode');
    const textColor = isDark ? '#f8fafc' : '#64748b';
    const gridColor = isDark ? '#334155' : '#e2e8f0';
    _charts.push(new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Admis Conduite', 'Admis Code', 'Inaptes', 'Absents', 'Non Évalués'],
        datasets: [{
          label: 'Volume de Candidats',
          data: [counts.apte_conduite, counts.apte_code, counts.inapte, counts.absent, counts.ne],
          backgroundColor: ['rgba(16,185,129,0.8)', 'rgba(6,64,43,0.8)', 'rgba(239,68,68,0.8)', 'rgba(100,116,139,0.8)', 'rgba(245,158,11,0.8)'],
          borderColor: ['#10b981', '#06402B', '#ef4444', '#64748b', '#f59e0b'],
          borderWidth: 2,
          borderRadius: 8
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ' + c.parsed.y + ' candidats' } } },
        scales: {
          y: { beginAtZero: true, grid: { borderDash: [5, 5], color: gridColor }, ticks: { color: textColor } },
          x: { grid: { display: false }, ticks: { color: textColor } }
        },
        animation: { duration: 800, easing: 'easeOutQuart' }
      }
    }));
  }

  if (_analyseDetailType) showTcdDetails(_analyseDetailType, false);
}

function showTcdDetails(type, scroll = true) {
  _analyseDetailType = type;
  const labelMap = { APTE_CONDUITE: 'Admis (Conduite)', APTE_CODE: 'Admis (Code)', INAPTE: 'Inaptes', ABSENT: 'Absents' };
  // On stocke le type pour le rendu après filtrage
  _renderTcdTable(type, '');

  if (scroll) {
    const el = document.getElementById('tcdDetails');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }
}

function _filterTcdByType(type, q) {
  const periodData = filterByPeriod(_analyseData, _analysePeriod);
  let list;
  if (type === 'APTE_CONDUITE') list = periodData.filter(d => d.s === 'APTE' && String(d.exam).includes('Conduite'));
  else if (type === 'APTE_CODE') list = periodData.filter(d => d.s === 'APTE' && String(d.exam).includes('Code'));
  else if (type === 'INAPTE') list = periodData.filter(d => d.s === 'INAPTE');
  else if (type === 'ABSENT') list = periodData.filter(d => d.s === 'ABSENT');
  else list = [];
  if (q) {
    const s = q.toLowerCase();
    list = list.filter(c => String(c.nom).toLowerCase().includes(s) || String(c.piece).toLowerCase().includes(s) || String(c.ae).toLowerCase().includes(s));
  }
  list.sort((a, b) => String(a.nom).localeCompare(String(b.nom)));
  return list;
}

function _renderTcdTable(type, q) {
  const labelMap = { APTE_CONDUITE: 'Admis (Conduite)', APTE_CODE: 'Admis (Code)', INAPTE: 'Inaptes', ABSENT: 'Absents' };
  const list = _filterTcdByType(type, q);
  const el = document.getElementById('tcdDetails');
  if (!el) return;
  el.style.display = 'block';
  el.style.borderTop = '2px solid var(--border-color)';
  el.style.paddingTop = '30px';
  el.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:15px;">
    <h4 style="margin:0;color:var(--blue);"><i class="fas fa-list-ul" style="color:var(--yellow);"></i> Détails des candidats - ${esc(labelMap[type] || type)}</h4>
    <div style="display:flex;gap:10px;align-items:center;">
      <span class="text-muted" style="font-size:0.85rem;"><b id="tcdCount" style="color:var(--blue);">${list.length}</b> candidat(s)</span>
      <div class="search-box" style="width:220px;"><i class="fas fa-search" style="color:var(--light-blue);"></i><input type="text" id="searchTcdCand" placeholder="Rechercher..." value="${esc(q)}" oninput="_renderTcdTable('${type}', this.value); document.getElementById('tcdCount').innerText = _filterTcdByType('${type}', this.value).length;"></div>
      <button class="btn btn-sm btn-ghost" onclick="exportList(_filterTcdByType('${type}', ''),'tcd_${type}')"><i class="fas fa-file-excel"></i> Exporter</button>
    </div>
  </div>
  <div class="table-wrap"><table id="tcdTableExport">
    <thead><tr><th>N°</th><th>NOM ET PRÉNOMS</th><th>IDENTIFIANT</th><th>CAT.</th><th>AUTO-ÉCOLE</th><th>SESSION EXAMEN</th></tr></thead>
    <tbody>
    ${list.length === 0 ? `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--gray);">Aucun candidat dans cette catégorie.</td></tr>` :
      list.map((c, i) => `<tr>
        <td style="color:var(--gray);font-weight:bold;">${i + 1}</td>
        <td><b style="color:var(--text-main);">${esc(c.nom)}</b></td>
        <td style="font-family:monospace;color:var(--blue);font-size:1.05rem;">${esc(c.piece)}</td>
        <td><span style="background:var(--bg);padding:4px 10px;border-radius:6px;font-weight:bold;font-size:0.85rem;border:1px solid var(--border-color);">${esc(c.cat)}</span></td>
        <td>${esc(c.ae)}</td>
        <td style="font-size:0.85rem;color:var(--gray);">${esc(c.exam)}</td>
      </tr>`).join('')}
    </tbody>
  </table></div>`;
}

function exportList(list, filename) {
  let csv = ['"N°";"Nom";"Identifiant";"Cat.";"Auto-école";"Session"'];
  list.forEach((d, i) => {
    csv.push([i+1, d.nom, d.piece, d.cat, d.ae, d.exam].map(v => '"' + String(v).replace(/"/g,'""') + '"').join(';'));
  });
  const blob = new Blob(['\ufeff' + csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename + '.csv';
  a.click();
}

// ============================================================================
//  COMPTE RENDU STTC
// ============================================================================
async function openSTTC() {
  const content = document.getElementById('content');
  content.innerHTML = loaderHTML();
  const res = await API.examens();
  const list = (res.list || []).filter(e => String(e.type_examen).includes('Conduite'));

  content.innerHTML = `<div class="fade-in">
    ${setTitle('Comptes rendus STTC', `<button class="btn btn-sm btn-ghost" onclick="openSTTC()"><i class="fas fa-sync"></i> Rafraîchir</button>`)}
    <p class="text-muted" style="margin-top:-10px;">Générez le compte rendu des examens (code + conduite) à partir des examens de conduite.</p>
    <div class="card"><div class="table-wrap"><table>
      <thead><tr><th>Période des examens</th><th>Lieu</th><th>Action</th></tr></thead>
      <tbody>
      ${list.length === 0 ? `<tr><td colspan="3"><div class="empty-state"><i class="fas fa-file-contract"></i><p>Aucun examen de conduite trouvé pour générer un CR.</p></div></td></tr>` :
        list.map(e => `<tr>
          <td>Examen de <b>${esc(e.type_examen)}</b> du <b>${formatDateFR(e.date_examen)}</b></td>
          <td><i class="fas fa-map-marker-alt" style="color:var(--gray)"></i> ${esc(e.lieu || '—')}</td>
          <td><button class="btn btn-sm btn-primary" style="background:#8b5cf6;" onclick="openDocument('/api/documents/compte-rendu/${e.id}')"><i class="fas fa-file-download"></i> Aperçu du CR</button></td>
        </tr>`).join('')}
      </tbody>
    </table></div></div>
  </div>`;
}

// ============================================================================
//  PERMIS À REMETTRE (AGENT)
// ============================================================================
// ============================================================================
//  RAPPORTS OFFICIELS (AUTO_ECOLE)
// ============================================================================
async function openRapports() {
  document.getElementById('pageTitle').innerText = 'Génération de Rapports Officiels';
  document.getElementById('content').innerHTML = `<div class="fade-in">
    ${setTitle('Génération de Rapports Officiels')}
    <div class="card" style="padding:30px;border-top:5px solid var(--danger);">
      <h3 style="color:var(--text-main);margin-bottom:20px;"><i class="fas fa-print" style="color:var(--danger);"></i> Édition des Rapports Périodiques</h3>
      <div style="display:flex;gap:15px;margin-bottom:30px;flex-wrap:wrap;align-items:center;background:var(--bg);padding:15px;border-radius:10px;">
        <label style="font-weight:bold;color:var(--blue);">Sélectionnez la durée :</label>
        <select id="reportPeriod" style="max-width:250px;margin:0;">
          <option value="T1">1er Trimestre</option>
          <option value="T2">2ème Trimestre</option>
          <option value="T3">3ème Trimestre</option>
          <option value="T4">4ème Trimestre</option>
          <option value="S1">1er Semestre</option>
          <option value="S2">2ème Semestre</option>
          <option value="YEAR">Année Complète</option>
        </select>
        <button class="btn btn-primary" onclick="previewReport()"><i class="fas fa-eye"></i> Générer l'aperçu</button>
        <button class="btn" style="background:var(--danger);color:#fff;" onclick="downloadReportPDF()"><i class="fas fa-download"></i> Télécharger en PDF</button>
      </div>
      <div style="background:#e2e8f0;padding:20px;border-radius:10px;display:flex;justify-content:center;overflow-x:auto;">
        <div id="reportPreviewArea" style="background:#fff;width:210mm;min-height:297mm;padding:20mm;box-shadow:0 10px 20px rgba(0,0,0,0.2);color:#000;">
          <p style="text-align:center;color:#888;font-style:italic;margin-top:50px;">Veuillez sélectionner une durée et cliquer sur "Générer l'aperçu" pour afficher le rapport.</p>
        </div>
      </div>
    </div>
  </div>`;
}

async function previewReport() {
  const period = document.getElementById('reportPeriod').value;
  const periodSelect = document.getElementById('reportPeriod');
  const periodLabel = periodSelect.options[periodSelect.selectedIndex].text;
  document.getElementById('reportPreviewArea').innerHTML = loaderHTML();
  // Récupère les VRAIES données depuis le backend
  const res = await fetch('/api/documents/rapport?period=' + period, { credentials: 'include' });
  if (!res.ok) { document.getElementById('reportPreviewArea').innerHTML = '<p style="color:#b91c1c;">Erreur lors de la génération du rapport.</p>'; return; }
  const data = await res.json();
  const { apteCond = 0, apteCode = 0, inapte = 0, absent = 0, ne = 0, regionDisplay = 'Direction Régionale des Transports et des Affaires Maritimes', autoEcoleNom = '' } = data;
  const totalCandidats = apteCond + apteCode + inapte + absent + ne;
  const totalAdmis = apteCond + apteCode;
  const tauxReussite = totalCandidats > 0 ? ((totalAdmis / totalCandidats) * 100).toFixed(2) : '0.00';
  const currentYear = new Date().getFullYear();
  const html = `<div id="pdfContentToPrint" style="font-family:'Times New Roman',Times,serif;color:#000;line-height:1.5;">
    <table style="width:100%;font-size:11px;font-weight:bold;margin-bottom:18px;text-align:center;border-bottom:2px solid #1e3a8a;padding-bottom:12px;">
      <tr>
        <td style="width:50%;vertical-align:top;padding:5px;">Direction Générale des Transports<br>Terrestres et de la Circulation<br>-------------<br>${esc(regionDisplay)}</td>
        <td style="width:50%;vertical-align:top;padding:5px;">république de côte d'ivoire<br>union - discipline - travail<br>-------------</td>
      </tr>
    </table>
    <div style="text-align:center;margin:22px 0 30px;">
      <div style="font-size:16px;font-weight:bold;border:3px double #1e3a8a;padding:12px 28px;display:inline-block;text-transform:uppercase;letter-spacing:1.5px;background:#f0f4ff;border-radius:4px;">RAPPORT D'ACTIVITÉ</div>
      <div style="font-size:12px;margin-top:10px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;">${periodLabel} ${currentYear}</div>
    </div>
    <div style="font-size:13px;text-align:justify;">
      <p>le présent document constitue le rapport officiel d'évaluation des candidats de l'auto-école <b>${esc((autoEcoleNom || (USER && USER.nom) || '').toUpperCase())}</b> aux examens d'obtention du permis de conduire, pour la période correspondant au <b>${periodLabel.toLowerCase()}</b> de l'année <b>${currentYear}</b>.</p>
      <p>au cours de cette période, notre établissement a présenté un effectif global de <b>${totalCandidats}</b> candidat(s) aux différentes sessions d'examens théoriques (code) et pratiques (conduite). à l'issue des délibérations, les résultats statistiques se répartissent de la manière suivante :</p>
      <table style="width:100%;border-collapse:collapse;margin-top:18px;margin-bottom:18px;font-size:12px;">
        <tr style="background:#1e3a8a;color:#fff;"><th style="border:1px solid #1e3a8a;padding:8px;text-align:left;font-size:10px;text-transform:uppercase;">Résultat</th><th style="border:1px solid #1e3a8a;padding:8px;text-align:center;font-size:10px;text-transform:uppercase;">Nombre</th></tr>
        <tr><td style="border:1px solid #999;padding:7px;">candidats déclarés <b>aptes à la conduite</b> (admis)</td><td style="border:1px solid #999;padding:7px;text-align:center;font-weight:bold;">${apteCond}</td></tr>
        <tr style="background:#f8fafc;"><td style="border:1px solid #999;padding:7px;">candidats déclarés <b>aptes au code</b></td><td style="border:1px solid #999;padding:7px;text-align:center;font-weight:bold;">${apteCode}</td></tr>
        <tr><td style="border:1px solid #999;padding:7px;">candidats déclarés <b>inaptes</b> (ajournés)</td><td style="border:1px solid #999;padding:7px;text-align:center;font-weight:bold;">${inapte}</td></tr>
        <tr style="background:#f8fafc;"><td style="border:1px solid #999;padding:7px;">candidats <b>absents</b></td><td style="border:1px solid #999;padding:7px;text-align:center;font-weight:bold;">${absent}</td></tr>
        <tr><td style="border:1px solid #999;padding:7px;">candidats <b>non évalués</b></td><td style="border:1px solid #999;padding:7px;text-align:center;font-weight:bold;">${ne}</td></tr>
      </table>
      <p>le taux de réussite cumulé (aptes conduite et code) pour cet exercice s'établit donc à <b>${tauxReussite} %</b>.</p>
      <p style="margin-top:35px;">fait pour servir et valoir ce que de droit.</p>
    </div>
    <table style="width:100%;border:none;margin-top:55px;">
      <tr><td style="width:50%;border:none;"></td><td style="width:50%;text-align:center;border:none;"><p style="margin-bottom:55px;font-weight:bold;text-transform:uppercase;font-size:11px;">le responsable de l'auto-école</p></td></tr>
    </table>
  </div>`;
  document.getElementById('reportPreviewArea').innerHTML = html;
}

function downloadReportPDF() {
  const el = document.getElementById('pdfContentToPrint');
  if (!el) { toast('Veuillez d\'abord générer l\'aperçu du rapport.', 'error'); return; }
  const periodSelect = document.getElementById('reportPeriod');
  const periodLabel = periodSelect.options[periodSelect.selectedIndex].text;
  const currentYear = new Date().getFullYear();
  const fileName = 'RAPPORT_' + periodLabel.replace(/\s+/g, '_').toUpperCase() + '_' + currentYear + '.pdf';
  // Impression navigateur → PDF. On clone le contenu en retirant le padding interne
  // car @page fournit déjà les marges natives (sinon double marge → décalage).
  const clone = el.cloneNode(true);
  clone.style.padding = '0';
  // @page size A4 + marges natives 15mm (gauche/droite identiques à l'aperçu)
  const win = window.open('', '_blank');
  win.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + fileName + '</title>' +
    '<style>' +
    '@page{size:A4;margin:15mm 18mm;}' +
    '*{box-sizing:border-box;}' +
    'html,body{margin:0;padding:0;background:#fff;}' +
    'body{font-family:\'Times New Roman\',Times,serif;color:#000;line-height:1.5;}' +
    'table{border-collapse:collapse;width:100%;}' +
    '@media print{body{padding:0;}}' +
    '</style></head><body>' + clone.outerHTML + '</body></html>');
  win.document.close();
  setTimeout(() => { win.focus(); win.print(); }, 500);
}

// ============================================================================
async function openPermis() {
  const content = document.getElementById('content');
  content.innerHTML = loaderHTML();
  // Récupère les aptes (à remettre) via le dashboard + les permis retirés
  const [dashRes, permRes] = await Promise.all([API.dashboard(), API.permisRetires()]);
  const aptesCount = (dashRes.stats && dashRes.stats.aptes) || 0;
  const retiresCount = (dashRes.stats && dashRes.stats.retires) || 0;
  const list = permRes.list || [];

  // Pour la remise, on a besoin des inscriptions APTE non encore retirées.
  // On les récupère via les inscriptions du dashboard (AGENT).
  // Le backend renvoie dans le dashboard les examens de la région ; on doit avoir
  // une liste des aptes à remettre. Adaptation : on affiche les 2 sections.
  content.innerHTML = `<div class="fade-in">
    ${setTitle('Remise de permis')}
    <div class="stats-grid">
      ${statCard(aptesCount, 'Permis à remettre', 'fa-id-badge', 'green')}
      ${statCard(retiresCount, 'Permis déjà remis', 'fa-user-check', '')}
    </div>
    <div class="card">
      <div class="card-header"><h3><i class="fas fa-id-card" style="color:var(--blue)"></i> Registre des permis remis</h3></div>
      <div class="table-wrap"><table>
        <thead><tr><th>#</th><th>Nom</th><th>Pièce</th><th>Cat.</th><th>Auto-école</th></tr></thead>
        <tbody>
        ${list.length === 0 ? `<tr><td colspan="5"><div class="empty-state"><i class="fas fa-id-card"></i><p>Aucun permis remis pour le moment.</p></div></td></tr>` :
          list.map((c, i) => `<tr>
            <td>${i + 1}</td>
            <td><b>${esc(c.nomPrenoms)}</b></td>
            <td style="font-family:monospace;">${esc(c.piece)}</td>
            <td><span class="badge badge-info">${esc(c.cat)}</span></td>
            <td>${esc(c.autoEcole)}</td>
          </tr>`).join('')}
        </tbody>
      </table></div>
    </div>
  </div>`;

  // Récupérer les aptes à remettre (via une route dédiée). Pour cela on a besoin
  // de l'ID des inscriptions APTE non retirées. Le backend ne expose pas encore
  // cette liste, donc on l'ajoute via une route.
  const aptesRes = await fetch('/api/stats/permis-a-remettre', { credentials: 'include' }).then(r => r.json()).catch(() => ({ list: [] }));
  const aptesList = aptesRes.list || [];
  if (aptesList.length) {
    const wrap = document.createElement('div');
    wrap.innerHTML = `<div class="card" style="margin-top:22px;">
      <div class="card-header"><h3><i class="fas fa-id-badge" style="color:var(--success)"></i> Candidats APTES en attente de remise (${aptesList.length})</h3></div>
      <div class="table-wrap"><table>
        <thead><tr><th>#</th><th>Nom</th><th>Pièce</th><th>Cat.</th><th>Auto-école</th><th style="text-align:center;">Action</th></tr></thead>
        <tbody>
        ${aptesList.map((c, i) => `<tr>
          <td>${i + 1}</td>
          <td><b>${esc(c.nomPrenoms)}</b></td>
          <td style="font-family:monospace;">${esc(c.piece)}</td>
          <td><span class="badge badge-info">${esc(c.cat)}</span></td>
          <td>${esc(c.autoEcole)}</td>
          <td style="text-align:center;"><button class="btn btn-sm btn-success" onclick="remettrePermis('${c.idInsc}','${esc(c.nomPrenoms)}')"><i class="fas fa-id-card"></i> Remettre le permis</button></td>
        </tr>`).join('')}
        </tbody>
      </table></div>
    </div>`;
    document.querySelector('#content .fade-in').appendChild(wrap.firstElementChild);
  }
}

async function remettrePermis(idInsc, name) {
  if (!await confirmModal('Remise de permis', `Confirmer la remise du permis à <b>${esc(name)}</b> ?`, 'Oui, remettre', false)) return;
  const res = await API.permisRetire(idInsc);
  if (res.success) { toast('Permis remis enregistré.', 'success'); openPermis(); }
  else toast(res.msg || 'Erreur.', 'error');
}

// ============================================================================
//  ABONNEMENTS (SUPER_ADMIN)
// ============================================================================
let _aboList = [];
let _aboFilter = 'ALL';
let _aboSearch = '';

async function openAbonnements() {
  const content = document.getElementById('content');
  content.innerHTML = loaderHTML();
  const res = await API.aboListe();
  _aboList = res.list || [];
  _aboFilter = 'ALL'; _aboSearch = '';
  renderAbonnements();
}

function renderAbonnements() {
  // Statistiques — 2 statuts seulement : actif et bloque
  const total = _aboList.length;
  const actifs = _aboList.filter(a => a.statut === 'actif').length;
  const bloques = _aboList.filter(a => a.statut === 'bloque').length;
  const bientot = _aboList.filter(a => a.statut === 'actif' && a.joursRestants <= 7).length;

  let list = _aboList;
  if (_aboFilter === 'actif') list = list.filter(a => a.statut === 'actif');
  else if (_aboFilter === 'bloque') list = list.filter(a => a.statut === 'bloque');
  else if (_aboFilter === 'bientot') list = list.filter(a => a.statut === 'actif' && a.joursRestants <= 7);
  if (_aboSearch) {
    const q = _aboSearch.toLowerCase();
    list = list.filter(a => String(a.nom).toLowerCase().includes(q) || String(a.email||'').toLowerCase().includes(q) || String(a.region).toLowerCase().includes(q));
  }

  document.getElementById('content').innerHTML = `<div class="fade-in">
    ${setTitle('Abonnements des auto-écoles', `<button class="btn btn-sm btn-ghost" onclick="exportTable('aboTable','abonnements')"><i class="fas fa-file-excel"></i> Export Excel</button>`)}
    <div class="stats-grid">
      ${statCard(total, 'Total', 'fa-school', '')}
      ${statCard(actifs, 'Actifs', 'fa-circle-check', 'green')}
      ${statCard(bientot, 'Expirent bientôt (<7j)', 'fa-hourglass-half', 'yellow')}
      ${statCard(bloques, 'Bloqués', 'fa-ban', 'red')}
    </div>
    <div class="card">
      <div class="card-header">
        <div>
          <h3 style="margin:0;"><i class="fas fa-car" style="color:var(--blue);"></i> Liste des auto-écoles</h3>
          <p class="text-muted" style="margin:4px 0 0;font-size:0.82rem;">Seules les auto-écoles figurent ici. Une AE bloquée peut être réactivée par un paiement ou manuellement ci-dessous.</p>
        </div>
        <select onchange="_aboFilter=this.value;renderAbonnements()" style="max-width:220px;">
          <option value="ALL" ${_aboFilter==='ALL'?'selected':''}>Tous les statuts</option>
          <option value="actif" ${_aboFilter==='actif'?'selected':''}>Actifs</option>
          <option value="bloque" ${_aboFilter==='bloque'?'selected':''}>Bloqués</option>
          <option value="bientot" ${_aboFilter==='bientot'?'selected':''}>Expirent bientôt</option>
        </select>
        <div class="search-bar"><i class="fas fa-search"></i><input placeholder="Rechercher..." value="${esc(_aboSearch)}" oninput="_aboSearch=this.value;renderAbonnements()"></div>
        <span class="text-muted" style="font-size:0.85rem;">${list.length} auto-école(s)</span>
      </div>
      <div class="table-wrap"><table id="aboTable">
        <thead><tr><th>Auto-école</th><th>Région de rattachement</th><th>Statut accès</th><th>Abonnement</th><th>Jours restants</th><th>Expiration</th><th>Action</th></tr></thead>
        <tbody>
        ${list.length === 0 ? `<tr><td colspan="7"><div class="empty-state"><i class="fas fa-credit-card"></i><p>Aucune auto-école.</p></div></td></tr>` :
          list.map(a => `<tr>
            <td><div style="display:flex;align-items:center;gap:8px;"><i class="fas fa-car" style="color:var(--blue);"></i><div><b>${esc(a.nom)}</b><br><span class="text-muted" style="font-size:0.78rem;">${esc(a.email || '')}</span></div></div></td>
            <td><span style="font-size:0.88rem;color:var(--gray);">${esc(a.region)}</span></td>
            <td>${statutBadge(a.statut)}</td>
            <td>${a.statut === 'actif' ? '<span class="badge badge-success"><i class="fas fa-check"></i> Actif</span>' : '<span class="badge badge-danger"><i class="fas fa-xmark"></i> Expiré</span>'}</td>
            <td>${a.statut === 'actif' ? `<b class="${a.joursRestants <= 7 ? 'text-danger' : 'text-success'}">${a.joursRestants} j</b>` : '<span class="text-muted">—</span>'}</td>
            <td>${esc(a.dateFin)}</td>
            <td>
              ${a.statut === 'actif'
                ? `<button class="btn btn-sm btn-danger" onclick="toggleAbo('${a.id}','bloque','${esc(a.nom)}')"><i class="fas fa-ban"></i> Bloquer</button>`
                : `<button class="btn btn-sm btn-success" onclick="toggleAbo('${a.id}','actif','${esc(a.nom)}')"><i class="fas fa-check"></i> Réactiver</button>`}
            </td>
          </tr>`).join('')}
        </tbody>
      </table></div>
    </div>
  </div>`;
}

async function toggleAbo(idAE, newStatus, name) {
  const action = newStatus === 'actif' ? 'Activer' : 'Bloquer';
  if (!await confirmModal(`${action} l'abonnement`, `${action} l'abonnement de <b>${esc(name)}</b> ?${newStatus === 'actif' ? '<br>Un reçu sera généré.' : ''}`, action, newStatus === 'bloque')) return;
  const res = await API.toggleAbo(idAE, newStatus);
  if (res.success) { toast('Statut modifié.', 'success'); openAbonnements(); }
  else toast(res.msg || 'Erreur.', 'error');
}

// ============================================================================
//  PARAMÈTRES ABONNEMENT (SUPER_ADMIN)
// ============================================================================
async function openAboParams() {
  const content = document.getElementById('content');
  content.innerHTML = loaderHTML();
  const res = await API.aboParams();
  content.innerHTML = `<div class="fade-in">
    ${setTitle('Paramètres abonnement')}
    <div class="card" style="max-width:500px;"><div class="card-body">
      <h4 style="margin-top:0;"><i class="fas fa-cog" style="color:var(--blue)"></i> Configuration</h4>
      <div class="form-group"><label>Montant mensuel (FCFA)</label><input id="aboMontant" type="number" value="${res.montant || 200}"></div>
      <div class="form-group"><label>Durée (jours)</label><input id="aboDuree" type="number" value="${res.duree_jours || 30}"></div>
      <button class="btn btn-primary" onclick="saveAboParams()"><i class="fas fa-save"></i> Enregistrer</button>
    </div></div>
  </div>`;
}

async function saveAboParams() {
  const montant = parseInt(document.getElementById('aboMontant').value);
  const dureeJours = parseInt(document.getElementById('aboDuree').value);
  if (!montant || montant <= 0) return toast('Veuillez saisir un montant valide (supérieur à 0).', 'error');
  if (!dureeJours || dureeJours <= 0) return toast('Veuillez saisir une durée valide (en jours).', 'error');
  const res = await API.saveAboParams({ montant, dureeJours });
  if (res.success) toast('Paramètres enregistrés : ' + montant + ' FCFA / ' + dureeJours + ' jours.', 'success');
  else toast(res.msg || res.error || 'Erreur lors de l\'enregistrement.', 'error');
}

// ============================================================================
//  REÇUS (SUPER_ADMIN)
// ============================================================================
let _recusList = [];
async function openRecus() {
  const content = document.getElementById('content');
  content.innerHTML = loaderHTML();
  const res = await API.recus();
  _recusList = res.list || [];
  renderRecus('');
}
function renderRecus(search) {
  let list = _recusList;
  if (search) {
    const q = search.toLowerCase();
    list = list.filter(r => String(r.num_recu||'').toLowerCase().includes(q) || String(r.ae_nom||'').toLowerCase().includes(q));
  }
  document.getElementById('content').innerHTML = `<div class="fade-in">
    ${setTitle('Reçus de paiement', `<button class="btn btn-sm btn-ghost" onclick="openRecus()"><i class="fas fa-sync"></i> Rafraîchir</button>`)}
    <div class="card">
      <div class="card-header">
        <div class="search-bar"><i class="fas fa-search"></i><input placeholder="Rechercher un reçu..." value="${esc(search)}" oninput="renderRecus(this.value)"></div>
        <span class="text-muted" style="font-size:0.85rem;">${list.length} reçu(s)</span>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>N°</th><th>Numéro reçu</th><th>Auto-école</th><th>Date émission</th><th>Période</th><th>Montant</th><th>Statut</th><th>Actions</th></tr></thead>
        <tbody>
        ${list.length === 0 ? `<tr><td colspan="8"><div class="empty-state"><i class="fas fa-receipt"></i><p>Aucun reçu émis.</p></div></td></tr>` :
          list.map((r, i) => `<tr>
            <td>${i + 1}</td>
            <td style="font-family:monospace;font-size:0.82rem;"><b>${esc(r.num_recu)}</b></td>
            <td><b>${esc(r.ae_nom)}</b><br><span class="text-muted" style="font-size:0.75rem;">${esc(r.id_ae)}</span></td>
            <td>${formatDateFR(r.date_emission)}</td>
            <td style="font-size:0.82rem;">${formatDateFR(r.periode_debut)} → ${formatDateFR(r.periode_fin)}</td>
            <td><b>${Number(r.montant).toLocaleString('fr-FR')}</b> FCFA</td>
            <td>${statutBadge(r.statut)}</td>
            <td><div class="action-btns">
              <button class="act-btn view" title="Imprimer" onclick="openDocument('/api/documents/recu/${r.id_ae}')"><i class="fas fa-print"></i></button>
              <button class="act-btn delete" title="Supprimer" onclick="deleteRecu('${r.id}','${esc(r.num_recu||r.id)}')"><i class="fas fa-trash"></i></button>
            </div></td>
          </tr>`).join('')}
        </tbody>
      </table></div>
    </div>
  </div>`;
}
async function deleteRecu(id, num) {
  if (!await confirmModal('Supprimer le reçu', `Supprimer le reçu <b>${esc(num)}</b> ?`, 'Supprimer', true)) return;
  const res = await API.deleteRecu(id);
  if (res.success) { toast('Reçu supprimé.', 'success'); _recusList = res.list || []; renderRecus(''); }
  else toast(res.msg || 'Erreur.', 'error');
}

// ============================================================================
//  MON ABONNEMENT (AUTO_ECOLE)
// ============================================================================
async function openMonAbonnement() {
  const content = document.getElementById('content');
  content.innerHTML = loaderHTML();
  const [res, recusRes] = await Promise.all([API.monAbo(), API.mesRecus()]);
  if (!res.success) { content.innerHTML = emptyState('Impossible de charger.'); return; }
  const { ae, abonnement, montant } = res;
  const actif = abonnement.estActif;
  const recus = recusRes.list || [];
  const expireBientot = actif && abonnement.joursRestants <= 7;

  content.innerHTML = `<div class="fade-in">
    ${setTitle('Mon abonnement')}
    <div class="stats-grid">
      ${statCard(actif ? 'Actif' : 'Expiré', 'Statut', actif ? 'fa-circle-check' : 'fa-circle-xmark', actif ? 'green' : 'red')}
      ${statCard(abonnement.joursRestants, 'Jours restants', 'fa-calendar-day', abonnement.joursRestants <= 7 ? 'red' : '')}
      ${statCard(montant.toLocaleString('fr-FR'), 'Tarif (FCFA)', 'fa-money-bill', 'yellow')}
    </div>
    ${expireBientot ? `<div class="card" style="border-left:5px solid var(--warning);background:#fffbeb;"><div class="card-body" style="padding:14px 18px;"><i class="fas fa-triangle-exclamation" style="color:var(--warning)"></i> <b>Expiration proche !</b> Votre abonnement expire dans ${abonnement.joursRestants} jour(s). Contactez votre Direction Régionale pour le renouveler.</div></div>` : ''}
    <div class="card"><div class="card-body">
      <h4 style="margin-top:0;"><i class="fas fa-building" style="color:var(--blue)"></i> ${esc(ae.nom)}</h4>
      <p class="text-muted">ID : <b>${esc(USER.id)}</b> • ${esc(ae.email || '')} • ${esc(ae.tel || '')} • ${esc(ae.adresse || '')}</p>
      <hr style="border:none;border-top:1px solid var(--border);margin:16px 0;">
      <div class="flex-between" style="margin-bottom:8px;"><span class="text-muted">Date de début</span><b>${abonnement.dateFin ? formatDateFR(new Date(new Date(abonnement.dateFin) - abonnement.joursRestants * 86400000)) : '—'}</b></div>
      <div class="flex-between" style="margin-bottom:8px;"><span class="text-muted">Date d'expiration</span><b>${formatDateFR(abonnement.dateFin)}</b></div>
      <div class="flex-between"><span class="text-muted">Tarif mensuel</span><b>${montant.toLocaleString('fr-FR')} FCFA</b></div>
      <hr style="border:none;border-top:1px solid var(--border);margin:16px 0;">
      <button class="btn btn-primary" onclick="openDocument('/api/documents/recu/${USER.id}')"><i class="fas fa-file-pdf"></i> Télécharger mon reçu actuel</button>
    </div></div>
    <div class="card">
      <div class="card-header"><h3><i class="fas fa-receipt" style="color:var(--blue)"></i> Historique des paiements (${recus.length})</h3></div>
      <div class="table-wrap"><table>
        <thead><tr><th>N° reçu</th><th>Date émission</th><th>Période</th><th>Montant</th><th>Statut</th><th>Action</th></tr></thead>
        <tbody>
        ${recus.length === 0 ? `<tr><td colspan="6"><div class="empty-state"><i class="fas fa-receipt"></i><p>Aucun paiement enregistré.</p></div></td></tr>` :
          recus.map(r => `<tr>
            <td style="font-family:monospace;font-size:0.8rem;"><b>${esc(r.num_recu || r.id)}</b></td>
            <td>${formatDateFR(r.date_emission)}</td>
            <td>${formatDateFR(r.periode_debut)} → ${formatDateFR(r.periode_fin)}</td>
            <td><b>${Number(r.montant).toLocaleString('fr-FR')}</b> FCFA</td>
            <td>${statutBadge(r.statut)}</td>
            <td><button class="btn btn-sm btn-ghost" onclick="openDocument('/api/documents/recu/${USER.id}')"><i class="fas fa-print"></i></button></td>
          </tr>`).join('')}
        </tbody>
      </table></div>
    </div>
  </div>`;
}

// ============================================================================
//  SÉCURITÉ & ACCÈS (AUTO_ECOLE - gérant)
// ============================================================================
async function openSecurite() {
  const content = document.getElementById('content');
  content.innerHTML = `<div class="fade-in">
    ${setTitle('Sécurité & Accès')}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;" class="responsive-grid">
      <div class="card"><div class="card-body">
        <h4 style="margin-top:0;"><i class="fas fa-key" style="color:var(--danger)"></i> Changer mon mot de passe</h4>
        <div class="form-group"><label>Mot de passe actuel</label><input id="oldPass" type="password"></div>
        <div class="form-group"><label>Nouveau mot de passe</label><input id="newPass" type="password"></div>
        <small class="text-muted">Min. 8 caractères, 1 majuscule, 1 chiffre, 1 caractère spécial.</small>
        <div class="form-group"><label>Confirmer</label><input id="confirmPass" type="password"></div>
        <button class="btn btn-primary btn-block" onclick="changePassword()"><i class="fas fa-save"></i> Mettre à jour</button>
      </div></div>
      <div class="card"><div class="card-body">
        <h4 style="margin-top:0;"><i class="fas fa-user-plus" style="color:var(--blue)"></i> Créer un accès collaborateur</h4>
        <div class="form-group"><label>Nom du collaborateur</label><input id="staffNom" placeholder="Ex: KONE Fatoumata"></div>
        <div class="form-group"><label>Mot de passe</label><input id="staffPass" type="text" placeholder="Min. 6 caractères"></div>
        <div class="form-group"><label>Rôle</label><select id="staffRole">
          <option value="SECRETAIRE">Secrétaire (saisie uniquement)</option>
          <option value="GERANT">Gérant (accès total)</option>
        </select></div>
        <div style="background:rgba(6,64,43,0.08);border:1px solid rgba(6,64,43,0.3);border-radius:12px;padding:12px 15px;font-size:0.8rem;color:#2E5E4B;line-height:1.6;margin-bottom:14px;">
          <i class="fas fa-circle-info"></i> Le collaborateur se connectera avec <b>l'email de l'auto-école</b> et le <b>mot de passe</b> que vous définissez ici. Ses accès dépendront du rôle choisi.
        </div>
        <button class="btn btn-primary btn-block" onclick="createStaff()"><i class="fas fa-plus"></i> Créer l'accès</button>
      </div></div>
    </div>
    <div class="card"><div class="card-header"><h3>Collaborateurs actifs</h3></div>
      <div id="staffList" class="table-wrap">${loaderHTML()}</div>
    </div>
  </div>
  <style>@media(max-width:768px){.responsive-grid{grid-template-columns:1fr !important;}}</style>`;
  await loadStaff();
}

async function loadStaff() {
  const res = await API.staff();
  const list = res.list || [];
  const el = document.getElementById('staffList');
  if (!el) return;
  el.innerHTML = `<table>
    <thead><tr><th>Collaborateur</th><th>Rôle</th><th>Connexion</th><th>Action</th></tr></thead>
    <tbody>
    ${list.length === 0 ? `<tr><td colspan="4"><div class="empty-state"><i class="fas fa-users"></i><p>Aucun collaborateur.</p></div></td></tr>` :
      list.map(s => `<tr>
        <td><b>${esc(s.nom)}</b></td>
        <td>${s.role === 'GERANT' ? '<span class="badge badge-info"><i class="fas fa-user-tie"></i> Gérant</span>' : '<span class="badge badge-gray"><i class="fas fa-keyboard"></i> Secrétaire</span>'}</td>
        <td><small style="color:var(--gray);">📧 Email de l'auto-école<br>🔑 Mot de passe personnel</small></td>
        <td><button class="act-btn delete" onclick="deleteStaff('${s.id}','${esc(s.nom)}')"><i class="fas fa-trash"></i></button></td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

async function changePassword() {
  const oldP = document.getElementById('oldPass').value;
  const newP = document.getElementById('newPass').value;
  const conf = document.getElementById('confirmPass').value;
  if (!oldP || !newP || !conf) return toast('Tous les champs sont obligatoires.', 'error');
  if (newP !== conf) return toast('Les mots de passe ne correspondent pas.', 'error');
  if (!/^(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/.test(newP)) return toast('Mot de passe trop faible.', 'error');
  const res = await API.changePassword({ id: USER.id, staffId: USER.staffId, isMain: USER.isMain, oldPass: oldP, newPass: newP });
  if (res.success) {
    toast('Mot de passe mis à jour.', 'success');
    document.getElementById('oldPass').value = '';
    document.getElementById('newPass').value = '';
    document.getElementById('confirmPass').value = '';
  } else toast(res.msg || 'Erreur.', 'error');
}

async function createStaff() {
  const nom = document.getElementById('staffNom').value.trim();
  const motDePasse = document.getElementById('staffPass').value;
  const subRole = document.getElementById('staffRole').value;
  if (!nom) return toast('Le nom est obligatoire.', 'error');
  if (!motDePasse || motDePasse.length < 6) return toast('Le mot de passe doit contenir au moins 6 caractères.', 'error');
  const res = await API.createStaff({ nom, motDePasse, subRole });
  if (res.success) {
    alertModal('Accès créé pour ' + esc(nom),
      `Le collaborateur se connectera avec :<br><br>
       📧 <b>L'email de l'auto-école</b><br>
       🔑 Mot de passe : <b style="font-size:1.4rem;color:var(--danger);font-family:monospace;">${esc(motDePasse)}</b><br><br>
       <small style="color:var(--gray);">Ses accès : ${subRole === 'GERANT' ? 'accès total (gérant)' : 'saisie uniquement (secrétaire)'}</small>`, 'fa-key', 'success');
    document.getElementById('staffNom').value = '';
    document.getElementById('staffPass').value = '';
    loadStaff();
  } else toast(res.msg || 'Erreur.', 'error');
}

async function deleteStaff(id, name) {
  if (!await confirmModal('Révoquer', `Révoquer l'accès de <b>${esc(name)}</b> ?`, 'Révoquer', true)) return;
  const res = await API.deleteStaff(id);
  if (res.success) { toast('Accès révoqué.', 'success'); loadStaff(); }
  else toast(res.msg || 'Erreur.', 'error');
}

// ============================================================================
//  SIGNATAIRES / RESPONSABLES RÉGIONAUX (REGION)
// ============================================================================
async function openResponsables() {
  const content = document.getElementById('content');
  content.innerHTML = loaderHTML();
  const res = await API.responsables();
  const d = res.data || {};
  // Le directeur_regional peut être stocké "Directeur Régional||Nom" ou juste "Nom"
  let dirTitle = 'Directeur Régional';
  let dirNom = '';
  if (d.directeur_regional && d.directeur_regional.includes('||')) {
    const parts = d.directeur_regional.split('||');
    dirTitle = parts[0].trim();
    dirNom = parts[1].trim();
  } else {
    dirNom = d.directeur_regional || '';
  }
  content.innerHTML = `<div class="fade-in">
    ${setTitle('Responsables (Signataires officiels)')}
    <p class="text-muted" style="margin-top:-10px;">Ces noms apparaîtront sur les comptes rendus et documents officiels.</p>
    <div class="card" style="max-width:620px;"><div class="card-body">
      <div class="form-group">
        <label><i class="fas fa-user-tie"></i> Responsable de la Direction Régionale</label>
        <div class="flex gap-12" style="margin-bottom:10px;">
          <label class="chk"><input type="radio" name="dirTitre" value="Directeur Régional" ${dirTitle === 'Directeur Régional' ? 'checked' : ''}> Directeur Régional</label>
          <label class="chk"><input type="radio" name="dirTitre" value="Directrice Régionale" ${dirTitle === 'Directrice Régionale' ? 'checked' : ''}> Directrice Régionale</label>
        </div>
        <input id="respDirNom" placeholder="Nom et prénoms" value="${esc(dirNom)}">
      </div>
      <div class="form-group"><label><i class="fas fa-user-tie"></i> Chef de Service TTC (STTC)</label><input id="respChef" value="${esc(d.chef_sttc || '')}"></div>
      <div class="form-group"><label><i class="fas fa-user-gear"></i> Coordonnateur des examens du permis de conduire</label><input id="respCoord" value="${esc(d.coordonnateur || '')}"></div>
      <button class="btn btn-primary" onclick="saveResponsables()"><i class="fas fa-save"></i> Enregistrer les responsables</button>
    </div></div>
  </div>`;
}

async function saveResponsables() {
  const titreRadio = document.querySelector('input[name="dirTitre"]:checked');
  const titre = titreRadio ? titreRadio.value : 'Directeur Régional';
  const dirNom = document.getElementById('respDirNom').value.trim();
  const dirCombo = dirNom ? `${titre}||${dirNom}` : '';
  const data = {
    chefSttc: document.getElementById('respChef').value.trim(),
    coordonnateur: document.getElementById('respCoord').value.trim(),
    directeurRegional: dirCombo
  };
  const res = await API.saveResponsables(data);
  if (res.success) toast('Responsables enregistrés.', 'success');
  else toast(res.msg || 'Erreur.', 'error');
}
