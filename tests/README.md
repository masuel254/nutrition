# Tests de l'appli

`e2e.mjs` ouvre `index.html` dans un Chromium au format iPhone et simule le webhook n8n avec des
données fictives (aucune donnée personnelle ici). Il vérifie les parcours qui ont déjà cassé
ou qui comptent le plus :

- écran Jour : pastille des calories, carte objectif et projection ;
- Courbes : onglets Poids / Calories / Purines, période commune, tuiles ; Corps : pesée en tête et envoi ;
- Qualité (saturées, fibres, sodium, sucres ajoutés, alcool en verres, grille jour par jour avec les jours non suivis, tuiles avec la journée en cours) sur Jour et Courbes ; Corps en onglets, crises de goutte notées et repérées sur les purines ;
- Réglages en onglets : objectif et écart (cible calculée), invitation créée ; inscription par lien d'invitation (page d'accueil, code, profil, compte créé) ;
- Journal : bilan de la semaine dernière, semaines repliées, « Voir plus », chargement à la demande ;
- Ajouter : refaire un repas, enregistrement rejoué sans doublon (même identifiant),
  modification de la même ligne, composer avec ses aliments, message si l'IA est indisponible ;
- affichage : pas de débordement horizontal, champs en 16 px (pas de zoom iOS), aucune erreur JS.

Lancement, depuis la racine du dépôt :

```
npm i -D playwright
npx playwright install chromium
node tests/e2e.mjs
```

Code de sortie 0 si tout est vert, 1 sinon. À lancer avant chaque mise en ligne.
Le workflow n8n n'est pas testé ici : son JSON contient la clé Gemini et ne doit pas aller sur GitHub.
- Sans IA : repas mis en attente quand l'IA refuse, bandeau sur Jour, analyse et enregistrement au jour d'origine quand l'IA revient ; saisie à la main (total en direct, contrôle, purines calculées, aucun appel à l'IA).
- Secours IA : une analyse faite par un modèle de secours (Gemma ou Groq) est signalée sur l'écran de résultat.
- Pesées : historique dépliable sous la pesée du jour ; « Régulier ? » sans extrapolation des semaines courtes.
