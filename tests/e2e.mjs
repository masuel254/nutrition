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
    LIGNES.push(Object.assign({ id: 'test' + (-n) + k, ia: k === 1 ? 'claude' : (n % 2 ? 'flash' : ''), date: d, repas: r, detail: als.map(a => a.nom + ' (' + a.quantite + ')').join(', '), nutriscore: '', fibres: 5, sucres: 8, sodium: 400, alcool: n % 9 ? 0 : 12, boissons_sucrees: 0, aliments: n % 9 || k ? als : als.concat([{ nom: 'Vin rouge', quantite: '1 verre', kcal: 0, alcool: 12 }]) }, t));
  });
}
const depuis = (() => { const l = lundi(jour(0)); const x = new Date(l + 'T12:00:00'); x.setDate(x.getDate() - 7); return iso(x); })();
const jours = [...new Set(LIGNES.map(l => l.date))].sort().map(d => {
  const ls = LIGNES.filter(l => l.date === d), k = ls.reduce((t, l) => t + l.kcal, 0);
  return { date: d, kcal: k, prot: 61, lip: 12, gluc: 89, repas: ls.length, cible: 2100, tdee: 2700, ecart: k - 2700, valide: true,
    purines: ls.reduce((t, l) => t + l.purines, 0), purines_risque: ls.reduce((t, l) => t + l.purines_risque, 0), alcool: ls.reduce((t, l) => t + l.alcool, 0), boissons_sucrees: 0 };
});
jours.forEach((j, i) => { j.satures = i >= jours.length - 10 ? 18 + i % 9 : null; j.sucres_ajoutes = j.satures === null ? null : 25; j.sodium = 1800; j.fibres = 20; if (i < jours.length - 10) j.alcool = null; });
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
  ia_jours: [-1, -2, -3, -4, -5, -40].map((n, i) => ({ d: jour(n), c: i === 5 ? { '?': 2 } : { flash: 2, groq: i % 2, claude: i === 0 ? 1 : 0 } })),
  suggestions: {}, parametres: [], activite: [2000, 3000, 4000, 5000, 6000, 8000, 13736, 131].map((p, i) => ({ date: jour(i - 7), pas: p })), mesures: [], photos: []
};

// ---------- banc de test ----------
let echecs = 0;
const ok = (cond, msg) => { console.log((cond ? '  ok   ' : '  ÉCHEC ') + msg); if (!cond) echecs++; };
const navigateur = await chromium.launch();
const page = await (await navigateur.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 } })).newPage();
const erreurs = []; page.on('pageerror', e => erreurs.push(e.message));
const PHOTOS = {}; let nPhotos = 0;
const PRODUITS = {
  111: { nom: 'Yaourt nature', marque: 'Danone', nutriscore: 'b', portion: 125, paquet: 500, per100: { kcal: 64, prot: 4, lip: 2.4, gluc: 6.4, fibres: 0, sucres: 6.4, sodium: 50, satures: 1.6 } },
  222: { nom: 'Pain complet', marque: '', nutriscore: 'a', portion: 0, paquet: 0, per100: { kcal: 250, prot: 9, lip: 3, gluc: 45, fibres: 7, sucres: 4, sodium: 400, satures: 0.6 } },
  333: { nom: 'Jambon blanc', marque: '', nutriscore: '', portion: 0, paquet: 0, per100: { kcal: 120, prot: 20, lip: 4, gluc: 1, fibres: 0, sucres: 1, sodium: 900, satures: 1.5 } }
};
const COMPTES = [{ uid: 'u1', prenom: 'Test', statut: 'actif', role: 'administrateur', telegram: true, ia: true, niveau: 'oui', claude: { a: 5, c: 2, h: 6, s: 1 } },
  { uid: 'u2', prenom: 'Hugo', statut: 'actif', role: 'utilisateur', telegram: false, ia: false, niveau: 'non', claude: { a: 0, c: 0, h: 0, s: 0 } }];
