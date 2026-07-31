-- ============================================================================
--  SIGEXPC - Schéma PostgreSQL (Supabase)
--  Équivalent au schema-sqlite.sql mais avec la syntaxe PostgreSQL.
-- ============================================================================

-- 1. SUPER ADMINS
CREATE TABLE IF NOT EXISTS super_admins (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  nom TEXT NOT NULL,
  code_acces TEXT NOT NULL,
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
);

-- 2. DIRECTIONS RÉGIONALES
CREATE TABLE IF NOT EXISTS directions_regionales (
  id TEXT PRIMARY KEY,
  code_region TEXT UNIQUE,
  nom_region TEXT NOT NULL,
  admin_email TEXT,
  admin_nom TEXT,
  mot_de_passe TEXT,
  directeur TEXT,
  date_inscription TEXT,
  statut TEXT DEFAULT 'actif',
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
);

-- 3. AUTO-ÉCOLES
CREATE TABLE IF NOT EXISTS auto_ecoles (
  id TEXT PRIMARY KEY,
  id_region TEXT NOT NULL REFERENCES directions_regionales(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  email_admin TEXT,
  mot_de_passe TEXT,
  adresse TEXT,
  telephone TEXT,
  telephone_whatsapp TEXT,
  date_creation TEXT,
  statut TEXT DEFAULT 'actif',
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
);
CREATE INDEX IF NOT EXISTS idx_ae_region ON auto_ecoles(id_region);

-- 4. PERSONNEL DES AUTO-ÉCOLES
CREATE TABLE IF NOT EXISTS auto_ecoles_staff (
  id TEXT PRIMARY KEY,
  id_ae TEXT NOT NULL REFERENCES auto_ecoles(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  email TEXT,
  code TEXT,
  role TEXT DEFAULT 'SECRETAIRE',
  statut TEXT DEFAULT 'actif',
  date TEXT,
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
);

-- 5. AGENTS VÉRIFICATEURS
CREATE TABLE IF NOT EXISTS agents_verificateurs (
  id TEXT PRIMARY KEY,
  id_region TEXT NOT NULL REFERENCES directions_regionales(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  email TEXT,
  code_acces TEXT,
  specialite TEXT,
  statut TEXT DEFAULT 'actif',
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
);

-- 6. STTC
CREATE TABLE IF NOT EXISTS sttc_users (
  id TEXT PRIMARY KEY,
  id_region TEXT NOT NULL REFERENCES directions_regionales(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  email TEXT,
  code TEXT,
  date TEXT,
  statut TEXT DEFAULT 'actif',
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
);

-- 7. CANDIDATS
CREATE TABLE IF NOT EXISTS candidats (
  id TEXT PRIMARY KEY,
  id_autoecole TEXT NOT NULL REFERENCES auto_ecoles(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  prenoms TEXT DEFAULT '',
  numero_piece TEXT NOT NULL,
  categorie_permis TEXT DEFAULT 'ABCDE',
  telephone TEXT,
  date_inscription TEXT,
  statut_inscription TEXT DEFAULT 'En attente (Code)',
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
);
CREATE INDEX IF NOT EXISTS idx_cand_ae ON candidats(id_autoecole);

-- 8. CENTRES D'EXAMEN
CREATE TABLE IF NOT EXISTS centres_examen (
  id TEXT PRIMARY KEY,
  id_region TEXT NOT NULL REFERENCES directions_regionales(id) ON DELETE CASCADE,
  nom TEXT
);

-- 9. EXAMENS PROGRAMMÉS
CREATE TABLE IF NOT EXISTS examens_programmes (
  id TEXT PRIMARY KEY,
  id_region TEXT NOT NULL REFERENCES directions_regionales(id) ON DELETE CASCADE,
  type_examen TEXT NOT NULL,
  date_examen TEXT,
  heure TEXT DEFAULT '08:00:00',
  lieu TEXT,
  inspecteur_nom TEXT,
  inspecteur_contact TEXT,
  agent1 TEXT DEFAULT '', agent2 TEXT DEFAULT '', agent3 TEXT DEFAULT '',
  agent4 TEXT DEFAULT '', agent5 TEXT DEFAULT '',
  places_max INTEGER DEFAULT 50,
  places_prises INTEGER DEFAULT 0,
  statut TEXT DEFAULT 'ouvert',
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
);
CREATE INDEX IF NOT EXISTS idx_exam_region ON examens_programmes(id_region);
CREATE INDEX IF NOT EXISTS idx_exam_date ON examens_programmes(date_examen);

-- 10. INSCRIPTIONS AUX EXAMENS
CREATE TABLE IF NOT EXISTS inscriptions_examens (
  id TEXT PRIMARY KEY,
  id_candidat TEXT NOT NULL REFERENCES candidats(id) ON DELETE CASCADE,
  id_examen TEXT NOT NULL REFERENCES examens_programmes(id) ON DELETE CASCADE,
  date_inscription TEXT,
  resultat TEXT DEFAULT 'En attente',
  notes TEXT DEFAULT '',
  observations TEXT,
  validation_region TEXT DEFAULT '',
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
);
CREATE INDEX IF NOT EXISTS idx_insc_exam ON inscriptions_examens(id_examen);
CREATE INDEX IF NOT EXISTS idx_insc_cand ON inscriptions_examens(id_candidat);

-- 11. PARAMÈTRES ABONNEMENT
CREATE TABLE IF NOT EXISTS parametres_abonnement (
  id SERIAL PRIMARY KEY,
  montant REAL DEFAULT 200,
  duree_jours INTEGER DEFAULT 30,
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
);

-- 12. ABONNEMENTS AUTO-ÉCOLES
CREATE TABLE IF NOT EXISTS abonnements_auto_ecoles (
  id SERIAL PRIMARY KEY,
  id_ae TEXT NOT NULL REFERENCES auto_ecoles(id) ON DELETE CASCADE,
  date_debut TEXT,
  date_fin TEXT,
  statut TEXT DEFAULT 'actif',
  montant_paye REAL DEFAULT 200,
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
);
CREATE INDEX IF NOT EXISTS idx_abo_ae ON abonnements_auto_ecoles(id_ae);

-- 13. REÇUS DE PAIEMENT
CREATE TABLE IF NOT EXISTS recus_paiement (
  id TEXT PRIMARY KEY,
  id_ae TEXT NOT NULL REFERENCES auto_ecoles(id) ON DELETE CASCADE,
  date_emission TEXT,
  montant REAL,
  periode_debut TEXT,
  periode_fin TEXT,
  statut TEXT DEFAULT 'actif',
  num_recu TEXT,
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
);

-- 14. PARAMÈTRES RÉGION (signataires)
CREATE TABLE IF NOT EXISTS parametres_region (
  id_region TEXT PRIMARY KEY REFERENCES directions_regionales(id) ON DELETE CASCADE,
  chef_sttc TEXT,
  coordonnateur TEXT,
  directeur_regional TEXT
);

-- 15. LOGS D'ACTIVITÉ
CREATE TABLE IF NOT EXISTS logs_activites (
  id SERIAL PRIMARY KEY,
  utilisateur_type TEXT,
  utilisateur_id TEXT,
  action TEXT,
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
);

-- Valeur par défaut abonnement
INSERT INTO parametres_abonnement (montant, duree_jours)
VALUES (300, 30)
ON CONFLICT DO NOTHING;
