# MODULE PERSONNEL (RESSOURCES HUMAINES)

Statut : cadrage terminé, phase numérotée. **Phase 22.** Cité dans
`CONTEXTE.md` (« personnel ») et dans `SaaS.md` (module back-end
`Employees`) mais jamais spécifié ni planifié avant ce document.

**Précision de périmètre — paie (confirmée le 2026-08-30) :** ce module
reste un **suivi indicatif de la paie** — un registre interne des
montants décidés et payés (salaire de base, primes, retenues, avances,
net payé), saisi manuellement par le responsable financier. Il ne
couvre pas la « **Paie complète et comptabilité générale
réglementaire** » explicitement listée hors périmètre par le cahier des
charges (V5 §17, p.16, dans la même liste que le portail client et le
multi-fermes avancé) : pas de calcul automatique de charges
sociales/patronales, pas de barème fiscal, pas de bulletin à valeur
légale, pas de déclaration réglementaire. Les « relevés » produits par
ce module sont des documents internes de suivi de trésorerie/coût, pas
des bulletins de paie légaux.

## 1. Objectif métier

Permettre à DONDY ELEVAGE de gérer numériquement son personnel : fiches
employés, affectation aux bâtiments/services, planning et présence,
tâches assignées et suivies, suivi indicatif de la paie — afin
d'intégrer le coût de personnel dans le pilotage financier (Phase 8) et
de professionnaliser la gestion RH au même niveau que les autres
modules métier, sans empiéter sur la conformité légale (hors périmètre,
cf. précision ci-dessus).

## 2. User stories

* En tant que Propriétaire ou Responsable ferme, je veux créer une
  fiche employé (identité, poste, contrat, affectation) pour disposer
  d'un registre du personnel.
* En tant que Responsable ferme, je veux planifier présences et
  absences pour organiser le travail quotidien.
* En tant que Responsable ferme ou élevage, je veux enregistrer le
  pointage (arrivée/départ) d'un employé pour tracer le temps de
  travail.
* En tant que Responsable ferme ou élevage, je veux assigner une tâche
  à un employé et suivre sa réalisation.
* En tant que Responsable financier, je veux enregistrer et historiser
  un suivi indicatif de la paie mensuelle par employé, avec gestion des
  avances.
* En tant que Propriétaire, je veux voir le coût de personnel consolidé
  dans les KPI de rentabilité (Phase 8), sans double comptage avec les
  dépenses saisies manuellement.
* En tant qu'Administrateur, je veux gérer les référentiels
  postes/fonctions et types de contrat sans intervention technique.

## 3. Écrans concernés

* Liste des employés (filtres : statut, poste, bâtiment/service) —
  **Réalisé (Lot 6a)**, filtre Actifs/Tous uniquement pour l'instant
  (poste/bâtiment restent à ajouter, voir `DETTE_TECHNIQUE.md`).
* Fiche employé (détail, historique de paie, historique de présence,
  documents) — **Réalisé partiellement (Lot 6a + 6b + 6c)** : onglets
  Présence (Lot 6b) et Tâches (Lot 6c) réalisés ; Paie reste une coquille
  extensible (placeholder), contenu réel prévu au Lot 6d ; documents non
  traités (hors périmètre).
* Création / édition employé — **Réalisé (Lot 6a)**.
* Planning (vue calendrier, par employé ou par équipe) — **Réalisé
  partiellement (Lot 6b)** : vue calendrier par employé (onglet Présence)
  + registre du jour tous employés confondus (`/pointage`) ; pas de vue
  « par équipe » agrégée sur plusieurs mois (aucun endpoint farm-wide
  côté API, voir `DETTE_TECHNIQUE.md`).
* Pointage quotidien — **Réalisé (Lot 6b)**, écran `/pointage`.
* Tâches assignées (liste + création) — **Réalisé (Lot 6c)**, onglet
  Tâches de la fiche employé ; pas de vue « toutes les tâches de la
  ferme » (investiguée et explicitement exclue ce lot, aucun endpoint
  farm-wide côté API — voir `DETTE_TECHNIQUE.md`, proposée comme
  candidate pour un lot futur si le besoin se confirme).
* Paie — enregistrement du relevé mensuel (suivi indicatif interne,
  sans valeur de bulletin légal), historique des paiements, avances
