// Installe un hook git « pre-commit » qui lance tools/verif_secrets.mjs avant chaque commit
// (y compris ceux faits à la main, hors Claude Code). Usage, une fois : node tools/installer_hook_git.mjs
import { writeFileSync, chmodSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
const dossier = execFileSync('git', ['rev-parse', '--git-path', 'hooks'], { encoding: 'utf8' }).trim();
const f = join(dossier, 'pre-commit');
writeFileSync(f, '#!/bin/sh\nnode tools/verif_secrets.mjs || exit 1\n');
try { chmodSync(f, 0o755); } catch {}
console.log('Hook installé : ' + f);
