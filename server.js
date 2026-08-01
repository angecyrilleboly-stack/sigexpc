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

// Auto-initialisation de la base SQLite au démarrage via le MÊME module db-sqlite.js
// que les routes, pour éviter les conflits de connexion.
const pool = require('./src/config/db');
async function initDBIfNeeded() {
  // Si on utilise PostgreSQL (Supabase), la base est déjà initialisée via migration
  if (process.env.DATABASE_URL) {
    console.log('📦 PostgreSQL (Supabase) détecté - base déjà initialisée');
    return;
  }
  try {
    const [rows] = await pool.query("SELECT name FROM sqlite_master WHERE type='table' AND name='candidats'");
    if (rows.length === 0) {
      console.log('📦 Tables manquantes, création...');
      const fs = require('fs');
      const path = require('path');
      const schema = fs.readFileSync(path.join(__dirname, 'src/config/schema-sqlite.sql'), 'utf8');
      // Exécuter le schéma (le wrapper gère la conversion)
      const { DatabaseSync } = require('node:sqlite');
      const dbPath = path.join(__dirname, 'data', 'sigexpc.db');
      const directDb = new DatabaseSync(dbPath);
      directDb.exec(schema);
      directDb.close();
      console.log('✅ Tables créées.');
    }
    // Vérifier s'il y a des données
    const [cnt] = await pool.query('SELECT COUNT(*) as c FROM candidats');
    if (cnt[0].c === 0) {
      console.log('📥 Base vide, import des données...');
      const fs = require('fs');
      const path = require('path');
      const seedFile = path.join(__dirname, 'src/config/seed-data.sql');
      if (fs.existsSync(seedFile)) {
        const seedSql = fs.readFileSync(seedFile, 'utf8');
        const statements = seedSql.split('\n').filter(l => l.trim().startsWith('INSERT INTO'));
        let imported = 0, skipped = 0;
        for (const stmt of statements) {
          try { await pool.query(stmt); imported++; }
          catch (e) { skipped++; }
        }
        console.log(`✅ ${imported} importés, ${skipped} ignorés.`);
      }
    } else {
      console.log(`ℹ️  Base OK (${cnt[0].c} candidats).`);
    }
  } catch (e) {
    console.error('⚠️ Erreur init DB:', e.message);
  }
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
app.listen(PORT, async () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  🚦 SIGEXPC démarré sur http://localhost:${PORT}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  // Initialiser la base (création tables + import données) AVANT d'accepter les requêtes
  await initDBIfNeeded();
  // Démarrer le job de rappel d'expiration d'abonnement (J-3)
  demarrerJobRappel();
});
