# GITHUB ET CI/CD

Utiliser GitHub avec :

* branche `main` ;
* branches de développement/features ;
* pull requests ;
* revue avant fusion.

GitHub Actions doit exécuter au minimum :

1. installation des dépendances ;
2. lint ;
3. TypeScript check ;
4. tests ;
5. build ;
6. éventuellement création image Docker ;
7. déploiement après validation.

Une pipeline en échec doit bloquer le déploiement.
