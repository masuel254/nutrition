// Vérifie la syntaxe JavaScript de index.html (scripts inline) et de sw.js, sans navigateur.
// Usage, depuis la racine du dépôt : node tools/check_html.mjs
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const dossier = mkdtempSync(join(tmpdir(), 'chk-'));
let erreurs = 0;
const verifier = (nom, code) => {
  const f = join(dossier, nom.replace(/[^\w.-]/g, '_') + '.js');
  writeFileSync(f, code);
  try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); console.log('  ok   ' + nom); }
  catch (e) { erreurs++; console.log('  ÉCHEC ' + nom + '\n' + String(e.stderr)); }
};
const html = readFileSync(join(RACINE, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
scripts.forEach((s, i) => verifier('index.html script ' + (i + 1), s));
verifier('sw.js', readFileSync(join(RACINE, 'sw.js'), 'utf8'));
const v1 = (html.match(/const APP_VERSION='([^']*)'/) || [])[1];
const v2 = (readFileSync(join(RACINE, 'sw.js'), 'utf8').match(/const VERSION = '([^']*)'/) || [])[1];
console.log('APP_VERSION = ' + v1 + ' | sw VERSION = ' + v2);
if (!v1 || !v2) { erreurs++; console.log('  ÉCHEC versions introuvables'); }
process.exit(erreurs ? 1 : 0);
