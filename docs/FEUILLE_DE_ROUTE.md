# Agent Nutrition : feuille de route

Mise à jour du 09/10/2026 (appli v74, workflow v60). La partie « Historique » plus bas est la feuille de route
d'origine (27-28/09), conservée pour les décisions qu'elle contient.

## Ouvert

- [ ] Clé Gemini en credential n8n (Header Auth `x-goog-api-key`) au lieu de l'en-tête en clair : reportée par Samuel.
  Si on le fait : créer le credential dans n8n, demander son ID, remplacer l'en-tête dans tous les nœuds Gemini/Gemma.
- [ ] Pas des invités : ils ne remontent que via un Raccourci iOS. Piste retenue : partager le Raccourci de Samuel
  avec une question à l'importation pour le code du compte (rien à coder côté appli).
- [ ] Correctif IPv6 du VPS (`NODE_OPTIONS=--dns-result-order=ipv4first`) seulement si les « host unreachable » reviennent.
- [ ] Telegram : messages encore non adaptés à l'objectif prise de masse / stabilisation (hors bilan du lundi).

## Plus tard (priorité 2 et 3)

- Export PDF pour le médecin (poids, purines, alcool sur 3 mois).
- Raccourci Siri « ajoute mon petit-déj habituel ».
- Volume : archiver le Journal par année, envoyer le catalogue à part quand la lecture complète deviendra lente.
- Bascule vers PostgreSQL sur le VPS n8n, seulement si des lenteurs apparaissent (étudiée le 08/10, non lancée).
  Seul le workflow change : 86 nœuds Google Sheets sur 446, à faire par étapes en commençant par Journal et Poids
  (30 nœuds, l'essentiel du gain). Seuil de gêne estimé vers 10 000 lignes de Journal (333 le 08/10, ~3 100 par an),
  l'action `data` approchant alors la coupure de 25 s. À prévoir : outil d'admin (Adminer, NocoDB), `pg_dump` planifié,
  credential Postgres (demander l'ID).

## Écarté ou seulement discuté

- Suivi de l'eau : écarté (trop pénible).
- Appli payante sur l'App Store, TestFlight (99 €/an, versions valables 90 jours) : discuté le 02/10, non retenu.
  La PWA installée depuis Safari reste le mode de distribution.

## Fait depuis le 28/09 (détail dans `docs/ARCHITECTURE.md`, sections 12 à 31)

Favoris et composition, passe ergonomique, Réglages en onglets, secours IA payants (Claude Haiku, Sonnet), colonne `ia`
du Journal, profils IA, Groq et disjoncteur Gemini, tableau de bord du coach, photos d'évolution (import, recadrage,
fantôme, gestion, évolution animée), invitations fiables sur iPhone, mises à jour automatiques, repères qualité réglables,
IA payantes par compte avec compteur en euros, pas en moyennes 3 j / 7 j, période 3 j des Courbes, plancher de la cible
à 90 % du métabolisme, photo de menu dans le Coach (tableau kcal et macros par plat), marge de marche sur l’écran Jour, filtre « au-dessus de la cible » dans le Journal, 4 questions tournantes dans le Coach, conversation effacée à la sortie du Coach, scan de plusieurs produits d’affilée, IMC avec silhouettes et courbe dans Corps › Mesures, icônes de couleur partout, calendrier des 7 derniers jours, en-tête allégé.

---

# Historique : feuille de route d'origine (27-28/09)

## Étape 1 — Robustesse (FAIT le 27/09, workflow v32 + appli 22h41)
- [x] Identifiant unique par repas (colonne `id` du Journal, écriture « ajouter ou mettre à
  jour » sur `id`). Plus de doublon au rejeu, modification = mise à jour de la même ligne,
  suppression exacte. L'enregistrement est de nouveau rejoué automatiquement.
- [x] Workflow « Agent Nutrition Alertes » : message Telegram à l'admin à chaque exécution en
  erreur, 1 message max par nœud toutes les 30 min.
- [ ] Correctif IPv6 du VPS (`NODE_OPTIONS=--dns-result-order=ipv4first`) : seulement si les
  « host unreachable » reviennent malgré les nouveaux essais. Côté Samuel.
- [x] Fenêtre des alertes acide urique : 7 jours de calendrier (avant : 7 jours saisis + aujourd'hui).
- [x] Telegram : purines « à risque » dans le message d'analyse et dans le bilan du jour.
- [ ] Clé Gemini en credential n8n : reportée par Samuel.

## Étape 2 — Motivation (FAIT le 27/09)
- [x] Objectif de poids (Réglages, colonne `objectif_poids` de Params) et carte Objectif sur
  l'écran Jour : reste à perdre, progression, date estimée au rythme actuel (pente des pesées
  sur 28 jours) et au rythme prévu par la cible.
- [x] Bilan hebdomadaire : lundi 8h07 sur Telegram + carte « Semaine dernière » en tête du Journal.
- [x] Rappels de saisie : 14h03 (rien noté aujourd'hui) et 21h03 (pas de dîner noté).

## Étape 3 — Dette (FAIT le 27/09)
- [x] Bibliothèque de calculs unique : une seule version, recopiée à l'identique dans les 13
  nœuds par le script de construction (fichier de référence `lib_calculs_n8n.js`). Le module
  externe chargé par n8n a été écarté : il demande une modification du VPS et casserait tous
  les nœuds si elle manquait.
- [x] Alignement Telegram / appli sur les purines à risque.
- [x] Tests de non-régression dans le dépôt : `tests/e2e.mjs` (données fictives).
- [x] Sauvegarde hebdomadaire : dimanche 3h17, JSON de toutes les feuilles envoyé à l'admin sur
  Telegram (jetons retirés).

## Écrans (FAIT le 28/09)
- [x] Jour version C : anneau, pastille, barres de macros, onglets Repas / Tendance / Purines / Objectif.
- [x] Courbes : période commune, onglets Poids / Calories / Purines, tuiles de synthèse.
  Pesée déplacée en tête de Corps.

## Santé (FAIT le 28/09 à 08h08, workflow v34)
- [x] Graisses saturées, fibres, sodium, sucres ajoutés : Jour (qualité du jour) et Courbes (onglet Qualité).
- [x] Journal des crises de goutte avec analyse des 3 jours avant, dans Corps (désormais en onglets).
- Écartés par Samuel : suivi de l'eau (trop pénible). Restent possibles : analyses de sang, sommeil,
  fréquence cardiaque, séances de sport (via Raccourci), tension.

## Plus tard (priorité 2 et 3)
- Budget du jour ajusté aux pas (affichage « cible + X kcal gagnées en marchant »).
- Repas favoris nommés, épinglés en tête de « Refaire un repas ».
- Export PDF pour le médecin (poids, purines, alcool sur 3 mois).
- Raccourci Siri « ajoute mon petit-déj habituel ».
- Volume : archiver le Journal par année et envoyer le catalogue à part quand la lecture
  complète deviendra lente (au-delà de quelques milliers de lignes).

## Chantier « Compte sans Telegram + objectif sèche / stabilisation / prise de masse »

Décidé le 28/09/2026. **FAIT le 28/09 à 07h06** (workflow v33 + appli), parties 1 à 4 et 6 ; seule
la suite de la partie 2 côté Telegram reste partielle (bilan du lundi adapté, autres messages Telegram inchangés,
sans objet tant que les invités n'ont pas Telegram). Choix faits en codant : pas de maquette préalable
(Samuel a demandé de coder directement) ; l'adresse du serveur est transmise dans le lien d'invitation. Motif : donner l'appli
à un de ses fils, qui n'a pas Telegram et sera peut-être en prise de masse. Samuel veut une
inscription propre dans l'appli, avec un code d'invitation, où la personne saisit elle-même tout
son profil et ce qu'elle veut faire, et des couleurs adaptées à ce choix. Montrer les maquettes
avant de coder.

### Constat (état v32 / appli 28/09 00h15)
- Le multi-utilisateur existe : `uid` dans toutes les feuilles, `mine()` filtre, code d'accès par
  personne. Un nouveau compte démarre à vide, rien à réinitialiser.
- Inscription et envoi du code d'accès uniquement par Telegram (nœuds Auth, Inscription,
  Admin Decision, Build App Token). `uid` = `chat_id` + horodatage.
- `Auth API` ignore les lignes de Users sans `chat_id` ; les écritures Users se font en
  « ajouter ou mettre à jour » sur `chat_id`.
- Sexe, taille, année de naissance : non modifiables dans l'appli.
- Mode sèche / maintien / prise de masse déduit de `cible` (fixe, en kcal) comparée au TDEE du
  jour. Défaut : l'écart dérive quand le poids change (déficit qui fond en sèche, surplus qui
  fond en prise de masse).
- Tout l'affichage suppose qu'on veut maigrir (vert = sous les besoins, « tu perds moins vite »…).

### 1. Objectif et écart dans Params (utile aussi à Samuel, à faire en premier)
- Nouvelles colonnes Params : `objectif` (`seche` / `stabilisation` / `prise`) et `ecart_kcal`.
- Cible calculée = TDEE du jour + `ecart_kcal`. Elle suit chaque pesée, n'est plus saisie.
- Réglages : choix Sèche / Stabilisation / Prise de masse puis l'écart (valeurs proposées
  −500 / 0 / +300 ; bornes par exemple −1000 à −200 et +150 à +600 ; cible jamais sous le
  métabolisme de base). Aperçu de la cible obtenue.
