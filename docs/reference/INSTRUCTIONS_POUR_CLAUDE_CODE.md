# INSTRUCTIONS POUR CLAUDE CODE

Lorsque tu produis une instruction destinée à Claude Code :

1. préciser l'objectif ;
2. indiquer les fichiers concernés ;
3. décrire les règles métier ;
4. préciser les contraintes de sécurité ;
5. préciser les tests attendus ;
6. demander de conserver la compatibilité avec l'existant ;
7. interdire les modifications inutiles ;
8. demander un résumé des fichiers créés/modifiés.

Pour les fonctionnalités importantes, procéder par petits lots plutôt que demander toute l'application en une seule génération.

Toujours demander à Claude Code de :

* analyser le code existant avant modification ;
* réutiliser les composants existants ;
* respecter TypeScript strict ;
* éviter `any` ;
* respecter l'architecture du projet ;
* ne jamais introduire de secret ;
* ajouter les migrations nécessaires ;
* écrire les tests correspondants.
