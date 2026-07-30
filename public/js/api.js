// ============================================================================
//  SIGEXPC - Couche API côté client (wrapper fetch)
// ============================================================================
const API = {
  async _fetch(url, opts = {}) {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      ...opts,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    // Si la réponse est du HTML (ex: documents PDF), la renvoyer brute
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('text/html')) {
      const html = await res.text();
      return { _html: html, _ok: res.ok };
    }
    let data;
    try { data = await res.json(); }
    catch { return { success: false, error: 'Réponse invalide du serveur.' }; }

    // ---- Interceptation abonnement expiré (402) ----
    // Si l'AE a son abonnement expiré en cours de session, on redirige
    // automatiquement vers la page de connexion/paiement des auto-écoles.
    if (res.status === 402 && data && (data.abonnementExpire || data.isBlocked)) {
      // Stocke le contexte pour la page /autoecole
      try {
        sessionStorage.setItem('sigexpc_blocked', JSON.stringify({
          aeId: data.aeId, aeName: data.aeName, montant: data.montant, ts: Date.now()
        }));
      } catch (e) {}
      // Redirige vers /autoecole (si on n'y est pas déjà)
      if (!window.location.pathname.startsWith('/autoecole')) {
        window.location.href = '/autoecole?expired=1';
      }
      return data;
    }
    return data;
  },

  // ---- Auth ----
  login: (email, motDePasse, role) => API._fetch('/api/auth/login', { method: 'POST', body: { email, motDePasse, role } }),
  me: () => API._fetch('/api/auth/me'),
  logout: () => API._fetch('/api/auth/logout', { method: 'POST' }),
  changePassword: (data) => API._fetch('/api/auth/password', { method: 'POST', body: data }),

  // ---- Dashboard & Stats ----
  dashboard: () => API._fetch('/api/stats/dashboard'),
  avances: () => API._fetch('/api/stats/avancees'),
  analyse: () => API._fetch('/api/stats/analyse'),
  permisRetires: () => API._fetch('/api/stats/permis-retires'),
  responsables: () => API._fetch('/api/stats/responsables'),
  saveResponsables: (data) => API._fetch('/api/stats/responsables', { method: 'POST', body: data }),

  // ---- Entités ----
  regions: () => API._fetch('/api/regions'),
  createRegion: (data) => API._fetch('/api/regions', { method: 'POST', body: data }),
  updateRegion: (id, data) => API._fetch(`/api/regions/${id}`, { method: 'PUT', body: data }),
  deleteRegion: (id) => API._fetch(`/api/regions/${id}`, { method: 'DELETE' }),

  autoEcoles: () => API._fetch('/api/auto-ecoles'),
  createAE: (data) => API._fetch('/api/auto-ecoles', { method: 'POST', body: data }),
  updateAE: (id, data) => API._fetch(`/api/auto-ecoles/${id}`, { method: 'PUT', body: data }),
  deleteAE: (id) => API._fetch(`/api/auto-ecoles/${id}`, { method: 'DELETE' }),

  agents: () => API._fetch('/api/agents'),
  createAgent: (data) => API._fetch('/api/agents', { method: 'POST', body: data }),
  updateAgent: (id, data) => API._fetch(`/api/agents/${id}`, { method: 'PUT', body: data }),
  deleteAgent: (id) => API._fetch(`/api/agents/${id}`, { method: 'DELETE' }),

  sttcUsers: () => API._fetch('/api/sttc-users'),
  createSTTC: (data) => API._fetch('/api/sttc-users', { method: 'POST', body: data }),
  updateSTTC: (id, data) => API._fetch(`/api/sttc-users/${id}`, { method: 'PUT', body: data }),
  deleteSTTC: (id) => API._fetch(`/api/sttc-users/${id}`, { method: 'DELETE' }),

  centres: () => API._fetch('/api/centres'),
  createCentre: (data) => API._fetch('/api/centres', { method: 'POST', body: data }),
  deleteCentre: (id) => API._fetch(`/api/centres/${id}`, { method: 'DELETE' }),

  staff: () => API._fetch('/api/staff'),
  createStaff: (data) => API._fetch('/api/staff', { method: 'POST', body: data }),
  deleteStaff: (id) => API._fetch(`/api/staff/${id}`, { method: 'DELETE' }),

  // ---- Candidats & Examens ----
  candidats: () => API._fetch('/api/candidats'),
  createCandidat: (data) => API._fetch('/api/candidats', { method: 'POST', body: data }),
  updateCandidat: (id, data) => API._fetch(`/api/candidats/${id}`, { method: 'PUT', body: data }),
  deleteCandidat: (id) => API._fetch(`/api/candidats/${id}`, { method: 'DELETE' }),
  deleteCandidatsMany: (ids) => API._fetch('/api/candidats/delete-many', { method: 'POST', body: { ids } }),

  examens: () => API._fetch('/api/candidats/examens/list'),
  examensDeliberes: () => API._fetch('/api/candidats/examens/deliberes'),
  examensDeliberesAE: () => API._fetch('/api/candidats/examens/deliberes-ae'),
  createExamen: (data) => API._fetch('/api/candidats/examens', { method: 'POST', body: data }),
  updateExamen: (id, data) => API._fetch(`/api/candidats/examens/${id}`, { method: 'PUT', body: data }),
  setExamenStatus: (id, statut) => API._fetch(`/api/candidats/examens/${id}/status`, { method: 'POST', body: { statut } }),
  deleteExamen: (id) => API._fetch(`/api/candidats/examens/${id}`, { method: 'DELETE' }),

  eligibles: (idExamen) => API._fetch(`/api/candidats/examens/${idExamen}/eligibles`),
  inscrire: (idExamen, candidatIds) => API._fetch(`/api/candidats/examens/${idExamen}/inscrire`, { method: 'POST', body: { candidatIds } }),
  examCandidats: (idExamen) => API._fetch(`/api/candidats/examens/${idExamen}/candidats`),
  validerInsc: (idInsc) => API._fetch(`/api/candidats/inscriptions/${idInsc}/valider`, { method: 'POST' }),
  validerTout: (idExamen) => API._fetch(`/api/candidats/examens/${idExamen}/valider-tout`, { method: 'POST' }),
  deliberer: (idExamen, results) => API._fetch(`/api/candidats/examens/${idExamen}/deliberer`, { method: 'POST', body: { results } }),
  resetDelib: (idInsc) => API._fetch(`/api/candidats/inscriptions/${idInsc}/reset`, { method: 'POST' }),
  retirerCand: (idInsc) => API._fetch(`/api/candidats/inscriptions/${idInsc}`, { method: 'DELETE' }),
  permisRetire: (idInsc) => API._fetch(`/api/candidats/inscriptions/${idInsc}/permis`, { method: 'POST' }),
  importExam: (idExamen, idAE, candidats) => API._fetch(`/api/candidats/examens/${idExamen}/import`, { method: 'POST', body: { idAE, candidats } }),

  // ---- Abonnements ----
  aboParams: () => API._fetch('/api/abonnements/params'),
  saveAboParams: (data) => API._fetch('/api/abonnements/params', { method: 'POST', body: data }),
  aboListe: () => API._fetch('/api/abonnements/liste'),
  toggleAbo: (idAE, newStatus) => API._fetch(`/api/abonnements/${idAE}/toggle`, { method: 'POST', body: { newStatus } }),
  monAbo: () => API._fetch('/api/abonnements/mon-abonnement'),
  recus: () => API._fetch('/api/abonnements/recus'),
  deleteRecu: (id) => API._fetch(`/api/abonnements/recus/${id}`, { method: 'DELETE' }),
  mesRecus: () => API._fetch('/api/abonnements/mes-recus'),

  // ---- Documents (nouvel onglet) ----
  docUrl: (path) => path,
};
