# UTILISATEURS ET AUTORISATIONS

Prévoir au minimum les rôles :

* Super Admin
* Propriétaire
* Responsable ferme
* Responsable élevage
* Responsable stocks
* Responsable financier
* Employé
* Lecture seule

Implémenter un système **RBAC**.

Chaque action sensible doit vérifier les autorisations côté Back-end.

Ne jamais se contenter de masquer un bouton côté Front-end pour gérer la sécurité.

# AUTHENTIFICATION

Prévoir :

* email/mot de passe ;
* JWT Access Token ;
* Refresh Token ;
* OAuth Google ;
* OAuth Microsoft ;
* 2FA ;
* récupération de mot de passe ;
* vérification email ;
* expiration des sessions ;
* révocation des sessions ;
* protection contre brute force ;
* journalisation des connexions.

Les mots de passe doivent être hashés avec un algorithme sécurisé.

Les secrets ne doivent jamais être codés en dur.

Utiliser les variables d'environnement.
