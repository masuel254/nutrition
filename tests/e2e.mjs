// Tests de non-régression de l'appli (index.html), sans serveur : le webhook n8n est simulé
// avec des données fictives générées ici (aucune donnée personnelle dans le dépôt).
// Lancement : npm i -D playwright && npx playwright install chromium && node tests/e2e.mjs
import { chromium, devices } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ICI = dirname(fileURLToPath(import.meta.url));
const HTML = readFileSync(join(ICI, '..', 'index.html'));
const p2 = n => String(n).padStart(2, '0');
const iso = x => x.getFullYear() + '-' + p2(x.getMonth() + 1) + '-' + p2(x.getDate());
const jour = n => { const x = new Date(); x.setHours(12, 0, 0, 0); x.setDate(x.getDate() + n); return iso(x); };
const lundi = s => { const x = new Date(s + 'T12:00:00'); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return iso(x); };

// ---------- données fictives ----------
const AL = {
  pdj: [{ nom: 'Tartines complètes', quantite: '2 tranches', kcal: 150, prot: 6, lip: 2, gluc: 26, fibres: 4, sucres: 2, sodium: 250, famille: 'cereales_completes', grammes: 60, purines: 36, purines_risque: 0, alcool: 0, sucree: 0 },
        { nom: 'Yaourt nature', quantite: '1 pot', kcal: 75, prot: 5, lip: 4, gluc: 6, fibres: 0, sucres: 6, sodium: 60, famille: 'laitier', grammes: 125, purines: 6, purines_risque: 0, alcool: 0, sucree: 0 }],
  midi: [{ nom: 'Blanc de poulet', quantite: '150 g', kcal: 225, prot: 45, lip: 5, gluc: 0, fibres: 0, sucres: 0, sodium: 100, famille: 'volaille', grammes: 150, purines: 225, purines_risque: 225, alcool: 0, sucree: 0 },
         { nom: 'Riz basmati cuit', quantite: '200 g', kcal: 260, prot: 5, lip: 1, gluc: 57, fibres: 1, sucres: 0, sodium: 5, famille: 'cereales_raffinees', grammes: 200, purines: 60, purines_risque: 0, alcool: 0, sucree: 0 }]
};
const tot = als => als.reduce((t, a) => { ['kcal', 'prot', 'lip', 'gluc', 'purines', 'purines_risque'].forEach(k => t[k] += a[k]); return t; }, { kcal: 0, prot: 0, lip: 0, gluc: 0, purines: 0, purines_risque: 0 });
const LIGNES = [];
for (let n = -60; n <= -1; n++) {
  const d = jour(n);
  [['Matin', AL.pdj], ['Midi', AL.midi]].forEach(([r, als], k) => {
    const t = tot(als);
    LIGNES.push(Object.assign({ id: 'test' + (-n) + k, date: d, repas: r, detail: als.map(a => a.nom + ' (' + a.quantite + ')').join(', '), nutriscore: '', fibres: 5, sucres: 8, sodium: 400, alcool: n % 9 ? 0 : 12, boissons_sucrees: 0, aliments: als }, t));
  });
}
const depuis = (() => { const l = lundi(jour(0)); const x = new Date(l + 'T12:00:00'); x.setDate(x.getDate() - 7); return iso(x); })();
const jours = [...new Set(LIGNES.map(l => l.date))].sort().map(d => {
  const ls = LIGNES.filter(l => l.date === d), k = ls.reduce((t, l) => t + l.kcal, 0);
  return { date: d, kcal: k, prot: 61, lip: 12, gluc: 89, repas: ls.length, cible: 2100, tdee: 2700, ecart: k - 2700, valide: true,
    purines: ls.reduce((t, l) => t + l.purines, 0), purines_risque: ls.reduce((t, l) => t + l.purines_risque, 0), alcool: ls.reduce((t, l) => t + l.alcool, 0), boissons_sucrees: 0 };
});
const DATA = {
  ok: true, profil: { prenom: 'Test', sexe: 'H', taille: 180, naissance: 1980, age: 46 },
  reference: { date: jour(0), poids: 100, mb: 1900, tdee: 2700, cible: 2100, activite: 'Sedentaire', facteur: 1.2, mode: 'Seche', ecart: -600, repartition: '25/40/5/30', macros: '30/30/40', purines_max: 400, objectif_poids: 90 },
  cibles: { kcal: 2100, prot: 158, lip: 70, gluc: 210 },
  aujourdhui: { date: jour(0), kcal: 0, prot: 0, lip: 0, gluc: 0, repas: 0, purines: 0, purines_risque: 0, alcool: 0, boissons_sucrees: 0, parRepas: {} },
  moyennes: { j3: {}, j7: {}, j30: {} }, deficit: { cumule: [] },
  poids: [-40, -30, -20, -10, -1].map((n, i) => ({ date: jour(n), poids: 102 - i * 0.5, mb: 1900, tdee: 2700 })),
  jours, journal: LIGNES.filter(l => l.date >= depuis).reverse(), journal_depuis: depuis,
  catalogue: [...AL.pdj, ...AL.midi].map((a, i) => Object.assign({}, a, { k: a.nom.toLowerCase(), n: 10 - i, cr: { matin: i < 2 ? 5 : 0, midi: i >= 2 ? 5 : 0, encas: 0, soir: 0 }, mode: a.quantite.endsWith('g') ? 'p' : 'n', u: a.quantite.replace(/^\d+\s*/, '').replace(/s$/, ''), up: a.quantite.replace(/^\d+\s*/, '') })),
  suggestions: {}, parametres: [], activite: [], mesures: [], photos: []
};

