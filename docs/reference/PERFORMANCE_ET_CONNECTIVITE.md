# PERFORMANCE ET CONNECTIVITÉ

Le contexte de Samba impose une attention particulière à la bande passante.

Optimiser :

* taille des bundles ;
* images ;
* nombre de requêtes ;
* pagination ;
* cache ;
* lazy loading ;
* compression ;
* requêtes API.

Utiliser React Query pour :

* cache ;
* synchronisation ;
* invalidation ;
* retry raisonnable ;
* gestion des états loading/error.

Prévoir à terme une évolution vers une approche **PWA/offline partiel** si nécessaire.

# API

Créer une API REST versionnée :

`/api/v1/...`

Respecter :

* DTO NestJS ;
* validation ;
* codes HTTP cohérents ;
* pagination ;
* filtres ;
* tri ;
* recherche ;
* gestion centralisée des erreurs.

Ne jamais exposer directement les modèles Prisma sans couche de contrôle.