- Macros par défaut selon l'objectif (restent réglables).
- Compatibilité : une ligne Params sans `ecart_kcal` garde l'ancien fonctionnement (cible fixe).
  Migration de Samuel : `objectif=seche`, `ecart_kcal` = cible − TDEE actuel.
- Calculs dans la bibliothèque partagée (`lib_calculs_n8n.js`), donc Telegram et appli identiques.
  Menu Paramètres Telegram (Build Ask Params, Validate Params) à adapter aussi.

### 2. Couleurs et textes selon le sens de l'objectif
Un helper unique (sens −1 / 0 / +1 tiré de `reference.objectif`) utilisé partout :
- Jour : anneau et pastille (en prise de masse, être sous la cible = orange,
  « X kcal à manger encore » ; léger dépassement acceptable) ; `couleurDepassement` ;
  flèches de l'onglet Tendance. Stabilisation : zone verte ± 5 à 10 % autour de la cible.
- Courbes : barres d'écart quotidien, calendrier Régularité, « Régulier ? », segments de
  tendance de la courbe de poids, tuiles (`coulKg`), phrase d'accord balance/calcul.
- Journal : cartes de semaine (« jours au-dessus de la cible »), `bilanSemaine`.
- Corps : note « En sèche » sur la masse maigre. Réglages : texte sous la cible.
- Telegram : bilan du lundi, messages de bilan et de poids. Coach : objectif ajouté au contexte.
- La carte Objectif gère déjà les deux sens.

