# FiscalMind Africa — application (phases 1 à 7 de la migration)

Socle **Vite + vanilla** (aucun framework) pour la migration du SaaS.

- **Phase 1** : landing publique (vue visiteur déconnecté).
- **Phase 2** : coquille applicative + **page Journal** (`#/journal`, protégée par session).
- **Phase 3** : services externes isolés (`../src/services/`).
- **Phase 4** : **page États financiers** (`#/etats`, protégée) — Balance, Grand livre,
  Bilan, Compte de résultat, TAFIRE, calculés par le moteur depuis les écritures.
- **Phase 5** : **page Lettrage** (`#/lettrage`, protégée) + **page Calendrier fiscal**
  (`#/calendrier`, publique).
- **Phase 6** : **tableau de bord** (`#/accueil` connecté) — KPI, graphiques SVG, alertes.
- **Phase 7** : **pivot SaaS 100 % cloud** — RIEN n'est stocké en local (voir
  « Persistance 100 % cloud » ci-dessous). Le mode démo est supprimé.

## Arborescence

```
app/
├── index.html                  # landing + pages légales + coquille applicative (#appShell)
├── vite.config.js              # base './', build -> dist/ (statique, Cloudflare Pages)
├── package.json                # scripts dev / build / preview / e2e (+ @supabase/supabase-js)
├── .env                        # NON COMMITÉ : VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
├── src/
│   ├── main.js                 # landing : marquee + stats + navigation interne
│   ├── anim.js                 # animations — script INDÉPENDANT
│   ├── app.js                  # coquille : routeur hash (#/, #/connexion, #/journal)
│   ├── router.js               # routeur hash minimal + garde de route
│   ├── auth.js                 # session EN MÉMOIRE uniquement (persistSession: false, aucun stockage)
│   ├── store.js                # persistance 100 % cloud (Supabase, via ../src/services/fmCloud.js)
│   ├── ui.js                   # helpers (esc, fmt, toast…)
│   ├── pages/
│   │   ├── auth.js             # page Connexion/Inscription (connexion réelle obligatoire)
│   │   ├── journal.js          # page Journal : liste, filtres, modale de saisie, multi-journaux
│   │   ├── etats.js            # page États financiers : 5 onglets (Balance, Grand livre,
│   │   │                       #   Bilan, Compte de résultat, TAFIRE) + exports Imprimer/PDF et CSV
│   │   ├── lettrage.js         # page Lettrage des comptes de tiers (classe 4)
│   │   ├── calendrier.js       # page Calendrier fiscal 17 pays OHADA (publique)
│   │   ├── copilote.js         # page Copilote IA (historique persisté en table fm_chat)
│   │   ├── dashboard.js        # tableau de bord (accueil connecté)
│   │   └── admin.js            # pages Admin (garde is_admin)
│   └── styles/
│       ├── afrique-premium.css # design extrait du fichier source (NE PAS MODIFIER)
│       └── app.css             # styles propres à l'app connectée (nav basse, cartes, modales,
│                               #   tableaux d'états, CSS print)
├── e2e/
│   ├── sync-390.cjs            # test e2e 100 % cloud à 390px (15 contrôles, mock Supabase en page)
│   └── archive-pre-pivot/      # anciens scripts e2e (mode démo supprimé) — voir LISEZ-MOI.md
└── screenshots/                # captures des tests 390px
```

Les modules métier sont importés depuis `../src/` (même dépôt) :
- `../src/engine/journal.js` → `validateEntry` / `addEntry` / `updateEntry` / `deleteEntry`
- `../src/engine/chart-of-accounts.js` → 1420 comptes + `sensNormal` (autocomplétion, indication du sens)
- `../src/services/supabase.js` → auth réelle quand les variables d'environnement sont définies

## Lancer

```bash
cd ~/workspace/goals/fiscalmind-africa-saas-launch/migration/app
npm install
npm run dev      # serveur de dev Vite (http://localhost:5173)
npm run build    # build statique -> app/dist/
npm run preview  # prévisualise le build (http://localhost:4173)
npm run e2e      # build + test e2e Journal à 390px (12 contrôles)
```

