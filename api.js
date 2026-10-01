// Point d'entrée serverless Vercel : construit la fonction Node depuis l'app Express.
// Fichier à la racine pour que includeFiles "public/**" soit non ambigu.
const app = require('./server');
module.exports = app;
