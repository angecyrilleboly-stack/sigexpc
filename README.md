# 🚦 SIGEXPC 2.0

**Système de Gestion des Examens du Permis de Conduire (Côte d'Ivoire)**

Application web moderne de gestion des auto-écoles, candidats, examens et délibérations du permis de conduire.
Cette version 2.0 remplace l'ancien système basé sur Google Apps Script + Google Sheets par une architecture robuste **Node.js + Express + MySQL** avec une interface repensée et plus belle.

---

## ✨ Nouveautés de cette version

| Avant (Google Apps Script) | Maintenant (SIGEXPC 2.0) |
|---|---|
| Google Sheets comme « base de données » | **Vraie base de données MySQL relationnelle** |
| `google.script.run` (RPC) | **API REST JSON standard** (`/api/...`) |
| Performance limitée par Sheets | **Pool de connexions MySQL**, requêtes indexées |
| Mots de passe en clair dans des cellules | **Hash bcrypt** sécurisé |
| Interface statique | **Interface moderne** (animations, dark mode, toasts, skeleton loaders) |
| PDF via le moteur Google | **HTML imprimable** (Ctrl+P → PDF natif navigateur) |
| Pas de cache | **Cache navigateur intelligent** |

---

## 🏗️ Architecture

```
SIGEX Z AI/
├── server.js                 # Point d'entrée Express
├── package.json
├── .env.example              # Modèle de configuration
├── src/
│   ├── config/
│   │   ├── db.js             # Pool de connexions MySQL
│   │   ├── schema.sql        # Schéma complet de la BDD (15 tables)
│   │   ├── init-db.js        # Script d'initialisation (npm run init-db)
│   │   ├── migrate-from-xlsx.js  # Migration Excel → MySQL (npm run migrate)
│   │   └── seed.js           # Données de démonstration (npm run seed)
│   ├── middleware/
│   │   └── auth.js           # Authentification par session + contrôle des rôles
│   └── routes/
│       ├── auth.js           # Connexion, déconnexion, mot de passe
│       ├── entities.js       # Régions, auto-écoles, agents, STTC, centres, staff
│       ├── candidats.js      # Candidats, examens, inscriptions, délibérations
│       ├── stats.js          # Dashboard, statistiques, TCD, permis, signataires
│       ├── abonnements.js    # Abonnements auto-écoles, reçus, paramètres
│       └── documents.js      # Génération bordereaux, comptes rendus, reçus (HTML/PDF)
└── public/                   # Frontend statique
    ├── index.html
    ├── css/styles.css
    └── js/
        ├── api.js            # Wrapper fetch vers l'API
        ├── ui.js             # Modales, toasts, loaders, badges
        ├── app.js            # Auth, navigation, menu
        ├── views.js          # Dashboard, régions, auto-écoles, agents…
        ├── views-candidats.js# Candidats, examens, inscriptions, salle d'examen
        └── views-stats.js    # Stats, TCD, STTC, permis, abonnements, sécurité
```

---

## 🚀 Installation

### 1. Prérequis

- **Node.js** v22 ou supérieur ([télécharger](https://nodejs.org)) — recommandé v24
  (le module SQLite natif `node:sqlite` est requis)

> 💡 **Aucun serveur de base de données à installer !**
> L'application utilise **SQLite** (intégré à Node.js) par défaut — vos données sont
> stockées dans un simple fichier `data/sigexpc.db`. C'est immédiat, sans configuration.
>
> Si vous préférez **MySQL** en production, ajoutez `DB_USE_MYSQL=true` dans `.env`
> et installez MySQL (voir section « Mode MySQL » plus bas).

### 2. Installation des dépendances

```bash
npm install
```

### 3. Initialisation de la base de données

```bash
npm run init-db
```
> Crée le fichier `data/sigexpc.db` et toutes les tables automatiquement.

### 4. Migrer vos VRAIES données depuis votre fichier Excel

Vous avez un fichier Excel existant (`.xlsx`) avec toutes vos données réelles.
La commande de migration lit ce fichier et insère **toutes** vos données :

```bash
npm run migrate "C:\Users\...\SOFT PERMIS BON SIGEXPC (2).xlsx"
```

> ⚠️ Remplacez le chemin par l'emplacement de **votre** fichier `.xlsx`.
>
> La migration convertit automatiquement :
> - Les **dates au format Excel** (ex: `46094.66`) en vraies dates
> - Les **3 248 candidats**, **3 231 inscriptions**, examens, abonnements, reçus, etc.
> - Les **signataires** (nettoyage du format `Directeur Régional||Nom`)
> - Le **montant d'abonnement** réel (200 FCFA)
>
> Vous pouvez relancer la migration sans risque de doublons.

**Alternative — données de démonstration** (si vous n'avez pas de fichier) :
```bash
npm run seed
```

### 5. Démarrage

```bash
npm start
```
> Pour le développement avec redémarrage automatique : `npm run dev`

🌐 Ouvrez **http://localhost:3000** dans votre navigateur.

### Mode MySQL (optionnel, pour la production)

Par défaut, l'application utilise SQLite (aucune installation). Pour passer à MySQL :

1. Installez MySQL (ou MariaDB / XAMPP)
2. Dans `.env`, ajoutez : `DB_USE_MYSQL=true` et renseignez `DB_HOST`, `DB_USER`, `DB_PASSWORD`
3. Relancez `npm run init-db` puis `npm run migrate "...xlsx"`

---

## 🔑 Connexion avec vos VRAIES données

Après avoir migré votre fichier Excel, connectez-vous avec vos comptes réels.
Voici ceux détectés dans votre base :

| Rôle | Email | Mot de passe |
|---|---|---|
| **Super Admin** | `admin@test.com` | `ADMIN123` |
| **Direction Régionale (TEST)** | `region@test.com` | `REGION123` |
| **Auto-École UNION** | `union@sysgipc.com` | `PASS-JT71QN` |
| **Auto-École ASSENAH** | `assenah@sysgipc.com` | `PASS-HI161H` |
| **Auto-École VIGILANCE** | `vigilance@sysgipc.com` | `PASS-SZYLZP` |
| **Auto-École AGNEBY** | `angecyrilleboly@gmail.com` | `PASS-1LVD39` |
| **Auto-École SUCCES** | `bolygrace2016@gmail.com` | `PASS-U6RVGJ` |
| **Agent Koné (TEST)** | `agent@test.com` | `AGENT123` |

> 💡 Les mots de passe sont conservés **tels quels** depuis votre fichier Excel
> (authentification compatible texte brut ET bcrypt). Vous pourrez les changer
> depuis l'interface une fois connecté.

---

## 📊 Données migrées (votre base réelle)

| Donnée | Volume |
|---|---|
| Directions régionales | 2 |
| Auto-écoles | 5 |
| Agents vérificateurs | 3 |
| **Candidats** | **3 248** |
| **Inscriptions aux examens** | **3 231** |
| Examens programmés | 23 |
| Reçus de paiement | 6 |

L'auto-école **AGNEBY** (angecyrilleboly@gmail.com) contient à elle seule
**1 237 candidats** et 23 sessions d'examens historiques.

---

## 🔑 Connexion avec vos VRAIES données

Après avoir migré votre fichier Excel, connectez-vous avec vos comptes réels.
Voici ceux détectés dans votre base :

| Rôle | Email | Mot de passe |
|---|---|---|
| **Super Admin** | `admin@test.com` | `ADMIN123` |
| **Direction Régionale (TEST)** | `region@test.com` | `REGION123` |
| **Auto-École UNION** | `union@sysgipc.com` | `PASS-JT71QN` |
| **Auto-École ASSENAH** | `assenah@sysgipc.com` | `PASS-HI161H` |
| **Auto-École VIGILANCE** | `vigilance@sysgipc.com` | `PASS-SZYLZP` |
| **Auto-École AGNEBY** | `angecyrilleboly@gmail.com` | `PASS-1LVD39` |
| **Auto-École SUCCES** | `bolygrace2016@gmail.com` | `PASS-U6RVGJ` |
| **Agent Koné (TEST)** | `agent@test.com` | `AGENT123` |

> 💡 Les mots de passe sont conservés **tels quels** depuis votre fichier Excel
> (authentification compatible texte brut ET bcrypt). Vous pourrez les changer
> depuis l'interface une fois connecté.

---

## 👥 Rôles & fonctionnalités

### 🟡 SUPER_ADMIN
- Vue d'ensemble nationale (nb. régions, auto-écoles, candidats)
- Gestion des **Directions Régionales**
- Gestion des **abonnements** (activer / bloquer, jours restants)
- Émission et suivi des **reçus de paiement**
- Paramètres d'abonnement (montant, durée)

### 🔵 REGION (Direction Régionale)
- Planification des **examens** (Code / Conduite)
- Génération des **bordereaux d'examen** (avant délibération)
- **Salle d'examen** : validation + délibération (APTE/INAPTE/ABSENT/NON EVALUE)
- **Bordereaux délibérés** (PDF officiel)
- **Comptes rendus STTC**
- **Bilan & Statistiques** (graphiques Chart.js)
- **Analyse TCD** (tableau croisé auto-école × résultats)
- Administration : auto-écoles, agents, agents STTC, centres, signataires

### 🟢 AUTO_ECOLE
- Gestion des **candidats** (création, modification, suppression)
- **Inscription** des candidats éligibles sur les bordereaux d'examen
- **Bordereaux délibérés** (consultation + PDF)
- **Analyse TCD** de ses propres résultats
- **Mon abonnement** (statut, reçu)
- **Sécurité** : changement de mot de passe, création de collaborateurs (secrétaire/gérant)

### 🟠 AGENT (Vérificateur)
- Liste des **permis remis**

### 🟣 STTC (Service Technique)
- Génération des **comptes rendus** d'examens

---

## 🗄️ Base de données

15 tables relationnelles avec clés étrangères et contraintes d'intégrité :

| Table | Description |
|---|---|
| `super_admins` | Comptes super administrateurs |
| `directions_regionales` | Directions régionales (régions) |
| `auto_ecoles` | Auto-écoles agrées |
| `auto_ecoles_staff` | Collaborateurs d'auto-écoles (secrétaires/gérants) |
| `agents_verificateurs` | Agents vérificateurs |
| `sttc_users` | Agents STTC |
| `candidats` | Candidats au permis |
| `centres_examen` | Centres d'examen |
| `examens_programmes` | Sessions d'examens programmés |
| `inscriptions_examens` | Inscriptions des candidats aux examens (bordereaux) |
| `parametres_abonnement` | Paramètres globaux d'abonnement |
| `abonnements_auto_ecoles` | Abonnements par auto-école |
| `recus_paiement` | Reçus de paiement émis |
| `parametres_region` | Signataires officiels par région |
| `logs_activites` | Journal d'activité |

Le schéma complet est dans [`src/config/schema.sql`](src/config/schema.sql).

---

## 🖨️ Génération de documents (PDF)

Les documents officiels sont générés en **HTML imprimable** :
- **Bordereaux d'examen** (principal et rajout)
- **Bordereaux délibérés** (avec résultats)
- **Comptes rendus STTC**
- **Reçus de paiement**

Pour obtenir un PDF : ouvrez le document → bouton **« Imprimer / Enregistrer en PDF »** → choisissez « Enregistrer en PDF » comme imprimante.

---

## 🛠️ Commandes npm

| Commande | Description |
|---|---|
| `npm install` | Installe les dépendances |
| `npm run init-db` | Crée la base de données et les tables |
| `npm run migrate "fichier.xlsx"` | **Migre vos vraies données Excel vers MySQL** |
| `npm run seed` | Insère des données de démonstration (tests uniquement) |
| `npm start` | Démarre le serveur en production |
| `npm run dev` | Démarre avec redémarrage automatique (`--watch`) |

---

## 🎨 Interface

- **Thème** inspiré de la signalisation routière (bleu autoroute, jaune signalisation)
- **Mode sombre** (« conduite de nuit ») — bascule via l'icône lune/soleil
- **Responsive** — fonctionne sur mobile, tablette et ordinateur
- **Animations** fluides (feu tricolore de chargement, fondus, toasts)
- **Accessibilité** — raccourcis clavier (Échap pour fermer les modales)

---

## 🔒 Sécurité

- Mots de passe **hashés avec bcrypt**
- **Sessions** signées (cookie `httpOnly`)
- Contrôle d'accès par rôle sur **chaque route API**
- Requêtes SQL **paramétrées** (protection contre injections)
- Échappement HTML côté client (protection XSS)

---

## 📦 Déploiement en production

1. Configurez un serveur MySQL accessible
2. Définissez `NODE_ENV=production` et un `SESSION_SECRET` fort dans `.env`
3. Utilisez un gestionnaire de processus : `npm install -g pm2 && pm2 start server.js`
4. Placez l'application derrière un reverse-proxy (Nginx) avec HTTPS

---

## 📞 Support

Pour toute question sur SIGEXPC, contactez votre Direction Régionale ou le support technique.

---

**SIGEXPC 2.0** — Système moderne de gestion des examens du permis de conduire. 🚦
