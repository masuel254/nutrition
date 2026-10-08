---
description: Maquette d'écran (PNG format iPhone) avant de coder un changement visuel
argument-hint: <ce qu'il faut maquetter>
---

Samuel veut voir une maquette avant tout code pour : $ARGUMENTS

1. Lis dans `index.html` l'écran concerné (styles et fonction de rendu) pour reprendre exactement les couleurs,
   variables CSS, polices, espacements et composants existants.
2. Écris une page HTML statique autonome dans un dossier temporaire (pas dans le dépôt) qui reproduit l'écran actuel
   avec la modification, au format iPhone 390 × 844, données fictives réalistes.
   S'il y a un vrai choix de conception, propose 2 variantes (A et B) côte à côte.
3. Rends-la en PNG avec Playwright (Chromium, `deviceScaleFactor: 2`), thème sombre et clair si l'écran dépend du thème,
   regarde le PNG toi-même (Read) pour vérifier qu'il n'y a ni débordement ni texte coupé.
4. Donne le chemin du PNG, explique en 3 lignes maximum ce qui change et les différences entre variantes, puis attends
   son choix. Ne modifie pas `index.html` avant son « ok » / « vas y ».