* Rapport RH (effectif, absentéisme, coût de personnel par période)

## 4. Champs / formulaires

**Fiche employé** : nom, prénom, fonction/poste, type de contrat
(CDI/CDD/journalier/saisonnier), date d'embauche, date de fin de
contrat si applicable, bâtiment/service d'affectation, responsable
hiérarchique, téléphone, adresse, salaire de base (FCFA), périodicité
de paie, statut (actif/inactif/suspendu), documents (pièce d'identité,
contrat scanné), date et motif de sortie si applicable.

**Présence** : employé, date, statut (présent/absent/congé/repos),
heure d'arrivée, heure de départ, observation.

**Tâche assignée** : titre, description, employé assigné, entité liée
(bande/bâtiment/équipement, optionnel), date d'échéance, priorité,
statut, date de réalisation.

**Paie (suivi indicatif)** : employé, période (mois/année), salaire de
base, primes, retenues, avances déduites, net à payer, date de
paiement, mode de paiement, statut (calculé/payé), référence pièce
comptable. Primes et retenues sont des montants saisis manuellement par
le responsable, jamais calculés automatiquement selon un barème légal.

**Avance sur salaire** : employé, montant, date, relevé de déduction
(lien), statut.

## 5. Règles métier

* Un employé est rattaché à une seule exploitation (`farmId`), cohérent
  avec l'isolation multi-tenant du reste du système.
* Un employé inactif ou sorti ne peut plus recevoir de nouvelle tâche
  ni de nouveau pointage.
* Le calcul de paie ne doit jamais mélanger paie réelle et paie
  estimée (même règle que Finances).
* Un relevé de paie validé n'est jamais supprimé silencieusement :
  uniquement annulé ou corrigé avec traçabilité (audit).
* Une avance sur salaire est déduite automatiquement du relevé suivant.
* Le coût de personnel alimente les KPI de rentabilité globale
  (Phase 8) sans doublon avec des dépenses déjà saisies manuellement.
* Les tâches assignées à un employé s'appuient sur le moteur de
  tâches/alertes transverse (Phase 11) plutôt que d'en recréer un
  second.
* Aucun calcul automatique de charge sociale/patronale ni de retenue
  fiscale réglementaire : hors périmètre (cf. précision en tête de
  document).

## 6. Modèle de données prévisionnel

* **Employee** : id, farmId, firstName, lastName, position,
  contractType, hireDate, endDate, buildingId (FK, optionnelle),
  managerId (FK auto-référence, optionnelle), phone, address,
  baseSalary, payFrequency, status, createdAt, updatedAt, createdBy,
  deletedAt
* **Attendance** : id, farmId, employeeId, date, status, checkIn,
  checkOut, note, createdAt, updatedAt
* **EmployeeTask** : id, farmId, employeeId, title, description,
  relatedEntityType, relatedEntityId, dueDate, priority, status,
  completedAt, createdAt, updatedAt
* **Payroll** : id, farmId, employeeId, period, baseSalary, bonuses,
  deductions, advances, netPay, paymentDate, paymentMethod, status,
  referenceDocId, createdAt, updatedAt
* **SalaryAdvance** : id, farmId, employeeId, amount, date,
  deductedInPayrollId (FK, optionnelle), status

**Réalisé (Lot 1)** — voir `schema.prisma`, section Personnel :
`Employee`/`Attendance`/`EmployeeTask`/`Payroll`/`SalaryAdvance`
existent tous, avec quelques adaptations mineures actées en cours de
route (`name` unique au lieu de `firstName`/`lastName` — même
convention que `User.name` ; `position`/`contractType` en texte libre ;
`code` matricule auto-généré ajouté, non prévu dans ce cadrage initial ;
`baseSalaryFcfa`/`netFcfa`/`amountFcfa` suffixés `Fcfa` comme partout
ailleurs dans le schéma). Voir `DETTE_TECHNIQUE.md`, section Personnel
Lot 1, pour le détail complet des écarts.

## 7. Endpoints API (REST v1)

* `GET/POST /api/v1/employees`, `GET/PATCH/DELETE /api/v1/employees/:id`
* `GET/POST /api/v1/employees/:id/attendance`
* `GET/POST/PATCH /api/v1/employees/:id/tasks`
* `GET/POST /api/v1/payroll`, `GET /api/v1/payroll/:id`,
  `POST /api/v1/payroll/:id/pay`
