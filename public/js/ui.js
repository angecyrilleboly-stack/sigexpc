// ============================================================================
//  SIGEXPC - Composants UI réutilisables (modales, toasts, loaders, badges)
// ============================================================================

// ---------- Toasts ----------
function toast(message, type = 'info', duration = 3500) {
  const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', warning: 'fa-triangle-exclamation', info: 'fa-circle-info' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span class="toast-msg">${message}</span>`;
  document.getElementById('toastContainer').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(100%)'; setTimeout(() => el.remove(), 300); }, duration);
}

// ---------- Modales ----------
function alertModal(title, body, icon = 'fa-circle-info', type = '') {
  return new Promise(resolve => {
    const box = document.getElementById('modalBox');
    box.className = 'modal-box ' + type;
    document.getElementById('modalTitle').innerHTML = `<i class="fas ${icon}" style="color:var(--blue)"></i> ${title}`;
    document.getElementById('modalBody').innerHTML = body;
    document.getElementById('modalFooter').innerHTML = `<button class="btn btn-primary" id="modalOkBtn">OK</button>`;
    document.getElementById('modal').classList.add('show');
    document.getElementById('modalOkBtn').onclick = () => { closeModal(); resolve(true); };
  });
}

function confirmModal(title, body, confirmText = 'Confirmer', isDanger = false) {
  return new Promise(resolve => {
    const box = document.getElementById('modalBox');
    box.className = 'modal-box ' + (isDanger ? 'danger' : '');
    document.getElementById('modalTitle').innerHTML = `<i class="fas ${isDanger ? 'fa-triangle-exclamation' : 'fa-circle-question'}" style="color:${isDanger ? 'var(--danger)' : 'var(--blue)'}"></i> ${title}`;
    document.getElementById('modalBody').innerHTML = body;
    const confirmCls = isDanger ? 'btn-danger' : 'btn-primary';
    document.getElementById('modalFooter').innerHTML = `
      <button class="btn btn-ghost" id="modalCancelBtn">Annuler</button>
      <button class="btn ${confirmCls}" id="modalConfirmBtn">${confirmText}</button>`;
    document.getElementById('modal').classList.add('show');
    document.getElementById('modalCancelBtn').onclick = () => { closeModal(); resolve(false); };
    document.getElementById('modalConfirmBtn').onclick = () => { closeModal(); resolve(true); };
  });
}

function formModal(title, formHtml, saveText = 'Enregistrer') {
  return new Promise(resolve => {
    const box = document.getElementById('modalBox');
    box.className = 'modal-box';
    document.getElementById('modalTitle').innerHTML = `<i class="fas fa-pen" style="color:var(--blue)"></i> ${title}`;
    document.getElementById('modalBody').innerHTML = `<div class="form-grid">${formHtml}</div>`;
    document.getElementById('modalFooter').innerHTML = `
      <button class="btn btn-ghost" id="modalCancelBtn">Annuler</button>
      <button class="btn btn-primary" id="modalSaveBtn"><i class="fas fa-save"></i> ${saveText}</button>`;
    document.getElementById('modal').classList.add('show');
    document.getElementById('modalCancelBtn').onclick = () => { closeModal(); resolve(null); };
    document.getElementById('modalSaveBtn').onclick = () => {
      const data = {};
      document.querySelectorAll('#modalBody [name]').forEach(el => {
        if (el.type === 'checkbox') data[el.name] = el.checked;
        else data[el.name] = el.value;
      });
      closeModal();
      resolve(data);
    };
  });
}

function closeModal() { document.getElementById('modal').classList.remove('show'); }

// Fermer modale en cliquant à l'extérieur
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('modal').addEventListener('click', (e) => {
    if (e.target.id === 'modal') closeModal();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
});

// ---------- Loaders ----------
function loaderHTML(msg = 'Chargement...') {
  return `<div class="loader-wrap">
    <div class="traffic-light">
      <div class="tl-dot-lg red active"></div>
      <div class="tl-dot-lg"></div>
      <div class="tl-dot-lg"></div>
    </div>
    <div class="loader-text">${msg}</div>
  </div>`;
}

// Animation du feu tricolore (loader + logos)
setInterval(() => {
  // Loader gros feu tricolore
  const dots = document.querySelectorAll('.traffic-light .tl-dot-lg');
  const colors = ['red', 'orange', 'green'];
  let activeIdx = -1;
  dots.forEach((d, i) => { if (d.classList.contains('active')) activeIdx = i; });
  if (dots.length) {
    dots.forEach(d => d.classList.remove('active', 'red', 'orange', 'green'));
    const next = (activeIdx + 1) % 3;
    dots[next].classList.add('active', colors[next]);
  }
}, 800);

// ---------- Empty state ----------
function emptyState(msg = 'Aucune donnée', icon = 'fa-inbox') {
  return `<div class="empty-state"><i class="fas ${icon}"></i><p>${msg}</p></div>`;
}

// ---------- Badges de statut ----------
function statutBadge(statut) {
  const s = String(statut || '').toLowerCase().trim();
  let cls = 'badge-gray', icon = 'fa-clock', label = statut || '—';
  // Cas spécifiques d'abord (inactif avant actif car 'inactif' contient 'actif')
  if (s === 'inactif') { cls = 'badge-warning'; icon = 'fa-clock'; label = 'Inactif (expiré)'; }
  else if (s === 'bloque') { cls = 'badge-danger'; icon = 'fa-ban'; label = 'Bloqué'; }
  else if (s === 'actif') { cls = 'badge-success'; icon = 'fa-circle-check'; label = 'Actif'; }
  else if (s.includes('apte') || s.includes('admis') || s.includes('valid') || s.includes('retir')) { cls = 'badge-success'; icon = 'fa-check'; }
  else if (s.includes('inapte') || s.includes('ajourn') || s.includes('expir') || s.includes('absent')) { cls = 'badge-danger'; icon = 'fa-xmark'; }
  else if (s.includes('attente') || s.includes('envoy') || s.includes('ouvert')) { cls = 'badge-warning'; icon = 'fa-clock'; }
  return `<span class="badge ${cls}"><i class="fas ${icon}"></i> ${label}</span>`;
}

// ---------- Échappement HTML ----------
function esc(str) {
  return String(str || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

// ---------- Formatage date FR ----------
function formatDateFR(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt)) return String(d);
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
}
function dateToInput(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt)) return '';
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}
