# Dossier local du workflow n8n (non commité)

Ce dossier est ignoré par git, sauf ce README : le JSON du workflow contient la clé Gemini en clair
et les tests utilisent des prénoms réels. **Sauvegarder ce dossier ailleurs** (il n'existe que sur cet ordinateur).

Contenu attendu :

- `Agent_Nutrition.json` : export du workflow principal (v59 au 08/10/2026). Le remplacer par un nouvel export
  si le workflow a été modifié directement dans n8n.
- `Agent_Nutrition_Alertes.json` : workflow d'alertes (Error workflow du principal).
- `lib_calculs_n8n.js` : bloc de calcul commun recopié à l'identique dans 15 nœuds Code (référence).
- `tests/` : tests des nœuds (`node n8n/run_tests.mjs`), `tests/sim.js` simulateur.
- `archives/` : versions précédentes du JSON (`Agent_Nutrition_vNN.json`), à remplir avant chaque modification.
