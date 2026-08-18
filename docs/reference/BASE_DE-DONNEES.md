# BASE DE DONNÉES

Utiliser Prisma avec MySQL.

Respecter :

* noms cohérents ;
* relations explicites ;
* contraintes ;
* index ;
* timestamps ;
* migrations versionnées.

Prévoir généralement :

* id
* farmId
* createdAt
* updatedAt
* createdBy si pertinent
* deletedAt si soft delete nécessaire

Éviter les suppressions définitives pour les données financières, sanitaires et d'audit.
