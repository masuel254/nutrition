# Modifier le workflow n8n « Agent Nutrition »

## Où il est

- Source de vérité : le workflow actif dans n8n (`https://vps-444b360b.vps.ovh.net`).
- Copie de travail locale : `n8n/Agent_Nutrition.json` (export n8n, v59 au 08/10/2026, 446 nœuds).
  Le dossier `n8n/` est **ignoré par git** sauf son README : le JSON contient la clé Gemini en clair.
- `n8n/Agent_Nutrition_Alertes.json` : petit workflow d'alertes (Error Trigger → message Telegram à l'admin),
  déclaré comme Error workflow du principal. Rarement modifié.
- Avant de travailler, demander à Samuel si le JSON local est bien la dernière version (s'il a modifié
  quelque chose directement dans n8n, il doit réexporter : menu ⋯ › Download, puis remplacer le fichier).

## Règles

1. **Modifier par remplacement exact**, jamais en réécrivant un nœud de mémoire. Méthode éprouvée : un petit script
   Python qui charge le JSON, applique des remplacements `rep(code, avant, après)` qui doivent chacun correspondre
   **exactement une fois** (ou un nombre attendu de fois, vérifié par `assert`), puis réécrit le JSON :

   ```python
   import json
   F = 'n8n/Agent_Nutrition.json'
   w = json.load(open(F, encoding='utf-8'))
   N = {n['name']: n for n in w['nodes']}
   def rep(nom, a, b, fois=1):
       c = N[nom]['parameters']['jsCode']
       assert c.count(a) == fois, (nom, a[:60], c.count(a))
       N[nom]['parameters']['jsCode'] = c.replace(a, b)
   rep('Build Params API', 'ancien texte exact', 'nouveau texte')
   json.dump(w, open(F, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
   ```

   Pour un changement du bloc de calcul commun (présent dans 15 nœuds), boucler sur tous les nœuds Code et
   vérifier le **nombre total** de remplacements (exemple : passage du plancher à 90 % en v59, 15 + 2 + 1 + 1).
   Mettre aussi à jour `n8n/lib_calculs_n8n.js` (référence du bloc commun).
2. **Nouveaux nœuds** : ajouter l'objet nœud (id UUID unique, `name` unique, `type`, `typeVersion`, `parameters`,
   `position` quelconque) et ses connexions dans `w['connections']`. Copier un nœud voisin du même type comme modèle
   (Google Sheets : même `documentId`, `sheetName` par nom, credential `ut38KIHX9AdxsvQy`).
   - Lectures et upserts Sheets : `retryOnFail: true` avec les mêmes `maxTries` / `waitBetweenTries` que les nœuds voisins (copier un nœud existant).
   - Écritures des branches de l'appli : `onError: continueErrorOutput` vers `Respond Ecriture KO`.
   - Nouvelle action de l'appli : nouvelle sortie dans le Switch `Action` (règle sur `$json.action`, valeur = nom de l'action) et branche
     terminée par un `Respond to Webhook`.
3. **Credentials** : jamais de clé dans `parameters`. Référence par ID (Groq `XPVXmC8miWlyPE1a`, Claude
   `JoqQ4ay5xIRB9G2C`, Sheets `ut38KIHX9AdxsvQy`). Pour un nouveau credential, demander l'ID à Samuel.
   Exception historique : la clé Gemini est en clair dans l'en-tête `x-goog-api-key` des nœuds Gemini/Gemma
   (migration en credential reportée par Samuel). Ne jamais la recopier ailleurs.
4. **Mise en page** : `python tools/layout.py n8n/Agent_Nutrition.json n8n/Agent_Nutrition.json` après chaque
   modification (un couloir par branche, nœuds rangés par profondeur, notes de couloir régénérées).
5. **Contrôles** : `node tools/check_workflow.mjs` (JSON, noms uniques, connexions, syntaxe de chaque nœud Code
   enveloppé dans `async function f(){…}`) puis `node n8n/run_tests.mjs`. Ajouter un test dans `n8n/tests/` pour
   chaque comportement nouveau.
6. **Iso appli / Telegram** : un calcul changé côté API (`… API`) a presque toujours son jumeau Telegram
   (`… TG`, `… C`, nœuds sans suffixe). Chercher toutes les occurrences avant de livrer.

## Livrer à Samuel

- Dire quels nœuds ont changé et pourquoi, les tests passés.
- Lui rappeler : n8n › workflow « Agent Nutrition » › ⋯ › Import from File › `n8n/Agent_Nutrition.json`
  (remplace le contenu), vérifier que les credentials sont reconnus, Save, laisser Active.
- Toute colonne Sheets nouvelle : feuille, nom exact, format.
- Conserver une copie de la version précédente (`n8n/archives/Agent_Nutrition_vNN.json`) avant d'écraser.

## Nœuds et conventions utiles

- `Webhook API` → `Auth API` (jeton → utilisateur, `ia_niveau`, `ia_haiku`, `ia_sonnet`, `invite:true` sans jeton)
  → `Action` (Switch).
- Telegram : `Telegram Trigger` → `Normalize Update` → `Auth` → `Callback Type` / `Type Saisie` / `Route`.
- `staticData` (`$getWorkflowStaticData('global')`) : disjoncteur Gemini, compteurs Claude (`claudeJour`,
  `claudeMois[AAAA-MM][uid]={a,c,h,s}`), anti-essais des codes d'invitation.
- Chaîne IA côté API : `Secours Prep Vision API` / `Secours Prep Conseil API` préparent l'ordre selon le profil et
  les droits du compte ; `Routeur IA Vision API` appelle Flash, Flash-Lite, Groq, Haiku, Gemma (Sonnet pour le profil Complexe).
- Planifications (Europe/Paris) : bilan lundi 8h07, rappels 14h03 et 21h03, sauvegarde dimanche 3h17.
- Le simulateur `n8n/tests/sim.js` exécute les vrais nœuds Code / IF / Switch et simule les HTTP (réponses IA,
  erreurs, illisible) : s'en servir pour tester un parcours complet.
