-- ============================================================================
--  SIGEXPC - Schéma de la base de données MySQL
--  Système de Gestion des Examens du Permis de Conduire
-- ============================================================================
--  Ce fichier crée la base ET toutes les tables.
--  Il est idempotent : on peut le relancer sans risque.
-- ============================================================================

CREATE DATABASE IF NOT EXISTS sigexpc
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE sigexpc;

SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------------------
-- 1. SUPER ADMINS
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS super_admins;
CREATE TABLE super_admins (
  id            VARCHAR(20) PRIMARY KEY,        -- ex: SA-01
  email         VARCHAR(150) NOT NULL UNIQUE,
  nom           VARCHAR(150) NOT NULL,
  code_acces    VARCHAR(255) NOT NULL,          -- mot de passe (ADMIN123)
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 2. DIRECTIONS RÉGIONALES
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS directions_regionales;
CREATE TABLE directions_regionales (
  id            VARCHAR(20) PRIMARY KEY,        -- ex: REG-TEST, REG-8798
  code_region   VARCHAR(20) UNIQUE,
  nom_region    VARCHAR(250) NOT NULL,
  admin_email   VARCHAR(150),                   -- email de connexion
  admin_nom     VARCHAR(150),
  mot_de_passe  VARCHAR(255),                   -- code_acces (REGION123, DIR-XXXXX)
  date_inscription DATETIME,
  statut        VARCHAR(30) DEFAULT 'actif',    -- 'actif' ou date brute Excel
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 4. PERSONNEL DES AUTO-ÉCOLES (collaborateurs : secrétaire, gérant)
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS auto_ecoles_staff;
CREATE TABLE auto_ecoles_staff (
  id            VARCHAR(20) PRIMARY KEY,        -- ex: STF-12345
  id_ae         VARCHAR(20) NOT NULL,
  nom           VARCHAR(150) NOT NULL,
  email         VARCHAR(150),
  code          VARCHAR(255),
  role          VARCHAR(30) DEFAULT 'SECRETAIRE',
  statut        VARCHAR(20) DEFAULT 'actif',
  date          DATETIME,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_staff_ae FOREIGN KEY (id_ae)
    REFERENCES auto_ecoles(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 5. AGENTS VÉRIFICATEURS
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS agents_verificateurs;
CREATE TABLE agents_verificateurs (
  id            VARCHAR(20) PRIMARY KEY,        -- ex: AG-8928
  id_region     VARCHAR(20) NOT NULL,
  nom           VARCHAR(150) NOT NULL,
  email         VARCHAR(150),
  code_acces    VARCHAR(255),                   -- AGENT123, AG-XXXXXX
  specialite    VARCHAR(100),
  statut        VARCHAR(20) DEFAULT 'actif',
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_agent_region FOREIGN KEY (id_region)
    REFERENCES directions_regionales(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 6. UTILISATEURS STTC (Service Technique des Transports et de la Circulation)
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS sttc_users;
CREATE TABLE sttc_users (
  id            VARCHAR(20) PRIMARY KEY,        -- ex: STTC-7400
  id_region     VARCHAR(20) NOT NULL,
  nom           VARCHAR(150) NOT NULL,
  email         VARCHAR(150),
  code          VARCHAR(255),                   -- STTC-XXXXXX
  date          DATETIME,
  statut        VARCHAR(20) DEFAULT 'actif',
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sttc_region FOREIGN KEY (id_region)
    REFERENCES directions_regionales(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 7. CANDIDATS
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS candidats;
CREATE TABLE candidats (
  id                 VARCHAR(20) PRIMARY KEY,        -- ex: CAN-350790
  id_autoecole       VARCHAR(20) NOT NULL,
  nom                VARCHAR(150) NOT NULL,
  prenoms            VARCHAR(150) DEFAULT '',
  numero_piece       VARCHAR(60) NOT NULL,           -- ex: CNI - CI006505277
  categorie_permis   VARCHAR(10) DEFAULT 'ABCDE',     -- ex: ABCDE, A, B...
  telephone          VARCHAR(30),
  date_inscription   DATETIME,
  statut_inscription VARCHAR(200) DEFAULT 'En attente (Code)',  -- texte libre (APTE (...), Admis Code, etc.)
  created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cand_ae (id_autoecole),
  CONSTRAINT fk_cand_ae FOREIGN KEY (id_autoecole)
    REFERENCES auto_ecoles(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 8. CENTRES D'EXAMEN
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS centres_examen;
CREATE TABLE centres_examen (
  id            VARCHAR(20) PRIMARY KEY,        -- ex: CEN-12345
  id_region     VARCHAR(20) NOT NULL,
  nom           VARCHAR(200) NOT NULL,
  CONSTRAINT fk_centre_region FOREIGN KEY (id_region)
    REFERENCES directions_regionales(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 9. EXAMENS PROGRAMMÉS
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS examens_programmes;
CREATE TABLE examens_programmes (
  id                 VARCHAR(20) PRIMARY KEY,    -- ex: EX-1234
  id_region          VARCHAR(20) NOT NULL,
  type_examen        VARCHAR(60) NOT NULL,       -- 'Théorique (Code)' | 'Pratique (Conduite)'
  date_examen        DATE NOT NULL,
  heure              TIME DEFAULT '08:00:00',
  lieu               VARCHAR(200),
  inspecteur_nom     VARCHAR(150),
  inspecteur_contact VARCHAR(50),
  agent1 VARCHAR(80), agent2 VARCHAR(80), agent3 VARCHAR(80),
  agent4 VARCHAR(80), agent5 VARCHAR(80),
  places_max         INT DEFAULT 50,
  places_prises      INT DEFAULT 0,
  statut             ENUM('ouvert','ferme','rajout') DEFAULT 'ouvert',
  created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_exam_region (id_region),
  INDEX idx_exam_date (date_examen),
  CONSTRAINT fk_exam_region FOREIGN KEY (id_region)
    REFERENCES directions_regionales(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 10. INSCRIPTIONS AUX EXAMENS (bordereau)
--   ⚠️ IMPORTANT : Logique fidèle au fichier Excel d'origine :
--   - resultat          : 'En attente' | 'Validé'  → validation/approbation sur le bordereau
--   - validation_region : 'APTE' | 'INAPTE' | 'ABSENT' | 'NON EVALUE' | 'Permis retiré' | 'Validé' | 'En attente'
--                         → résultat réel après délibération
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS inscriptions_examens;
CREATE TABLE inscriptions_examens (
  id                 VARCHAR(20) PRIMARY KEY,    -- ex: INS-46754
  id_candidat        VARCHAR(20) NOT NULL,
  id_examen          VARCHAR(20) NOT NULL,
  date_inscription   DATETIME,
  resultat           VARCHAR(50) DEFAULT 'En attente',      -- validation bordereau: 'En attente' | 'Validé'
  notes              VARCHAR(255) DEFAULT '',
  observations       TEXT,
  validation_region  VARCHAR(50) DEFAULT '',     -- résultat délibération: APTE/INAPTE/ABSENT/NON EVALUE/Permis retiré/Validé
  created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_insc_exam (id_examen),
  INDEX idx_insc_cand (id_candidat),
  CONSTRAINT fk_insc_cand FOREIGN KEY (id_candidat)
    REFERENCES candidats(id) ON DELETE CASCADE,
  CONSTRAINT fk_insc_exam FOREIGN KEY (id_examen)
    REFERENCES examens_programmes(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 11. PARAMÈTRES D'ABONNEMENT
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS parametres_abonnement;
CREATE TABLE parametres_abonnement (
  id        INT PRIMARY KEY AUTO_INCREMENT,
  montant   DECIMAL(10,2) DEFAULT 15000,
  duree_jours INT DEFAULT 30,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 12. ABONNEMENTS DES AUTO-ÉCOLES
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS abonnements_auto_ecoles;
CREATE TABLE abonnements_auto_ecoles (
  id           INT PRIMARY KEY AUTO_INCREMENT,
  id_ae        VARCHAR(20) NOT NULL,
  date_debut   DATETIME,
  date_fin     DATETIME,
  statut       VARCHAR(20) DEFAULT 'actif',
  montant_paye DECIMAL(10,2) DEFAULT 200,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_abo_ae (id_ae),
  CONSTRAINT fk_abo_ae FOREIGN KEY (id_ae)
    REFERENCES auto_ecoles(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 13. REÇUS DE PAIEMENT
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS recus_paiement;
CREATE TABLE recus_paiement (
  id            VARCHAR(20) PRIMARY KEY,        -- ex: REC-781482
  id_ae         VARCHAR(20) NOT NULL,
  date_emission DATETIME,
  montant       DECIMAL(10,2),
  periode_debut DATETIME,
  periode_fin   DATETIME,
  statut        VARCHAR(20) DEFAULT 'actif',
  num_recu      VARCHAR(80),
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_recu_ae FOREIGN KEY (id_ae)
    REFERENCES auto_ecoles(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 14. PARAMÈTRES RÉGIONAUX (signataires : chef STTC, coordonnateur, directeur)
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS parametres_region;
CREATE TABLE parametres_region (
  id_region           VARCHAR(20) PRIMARY KEY,
  chef_sttc           VARCHAR(150),
  coordonnateur       VARCHAR(150),
  directeur_regional  VARCHAR(150),
  CONSTRAINT fk_paramreg_region FOREIGN KEY (id_region)
    REFERENCES directions_regionales(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 15. LOGS D'ACTIVITÉ
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS logs_activites;
CREATE TABLE logs_activites (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  utilisateur_type VARCHAR(30),
  utilisateur_id   VARCHAR(20),
  action           VARCHAR(255),
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

SET FOREIGN_KEY_CHECKS = 1;

-- ----------------------------------------------------------------------------
--  Valeurs par défaut
-- ----------------------------------------------------------------------------
INSERT INTO parametres_abonnement (montant, duree_jours) VALUES (200, 30)
  ON DUPLICATE KEY UPDATE montant = VALUES(montant);
