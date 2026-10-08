# Agent Nutrition : consignes pour Claude Code

Application personnelle de suivi nutritionnel de Samuel (administrateur) et de quelques invités.
Deux briques qui partagent la même base Google Sheets :

- **PWA** (ce dépôt, publié par GitHub Pages) : `index.html` (un seul fichier, HTML + CSS + JS inline,
  environ 400 Ko), `sw.js` (service worker), `manifest.webmanifest`, icônes.
- **Workflow n8n « Agent Nutrition »** (serveur `https://vps-444b360b.vps.ovh.net`, webhook `nutrition/api`) :
  API de l'appli, bot Telegram, IA (Gemini, Groq, Claude, Gemma), Google Sheets. Son export JSON vit
  **uniquement en local** dans `n8n/Agent_Nutrition.json` (ignoré par git, voir Sécurité).

Lire avant toute modification :
- `docs/ARCHITECTURE.md` : architecture complète, feuilles, actions, nœuds, historique des choix.
- `docs/WORKFLOW_N8N.md` : comment modifier le workflow sans le casser.
- `docs/TESTS.md` : tous les tests et comment les lancer.
- `docs/FEUILLE_DE_ROUTE.md` : ce qui est fait, ce qui reste.

## Façon de travailler (exigences de Samuel)

- Répondre en **français**, direct, sans flatterie, sans tirets cadratins. Le contredire quand il se trompe.
- **Lire le code réel** avant de proposer quoi que ce soit ; ne jamais réécrire à l'aveugle.
  `index.html` est gros : chercher (Grep) les fonctions concernées puis lire les zones utiles.
- Modifications **ciblées** (Edit) : pas de reformatage, pas de refonte, pas de framework, pas de découpage en modules.
- **« montre maquette »** : produire d'abord une maquette (page HTML statique rendue en capture PNG avec Playwright,
  au format iPhone 390 × 844, thèmes clair et sombre si utile) et attendre son choix.
  **« vas y », « ok », « fais »** : coder directement.
- Chaque nouvelle fonction ou correction a **ses tests e2e** dans `tests/e2e.mjs` (il l'a déjà réclamé :
  « il n'y a pas de e2e »). Côté workflow, un test dans `n8n/tests/`.
- **Vérifier la syntaxe** de tout ce qui est produit (voir Commandes) et faire passer **tous** les tests avant de dire « fini ».
- À chaque livraison de l'appli : **bumper les deux versions** à l'heure de Paris (`node tools/bump_version.mjs`) :
  - `sw.js` : `const VERSION = 'JJ/MM/AAAA à HHhMM';`
  - `index.html` : `const APP_VERSION='JJ/MM/AAAA HHhMM';`
- Workflow : toujours repasser la **mise en page automatique** (`tools/layout.py`) avant de livrer le JSON.
- Nouveau credential n8n : **demander son ID à Samuel** avant de livrer (jamais de clé dans le JSON).
- **Commit et push uniquement quand Samuel le demande.** Un push sur `main` met l'appli en ligne pour tout le monde.
- Fin de tâche : dire en deux ou trois lignes ce qui a changé, les tests passés, et ce que Samuel doit faire
  (pousser, réimporter le workflow dans n8n, ajouter une colonne dans Sheets...).

## Sécurité (non négociable)

- Le dépôt GitHub est **public**.
- `n8n/Agent_Nutrition.json` contient la **clé API Gemini en clair** (en-tête `x-goog-api-key`) :
  ne jamais le commiter, ne jamais citer ni recopier la clé (dans une réponse, un test, un log, un commit).
- Les clés Groq et Anthropic ne vont **jamais** dans le JSON ni dans le chat : seulement dans les credentials n8n
  (Header Auth). Groq : `Authorization: Bearer …` ; claude_nutrition : nom `x-api-key`, domaine `api.anthropic.com`.
- Données de test **synthétiques** dans tout fichier commité. Les payloads réels (`payload*.json`) restent hors git.
- Avant tout commit : `node tools/verif_secrets.mjs` (lancé aussi automatiquement par les hooks, voir Commandes).

## Commandes

Poste de travail : **Windows 11** (Claude Code passe par Git Bash). Python s'appelle `python` (pas `python3`,
qui ouvre le Microsoft Store). Chemins avec `/` dans les commandes.

```bash
npm install && npx playwright install chromium  # une fois
node tools/bump_version.mjs                     # versions (appli) à l'heure de Paris
node tools/check_html.mjs                       # syntaxe des scripts de index.html et sw.js + versions
node tests/e2e.mjs                              # tests de l'appli (Chromium iPhone, webhook simulé) : doit finir par « Tout est vert. »
node tools/check_workflow.mjs                   # workflow : JSON, connexions, syntaxe des 126 nœuds Code
node n8n/run_tests.mjs                          # tests des nœuds du workflow (hors n8n, HTTP simulés)
python tools/layout.py n8n/Agent_Nutrition.json n8n/Agent_Nutrition.json
                                                # mise en page du workflow
node tools/verif_secrets.mjs                    # aucun secret ni JSON de workflow suivi par git
```