const appels = []; let reponseVide = 1, ia503 = true, secoursTest = false, menuKO = false;
await page.route('https://app.test/**', r => {
  const img = new URL(r.request().url()).pathname.match(/^\/(img\/imc\/[fh]-\d+\.webp)$/); // vraies images du dépôt
  if (img) { try { return r.fulfill({ status: 200, contentType: 'image/webp', body: readFileSync(join(ICI, '..', img[1])) }); } catch { return r.fulfill({ status: 404, body: '' }); } }
  return r.fulfill({ status: 200, contentType: 'text/html', body: HTML });
});
await page.route('https://api.test/**', async r => {
  const q = JSON.parse(r.request().postData() || '{}'); appels.push(q);
  const json = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
  if (q.action === 'journal') return json({ ok: true, journal: LIGNES.filter(l => l.date >= q.debut && l.date <= q.fin) });
  if (q.action === 'enregistrer') { if (reponseVide-- > 0) return r.fulfill({ status: 200, body: '' }); return json({ ok: true, enregistre: true, id: q.id, date: q.date, repas: q.repas, kcal: q.kcal }); }
  if (q.action === 'repas' && secoursTest) return json({ ok: true, enregistre: false, repas: 'Soir', date: jour(0), secours: 'claude', ia: 'claude', echecs: 'Flash : 429 quota', incertitude: 'moyenne', note: '', aliments: [{ nom: 'Poulet', quantite: '200 g', kcal: 400, prot: 50, lip: 20, gluc: 0 }], total: { kcal: 400, prot: 50, lip: 20, gluc: 0 }, ligne: { repas: 'Soir', detail: 'Poulet (200 g)', kcal: 400, prot: 50, lip: 20, gluc: 0 } });
  if (q.action === 'repas' && ia503) return json({ ok: false, ia: true, erreur: "L'IA de Google est indisponible pour le moment." }, 503);
  if (q.action === 'menu') return menuKO ? json({ ok: false, ia: true, erreur: 'Menu trop flou pour être lu.' }, 503)
    : json({ ok: true, menu: true, ia: 'flash', note: 'Portions standard de restaurant.', illisible: ['Plat du jour (ligne coupée)'],
      plats: [{ nom: 'Burger du chef', description: 'boeuf, cheddar, frites', kcal: 1020, prot: 42, lip: 58, gluc: 75, confiance: 'moyenne' },
        { nom: 'Salade chèvre chaud', description: '', kcal: 640, prot: 24, lip: 41, gluc: 38, confiance: 'haute' },
        { nom: 'Tarte aux pommes', description: '', kcal: 420, prot: 5, lip: 18, gluc: 60, confiance: 'faible' }] });
  if (q.action === 'conseil') return json({ ok: true, texte: 'Bien vu, prends la salade.' });
  if (q.action === 'barcode') return json(PRODUITS[q.code] ? { ok: true, trouve: true, produit: PRODUITS[q.code] } : { ok: true, trouve: false, message: 'Produit introuvable.' });
  if (q.action === 'suppr') return json({ ok: true });
  if (q.action === 'poids') return json({ ok: true, poids: q.poids });
  if (q.action === 'crise') return json({ ok: true });
  if (q.action === 'photo') { const f = 'F' + (++nPhotos) + '#1:' + nPhotos; PHOTOS[f] = q.photo; DATA.photos = DATA.photos.filter(p => !(p.type === q.type && p.date === q.date)).concat([{ date: q.date, type: q.type, fichier: f }]).sort((a, b) => a.date.localeCompare(b.date)); return json({ ok: true, fichier: f, date: q.date, type: q.type }); }
  if (q.action === 'photo_get') return PHOTOS[q.fichier] ? json({ ok: true, photo: PHOTOS[q.fichier], mime: 'image/jpeg' }) : json({ ok: false, erreur: 'Photo introuvable.' });
  if (q.action === 'photo_gerer') {
    const p = DATA.photos.find(x => x.type === q.type && x.date === q.date); if (!p) return json({ ok: false, erreur: 'Photo introuvable.' });
    if (q.op === 'suppr') { DATA.photos = DATA.photos.filter(x => x !== p); return json({ ok: true, op: 'suppr', archive: true }); }
    const rem = DATA.photos.some(x => x.type === q.type && x.date === q.nouvelle_date); DATA.photos = DATA.photos.filter(x => !(x.type === q.type && x.date === q.nouvelle_date)); p.date = q.nouvelle_date;
    DATA.photos.sort((a, b) => a.date.localeCompare(b.date)); return json({ ok: true, op: 'date', remplace: rem });
  }
  if (q.action === 'favoris') return json({ ok: true, favoris: q.favoris });
  if (q.action === 'invite') return q.profil ? json({ ok: true, token: 'TOKNEUF', prenom: q.profil.prenom }) : (q.invite === 'ABCD-EFGH' ? json({ ok: true, besoin_profil: true, prenom: 'Hugo' }) : json({ ok: false, erreur: 'Code inconnu.' }));
  if (q.action === 'admin') { if (q.op === 'ia') { const u = COMPTES.find(x => x.uid === q.uid); if (u) { u.niveau = q.niveau; u.ia = q.niveau !== 'non'; } }
    return json({ ok: true, comptes: COMPTES, invitations: [], cree: q.op === 'inviter' ? { code: 'ZR4T-8HNW', type: 'inscription', prenom: q.prenom, expire: jour(7) } : undefined }); }
  if (q.action === 'params') { if (q.reperes) DATA.reference.reperes = q.reperes; return json({ ok: true, objectif: q.objectif, cible: 3000, activite: 'Sedentaire', mode: 'Prise de masse' }); }
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

console.log('Jour : marge de marche');
ok(await page.locator('#pas-t').count() === 0, 'marge de marche : rien quand les pas du jour sont sous la moyenne (131 pas)');
{ const pasInit = DATA.activite[DATA.activite.length - 1].pas;
  const recharger = async pas => { DATA.activite[DATA.activite.length - 1].pas = pas; await page.reload(); await page.waitForSelector('nav button'); };
  await recharger(11200); // moyenne 7 jours précédents 5 962, 100 kg et 180 cm = 0,03735 kcal par pas : (11 200 − 5 962) × 0,03735 ≈ 196
  ok(await page.locator('#pas-t').count() === 1 && /11.200 pas/.test(await texte('#pas-t')) && /\+196 kcal gagnées/.test(await texte('#pas-t')) && await page.locator('.pas-d').count() === 0, 'marge de marche : ligne repliée « 11 200 pas · +196 kcal gagnées »');
  ok(/sur 2.100/.test(await texte('.cal-anneau')) && /1.200 kcal restantes/.test(await texte('.cal-pastille')), 'marge de marche : l\'anneau et la pastille gardent la cible 2 100');
  await page.click('#pas-t');
  const det = await texte('.pas-d');
  ok(/5.962 pas/.test(det) && /\+5.238 pas/.test(det) && /\+196 kcal/.test(det) && /cible reste 2.100 kcal/.test(det) && /jusqu’à 2.296/.test(det), 'marge de marche : détail déplié (moyenne, pas en plus, kcal, cible inchangée)');
  await page.click('#pas-t');
  ok(await page.locator('.pas-d').count() === 0, 'marge de marche : se replie au second toucher');
  const dx = await page.evaluate(() => { const x = document.getElementById('defile'); return x.scrollWidth - x.clientWidth; });
  ok(dx <= 0, 'marge de marche : pas de débordement horizontal');
  await recharger(pasInit);
  ok(await page.locator('#pas-t').count() === 0, 'marge de marche : disparaît quand les pas repassent sous la moyenne'); }

console.log('Courbes et Corps');
await page.click('nav button[data-vue="courbes"]');
ok(await page.locator('[data-cong="poids"].on').count() === 1 && await page.locator('[data-cper="30"].on').count() === 1, 'Courbes : onglet Poids et 30 jours par défaut');
ok(await page.locator('.vue.on .tu').count() === 3, 'Courbes : trois tuiles de synthèse');
ok(await page.locator('.vue.on #p-envoi').count() === 0, 'Courbes : plus de saisie de pesée');
await page.click('[data-cong="calories"]'); await page.click('[data-cper="7"]');
ok(/Sous besoins/i.test(await texte('.vue.on .tuiles')) && await page.locator('[data-cper="7"].on').count() === 1, 'Courbes : onglet Calories sur 7 jours');
await page.click('[data-cper="3"]');
ok(await page.locator('[data-cper="3"].on').count() === 1 && /\/ 3/.test(await texte('.vue.on .tuiles')), 'Courbes : période 3 jours sur les calories');
await page.click('[data-cper="7"]');
await page.click('[data-cong="purines"]');
ok(/Plafond/i.test(await texte('.vue.on .tuiles')), 'Courbes : onglet Purines');
await page.click('[data-cong="poids"]'); await page.click('[data-cper="30"]');
await page.click('nav button[data-vue="corps"]');
ok(await page.locator('.vue.on [data-ko="pesee"].on').count() === 1 && /Pesée du jour/.test(await texte('.vue.on section:nth-of-type(2)')), 'Corps : onglet Pesée ouvert par défaut');
await page.click('.vue.on [data-ko="pas"]'); await page.waitForTimeout(150);
{ const t = (await page.locator('.vue.on .prog.trois .col').allInnerTexts()).map(x => x.replace(/\s+/g, ' '));
  ok(t.length === 3 && /131/.test(t[0]) && /9.245/.test(t[1]) && /↑ \+55 % vs 7 j/.test(t[1]) && /5.962/.test(t[2]), 'Pas : aujourd hui, moyenne 3 j avec tendance, moyenne 7 j'); }
await page.click('.vue.on [data-ko="pesee"]');
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
ok(/verres? (la semaine derni[eè]re|cette semaine)/i.test(await texte('.vue.on .tu-large')) && (await page.locator('.vue.on .alc .alc-c').count()) >= 14 && (await page.locator('.vue.on .alc .alc-auj').count()) === 1, 'Courbes : alcool jour par jour (grille par semaine, aujourd hui en cours)');
ok(/aujourd.hui en cours : 26 g/i.test(await texte('.vue.on .tuiles.t2')), 'Courbes : tuiles Qualité avec la journée en cours');
ok((await page.locator('.vue.on .alc .alc-ns').count()) > 0 && /suivi depuis le/i.test(await texte('.vue.on .alc')), 'Courbes : alcool, jours d avant le suivi en non suivi');
await page.click('[data-cong="purines"]');
ok(await page.locator('.vue.on svg path[fill="var(--rouge)"]').count() === 1, 'Purines : repère de la crise sur le graphique');
await page.click('[data-cper="30"]');
await page.locator('.vue.on [data-bar="pur|' + jour(-1) + '"]').click();
ok(/Midi\s*225 mg/.test(await texte('.vue.on .jd')) && /Blanc de poulet · 150 g\s*225/.test(await texte('.vue.on .jd')) && await page.locator('.vue.on .pur-top').count() === 0, 'Purines : barre touchée, détail du jour par repas et par aliment');
const nJ = appels.filter(a => a.action === 'journal').length;
await page.locator('.vue.on [data-bar="pur|' + jour(-20) + '"]').click(); await page.waitForTimeout(600);
ok(appels.filter(a => a.action === 'journal').length === nJ + 1 && /Blanc de poulet/.test(await texte('.vue.on .jd')), 'Purines : jour ancien, semaine chargée à la demande');
await page.click('.vue.on [data-bar-off="pur"]');
ok(await page.locator('.vue.on .jd').count() === 0 && await page.locator('.vue.on .pur-top').count() === 1, 'Purines : retour aux repas les plus chargés');
await page.click('[data-cong="poids"]');
await page.click('nav button[data-vue="corps"]'); await page.click('[data-ko="goutte"]');
ok(await page.locator('.crise').count() === 1 && /gros orteil/.test(await texte('.crise')), 'Corps : onglet Goutte, crise listée avec son analyse');
await page.click('[data-gq="hier"]'); await page.click('[data-ga="cheville"]'); await page.click('[data-gi="3"]'); await page.click('#g-noter'); await page.waitForTimeout(300);
const cr = appels.filter(a => a.action === 'crise').pop();
ok(cr && cr.op === 'ajouter' && cr.date === jour(-1) && cr.articulation === 'cheville' && cr.intensite === 3, 'Corps : crise notée (hier, cheville, 3)');
await page.click('[data-ko="pesee"]');

console.log('Réglages');
await page.click('#b-reglages'); await page.waitForTimeout(300);
ok((await page.inputValue('#g-ecart')) === '-600' && /Besoins 2.280 kcal . 600 = 1.680, plus de 10 % sous ton métabolisme \(1.900\)/.test(await texte('#g-apercu')) && /cible 1.710 kcal/.test(await texte('#g-apercu')) && /écart réel de -570/.test(await texte('#g-apercu')) && /Attention, ta cible est sous ton métabolisme/.test(await texte('#g-apercu')), 'objectif sèche : plancher à 90 % du métabolisme expliqué, avertissement');
await page.click('[data-ob="prise"]');
ok((await page.inputValue('#g-ecart')) === '+300', 'prise de masse : écart proposé +300');
await page.click('#g-envoi'); await page.waitForTimeout(400);
const pa = appels.filter(a => a.action === 'params').pop();
ok(pa && pa.objectif === 'prise' && pa.ecart_kcal === 300 && !('cible' in pa), 'objectif et écart envoyés (plus de cible fixe)');
ok(await page.locator('#rg-onglets [data-rg]').count() === 5 && await page.locator('[data-rgp="reperes"]').isHidden(), 'Réglages en onglets (5 pour l administrateur)');
await page.click('[data-rg="reperes"]');
ok(await page.locator('#ch-macros').isVisible() && await page.locator('#g-ecart').isHidden(), 'onglet Repères : macros visibles, objectif masqué');
await page.click('[data-rg="inviter"]');
await page.click('#adm-inviter'); await page.waitForSelector('#adm-creer');
ok(await page.locator('[data-niv-i="non"].on').count() === 1, 'IA payantes : nouvelle invitation à « Aucune » par défaut');
await page.fill('#adm-prenom', 'Hugo'); await page.click('#adm-creer'); await page.waitForTimeout(300);
ok(/ZR4T-8HNW/.test(await texte('.adm-lien')) && await page.locator('[data-adm-part="ZR4T-8HNW"]').count() > 0, 'invitation créée et prête à envoyer');
const ivt = appels.filter(a => a.op === 'inviter').pop();
ok(ivt.niveau === 'non' && ivt.ia === false && ivt.prenom === 'Hugo', 'IA payantes : invitation envoyée sans IA payante');
ok(/≈ 0,11 €/.test(await texte('.adm-sum')) && /Haiku 6 · 0,06 €/.test(await texte('.adm-sum')), 'IA payantes : résumé du mois Haiku/Sonnet en euros');
ok(/Gratuit/.test(await texte('[data-adm-ouv="u2"]')) && /H \+ S.*0,11 €/.test(await texte('[data-adm-ouv="u1"]')), 'IA payantes : pastille de niveau et montant par compte');
await page.click('[data-adm-ouv="u1"]'); await page.waitForSelector('#adm-volet');
ok(await page.locator('[data-niv-c]:disabled').count() === 3 && await page.locator('#adm-rec-v').count() === 0, 'IA payantes : administrateur bloqué dans son volet');
await page.click('#adm-volet', { position: { x: 10, y: 10 } });
await page.click('[data-adm-ouv="u2"]'); await page.click('[data-niv-c="haiku"]'); await page.waitForTimeout(300);
const ia = appels.filter(a => a.op === 'ia').pop();
ok(ia && ia.uid === 'u2' && ia.niveau === 'haiku' && await page.locator('#adm-volet [data-niv-c="haiku"].on').count() === 1 && /Haiku/.test(await texte('[data-adm-ouv="u2"] .adm-chip')), 'IA payantes : Hugo passé à « Haiku » seul (volet et liste)');
await page.click('#adm-volet', { position: { x: 10, y: 10 } });
ok(await page.locator('#adm-volet').count() === 0, 'IA payantes : volet fermé');
await page.click('[data-rg="objectif"]');
ok(await page.locator('#rg-barre').isHidden(), 'Réglages : barre Enregistrer cachée tant que rien ne change');
const ec0 = parseInt(await page.inputValue('#g-ecart'), 10);
await page.click('#g-ec-m');
ok(parseInt(await page.inputValue('#g-ecart'), 10) === ec0 - 50 && await page.locator('#rg-barre').isVisible(), 'Réglages : − retire 50 kcal, barre Enregistrer visible');
await page.click('[data-ob="seche"]'); await page.click('[data-ecp="-750"]');
ok((await page.inputValue('#g-ecart')) === '-750' && /cible/.test(await texte('#g-apercu')), 'Réglages : raccourci d écart');
ok(/×1,2|×1,3|×1,375|×1,55/.test(await texte('#act-desc')), 'Réglages : niveau d activité expliqué');
await page.click('[data-rg="reperes"]');
await page.fill('#ch-repart input[data-rp="soir"]', '20');
ok(/il manque 10 %/.test(await texte('#repart-tot')), 'Réglages : total de répartition en direct');
await page.click('#rp-ajuste');
ok((await page.inputValue('#ch-repart input[data-rp="soir"]')) === '30' && /100 %/.test(await texte('#repart-tot')), 'Réglages : ajuster le soir');
await page.click('[data-pmx="300"]');
ok((await page.inputValue('#g-purmax')) === '300', 'Réglages : raccourci plafond de purines');
ok(/Auto · 30/.test(await page.getAttribute('[data-qr="fibres"]', 'placeholder')), 'Repères qualité : case vide = Auto (30 g de fibres)');
await page.fill('[data-qr="fibres"]', '25'); await page.fill('[data-qr="sodium"]', '99999'); await page.locator('.g-envoi:visible').first().click(); await page.waitForTimeout(200);
ok(/Sodium : entre 500/.test(await texte('.rg-p:not([hidden])')) && (await page.inputValue('[data-qr="fibres"]')) === '25', 'Repères qualité : sodium hors bornes refusé, saisie gardée');
await page.fill('[data-qr="sodium"]', ''); await page.locator('.g-envoi:visible').first().click(); await page.waitForTimeout(400);
const rq = appels.filter(a => a.action === 'params').pop().reperes;
ok(rq && rq.fibres_min === 25 && rq.sodium_max === 0 && await page.evaluate(() => seuilsQualite(S.data).fibres.max) === 25, 'Repères qualité : fibres 25 g enregistrées et appliquées');
delete DATA.reference.reperes;
await page.click('[data-rg="appli"]');
ok(await page.locator('#r-token').isHidden(), 'Réglages : connexion repliée');
await page.click('.rg-cnx summary');
ok((await page.getAttribute('#r-token', 'type')) === 'password', 'Réglages : code d accès masqué');
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
ok(await page.locator('.vue.on .jn-rt').count() >= 2 && /Matin/.test(await page.locator('.vue.on .jn-rt').first().textContent()), 'Journal : bandeau coloré par repas, dans l\'ordre de la journée');
ok(await page.locator('.jn-det .ligne').count() > 0, 'repas affichés après chargement');
{
  const tags = await page.locator('.jn-det .ia-tag').allTextContents(), sec = await page.locator('.jn-det .ia-tag.sec').allTextContents();
  const lignes = await page.locator('.jn-det .ligne').count();
  ok(sec.length > 0 && sec.every(t => t === 'Claude Haiku') && (tags.includes('Flash') || tags.length < lignes) && tags.every(t => t === 'Flash' || t === 'Claude Haiku'), 'Journal : étiquette de l IA (Flash en gris, Claude Haiku en orange, rien pour un ancien repas)');
  const coupe = await page.evaluate(() => [...document.querySelectorAll('.jn-det .ia-w')].every(e => getComputedStyle(e).whiteSpace === 'nowrap'));
  ok(coupe, 'Journal : le « · » reste collé à l étiquette');
}

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
ok(enr[0].ia === 'manuel', 'Refaire : enregistré avec ia = manuel');
await page.click('#a-nouveau');
if (!(await page.locator('#rac-tc').count())) await page.click('nav button[data-vue="ajout"]');
await page.click('#rac-tc'); await page.click('#rac-crc button[data-cr="tous"]');
await page.locator('[data-cp]').first().click(); await page.locator('[data-cp]').first().click();
ok(/2 unités/.test(await texte('#rac-valide')), 'composer : compteur d\'unités');
const barre = await page.locator('#rac-valide').boundingBox(), navH = await page.locator('nav').boundingBox();
ok(barre && navH && barre.y + barre.height <= navH.y + 1 && barre.y > navH.y - 120, 'composer : barre de validation collée au-dessus du menu');
await page.locator('.rac-l:not([hidden]) [data-fav]').nth(1).click(); await page.waitForTimeout(1200);
const fv = appels.filter(a => a.action === 'favoris').pop();
ok(await page.locator('.rac-l.fav').count() === 1 && /Mes favoris · 1/i.test(await texte('#rac-grille')) && fv && fv.favoris.length === 1, 'composer : ★ met en favori en tête de liste et l\'envoie au serveur');
await page.locator('.rac-l.fav [data-fav]').click(); await page.waitForTimeout(1200);
ok(await page.locator('.rac-l.fav').count() === 0 && appels.filter(a => a.action === 'favoris').pop().favoris.length === 0, 'composer : retoucher ★ retire le favori');
await page.fill('#rac-q', 'zzz'); await page.click('#rac-ferme'); await page.click('#rac-tc');
ok(await page.inputValue('#rac-q') === '' && await page.locator('#rac-vide').isHidden(), 'composer : recherche effacée en fermant puis rouvrant');
await page.fill('#rac-q', 'zzz'); await page.click('nav button[data-vue="jour"]'); await page.click('nav button[data-vue="ajout"]');
ok(await page.inputValue('#rac-q') === '', 'composer : recherche effacée en changeant d\'onglet');
await page.click('#rac-crc button[data-cr="tous"]');
await page.click('#rac-valide');
ok(await page.locator('.resu-al li').count() >= 2, 'composer : résultat construit sans IA');
await page.click('#a-nouveau');
ok(await page.locator('.histo .br-l').count() === 1 && /Brouillons non enregistrés · 1/.test(await texte('.histo')), 'brouillons : le repas non enregistré passe en ligne compacte');
const nEnr = appels.filter(a => a.action === 'enregistrer').length;
await page.click('[data-histo-ok="0"]'); await page.waitForTimeout(500);
ok(appels.filter(a => a.action === 'enregistrer').length === nEnr + 1 && await page.locator('.histo .br-l').count() === 0 && /enregistrées/.test(await texte('.histo')), 'brouillons : ✓ enregistre le brouillon et le retire de la liste');
await page.fill('#a-desc', 'test'); await page.click('#a-envoi'); await page.waitForTimeout(300);
ok(/indisponible/.test(await texte('.alerte')), 'message clair si l\'IA est indisponible');

console.log('Sans IA : saisie à la main et repas en attente');
ok(await page.locator('.att-ko #att-plus').count() === 1 && await page.locator('.att-ko #man-depuis').count() === 1, 'IA indisponible : analyser plus tard ou saisir à la main');
await page.click('#att-plus'); await page.waitForTimeout(200);
const att = await page.evaluate(() => JSON.parse(localStorage.getItem('suivi.attente') || '[]'));
ok(att.length === 1 && att[0].desc === 'test' && att[0].date && att[0].id, 'repas mis en attente sur l iPhone');
await page.click('nav button[data-vue="jour"]');
ok(/1 repas en attente/i.test(await texte('.att-z')), 'Jour : bandeau du repas en attente');
ia503 = false;
await page.click('#att-go'); await page.waitForTimeout(800);
const enrAtt = appels.filter(a => a.action === 'enregistrer').pop();
ok(enrAtt && enrAtt.id === att[0].id && enrAtt.date === att[0].date && /analysé/i.test(await texte('.att-z')) && (await page.evaluate(() => JSON.parse(localStorage.getItem('suivi.attente') || '[]').length)) === 0, 'IA revenue : analysé et enregistré au jour d origine, file vidée');
await page.click('#att-ok');
await page.click('nav button[data-vue="ajout"]');
if (await page.locator('#a-nouveau').count()) await page.click('#a-nouveau');
await page.click('#rac-tm');
await page.fill('[data-mf="0.nom"]', 'Poulet rôti'); await page.fill('[data-mf="0.quantite"]', '230 g'); await page.fill('[data-mf="0.kcal"]', '500');
await page.fill('[data-mf="0.prot"]', '58'); await page.fill('[data-mf="0.lip"]', '29'); await page.selectOption('[data-mf="0.famille"]', 'volaille');
ok(/500 kcal/.test(await texte('#man-tot')), 'saisie à la main : total en direct');
await page.click('#man-plus'); await page.click('#man-ok');
ok(/Aliment 2/.test(await texte('.alerte')), 'saisie à la main : aliment incomplet refusé');
await page.click('[data-mdel="1"]'); await page.click('#man-ok');
ok(/500 kcal/.test(await texte('#e-total')) && /Saisi à la main/.test(await texte('.resu')), 'saisie à la main : écran de résultat habituel');
ok((await page.locator('.resu .ia-tag').allTextContents()).join() === 'manuel' && !/Estimé par/.test(await texte('.resu')), 'saisie à la main : étiquette « manuel » sur la carte');
await page.click('#e-auj'); await page.waitForTimeout(500);
const enrMan = appels.filter(a => a.action === 'enregistrer').pop();
const alm = enrMan && enrMan.aliments && enrMan.aliments[0];
ok(alm && alm.famille === 'volaille' && alm.grammes === 230 && alm.purines === 345 && alm.purines_risque === 345 && enrMan.kcal === 500 && enrMan.ia === 'manuel', 'saisie à la main : purines calculées (230 g de volaille = 345 mg) et enregistrée');
ok(!appels.some(a => a.action === 'repas' && a.description === 'Poulet rôti'), 'saisie à la main : aucun appel à l IA');
secoursTest = true;
await page.click('#a-nouveau').catch(() => {});
if (!(await page.locator('#a-desc').count())) await page.click('nav button[data-vue="ajout"]');
await page.fill('#a-desc', 'poulet'); await page.click('#a-envoi'); await page.waitForTimeout(400);
ok(/modèle de secours \(Claude Haiku, payant\)/.test(await texte('.resu')) && /Pourquoi : Flash : 429 quota/.test(await texte('.resu')), 'analyse par un modèle de secours : signalée à l écran, avec la cause');
ok(/Estimé par Claude Haiku/.test(await texte('.resu .ia-l')) && await page.locator('.resu .ia-tag.sec').count() === 1, 'carte résultat : « Estimé par Claude Haiku » avant d enregistrer');
ok(JSON.stringify(appels.filter(a => a.action === 'repas').pop().ia_ordre) === JSON.stringify(['flash', 'lite', 'groq', 'haiku', 'gemma']), 'analyse : profil Défaut envoyé (Flash, Flash-Lite, Groq, Claude Haiku, Gemma)');
await page.click('#e-auj'); await page.waitForTimeout(500);
ok(appels.filter(a => a.action === 'enregistrer').pop().ia === 'claude', 'secours : enregistré avec ia = claude');
console.log('Profil IA');
await page.click('nav button[data-vue="ajout"]');
if (await page.locator('#a-nouveau').count()) await page.click('#a-nouveau');
ok(/Profil IA : Défaut/.test(await texte('#pia-t')) && await page.locator('[data-pia-s]').count() === 0, 'profil IA : accordéon fermé, « Défaut »');
await page.click('#pia-t'); await page.click('[data-pia-p="complexe"]');
ok(/Complexe/.test(await texte('#pia-t')) && await page.locator('.pia-l:not(.off)').count() === 1, 'profil IA : « Complexe » = Claude Sonnet seul');
await page.fill('#a-desc', 'lasagne'); await page.click('#a-envoi'); await page.waitForTimeout(400);
ok(JSON.stringify(appels.filter(a => a.action === 'repas').pop().ia_ordre) === '["sonnet"]', 'profil IA : Complexe envoyé');
await page.click('#a-nouveau').catch(() => {});
ok(/Complexe/.test(await texte('#pia-t')), 'profil IA : gardé tant qu on reste sur Ajouter');
await page.click('[data-pia-p="gratuits"]'); await page.click('[data-pia-b="0"]');
ok(/Sur mesure/.test(await texte('#pia-t')), 'profil IA : ordre changé → « Sur mesure »');
while (await page.locator('.pia-s.on').count()) await page.locator('.pia-s.on').first().click();
const nRepas = appels.filter(a => a.action === 'repas').length;
await page.fill('#a-desc', 'riz'); await page.click('#a-envoi'); await page.waitForTimeout(200);
ok(/aucune IA choisie/.test(await texte('#pia-t')) && appels.filter(a => a.action === 'repas').length === nRepas, 'profil IA : aucune IA → analyse bloquée');
await page.click('nav button[data-vue="jour"]'); await page.click('nav button[data-vue="ajout"]');
if (await page.locator('#a-nouveau').count()) await page.click('#a-nouveau');
ok(/Profil IA : Défaut/.test(await texte('#pia-t')), 'profil IA : revient à Défaut après un changement d écran');
// invité autorisé à Haiku seulement
{ const pH = await (await navigateur.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 } })).newPage();
  pH.on('pageerror', e => erreurs.push(e.message));
  const DH = JSON.parse(JSON.stringify(DATA)); DH.profil.role = 'utilisateur'; DH.profil.ia_payante = true; DH.profil.ia_haiku = true; DH.profil.ia_sonnet = false;
  await pH.route('https://app.test/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: HTML }));
  await pH.route('https://api.test/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(DH) }));
  await pH.addInitScript(() => localStorage.setItem('suivi.config', JSON.stringify({ api: 'https://api.test/x', token: 't' })));
  await pH.goto('https://app.test/index.html'); await pH.waitForSelector('nav button');
  await pH.click('nav button[data-vue="ajout"]'); await pH.click('#pia-t'); await pH.waitForTimeout(100);
  ok(await pH.locator('.pia-l.lock').count() === 1 && await pH.locator('[data-pia-p="complexe"]').count() === 0 && /coupé par l’administrateur/.test(await pH.locator('.pia').innerText()), 'invité niveau Haiku : Sonnet verrouillé, pas de profil Complexe');
  ok(await pH.evaluate(() => piaListe().join()) === 'flash,lite,groq,haiku,gemma', 'invité niveau Haiku : Défaut garde Haiku en secours');
  await pH.close(); }
secoursTest = false;

console.log('Pesées');
await page.click('nav button[data-vue="corps"]'); await page.click('[data-ko="pesee"]');
await page.click('#pes-hist summary');
ok(/Toutes mes pesées \(5\)/.test(await texte('#pes-hist')) && (await page.locator('#pes-hist .pes-l .k').count()) === 5 && /100,0 kg/.test(await texte('#pes-hist .pes-l')), 'Corps : historique dépliable de toutes les pesées, la plus récente en haut');
await page.click('nav button[data-vue="courbes"]'); await page.click('[data-cong="poids"]');
ok(await page.locator('.vue.on .courbe-tabs').count() === 0 && /Variation par semaine/i.test(await texte('.vue.on')), 'Courbes > Poids : courbe et variation par semaine empilées, sans sous-onglets');
ok(await page.locator('.vue.on svg[aria-label="Variation hebdomadaire du poids"] rect[stroke-dasharray]').count() <= 1, 'Régulier ? : au plus une semaine « en cours »');

console.log('Ergonomie');
ok(await page.locator('nav button').count() === 5 && await page.locator('nav button[data-vue="coach"]').count() === 0, 'menu du bas à 5 onglets');
ok(await page.locator('.bandeau.compact').count() === 1 && !/métabolisme/.test(await texte('.bandeau')), 'en-tête compact hors écran Jour');
await page.click('#b-coach');
ok(await page.locator('.vue.on .coach-sug button').count() === 4 && /kcal restantes|dépassé ma cible/.test(await texte('.vue.on .coach-sug')), 'Coach : ouvert depuis l\'en-tête, 4 questions toutes prêtes');
{ const qs = async () => (await page.locator('.vue.on .coach-sug button').allInnerTexts()).map(x => x.replace(/\s+/g, ' '));
  const avant = await qs();
  ok(avant.length === 4 && new Set(avant).size === 4 && /kcal restantes|dépassé ma cible/.test(avant[0]), 'Coach : 4 questions toutes prêtes, toutes différentes');
  const posee = avant[1];
  await page.locator('.vue.on .coach-sug button').nth(1).click(); await page.waitForSelector('.vue.on .coach-sug button');
  const apres = await qs();
  ok(apres.length === 4 && !apres.includes(posee) && new Set(apres).size === 4 && [0, 2, 3].every(i => apres.includes(avant[i])), 'Coach : la question touchée disparaît, une nouvelle prend sa place, les autres restent');
  for (let k = 0; k < 6; k++) { await page.locator('.vue.on .coach-sug button').first().click(); await page.waitForSelector('.vue.on .coach-sug button'); }
  const fin = await qs();
  ok(fin.length === 4 && new Set(fin).size === 4, 'Coach : toujours 4 questions différentes, même quand tout a été posé');
  await page.click('#c-vider');
  ok(JSON.stringify(await qs()) === JSON.stringify(avant), 'Coach : « Vider » remet les questions de départ'); }
{ await page.locator('.vue.on .coach-sug button').first().click(); await page.waitForSelector('.vue.on .coach-sug button');
  ok(await page.locator('.vue.on .bulle.moi').count() === 1 && /suivi\.chat/.test(await page.evaluate(() => Object.keys(localStorage).join(' '))), 'Coach : une question posée, conversation visible et mémorisée');
  await page.click('nav button[data-vue="journal"]'); await page.click('#b-coach');
  ok(await page.locator('.vue.on .bulle').count() === 0 && await page.evaluate(() => !Object.keys(localStorage).some(k => /chat/.test(k) && localStorage.getItem(k) && localStorage.getItem(k) !== '[]')), 'Coach : quitter par la barre du bas efface la conversation (écran et mémoire)');
  await page.locator('.vue.on .coach-sug button').first().click(); await page.waitForSelector('.vue.on .coach-sug button');
  await page.click('#b-reglages'); await page.click('#b-reglages');
  ok(await page.locator('.vue.on .bulle.moi').count() === 1, 'Coach : ouvrir puis fermer les Réglages garde la conversation');
  await page.click('#c-vider'); }
await page.click('nav button[data-vue="jour"]');
ok(/métabolisme/.test(await texte('.bandeau')) && /reste \d/.test(await texte('.vue.on .repas-liste')), 'Jour : en-tête complet, « reste » par repas');
await page.click('#b-pesee');
ok(await page.locator('.vue.on #p-val').count() === 1, 'toucher le poids ouvre la pesée');
await page.click('nav button[data-vue="journal"]');
await page.fill('#jn-q', 'poulet'); await page.waitForTimeout(300);
ok(await page.locator('#jn-semaines').isHidden() && /résultat/.test(await texte('#jn-res')) && await page.locator('#jn-res .jn-rl').count() > 0, 'Journal : recherche par aliment');
const nJ2 = appels.filter(a => a.action === 'journal').length;
// selon le jour de la semaine, la semaine la plus ancienne a déjà été chargée plus haut : plus rien à chercher
if (await page.locator('#jn-loin').count()) {
  await page.click('#jn-loin'); await page.waitForTimeout(600);
  ok(appels.filter(a => a.action === 'journal').length === nJ2 + 1, 'Journal : chercher plus loin charge 8 semaines');
} else {
  const tout = await page.evaluate(() => { const j = S.data.journal.map(r => r.date).sort()[0], p = S.data.jours.map(x => x.date).sort()[0]; return j <= p; });
  ok(tout, 'Journal : tout l historique déjà chargé, pas de bouton « plus loin »');
}
await page.fill('#jn-q', ''); await page.dispatchEvent('#jn-q', 'input');
ok(await page.locator('[data-jf]').count() === 5 && /Au-dessus de la cible/.test(await texte('.jn-f')), 'Journal : 5 filtres (purines, alcool, saturés, sodium, au-dessus de la cible)');
{ // deux jours terminés forcés au-dessus de la cible (2 100) : +380 et +550 ; le jour en cours ne compte jamais
  const j1 = DATA.jours.find(j => j.date === jour(-3)), j2 = DATA.jours.find(j => j.date === jour(-5)), j0 = DATA.jours.find(j => j.date === jour(0));
  const sauve = [j1, j2, j0].map(j => j && j.kcal);
  j1.kcal = 2480; j2.kcal = 2650; if (j0) j0.kcal = 3000;
  await page.reload(); await page.waitForSelector('nav button'); await page.click('nav button[data-vue="journal"]');
  await page.click('[data-jf="cib"]'); await page.waitForTimeout(100);
  const att = DATA.jours.filter(j => j.date < jour(0) && j.kcal > j.cible);
  ok(att.length === 2 && await page.locator('#jn-res .jn-rl').count() === 2 && /2 jours sur \d+ au-dessus/.test(await texte('#jn-res .jn-res-t')), 'Journal : au-dessus de la cible = un jour par ligne, jour en cours exclu');
  ok(/2.480 \/ 2.100 kcal\s*\+380/.test(await texte('#jn-res .jn-rl')), 'Journal : écart « +380 » affiché, le plus récent en premier');
  await page.click('[data-jtri="haut"]'); await page.waitForTimeout(100);
  ok(/\+550/.test(await texte('#jn-res .jn-rl')), 'Journal : tri « Plus élevés » met le plus gros dépassement en premier');
  await page.fill('#jn-q', 'zzzintrouvable'); await page.dispatchEvent('#jn-q', 'input');
  ok(/Aucun jour au-dessus de ta cible avec ce plat/.test(await texte('#jn-res')), 'Journal : texte + au-dessus de la cible, aucun jour pour un plat inconnu');
  await page.fill('#jn-q', ''); await page.dispatchEvent('#jn-q', 'input');
  const dx = await page.evaluate(() => { const x = document.getElementById('defile'); return x.scrollWidth - x.clientWidth; });
  ok(dx <= 0, 'Journal : au-dessus de la cible, pas de débordement horizontal');
  await page.click('[data-jf="cib"]');
  ok(await page.locator('#jn-semaines').isVisible(), 'Journal : filtre au-dessus de la cible retiré, semaines de retour');
  j1.kcal = sauve[0]; j2.kcal = sauve[1]; if (j0) j0.kcal = sauve[2];
  await page.reload(); await page.waitForSelector('nav button'); await page.click('nav button[data-vue="journal"]'); }
await page.click('[data-jf="alc"]');
ok(await page.locator('#jn-res .jn-al').count() > 0 && (await page.locator('#jn-res .jn-al .q').allInnerTexts()).every(t => /^Vin rouge/.test(t)) && /verre/.test(await texte('#jn-res')), 'Journal : filtre alcool = la boisson seule, pas le repas');
await page.click('[data-jf="pur"]');
const purs = await page.locator('#jn-res .jn-al .q').allInnerTexts();
ok(purs.length > 0 && purs.every(t => /^Blanc de poulet/.test(t)) && /225 mg/.test(await texte('#jn-res')), 'Journal : purines élevées = l aliment seul (poulet), pas le riz');
await page.click('[data-jtri="haut"]'); await page.waitForTimeout(100);
ok(await page.locator('[data-jtri="haut"].on').count() === 1 && await page.locator('#jn-res .jn-al').count() === purs.length, 'Journal : tri « Plus élevés »');
await page.click('[data-jf="na"]');
ok(/0 aliment/.test(await texte('#jn-res')), 'Journal : sodium élevé, rien au-dessus de 600 mg');
await page.click('[data-jf="na"]');
ok(await page.locator('#jn-semaines').isVisible(), 'Journal : filtre retiré, semaines de retour');
ok(/30 jours · 13 repas · 1 payant ≈ 1 ct/.test(await texte('#sia-t')) && await page.locator('.sia-b').count() === 0, 'Journal : graphique des IA replié, résumé 30 jours');
await page.click('#sia-t');
ok(await page.locator('.sia-b').count() === 3 && /Gemini Flash/.test(await texte('.sia-b')) && await page.locator('.sia-b.pay').count() === 1, 'Journal : une barre par IA, Claude Haiku en payant');
await page.click('[data-siab="claude"]');
ok(/Claude Haiku : 1 repas sur 13/.test(await texte('.sia-d')), 'Journal : toucher une barre donne le détail');
await page.click('[data-siap="7"]');
ok(/7 jours/.test(await texte('#sia-t')) && /sans l’info/.test(await texte('.sia-p')) === false, 'Journal : période 7 jours');
await page.click('[data-siap="0"]');
ok(/2 sans l’info/.test(await texte('.sia-p')), 'Journal : repas anciens sans IA signalés');
await page.click('#sia-t');

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
ok(await pi.locator('#w-ici').count() === 0 && /appli installée/.test(await pi.locator('.ins').innerText()), 'iPhone hors appli installée : pas de « Continuer ici », avertissement');
// filet : compte créé quand même hors de l'appli installée (iPhone) → copier l'accès pour l'appli
await pi.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'https://app.test' });
await pi.evaluate(() => { S.ins = nouvelleIns({ code: 'ABCD-EFGH', api: 'https://api.test/x' }); entrer({ token: 'abcdefghijkmnpqrstuvwxyz', prenom: 'Hugo' }); });
await pi.waitForSelector('#a-copier'); await pi.click('#a-copier'); await pi.waitForTimeout(100);
const accesCopie = await pi.evaluate(() => navigator.clipboard.readText());
ok(/#acces=abcdefghijkmnpqrstuvwxyz&api=/.test(accesCopie) && /Hugo/.test(await pi.locator('.ins h1').innerText()), 'compte créé hors appli : accès copié pour l appli installée');
await pi.close();
// appli installée (écran d'accueil) : coller l'accès copié → connecté
const pInst = await (await navigateur.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 } })).newPage();
pInst.on('pageerror', e => erreurs.push(e.message));
await pInst.addInitScript(() => { Object.defineProperty(navigator, 'standalone', { get: () => true }); });
await pInst.route('https://app.test/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: HTML }));
await pInst.route('https://api.test/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(DATA) }));
await pInst.goto('https://app.test/index.html'); await pInst.waitForSelector('#i-inv'); await pInst.click('#i-inv');
await pInst.fill('#i-code', accesCopie); await pInst.click('#i-suite'); await pInst.waitForSelector('nav button');
ok(JSON.parse(await pInst.evaluate(() => localStorage.getItem('suivi.config'))).token === 'abcdefghijkmnpqrstuvwxyz', 'appli installée : accès collé, connecté sans nouveau lien');
await pInst.close();
// Android ou ordinateur : « Continuer ici » reste (la mémoire est partagée)
const pd = await (await navigateur.newContext({ ...devices['Pixel 7'] })).newPage();
await pd.route('https://app.test/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: HTML }));
await pd.goto('https://app.test/index.html#invite=ABCD-EFGH&api=' + encodeURIComponent('https://api.test/x')); await pd.waitForSelector('#w-copier');
ok(await pd.locator('#w-ici').count() === 1, 'Android : « Continuer ici sans installer » toujours proposé');
await pd.close();
// inscription normale dans l'appli installée (iPhone)
const pj = await (await navigateur.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 } })).newPage();
pj.on('pageerror', e => erreurs.push(e.message));
await pj.addInitScript(() => { Object.defineProperty(navigator, 'standalone', { get: () => true }); });
let dejaServi = false;
await pj.route('https://app.test/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: HTML }));
await pj.route('https://api.test/**', async r => { const q = JSON.parse(r.request().postData() || '{}'); appels.push(q);
  if (q.action === 'invite' && dejaServi) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, erreur: 'Ce code a déjà servi. Demande un nouveau lien.' }) });
  if (q.action === 'invite') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(q.profil ? { ok: true, token: 'TOKNEUF' } : { ok: true, besoin_profil: true, prenom: 'Hugo' }) });
  return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(DATA) }); });
