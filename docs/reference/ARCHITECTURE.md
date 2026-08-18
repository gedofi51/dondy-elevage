# ARCHITECTURE

Privilégier une architecture **modulaire, maintenable et évolutive**.

Séparer clairement :

* Front-end ;
* API Back-end ;
* logique métier ;
* accès aux données ;
* authentification ;
* autorisations ;
* notifications ;
* fichiers ;
* tâches planifiées ;
* logs ;
* configuration.

Le Back-end NestJS doit être organisé par domaines métier.

Exemples de modules :

* Auth
* Users
* Roles
* Farms
* Buildings
* Flocks
* Poultry
* Weighings
* Mortality
* Feed
* Water
* Health
* Vaccinations
* EggProduction
* Inventory
* Purchases
* Suppliers
* Customers
* Sales
* Finance
* Employees
* Maintenance
* Tasks
* Alerts
* Reports
* Notifications
* AuditLogs
* Settings

Éviter les architectures inutilement complexes. Commencer par un **monolithe modulaire** pouvant évoluer ultérieurement.

# SAAS ET MULTI-TENANT

Prévoir dès la conception une architecture permettant éventuellement de gérer plusieurs exploitations.

Chaque donnée métier doit pouvoir être rattachée à une exploitation via un identifiant de type :

`farmId`

Garantir une isolation stricte des données entre exploitations.

Même si DONDY ELEVAGE constitue la première ferme, ne pas construire une architecture empêchant une évolution SaaS multi-fermes.
