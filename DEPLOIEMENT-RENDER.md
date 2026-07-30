# 🚀 Déploiement SIGEXPC sur Render — Guide pas à pas

## 📋 Prérequis
- Un compte GitHub (gratuit sur github.com)
- Git installé sur ton ordinateur
- Le code de SIGEXPC prêt (c'est fait ✓)

---

## ÉTAPE 1 : Créer un compte GitHub (si tu n'en as pas)
1. Va sur https://github.com/signup
2. Crée un compte avec ton email
3. Confirme ton email

---

## ÉTAPE 2 : Mettre le code sur GitHub
Une fois Git installé, ouvre un terminal dans le dossier `SIGEX Z AI` et tape :

```bash
# Initialiser Git (une seule fois)
git init
git add -A
git commit -m "SIGEXPC - Version 2.0 prête pour déploiement"
git branch -M main

# Créer le repo sur GitHub puis lier
# (Va sur github.com → New repository → nomme-le "sigexpc" → Ne coche PAS README → Create)
git remote add origin https://github.com/TON-PSEUDO/sigexpc.git
git push -u origin main
```

---

## ÉTAPE 3 : Créer un compte Render
1. Va sur https://render.com → **Get Started**
2. Clique sur **Sign up with GitHub** (le plus simple)
3. Autorise Render à accéder à ton compte GitHub

---

## ÉTAPE 4 : Déployer sur Render
1. Sur le dashboard Render, clique sur **New +** → **Blueprint**
2. Sélectionne ton repository **sigexpc**
3. Render détecte automatiquement le fichier `render.yaml`
4. Clique sur **Apply**
5. Render va :
   - Installer les dépendances (`npm install`)
   - Initialiser la base de données (`npm run render-build`)
   - Démarrer le serveur (`node server.js`)

---

## ÉTAPE 5 : Configurer les variables d'environnement
Sur Render, va dans ton service → **Environment** et configure :

| Variable | Valeur | Description |
|----------|--------|-------------|
| `ADMIN_EMAIL` | `admin@sigexpc.ci` | Email du super admin |
| `ADMIN_PASSWORD` | `ADMIN123` | Mot de passe (change-le !) |
| `ABO_MONTANT` | `300` | Montant abonnement (FCFA) |
| `SMTP_HOST` | `smtp.gmail.com` | Serveur email |
| `SMTP_USER` | `ton.email@gmail.com` | Ton email Gmail |
| `SMTP_PASS` | `xxxx xxxx xxxx xxxx` | Mot de passe d'application Gmail |
| `GENIUSPAY_API_KEY` | `pk_live_...` | Ta clé GeniusPay publique |
| `GENIUSPAY_API_SECRET` | `sk_live_...` | Ta clé GeniusPay secrète |

---

## ÉTAPE 6 : Récupérer l'URL de ton application
Une fois déployée, Render te donne une URL du type :
```
https://sigexpc.onrender.com
```

Tes pages seront accessibles sur :
- 🔗 `https://sigexpc.onrender.com` → Page de connexion générale
- 🔗 `https://sigexpc.onrender.com/autoecole` → Connexion auto-écoles
- 🔗 `https://sigexpc.onrender.com/api/health` → Vérification santé

---

## ⚠️ Important : URL de retour GeniusPay
Une fois en production, tu DOIS mettre à jour les URLs de retour GeniusPay.

Dans le fichier `src/routes/abonnements.js`, ligne ~177, remplace :
```javascript
const baseUrl = `${req.protocol}://${req.get('host')}`;
```
Cette ligne génère automatiquement la bonne URL, donc **aucune modification nécessaire** ! ✅

---

## 🔄 Mettre à jour l'application après modifications
À chaque fois que tu modifies le code :
```bash
git add -A
git commit -m "Description de la modification"
git push
```
Render redéploie automatiquement.

---

## 🆘 Dépannage
- **La base est vide** : C'est normal au premier déploiement. Connecte-toi en super admin avec `ADMIN_EMAIL` / `ADMIN_PASSWORD`, puis crée tes directions régionales et auto-écoles.
- **Le serveur ne démarre pas** : Vérifie les logs dans Render → ton service → **Logs**
- **Erreur SQLite** : Assure-toi que `NODE_VERSION` est >= 22 dans les variables Render