* `GET/POST /api/v1/employees/:id/advances`

**Réalisé (Lot 2)** : `GET/POST /api/v1/employees`,
`GET/PATCH/DELETE /api/v1/employees/:id` (`DELETE` = soft delete).

**Réalisé (Lot 3)** : `GET/POST /api/v1/employees/:employeeId/attendance`,
`GET/PATCH /api/v1/employees/:employeeId/attendance/:date` — un `PATCH`
ajouté au-delà de la liste ci-dessus (confirmé avant implémentation,
absent au départ), nécessaire pour compléter un `checkOutTime` après le
`checkInTime` (pointage en 2 temps) ou corriger une saisie ; pas de
`DELETE` (append-only, comme `StockMovement`).

**Réalisé (Lot 4)** : `GET/POST /api/v1/employees/:employeeId/tasks`,
`GET/PATCH /api/v1/employees/:employeeId/tasks/:id`,
`POST /api/v1/employees/:employeeId/tasks/:id/annuler` — annulation
isolée dans son propre endpoint (motif tracé), même discipline que
`MaintenanceTasksService`. Aucun moteur de tâches transverse trouvé dans
le dépôt (voir `DETTE_TECHNIQUE.md`) : `EmployeeTask` autonome, décision
confirmée avant implémentation.

**Réalisé (Lot 5)** : `GET/POST /api/v1/employees/:employeeId/payroll`,
`GET/PATCH /api/v1/employees/:employeeId/payroll/:id` (pas de
`POST .../pay` séparé — validation via `PATCH { status: "VALIDE" }`, pas
de lien automatique vers un paiement effectif ce lot, voir
`DETTE_TECHNIQUE.md`) ; `GET/POST /api/v1/employees/:employeeId/advances`,
`GET/PATCH /api/v1/employees/:employeeId/advances/:id`. Aucun des deux
n'a de `DELETE`. Toutes les entités prévues au §6 sont désormais
construites.

## 8. Permissions

Corrigé contre le catalogue réel (`apps/api/src/common/rbac/
roles.catalog.ts`, 11 rôles système) — les noms provisoires du
brouillon initial de ce cadrage sont remplacés par les noms réels.
Entités construites : `Employee` (Lot 2), `Attendance` (Lot 3),
`EmployeeTask` (Lot 4), `Payroll`/`SalaryAdvance` (Lot 5). Toutes les
entités prévues au §6 sont désormais construites.

* **Propriétaire / Administrateur** : accès complet (`Employee` +
  `Attendance` + `EmployeeTask` + `Payroll` + `SalaryAdvance` +
  `EMPLOYEES_VIEW_SALARY`).
* **Gérant / Responsable ferme** : accès complet, identique au
  Propriétaire.
* **Responsable élevage** : aucun accès `Employee` ni `Payroll`/
  `SalaryAdvance`, mais **écriture sur `Attendance` et `EmployeeTask`**
  (`*_CREATE`/`*_UPDATE`, `*_READ` inclus) — nouvelle permission
  confirmée au Lot 3 pour `Attendance` (ce rôle n'avait rien sur
  Employee, le cadrage prévoit qu'il enregistre le pointage), reconduite
  explicitement pour `EmployeeTask` au Lot 4 ("cohérent avec Attendance",
  donné tel quel par le cadrage). `*_READ` inclus avec CREATE/UPDATE :
  "écriture" au sens strict n'était pas assez précis pour trancher
  seul — décision prise par cohérence avec chaque rôle "propriétaire de
  domaine" du catalogue (ex. Responsable couvoir sur Incubators,
  READ/CREATE/UPDATE/DELETE groupés), jamais un rôle qui écrit sans
  pouvoir relire ce qu'il vient de saisir — voir `DETTE_TECHNIQUE.md`.
* **Comptable / Responsable financier** : accès complet à la paie
  (`Payroll`/`SalaryAdvance`, `EMPLOYEES_VIEW_SALARY` inclus — "Achats,
  dépenses, paiements, rapports financiers" §11 couvre directement ce
  mandat, contrairement à `Employee` lui-même resté lecture seule),
  lecture seule des fiches employés, des pointages et des tâches
  (`EMPLOYEES_READ` + `ATTENDANCE_READ` + `EMPLOYEE_TASKS_READ` seuls
  sur ces trois-là).
