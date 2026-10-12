# Migration FiscalMind Africa — Architecture SaaS propre

> Chat dédié : « Migration FiscalMind — Architecture SaaS » (8 oct. 2026).
> **Règle d'or : la production (https://fiscalmind-africa.pages.dev/) n'est JAMAIS touchée par ce chantier.**
> Tout le travail se fait ici, dans `migration/`, jusqu'à bascule décidée avec Yannick.

## 1. Point de départ (constaté le 8 oct. 2026)

- `~/workspace/your_files/fiscalmind-africa/fiscalmind-app.html` : **6908 lignes, ~548 Ko**, un seul fichier.
- Bloc JS principal : lignes 1969 → 6255 (~4 300 lignes de logique mélangée : DOM + métier + données).
- 3 blocs `<style>` (design « Afrique Premium »), 8 blocs `<script>` (dont 6 petits utilitaires/landing).
- Logique comptable identifiée et localisable :
  - Plan comptable : objet JS ~ligne 4352, libellés de classes ~4357-4359.
  - `fmBalance` (~4450), `fmGrandLivre(compte)` (~4468), `fmBilanData` (~3675),
    `fmCRData` (~3715), `fmResultatNet` (~3666), `fmTAFIREData` (~3830).
  - Saisie : `saveEntry` (~4964, validation équilibre débit=crédit), `deleteEntry` (~5004), `fmNewEntryId` (~4895).
  - Lettrage : logique métier noyée dans `renderLettrage` (~5063).
- Formats internes compacts (ex. écritures en tableaux) + `localStorage` + Supabase + R2 mélangés au même niveau.

## 2. Choix d'architecture : Vite + ES modules vanilla (sans framework)

**Décision prise le 8 oct. 2026 (autonome, comme demandé).**

| Option | Verdict |
|---|---|
| Vite + modules ES vanilla | ✅ **Retenu** |
| Next.js / React | ❌ Réécriture complète de l'UI, runtime serveur inutile (l'appli est une SPA client-side), complexité sans bénéfice |
| Vue / Svelte | ❌ Même coût de réécriture, sans l'écosystème déjà en place |

**Pourquoi ce choix est le plus pragmatique :**
1. **Migration incrémentale possible** : le moteur (pur) se teste et se valide seul ; l'UI existante peut ensuite appeler les modules via de fins adaptateurs, page par page, sans big-bang.
2. **Déploiement inchangé** : Vite produit un build statique → Cloudflare Pages comme aujourd'hui, zéro changement d'infra.
3. **Zéro dépendance pour le cœur métier** : le moteur comptable n'a besoin que de JS pur + `node:test` intégré pour les tests.
4. **Yannick-friendly** : pas de toolchain exotique, code lisible, français partout.

## 3. Structure cible

```
migration/
├── PLAN-MIGRATION.md          ← ce document
├── package.json               ← { type: module, test: node --test }
├── src/
│   ├── engine/                ← 100 % pur, testé (ÉTAPE 1)
│   │   ├── chart-of-accounts.js
│   │   ├── journal.js         ← modèle + validation partie double
│   │   ├── trial-balance.js   ← balance
│   │   ├── general-ledger.js  ← grand livre
│   │   ├── financial-statements.js ← bilan, compte de résultat
│   │   ├── tafire.js
│   │   └── NOTES.md           ← ambiguïtés trouvées pendant l'extraction
│   ├── data/                  ← ÉTAPE 2 : 17 pays OHADA, calendriers, taux, fiches
│   ├── services/              ← ÉTAPE 3 : supabase, r2, chariow, ocr (interfaces mockables)
│   └── ui/                    ← ÉTAPE 4 : pages migrées une par une (Afrique Premium conservé)
├── tests/                     ← node:test, zéro dépendance
└── staging/                   ← ÉTAPE 5 : build Vite + déploiement de test
```

## 4. Plan par étapes

### ✅ Étape 1 — Moteur comptable extrait + testé (EN COURS)
Extraire en modules ES purs : plan comptable, journal (validation partie double),
balance, grand livre, bilan, compte de résultat, TAFIRE. Tests unitaires `node:test`
(équilibre D=C, Actif=Passif, cohérence résultat net bilan/CR, cas négatifs).
**Critère de sortie : `npm test` 100 % vert.**