await pj.goto('https://app.test/index.html'); await pj.waitForSelector('#i-inv'); await pj.click('#i-inv');
dejaServi = true; await pj.fill('#i-code', 'https://app.test/index.html#invite=ABCD-EFGH&api=' + encodeURIComponent('https://api.test/x')); await pj.click('#i-suite'); await pj.waitForSelector('.alerte');
ok(/existe sûrement déjà/.test(await pj.locator('.alerte').innerText()) && /reconnexion/.test(await pj.locator('.alerte').innerText()), 'code déjà servi : message qui explique quoi faire');
dejaServi = false;
const pi2 = pj;
await pi2.click('#i-suite'); await pi2.waitForSelector('#i-creer');
ok((await pi2.inputValue('#i-prenom')) === 'Hugo', 'code vérifié : formulaire de profil prérempli');
await pi2.click('#i-creer'); await pi2.waitForTimeout(100);
ok(/sexe|homme/i.test(await pi2.locator('.alerte').innerText()), 'profil incomplet : message clair');
await pi2.click('[data-isx="H"]'); await pi2.fill('[data-if="age"]', '22'); await pi2.fill('[data-if="taille"]', '178'); await pi2.fill('[data-if="poids"]', '68,5'); await pi2.click('[data-iob="prise"]');
await pi2.click('#i-creer'); await pi2.waitForSelector('nav button');
const iv = appels.filter(a => a.action === 'invite').pop();
ok(iv.profil && iv.profil.objectif === 'prise' && iv.profil.ecart_kcal === 300 && iv.profil.poids === 68.5, 'profil envoyé avec objectif et écart');
ok(JSON.parse(await pi2.evaluate(() => localStorage.getItem('suivi.config'))).token === 'TOKNEUF' && (await pi2.evaluate(() => location.hash)) === '', 'compte créé : code enregistré, lien effacé');
await pi2.close();