Le dossier `dist/` est 100 % statique et se déploie tel quel sur Cloudflare Pages.
**La prod actuelle (fiscalmind-africa.pages.dev) n'est jamais touchée par ce chantier.**

## États financiers — exports (phase 4)

La page `#/etats` propose deux exports par état, **sans dépendance** :

- **🖨️ Imprimer / PDF** : `window.print()` avec une CSS print dédiée (`@media print`
  dans `app.css`) — chrome de l'app masqué, en-tête entreprise + période + titre.
- **⬇️ CSV** : génération locale (séparateur `;`, BOM UTF-8 pour Excel), un fichier
  par état (`balance_2026.csv`, `bilan_2026.csv`…).

Le nom d'entreprise des en-têtes se saisit dans la page (persisté en table
`fm_settings`, clé `company`, défaut « Mon entreprise ») — **jamais « WagaExpress »
en en-tête**.

> Note : le PDF premium mis en page et l'Excel riche (onglets, formules) de la
> version d'origine viendront plus tard si besoin — l'impression navigateur et le
> CSV couvrent le besoin comptable de base.

## Configuration Supabase (obligatoire)

L'appli est un SaaS 100 % cloud : **sans configuration, les pages applicatives
affichent une erreur** (aucun mode dégradé local). Créer `app/.env` (jamais
commité) :

```
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=votre-cle-anon
```

Aucun secret n'est écrit dans le code (règle permanente de la migration).
Les tables sont créées côté dashboard Supabase via
`migration/supabase-fm-entries.sql` (4 tables : `fm_entries`, `fm_journals`,
`fm_chat`, `fm_settings`, RLS par utilisateur).

## Persistance 100 % cloud — choix documenté (phase 7)

**RIEN n'est stocké en local** : ni `localStorage`, ni `sessionStorage`
(un test unitaire scanne tout le code et échoue si l'un d'eux apparaît).

- **Session** : uniquement en mémoire (`auth.js`, `persistSession: false` côté
  supabase-js). Recharger la page = se reconnecter. L'essai gratuit passe par
  l'inscription (plan démo 3 jours, modèle existant) — **le mode démo local est
  supprimé**, la landing reste publique.
- **Écritures** : table `fm_entries`, une ligne par écriture, clé métier
  `(user_id, entry_id)` (`entry_id` = `id` canonique du moteur). Création /
  modification = `upsert`, suppression = `delete` filtré par `entry_id`.
- **Journaux personnalisés** : table `fm_journals`, clé `(user_id, code)`
  (les codes par défaut AC/VT/BQ/ES/PA/OD/AN sont constants côté app).
- **Historique copilote** : table `fm_chat`, une ligne par utilisateur
  (`messages` jsonb, 100 derniers conservés).
- **Préférences** : table `fm_settings`, clés `periode`, `company`, `country`
  (entreprise, pays, période/exercice).
- **Conflits** : règle simple et documentée — **dernier écrit gagne**
  (`updated_at` mis à jour par trigger à chaque `UPDATE`).
- **Erreurs** : jamais silencieuses. Panne réseau ou erreur serveur → message
  explicite en français + bouton **Réessayer** (ex. « Pas de connexion réseau
  pendant le chargement du journal. Vérifiez votre connexion puis réessayez. »).
  Pas de repli local, pas de file d'attente hors-ligne.
- **Indicateur** : pastille discrète `● Connecté` dans l'en-tête du journal
  (verte) ; `● Erreur` (rouge) quand le chargement échoue.

La logique d'accès vit dans `src/services/fmCloud.js` (fonctions pures prenant
un client PostgREST injectable → testables sans DOM) ; `app/src/store.js` n'est
qu'une fine couche async qui branche la session courante (`CloudError` avec
`code` `AUTH` / `NETWORK` / `DB` / `CONFIG` et message FR).

Les écritures utilisent le format canonique du moteur
`{ id, date, journal, piece, libelle, lignes: [{ compte, debit, credit }] }`.