Raccourcis : `npm test` (syntaxe + e2e), `npm run test:n8n`, `npm run bump`, `npm run layout`, `npm run secrets`.
Garde-fous déjà en place : hook Claude Code (`.claude/settings.json` → `tools/hook_git_guard.mjs`) qui bloque
`git commit` / `git push` si un secret est détecté, et hook git `pre-commit` (`npm run hooks`, une fois par clone).
Commandes Claude Code du projet : `/livrer` (contrôles + versions + récapitulatif), `/maquette <sujet>`.

## Repères techniques indispensables

- **Rendu** : état global `S`, DOM régénéré par `rendre()`. Onglets Jour, Ajouter, Courbes, Corps, Journal, Coach + Réglages.
- **Coquille iOS, ne pas casser** : `html,body{height:100%;overflow:hidden}`, seul `#defile` défile, `nav` en bas
  d'une colonne flex (jamais `position:fixed`), utiliser `hautPage()` / `basPage()`, jamais `window.scrollTo`.
  Les champs de saisie restent en 16 px (sinon zoom iOS). Aucun débordement horizontal.
- **Overlays hors de `#racine`** (`#cam-hote`, `#ph-hote`, `#evo-hote`, `#modale-hote`, `#adm-volet`, `#maj-bandeau`) : jamais reconstruits par `rendre()`.
- **API** : un seul POST vers le webhook avec un champ `action` (`data`, `repas`, `poids`, `params`, `suppr`, `conseil`,
  `enregistrer`, `barcode`, `activite`, `mesure`, `photo`, `photo_get`, `photo_gerer`, `journal`, `admin`, `compte`,
  `rappel`, `crise`, `favoris`, `invite`). Le Switch `Action` du workflow route chaque action vers sa branche.
- **Google Sheets** : mapping **par nom de colonne** (ajouter une colonne ne casse rien). Feuilles : Users, Journal,
  Poids, Params, Invitations, Crises, Activite, Mesures. Params est un journal daté (`date_effet`).
- **Appli et Telegram iso** : mêmes calculs, mêmes chiffres. Le bloc de calcul commun est recopié à l'identique
  dans 15 nœuds Code ; référence : `n8n/lib_calculs_n8n.js`. Toute modification d'un calcul se fait partout.
- **Cible calorique** : cible = max(round(MB × 0,9), besoins + écart). Appli : `PLANCHER_MB=0.9`, `ciblePrevue()`.
  Serveur : 19 calculs (`cibleDyn` × 15, Build Params API, Build Invite API, Tableau Coach API/TG).
- **Répartition par repas** : colonne `repartition` de Params, `matin/midi/en-cas/soir` en %, pilote les tableaux
  « Par repas » de l'appli et de Telegram.
- **Chaîne IA** (profil Défaut) : Gemini Flash → Flash-Lite → Groq → Claude Haiku → Gemma. Sonnet seulement via le
  profil Complexe. Disjoncteur sur Gemini, plafond commun `CLAUDE_MAX_JOUR` = 20 appels Claude par jour.
- **IA payantes par compte** : colonne `ia_payante` (Users, Invitations) : vide/`non`, `haiku`, `oui` (Haiku + Sonnet).
  L'administrateur a tout. Compteur `staticData.claudeMois[AAAA-MM][uid]={a,c,h,s}` ; prix estimés Haiku 0,01 €, Sonnet 0,05 €.
- **Mises à jour** : `controlerMaj()` compare la version servie et affiche `#maj-bandeau` ; le bump de `VERSION`
  dans `sw.js` est ce qui déclenche la mise à jour sur les téléphones.
- Cible matérielle : iPhone récent, iOS 26, PWA installée sur l'écran d'accueil (Safari). Pas de `BarcodeDetector` : ZXing.

## Déploiement

- Appli : pousser `index.html` + `sw.js` sur `main` → GitHub Pages → bascule automatique sur les iPhone
  (aucune réinstallation). Toujours avec les versions bumpées.
- Workflow : Samuel réimporte `n8n/Agent_Nutrition.json` dans n8n (Import from file, remplace l'existant),
  vérifie les credentials, enregistre et active. Credentials par ID : Groq `XPVXmC8miWlyPE1a`,
  Claude `JoqQ4ay5xIRB9G2C`, Google Sheets `ut38KIHX9AdxsvQy`.
- Nouvelle colonne Sheets : le dire explicitement à Samuel (feuille, nom exact, format Texte brut si date ou clé).

## État au 08/10/2026

- Appli v66 (`APP_VERSION` 08/10/2026 13h49), e2e 155 vérifications au vert.
- Workflow v59 (446 nœuds), tests n8n au vert.
- Historique détaillé des versions : `docs/ARCHITECTURE.md` (sections 12 à 25 et tableaux « État » en tête).

## Hors sujet

Ne pas toucher aux fichiers d'autres projets (par exemple le carnet de voyage Madrid).