console.log('Photos');
await page.click('nav button[data-vue="corps"]'); await page.locator('[data-ko]').filter({ hasText: 'Photos' }).first().click();
ok(await page.locator('#k-ph-import').count() === 1, 'Photos : bouton « depuis la photothèque »');
await page.setInputFiles('#k-ph-fichier', { name: 'p.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAIAAgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwCOiiivmj7A/9k=', 'base64') });
await page.waitForSelector('.cam-imp', { timeout: 5000 });
ok(await page.inputValue('#cam-date') === jour(0) && /inconnue/.test(await texte('.cam-imp')), 'Photos : import sans date dans la photo → date du jour à vérifier');
await page.click('[data-cimp="profil"]'); await page.fill('#cam-date', jour(-3)); await page.dispatchEvent('#cam-date', 'change'); await page.click('#cam-retourner'); await page.waitForTimeout(200);
ok(await page.locator('#cam-comparer').isDisabled() && /Pas de photo avant/.test(await texte('#cam-comparer')), 'Photos : « Comparer » grisé sans photo précédente');
await page.click('#cam-recadrer'); await page.waitForTimeout(200);
ok(await page.locator('#rc-cadre').count() === 1 && /pas de photo précédente/.test(await texte('#cam-hote .scan-haut')), 'Photos : recadrage d une photo importée');
await page.locator('#rc-z').fill('1.5'); await page.click('#rc-ok'); await page.waitForTimeout(200);
ok(await page.locator('#rc-cadre').count() === 0 && await page.locator('#cam-garder').count() === 1, 'Photos : recadrage validé, retour à la revue');
await page.click('#cam-garder'); await page.waitForTimeout(500);
const ph = appels.filter(a => a.action === 'photo').pop();
ok(ph && ph.type === 'profil' && ph.date === jour(-3) && ph.photo && /du \d\d\/\d\d enregistrée/.test(await texte('.vue.on .bien')), 'Photos : importée en profil, à la date choisie');

