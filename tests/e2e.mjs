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
jours.forEach((j, i) => { j.satures = i >= jours.length - 10 ? 18 + i % 9 : null; j.sucres_ajoutes = j.satures === null ? null : 25; j.sodium = 1800; j.fibres = 20; });
const DATA = {
  ok: true, profil: { prenom: 'Test', sexe: 'H', taille: 180, naissance: 1980, age: 46, role: 'administrateur', telegram: true },
  reference: { date: jour(0), poids: 100, mb: 1900, tdee: 2700, cible: 2100, activite: 'Sedentaire', facteur: 1.2, mode: 'Seche', ecart: -600, repartition: '25/40/5/30', macros: '30/30/40', purines_max: 400, objectif_poids: 90, objectif: 'seche', ecart_kcal: -600 },
  cibles: { kcal: 2100, prot: 158, lip: 70, gluc: 210 },
  aujourdhui: { date: jour(0), kcal: 900, prot: 50, lip: 30, gluc: 90, repas: 2, fibres: 12, sodium: 1500, satures: 26, sucres_ajoutes: 20, purines: 0, purines_risque: 0, alcool: 0, boissons_sucrees: 0, parRepas: {} },
  moyennes: { j3: {}, j7: {}, j30: {} }, deficit: { cumule: [] },
  poids: [-40, -30, -20, -10, -1].map((n, i) => ({ date: jour(n), poids: 102 - i * 0.5, mb: 1900, tdee: 2700 })),
  jours, journal: LIGNES.filter(l => l.date >= depuis).reverse(), journal_depuis: depuis,
  catalogue: [...AL.pdj, ...AL.midi].map((a, i) => Object.assign({}, a, { k: a.nom.toLowerCase(), n: 10 - i, cr: { matin: i < 2 ? 5 : 0, midi: i >= 2 ? 5 : 0, encas: 0, soir: 0 }, mode: a.quantite.endsWith('g') ? 'p' : 'n', u: a.quantite.replace(/^\d+\s*/, '').replace(/s$/, ''), up: a.quantite.replace(/^\d+\s*/, '') })),
  crises: [{ id: 'g1', date: jour(-5), articulation: 'gros orteil', intensite: 4, remarque: '' }],
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
  if (q.action === 'poids') return json({ ok: true, poids: q.poids });
  if (q.action === 'crise') return json({ ok: true });
  if (q.action === 'invite') return q.profil ? json({ ok: true, token: 'TOKNEUF', prenom: q.profil.prenom }) : (q.invite === 'ABCD-EFGH' ? json({ ok: true, besoin_profil: true, prenom: 'Hugo' }) : json({ ok: false, erreur: 'Code inconnu.' }));
  if (q.action === 'admin') return json({ ok: true, comptes: [{ uid: 'u1', prenom: 'Test', statut: 'actif', role: 'administrateur', telegram: true }], invitations: [], cree: q.op === 'inviter' ? { code: 'ZR4T-8HNW', type: 'inscription', prenom: q.prenom, expire: jour(7) } : undefined });
  if (q.action === 'params') return json({ ok: true, objectif: q.objectif, cible: 3000, activite: 'Sedentaire', mode: 'Prise de masse' });
  return json(DATA);
});
await page.addInitScript(() => localStorage.setItem('suivi.config', JSON.stringify({ api: 'https://api.test/x', token: 't' })));
await page.goto('https://app.test/index.html');
await page.waitForSelector('nav button');
const texte = async s => (await page.locator(s).first().innerText()).replace(/\s+/g, ' ');

console.log('Jour');
ok(await page.locator('.cal-pastille').count() === 1, 'pastille des calories');
ok(await page.locator('.hero .hm').count() === 3, 'barres des trois macros');
ok(await page.locator('.seg .on[data-jo="repas"]').count() === 1, 'onglet Repas ouvert par défaut');
await page.click('[data-jo="objectif"]');
ok(/Objectif 90 kg/.test(await texte('.obj')), 'onglet Objectif : carte objectif');
ok(/vers le/.test(await texte('.obj')), 'projection datée');
await page.click('[data-jo="purines"]');
ok(await page.locator('.pur-tete').count() === 1, 'onglet Purines');
await page.click('[data-jo="repas"]');

console.log('Courbes et Corps');
await page.click('nav button[data-vue="courbes"]');
ok(await page.locator('[data-cong="poids"].on').count() === 1 && await page.locator('[data-cper="30"].on').count() === 1, 'Courbes : onglet Poids et 30 jours par défaut');
ok(await page.locator('.vue.on .tu').count() === 3, 'Courbes : trois tuiles de synthèse');
ok(await page.locator('.vue.on #p-envoi').count() === 0, 'Courbes : plus de saisie de pesée');
await page.click('[data-cong="calories"]'); await page.click('[data-cper="7"]');
ok(/Sous besoins/i.test(await texte('.vue.on .tuiles')) && await page.locator('[data-cper="7"].on').count() === 1, 'Courbes : onglet Calories sur 7 jours');
await page.click('[data-cong="purines"]');
ok(/Plafond/i.test(await texte('.vue.on .tuiles')), 'Courbes : onglet Purines');
await page.click('[data-cong="poids"]'); await page.click('[data-cper="30"]');
await page.click('nav button[data-vue="corps"]');
ok(await page.locator('.vue.on [data-ko="pesee"].on').count() === 1 && /Pesée du jour/.test(await texte('.vue.on section:nth-of-type(2)')), 'Corps : onglet Pesée ouvert par défaut');
await page.click('#p-envoi'); await page.waitForTimeout(300);
ok(appels.some(a => a.action === 'poids' && a.poids === 100) && /100 kg enregistrés/.test(await texte('.vue.on .bien')), 'Corps : pesée envoyée');

