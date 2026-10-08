// Refuse (code 1) si un fichier suivi par git (contenu prêt à être commité) contient une clé d'API,
// ou si un JSON de workflow n8n / un payload de test est suivi. Usage : node tools/verif_secrets.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 << 20 });
const racine = git('rev-parse', '--show-toplevel').trim();
// --tout : ajoute les fichiers non suivis mais non ignorés et lit la copie de travail (utilisé par le hook,
// qui passe avant un éventuel « git add » de la même commande).
const TOUT = process.argv.includes('--tout');
const fichiers = [...new Set(git('ls-files', '--cached', '-z').split('\0')
  .concat(TOUT ? git('ls-files', '--others', '--exclude-standard', '-z').split('\0') : []).filter(Boolean))];
const CLES = [/AIza[0-9A-Za-z_-]{30,}/, /AQ\.[0-9A-Za-z_.-]{40,}/, /sk-ant-[0-9A-Za-z_-]{20,}/, /gsk_[0-9A-Za-z]{30,}/,
  /x-goog-api-key["']?\s*[:,]\s*["'][0-9A-Za-z_.-]{25,}/, /x-goog-api-key"[\s\S]{0,40}"value"\s*:\s*"[^"={}\s]{25,}"/];
// Valeurs exactes des clés présentes dans le workflow local (si le fichier existe) : on les cherche telles quelles.
const EXACTES = [];
try {
  const w = JSON.parse(readFileSync(join(racine, 'n8n', 'Agent_Nutrition.json'), 'utf8'));
  for (const n of w.nodes || []) for (const h of ((n.parameters || {}).headerParameters || {}).parameters || [])
    if (/api-key|authorization/i.test(h.name || '') && typeof h.value === 'string' && h.value.length >= 20 && !h.value.startsWith('=')) EXACTES.push(h.value);
} catch { /* pas de workflow local : seuls les motifs servent */ }
let ko = 0;
for (const f of fichiers) {
  if (/(^|\/)n8n\/.+\.json$|Agent_Nutrition.*\.json$|payload.*\.json$/i.test(f)) { console.log('ERREUR : fichier interdit suivi par git : ' + f); ko++; continue; }
  if (f === 'tools/verif_secrets.mjs') continue;
  let contenu;
  const disque = () => { const p = join(racine, f); return existsSync(p) ? readFileSync(p, 'utf8') : ''; };
  if (TOUT) contenu = disque(); else { try { contenu = git('show', ':' + f); } catch { contenu = disque(); } }
  for (const re of CLES) if (re.test(contenu)) { console.log('ERREUR : clé d\'API probable dans ' + f + ' (' + re.source.slice(0, 12) + '…)'); ko++; break; }
  if (EXACTES.some(k => contenu.includes(k))) { console.log('ERREUR : la clé du workflow local apparaît dans ' + f); ko++; }
}
console.log(ko ? ko + ' problème(s) : ne pas commiter.' : 'Aucun secret détecté dans les ' + fichiers.length + ' fichiers suivis.');
process.exit(ko ? 1 : 0);