const nPh = appels.filter(a => a.action === 'photo').length;
await page.setInputFiles('#k-ph-fichier', { name: 'p2.jpg', mimeType: 'image/jpeg', buffer: (await page.evaluate(() => null), Buffer.from(appels.filter(a => a.action === 'photo').pop().photo, 'base64')) });
await page.waitForSelector('.cam-imp', { timeout: 5000 }); await page.click('#cam-fermer'); await page.waitForTimeout(200);
ok(await page.locator('#cam-hote').count() === 0 && appels.filter(a => a.action === 'photo').length === nPh, 'Photos : « Annuler » ferme sans rien enregistrer');

// gestion d'une photo : vignettes, volet, remplacer (photothèque), changer la date, supprimer
const imgPh = Buffer.from(appels.filter(a => a.action === 'photo').pop().photo, 'base64');
await page.setInputFiles('#k-ph-fichier', { name: 'p3.jpg', mimeType: 'image/jpeg', buffer: imgPh });
await page.waitForSelector('.cam-imp', { timeout: 5000 }); await page.click('[data-cimp="profil"]'); await page.fill('#cam-date', jour(-1)); await page.dispatchEvent('#cam-date', 'change');
await page.click('#cam-garder'); await page.waitForTimeout(500);
ok(await page.locator('#k-vg [data-vg]').count() === 2 && /\(2\)/.test(await texte('.phv-t')), 'Photos : vignettes du type affiché');
await page.click(`#k-vg [data-vg="${jour(-1)}"]`); await page.waitForSelector('#ph-hote');
ok(await page.locator('#ph-hote [data-pa]').count() === 5 && /contour de la photo du/.test(await texte('#ph-hote')), 'Photos : volet avec les 5 actions');
const [choix] = await Promise.all([page.waitForEvent('filechooser'), page.click('[data-pa="biblio"]')]); await choix.setFiles({ name: 'p4.jpg', mimeType: 'image/jpeg', buffer: imgPh });
await page.waitForSelector('#cam-garder', { timeout: 5000 });
ok(await page.locator('.cam-imp').count() === 0 && /Remplace la photo de profil/.test(await texte('#cam-hote .scan-haut')) && /Comparer au/.test(await texte('#cam-comparer')), 'Photos : remplacement depuis la photothèque, date gardée, comparaison à la précédente');
await page.click('#cam-garder'); await page.waitForTimeout(500);
const rp = appels.filter(a => a.action === 'photo').pop();
ok(rp.date === jour(-1) && rp.type === 'profil' && /remplacée/.test(await texte('.vue.on .bien')), 'Photos : remplacée à la même date');
await page.click(`#k-vg [data-vg="${jour(-1)}"]`); await page.click('[data-pa="date"]'); await page.waitForSelector('#ph-nd');
await page.fill('#ph-nd', jour(-3)); ok(/sera remplacée/.test(await texte('#ph-nd-info')), 'Photos : changer la date prévient si le jour est déjà pris');
await page.fill('#ph-nd', jour(-2)); await page.click('[data-mod="oui"]'); await page.waitForTimeout(500);
const gd = appels.filter(a => a.action === 'photo_gerer').pop();
ok(gd && gd.op === 'date' && gd.nouvelle_date === jour(-2) && await page.locator(`#k-vg [data-vg="${jour(-2)}"]`).count() === 1, 'Photos : date changée');
await page.click(`#k-vg [data-vg="${jour(-2)}"]`); await page.click('[data-pa="suppr"]'); await page.waitForSelector('.modale');
await page.click('[data-mod="oui"]'); await page.waitForTimeout(500);
ok(appels.filter(a => a.action === 'photo_gerer').pop().op === 'suppr' && await page.locator('#k-vg [data-vg]').count() === 1 && /supprimée/.test(await texte('.vue.on .bien')), 'Photos : suppression confirmée');