* **Lecteur / Lecture seule** : lecture des fiches et plannings, **paie
  masquée — désormais appliquée littéralement (Lot 5)**. `EMPLOYEES_READ`/
  `ATTENDANCE_READ`/`EMPLOYEE_TASKS_READ` conservés (corrections des Lots
  2/3/4), mais **aucun accès `Payroll`/`SalaryAdvance`** et **pas
  d'`EMPLOYEES_VIEW_SALARY`** — `baseSalaryFcfa` est désormais retiré du
  JSON de la fiche employé pour ce rôle (mécanisme de masquage champ par
  champ, voir `DETTE_TECHNIQUE.md`), ce qui referme la nuance restée
  ouverte depuis les Lots 2/3/4.
* **Employé** *(rôle système, si compte utilisateur associé)* : lecture
  seule de sa propre fiche, planning et tâches uniquement — **non
  implémentable en l'état**. `Employee` n'a aucun lien vers `User`
  (choix délibéré du Lot 1 : "identité indépendante de User... la
  main-d'œuvre agricole n'a généralement pas d'accès applicatif" — voir
  `schema.prisma`). Une consultation "self-service" documentée ici pour
  la première fois demande une décision d'architecture (champ de
  liaison `Employee.userId` ? correspondance par email ? autre ?) avant
  de pouvoir être implémentée — **point ouvert, à trancher avant un lot
  qui l'implémenterait**. Ce rôle reste sans aucun accès Personnel pour
  l'instant, sur aucune des cinq entités.
* **Responsable couvoir, Responsable eau, Magasinier / Responsable
  stocks, Vendeur / Caisse** : non mentionnés dans ce cadrage — aucun
  accès par défaut (moindre privilège), sur aucune des cinq entités.

## 9. Calculs automatiques

* Ancienneté = date du jour − date d'embauche
* Coût de personnel du mois = somme des net à payer (+ charges si
  applicables)
* Taux d'absentéisme = jours d'absence / jours ouvrés × 100
* Solde d'avance = avances non encore déduites

## 10. Alertes

* Fin de contrat CDD proche
* Relevé de paie du mois non généré après une date seuil
* Absences anormales ou répétées
* Avance sur salaire non soldée depuis plusieurs mois

## 11. Tests

* Unitaires : ancienneté, absentéisme, solde d'avance
* API : permissions par rôle, isolation `farmId`
* Intégration : paie → Finances (aucun double comptage avec les
  dépenses manuelles)
* E2E : création employé → pointage → tâche assignée → génération et
  paiement du relevé

## 12. Position dans la séquence de phases — décidé

Décision confirmée : **Option A** (annexer en fin de séquence réelle,
aucune renumérotation des phases déjà livrées).

* **Phase 22 — Personnel (Ressources Humaines)** : ce module.
* **Phase 23 — QR codes / Prévisions IA** : décalée d'un rang (elle
  était annoncée comme suite directe de la Phase 20 sous le nom
  « Phase 22 »).

**GO PHASE 22 donné le 2026-08-30.**

## Avancement

* **Lot 1 — Schéma Prisma + migration** : LIVRÉ, validé
  (`feature/personnel-lot1-schema`).
* **Lot 2 — Module NestJS Employees (CRUD + RBAC)** : LIVRÉ, validé
  (`feature/personnel-lot2-employees-crud`, cible
  `feature/personnel-lot1-schema`) — §8 corrigé suite à ce document
  (voir ci-dessus et `DETTE_TECHNIQUE.md`).
* **Lot 3 — Module NestJS Attendance (pointage, CRUD + RBAC)** : LIVRÉ,
  validé (`feature/personnel-lot3-attendance`, cible
  `feature/personnel-lot2-employees-crud`) — 2 écarts confirmés avant
  implémentation (voir `DETTE_TECHNIQUE.md`) : enum `AttendanceStatus`
  gardé tel quel (pas de valeur `REPOS` ajoutée), `PATCH` ajouté à
  l'endpoint malgré son absence du §7 initial.