### 3. Inscription dans l'appli avec code d'invitation
- Nouvelle feuille `Invitations` : `code, cree_par, date, expire, utilise_par, statut`.
  Code à usage unique, valable par exemple 7 jours.
- Création du code par l'admin : bouton « Inviter quelqu'un » dans les Réglages quand `role=admin`
  (action `invitation`), et éventuellement une commande Telegram.
- Écran de connexion : second chemin « J'ai un code d'invitation ». Formulaire :
  - prénom, sexe, taille, âge (converti en année de naissance) ;
  - poids du jour, niveau d'activité, objectif et écart, objectif de poids facultatif.
- Adresse du webhook mise par défaut dans l'appli pour ne demander que le code. Le dépôt est
  public : ce n'est acceptable que parce que tout passe par code d'accès et invitation à usage
  unique.
- Action `inscription`, traitée avant `Auth API` (pas de jeton à ce stade) :
  - vérifie le code ;
  - crée la ligne Users : `uid` `app-…`, `chat_id` vide, statut `actif` ;
  - écrit la première pesée et la première ligne Params ;
  - marque l'invitation utilisée ;
  - renvoie le code d'accès, que l'appli enregistre et utilise aussitôt.
- `Auth API` et les écritures Users doivent accepter les comptes sans `chat_id` (clé `uid`).
- Nouvelle action `profil` pour modifier prénom, sexe, taille, année de naissance dans les
  Réglages (pour tous les comptes).