console.log('Qualité et goutte');
await page.click('nav button[data-vue="jour"]');
ok(/Graisses saturées 26/.test(await texte('.qj')) && /3 g en trop/.test(await texte('.qj')), 'Jour : qualité du jour (saturées au-dessus du plafond)');
await page.click('nav button[data-vue="courbes"]'); await page.click('[data-cong="qualite"]');
ok(await page.locator('.vue.on .tuiles.t2 .tu').count() === 5 && await page.locator('[data-cnut="satures"].on').count() === 1, 'Courbes : onglet Qualité, quatre tuiles + alcool');
await page.click('[data-cnut="fibres"]');
ok(await page.locator('[data-cnut="fibres"].on').count() === 1, 'Courbes : choix du nutriment');
await page.click('[data-cnut="alcool"]');
ok(/verres? cette semaine/.test(await texte('.vue.on .tu-large')) && (await page.locator('.vue.on svg text', { hasText: 'repère 10 verres' }).count()) === 1, 'Courbes : alcool en verres par semaine, repère 10');
await page.click('[data-cong="purines"]');
ok(await page.locator('.vue.on svg path[fill="var(--rouge)"]').count() === 1, 'Purines : repère de la crise sur le graphique');
await page.click('[data-cong="poids"]');
await page.click('nav button[data-vue="corps"]'); await page.click('[data-ko="goutte"]');
ok(await page.locator('.crise').count() === 1 && /gros orteil/.test(await texte('.crise')), 'Corps : onglet Goutte, crise listée avec son analyse');
await page.click('[data-gq="hier"]'); await page.click('[data-ga="cheville"]'); await page.click('[data-gi="3"]'); await page.click('#g-noter'); await page.waitForTimeout(300);
const cr = appels.filter(a => a.action === 'crise').pop();
ok(cr && cr.op === 'ajouter' && cr.date === jour(-1) && cr.articulation === 'cheville' && cr.intensite === 3, 'Corps : crise notée (hier, cheville, 3)');
await page.click('[data-ko="pesee"]');

console.log('Réglages');
await page.click('#b-reglages'); await page.waitForTimeout(300);
ok((await page.inputValue('#g-ecart')) === '-600' && /Besoins 2.280 kcal . 600 = cible 1.900 kcal/.test(await texte('#g-apercu')), 'objectif sèche : écart et cible calculée');
await page.click('[data-ob="prise"]');
ok((await page.inputValue('#g-ecart')) === '+300', 'prise de masse : écart proposé +300');
await page.click('#g-envoi'); await page.waitForTimeout(400);
const pa = appels.filter(a => a.action === 'params').pop();
ok(pa && pa.objectif === 'prise' && pa.ecart_kcal === 300 && !('cible' in pa), 'objectif et écart envoyés (plus de cible fixe)');
ok(await page.locator('#rg-onglets [data-rg]').count() === 5 && await page.locator('[data-rgp="reperes"]').isHidden(), 'Réglages en onglets (5 pour l administrateur)');
await page.click('[data-rg="reperes"]');
ok(await page.locator('#ch-macros').isVisible() && await page.locator('#g-ecart').isHidden(), 'onglet Repères : macros visibles, objectif masqué');
await page.click('[data-rg="inviter"]');
await page.fill('#adm-prenom', 'Hugo'); await page.click('#adm-inviter'); await page.waitForTimeout(300);
ok(/ZR4T-8HNW/.test(await texte('.adm-lien')) && await page.locator('[data-adm-part="ZR4T-8HNW"]').count() > 0, 'invitation créée et prête à envoyer');
await page.click('[data-rg="objectif"]');
await page.click('#b-reglages');

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

console.log('Inscription par invitation');
const pi = await (await navigateur.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 } })).newPage();
pi.on('pageerror', e => erreurs.push(e.message));
await pi.route('https://app.test/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: HTML }));
await pi.route('https://api.test/**', async r => { const q = JSON.parse(r.request().postData() || '{}'); appels.push(q);
  if (q.action === 'invite') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(q.profil ? { ok: true, token: 'TOKNEUF' } : { ok: true, besoin_profil: true, prenom: 'Hugo' }) });
  return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(DATA) }); });
await pi.goto('https://app.test/index.html#invite=ABCD-EFGH&api=' + encodeURIComponent('https://api.test/x'));
await pi.waitForSelector('#w-copier');
ok(/ABCD-EFGH/.test(await pi.locator('.ins-code').innerText()), 'lien ouvert dans Safari : page d accueil avec le code');
await pi.click('#w-ici'); await pi.click('#i-suite'); await pi.waitForSelector('#i-creer');
ok((await pi.inputValue('#i-prenom')) === 'Hugo', 'code vérifié : formulaire de profil prérempli');
await pi.click('#i-creer'); await pi.waitForTimeout(100);
ok(/sexe|homme/i.test(await pi.locator('.alerte').innerText()), 'profil incomplet : message clair');
await pi.click('[data-isx="H"]'); await pi.fill('[data-if="age"]', '22'); await pi.fill('[data-if="taille"]', '178'); await pi.fill('[data-if="poids"]', '68,5'); await pi.click('[data-iob="prise"]');
await pi.click('#i-creer'); await pi.waitForSelector('nav button');
const iv = appels.filter(a => a.action === 'invite').pop();
ok(iv.profil && iv.profil.objectif === 'prise' && iv.profil.ecart_kcal === 300 && iv.profil.poids === 68.5, 'profil envoyé avec objectif et écart');
ok(JSON.parse(await pi.evaluate(() => localStorage.getItem('suivi.config'))).token === 'TOKNEUF' && (await pi.evaluate(() => location.hash)) === '', 'compte créé : code enregistré, lien effacé');
await pi.close();

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
