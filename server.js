// ============================================================================
//  SIGEXPC - Serveur Express principal
//  Système de Gestion des Examens du Permis de Conduire (Côte d'Ivoire)
// ============================================================================
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const morgan = require('morgan');
require('dotenv').config();

// Auto-initialisation de la base au démarrage (garantit que les tables existent)
// PostgreSQL (Supabase) en production, SQLite en local
try {
  if (process.env.DATABASE_URL) {
    require('./src/config/supabase-init.js');
  } else {
    require('./src/config/render-init.js');
  }
} catch (e) {
  console.error('⚠️ Erreur initialisation DB au démarrage:', e.message);
}

const authRoutes = require('./src/routes/auth');
const entityRoutes = require('./src/routes/entities');
const candidatRoutes = require('./src/routes/candidats');
const statsRoutes = require('./src/routes/stats');
const abonnementRoutes = require('./src/routes/abonnements');
const documentRoutes = require('./src/routes/documents');
const { attachUser } = require('./src/middleware/auth');
const { requireActiveAbonnement } = require('./src/middleware/checkAbonnement');
const { demarrerJobRappel } = require('./src/config/rappelJob');

const app = express();
const PORT = process.env.PORT || 3000;

// ----------------------------------------------------------------------------
// Middlewares globaux
// ----------------------------------------------------------------------------
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Session
app.use(session({
  name: 'sigexpc_sid',
  secret: process.env.SESSION_SECRET || 'sigexpc-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 12, // 12h
    sameSite: 'lax'
  }
}));

app.use(attachUser);

// ----------------------------------------------------------------------------
// Fichiers statiques (frontend)
// ----------------------------------------------------------------------------
app.use(express.static(path.join(__dirname, 'public')));

// ----------------------------------------------------------------------------
// Vérification d'abonnement : bloque les AUTO_ECOLES dont l'abonnement a expiré
// Sauf sur les routes qui doivent rester accessibles pour payer :
//   - /api/auth/login, /api/auth/logout, /api/auth/me
//   - /api/abonnements/initier-paiement, /api/abonnements/retour-paiement
// ----------------------------------------------------------------------------
app.use('/api', (req, res, next) => {
  const p = req.path;
  if (p.startsWith('/auth/') || p === '/auth') return next();
  if (p === '/abonnements/initier-paiement' || p === '/abonnements/retour-paiement') return next();
  requireActiveAbonnement(req, res, next);
});

// ----------------------------------------------------------------------------
// Routes API
// ----------------------------------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api', entityRoutes);          // /api/regions, /api/auto-ecoles, /api/agents...
app.use('/api/candidats', candidatRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/abonnements', abonnementRoutes);
app.use('/api/documents', documentRoutes);

// Route santé
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'SIGEXPC API opérationnelle', time: new Date().toISOString() });
});

// Route DEBUG temporaire (à supprimer après diagnostic)
app.get('/api/debug', async (req, res) => {
  const pool = require('./src/config/db');
  const diag = { time: new Date().toISOString(), checks: {} };
  diag.env = {
    DATABASE_URL: process.env.DATABASE_URL ? 'SET (' + process.env.DATABASE_URL.substring(0, 20) + '...)' : 'NOT SET',
    DB_USE_MYSQL: process.env.DB_USE_MYSQL || 'NOT SET',
    NODE_ENV: process.env.NODE_ENV || 'NOT SET'
  };
  try {
    const [tables] = await pool.query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    diag.checks.tables = tables.map(t => t.name);
    diag.checks.tableCount = tables.length;
  } catch (e) {
    diag.checks.tablesError = e.message;
  }
  try {
    const [admins] = await pool.query('SELECT COUNT(*) as cnt FROM super_admins');
    diag.checks.adminCount = admins[0]?.cnt || 0;
  } catch (e) {
    diag.checks.adminError = e.message;
  }
  try {
    const [abos] = await pool.query('SELECT COUNT(*) as cnt FROM parametres_abonnement');
    diag.checks.aboCount = abos[0]?.cnt || 0;
  } catch (e) {
    diag.checks.aboError = e.message;
  }
  res.json(diag);
});

// ----------------------------------------------------------------------------
// Page de connexion dédiée aux auto-écoles
// ----------------------------------------------------------------------------
app.get('/autoecole', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'autoecole.html'));
});

// ----------------------------------------------------------------------------
// SPA fallback : toute autre route renvoie index.html
// ----------------------------------------------------------------------------
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ----------------------------------------------------------------------------
// Gestion d'erreurs
// ----------------------------------------------------------------------------
app.use((err, req, res, next) => {
  console.error('Erreur serveur:', err);
  res.status(500).json({ success: false, error: 'Erreur interne du serveur.' });
});

// ----------------------------------------------------------------------------
// Démarrage
// ----------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  🚦 SIGEXPC démarré sur http://localhost:${PORT}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Première utilisation ?');
  console.log('   1. npm run init-db   (crée la base MySQL)');
  console.log('   2. npm run seed      (données de démonstration)');
  console.log('   3. Ouvrez l\'URL ci-dessus');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  // Démarrer le job de rappel d'expiration d'abonnement (J-3)
  demarrerJobRappel();
});
