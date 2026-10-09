# Agent Nutrition : architecture et mémoire de projet

Document de référence pour Claude Code. Sections 1 à 11 : socle (état du 28/09/2026, complété ici quand il a changé).
Sections 12 et suivantes : évolutions datées jusqu'au 08/10/2026. En cas de contradiction, la section la plus récente
et le code font foi.

## État au 08/10/2026

- Appli : v66, `APP_VERSION` 08/10/2026 13h49 ; `tests/e2e.mjs` 155 vérifications au vert.
- Workflow : v59, 446 nœuds (126 Code, 86 Google Sheets, 54 Telegram, 22 HTTP) ; tests `n8n/tests/` au vert.
- Feuilles Google Sheets : Users, Journal, Poids, Params, Invitations, Crises, Activite, Mesures.
  Colonnes ajoutées depuis le socle : Users et Invitations `ia_payante` (vide/`non`, `haiku`, `oui`) ;
  Journal `ia` (modèle qui a fait l'analyse) ; Params `fibres_min`, `satures_max`, `sucres_max`, `sodium_max`
  (0 = automatique, case vide ignorée : on prend la dernière valeur écrite).
- Cible calorique : max(round(MB × 0,9), besoins + écart), appli et serveur.
- Chaîne IA (profil Défaut) : Gemini Flash → Flash-Lite → Groq → Claude Haiku → Gemma ; Sonnet via le profil Complexe ;
  disjoncteur Gemini ; 20 appels Claude par jour au plus, tous comptes confondus.

### Historique des versions récentes de l'appli

| Version | Contenu |
|---|---|
| v50 | Gestion des photos : vignettes `.phv`, volet `#ph-hote`, `ouvrirVolet`, `voirEnGrand`, `gererPhoto`, `supprimerPhoto`, `changerDatePhoto`, `S.cam.dateForcee`, `phRemplacement` |
| v51 | Recadrage aussi pour une prise en direct |
| v52 | Évolution animée : `ouvrirEvolution`, `evoDessiner`, `evoLire`, `evoPause` ; tenue 900 ms, fondu 800 ms |
| v53 | Rangées de dates `#k-pdt` et `#evo-dts`, `S.corps.vue1` |
| v54 | `S.corps.pmode` (`une` / `cmp`), `S.corps.phInit` remis à faux par la navigation |
| v55 | Invitations sur iOS (`estIOS()`, liens `#acces=JETON&api=`, écran `accesPourAppli`) |
| v56 | Mises à jour automatiques : `controlerMaj` (10 min au retour, 30 min en continu), `majOccupe`, `#maj-bandeau` |
| v57 | Repères qualité réglables : `QREG`, `reperesReg`, `seuilsAuto`, `seuilsQualite`, `S.regl.qr` |
| v58 à v61 | IA payantes pilotées par l'admin ; v61 : liste `.adm-r`, résumé `.adm-sum`, volet `#adm-volet` (`admVolet`, `voletCompte`, `voletInvitation`, `optsNiv`, `NIV_OPT`, `nivCompte`), `iaOk(k)`, `piaPre()` |
| v62 | Pas : tuiles `.prog.trois` (Aujourd'hui / 3 j / 7 j), tendance 3 j vs 7 j |
| v63 | Courbes : périodes `[3,7,14,30,90,0]` |
| v64 à v66 | Plancher : `ciblePrevue` renvoie `{td,mb,pl,brut,cible,plancher,sousMB}`, `AVERT_MB` dans l'aperçu des Réglages ; messages retirés de l'écran Jour en v66 |

### Historique des versions récentes du workflow

| Version | Contenu |
|---|---|
| v52 | Action `photo_gerer` |
| v53 | Message « code déjà servi » |
| v54 | Repères qualité : `sortParams` avec `qual:[...]` (15 nœuds), Build Params API, payload `reference.reperes`, coach |
| v55 | IA payantes : nœuds `Admin IA?`, `Users IA A`, compteur |
| v56 | Compteur séparé Haiku / Sonnet |
| v57 | Trois niveaux d'IA payantes |
| v58 | Niveau des invitations en attente |
| v59 | Plancher à 90 % du métabolisme |

---

## 1. Vue d'ensemble

Application de suivi nutritionnel personnel de Samuel. Deux briques qui parlent
à la même base Google Sheets.

- **PWA** (front) : `index.html` (un seul fichier, tout inline) +
  `sw.js` (service worker) + `manifest.webmanifest`. Installable sur iPhone,
  fonctionne hors-ligne pour la coquille.
- **Workflow n8n** (back) : un bot Telegram et une API web, tous deux servis par
  le même workflow. IA (Gemini) pour l'analyse des repas et le coach. 446 nœuds en v59, plus un petit workflow « Agent Nutrition Alertes ».
- **Google Sheets** : la base de données, huit feuilles (dont Invitations et Crises).

L'appli et Telegram sont deux entrées vers le même back et doivent rester
**iso** : mêmes calculs, mêmes chiffres.

Cible matérielle : iPhone 17 Pro Max, iOS 26. Pas de `BarcodeDetector` natif sur
Safari iOS, d'où la lib JS ZXing pour le scan.

---

## 2. La PWA (index.html + sw.js)

### Fonctionnement du rendu
État global dans l'objet `S`. Le DOM est régénéré entièrement à chaque `rendre()`.
Pas de framework. Onglets : Jour, Ajouter, Courbes, Corps, Journal, Coach, plus le
panneau Réglages.

### Coquille d'application (ne pas casser)
Le document ne défile jamais : `html,body{height:100%;overflow:hidden}`, seul
`#defile` (bandeau + main) défile, la `nav` est un bloc normal en bas d'une colonne
flex, **pas** en `position:fixed`. Sur iOS en mode écran d'accueil, un fixed dépend
du défilement du document et WebKit finit par le décaler (barre qui se rétracte).
Toujours utiliser `hautPage()` / `basPage()`, jamais `window.scrollTo`. `rendre()`
conserve la position de défilement de `#defile`.

### Communication avec le back
Un seul POST vers le webhook `nutrition/api`, avec un champ `action`. Actions :
`data`, `repas`, `poids`, `params`, `suppr`, `conseil`, `enregistrer`, `barcode`,
`activite`, `mesure`, `photo`, `photo_get`, `journal`, `admin`, `compte`, `rappel`, `crise`, `menu`, plus `invite`
(sans jeton : inscription ou reconnexion par code d'invitation). Délai 120 s sans nouvel essai pour
`repas`, `conseil`, `menu`, `photo` ; 25 s avec 2 nouveaux essais pour les autres, `enregistrer`
compris : il porte l'`id` du repas, donc un rejeu met à jour la même ligne. Une réponse
vide (n8n arrêté avant le nœud Respond) est rejouée de la même façon.

### Déploiement (règle absolue)
Pousser `index.html` + `sw.js` sur GitHub suffit. Bascule automatique sur
l'iPhone, **jamais besoin de réinstaller**. À chaque déploiement :
- `const VERSION` en haut de `sw.js`,
- `const APP_VERSION` dans `index.html`,
avec l'heure réelle de livraison (Paris).

### Points déjà stabilisés
- Cache des repas (onglet Ajouter) : repas actif + 2 derniers analysés,
  en localStorage sous `suivi.repas`.
- Scan code-barres : overlay caméra, ZXing UMD, verrou `scanEnCours`, caméra
  coupée en quittant l'onglet et en arrière-plan.
- Appareil photo d'évolution : overlay hors de `#racine` (`#cam-hote`), jamais
  reconstruit par `rendre()`, flux coupé à la fermeture et en arrière-plan.
- Photos d'évolution gardées en IndexedDB (`suivi-photos`), effacées par
  « Oublier ce téléphone ».
- Écran Ajouter : deux accordéons repliés, « Refaire un repas » et « Composer avec
  mes aliments » (état `S.rac`). Refaire : derniers repas du créneau tirés de
  `d.journal`, regroupés par composition (noms triés, même clé depuis `aliments` ou
  depuis le texte `detail`), « Habituel » si ≥ 3 fois ; « + Ajouter » enregistre
  tout de suite pour aujourd'hui, « Modifier » ouvre la carte résultat. Composer :
  tuiles du catalogue avec − / +, recherche sans re-rendu (`filtrerTuiles`), puis
  carte résultat à confirmer ; en mode « Ajouter un aliment », les tuiles
  s'ajoutent au repas en cours. Aucun appel IA dans ces parcours.
- Onglet Journal : semaine en cours jour par jour, semaines passées en cartes
  repliables (moyenne kcal/j, jours au-dessus de la cible) calculées depuis `d.jours`,
  4 semaines de plus par « Voir plus ». État `S.jn` en mémoire (jour le plus récent
  ouvert au lancement). `/data` ne livre le détail des repas que depuis
  `journal_depuis` (lundi de la semaine précédente) ; ouvrir un jour plus ancien
  appelle l'action `journal` pour sa semaine et greffe les lignes dans `S.data.journal`.
- Modifier depuis le Journal : si la ligne a ses `aliments`, repris tel quel
  sans IA ; sinon ré-analyse du texte (anciennes lignes).

---

## 3. Google Sheets (la base)

**Le mapping se fait par nom de colonne** : ajouter une colonne ne casse rien.

- **Users** : `uid, chat_id, prenom, sexe, taille, naissance, date_inscription,
  statut, role, nom_telegram, token` (`chat_id` vide pour un compte créé dans l'appli, `uid` = `app-…` ;
  l'administrateur a un `role` qui commence par « admin »)
- **Journal** : `id, uid, date, repas, detail, kcal, prot, lip, gluc, fibres, sucres,
  sodium, satures, sucres_ajoutes, nutriscore, purines, purines_risque, alcool, boissons_sucrees, aliments`
  (`aliments` = JSON du détail par aliment, écrit par l'appli et par Telegram
  depuis le 26/09 ; format Texte brut ; vide sur les anciennes lignes). `id` : identifiant
  unique du repas (créé par l'appli, `t…` pour Telegram), clé de l'écriture « ajouter ou
  mettre à jour » ; vide sur les lignes antérieures au 27/09 (suppression par l'ancienne
  correspondance date + repas + détail + kcal)
- **Poids** : `uid, date, poids`
- **Crises** : `id, uid, date, articulation, intensite, remarque, statut, maj` (écriture sur `id` ;
  retirer = `statut` `supprimee`, la ligne reste)
- **Params** : `uid, date_effet, cible, activite, facteur, prot, lip, gluc,
  repartition, macros, poids_ref, mb, tdee, mode, ts, purines_max, objectif_poids, objectif, ecart_kcal`
  (`objectif` = `seche` / `stabilisation` / `prise` ; avec `ecart_kcal`, la cible n'est plus fixe :
  besoins du jour + écart, jamais sous 90 % du métabolisme de base (v59), macros en grammes recalculées ; sans
  `ecart_kcal`, ancienne cible fixe, écrite par exemple par le menu Paramètres de Telegram)
- **Invitations** : `code, type, uid, prenom, cree_par, date, expire, statut, utilise_par, utilise_le`
  (type `inscription` ou `reconnexion` ; statut `active` / `utilisee` / `annulee` ; 7 jours ; tout en Texte brut)
- **Activite** : `cle, uid, date, pas, maj` (cle = `uid|date`, écriture en
  append-or-update sur `cle`, on garde le max des pas du jour)
- **Mesures** : `cle, uid, date, type, taille_cm, cou_cm, hanches_cm, fichier, maj`
  (type `mesures`, `photo_face` ou `photo_profil` ; cle = `uid|date|type` ;
  `fichier` = file_id Telegram de la photo)

Colonnes `date` et `cle` des nouvelles feuilles en format **Texte brut**.
Les lectures d'Activite et Mesures sont en `continueRegularOutput` : si la feuille
manque, l'appli fonctionne quand même (listes vides).

### Historisation des paramètres
Params est un **journal daté**. Chaque changement ajoute une ligne avec
`date_effet`. `purines_max` : on prend la dernière valeur renseignée (Telegram ne
l'écrit pas), défaut 400.

---

## 4. Calculs métier (partagés partout)

Bloc de fonctions copié dans les nœuds Code, ne pas diverger. Depuis la v32, une seule
version de référence (`n8n/lib_calculs_n8n.js`, local) recopiée à l'identique dans les
15 nœuds par le script de construction ; toute évolution passe par ce fichier.

- MB **Mifflin-St Jeor** ; TDEE = MB × facteur (1,2 / 1,3 / 1,375 / 1,55 / 1,725 / 1,9).
- Macros : répartition `macros` de Params (défaut 30/30/40).
- Déficit : 7000 kcal = 1 kg. Fuseau toujours `Europe/Paris`.
- Répartition par repas : colonne `repartition` (`matin/midi/encas/soir`).
- Moyennes et déficits excluent le jour en cours (jours pleins ≥ 2 repas).
- Cible dynamique : `cibleAt` → `cibleDyn` (pesées lues par `sortPesees`, gardées dans `PES_REF`).
  `objectifDe`, `bonJour` (sèche : ≤ cible ; prise : ≥ 95 % ; stabilisation : ± 10 %), `libBon`.
  Libellé de mode « Stabilisation » (ex-« Maintien »).

### Purines
Gemini renvoie par aliment `famille` (liste fermée), `grammes`, `alcool` (g
d'éthanol), `sucree`. Le calcul est fait dans n8n avec la table `PURINES`
(mg/100 g par famille, ordres de grandeur), copiée dans Build Vision API, Build
Claude Body, Parse IA API, Parse IA, Parse OFF. `purines_risque` = familles
animales + bière + levure (r=1) ; c'est la seule valeur comparée au plafond.
Code-barres : famille déduite des `categories_tags` Open Food Facts.

### Corps
- Masse grasse : méthode US Navy (homme : taille, cou, stature ; femme : + hanches).
- Rapport tour de taille / stature, repère 0,5.
- Objectif de pas : 8000 (constante `OBJECTIF_PAS` dans l'appli).

---

## 5. Le workflow n8n

- Webhook `nutrition/api` (POST) pour l'appli, plus le flux Telegram.
- `Action` (Switch) route selon `action` (12 sorties).
- `Auth API` : identifie l'utilisateur par token, renvoie aussi `chat_id`.
- Analyse repas : Gemini vision, n'écrit rien, l'appli confirme ensuite.
- Pas : `Read Activite A → Build Activite API → Activite Upsert API`. Le Raccourci
  iOS envoie `{token, action:'activite', pas, pas_hier}` ; l'appli envoie
  `{date, pas, force:true}`.
- Photos : `Build Photo API` fabrique le binaire, `Photo Send API` (Telegram
  sendPhoto, sans notification) l'archive dans la conversation de l'utilisateur,
  `Photo Row API` prend le plus grand file_id, `Photo Upsert API` l'écrit dans
  Mesures. Relecture : `Read Mesures G → Build Photo Get` (vérifie l'appartenance)
  `→ Photo File API` (Telegram file get) `→ Photo B64 API`.
  Pas de Google Drive : un compte de service ne peut pas écrire dans un Drive
  personnel (quota).
- Écritures Sheets des nouvelles branches en `continueErrorOutput` vers
  `Respond Ecriture KO`.
- Tous les nœuds Sheets de lecture et d'upsert : `retryOnFail`, 3 essais, 1,5 s
  (pannes « host unreachable » ponctuelles du VPS vers Google). Pas sur les append ni
  les delete. Si ça persiste : `NODE_OPTIONS=--dns-result-order=ipv4first` sur n8n.
- Journal par période : `Read Journal J → Build Journal API → Respond Journal`
  (`{debut, fin}`, 62 jours maximum).
- Coach : Gemini, contexte purines / alcool / boissons sucrées ajouté.
- Planifications (fuseau du workflow : Europe/Paris) : bilan hebdo lundi 8h07
  (`Build Bilan Hebdo`, semaine précédente), rappels 14h03 et 21h03 (`Build Rappels`),
  sauvegarde dimanche 3h17 (`Build Sauvegarde`, JSON de toutes les feuilles sans les jetons,
  envoyé à l'admin sur Telegram).
- Workflow « Agent Nutrition Alertes » : Error Trigger → Users → message Telegram à l'admin,
  anti-répétition 30 min par nœud. À déclarer comme Error workflow dans les réglages du
  workflow principal.
- Invitation (v33) : `Auth API` renvoie `invite:true` pour l'action `invite` sans jeton → `Invite?` →
  `Read Invitations I` → `Build Invite API` (anti-essais : 15 codes faux par heure) → `Invite Etape` :
  inscription (`Users Add I`, `Poids Add I`, `Params Add I`, `Invitation Upd I`, `Notif Admin I`),
  reconnexion (`Users Token R` sur `uid`, `Invitation Upd R`, `Notif Admin R`), ou simple réponse.
- `admin` (réservé à l'administrateur) : `Build Admin API` (liste, inviter, reconnexion, annuler) →
  `Invitations Upsert A` sur `code`. `compte` : `Build Compte API` (profil, nouveau code, fermer) →
  `Users Upsert C` sur `uid`, ligne complète réécrite. `rappel` (Raccourci iOS) : texte du rappel de
  14h / 21h ou bilan du lundi, vide s'il n'y a rien à dire.
- Photos d'un compte sans Telegram : archivées dans le Telegram de l'administrateur, légende au prénom.
- Rappels et bilan du lundi Telegram : seulement les comptes avec `chat_id`.
- Enregistrement appli : `Journal Append API` en appendOrUpdate sur `id` ; `Locate Del API`
  supprime par `id` s'il est fourni.
- IA côté API : modèle principal 3 essais puis secours 2 essais, 2,5 s d'écart, 20 s de
  délai par essai (pire cas ~110 s). Échec des deux : `Respond IA KO` en HTTP 503 avec
  un message lisible (champ `erreur`) et l'erreur Google dans `detail` ; l'appli affiche
  `erreur`.
- Aliments : `alimentsJSON()` (dans Build Ligne API et Parse IA) sérialise les
  aliments du repas dans la colonne `aliments`. Build API Payload renvoie
  `journal[].aliments` (tableau) et `catalogue` : un aliment par nom normalisé,
  valeurs de la dernière prise ramenées à une unité (`mode:'n'` pièce, `u`/`up`
  singulier/pluriel ; `mode:'p'` portion mangée, ex. « 150 g »), `n` prises, `cr`
  prises par créneau, 300 max.

---

## 6. Conventions de travail

Voir `CLAUDE.md` à la racine du dépôt (prioritaire sur tout ce qui suit en cas de contradiction).

## 7. Versions et fichiers

Voir la section « État » en tête de ce document et `docs/TESTS.md`.

## 8. Écrans ajoutés le 27/09

- Objectif (`blocObjectif`) : reste, progression depuis la 1re pesée, date
  estimée au rythme actuel (régression sur 28 jours, 56 si trop peu de pesées ; 3 pesées
  sur 10 jours minimum) et au rythme prévu (`reference.ecart`, 7000 kcal = 1 kg).
  Affiché dans l'onglet Objectif de l'écran Jour.
- Journal : carte « Semaine dernière » (`bilanSemaine`), mêmes règles que le message du lundi.
- Alertes acide urique : `sept(d)` = 6 jours de calendrier avant aujourd'hui.

## 9. Écrans remaniés le 28/09

- Jour : anneau + pastille « kcal restantes » + trois barres de macros (`barreMacro`),
  bouton Ajouter, puis onglets Repas / Tendance / Purines / Objectif (`S.jour.onglet`,
  mémorisé sous `suivi.jour.onglet`). Alerte acide urique repliée sur une ligne (`#j-alerte`).
- Courbes : une période commune (7 / 14 / 30 / 90 j / Tout) et trois onglets
  Poids / Calories / Purines (`S.crb = {onglet, per}`, mémorisé sous `suivi.courbes`).
  Poids : tuiles Balance / Rythme / Théorique (`calcProgression`, fenêtre qui finit à la
  dernière pesée), ligne d'accord balance/calcul, courbe Poids / Besoins / Régulier ?
  filtrée sur la période. Calories : tuiles Moyenne / Écart cumulé / Sous besoins (jours
  complets), écart quotidien, calendrier Régularité (4 semaines fixes), Nutri-Score.
  Purines : tuiles Moyenne / Au-dessus / Plafond, barres, repas les plus chargés
  (limités au détail chargé, soit deux semaines). Explications repliées dans
  « Comment lire ce graphique ? » (`aide()`).
- Corps : « Pesée du jour » en tête (`sectionPesee`), avant les pas.

## 10. Objectif, invitations et comptes sans Telegram (28/09 matin)

- Appli : `objectifApp` / `sensObj` (−1 sèche, 0 stabilisation, +1 prise) pilotent toutes les couleurs
  « bien / pas bien » : `couleurKcal`, `pastilleKcal`, `bonJourApp`, `couleurJourFini`, `coulEcart`,
  `coulPente`, `clsRepas`, textes `libBonApp`, `libCouleursEcart`, `noteRegulier`, `phraseAccord`.
- Réglages : objectif + écart (bornes sèche −1000/−100, stabilisation ±150, prise +100/+800) avec aperçu
  de la cible ; profil (prénom, sexe, taille, année) ; Invitations (administrateur) ; Rappels et pas
  (guide du Raccourci) ; changer de code ; fermer son compte (EFFACER).
- Première ouverture : `connexion()` → choix « code d'invitation » ou « code d'accès ». Lien
  `…/#invite=CODE&api=ADRESSE` : dans Safari, page d'accueil (`accueilInvite`) qui fait copier le lien et
  explique l'ajout à l'écran d'accueil ; dans l'appli installée, `renduIns()` (code → profil → compte).
  L'adresse du serveur voyage dans le lien ; `API_DEFAUT` ne sert qu'au code tapé à la main.

## 11. Qualité nutritionnelle et goutte (28/09, 8h)

- `satures` (graisses saturées, g) et `sucres_ajoutes` (g) suivent partout le chemin du sodium :
  consigne et format de l'IA (appli et Telegram), aliments, totaux, Journal, `jours`, `aujourdhui`,
  `parRepas`, catalogue. Open Food Facts : `saturated-fat_100g` ; sucres ajoutés = `added-sugars_100g`
  s'il existe, sinon tous les sucres pour boissons sucrées et produits sucrés, 0 sinon.
  `jours[].satures` / `sucres_ajoutes` valent `null` quand aucun repas du jour n'a la donnée (repas
  antérieurs au 28/09) : pas de faux zéros. Script : `dup_nut.py` duplique chaque mention du sodium.
- Repères (`seuilsQualite`) : saturées < 10 % de la cible, sucres ajoutés < 10 %, sodium < 2 000 mg,
  fibres ≥ 30 g (25 g femme, plancher). Jour > Repas : « Qualité du jour ». Courbes : onglet Qualité
  (tuiles, barres par nutriment, « Ce qui en apporte le plus » sur le détail chargé).
- Corps en onglets (`S.corps.onglet`, mémorisé `suivi.corps.onglet`) : Pesée, Pas, Mesures, Photos,
  Goutte. Goutte : noter une crise (date, articulation, intensité 1 à 5, remarque), `analyseCrise` sur
  les 3 jours avant (purines, alcool, sucres ajoutés, écart), synthèse, retrait. `/data` renvoie
  `crises` ; triangles rouges sur le graphique des purines (`barresSeuil` option `marques`).
- Alcool en verres standard (28/09, v35) : 1 verre = 10 g d'alcool pur ; repères Santé publique France
  (10 verres par semaine, 2 par jour, des jours sans). Jour : barre « Alcool » dans la qualité du jour
  quand il y en a ; Courbes > Qualité : tuile de la semaine et puce « Alcool » (barres par semaine) ;
  bilans, crises, alertes et messages Telegram en verres.
- Alcool lisible (28/09, workflow v36 + appli 11h50) : `/data` renvoie `jours[].alcool` à null quand
  aucune ligne du jour n'a la colonne alcool renseignée (compteur `aq`), comme `satures` (`nq`).
  Appli : `semainesAlcool` (semaines lundi → dimanche, la plus récente d'abord, aujourd'hui ne compte
  pas comme jour sans), tuile = semaine dernière + « cette semaine : X pour l'instant », puce Alcool =
  grille jour par jour (une ligne par semaine, vert 0, jaune 1 à 2 verres, orange plus de 2, hachuré
  « ? » non suivi, aujourd'hui en pointillés), « suivi depuis le » (`alcDebut`), moyennes sur les
  semaines complètes seulement. Tuiles Qualité : « aujourd'hui en cours : X » à part de la moyenne.
- Rattrapage (workflow séparé `Agent_Nutrition_Rattrapage.json`, déclenchement manuel) : Journal
  lu, repas avec kcal et sans `satures`, 90 au plus par lancement en lots de 15 → Gemini (satures,
  sucres_ajoutes, alcool par aliment) → mise à jour du Journal par `row_number` (totaux + JSON
  aliments ; alcool d'origine conservé s'il existait) → message Telegram à l'administrateur
  « Reste N ». Relancer jusqu'à 0. Contient la clé Gemini : jamais sur GitHub.
  (Rattrapage fait finalement à la main le 28/09 sur l'export du Journal ; workflow non utilisé.)
- Sans IA (28/09, appli 19h34, rien côté n8n) : 3e raccourci « Saisir à la main » dans Ajouter
  (`S.man`, `blocManuel`, `alimentManuel` : purines calculées dans l'appli avec la même table
  famille × grammes que le workflow, `PUR_FAM`), qui construit un résultat via `resultatDepuis`
  puis passe par l'écran habituel et l'action `enregistrer`. Échec de l'analyse (`blocEchecIA`) :
  « Analyser plus tard » (file `suivi.attente` en localStorage : id, date, repas, desc, photo)
  ou « Saisir à la main ». `traiterAttente` relance à l'ouverture, au retour du réseau et toutes
  les 4 min, puis enregistre au jour et au créneau d'origine avec l'id fixe ; bandeaux sur Jour
  (`blocAttente`).
- Secours IA, révision 29/09 soir (v37c) : ordre Flash (réflexion minimal, 30 s, sans nouvelle
  tentative) → Flash-Lite (20 s) → Groq (20 s, « Groq libre? ») → Gemma `gemma-4-26b-a4b-it`
  (20 s, « Gemma libre? ») → Diag ; pire cas 90 s. Groq et Gemma ont chacun Lisible + IF. Quand un
  secours répond, Parse IA API renvoie `echecs` (motif par étage : saturé 503, quota 429, clé,
  délai dépassé…) affiché sous la mention secours dans l'appli et sur Telegram. Constat du
  29/09 : Flash en 503 « high demand » en continu sur le compte gratuit.
- Secours IA (28/09, workflow v37 + appli 21h47) : 4 chaînes (Vision API, Vision Telegram, Conseil
  API, Conseil Telegram), du plus précis au moins précis = Gemini 3.5 flash (1 nouvelle tentative)
  → Gemini 3.5 flash-lite (aucune)
  → « Secours Prep » → Gemma (`gemma-4-31b-it`, même clé Google, quota séparé, sans
  thinkingConfig ni responseMimeType) → « Gemma Adapt » → parseur ; si échec → Groq
  (`qwen/qwen3.8-27b`, format OpenAI, identifiant n8n Header Auth « Groq », constante GROQ_MODELE
  dans Secours Prep) → « Groq Adapt » (remet au format Gemini, retire <think>) → parseur ; si
  échec → « Diag IA » (quota / saturé / réseau / clé, détail par étage) → Respond IA KO ou
  IA Indispo. Avant la chaîne : « Aiguillage IA » + Switch « Départ IA » (flash / lite / secours)
  selon `staticData.quotaIA` (clé → horodatage de fin : 429 journalier = minuit Pacifique ≈ 9h Paris,
  par minute = 60 s, autre 429 = 5 min ; écrit par Secours Prep, Groq Adapt et Diag). Après chaque
  réponse réussie : « Lisible … » + IF (JSON avec `aliments` pour la vision, texte non vide pour le
  coach) ; illisible = passage au modèle suivant. Le quota mémorisé ne vit qu'en exécution de
  production (workflow actif).
  Parse IA API renvoie `secours` ('gemma'|'groq'|'') ; l'appli l'affiche sur le résultat,
  Telegram ajoute une ligne.
- Réglages en onglets (28/09, 8h18) : Objectif (objectif, écart, activité, objectif de poids),
  Repères (répartition par repas, macros, plafond de purines), Profil, Inviter (administrateur),
  Appli (Raccourci, mise à jour, connexion, compte). `S.regTab` ; tous les panneaux restent dans la
  page, masqués (`hidden`), car les deux boutons Enregistrer (`.g-envoi`) lisent Objectif et Repères
  ensemble ; changer d'onglet ne re-rend pas la page, les saisies en cours restent.

---

## 12. Composer avec favoris (30/09, workflow v38 + appli 08h59)

- Composer : liste compacte (une ligne par aliment : ☆/★, nom, portion · kcal, − / +) au lieu des
  tuiles. Ordre : « ★ Mes favoris » (tous créneaux, alphabétique) puis « Les autres » (les plus pris
  pour le créneau choisi), 15 par 15 (« Voir 15 autres », `S.rac.lim`, `RAC_PAS`) ; la recherche
  porte sur tout. Sélection rappelée en pastilles sous la recherche (✕ retire).
- Barre de validation (`barreCompo`) rendue par `rendre()` **entre `#defile` et `nav`**, hors de la
  zone qui défile : l'ancien `position:sticky` ne tenait pas, `main` a `overflow-x:hidden`.
  Variable `COMPO` posée par `blocComposer` pendant le rendu.
- Favoris : clés `k` du catalogue. Appli : `favListe`, `favBascule`, `favEnvoyer` ; envoi 0,8 s après
  la dernière étoile, action `favoris` `{favoris:[…]}` (liste complète) ; tant que l'envoi n'a pas
  réussi, gardés en localStorage `suivi.favoris` `{l, attente}` et renvoyés au lancement et au retour
  au premier plan.
- Workflow : Users a une colonne `favoris` (JSON en texte). `Auth API` la transmet ; Build API Payload
  renvoie `favoris` (tableau) et remet dans `catalogue` un favori sorti des 300 les plus pris.
  Action `favoris` (18e sortie du Switch) : `Build Favoris API` (nettoyage, 150 max) → `Favoris ecrire?`
  → `Users Favoris API` (appendOrUpdate sur `uid`, colonnes uid et favoris seulement) → `Respond Favoris`,
  erreur → `Respond Ecriture KO`.

## 13. Passe ergonomique (30/09, appli 21h01, rien côté n8n)

- Carte résultat : un bouton principal « Enregistrer · <repas> · aujourd'hui » (`#e-auj`), « Autre jour » et
  « Ne pas enregistrer » en liens.
- Analyse IA : `A.envoiT0`, `etapeIA()` (texte selon le temps écoulé : Gemini < 25 s, autre modèle < 50 s, secours),
  minuterie 1 s qui met à jour `#a-etape` sans re-rendu ; « Analyser plus tard » (`#a-plus-tard`) visible après 15 s,
  même code que `#att-plus` (`mettreEnAttente`) ; `A.envoiId` (jeton) fait ignorer la réponse arrivée après.
- En-tête : complet sur Jour seulement, une ligne (titre de l'écran) ailleurs ; poids cliquable (`#b-pesee`) vers
  Corps › Pesée ; Coach sorti du menu du bas (5 onglets) vers un bouton `#b-coach` de l'en-tête.
- Couleurs de créneau `--c-matin/midi/encas/soir/autre` : Journal, pastilles de Jour › Repas, choix du repas sur la
  carte résultat, onglets de Composer et Refaire. Jour › Repas : « reste N » ou « +N ».
- Coach : `suggestionsCoach(d)`, 3 questions selon le reste du jour, les purines d'hier et la semaine.
- Courbes › Poids : plus de sous-onglets ; courbe, puis « Variation par semaine » (`barresHebdo`), puis besoins en
  une ligne. `S.courbeVue` ne sert plus.
- Journal : `blocRechJn` (texte + filtres Purines élevées ≥ 150 mg par repas, Alcool, Au-dessus de la cible),
  `resultatsJn`, `majRechJn` (sans re-rendu), `chargerPlusLoinJn` (action journal sur 56 jours). La recherche
  s'efface en changeant d'écran.
- Textes : 13 px minimum (hors grilles serrées : purines 7 j, alcool, Nutri-Score, puces), menu du bas 12 px ;
  aides permanentes de Jour repliées dans « Comment lire ce tableau ? ».

## 14. Réglages (30/09, appli 21h17)

- Écart : boutons − / + de 50 kcal (`#g-ec-m`, `#g-ec-p`, bornés à l'objectif) et raccourcis `data-ecp`
  (sèche -300/-500/-750, stabilisation -100/0/+100, prise +200/+300/+500).
- Un seul Enregistrer pour Objectif et Repères : `barreReglages()` rendue entre `#defile` et `nav`, visible dès
  qu'un champ change (`S.regl.sale`) ; messages ok/erreur en tête des deux panneaux. Fermer les Réglages oublie
  les modifications non enregistrées.
- `descActiv(f)` explique le niveau d'activité ; `estimObjectif(d,ob)` donne la date estimée sous l'objectif de poids.
- `totRepart(o)` : total coloré, « il manque / de trop », lien « Ajuster le soir » (`#rp-ajuste`).
- Plafond de purines : raccourcis 300 · crise / 400 · normal (`data-pmx`).
- Titres en double retirés (Objectif, Profil, Invitations) ; « Enregistrer le profil » en bouton plein ;
  Comptes : aide repliée.
- Connexion repliée dans « Connexion (avancé) » (`.rg-cnx`), code d'accès en `type=password` avec `#r-voir`.

## 15. Secours n°3 : Claude Haiku 4.5 payant (01/10, workflow v45 + appli 20h37)

- Ordre des 4 chaînes (Vision API, Vision, Conseil API, Conseil) : Flash → Flash-Lite → **Claude** → Groq → Gemma → Diag.
- `Secours Prep …` construit aussi `claude` (format Anthropic Messages : `system` à part, images en blocs
  `{type:'image',source:{type:'base64',…}}`, rôles fusionnés pour alterner, 1er message forcé `user`,
  température bornée à 1, `max_tokens` 4096 en JSON / 1500 en texte, consigne « uniquement l'objet JSON »).
  Modèle `CLAUDE_MODELE='claude-haiku-4-5-20251001'`.
- Plafond `CLAUDE_MAX_JOUR=10` appels par jour (heure de Paris), compteur partagé par les 4 chaînes dans
  `staticData.claudeJour {jour,n}`, compté au moment où Secours Prep autorise l'appel. Sortie `claudeLibre`,
  `claudeRaison` (« plafond 10/jour atteint » ou « sauté (crédit ou quota) »).
- Nœuds par chaîne : `Claude libre?` → `Claude …` (HTTP POST https://api.anthropic.com/v1/messages, credential
  Header Auth « Claude » = `x-api-key`, en-tête `anthropic-version: 2023-06-01`, 25 s vision / 20 s conseil)
  → `Claude Adapt` (modelVersion `claude:<modèle>`) → `Lisible Claude` → `Claude lisible?` → Parse.
  Échec → `Claude KO` : crédit épuisé (« credit balance ») → `quotaIA.claude` +12 h ; 429 → règle commune ;
  puis `Groq libre?` (qui lit désormais `$('Secours Prep …').groqLibre`).
- Parse IA API / Parse IA : secours `/gemma|groq|claude/`, « Pourquoi » tronqué selon l'étage qui a répondu
  (claude 2, groq 3, gemma 4) ; classes « crédit épuisé », « Claude saturé (529) ». Diag : étage Claude.
- Appli : libellé « Estimé par un modèle de secours (Claude Haiku, payant) ».
- Coût indicatif : ~1 centime par analyse photo, 10/jour max.

## 16. Colonne ia du Journal (01/10, workflow v46 + appli 21h01)

- Journal : colonne `ia` = `flash`, `lite`, `claude`, `groq`, `gemma`, `manuel`, `code-barres` (vide pour les repas antérieurs).
- Parse IA API / Parse IA : `iaDe(modelVersion)` (préfixe `claude:`/`groq:`/`gemma:`, sinon « lite » ou « flash » dans le nom Gemini) ;
  réponse `ia` vers l'appli, ligne Telegram `ia` (Clean Row la transmet, Journal Append en mappage auto).
  Message Telegram : « Estimé par Claude (secours) : vérifie les quantités. »
- Build Ligne API : liste blanche `IA_OK`, mappage `ia` dans Journal Append API. Build API Payload / Build Journal API relisent `ia`.
- Appli : `ia` envoyé par les 3 chemins `enregistrer` (`r.ia`) ; `resultatDepuis` pose `manuel`, le scan `code-barres` ;
  « Modifier » depuis le Journal garde l'`ia` d'origine. `tagIA(r)` / `IA_LIB` : étiquette `.ia-tag` en fin de ligne des macros
  (Journal et recherche), `.sec` ambre pour les secours, séparateur et étiquette insécables (`.ia-w`).

## 17. Profil IA dans Ajouter et routeur (01/10, workflow v48 + appli 21h50)

- Appli : accordéon « Profil IA » sous Analyser (`blocProfilIA`, `S.pia {ordre, actif}`, `S.piaOuv`). Préréglages `PIA_PRE` :
  Défaut (flash, lite, haiku, groq, gemma), Gratuits (sans haiku), Claude d'abord (haiku en tête), Complexe (sonnet seul) ; sinon « Sur mesure ».
  Flèches ↑↓ (`data-pia-h/b`), interrupteurs (`data-pia-s`). Envoyé en `ia_ordre` avec l'action `repas` (aussi en mode ajout d'aliment
  et dans la file « Analyser plus tard », qui garde le profil du moment). `rendre()` remet Défaut dès qu'on n'est plus sur Ajouter (ou Réglages ouverts).
  Aucune IA active → analyse bloquée. `etapeIA` nomme la première IA de la liste.
- Étiquettes : Flash, Flash-Lite (gris), Claude Haiku, Claude Sonnet, Groq, Gemma (orange), manuel, code-barres. `ia='claude'` = Haiku (compatibilité), `ia='sonnet'`.
- Workflow, chaîne appli « Vision API » seulement (Telegram et coach inchangés, plafond porté à 20) :
  Build Vision API → `Secours Prep Vision API` (une fois : requêtes gemma, groq, claude=Haiku, sonnet=`claude-sonnet-5-5` sans température,
  réflexion adaptative par défaut ; `ordre` validé, Défaut si absent ; `t0`) → `Routeur IA Vision API` → `Aiguille IA Vision API` (Switch par `cible`).
  Chaque échec (sortie erreur, réponse illisible, `Claude KO`, `Sonnet KO`) revient au Routeur, qui prend la prochaine IA non encore exécutée
  (détection par `$(nœud).first(0|1)`), saute celles en quota, plafond (`CLAUDE_MAX_JOUR=20`, Haiku + Sonnet, compteur `staticData.claudeJour`)
  ou sans le temps (délai du modèle + écoulé > 115 s). Plus rien → Diag (étapes dans l'ordre choisi, `raisons` du Routeur).
  Supprimés : Aiguillage IA Vision API, Départ IA Vision API, Claude/Groq/Gemma libre? Vision API.
- Parse IA API : `secoursDe` = l'IA qui a répondu n'est pas la première choisie (hors Gemini) ; « Pourquoi » = IA choisies essayées avant elle (`avantDe`).
- Test de la boucle : `t49.js` (simulateur qui exécute les vrais nœuds Code et simule les HTTP).

## 18. Groq avant Haiku, disjoncteur Gemini, Journal par aliment, graphique des IA (01/10, workflow v49 + appli 22h17)

- Ordre Défaut partout : Flash → Flash-Lite → Groq → Claude Haiku → Gemma. Appli : `PIA_PRE.defaut`, `ORDRE_DEFAUT` (Secours Prep Vision API).
  Telegram et coach : Secours Prep → Groq libre? → (échec) → nouveau nœud `Claude quota <chaîne>` (crédit, quota, plafond 20/jour, compte l'appel)
  → Claude libre? → Claude → (échec) → Gemma libre?. Secours Prep ne compte plus Claude.
- Disjoncteur dans `marquer()` (tous les nœuds) : Gemini (flash/lite) en 5xx ou délai deux fois en 10 min → `quotaIA` +5 min, `panneJusqua` ;
  une seule panne comptée par exécution (`$execution.id`, le Routeur repasse plusieurs fois). Raison « sauté (en panne, réessai sous 5 min) ».
- Build API Payload renvoie `ia_jours` [{d, c:{ia:n}}] (400 jours, '?' = sans info).
- Appli Journal : filtres `JN_F` pur/alc/sat/na par aliment (`JN_S` : purines_risque ≥ 150 mg, alcool > 0, saturés ≥ 5 g, sodium ≥ 600 mg),
  `alimentsFiltres`, tri `S.jn.tri` (Récents / Plus élevés). Repas entier seulement si aucun aliment ne porte la valeur.
  Accordéon `blocStatsIA` (`S.jn.iaOuv`, `iaPer`, `iaSel`) : barres horizontales par IA, vert `--ia-g` gratuit, ambre `--ia-p` payant (couleurs validées clair/sombre).
- Tests : `sim.js` (exécuteur n8n minimal), `t50.js` (4 chaînes + disjoncteur), `t51.js` (ia_jours).

## 19. Coach : tableau de bord et consignes de coaching (01/10, workflow v50, appli inchangée)

- Nouveaux nœuds, appli : Read Params CA → `Read Activite Coach API` → `Read Crises Coach API` → `Tableau Coach API` → Build Conseil API ;
  Telegram : Add Poids Stats C → `Read Activite Coach TG` → `Read Crises Coach TG` → `Tableau Coach TG` → Build Conseil Body (lectures executeOnce, alwaysOutputData).
- `Tableau Coach` (même code, noms de nœuds en tête) calcule : trajectoire (départ, actuel, rythme 4 semaines, palier de 5 kg, objectif et date estimée),
  cible du jour comme l'appli (besoins + écart), repères (fibres 30/25 g, saturés et sucres ajoutés 10 % de la cible, sodium 2 000 mg, purines max, 2 verres/jour),
  moyennes 7 et 30 jours, LEVIER N°1 (plus gros écart aux repères), séries (jours sous la cible, sans alcool, semaine vs 3 précédentes, semaines sans crise),
  pas (moyennes, meilleure journée, objectif `OBJECTIF_PAS=8000`, palier de la semaine = moyenne 7 j + 1 000 arrondi à 500), tableau des 14 jours,
  aliments qui pèsent le plus sur 30 jours et aliments fréquents (colonne aliments).
- Builders : tableau ajouté au contexte, consignes « COMMENT COACHER » (A à F : chiffres du tableau, un levier, une action chiffrée avec ses aliments, motivation ancrée,
  après un écart, palier de pas, alcool en verres, ton). Réflexion Gemini laissée en « low » (au-dessus, échecs).
- Test : `t52.js`.

## 20. Photos : import photothèque, miroir, retourner (02/10, appli 07h54, rien côté n8n)

- Corps › Photos : `#k-ph-import` + `#k-ph-fichier` (input file sans capture) → `importerPhoto(f,type)` : date EXIF DateTimeOriginal (`dateExif`, JPEG APP1)
  sinon date du jour « à vérifier », redimension 1080 px JPEG 0,82, écran de validation (`S.cam.import`) : type Face/Profil, date (≤ aujourd'hui), ↔ Retourner, Garder.
  Envoi action `photo` avec cette date (le serveur accepte une date passée ; une photo par jour et par type, la même date remplace).
- Caméra : `S.cam.miroir` réglable (bouton ↔ Miroir, mémorisé par caméra dans `suivi.cam` : `miroir_user`, `miroir_environment`), la capture suit l'aperçu ;
  ⇄ Mode selfie / Caméra arrière (getUserMedia `facingMode: exact`, repli `ideal`) ; ↔ Retourner sur la photo prise (`retournerCapture`).
- e2e : test d'import ; le test « chercher plus loin » tient compte du jour de la semaine.
- (02/10, appli v46) Revue d'une photo prise ou importée : `boutonsRevue` (↔ Retourner, ◧ Comparer au jj/mm, Annuler, Reprendre, Garder),
  `camPrec` = dernière photo du même type datée avant la nouvelle (aujourd'hui pour une prise, date choisie pour un import), `vueRevue` : modes Glisser
  (clip-path) et Superposer (opacité), curseur `#cam-cmp-r`. Annuler ferme sans enregistrer.
- (02/10, appli v47) Aides au cadrage dans la prise de vue : 2e rangée Repères / Niveau / Auto 90 % (mémorisés dans `suivi.cam`).
  Repères : 4 lignes tête/épaules/hanches/pieds déplaçables au doigt, mémorisées par type dans `suivi.reperes` (défaut 12/28/50/74 %), fantôme à 22 % quand elles sont actives.
  Niveau : gravité (`devicemotion`, permission iOS via `DeviceMotionEvent.requestPermission`), angles gauche/droite et avant/arrière comparés
  à l'inclinaison mémorisée avec la dernière photo du même type (`suivi.tilt`, enregistrée quand on garde une prise de vue), sinon verticale ; OK sous 1,5°.
  Score : contours (gradients) de l'image en direct et de la photo précédente réduites à 36×64, corrélation à décalage nul, recherche de décalage ±4/±5 et d'échelle 0,92/1/1,08
  pour le conseil (décale-toi, monte/baisse le téléphone, rapproche-toi/recule) ; pourcentage = (r − 0,1)/0,6. Auto : ≥ 90 %, sans conseil et de niveau si affiché, pendant 1,5 s → prise.
- (02/10, appli v48, repart de la v46) Option C retirée (repères, niveau, score, auto). Fantôme en contour : `calculerContour` (flou 3×3, Sobel,
  seuil adaptatif = 9 % des bords les plus nets, PNG transparent vert #7CFFB0), bouton 👤 Contour / Photo / Aucun (`S.cam.fantMode`, mémorisé `suivi.cam.fantome`).
  Libellés courts : ⇄ Arrière / Selfie.
- (02/10, appli v49) Import photothèque : « ✂ Recadrer » (`vueRecadrage`, `rcBrancher`, `rcValider`) : cadre au format de la photo précédente du même type
  (sinon 3:4), fantôme contour / photo / aucun (même bouton 👤), glisser + pincer + curseur de zoom 0,5 à 4 (bandes noires sous 1), sortie JPEG max 1080 px de haut.

## 21. Gestion des photos : vignettes, remplacer, changer la date, supprimer (02/10, appli v50 + workflow v52)

- Appli : sous le comparateur, vignettes du type affiché (`#k-vg`, classes `.phv`, `data-vg` = date). Toucher une vignette → volet `#ph-hote`
  (`ouvrirVolet`) : Voir en grand (`voirEnGrand`), Remplacer par une prise (`ouvrirCamera(type,date)`), Remplacer depuis la photothèque
  (`phRemplacement` puis `importerPhoto(f,type,date)`), Changer la date (`changerDatePhoto`, prévient si le jour est déjà pris), Supprimer (`modaleConfirm`).
  Remplacement : `S.cam.dateForcee` = date de la photo ; fantôme, contour, recadrage et « Comparer » se calent sur la dernière photo AVANT cette date ;
  envoi action `photo` à cette date (upsert sur `cle`). `hydraterPhotos` : 40 photos par passage.
- n8n : action `photo_gerer` {op:'suppr'|'date', type, date, nouvelle_date}. Read Mesures PG → Build Photo Gerer API (ligne de l'utilisateur, row_number)
  → Photo Gerer ok? → Photo Date? (date : Photo Date Upsert API sur la nouvelle `cle`) → Photo Suppr Ligne API (delete rows, row_number)
  → Archive a effacer? → Photo Suppr Archive (Telegram deleteMessage) → Reponse Photo Gerer (archive = vrai si Telegram a réellement effacé) → Respond Photo Gerer.
- Colonne `fichier` : `file_id#chat:message` pour les photos enregistrées à partir de la v52 (Photo Row API). Build Photo Get retire la partie après `#`.
  Telegram n'efface que les messages de moins de 48 h : au-delà (et pour les photos d'avant la v52) la copie archivée reste, l'appli le dit.
- Tests : `t53.js` (n8n), `t_v50.js` (Playwright), e2e : bloc gestion des photos.
- (02/10, appli v51) « ✂ Recadrer » aussi après une prise en direct (même vue `vueRecadrage`, calée sur le contour ou la photo précédente) ; Reprendre remet le recadrage à zéro. Test `t_v51.js`.
- (02/10, appli v52) « ▶ Voir l'évolution » (dès 2 photos du type affiché) : plein écran `#evo-hote` (`ouvrirEvolution`, `S.evo`), photos chargées une par une puis lecture
  automatique (tenue 900 ms, fondu 800 ms, arrêt sur la dernière), curseur de temps `#evo-t` (0 à n-1, fondu continu entre 2 photos, met en pause), ▶/⏸,
  étiquette date + poids, courbe du poids aux dates des photos alignée sur le curseur. Tests `t_v52.js` + e2e.
- (02/10, appli v53) Rangée de dates `.pdt` : vue générale `#k-pdt` (« ◧ Avant / après » ou une date → `S.corps.vue1`, une seule photo entière `#k-une`,
  image prise dans `photoMem` pour un affichage immédiat, remis à zéro au changement de type) ; écran Évolution `#evo-dts` + clic sur la courbe :
  saut direct sans fondu (lecture en pause), puce active seulement quand le curseur est pile sur une photo. Test `t_v53.js` + e2e.
- (02/10, appli v54) `S.corps.pmode` ('une' | 'cmp') + `S.corps.vue1` (date voulue). Changer Face/Profil garde le mode et la date ; sans photo ce jour-là,
  la plus proche (égalité : la plus ancienne), la date voulue reste mémorisée. `S.corps.phInit` remis à faux par le menu du bas, les onglets de Corps et
  le bouton poids : à l'arrivée, dernière photo de face seule (de profil s'il n'y a aucune face). Nouvelle photo enregistrée : affichée seule. Test `t_v54.js` + e2e.

## 22. Invitations sur iPhone : compte créé au mauvais endroit (02/10, appli v55 + workflow v53)

- Cause : sur iPhone, l'appli de l'écran d'accueil a sa propre mémoire (séparée de Safari et du navigateur de WhatsApp). Un compte créé via
  « Continuer ici sans installer » restait dans Safari/WhatsApp ; dans l'appli installée le code était refusé (« déjà servi »).
- Appli : `estIOS()`. Sur iPhone hors appli installée, la page d'accueil n'a plus « Continuer ici sans installer » (avertissement à la place) ;
  le bouton reste sur Android et ordinateur. Filet : `entrer` hors appli installée sur iPhone → écran `accesPourAppli` (« Copier mon accès pour l'appli »,
  lien `#acces=JETON&api=…`) ; `lireInvite` reconnaît `acces=` et Coller / Continuer connectent directement ; un lien `#acces=` ouvert connecte aussi.
  Message « déjà servi » expliqué (compte sûrement déjà créé, demander un lien de reconnexion).
- n8n : Build Invite API, même message côté serveur.

## 23. Mises à jour de l'appli chez les autres utilisateurs (02/10, appli v56, sw inchangé hors VERSION)

- Avant : la nouvelle version n'était cherchée qu'au lancement à froid ; sur iPhone l'appli reprend souvent sans relancer, donc retard de plusieurs jours.
- `controlerMaj(delai)` : `registration.update()` au lancement, à chaque retour dans l'appli (au plus toutes les 10 min) et toutes les 30 min si elle reste ouverte.
- `controllerchange` : rechargement immédiat si rien d'important (`majOccupe` : caméra, scan, écran Ajouter, inscription, modale, volet photo,
  évolution, champ en saisie) ou si on a touché Actualiser (`majDemandee`) ; sinon bandeau `#maj-bandeau` « Nouvelle version… Mettre à jour »,
  et rechargement à la prochaine sortie de l'appli. Pas de rechargement au tout premier lancement. Test `t_v56.js` (vrai service worker sur localhost).

## 24. Repères qualité réglables (02/10, appli v57 + workflow v54)

- Feuille Params : 4 colonnes `fibres_min`, `satures_max`, `sucres_max`, `sodium_max`. 0 = calcul automatique ; case vide (lignes écrites par
  Telegram ou une ancienne appli) = ignorée, on garde la dernière valeur écrite.
- n8n : `sortParams` (15 nœuds) lit `qual:[fibres,saturées,sucres,sodium]` (null si vide) ; Build Params API valide `reperes` (fibres 10-60 g,
  saturées 5-80 g, sucres 5-150 g, sodium 500-5000 mg) et écrit les 4 colonnes (Params Append API) ; Build API Payload renvoie `reference.reperes` ;
  Tableau Coach API/TG utilisent les repères réglés (REPERES du tableau du coach).
- Appli : `QREG`, `reperesReg`, `seuilsAuto`, `seuilsQualite` (valeur réglée sinon auto, drapeau `auto`). Réglages › Repères : bloc « Repères qualité »
  (grille 2×2, case vide = Auto avec la valeur calculée en placeholder) ; saisie gardée si l'enregistrement est refusé (`S.regl.qr`). Tests `t54.js`, `t_v57.js`.

## 25. IA payantes pilotées par l'administrateur (03/10, appli v58 + workflow v55)

- Feuilles : colonne `ia_payante` dans Users et dans Invitations (oui / non ; vide = non). Un administrateur a toujours droit aux IA payantes.
- n8n : Auth API et Auth (Telegram) exposent `ia_payante`. Secours Prep Vision API retire haiku/sonnet de l'ordre si non (liste vide → les 4 gratuits) ;
  Claude quota Conseil API / Vision / Conseil refusent Claude (« IA payantes coupées par l administrateur ») ; tâches planifiées sans Auth lisible : autorisé.
  Compteur `staticData.claudeMois[AAAA-MM][uid]={a,c}` (a = analyses, c = coach), incrémenté à chaque appel Claude (Routeur et Claude quota), mois courant seul.
  Build Admin API : op `ia` {uid,on} (refusé pour un admin) → `majUser` → Admin IA? → Users IA A (appendOrUpdate sur uid, seule colonne ia_payante) ;
  `inviter` {ia} → Invitations.ia_payante ; comptes renvoient `ia` et `claude:{a,c}`. Build Invite API recopie le choix dans Users.ia_payante (Users Add I).
  Payload : `profil.ia_payante`.
- Appli : `iaPay()`, `piaPre()` ; invité à Off : Claude Haiku/Sonnet verrouillés (🔒 « coupé par l'administrateur »), seul le profil Défaut (4 gratuits),
  `piaListe` sans payants. Réglages › Inviter : interrupteur IA payantes à la création (Off par défaut) et par compte (admin bloqué à On), compteur du mois
  (orange à partir de 20). Tests `t55.js`, `t_v58.js` ; fixtures t49/t50 avec `ia_payante:true`.
- (03/10, appli v59 + workflow v56) Compteur séparé par modèle : `claudeMois[mois][uid]={a,c,h,s}` (h = Haiku, analyses + coach ; s = Sonnet).
  Appli : `PRIX_CLAUDE={h:0.01,s:0.05}` €, `consoClaude` (anciens compteurs sans h/s : h = a + c), ligne « Ce mois : Haiku n · Sonnet n · ≈ x € »
  (orange dès 1 €) et ligne « Total Claude ce mois ». Tests `t56.js`, `t_v59.js`.
- (03/10, appli v60 + workflow v57) Trois niveaux d'IA payantes : `ia_payante` = vide/non (aucune), `haiku` (Haiku seul), `oui` (Haiku + Sonnet).
  Auth API : `ia_niveau`, `ia_haiku`, `ia_sonnet` ; Telegram n'utilise que Haiku (niveau haiku suffit). Secours Prep retire chaque modèle non permis
  (liste vide → Défaut avec Haiku si permis). Admin : op `ia` {uid, niveau} (compat `on`), `inviter` {niveau}, comptes renvoient `niveau`.
  Appli : `iaOk(k)`, `piaPre` sans les profils qui utilisent un modèle interdit ; Réglages › Inviter : sélecteur Aucune / Haiku / Haiku + Sonnet
  (`nivIA`) par compte et à l'invitation. Tests `t57.js`, `t_v60.js`.
- (03/10, appli v61 + workflow v58) Réglages › Inviter refait (maquette B) : résumé du mois (`.adm-sum`, barre Haiku/Sonnet en euros),
  bouton « ＋ Inviter quelqu'un » en haut, une ligne par compte (`.adm-r`, initiale, pastille de niveau Gratuit / Haiku / H + S, montant),
  invitations en attente avec leur niveau (Build Admin API renvoie `niveau` des invitations). Volets `#adm-volet` (`admVolet`, `voletCompte`,
  `voletInvitation`) : stats du mois, trois choix Aucune / Haiku / Haiku + Sonnet, lien de reconnexion ; administrateur bloqué. Tests `t_v61.js`, e2e.
- (05/10, appli v62) Corps › Pas : trois tuiles (`.prog.trois`) Aujourd'hui / Moy. 3 j / Moy. 7 j ; moyennes sur les derniers jours enregistrés
  hors aujourd'hui ; sous le 3 j, tendance vs 7 j (↑ vert / ↓ orange, « = 7 j » sous 3 %, pas de comparaison avec 3 jours de données ou moins).
  Ligne kcal : moyenne 3 jours et 7 jours. Tests `t_v62.js`, e2e (données de pas synthétiques).
- (05/10, appli v63) Courbes : période « 3 j » ajoutée (`[3,7,14,30,90,0]`, mémorisée dans `suivi.courbes`), valable pour Poids, Calories, Purines et Qualité. Test `t_v63.js`, e2e.
- (08/10, appli v64) Plancher du métabolisme rendu visible : la cible vaut max(métabolisme, besoins + écart) (Build Params API et payload).
  Un écart réglé au-delà de besoins − métabolisme est enregistré mais raboté. `ciblePrevue` renvoie `brut`/`plancher` ; l'aperçu des Réglages
  affiche « Besoins − écart = brut, sous ton métabolisme : cible = métabolisme, écart réel… » ; l'écran Jour ajoute sous le badge
  « Écart réglé X, limité à Y » quand `reference.ecart_kcal` < `reference.ecart`. Test `t_v64.js`, e2e (ancien texte trompeur corrigé).
- (08/10, appli v65 + workflow v59) Plancher assoupli : cible = max(90 % du métabolisme, besoins + écart), partout côté serveur (19 calculs :
  `cibleDyn` des 15 nœuds, Build Params API, Build Invite API, Tableau Coach API/TG) et dans l'appli (`PLANCHER_MB=0.9`, `ciblePrevue`).
  Avertissement (`AVERT_MB`) dès que la cible passe sous le métabolisme, dans les Réglages et sur l'écran Jour ; message « limité » si l'écart
  réglé dépasse le plancher. Les cibles se recalculent seules (écart enregistré dans Params) : pas besoin de réenregistrer. Tests `t59.js`, `t_v65.js`, e2e.
- (08/10, appli v66) Messages jaunes retirés de l'écran Jour (plancher et avertissement) : ils restent dans Réglages › Objectif. Test `t_v66.js`.

## 26. Photo de menu dans le Coach (08/10, appli v67 + workflow v60)
- Onglet Coach : boutons appareil photo / galerie (`#c-cam`, `#c-gal`). La photo est compressée par `redim(f,{max:1400,plafond:650000,min:1100})`
  (plus grande que pour un repas, le texte d'un menu doit rester lisible), puis envoyée avec l'action `menu` (120 s, sans nouvel essai).
- Workflow : nouvelle sortie `menu` du Switch `Action` (index 19, ajoutée en dernier) → `Build Vision API` → chaîne IA Vision existante
  (mêmes modèles, ordre `ia_ordre`, disjoncteur, plafond Claude, droits `ia_payante`) → `Parse IA API` → `Respond Repas`.
  `Build Vision API` choisit le prompt de menu quand `action==='menu'` et marque `menu:true`. Les plats reviennent de l'IA sous la clé `aliments`
  (les contrôles « Lisible » de la chaîne l'exigent) et `Parse IA API` les renvoie sous `plats`. Pas de nouvelle colonne Sheets, rien n'est écrit.
- Réponse : `{ok, menu:true, plats:[{nom,description,kcal,prot,lip,gluc,confiance}], illisible:[...], note, ia, secours, echecs}` (80 plats au maximum).
- Appli : `bulleMenu()` affiche le tableau dans le fil (tri : ordre du menu, moins de kcal, plus de protéines) ; le message garde le tableau
  dans `S.coach.fil` (localStorage), mais seul son texte part dans `historique`. Le bouton « + » appelle `platVersRepas()` : le plat s'ajoute au repas
  en cours de l'onglet Ajouter (ou crée un repas), puis l'enregistrement habituel s'applique.
- Tests : `n8n/tests/t_menu.js` (18 vérifications), section « Coach : photo d'un menu » de `tests/e2e.mjs` (13 vérifications).
- À vérifier en réel : Groq (`max_tokens` 4096) peut tronquer un très long menu, l'étape « Lisible » passe alors au modèle suivant.


## 27. Marge de marche sur l'écran Jour (09/10, appli v68)

- Écran Jour : sous le héros, une ligne repliable (`#pas-t`, style `.pia-t` comme le Profil IA) « 11 200 pas aujourd'hui · +196 kcal gagnées ».
  Dépliée (`S.pasOuv`), elle donne la moyenne 7 jours, les pas en plus, les kcal et rappelle que la cible ne change pas.
- Calcul (`bonusPas(d)`) : (pas du jour − moyenne des 7 jours précédents) × `kcalParPas(d)`, bas de la fourchette de Corps › Pas (sans le +20 %).
  Seuls les pas au-delà de la moyenne comptent : le niveau d'activité des Réglages inclut déjà la marche habituelle, donc compter tous les pas ferait un doublon.
  Rien n'est affiché sans pas du jour, sans poids ou taille, avec moins de 3 jours d'historique, ou si le bonus est nul ou négatif.
- La cible, l'anneau, la pastille et le « reste » par repas ne changent pas (variante A choisie sur maquette). Appli seule : ni workflow, ni Telegram, ni colonne Sheets.
- Tests : section « Jour : marge de marche » de `tests/e2e.mjs` (7 vérifications).

## 28. Journal : filtre « Au-dessus de la cible » (09/10, appli v69)

- Cinquième pastille de `JN_F` (`cib`), à côté de Purines, Alcool, Saturés, Sodium. Elle liste des **jours** (et non des aliments) : `joursAuDessus(d,q)`.
- Un jour compte s'il est terminé (le jour en cours est exclu), valide, et que `kcal` dépasse la cible du jour (`cible` du jour, sinon `d.cibles.kcal`).
  Une ligne par jour : date, kcal / cible, écart « +N » en orange, détail Matin / Midi / Soir issu des repas déjà chargés.
- Tri Récents / Plus élevés (par écart) ; le texte de recherche garde les jours où un repas contient le plat. Appli seule : ni workflow, ni Sheets, ni Telegram.
- Tests : bloc « Journal : au-dessus de la cible » de `tests/e2e.mjs` (7 vérifications) ; l'ancien test « 4 filtres » est remplacé par « 5 filtres ».

## 29. Coach : 4 questions toutes prêtes qui tournent (09/10, appli v70)

- `suggestionsCoach(d)` renvoie jusqu'à 7 questions (restantes ou dépassement, purines d'hier ou collation, semaine, protéines du jour, objectif de poids, dîner léger, fringales) ;
  `suggestionsAffichees(d)` en montre 4. Toucher une question l'envoie, la fait disparaître et la remplace par la suivante, jamais une déjà posée tant qu'il en reste.
- `S.coach.posees` (indices, en mémoire seulement) : les questions posées passent après les autres, la plus ancienne revient en premier ; « Vider » le remet à zéro.
  Les indices servent parce que le texte de la première question change avec la journée.
- Appli seule. Tests : 4 vérifications dans la section Coach de `tests/e2e.mjs`, l'ancien « 3 questions » devient « 4 questions ».

## 30. Coach : la conversation s'efface quand on le quitte (09/10, appli v71)

- `viderCoach()` (appelée seulement si `S.vue==='coach'`) vide `S.coach.fil`, `S.coach.posees` et la clé `suivi.chat` du localStorage.
  Elle est appelée par les boutons de la barre du bas et par le raccourci pesée (`#b-pesee`).
- Pas effacée : ouverture des Réglages (le Coach reste l'écran sous-jacent) et le « + » d'un plat de menu, qui envoie vers Ajouter en gardant le tableau
  pour y revenir ajouter un autre plat. Le bouton « Effacer la conversation » reste disponible.
- Pas de réglage pour garder les conversations : effacement toujours actif. Appli seule. Tests : 3 vérifications dans la section Coach de `tests/e2e.mjs`.

## 31. Scan de plusieurs produits d'affilée (09/10, appli v72)

- Le scanner reste ouvert : chaque code reconnu (action `barcode`, inchangée) s'ajoute au panier `S.ajout.scan.lot` (`{p,g}`) avec sa portion, 100 g sans portion connue.
  `onCodeScanne` ne fait **aucun `rendre()`** (il détruirait la vidéo) : le panier (`#scan-lot`), le bandeau (`#scan-toast`) et les boutons sont mis à jour à la main par `majPanierScan`.
- Anti-doublon : un code revu dans les 3 s (`SC.vus`, date mise à jour à chaque vue) est ignoré, il faut le quitter 3 s pour le rescanner. Produit introuvable : bandeau orange, le scan continue.
- « Terminer » (`terminerScan` → `utiliserProduits`) crée un repas avec un aliment par produit, ou greffe les produits sur le repas en cours en mode « Ajouter un aliment » ;
  les quantités se règlent ensuite avec les − / + de l'écran de repas. « Annuler » demande confirmation si le panier n'est pas vide.
- Supprimé : l'ancien panneau de quantité après un scan (portion / paquet / autre, `sc-valide`…). Le détail du Journal d'un repas scanné devient « Nom Marque (125 g) ».
- Appli seule : ni workflow, ni Sheets, ni Telegram. Tests : section « Scan de plusieurs produits d'affilée » de `tests/e2e.mjs` (12 vérifications, caméra simulée par `onCodeScanne`).

## 32. IMC dans Corps › Mesures (09/10, appli v73)

- Bloc `blocIMC(d)` en tête de l'onglet Mesures : IMC actuel = dernier poids / (taille en m)², zone OMS (`IMC_Z` : 18,5 / 25 / 30 / 35), trois cartes Début (première pesée, si plus d'une), Maintenant, Objectif (si `objectif_poids`).
- Chaque carte montre une photo de corpulence `img/imc/{h|f}-{24,27,30,33,36}.webp` (palier le plus proche, `imgIMC`), choisie selon `profil.sexe`. Images générées par IA et fournies par Samuel, découpées en webp d'environ 15 Ko.
- Jauge des zones (échelle 15 à 40, repères début / maintenant / objectif) et courbe SVG `courbeIMC` (fonds par zone, ligne d'objectif).
- Rien n'est stocké : l'IMC est recalculé à l'affichage. Pas de bloc sans taille ou sans pesée. Ni workflow, ni Sheets. Tests : section « Corps : IMC » de `tests/e2e.mjs` (9 vérifications).