### Étape 2 — Données fiscalité 17 pays OHADA
Extraire les calendriers fiscaux, taux (TVA/IS/CNSS), fiches stratégiques en modules
`src/data/` + validation (schéma + tests : TVA/IS par pays, statuts Confirmé/Provisoire).
Source : `~/workspace/fiscal-pays-recherche/` (17 JSON déjà vérifiés aux sources officielles).

### Étape 3 — Services isolés
`src/services/` : auth Supabase, stockage R2, webhook Chariow, OCR — chaque service
derrière une interface simple, mockable en tests. **Aucun secret dans le code**
(variables d'environnement uniquement).

### Étape 4 — UI page par page (design Afrique Premium conservé)
Migrer les pages une par une en gardant le CSS existant : landing → journal →
exports → classeur intelligent → lettrage → admin. Chaque page : adaptateur fin
vers `src/engine/`. **Test systématique à 390 px** (Yannick travaille sur Android).

### Étape 5 — Staging puis bascule
Build Vite → déploiement sur sous-domaine de staging → tests end-to-end
(parcours complet : inscription → journal → bilan → export) → **bascule prod
seulement sur décision explicite de Yannick.**

## 5. Contraintes permanentes

- Production https://fiscalmind-africa.pages.dev/ intacte jusqu'à bascule décidée.
- Responsive 390 px testé à chaque étape UI.
- Design « Afrique Premium » préservé (pas de page simplifiée sans demande).
- Aucun secret dans le code, jamais.
- Interface en français.
- Corrections du SaaS existant : décision commune avec Yannick (règle en vigueur) ;
  ce chantier de migration neuve avance en autonomie comme demandé.

## 6. Journal

- 8 oct. 2026 : cartographie du fichier source (6908 lignes) ; choix Vite + ES modules ;
  lancement extraction moteur comptable (étape 1).
- 8 oct. 2026 : **plan comptable SYSCOHADA révisé implémenté EN ENTIER** —
  `src/engine/chart-of-accounts.js` (1420 comptes distincts, classes 1-9), parsé depuis le
  fichier Excel fourni par Yannick (tableau de correspondance ancien/nouveau ; le fichier
  listait 2 fois le compte 91 → dédoublonné). Ancien plan : 1258 comptes ; 13 renumérotés,
  50 supprimés, 214 créés (détail : `correspondance-ancien-nouveau.json`). Sens normal
  porté de `fmSensNormal()`. Tous les comptes utilisés par le moteur (401, 411, 443, 4451,
  521, 6611…) existent dans le plan révisé — logique moteur inchangée.
- 8 oct. 2026 : **étape 2 terminée — données fiscales 17 pays OHADA** :
  `src/data/countries.js` (17 pays, taux TVA/IS, social {employer, employee,
  combined, basis, org, status}), `calendars.js` (435 échéances),
  `fiches.js` (85 fiches stratégiques), `validate.js`, `NOTES.md`,
  `tests/data.test.js` (13 tests). Corrections expertes du 8 oct. appliquées
  (BF 16 %/5,5 %, ML fourchette 18,9–21,9 %, NE 16,4 %/5,25 %, CD 13 %/5 %,
  GN 18 %/5 %, GW ≈14 %/≈8 % provisoire) ; 11 autres pays = données JSON
  non vérifiées, statut « À vérifier ». Générateur : `scripts/build-country-data.js`.
  Suite : 48/48 tests verts (`npm test`).
- 8 oct. 2026 : **étape 1 terminée — 35/35 tests verts** (`npm test`). Modules :
  journal (partie double), balance, grand livre, bilan, compte de résultat, TAFIRE, notes
  annexes. **BUG DÉCOUVERT dans la prod** : `fmBilanData` calcule le résultat net sur des
  soldes limités aux classes 1-5 alors que le résultat vient des classes 6/7/8 → la ligne
  « Résultat net » du bilan vaut toujours 0 et le bilan affiche « ⚠ Écart Actif/Passif »
  dès qu'il y a un bénéfice/perte non affecté (vérifié dans le code source ; ex. journal
  démo : écart de 850 500 F). Le nouveau moteur corrige ça par construction
  (`bilanData(soldes, resultatNet)`).
