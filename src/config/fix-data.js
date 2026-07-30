// ============================================================================
//  SIGEXPC - Script de CORRECTION des données migrées
//  Corrige : statut des examens (pris depuis agent2), heure, statut régions
//  Usage : npm run fix-data
// ============================================================================
const XLSX = require('xlsx');
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const DB_FILE = path.join(__dirname, '..', '..', 'data', 'sigexpc.db');
const XLSX_FILE = 'C:/Users/AORUS GAMING/Downloads/SOFT PERMIS BON SIGEXPC (2).xlsx';

const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA foreign_keys = ON;');

console.log('\n🔧 SIGEXPC - Correction des données migrées\n');

// --- 1. CORRIGER LE STATUT DES EXAMENS (depuis la colonne agent2 de l'Excel) ---
console.log('▸ Correction du statut des examens...');
const wb = XLSX.readFile(XLSX_FILE);
const exams = XLSX.utils.sheet_to_json(wb.Sheets['examens_programmes'], { defval: '' });
let fixed = 0;
for (const e of exams) {
  if (!e.id) continue;
  // Le vrai statut est dans agent2 (ouvert/fermé/ferme/rajout)
  let realStatut = String(e.agent2 || '').trim().toLowerCase();
  // Normaliser "ferme" -> "ferme"
  if (realStatut === 'fermé' || realStatut === 'ferme') realStatut = 'ferme';
  if (['ouvert', 'ferme', 'rajout'].includes(realStatut)) {
    db.prepare('UPDATE examens_programmes SET statut = ? WHERE id = ?').run(realStatut, String(e.id).trim());
    fixed++;
  }
}
console.log('  ✓ ' + fixed + ' examen(s) corrigé(s)');

// --- 2. CORRIGER L'HEURE (0.3333 -> 08:00:00) ---
console.log('▸ Correction de l\'heure...');
const allExams = db.prepare("SELECT id, heure FROM examens_programmes WHERE heure LIKE '0.3%' OR heure = '' OR heure IS NULL").all();
for (const e of allExams) {
  db.prepare('UPDATE examens_programmes SET heure = ? WHERE id = ?').run('08:00:00', e.id);
}
console.log('  ✓ ' + allExams.length + ' heure(s) corrigée(s) à 08:00:00');

// --- 3. CORRIGER LE STATUT DES DIRECTIONS RÉGIONALES (qui contient parfois une date Excel) ---
console.log('▸ Correction du statut des directions régionales...');
const regs = db.prepare("SELECT id, statut FROM directions_regionales").all();
let regFixed = 0;
for (const r of regs) {
  const st = String(r.statut || '').trim();
  // Si le statut n'est pas "actif" ou "inactif", c'est probablement une date Excel ou du bruit
  if (st !== 'actif' && st !== 'inactif') {
    db.prepare('UPDATE directions_regionales SET statut = ? WHERE id = ?').run('actif', r.id);
    regFixed++;
  }
}
console.log('  ✓ ' + regFixed + ' direction(s) corrigée(s)');

// --- 4. VÉRIFICATION FINALE ---
console.log('\n=== VÉRIFICATION APRÈS CORRECTION ===\n');
const sample = db.prepare('SELECT id, type_examen, date_examen, heure, lieu, agent2, statut FROM examens_programmes ORDER BY date_examen LIMIT 6').all();
console.log('Échantillon d\'examens corrigés :');
sample.forEach(e => console.log('  ' + e.id + ' | ' + e.type_examen + ' | ' + String(e.date_examen).slice(0,10) + ' | ' + e.heure + ' | ' + e.lieu + ' | statut=' + e.statut));

const regCheck = db.prepare('SELECT id, admin_email, statut FROM directions_regionales').all();
console.log('\nComptes région :');
regCheck.forEach(r => console.log('  ' + r.id + ' | ' + r.admin_email + ' | statut=' + r.statut));

const total = db.prepare('SELECT COUNT(*) as n FROM examens_programmes').get();
console.log('\nTotal examens : ' + total.n);

const byRegion = db.prepare('SELECT id_region, COUNT(*) as n FROM examens_programmes GROUP BY id_region').all();
console.log('Examens par région :');
byRegion.forEach(r => console.log('  ' + r.id_region + ' : ' + r.n));

console.log('\n✅ CORRECTION TERMINÉE');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Vous pouvez maintenant vous connecter avec :');
console.log('  Région Agnéby Tiassa : drtat@sysgipc.com / DIR-HOLFNJ');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

db.close();
