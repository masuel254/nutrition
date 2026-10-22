# Tests

Règle : rien n'est « fini » tant que tout n'est pas vert. Toute fonction nouvelle ou corrigée a son test.

## 1. Appli : `tests/e2e.mjs` (commité)

- Ouvre `index.html` dans Chromium au format iPhone (390 × 844), intercepte le webhook n8n (`page.route`)
  et répond avec des **données fictives générées dans le fichier** (aucune donnée réelle : dépôt public).
- 155 vérifications au 08/10/2026 (v66) : Jour, Ajouter, Courbes, Corps (pesées, pas, photos, évolution),
  Journal, Coach, Réglages (objectif, plancher, repères qualité, administration des IA payantes, invitations),
  inscription par lien, mises à jour, absence d'erreur JS, pas de débordement horizontal, champs en 16 px.
- Lancement : `node tests/e2e.mjs` (ou `npm test`, qui vérifie aussi la syntaxe). Code de sortie 0 si « Tout est vert. ».
- Pour ajouter un test : suivre le modèle existant (`ok(condition, 'libellé')`), enrichir l'objet `DATA` ou la
  réponse simulée de l'action concernée, ne jamais dépendre de la date réelle (utiliser `jour(n)`).
- Les captures d'écran de contrôle (maquettes, vérifications visuelles) se font avec Playwright dans un dossier
  temporaire, jamais commitées.

## 2. Syntaxe : `tools/check_html.mjs`, `tools/check_workflow.mjs`

- `check_html.mjs` : `node --check` sur chaque `<script>` inline de `index.html` et sur `sw.js`, affiche les deux versions.
- `check_workflow.mjs` : JSON, noms de nœuds uniques, connexions valides, syntaxe des 126 nœuds Code
  (chacun enveloppé dans `async function f(){…}` comme dans n8n).

## 3. Workflow : `n8n/tests/` (local, non commité)

Les nœuds Code sont exécutés hors n8n avec des `$`, `$input`, `$getWorkflowStaticData` simulés.
Ces tests lisent `n8n/Agent_Nutrition.json` (ou le chemin passé en argument). `node n8n/run_tests.mjs` lance tout.

| Fichier | Ce qu'il couvre |
|---|---|
| `t_ia_secours.js` | Routeur IA : profils Défaut, Gratuits, Claude d'abord, Complexe (Sonnet), sur mesure, plafond, quotas mémorisés |
| `t_routeur_sim.js` | Parcours complets avec `sim.js` : secours Google → Groq → Haiku, disjoncteur Gemini, plafond Claude (Vision et Conseil) |
| `t_coach.js` | Tableau de bord du coach (API et Telegram) : trajectoire, levier, pas, crises, graphes |
| `t_photos.js` | Gestion des photos (`photo_gerer`) : supprimer, changer la date, archive Telegram, appartenance |
| `t_reperes.js` | Repères qualité (`qual`), payload `reference.reperes` |
| `t_ia_payante.js`, `t_compteur.js`, `t_admin_ia.js` | IA payantes par compte, trois niveaux, compteur Haiku / Sonnet, administration |
| `t_plancher.js` | Cible plancher à 90 % du métabolisme |
| `t_off.js` | Code-barres : réponse Open Food Facts décodée en UTF-8 (accents) |
| `t_repas_favoris.js` | Repas préférés : colonne Users.repas_favoris (nettoyage, écho, payload) |
| `t_lib_calculs.js` | Appli et Telegram iso : les 15 copies du bloc de calcul identiques à `lib_calculs_n8n.js`, fonction par fonction |
| `t_crise_modifier.js` | Goutte : modifier une crise seulement si elle est active et à ce compte ; sans id, nouvelle crise |
| `t_analyses.js` | Feuille Analyses : une ligne par analyse IA réussie (appli, menu, coach, Telegram), aucune en échec, `analyses_jours` |

`n8n/tests/sim.js` : mini-exécuteur qui suit les connexions, exécute les vrais nœuds Code / IF / Switch et simule
les HTTP (clé du modèle déduite du nom du nœud). Les fixtures de ces tests contiennent des prénoms réels : c'est une
des raisons pour lesquelles `n8n/` n'est pas commité.

## 4. Avant de livrer

```bash
node tools/bump_version.mjs      # si l'appli a changé
npm test                           # syntaxe + e2e
npm run test:n8n                   # si le workflow a changé (après layout.py)
node tools/verif_secrets.mjs        # avant tout commit
```
