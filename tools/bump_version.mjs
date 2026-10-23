// Met à jour les deux numéros de version avant une livraison (heure de Paris) :
//   index.html : const APP_VERSION='JJ/MM/AAAA HHhMM';
//   sw.js      : const VERSION = 'JJ/MM/AAAA à HHhMM';
//   index.html : const APP_NUM=N;  N = numéro du dernier commit + 1 (relancer avant de pousser ne le fait pas grimper)
// Usage, depuis la racine du dépôt : node tools/bump_version.mjs   (ou npm run bump)
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const p = Object.fromEntries(new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
}).formatToParts(new Date()).map(x => [x.type, x.value]));
const v1 = `${p.day}/${p.month}/${p.year} ${p.hour}h${p.minute}`;
const v2 = `${p.day}/${p.month}/${p.year} à ${p.hour}h${p.minute}`;

function remplace(fichier, motif, nouveau) {
  const f = join(RACINE, fichier);
  const c = readFileSync(f, 'utf8');
  if ((c.match(new RegExp(motif.source, 'g')) || []).length !== 1) { console.error('ERREUR : motif de version introuvable ou multiple dans ' + fichier); process.exit(1); }
  writeFileSync(f, c.replace(motif, nouveau));
}
remplace('index.html', /const APP_VERSION='[^']*';/, `const APP_VERSION='${v1}';`);
let num0 = 93; // dernier numéro avant l'apparition de APP_NUM
try { const m = execSync('git show HEAD:index.html', { cwd: RACINE, encoding: 'utf8', maxBuffer: 1 << 26 }).match(/const APP_NUM=(\d+);/); if (m) num0 = +m[1]; } catch (e) {}
remplace('index.html', /const APP_NUM=\d+;/, `const APP_NUM=${num0 + 1};`);
remplace('sw.js', /const VERSION = '[^']*';/, `const VERSION = '${v2}';`);
console.log('index.html APP_NUM = ' + (num0 + 1) + ', APP_VERSION = ' + v1 + '\nsw.js VERSION = ' + v2);