// ---------- banc de test ----------
let echecs = 0;
const ok = (cond, msg) => { console.log((cond ? '  ok   ' : '  ÉCHEC ') + msg); if (!cond) echecs++; };
const navigateur = await chromium.launch();
const page = await (await navigateur.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 } })).newPage();
const erreurs = []; page.on('pageerror', e => erreurs.push(e.message));
const appels = []; let reponseVide = 1, ia503 = true;
await page.route('https://app.test/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: HTML }));
await page.route('https://api.test/**', async r => {
  const q = JSON.parse(r.request().postData() || '{}'); appels.push(q);
  const json = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
  if (q.action === 'journal') return json({ ok: true, journal: LIGNES.filter(l => l.date >= q.debut && l.date <= q.fin) });
  if (q.action === 'enregistrer') { if (reponseVide-- > 0) return r.fulfill({ status: 200, body: '' }); return json({ ok: true, enregistre: true, id: q.id, date: q.date, repas: q.repas, kcal: q.kcal }); }
  if (q.action === 'repas' && ia503) return json({ ok: false, ia: true, erreur: "L'IA de Google est indisponible pour le moment." }, 503);
  if (q.action === 'suppr') return json({ ok: true });
  return json(DATA);
});
await page.addInitScript(() => localStorage.setItem('suivi.config', JSON.stringify({ api: 'https://api.test/x', token: 't' })));
await page.goto('https://app.test/index.html');
await page.waitForSelector('nav button');
const texte = async s => (await page.locator(s).first().innerText()).replace(/\s+/g, ' ');

console.log('Jour');
ok(await page.locator('.cal-pastille').count() === 1, 'pastille des calories');
ok(/Objectif 90 kg/.test(await texte('.obj')), 'carte objectif');
ok(/vers le/.test(await texte('.obj')), 'projection datée');

console.log('Journal');
await page.click('nav button[data-vue="journal"]');
ok(await page.locator('.bilan-s').count() === 1, 'bilan de la semaine dernière');
ok(await page.locator('.jn-sem').count() >= 3, 'semaines précédentes repliées');
await page.click('#jn-plus');
const vieux = await page.evaluate(() => { const b = [...document.querySelectorAll('[data-st]')].pop(); b.click(); return b.dataset.st; });
await page.waitForTimeout(100);
await page.locator(`.jn-sem [data-st="${vieux}"]`).locator('xpath=..').locator('[data-jt]').first().click();
await page.waitForTimeout(400);
ok(appels.some(a => a.action === 'journal' && a.debut === vieux), 'détail ancien chargé à la demande');
ok(await page.locator('.jn-det .ligne').count() > 0, 'repas affichés après chargement');

console.log('Ajouter');
await page.click('nav button[data-vue="ajout"]');
await page.click('#rac-tr');
await page.click('#rac-crr button[data-cr="midi"]');
await page.click('[data-rf-aj="0"]');
await page.waitForTimeout(2500);
const enr = appels.filter(a => a.action === 'enregistrer');
ok(enr.length === 2 && enr[0].id && enr[0].id === enr[1].id, 'réponse vide rejouée avec le même identifiant (pas de doublon)');
ok(/enregistrées/.test(await texte('.resu')), 'repas enregistré');
await page.click('#e-modif'); await page.click('#e-auj'); await page.waitForTimeout(500);
ok(appels.filter(a => a.action === 'enregistrer').pop().id === enr[0].id && !appels.some(a => a.action === 'suppr'), 'modifier met à jour la même ligne');
await page.click('#a-nouveau');
if (!(await page.locator('#rac-tc').count())) await page.click('nav button[data-vue="ajout"]');
await page.click('#rac-tc'); await page.click('#rac-crc button[data-cr="tous"]');
await page.locator('[data-cp]').first().click(); await page.locator('[data-cp]').first().click();
ok(/2 unités/.test(await texte('#rac-valide')), 'composer : compteur d\'unités');
await page.click('#rac-valide');
ok(await page.locator('.resu-al li').count() >= 2, 'composer : résultat construit sans IA');
await page.click('#a-nouveau');
await page.fill('#a-desc', 'test'); await page.click('#a-envoi'); await page.waitForTimeout(300);
ok(/indisponible/.test(await texte('.alerte')), 'message clair si l\'IA est indisponible');

console.log('Affichage');
for (const vue of ['jour', 'ajout', 'courbes', 'corps', 'journal']) {
  await page.click(`nav button[data-vue="${vue}"]`);
  const d = await page.evaluate(() => { const x = document.getElementById('defile'); return x.scrollWidth - x.clientWidth; });
  ok(d <= 0, 'pas de débordement horizontal : ' + vue);
}
const petits = await page.evaluate(() => [...document.querySelectorAll('input,textarea,select')].filter(e => parseFloat(getComputedStyle(e).fontSize) < 16).length);
ok(petits === 0, 'champs en 16 px minimum (pas de zoom iOS)');
ok(erreurs.length === 0, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.join(' | ') : ''));

await navigateur.close();
console.log(echecs ? `\n${echecs} échec(s)` : '\nTout est vert.');
process.exit(echecs ? 1 : 0);