- 8 oct. 2026 : **étape 4 (phase 3) terminée — page États financiers** (`#/etats`) :
  5 onglets (Balance, Grand livre, Bilan, Compte de résultat, TAFIRE) calculés par le
  moteur, sélecteur d'exercice réutilisé, exports Imprimer/PDF (CSS print) et CSV,
  en-tête entreprise locale (`fm2_company`, jamais WagaExpress). Build vert, e2e
  17/17 verts à 390 px (captures `app/screenshots/etats-*.png`), 116/116 tests
  unitaires préservés. Sémantique bilan CORRIGÉE : résultat net sur toutes les
  classes, badge ✓ Actif = Passif.
- 8 oct. 2026 : **étape 5 (staging) DÉPLOYÉE** — la nouvelle app (landing + journal + états financiers) est en ligne sur https://fiscalmind-africa-staging.pages.dev/ (projet Cloudflare Pages « fiscalmind-africa-staging », distinct de la prod ; token réutilisé de façon transitoire, jamais mémorisé). Vérifié : le site sert la nouvelle version. La prod https://fiscalmind-africa.pages.dev/ n'est pas affectée.
- 8 oct. 2026 : **étape 4 (phase 1) terminée — socle Vite + landing publique** :
  `migration/app/` (Vite 6 vanilla, `npm run build` OK → `dist/` statique déployable) ;
  design Afrique Premium extrait (`src/styles/afrique-premium.css`, bloc responsive en
  dernier) ; landing fidèle (hero, stats, marquee 17 pays depuis le module, 6 cartes,
  3 plans, footer, CGU/mentions/à propos) ; contenu visible par défaut, animations dans
  script indépendant ; test 390px 8/8 OK (captures dans `app/screenshots/`).
  Script de génération : `~/workspace/fiscalmind-migration/build-landing.py` ;
  test e2e : `~/workspace/fiscalmind-migration/e2e/shoot-landing-390.js`.
- 8 oct. 2026 : **étape 4 (phase 2) terminée — coquille applicative + page Journal** :
  routeur hash (`#/` landing, `#/connexion`, `#/journal` protégée par garde de route),
  navigation basse mobile (Journal / ＋ / Accueil), page Connexion/Inscription branchée
  sur `src/services/supabase.js` (config via `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`,
  jamais en dur) + mode démo local toujours disponible ; page Journal : liste en cartes
  mobile-first, recherche, filtre par journal, tri par date, sélecteur d'exercice persisté,
  multi-journaux (ajout/suppression, codes perso), modale de saisie multi-lignes utilisant
  `validateEntry`/`addEntry`/`updateEntry` du moteur, autocomplétion sur les 1420 comptes
  du plan révisé + indication du sens normal, contrôle d'équilibre débit=crédit en direct,
  suppression avec double confirmation. Persistance locale par compte en localStorage
  (`fm2_*`) en attendant Supabase (documenté dans `app/README.md`). `afrique-premium.css`
  intact, styles app dans `app/src/styles/app.css`, contenu visible par défaut.
  Gates : `npm run build` vert ; e2e 390 px **12/12 verts** (`app/e2e/journal-390.cjs`,
  captures `journal-liste-390.png` / `journal-modale-390.png` dans `app/screenshots/`) ;
  `node --test ../tests/*.test.js` depuis `app/` : **116/116 verts**. L'e2e a détecté
  puis fait corriger un vrai bug (garde de route du journal non branchée → crash sans
  session).
- 8 oct. 2026 : **étape 4 (phase 6) terminée — tableau de bord** : la page
  d'accueil connectée (`#/` avec session, alias `#/accueil` protégé ; landing
  inchangée pour les visiteurs) devient un Dashboard calculé par le moteur
  (`src/engine/dashboard.js` : KPI, séries mensuelles, donut des charges,
  courbe de trésorerie, échéances < 30 j). Page `app/src/pages/dashboard.js` :
  6 cartes KPI cliquables (→ onglets d'États via `?tab=`), 3 graphiques SVG
  faits main (zéro dépendance), alertes (échéances fiscales, factures non
  lettrées, équilibre), sélecteur d'exercice, état vide élégant. Build vert,
  e2e 16/16 verts à 390 px (captures `app/screenshots/dashboard-390*.png`),
  157/157 tests unitaires (13 nouveaux).
