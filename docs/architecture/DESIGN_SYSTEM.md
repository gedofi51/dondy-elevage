# Design system — "Agritech Premium"

Référence pour tout écran frontend construit après la Phase 10. Cette
direction remplace la palette simple posée en Phase 0
(`DONDY_ELEVAGE_GO_PHASE0.md` section C) et s'applique par défaut à
tout nouveau module (Chair, Pondeuses, Couvoir...) sans qu'il soit
nécessaire de re-consulter le mockup source.

Source : `docs/design/DONDY ELEVAGE - 5 directions.html`, direction
**"1a — Agritech Premium"** exclusivement (les 4 autres directions
présentes dans ce fichier — Farm Command Center, Modern African
Agritech, Minimal Data, Smart Farm — ne sont pas retenues). Le fichier
est un document "canvas" (contenu HTML sérialisé en JSON) ; la section
1a est repérable par le commentaire `<!-- === 1a — AGRITECH PREMIUM
=== -->` et sa propre "Fiche design system" intégrée, qui a servi de
source d'extraction plutôt qu'une lecture visuelle de la capture
d'écran.

## Palette

Tokens bruts dans `apps/web/src/styles/tokens.css` (`--dondy-*`),
mappés vers les variables sémantiques shadcn/Tailwind juste en dessous
dans le même fichier.

| Rôle | Valeur | Usage |
|---|---|---|
| Primary | `#2D4A2E` | Boutons primaires, titres (voir "Typographie"), valeurs KPI par défaut |
| Secondary | `#A0522D` | Accents secondaires, bordure bouton ghost |
| Accent | `#E8891D` | CTA, item de navigation actif |
| Accent-foreground | `#231A0C` | Texte sur bouton/nav accent |
| Fond | `#FAF7EF` | Fond de page |
| Foreground | `#2A2A24` | Texte de corps par défaut |
| Muted (fond) | `#EEF1EA` | Fonds subtils (icônes, panneaux atténués) |
| Muted (texte) | `#6E6E60`¹ | Texte atténué (libellés, descriptions) |
| Success | `#2D7A3A` | États "Normal" |
| Warning/Vigilance | `#96600F`¹ | États "Vigilance" |
| Destructive/Critique | `#B4341F` | États "Critique", actions destructives |
| Info | `#4A6C8C` (inchangé Phase 0) | Non couvert par la fiche 1a — conservé |
| Bordure | `color-mix(in oklch, primary 10%, background)` | Bordures de cartes/tableaux |
| Sidebar (fond) | `#243B25` | Distinct du primary — sidebar et bottom-nav mobile |
| Sidebar (texte) | `#CDD6C8` | — |

¹ **Écart volontaire au mockup — voir "Accessibilité" ci-dessous.**

## Typographie

