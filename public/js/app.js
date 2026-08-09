// ============================================================================
//  SIGEXPC - Application principale (auth, navigation, menu)
// ============================================================================
let USER = null;

document.addEventListener('DOMContentLoaded', () => {
  // Thème
  if (localStorage.getItem('sigexpc-theme') === 'dark') {
    document.body.classList.add('dark-mode');
    document.getElementById('themeIcon').classList.replace('fa-moon', 'fa-sun');
  }
  // Vérifier session existante
  checkSession();
  // Enregistrer le Service Worker (PWA)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((reg) => console.log('SW enregistré:', reg.scope))
      .catch((err) => console.log('SW erreur:', err));
  }
});

// ---------- Theme ----------
function toggleDarkMode() {
  const isDark = document.body.classList.toggle('dark-mode');
  const icon = document.getElementById('themeIcon');
  if (isDark) { icon.classList.replace('fa-moon', 'fa-sun'); localStorage.setItem('sigexpc-theme', 'dark'); }
  else { icon.classList.replace('fa-sun', 'fa-moon'); localStorage.setItem('sigexpc-theme', 'light'); }
}

// ---------- Sidebar ----------
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('show');
}

// ---------- Vérifier session ----------
async function checkSession() {
  // Détection d'un retour paiement dans l'URL (?paid=success / ?paid=failure)
  const params = new URLSearchParams(window.location.search);
  const paid = params.get('paid');
  if (paid === 'success') {
    setTimeout(() => toast('Paiement confirmé ! Votre abonnement est réactivé. Vous pouvez vous connecter.', 'success'), 800);
  } else if (paid === 'failure') {
    setTimeout(() => toast('Le paiement n\'a pas abouti. Veuillez réessayer.', 'error'), 800);
  }
  // Nettoyer l'URL (sans recharger la page)
  if (paid) {
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
  }
  try {
    const res = await API.me();
    if (res.success) {
      USER = res.user;
      enterApp();
    }
  } catch (e) { /* pas connecté */ }
}

// ---------- Connexion ----------
document.getElementById('btnLogin').addEventListener('click', handleLogin);
document.getElementById('lPass').addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });

async function handleLogin() {
  const email = document.getElementById('lEmail').value.trim();
  const pass = document.getElementById('lPass').value;
  const role = document.getElementById('lRole').value;
  const errBox = document.getElementById('loginError');
  const btn = document.getElementById('btnLogin');

  errBox.classList.remove('show');
  if (!email || !pass) {
    errBox.innerHTML = '<b>Champs manquants</b><br>Veuillez renseigner l\'email et le mot de passe.';
    errBox.classList.add('show');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connexion...';

  const res = await API.login(email, pass, role);
  btn.disabled = false;
  btn.innerHTML = '<i class="fas fa-right-to-bracket"></i> Se connecter';

  if (res.success) {
    USER = res.user;
    enterApp();
    toast(`Bienvenue, ${USER.nom} !`, 'success');
  } else if (res.isBlocked) {
    document.getElementById('payAEName').innerText = res.aeName || '—';
    document.getElementById('loginView').style.display = 'none';
    document.getElementById('paymentView').style.display = 'flex';
    // Montant DYNAMIQUE renvoyé par le backend (défini par le super admin)
    window._blockedAeId = res.aeId;
    const montant = Number(res.montant || 200);
    document.getElementById('payMontant').innerText = montant.toLocaleString('fr-FR') + ' FCFA';
  } else {
    errBox.innerHTML = `<b>Accès refusé</b><br>${esc(res.msg || res.error || 'Identifiants incorrects.')}`;
    errBox.classList.add('show');
  }
}

function backToLogin() {
  document.getElementById('paymentView').style.display = 'none';
  document.getElementById('loginView').style.display = 'flex';
  document.getElementById('lPass').value = '';
  document.getElementById('lEmail').value = '';
}

// Redirection vers GeniusPay pour paiement d'abonnement
async function redirectToGeniusPay() {
  const btn = document.getElementById('btnPayNow');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Redirection...';
  try {
    // Se connecter d'abord (pour avoir une session), puis initier le paiement
    // L'AE est bloquée mais on peut quand même initier le paiement avec son id
    const res = await fetch('/api/abonnements/initier-paiement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ aeId: window._blockedAeId })
    }).then(r => r.json());
    if (res.success && res.checkoutUrl) {
      toast('Redirection vers GeniusPay...', 'success');
      window.location.href = res.checkoutUrl;
    } else {
      toast(res.msg || 'Erreur lors de la génération du lien de paiement.', 'error');
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-credit-card"></i> Payer maintenant';
    }
  } catch (e) {
    toast('Erreur réseau : ' + e.message, 'error');
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-credit-card"></i> Payer maintenant';
  }
}

// ---------- Entrée dans l'app ----------
function enterApp() {
  document.getElementById('loginView').style.display = 'none';
  document.getElementById('paymentView').style.display = 'none';
  document.getElementById('sidebar').classList.add('show');
  document.getElementById('main').classList.add('show');

  document.getElementById('userName').innerText = USER.nom;
  document.getElementById('userRoleLabel').innerText = roleLabel(USER.role, USER.subRole);
  document.getElementById('sidebarRole').innerText = roleLabel(USER.role, USER.subRole);

  buildMenu();
  // Page d'accueil selon le rôle
  if (USER.role === 'STTC') openSTTC();
  else openDashboard();
}