// évolution animée (au moins 2 photos du type affiché)
await page.setInputFiles('#k-ph-fichier', { name: 'p5.jpg', mimeType: 'image/jpeg', buffer: imgPh });
await page.waitForSelector('.cam-imp', { timeout: 5000 }); await page.click('[data-cimp="profil"]'); await page.fill('#cam-date', jour(-6)); await page.dispatchEvent('#cam-date', 'change');
await page.click('#cam-garder'); await page.waitForTimeout(500);
ok(/2 photos/.test(await texte('#k-evo')), 'Photos : bouton « Voir l’évolution »');
await page.click('#k-evo'); await page.waitForFunction(() => !document.getElementById('evo-msg'), null, { timeout: 5000 });
await page.waitForTimeout(400);
ok(await page.locator('#evo-scene img[src]').count() === 2 && await page.evaluate(() => S.evo.lecture && S.evo.t >= 0), 'Photos : évolution chargée, lecture automatique');
await page.locator('#evo-t').fill('0.5'); await page.waitForTimeout(100);
ok(await page.evaluate(() => !S.evo.lecture && document.querySelectorAll('#evo-scene img')[1].style.opacity === '0.5'), 'Photos : curseur de temps en fondu continu');
await page.click('#evo-fermer'); ok(await page.locator('#evo-hote').count() === 0, 'Photos : évolution fermée');
await page.click(`#k-pdt [data-pdt="${jour(-6)}"]`); await page.waitForTimeout(150);
ok(await page.locator('#k-une').count() === 1 && await page.locator('#k-cmp').count() === 0, 'Photos : une date → une seule photo entière');
await page.click('#k-pdt [data-pdt=""]'); await page.waitForTimeout(150); ok(await page.locator('#k-cmp').count() === 1, 'Photos : retour avant / après');
await page.click('nav button[data-vue="jour"]'); await page.click('nav button[data-vue="corps"]'); await page.waitForTimeout(150);
ok(await page.locator('#k-une').count() === 1 && /Profil/.test(await texte('#k-cmp-type .on')), 'Photos : au retour sur la page, dernière photo seule (de face, sinon de profil s il n y a pas de face)');