- **Titres** (`font-heading`) : [Newsreader](https://fonts.google.com/specimen/Newsreader) (serif), chargée via `next/font/google`, poids 400/500/600 utilisés. S'applique à `CardTitle`, `DialogTitle`, `AlertDialogTitle`, `PageHeader` (`h1`), aux `h1` des formulaires d'authentification, et à la valeur des `KpiCard`.
- **Corps / UI** (`font-sans`) : [Instrument Sans](https://fonts.google.com/specimen/Instrument+Sans) (sans-serif), poids 400/500/600/700 utilisés.
- Les titres portent aussi `text-primary` (vert) par défaut — pas seulement la police serif — pour reproduire fidèlement le mockup, où tous les titres de section sont colorés en plus d'être en serif. `KpiCard` fait exception intentionnelle : son libellé (`CardTitle`) reste explicitement `text-muted-foreground` (surchargé en `className`, prioritaire via `tailwind-merge`), seule sa valeur suit la convention titre.

### Chargement des polices (bande passante)

Contexte Samba (`PERFORMANCE_ET_CONNECTIVITE.md`) : chaque police est
chargée sans `weight` fixé — c'est la recommandation officielle
`next/font` pour une police variable ("We recommend using variable
fonts for the best performance and flexibility", confirmé dans
`node_modules/next/dist/docs/.../font.md`, pas une supposition) — un
seul fichier `.woff2` par police plutôt que des instances statiques par
poids. Une tentative de restreindre la plage de poids (`weight: '400
600'`) a été **rejetée par next/font/google lui-même** à la compilation
(`Unknown weight 400 700 for font Instrument Sans. Available weights:
400, 500, 600, 700, variable`) — la syntaxe "plage" documentée ne
s'applique qu'aux polices variables à continuum réel (type Inter), pas
à des paliers discrets comme ici ; `weight` a donc été laissé omis
(équivalent à `'variable'`, la valeur par défaut). `axes` non précisé :
seul l'axe `wght` est chargé, ce qui exclut l'axe optique `opsz` de
Newsreader (inutile pour l'usage UI). `subsets: ['latin']` sur les deux
polices.

**Poids réel mesuré** après `next build` (fichier effectivement
téléchargé par un navigateur affichant du texte français — Google
Fonts scinde chaque police en plusieurs fichiers par plage Unicode
`latin`/`latin-ext`/`vietnamese`, mais un navigateur ne télécharge que
celui qui couvre les caractères réellement affichés, ici toujours
`latin`) :

| Police | Fichier réellement téléchargé (FR) |
|---|---|
| Newsreader | 56,8 Ko |
| Instrument Sans | 29,2 Ko |
| **Total ajouté par cette phase** | **~86 Ko** |
| (Geist Mono, préexistant Phase 0, inchangé) | 22,6 Ko |

## Rayons de bordure

Base `--radius: 0.75rem` (12px) dans `apps/web/src/app/globals.css`,
héritant de l'échelle `calc()` déjà en place (`sm ×0.6 / md ×0.8 / lg
×1.0 / xl ×1.4 / 2xl ×1.8`) :

| Classe | Valeur (base 12px) | Cible mockup | Composants |
|---|---|---|---|
| `rounded-lg` | 12px | ~11px | Boutons, inputs, items de nav sidebar |
| `rounded-xl` | 16,8px | 16-18px | Cartes, dialogs |
| `rounded-2xl` | 21,6px | 20-22px | Réservé (non utilisé cette phase, voir "Décisions") |

12px a été choisi plutôt que 11px (`0.6875rem`, qui aurait mis
`rounded-lg` pile sur sa cible) car il centre `rounded-xl`/`rounded-2xl`
— les cartes, qui dominent visuellement l'interface — au milieu de leur
plage cible, au prix d'un écart de seulement 1px sur les boutons/inputs.

## Ombres

Absentes du système Phase 0 (`Card` n'avait même pas de classe
`shadow-*`), ajoutées comme tokens `@theme` dans `globals.css` (donc
utilisables comme classes Tailwind `shadow-card`/`shadow-kpi`/
`shadow-kpi-hero`) :

- `shadow-card` : `0 14px 30px -22px rgb(45 74 46 / 0.5)` — cartes, dialogs, panneaux
- `shadow-kpi` : `0 10px 22px -18px rgb(45 74 46 / 0.5)` — `KpiCard`
- `shadow-kpi-hero` : `0 12px 26px -14px rgb(45 74 46 / 0.6)` — **non utilisée cette phase**, réservée à une future carte KPI "vedette" sur fond primary (le dashboard Phase 9 n'affiche qu'un seul KPI, une distinction vedette/standard serait prématurée — même logique que `--chart-4`/`--chart-5`, déjà préparés pour de futurs dashboards sans usage actuel)

## Accessibilité — contraste WCAG

Vérification demandée explicitement compte tenu de l'usage terrain à
Samba (extérieur, forte luminosité, pas un bureau climatisé) : deux
couleurs texte de la fiche 1a brute ont été mesurées **sous le seuil
AA texte normal (4.5:1)**.

| Paire | Ratio mockup brut | Verdict | Valeur retenue | Ratio corrigé |
|---|---|---|---|---|
| Texte atténué `#8A8A7A` / fond `#FAF7EF` | 3,27:1 | ❌ échoue AA | `#6E6E60` | 4,83:1 ✅ |
| Texte vigilance `#B06F12` / fond badge `#FBEFD9` | 3,60:1 | ❌ échoue AA | `#96600F` | 4,64:1 ✅ |

Les deux valeurs ont été assombries à teinte égale (même famille de
couleur, luminosité réduite) jusqu'à repasser 4.5:1. Calcul de
luminance relative WCAG standard (linéarisation sRGB + pondération
0.2126/0.7152/0.0722), vérifié à la main, pas d'outil tiers utilisé.

**Point limite non corrigé, à surveiller** : le badge "Vigilance"
(`text-warning` sur son propre fond dérivé `bg-warning/10`, pas
directement sur `#FBEFD9`) retombe à **~4,34:1** une fois composé sur
son fond réel (teinte très claire, proche du blanc) — sous le seuil de
4.5:1 mais très proche, et nettement au-dessus du seuil 3:1 (grand
texte/composants UI). Assombrir davantage `#96600F` ferait dériver la
teinte vers un brun peu distinct de "vigilance". Signalé plutôt
qu'ignoré ; à re-mesurer si ce badge s'avère difficile à lire en usage
réel extérieur.

Comparaison Phase 0 → Phase 10 sur le texte atténué : `#5A5346`
(7,11:1, confortable) → `#6E6E60` (4,83:1) — le nouveau ton reste
conforme AA mais avec moins de marge qu'avant ; à garder en tête si un
retour terrain signale une difficulté de lecture.

## Composants retouchés

Mécanique de cascade automatique (voir aussi le plan de phase) : la
quasi-totalité des composants shadcn (`Card`, `Button`, `Badge`,
`Table`, `Select`, `Tabs`, `DropdownMenu`, `Sonner`) utilise déjà des
classes Tailwind sémantiques — changer les tokens de `tokens.css`/
`globals.css` suffit pour l'immense majorité de l'UI. Retouches
manuelles au-delà de la cascade :

- `components/ui/{card,dialog,alert-dialog,select,dropdown-menu}.tsx` — bordure `ring-foreground/10` (gris-noir, jamais liée à primary) → `ring-primary/10` ; `Card`/`Dialog`/`AlertDialog` gagnent `shadow-card`.
- `components/ui/table.tsx` (`TableHead`) — style mockup (majuscules, `tracking-[0.06em]`, 11.5px, atténué) au lieu du style shadcn par défaut.
- `components/shared/kpi-card.tsx` — la cascade automatique de `--font-heading` serait tombée sur le mauvais élément (le libellé via `CardTitle`, pas la valeur) : retouché à la main pour que seule la valeur passe en serif/primary.
- `components/shared/page-header.tsx` et les 4 `h1` des formulaires d'authentification (`features/auth/components/*.tsx`) — aucune classe `font-heading` par défaut, ajoutée manuellement (trouvé en vérification visuelle, pas anticipé dans le plan initial).
- `app/(auth)/layout.tsx` — trouvé en vérification visuelle : utilisait `bg-muted` (devenu vert pâle après repalette, adapté à de petites pastilles mais pas à un fond de page entier) au lieu de `bg-background` ; branding désynchronisé de la sidebar (ancienne icône Feather + "DONDY"/"ÉLEVAGE" empilé) — aligné sur le même patron que `app-sidebar.tsx`.
- `components/layout/app-sidebar.tsx` — largeur 248px (était 256px/`w-64`), fond sombre distinct (`#243B25` vs primary), radius des items de nav `rounded-md`→`rounded-lg`, en-tête remplacé par un monogramme "DE" (voir "Décisions" — pas de photo) + "Dondy Élevage"/"FERME DE SAMBA".

## Décisions assumées (écarts au mockup)

1. **Pas de conteneur "app frame" arrondi/ombré autour de toute
   l'application.** Le mockup encadre chaque direction dans un cadre à
   `border-radius:22px` + ombre large — lecture retenue : artefact de
   présentation d'une maquette comparative (simuler une fenêtre de
   navigateur pour juxtaposer 5 directions côte à côte), pas une
   intention d'habillage réel. `app-shell.tsx` reste plein viewport.
   `rounded-2xl` reste donc sans usage réel cette phase (voir "Rayons").
2. **Avatar de la sidebar : pas de photo.** Le mockup utilise une photo
   de profil — remplacée par un monogramme "DE" (même patron que le
   badge d'initiales déjà utilisé dans `AppTopbar`), pour ne pas
   fabriquer une fausse identité d'utilisateur.
3. **Topbar : pas de barre de recherche ni de cloche de notification.**
   Présentes dans le mockup mais sans fonctionnalité réelle derrière
   (aucune recherche, aucun système de notification côté backend) —
   auraient créé une UI non fonctionnelle, hors périmètre d'une phase
   de restylage pur.
4. **Bouton destructif : poids visuel inchangé** (`bg-destructive/10`,
   pas un rouge plein). La fiche design system de la direction 1a
   elle-même ne montre aucun bouton destructif solide — celui visible
   dans le fichier (rouge plein "Traiter") appartient à la section `2a`
   (exploration hybride, explicitement écartée). Seule la couleur de
   base suit `--dondy-destructive: #B4341F`.
5. **Muted-foreground et warning assombris vs mockup brut** — voir
   "Accessibilité" ci-dessus.

## Pour les phases suivantes

Tout nouveau module (Chair, Pondeuses, Couvoir, Poussins...) hérite de
ces tokens sans modification : utiliser les composants partagés
existants (`KpiCard`, `StatusBadge`, `AlertBadge`, `DataTable`,
`PageHeader`, `ConfirmDialog`), les classes sémantiques Tailwind
(`bg-primary`, `text-muted-foreground`, `shadow-card`...), jamais de
couleur hexadécimale ni de `font-family` en dur dans un composant de
feature.