function roleLabel(role, subRole) {
  const map = {
    SUPER_ADMIN: 'Super Administrateur',
    REGION: 'Direction Régionale',
    AUTO_ECOLE: subRole === 'GERANT' ? 'Gérant Auto-École' : (subRole === 'SECRETAIRE' ? 'Secrétaire Auto-École' : 'Auto-École'),
    AGENT: 'Agent Vérificateur',
    STTC: 'Service STTC'
  };
  return map[role] || role;
}

// ---------- Déconnexion ----------
async function logout() {
  const ok = await confirmModal('Déconnexion', 'Voulez-vous vraiment vous déconnecter ?', 'Se déconnecter', true);
  if (!ok) return;
  await API.logout();
  USER = null;
  document.getElementById('sidebar').classList.remove('show');
  document.getElementById('main').classList.remove('show');
  document.getElementById('loginView').style.display = 'flex';
  document.getElementById('lEmail').value = '';
  document.getElementById('lPass').value = '';
  toast('Vous êtes déconnecté.', 'info');
}

// ---------- Menu latéral ----------
function buildMenu() {
  let html = '';
  const r = USER.role;

  if (r === 'STTC') {
    html += navItem('sttc', 'fa-file-contract', 'Comptes Rendus', true);
  } else {
    html += navItem('dashboard', 'fa-chart-line', 'Tableau de bord', true);
    if (r === 'SUPER_ADMIN') {
      html += sectionTitle('Gestion');
      html += navItem('regions', 'fa-building', 'Directions Régionales');
      html += navItem('abonnements', 'fa-credit-card', 'Abonnements');
      html += navItem('recus', 'fa-receipt', 'Reçus de paiement');
      html += sectionTitle('Paramètres');
      html += navItem('abo-params', 'fa-cog', 'Paramètres abonnement');
    } else if (r === 'REGION') {
      html += sectionTitle('Examens');
      html += navItem('examens', 'fa-calendar-days', 'Planification examens');
      html += navItem('bordereaux', 'fa-print', 'Bordereaux');
      html += navItem('deliberes', 'fa-check-double', 'Bordereaux délibérés');
      html += navItem('sttc', 'fa-file-contract', 'Comptes rendus STTC');
      html += navItem('statistiques', 'fa-chart-pie', 'Bilan & Statistiques');
      html += navItem('analyse', 'fa-chart-bar', 'Analyse (TCD)');
      html += sectionTitle('Administration');
      html += navItem('ae', 'fa-school', 'Auto-Écoles');
      html += navItem('agents', 'fa-user-shield', 'Agents Vérificateurs');
      html += navItem('sttc-users', 'fa-users-cog', 'Agents STTC');
      html += navItem('responsables', 'fa-user-tie', 'Signataires');
      html += navItem('config', 'fa-gear', 'Configuration');
    } else if (r === 'AUTO_ECOLE') {
      html += sectionTitle('Gestion');
      html += navItem('candidats', 'fa-users', 'Candidats');
      html += navItem('inscriptions', 'fa-clipboard-check', 'Inscriptions bordereau');
      html += navItem('analyse', 'fa-chart-pie', 'Analyse (TCD)');
      html += navItem('rapports', 'fa-file-pdf', 'Rapports officiels');
      html += navItem('deliberes-ae', 'fa-check-double', 'Bordereaux délibérés');
      html += sectionTitle('Mon compte');
      html += navItem('mon-abonnement', 'fa-receipt', 'Mon abonnement');
      if (USER.isMain || USER.subRole === 'GERANT') {
        html += navItem('securite', 'fa-lock', 'Sécurité & Accès');
      }
    } else if (r === 'AGENT') {
      html += sectionTitle('Remise de permis');
      html += navItem('permis', 'fa-id-card', 'Permis à remettre');
    }
  }

  document.getElementById('menuItems').innerHTML = html;
}

function navItem(target, icon, label, active = false) {
  return `<div class="nav-link ${active ? 'active' : ''}" data-target="${target}" onclick="navTo(this, '${target}')"><i class="fas ${icon}"></i> ${label}</div>`;
}
function sectionTitle(title) {
  return `<div class="nav-section-title">${title}</div>`;
}

// ---------- Navigation ----------
async function navTo(el, target) {
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  if (el) el.classList.add('active');

  // Fermer sidebar sur mobile
  if (window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('show');
  }

  const content = document.getElementById('content');
  content.classList.remove('fade-in'); void content.offsetWidth; content.classList.add('fade-in');
  content.innerHTML = loaderHTML('Chargement...');

  try {
    const map = {
      'dashboard': openDashboard,
      'sttc': openSTTC,
      'regions': openRegions,
      'abonnements': openAbonnements,
      'recus': openRecus,
      'abo-params': openAboParams,
      'examens': openExamens,
      'bordereaux': openBordereaux,
      'deliberes': openDeliberes,
      'statistiques': openStatistiques,
      'analyse': openAnalyse,
      'rapports': openRapports,
      'ae': openAutoEcoles,
      'agents': openAgents,
      'sttc-users': openSTTCUsers,
      'centres': openCentres,
      'responsables': openResponsables,
      'config': openConfigRegion,
      'candidats': openCandidats,
      'inscriptions': openInscriptions,
      'deliberes-ae': openDeliberesAE,
      'mon-abonnement': openMonAbonnement,
      'securite': openSecurite,
      'permis': openPermis
    };
    if (map[target]) await map[target]();
  } catch (e) {
    content.innerHTML = `<div class="card"><div class="card-body"><div class="empty-state"><i class="fas fa-triangle-exclamation"></i><p>Erreur de chargement : ${esc(e.message)}</p></div></div></div>`;
  }
}

// Ouvrir un document dans un nouvel onglet
function openDocument(path) {
  window.open(path, '_blank');
}