- Limiter les tentatives de codes invalides (anti-essais en série).
- Envoi par lien (demande de Samuel du 28/09) :
  - lien du type `https://<adresse de l'appli>/#invite=CODE` : le code est dans le fragment `#`,
    qui n'est pas transmis au serveur GitHub ;
  - bouton « Inviter quelqu'un » : crée le code puis ouvre la feuille de partage de l'iPhone
    (`navigator.share`) avec un message tout prêt, envoi direct par SMS ou WhatsApp ;
  - piège iOS : l'appli ajoutée à l'écran d'accueil a un stockage séparé de Safari et démarre
    sur l'adresse du manifest, donc sans le `#invite`. Le lien ouvre donc une page d'accueil
    qui affiche le code en grand, le copie et explique l'ajout à l'écran d'accueil ;
    l'inscription se fait ensuite dans l'appli installée (bouton « Coller le code »). Code
    court et lisible (8 caractères sans 0/O ni 1/l) pour pouvoir aussi le taper ;
  - si le lien s'ouvre dans le navigateur interne de WhatsApp, passer par Safari (l'ajout à
    l'écran d'accueil n'y est pas possible) ; le dire sur la page d'accueil ;
  - un lien transféré sert à qui l'utilise en premier : usage unique + expiration, et
    possibilité d'annuler une invitation.

### 4. Fonctions liées à Telegram : alternatives pour un compte sans Telegram (décidé le 28/09)
Inventaire du bot (51 nœuds Telegram) : analyse, enregistrement, poids, paramètres, stats, conseil
existent déjà dans l'appli. Restent :
- **Photos d'évolution** : décision de Samuel, archivées dans le Telegram de l'admin. `Photo Send API`
  prend le `chat_id` de l'admin quand l'utilisateur n'en a pas, légende avec le prénom ;
  relecture inchangée (file_id dans Mesures).
- **Rappels 14h03 / 21h03 et bilan du lundi** : les planifications sautent les comptes sans
  `chat_id`. Remplacés par un Raccourci iOS unique (automatisation d'heure, « exécuter
  immédiatement ») qui envoie les pas et appelle une nouvelle action `rappel` avec le code
  d'accès ; le serveur répond le texte du rappel (vide si rien à signaler) et le Raccourci
  n'affiche une notification que si le texte n'est pas vide. Même action le lundi 8h pour un
  bilan court. Le bilan complet reste en tête du Journal. Raccourci à fournir en fichier
  `.shortcut` ou en pas à pas, avec le code à coller. Pas de Web Push : il faudrait des
  clés VAPID et une librairie de chiffrement sur le VPS.
- **Relevé des pas** : le déclencheur « ouverture de Telegram » est remplacé par le même
  Raccourci à heures fixes (plus un envoi à l'ouverture de l'appli si besoin).
- **Code d'accès perdu** (nouveau téléphone, appli supprimée, données Safari effacées) : sans
  Telegram, pas de bouton « nouvelle appli ». Alternative : dans les Réglages admin, liste des
  comptes avec « Envoyer un lien de reconnexion » ; même mécanique que l'invitation (lien
  `#invite=`, usage unique, expiration) mais le code est rattaché à l'`uid` existant et
  remplace son code d'accès, sans ressaisie du profil.
- **Changer mon code d'accès** (équivalent de `nav:newapp`) : bouton dans les Réglages de chaque
  compte, l'appli enregistre aussitôt le nouveau code.
- **Effacer mon compte** (équivalent de `nav:raz`) : bouton dans les Réglages avec saisie du mot
  EFFACER, même traitement que Reset User.
- **Infos / aide** (`nav:infos`) : rubrique « Comment ça marche » dans les Réglages.
- **Admin** : message Telegram à Samuel quand une invitation est utilisée (prénom, date).
  Alertes et sauvegarde restent chez l'admin, rien à faire.

### 5. À dire à l'utilisateur invité
- L'admin voit ses données dans Sheets et la sauvegarde du dimanche les contient.
- Clé Gemini partagée : ses analyses consomment le même quota.

### 6. Fin de chantier
- Tests `tests/e2e.mjs` : inscription par invitation (code valide, déjà utilisé, expiré), compte
  en prise de masse (couleurs inversées), modification du profil.
- Mise à jour de `ARCHITECTURE_Agent_Nutrition.md` (feuilles, actions, flux).
- Ordre conseillé : 1, 2, 3, 4, puis 5 et 6. Les étapes 1 et 2 servent déjà à Samuel.