> Écarts assumés : supabase-js retente 3 fois avec backoff (1s+2s+4s) avant de
> signaler une panne réseau — l'état de chargement reste affiché ~7 s dans ce
> cas. La modale de saisie reste ouverte si l'enregistrement échoue (aucune
> donnée perdue : l'utilisateur peut réessayer).

## Règles respectées

- **Design « Afrique Premium »** : CSS extrait tel quel du fichier source. Le bloc
  « Correctifs responsive — CE BLOC DOIT RESTER EN DERNIER » reste en dernier dans
  `afrique-premium.css` ; aucun CSS ajouté après lui (aucun CSS custom ajouté du tout).
- **Animations** : contenu visible par défaut. Les éléments `.reveal` ne sont masqués
  que si `anim.js` s'exécute (classe `js-anim`) ; si le JS échoue, la page reste
  entièrement lisible. `anim.js` est un script indépendant (aucun import).
- **Français uniquement**, textes repris du site d'origine.

## Notes d'implémentation

- Statistique « 40+ comptes SYSCOHADA vérifiés » du site d'origine → remplacée par la
  vraie valeur **« 1420 comptes du plan SYSCOHADA révisé »** (désormais implémenté en
  entier dans le moteur). Repli statique dans le HTML si le JS ne s'exécute pas.
- Marquee : version statique dans le HTML (17 pays), reconstruite par `main.js`
  depuis le module `countries.js` (34 items = 2×17 pour la boucle CSS).
- Boutons « Essai gratuit / Démarrer / Voir la démo » : l'authentification n'existe pas
  encore dans cette phase → les CTA principaux scrollent vers les tarifs, les autres
  affichent un toast « bientôt disponible ». Aucune fausse promesse d'inscription.
