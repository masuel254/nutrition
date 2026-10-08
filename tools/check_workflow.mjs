// Vérifie le workflow n8n local (n8n/Agent_Nutrition.json, jamais commité) :
//  - JSON valide, noms de nœuds uniques, connexions vers des nœuds existants ;
//  - syntaxe de chaque nœud Code (enveloppé dans une fonction async, comme n8n le fait).
// Usage : node tools/check_workflow.mjs [chemin.json]
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const chemin = process.argv[2] || join(RACINE, 'n8n', 'Agent_Nutrition.json');
const w = JSON.parse(readFileSync(chemin, 'utf8'));
const dossier = mkdtempSync(join(tmpdir(), 'wf-'));
let erreurs = 0;
const noms = new Set();
for (const n of w.nodes) {
  if (noms.has(n.name)) { erreurs++; console.log('  ÉCHEC nom en double : ' + n.name); }
  noms.add(n.name);
}
for (const [src, v] of Object.entries(w.connections || {})) {
  if (!noms.has(src)) { erreurs++; console.log('  ÉCHEC connexion depuis un nœud absent : ' + src); }
  for (const sortie of v.main || []) for (const x of sortie || [])
    if (!noms.has(x.node)) { erreurs++; console.log('  ÉCHEC ' + src + ' → nœud absent : ' + x.node); }
}
let nCode = 0;
for (const n of w.nodes) {
  const code = n.parameters && n.parameters.jsCode;
  if (!code) continue;
  nCode++;
  const f = join(dossier, 'n' + nCode + '.js');
  writeFileSync(f, 'async function f(){\n' + code + '\n}\n');
  try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); }
  catch (e) { erreurs++; console.log('  ÉCHEC syntaxe du nœud « ' + n.name + ' »\n' + String(e.stderr).split('\n').slice(0, 6).join('\n')); }
}
console.log(w.nodes.length + ' nœuds, ' + nCode + ' nœuds Code vérifiés.');
console.log(erreurs ? erreurs + ' erreur(s).' : 'Workflow OK.');
process.exit(erreurs ? 1 : 0);
