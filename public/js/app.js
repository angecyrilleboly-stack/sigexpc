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
  // Enregistrer le Service Worker (PWA) — mise à jour toujours vérifiée
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((reg) => {
        // Activer immédiatement un SW en attente puis recharger une seule fois
        if (reg.waiting) reg.waiting.postMessage('SKIP_WAITING');
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
              nw.postMessage('SKIP_WAITING');
            }
          });
        });
        let reloaded = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (reloaded) return;
          reloaded = true;
          window.location.reload();
        });
        // Vérifier les mises à jour à chaque chargement
        reg.update().catch(() => {});
      })
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
    } else {
      try { localStorage.removeItem('sigexpc-logged-in'); } catch (e2) {}
    }
  } catch (e) {
    // Pas connecté (session absente ou expirée) : synchroniser le drapeau
    try { localStorage.removeItem('sigexpc-logged-in'); } catch (e2) {}
  }
}

// ---------- Installation PWA (relance pour inciter à installer) ----------
let deferredPrompt = null;
const INSTALL_DISMISS_KEY = 'sigexpc-install-dismissed-at';

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true;
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// "Plus tard" ne cache la bannière que 24h : on relance l'utilisateur
// jusqu'à ce qu'il installe réellement l'application.
function installRecentlyDismissed() {
  const t = Number(localStorage.getItem(INSTALL_DISMISS_KEY) || 0);
  return Date.now() - t < 24 * 60 * 60 * 1000;
}

function showInstallBanner() {
  const banner = document.getElementById('installBanner');
  if (!banner) return;
  if (isStandalone() || installRecentlyDismissed()) return;
  // iOS ne supporte pas le prompt natif : instructions manuelles à la place
  if (isIOS()) {
    const iosHint = document.getElementById('installIosHint');
    if (iosHint) iosHint.style.display = 'block';
    const btn = document.getElementById('installBtn');
    if (btn) btn.style.display = 'none';
  }
  banner.classList.remove('hidden');
  banner.style.display = 'flex';
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  showInstallBanner();
});

// Certains navigateurs ne déclenchent jamais beforeinstallprompt :
// afficher quand même la bannière après un court délai.
setTimeout(showInstallBanner, 4000);

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  const banner = document.getElementById('installBanner');
  if (banner) banner.style.display = 'none';
  toast('SIGEXPC a été installé sur votre appareil !', 'success');
});

document.getElementById('installBtn').addEventListener('click', async () => {
  if (!deferredPrompt) {
    toast('Utilisez le menu de votre navigateur : « Installer l\'application » ou « Ajouter à l\'écran d\'accueil ».', 'info', 6000);
    return;
  }
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  if (outcome === 'accepted') {
    document.getElementById('installBanner').style.display = 'none';
  } else {
    localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now()));
    document.getElementById('installBanner').style.display = 'none';
  }
});

document.getElementById('dismissInstallBtn').addEventListener('click', () => {
  localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now()));
  document.getElementById('installBanner').style.display = 'none';
});

// ---------- Connexion ----------
// (Connexion déplacée vers les pages dédiées par rôle : /drtp, /autoecole, /av, /sttc, /boly)

function backToLogin() {
  document.getElementById('paymentView').style.display = 'none';
  document.getElementById('loginView').style.display = 'flex';
  // Le portail n'a plus de champs de saisie : rien à réinitialiser
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
  try { localStorage.removeItem('sigexpc-logged-in'); } catch (e) {}
  toast('Vous êtes déconnecté.', 'info');
  // Redirection directe vers la page d'accueil
  setTimeout(() => { window.location.href = '/'; }, 600);
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
      if (!USER.isMain && USER.subRole === 'SECRETAIRE') {
        // SECRÉTAIRE : accès limité aux candidats et aux inscriptions bordereau
        html += sectionTitle('Gestion');
        html += navItem('candidats', 'fa-users', 'Candidats', true);
        html += navItem('inscriptions', 'fa-clipboard-check', 'Inscriptions bordereau');
      } else {
        html += sectionTitle('Gestion');
        html += navItem('candidats', 'fa-users', 'Candidats');
        html += navItem('inscriptions', 'fa-clipboard-check', 'Inscriptions bordereau');
        html += navItem('analyse', 'fa-chart-pie', 'Analyse (TCD)');
        html += navItem('rapports', 'fa-file-pdf', 'Rapports officiels');
        html += navItem('deliberes-ae', 'fa-check-double', 'Bordereaux délibérés');
        // "Mon abonnement" et "Sécurité & Accès" : réservés au compte principal uniquement
        if (USER.isMain) {
          html += sectionTitle('Mon compte');
          html += navItem('mon-abonnement', 'fa-receipt', 'Mon abonnement');
          html += navItem('securite', 'fa-lock', 'Sécurité & Accès');
        }
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