* **Lot 4 — Module NestJS EmployeeTask (tâches assignées, CRUD + RBAC)**
  : LIVRÉ, validé (`feature/personnel-lot4-employee-tasks`, cible
  `feature/personnel-lot3-attendance`) — investigation préalable menée
  (aucun moteur de tâches transverse trouvé, décision confirmée avant
  implémentation : `EmployeeTask` autonome, même patron que
  `MaintenanceTask` — voir `DETTE_TECHNIQUE.md`).
* **Lot 5 — Modules NestJS Payroll/SalaryAdvance (suivi indicatif de la
  paie) + masquage champ par champ** : LIVRÉ, validé
  (`feature/personnel-lot5-payroll-advances`, cible
  `feature/personnel-lot4-employee-tasks`) — 2 décisions confirmées avant
  implémentation (pas de statut `ANNULE`, pas de lien automatique
  `Payroll`↔`Expense` ce lot) ; `EMPLOYEES_VIEW_SALARY` ajouté,
  `baseSalaryFcfa` désormais réellement masqué pour Lecteur — voir
  `DETTE_TECHNIQUE.md` pour le mécanisme, documenté comme précédent
  réutilisable. Toutes les entités du §6 sont désormais construites.
* **Lot 6a — Écrans Employee (liste, fiche, création/édition)** : LIVRÉ,
  validé (`feature/personnel-lot6a-employee-screens`, cible
  `feature/personnel-lot5-payroll-advances`) — patron mirroré sur
  Patrimoine/Assets (formulaire combiné, onglets extensibles, route
  wrappers). Décisions prises et signalées plutôt que tranchées seules
  (voir `DETTE_TECHNIQUE.md`) : entrée de navigation « Personnel » en
  lien direct (pas une catégorie, une seule route réelle) gardée par
  `EMPLOYEES_READ`, avec un effet de bord identifié sur le rôle
  Responsable élevage ; règle de masquage du salaire appliquée au niveau
  du composant (champ absent de la réponse ⇒ jamais rendu, jamais
  soumis) aussi bien en lecture (fiche) qu'en écriture (formulaire).
* **Lot 6b — Écrans Attendance (planning, pointage)** : LIVRÉ, validé
  (`feature/personnel-lot6b-attendance-screens`, cible
  `feature/personnel-lot6a-employee-screens`) — onglet Présence rempli
  (calendrier mensuel par employé, grille construite à la main, aucune
  dépendance calendrier ajoutée) ; nouvel écran `/pointage` (registre du
  jour, tous employés actifs/en congé confondus, N requêtes GET/:date en
  parallèle faute d'endpoint farm-wide côté API). Décision de navigation
  tranchée et documentée : entrée « Pointage » séparée de « Personnel »,
  gardée par `ATTENDANCE_READ` OU `EMPLOYEE_TASKS_READ` (`anyPermission`,
  nouvelle extension de `nav-items.ts`) — corrige le trou de navigation du
  rôle Responsable élevage identifié au Lot 6a. Voir `DETTE_TECHNIQUE.md`
  pour le détail des deux décisions et leurs compromis assumés.
* **Lot 6c — Écrans EmployeeTask (onglet Tâches)** : LIVRÉ, validé
  (`feature/personnel-lot6c-employee-tasks-screens`, cible
  `feature/personnel-lot6b-attendance-screens`) — patron `MaintenanceTask`
  investigué et repris (liste, formulaire création/édition, dialog
  d'annulation). Décision documentée : vue « toutes les tâches de la
  ferme » investiguée puis explicitement exclue (aucun endpoint farm-wide
  côté API `EmployeeTask`, contrairement à `MaintenanceTask` — même
  compromis N-requêtes que `/pointage` sans besoin explicite exprimé au
  cadrage), proposée comme candidate pour un lot futur plutôt que
  tranchée seule. REALISEE reste directement éditable en PATCH (pas
  d'équivalent MaintenanceIntervention) ; ANNULEE isolé dans son propre
  endpoint avec motif rendu obligatoire côté formulaire (le DTO API reste
  optionnel, écart volontaire signalé). Aucune nouvelle entrée de
  navigation (« Pointage », Lot 6b, couvre déjà `EMPLOYEE_TASKS_READ`).
  Voir `DETTE_TECHNIQUE.md` pour le détail.
