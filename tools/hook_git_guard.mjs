// Hook Claude Code (PreToolUse sur Bash) : avant tout « git commit » ou « git push »,
// lance tools/verif_secrets.mjs et bloque la commande (code 2) si un secret est détecté.
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

let entree = '';
process.stdin.on('data', d => entree += d);
process.stdin.on('end', () => {
  let cmd = '';
  try { cmd = (JSON.parse(entree).tool_input || {}).command || ''; } catch { process.exit(0); }
  if (!/\bgit\b[^;&|]*\b(commit|push)\b/.test(cmd)) process.exit(0);
  try {
    execFileSync(process.execPath, [join(dirname(fileURLToPath(import.meta.url)), 'verif_secrets.mjs'), '--tout'], { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
    process.exit(0);
  } catch (e) {
    process.stderr.write('Commit/push bloqué par tools/verif_secrets.mjs :\n' + (e.stdout || '') + (e.stderr || ''));
    process.exit(2);
  }
});
