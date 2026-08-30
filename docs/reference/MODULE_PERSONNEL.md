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

* Liste des employés (filtres : statut, poste, bâtiment/service)
* Fiche employé (détail, historique de paie, historique de présence,
  documents)
* Création / édition employé
* Planning (vue calendrier, par employé ou par équipe)
* Pointage quotidien
* Tâches assignées (liste + création — à mutualiser avec le moteur de
  tâches transverse prévu en Phase 11, pas de duplication)
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
confirmée avant implémentation. Le reste (payroll/advances) n'est pas
encore construit.

## 8. Permissions

Corrigé contre le catalogue réel (`apps/api/src/common/rbac/
roles.catalog.ts`, 11 rôles système) — les noms provisoires du
brouillon initial de ce cadrage sont remplacés par les noms réels.
Entités construites : `Employee` (Lot 2), `Attendance` (Lot 3),
`EmployeeTask` (Lot 4). Les mentions "paie" ci-dessous anticipent une
entité pas encore construite.

* **Propriétaire / Administrateur** : accès complet (`Employee` +
  `Attendance` + `EmployeeTask`).
* **Gérant / Responsable ferme** : accès complet (`Employee` +
  `Attendance` + `EmployeeTask`).
* **Responsable élevage** : aucun accès `Employee`, mais **écriture sur
  `Attendance` et `EmployeeTask`** (`*_CREATE`/`*_UPDATE`, `*_READ`
  inclus) — nouvelle permission confirmée au Lot 3 pour `Attendance` (ce
  rôle n'avait rien sur Employee, le cadrage prévoit qu'il enregistre le
  pointage), reconduite explicitement pour `EmployeeTask` au Lot 4
  ("cohérent avec Attendance", donné tel quel par le cadrage). `*_READ`
  inclus avec CREATE/UPDATE : "écriture" au sens strict n'était pas
  assez précis pour trancher seul — décision prise par cohérence avec
  chaque rôle "propriétaire de domaine" du catalogue (ex. Responsable
  couvoir sur Incubators, READ/CREATE/UPDATE/DELETE groupés), jamais un
  rôle qui écrit sans pouvoir relire ce qu'il vient de saisir — voir
  `DETTE_TECHNIQUE.md`.
* **Comptable / Responsable financier** : accès complet à la paie
  (`Payroll`/`SalaryAdvance`, non encore construits), lecture seule des
  fiches employés, des pointages et des tâches (`EMPLOYEES_READ` +
  `ATTENDANCE_READ` + `EMPLOYEE_TASKS_READ` seuls).
* **Lecteur / Lecture seule** : lecture des fiches et plannings, paie
  masquée. **Correction apportée au Lot 2** suite à ce cadrage : ce
  rôle n'avait reçu *aucun* accès Personnel en Lot 2 (principe de
  moindre privilège appliqué sans confirmation à l'époque, faute de ce
  document) — `EMPLOYEES_READ` lui est ajouté a posteriori, et
  `ATTENDANCE_READ`/`EMPLOYEE_TASKS_READ` accordés directement aux Lots
  3/4 (pointage et tâches relèvent des "plannings" mentionnés). Nuance
  non résolue : `baseSalaryFcfa` est un
  champ de `Employee` (pas séparé dans `Payroll`) — un Lecteur avec
  `EMPLOYEES_READ` voit donc aussi le salaire de base, alors que "paie
  masquée" suggérait plutôt une exclusion. Pas de restriction
  champ-par-champ dans le projet à ce jour (aucun précédent) — signalé
  comme limite assumée plutôt que résolu silencieusement.
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
  l'instant (ni `Employee`, ni `Attendance`, ni `EmployeeTask`).
* **Responsable couvoir, Responsable eau, Magasinier / Responsable
  stocks, Vendeur / Caisse** : non mentionnés dans ce cadrage — aucun
  accès par défaut (moindre privilège), sur `Employee` comme sur
  `Attendance`/`EmployeeTask`.

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