console.log('Coach : photo d\'un menu');
await page.click('#b-coach');
ok(await page.locator('#c-cam').count() === 1 && await page.locator('#c-gal').count() === 1, 'Coach : boutons appareil photo et galerie');
await page.setInputFiles('#c-galerie', { name: 'menu.jpg', mimeType: 'image/jpeg', buffer: imgPh });
await page.waitForSelector('table.mn');
const aMenu = appels.filter(a => a.action === 'menu').pop();
ok(aMenu && aMenu.photo.length > 100 && aMenu.mime === 'image/jpeg' && Array.isArray(aMenu.ia_ordre) && aMenu.ia_ordre.length > 0, 'menu : photo, type et ordre des IA envoyés');
ok(await page.locator('table.mn tbody tr').count() === 3 && /Burger du chef/.test(await texte('table.mn tbody tr')) && /1\D?020/.test(await texte('table.mn tbody tr')), 'menu : un plat par ligne avec ses kcal');
ok(/confiance faible/.test(await texte('table.mn')) && /Plat du jour \(ligne coupée\)/.test(await texte('.mn-ill')) && /Flash/.test(await texte('.mn-b')), 'menu : confiance faible, plat non lu et IA affichés');
await page.click('[data-mtri$=":kcal"]');
ok(/Tarte aux pommes/.test(await texte('table.mn tbody tr')), 'menu : tri par moins de kcal');
await page.click('[data-mtri$=":prot"]');
ok(/Burger du chef/.test(await texte('table.mn tbody tr')), 'menu : tri par plus de protéines');
ok(await page.evaluate(() => document.getElementById('defile').scrollWidth - document.getElementById('defile').clientWidth) <= 0, 'menu : pas de débordement horizontal');
ok((await page.evaluate(() => localStorage.getItem('suivi.chat'))).includes('Burger du chef'), 'menu : gardé dans la conversation');
await page.click('[data-mplat$=":1"]');
ok(await page.locator('.vue.on #e-auj').count() === 1 && /Salade chèvre chaud/.test(await texte('.vue.on .resu')) && /640/.test(await texte('#e-total')), 'menu : « + » ouvre Ajouter avec le plat choisi');
await page.click('#b-coach');
await page.click('[data-mplat$=":2"]');
ok(/Tarte aux pommes/.test(await texte('.vue.on .resu')) && /1\D?060/.test(await texte('#e-total')), 'menu : un second plat s\'ajoute au même repas');
const avant = appels.filter(a => a.action === 'enregistrer').length;
await page.click('#e-auj');
await page.waitForTimeout(300);
const enrMenu = appels.filter(a => a.action === 'enregistrer').slice(avant).pop();
ok(enrMenu && enrMenu.kcal === 1060 && /Salade chèvre chaud/.test(enrMenu.detail) && /Tarte aux pommes/.test(enrMenu.detail) && enrMenu.ia === 'flash', 'menu : enregistrement habituel (kcal cumulées, IA)');
await page.click('#b-coach');
await page.fill('#c-q', 'Je prends quoi ?'); await page.click('#c-envoi');
await page.waitForFunction(() => /prends la salade/.test(document.body.innerText));
const hist = appels.filter(a => a.action === 'conseil').pop().historique;
ok(hist.some(m => /Menu analysé : 3 plats lus/.test(m.texte)) && hist.every(m => m.menu === undefined && Object.keys(m).length === 2), 'Coach : envoi d\'une question, historique en texte seul');
menuKO = true;
await page.setInputFiles('#c-photo', { name: 'menu2.jpg', mimeType: 'image/jpeg', buffer: imgPh });
await page.waitForFunction(() => /trop flou/.test(document.body.innerText));
ok(await page.locator('#c-envoi:not([disabled])').count() === 1, 'menu : erreur affichée dans le fil, Coach de nouveau disponible');
menuKO = false;