- Icônes Font Awesome via CDN (comme l'original) ; emojis en repli naturel.
- Généré par `~/workspace/fiscalmind-migration/build-landing.py` (rejouable).

## Test 390px

Script : `~/workspace/fiscalmind-migration/e2e/shoot-landing-390.js`
(playwright-core + chrome-headless-shell, `isMobile:true`, viewport 390×844).

Vérifications (8/8 OK le 8 oct. 2026) : pas de débordement horizontal, hero lisible,
cartes fonctionnalités et tarifs empilées, marquee 34 items, stats 17/1420 depuis les
modules, navigation CGU ↔ accueil. Captures dans `screenshots/`.

## Lettrage + Calendrier fiscal (phase 5)

- **Moteur** : `../src/engine/lettrage.js` (pur, testé) — port de `renderLettrage` /
  `fmLettrerGroupe` / `fmDelettrerLettre` / `fmNextLettre` du source. Travaille sur des
  *mouvements* (lignes d'écritures) : `toMouvements`, `groupByTiers` (classe 4),
  `validateLettering` (≥2 lignes, même compte, débits = crédits, non déjà lettrées),
  `nextLetter` (A, B, … Z, AA…), `letterEntries` / `unletterEntries` (immuables),
  `groupBalance` (solde non lettré). La lettre est conservée par `normalizedEntry`
  (`journal.js`) et survit aux modifications d'écritures.
- **Page Lettrage** (`#/lettrage`, protégée) : cartes par compte de tiers, cases à
  cocher, bouton « Lettrer la sélection ✓ », badges de lettres avec ✕ pour délettrer,
  filtre « Non lettrées uniquement », clic sur un tiers → balance + grand livre du
  compte (moteur). Lettres persistées via le store (`saveEntry` par écriture,
  table `fm_entries`).
- **Page Calendrier fiscal** (`#/calendrier`, publique) : 435 échéances depuis
  `../src/data/calendars.js`, vue mensuelle avec pastilles, navigation mois/année,
  liste des échéances du mois, clic → fiche stratégique (`../src/data/fiches.js` :
  périodicité, taux, échéance, pénalités, base, conseil). Sélecteur des 17 pays
  (défaut BF, persisté en table `fm_settings`, clé `country`).
- **Correctif données** (8 oct. 2026) : `../src/data/fiches.js` contenait des
  séquences `\u2019` littérales (double échappement du générateur) affichées telles
  quelles dans les fiches — remplacées par le vrai caractère ’ (9 occurrences).
- **Auth Supabase** : `app/src/auth.js` est câblé sur
  `../src/services/supabase.js` (`supabaseConfigFromEnv` lit `VITE_SUPABASE_URL` /
  `VITE_SUPABASE_ANON_KEY` ; **session en mémoire uniquement**,
  `persistSession: false` — aucun mode démo ; `signIn`/`signUp`/`signOut`
  transmettent aux méthodes du service, déjà couvertes par `tests/services.test.js`
  avec mocks). Aucune clé en dur : le build de production injectera les vraies
  valeurs via `.env` (voir « Configuration Supabase »).
- **Tests** : `tests/lettrage.test.js` (13 tests : groupement classe 4, lettres A→B→AA,
  validation, lettrage/délettrage, immuabilité, intégration `addEntry`) ;
  `app/e2e/phase4-390.cjs` (20 contrôles : lettrage de 2 lignes 411 compensées →
  badge A + solde 0 → délettrage ; détail tiers ; calendrier : mois avec échéances,
  fiche affichée, changement de pays CI). Captures `screenshots/lettrage-390.png`,
  `screenshots/calendrier-390.png` (390 px, sans débordement).

## Copilote IA + Administration (phase 5 — 8 oct. 2026)

- **Service** : `../src/services/supabase.js` — `askCopilot({accessToken, question, country, taxOverrides})`,
  `getQuota({accessToken})`, `adminListUsers`, `adminStats` existaient déjà ; ajout de
  `adminAction({accessToken, action, ...params})` (port fidèle de `licensePost` :
  `set_plan`, `set_admin`, `revoke`, `delete_user`, `resolve_unmatched`).
- **Licence** (`app/src/licence.js`) : cache du quota (`refreshQuota()` après connexion),
  `isAdmin()` = `plan === 'admin'` (is_admin lu depuis app_metadata côté serveur),
  `quotaBadgeText()`, `updateNavVisibility()` (bouton Admin masqué sauf admin),
  `clearQuota()` à la déconnexion. `getAccessToken()` ajouté à `app/src/auth.js`.
- **Rendu markdown** (`../src/copilot/format.js`, pur + testé) : port de `fmMd()` étendu
  (titres, **gras**, `code`, listes, paragraphes) + mise en valeur des numéros de
  comptes (3-5 chiffres) hors balises ; échappement HTML systématique.
- **Page Copilote** (`#/copilote`, protégée) : historique persisté en table
  `fm_chat` (100 messages max), suggestions rapides (5, comme l'original),
  indicateur « En train d'écrire… », badge de quota, 402 → message « quota épuisé »
  + bouton « 🎫 Choisir mon abonnement » (renvoie vers la boutique WagaExpress —
  le tunnel d'achat Chariow reste une étape suivante).
- **Page Admin** (`#/admin`, garde stricte + redirection si non admin) :
  - *Vue globale* : `adminStats()` — cartes inscrits/actifs/questions/revenus,
    répartition des plans, top utilisateurs, alertes (paiements non rapprochés,
    en attente) avec bouton « Traité ».
  - *Utilisateurs* : `adminListUsers()` — recherche, tableau (email, inscription,
    dernière connexion, badge plan, licence), modale Gérer (plan, durée, admin,
    Enregistrer/Révoquer), suppression avec **double confirmation**.
  - **Anti-auto-modification** (comme l'original, en plus strict) : aucun bouton
    d'action sur sa propre ligne ni sur un compte admin (`canManageUser`).
- **Tests** : `tests/copilot-format.test.js` (8), `tests/admin-format.test.js` (7) ;
  `app/e2e/phase5-390.cjs` (14 contrôles, build dédié avec fausses clés Supabase +
  `page.route` sur les Edge Functions : réponse affichée avec comptes en valeur,
  badge quota, 402 → message adapté, non-admin redirigé, vue globale + utilisateurs,
  aucune action sur son propre compte). Captures `screenshots/copilote-390.png`,
  `screenshots/admin-390.png` (390 px, sans débordement).
- **Écart assumé** : le service `edgeFunction()` lève une exception sur HTTP non-2xx
  (avec `e.status`) ; la page Copilote attrape et traite le 402 comme l'original
  (qui lisait `res.status` sur la réponse). Comportement identique, mécanisme adapté.

## Tableau de bord (phase 6 — 8 oct. 2026)

- **Accueil connecté = Dashboard** : la route `#/` affiche le tableau de bord quand
  une session existe (la landing reste pour les visiteurs) ; alias `#/accueil`
  (protégée). Le bouton « Accueil » de la nav basse et le logo y mènent.
- **Moteur** (`../src/engine/dashboard.js`, pur + testé) : `kpis()` (CA, résultat
  net, trésorerie, créances clients 411 non lettrées, dettes fournisseurs 401 non
  lettrées, TVA = −(443) − (4452), badge balance), `monthlySeries()` (CA vs
  charges par mois), `chargesBreakdown()` (par nature : achats, externes, impôts,
  autres, personnel, financières, dotations), `treasuryCurve()` (trésorerie
  cumulée), `upcomingDeadlines()` (échéances < 30 j depuis `src/data/calendars.js`,
  bascule d'année gérée, jours clampés en fin de mois).
- **Page** (`app/src/pages/dashboard.js`) : grille 2 colonnes de 6 cartes KPI
  cliquables (→ onglets d'États via `?tab=`, support ajouté à `renderEtatsPage`) ;
  3 graphiques SVG faits main (zéro dépendance) — barres groupées CA/charges,
  donut des charges avec légende, courbe de trésorerie ; montants abrégés
  (« 2,4 M », « 800 k ») ; alertes (échéances fiscales du pays du profil,
  factures non lettrées, équilibre de la balance) ; sélecteur d'exercice persisté ;
  état vide élégant (« Saisis ta première écriture ») si aucun écriture.
- **Tests** : `tests/dashboard.test.js` (13 : KPI, lettrage exclu des créances,
  crédit de TVA, séries mensuelles, donut trié, courbe, échéances, clamp,
  dates invalides) ; `app/e2e/dashboard-390.cjs` (16 contrôles : 6 KPI avec
  bonnes valeurs sur 6 écritures / 3 mois, barres non nulles, 1 alerte échéance,
  clic KPI → onglet Résultat, état vide, 390 px sans débordement). Captures
  `screenshots/dashboard-390.png`, `screenshots/dashboard-390-charts.png`.

## Pivot 100 % cloud (phase 7 — 8 oct. 2026)

Consigne : « C'est un SaaS, RIEN ne doit être stocké en locale ». L'approche
offline-first / localStorage est abandonnée (voir « Persistance 100 % cloud »
plus haut pour l'architecture).

- **Nouveau** : `../src/services/fmCloud.js` — toute la logique d'accès PostgREST
  (fonctions pures, client injectable, testables sans DOM) : `cloudLoadEntries` /
  `cloudSaveEntry` (upsert sur `(user_id, entry_id)`) / `cloudDeleteEntry`,
  `cloudLoadJournals` / `cloudSaveJournal` / `cloudDeleteJournal` (clé
  `(user_id, code)`), `cloudGetSetting` / `cloudSetSetting` (clés `periode`,
  `company`, `country`), `cloudLoadChat` / `cloudSaveChat` (100 max).
  Erreurs typées `CloudError` (`AUTH` / `NETWORK` / `DB` / `CONFIG`), messages FR.
  Particularité : supabase-js ≥ 2.117 convertit les pannes réseau en objet
  `{ error: { message: 'TypeError: Failed to fetch' } }` au lieu de lever —
  `run()` les requalifie en `NETWORK` (« Pas de connexion réseau… » plutôt que
  « Erreur serveur… »).
- **Réécrit** : `app/src/store.js` (fine couche async, aucune donnée locale),
  `app/src/auth.js` (session mémoire uniquement, `persistSession: false`,
  suppression de `signInDemo`), `app/src/pages/auth.js` (bouton démo supprimé).
- **Converties en async** : `journal.js` (pastille `● Connecté` / `● Erreur`,
  panneau d'erreur + Réessayer), `lettrage.js` (persistance par écriture
  modifiée), `etats.js`, `dashboard.js`, `calendrier.js` (pays via `fm_settings`),
  `copilote.js` (historique via `fm_chat`).
- **Schéma** : `migration/supabase-fm-entries.sql` réécrit (4 tables, RLS par
  utilisateur, trigger `updated_at` = dernier écrit gagne).
- **Tests** : `tests/sync.test.js` (19 : CRUD mocké, upserts, isolation par
  utilisateur, erreurs NETWORK/DB/AUTH, store sans session → `AUTH`, scan
  statique **zéro localStorage/sessionStorage** dans tout le code).
  Total : **176/176 verts** (`node --test "tests/*.test.js"`).
- **e2e** : `app/e2e/sync-390.cjs` (**15/15 verts** à 390 px) — build de test avec
  clés Supabase factices (`dist-e2e/`, reconstruit à chaque run), mock REST
  Supabase injecté en page (`window.__fmMockDB`), session mémoire via
  `window.__fmSetSession` : (A) sans session → redirection `#/connexion`, aucun
  bouton démo ; (B) avec session → pastille `● Connecté`, écriture créée puis
  supprimée **via le mock Supabase** (preuve : `fm_entries` du mock), zéro clé
  `fm2_*` en localStorage ; (C) panne réseau simulée → message FR + Réessayer →
  rechargement OK. Captures `screenshots/sync-*.png`.
- Anciens scripts e2e (mode démo) archivés dans `app/e2e/archive-pre-pivot/`.

## Phase 8 — les 6 modules manquants de l'ancien site (100 % cloud)

Logique métier portée de `fiscalmind-app.html`, réécrite en moteurs purs +
pages 100 % cloud (zéro localStorage conservé).

- **Moteurs** (`src/engine/`) : `classeur.js` (extraction facture/bordereau DGI
  + proposition d'écritures canoniques : 601/4452/401, 411/701/443, 447/441/
  646/641/443 → 521, règlement ES/BQ), `audit.js` (4 groupes, 17 éléments,
  avancement), `amortissements.js` (linéaire + prorata, dotation 681 →
  compteAmort au 31/12), `assurances.js` (alertes < 60 j, prime 625 → 521),
  `convertisseur.js` (matrice XOF/USD/EUR/NGN/GBP, taux modifiables).
  Tous les comptes utilisés existent dans le plan SYSCOHADA révisé (1420).
- **Cloud** : `fmCloud.js` étendu (`fm_audit`, `fm_immos`, `fm_assurances`,
  upserts par clé métier) ; `store.js` étendu (audit/immos/assurances,
  profil entreprise `company_ifu`/`company_regime`, `tax_overrides`,
  `fx_rates` en `fm_settings`).
- **Pages** (`app/src/pages/`, routes `#/classeur|audit|amortissements|
  assurances|convertisseur|config`, toutes protégées) : extraction modifiable
  + contrôle d'équilibre avant « Passer les écritures » ; archivage des
  justificatifs sur R2 via `r2-storage` (quota 1 Go, 50 Mo/fichier) ;
  plans d'amortissement avec génération d'écriture ; alerte expiration
  assurances + sinistres ; taux de change éditables ; entreprise + paramètres
  fiscaux (réinitialisation) + licence (Starter 29 900 / Pro 79 900 XOF via
  Chariow, rappel « même email »).
- **Menu hamburger (☰)** dans le header : tiroir latéral avec les 13 modules
  (comme l'ancien site), actif synchronisé, bouton Admin réservé aux admins ;
  la barre de navigation basse est conservée pour les modules principaux.
- **Schéma** : `migration/supabase-phase8.sql` (3 tables, RLS par utilisateur,
  idempotent) — à exécuter dans le dashboard Supabase ; le code supporte des
  tables absentes (erreur `DB` explicite + Réessayer).
- **Tests** : `tests/phase8-*.test.js` (46 : extraction, écritures équilibrées
  via `validateEntry`, plans, statuts, CRUD mocké fmCloud). Total :
  **225/225 verts** (`node --test "tests/*.test.js"`).
- **e2e** : `app/e2e/phase8-390.cjs` (**23/23 verts** à 390 px) — tiroir (13
  entrées, navigation, fermeture), audit (bascule → `fm_audit`), immo →
  dotation 681/284 → `fm_entries`, police → prime 625/521 → `fm_entries`,
  conversion + taux édités → `fm_settings`, entreprise + TVA → `fm_settings`,
  classeur (notice OCR gracieuse, extraction, écriture 601/4452/401).
  Captures `screenshots/phase8-*.png`.

## Classeur Intelligent — chantier OCR (8 oct. 2026)

L'OCR de l'ancien projet était nettement supérieur : analyse du code
d'origine (`fmOcrOnline`, `fmClasseurExtract`, `fmClasseurPropose`,
`fmExtractImpotsDetails`, `fmCreateTiers`, `fmClasseurPost`) et port des
mécanismes manquants, en 100 % cloud :

- **Lecture OCR automatique** : bouton « 🔍 Lire automatiquement (OCR) » avec
  case de **consentement explicite** (obligatoire), appel via
  `src/services/ocr.js` → Edge Function `ocr` (JWT, jamais de clé en dur),
  2 tentatives, puis repli gracieux sur le collage manuel du texte
  (l'Edge Function n'est pas encore déployée — aucun blocage).
- **Extraction améliorée** : `extractTotal` donne désormais la priorité au
  « Total TTC » / « Net à payer » (l'ancien prenait le premier « total »,
  donc le HT quand il venait en premier).
- **Sous-comptes de tiers** (401001, 411001…) : détection du nouveau tiers à
  la révision (sélecteur Fournisseur/Client), création à la passation,
  enregistrement au plan via `registerSubAccount` (le SYSCOHADA autorise la
  subdivision des comptes collectifs) — `validateEntry` les accepte partout.
  Registre persisté en `fm_settings` (clé `tiers`), rechargé à chaque
  connexion (`ensureTiersRegistered` dans la coquille). Anti-collision après
  suppression d'un tiers.
- **Traçabilité** : chaque écriture passée porte `doc` (nom du document
  source), affiché 📎 dans le journal.
- **Factures de démo** : 3 boutons (achat TVA 18 %, vente, bordereau DGI)
  avec textes OCR pré-remplis — testent tout le flux jusqu'à
  « Passer les écritures ».
- **Tests** : `tests/classeur-ocr.test.js` (18 : registre de sous-comptes,
  consentement OCR, validation d'entrée, 3 démos de bout en bout,
  TVA absente, montants invalides, repli 447). Total : **243/243 verts**.
- **e2e** : `app/e2e/classeur-ocr-390.cjs` (**14/14 verts** à 390 px) —
  démo achat → 401001 + doc tracé + tiers persisté → journal (badge 📎) →
  démo DGI (441/646 → 521) → garde OCR sans fichier. Captures
  `screenshots/classeur-ocr-*.png`.
- **Chaîne vérifiée** : classeur → `saveEntry` (store) → `fm_entries` →
  journal → balance/grand livre → états → dashboard (même store partout).

### Données de démo 2024–2025 (section Configuration, admin uniquement)

- `app/public/demo-data-2024-2025.json` (copie de `migration/demo-data-2024-2025.json`,
  embarquée au build via `public/`) : 2 écritures d'à-nouveaux équilibrées
  (`demo-an-2024` 73 lignes, `demo-an-2025` 79 lignes, journal AN, format
  canonique). Détails/mapping : `migration/demo-data-LISEZMOI.md`.
- Page `#/config`, section « 🧪 Données de démo » **réservée admin**
  (garde `isAdmin()`, masquée sinon) :
  - « Charger les données de démo 2024–2025 » : fetch du JSON → `validateEntry`
    par écriture → `saveEntry` (upsert sur `(user_id, entry_id)` → **idempotent**,
    relancer ne duplique rien) → toast de confirmation.
  - « Supprimer les données de démo » : `deleteEntryById` sur les 2 `entry_id`
    (double confirmation).
  - Statut affiché (chargées / partielles / non chargées).
- Tests : `tests/phase8-demo.test.js` (3 : JSON valide et équilibré, idempotence
  sur mock, suppression par `entry_id`) ; e2e `I4` (section masquée non-admin).
