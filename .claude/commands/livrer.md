---
description: Contrôles complets, versions bumpées et récapitulatif de livraison (sans commit)
---

Prépare une livraison de l'appli et/ou du workflow. Étapes, dans l'ordre, en t'arrêtant à la première erreur :

1. `git status` et `git diff --stat` : liste ce qui a changé. Si `index.html` ou `sw.js` ont changé,
   lance `node tools/bump_version.mjs` (versions à l'heure de Paris).
2. Si le workflow a changé (`n8n/Agent_Nutrition.json` plus récent que `n8n/archives/`) :
   `python tools/layout.py n8n/Agent_Nutrition.json n8n/Agent_Nutrition.json`,
   puis `node tools/check_workflow.mjs` et `node n8n/run_tests.mjs`.
3. `node tools/check_html.mjs` puis `node tests/e2e.mjs` : tout doit être vert.
4. Vérifie que chaque changement de comportement a au moins un test (e2e pour l'appli, `n8n/tests/` pour le workflow).
   S'il en manque, écris-le et relance.
5. `node tools/verif_secrets.mjs`.
6. Récapitulatif pour Samuel, court, en français :
   - ce qui a changé (une ligne par point) ;
   - versions (`APP_VERSION`, `VERSION`) et résultats des tests (nombre de vérifications) ;
   - ce qu'il doit faire : pousser (proposer le message de commit), réimporter le workflow dans n8n,
     colonne Sheets à ajouter (feuille, nom exact, format)...
7. Mets à jour `docs/ARCHITECTURE.md` (tableaux de versions + section datée) et `docs/FEUILLE_DE_ROUTE.md` si besoin.

Ne commite pas et ne pousse pas sans que Samuel le demande explicitement.

$ARGUMENTS