console.log('Scan de plusieurs produits d\'affilée');
{ const lot = () => page.evaluate(() => S.ajout.scan.lot.length);
  const scanne = c => page.evaluate(x => onCodeScanne(x), c);
  await page.click('nav button[data-vue="ajout"]');
  await page.evaluate(() => { scanEnCours = true; S.ajout.resultat = null; S.ajout.ajoutEnCours = false; S.ajout.confirm = null; rendre(); }); // scanEnCours : pas de vraie caméra en test
  await page.click('#sc-ouvre');
  ok(await page.locator('.scan-overlay #scan-lot').count() === 1 && await page.locator('#scan-fin').isDisabled() && /Aucun produit/.test(await texte('#scan-lot')), 'scan à la chaîne : caméra ouverte, panier vide, « Terminer » désactivé');
  await scanne('111'); await scanne('222');
  ok(await lot() === 2 && /2 produits scannés/.test(await texte('#scan-lot')) && /330 kcal au total/.test(await texte('#scan-lot')) && /Terminer · 2 produits/.test(await texte('#scan-fin')) && /Annuler/.test(await texte('#scan-fermer')),'scan à la chaîne : 2 produits au panier (portion 125 g, sinon 100 g), total 330 kcal');
  ok(/Ajouté : Pain complet · 100 g · 250 kcal/.test(await texte('#scan-toast')) && await page.locator('.scan-overlay').count() === 1, 'scan à la chaîne : bandeau « Ajouté », la caméra reste ouverte');
  await scanne('111');
  ok(await lot() === 2, 'scan à la chaîne : le même code toujours en vue n\'est pas ajouté deux fois');
  await scanne('999');
  ok(await lot() === 2 && /introuvable/.test(await texte('#scan-toast')) && await page.locator('.scan-overlay').count() === 1, 'scan à la chaîne : produit introuvable, message, on continue');
  await page.click('#scan-fermer');
  ok(await page.locator('#modale-hote').count() === 1 && /Abandonner les 2 produits/.test(await texte('#modale-hote')), 'scan à la chaîne : « Annuler » demande confirmation quand le panier n\'est pas vide');
  await page.click('#modale-hote [data-mod="non"]');
  ok(await lot() === 2 && await page.locator('.scan-overlay').count() === 1, 'scan à la chaîne : « Continuer » garde le panier');
  await page.click('#scan-fin'); await page.waitForSelector('.resu .al-nom');
  const noms = await page.locator('.resu .al-nom').allInnerTexts();
  ok(await page.locator('.scan-overlay').count() === 0 && noms.length === 2 && /Yaourt nature Danone/.test(noms[0]) && /Pain complet/.test(noms[1]), 'scan à la chaîne : « Terminer » ouvre un repas avec un aliment par produit');
  ok(/330 kcal/.test(await texte('#e-total')) && /2 produits scannés/.test(await texte('.resu .note')) && /P 14|Protéines\s*14/.test(await texte('#e-plg')), 'scan à la chaîne : total du repas et macros calculés');
  // mode « Ajouter un aliment » : les produits scannés se greffent sur le repas existant
  await page.click('#e-ajout-al'); await page.evaluate(() => { scanEnCours = true; }); await page.click('#sc-ouvre');
  await scanne('333');
  await page.click('#scan-fin'); await page.waitForSelector('.resu .al-nom');
  ok(await page.locator('.resu .al-nom').count() === 3 && /450 kcal/.test(await texte('#e-total')), 'scan à la chaîne : ajout d\'un produit scanné à un repas existant');
  await page.evaluate(() => { S.ajout.resultat = null; S.ajout.ajoutEnCours = false; S.ajout.confirm = null; S.ajout.histo = []; rendre(); });
  await page.click('nav button[data-vue="jour"]'); }

console.log('Corps : IMC');
{ // 180 cm, pesées de 102 à 100 kg, objectif 90 kg : IMC 31,5 → 30,9 → 27,8
  const vaMesures = async () => { await page.click('nav button[data-vue="corps"]'); await page.click('.vue.on [data-ko="mesures"]'); await page.waitForTimeout(150); };
  const srcs = () => page.locator('.vue.on .imc-c img').evaluateAll(l => l.map(i => i.getAttribute('src')));
  await vaMesures();
  ok(await page.locator('.vue.on .imc').count() === 1 && (await texte('.vue.on .imc-v')) === '30,9' && /Obésité modérée/.test(await texte('.vue.on .imc-z')), 'IMC : valeur actuelle 30,9 et zone « Obésité modérée »');
  const cartes = (await page.locator('.vue.on .imc-c').allInnerTexts()).map(t => t.replace(/\s+/g, ' '));
  ok(cartes.length === 3 && /Début 102 kg IMC 31,5/.test(cartes[0]) && /Maintenant 100 kg IMC 30,9/.test(cartes[1]) && /Objectif 90 kg IMC 27,8/.test(cartes[2]), 'IMC : cartes début, maintenant, objectif (kg et IMC)');
  ok(JSON.stringify(await srcs()) === JSON.stringify(['img/imc/h-30.webp', 'img/imc/h-30.webp', 'img/imc/h-27.webp']), 'IMC : silhouette d\'homme du palier le plus proche (30, 30, 27)');
  await page.waitForFunction(() => [...document.querySelectorAll('.vue.on .imc-c img')].every(i => i.complete));
  ok(await page.locator('.vue.on .imc-c img').evaluateAll(l => l.every(i => i.naturalWidth > 200)), 'IMC : les images du dépôt se chargent');
  ok(await page.locator('.vue.on .imc-j .pos span').count() === 3 && /objectif 27,8/.test(await page.locator('.vue.on .imc svg').innerHTML()), 'IMC : jauge avec 3 repères et courbe avec la ligne d\'objectif');
  ok(await page.locator('.vue.on .imc + section h2').first().innerText() === 'Mensurations', 'IMC : placé au-dessus des mensurations');
  DATA.profil.sexe = 'F'; await page.reload(); await page.waitForSelector('nav button'); await vaMesures();
  ok((await srcs()).every(s => /^img\/imc\/f-/.test(s)), 'IMC : silhouettes de femme pour un compte « F »');
  DATA.profil.sexe = 'H'; DATA.profil.taille = 0; await page.reload(); await page.waitForSelector('nav button'); await vaMesures();
  ok(await page.locator('.vue.on .imc').count() === 0 && /Mensurations/.test(await texte('.vue.on')), 'IMC : rien sans taille dans le profil');
  DATA.profil.taille = 180; await page.reload(); await page.waitForSelector('nav button'); await vaMesures();
  const dx = await page.evaluate(() => { const x = document.getElementById('defile'); return x.scrollWidth - x.clientWidth; });
  ok(dx <= 0, 'IMC : pas de débordement horizontal');
  await page.click('.vue.on [data-ko="pesee"]'); await page.click('nav button[data-vue="jour"]'); }

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
