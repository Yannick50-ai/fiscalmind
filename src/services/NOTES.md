# Services — notes de portage (étape 3)

## Comportements portés du source

### supabase.js ← fiscalmind-app.html (~l.1970-2060, 2124-2261, 2344, 2400, 3009, 6048-6208)
- Client : `supabase.createClient(URL, ANON_KEY)` ; ici `createClient` est **injecté**
  (jamais bundlé) et la config vient de `SUPABASE_URL` / `SUPABASE_ANON_KEY`.
- Auth : `signInWithPassword`, `signUp` avec `options.data = { name, plan: 'demo' }`,
  `signOut`, `getSession`, `getUser`, `onAuthStateChange` (passthrough).
- Edge Functions appelées avec `Authorization: Bearer <access_token>` :
  `copilot` (POST `{question, country, taxOverrides}` et POST `{action:'quota'}`),
  `admin-users` (GET), `admin-stats` (GET), `r2-storage` (POST `{action, ...payload}`).
- Écart assumé : le source lit parfois `fmSb` global ; ici tout passe par l'instance
  fabriquée — pas de global.

### r2.js ← fiscalmind-app.html (~l.2970-3060)
- Protocole `fmR2Call` : POST `/functions/v1/r2-storage` `{action, ...payload}` + Bearer.
- Actions : `upload-url` → `{upload_url, key}` ; `confirm` (métadonnées) ; `delete` ; `list`.
- Upload réel : PUT direct sur `upload_url` avec `Content-Type` du MIME.
- Quotas : **1 Go / utilisateur**, **50 Mo / fichier** (contrôle client AVANT l'appel,
  le serveur doit revérifier — voir ci-dessous).
- `detectMime` = port de `fmMimeOf` (type explicite > extension .pdf/.png/.webp > image/jpeg).
- Non porté (reste côté UI, étape 4) : compression canvas `fmCompressImage`,
  migration des documents legacy `fmDocsMigrateLegacy`, affichage `fmDocsQuota`.

### chariow.js ← supabase/functions/chariow-webhook/index.ts (mvp-copilot)
- Signature : HMAC-SHA256 du corps **brut**, header `x-chariow-signature`,
  comparaison timing-safe insensible à la casse (port fidèle, `crypto.timingSafeEqual`
  côté Node au lieu du XOR manuel Deno).
- Événements ACTIVATE / DEACTIVATE repris tels quels (variantes `license.*` incluses).
- Sécurité 07/10/2026 conservée : **produit inconnu → rejeté, jamais de Pro offert** ;
  `licenseFromSale` retourne `{rejected:true}` et `processWebhook` → `unknown_product`.
- Anti-doublon : `createSaleRegistry()` = mémoire (tests). **En production, persistance
  obligatoire** via `payments.external_id` (le registre mémoire meurt au redémarrage).
- `resolveUser(email)` injecté : en prod = lookup `profiles` par email (+ `chariow_unmatched`
  si aucun compte) ; les écritures DB (`app_metadata`, `copilot_quotas`, `payments`)
  restent dans la Edge Function, hors périmètre de ce module pur.
- Durée de licence : 30 jours si la vente ne fournit pas `expiresAt`.

### ocr.js ← edge-function-ocr.ts (+ fmOcrOnline ~l.3166)
- CIBLE : la clé OCR.space ne transite plus jamais côté client (la prod actuelle
  appelle encore `api.ocr.space` en direct avec clé en clair — à débrancher à la bascule).
- Constantes reprises : `MAX_CHARS = 1 800 000`, `LANGS = fre/eng`, regex data URL,
  réponse filtrée `{ParsedResults:[{ParsedText}], IsErroredOnProcessing}`.
- `consent` explicite **obligatoire** (`CONSENT_REQUIRED` sinon) — exigence validée le 08/10.
- `shouldUseLocalFallback` : `true` si consentement refusé ou erreur de service
  (→ Tesseract local, étape UI).
- Non porté ici : les 3 tentatives + AbortController 90 s de `fmOcrOnline`
  (politique de retry = responsabilité de l'appelant UI).

## Points à valider côté serveur (Edge Functions)

1. **Déployer `ocr`** : `supabase secrets set OCR_SPACE_KEY=… ALLOWED_ORIGINS=https://fiscalmind-africa.pages.dev`
   puis `supabase functions deploy ocr` (verify_jwt activé par défaut).
2. **Contrôle de licence dans `ocr`** : le source porte un TODO — brancher la même règle
   que `copilot` (essai/abonnement expiré → 403), sinon l'OCR reste utilisable sans licence.
3. **Limite de débit `ocr`** : 20 req / 10 min **en mémoire d'instance** → pour un quota
   strict, basculer sur une table Postgres (recommandation du source).
4. **`chariow-webhook`** : déjà en prod (HMAC vérifié, JWT désactivé). Vérifier que
   `CHARIOW_PULSE_SECRET` et `CHARIOW_PRODUCTS_JSON` (`{"prd_co1troj3":"starter",
   "prd_zg2w9ck2":"pro"}`) sont bien positionnés.
5. **`r2-storage`** : revérifier côté serveur quota 1 Go / 50 Mo, type MIME et
   `user_id` (RLS par utilisateur) — le contrôle client de ce module ne suffit pas.
6. **Secrets** : `SUPABASE_URL` / `SUPABASE_ANON_KEY` en variables d'environnement
   (jamais dans le code) ; la clé ANON est publique par design, le reste ne l'est pas.

## fmCloud.js — persistance SaaS 100 % cloud (phase 7, 8 oct. 2026)

Couche d'accès Supabase **sans aucun stockage local** : chaque lecture/écriture
passe par PostgREST avec le JWT de session (RLS `auth.uid() = user_id` côté
serveur). Le `client` est **injecté** (ex. `svc.client` de `supabase.js`) et
`uid` est l'`auth.users.id` de la session — le module est 100 % testable
(client PostgREST mocké dans `tests/sync.test.js`, zéro DOM, zéro réseau).

Tables (créées côté dashboard via `migration/supabase-fm-entries.sql`) :
- `fm_entries(user_id, entry_id text, entry jsonb, pk (user_id, entry_id))` —
  écritures au format canonique du moteur ;
- `fm_journals(user_id, code, label, unique (user_id, code))` — journaux
  personnalisés (les codes par défaut sont constants côté app) ;
- `fm_chat(user_id pk, messages jsonb)` — historique copilote (100 max, gérés
  côté app) ;
- `fm_settings(user_id, key, value jsonb, pk (user_id, key))` — préférences
  (`periode`, `company`, `country`).

Règles :
- **Upserts** sur les clés métier (`onConflict: 'user_id,entry_id'`, etc.) ;
  **dernier écrit gagne** (`updated_at` via trigger).
- **Erreurs typées** `CloudError { code, message FR }` : `AUTH` (uid manquant →
  « Session expirée. Reconnectez-vous. »), `NETWORK` (panne réseau → « Pas de
  connexion réseau… Vérifiez votre connexion puis réessayez. »), `DB`
  (erreur serveur → message + « Réessayez. »).
- **Subtilité supabase-js ≥ 2.117** : une panne réseau ne lève plus — postgrest-js
  retente 3 fois (backoff 1s+2s+4s) puis **résout** avec
  `{ error: { message: 'TypeError: Failed to fetch' } }`. `run()` détecte ce cas
  via `isNetworkError(res.error)` et le requalifie en `NETWORK` (sinon
  l'utilisateur lirait « Erreur serveur », trompeur). Les appels restent donc
  pendants ~7 s en cas de coupure réseau avant l'affichage de l'erreur —
  comportement assumé (état « Chargement… » affiché entre-temps).
- `app/src/store.js` n'est qu'une fine couche async : `ctx()` récupère
  `{ client, uid }` depuis la session mémoire (`app/src/auth.js`) et délègue.
  Sans session ou sans config → `CloudError` (jamais de crash, jamais de
  fallback silencieux).

Écarts assumés :
- Pas de file d'attente hors-ligne ni de cache persistant : en cas d'échec,
  la modale de saisie **reste ouverte** (aucune donnée perdue) et l'utilisateur
  réessaie.
- `maybeSingle()` est utilisé pour `fm_settings` / `fm_chat` (une ligne par
  utilisateur) — absent → `null` → fallback applicatif.

## Phase 8 — nouvelles tables et services

- **Tables** (`migration/supabase-phase8.sql`, idempotent, RLS par utilisateur) :
  `fm_audit(user_id pk, items jsonb)` — checklists ; `fm_immos(user_id,
  immo_id, immo jsonb)` — immobilisations (+ `booked`) ; `fm_assurances(user_id,
  assurance_id, assurance jsonb)` — polices (+ `primes`, `sinistres`).
  Convertisseur et configuration : clés `fm_settings` (`fx_rates`,
  `tax_overrides`, `company`, `company_ifu`, `company_regime`) — aucune table.
- **fmCloud.js** : `cloudLoadAudit/SaveAudit`, `cloudLoadImmos/SaveImmo/
  DeleteImmo`, `cloudLoadAssurances/SaveAssurance/DeleteAssurance` (mêmes
  conventions : `CloudError`, upsert par clé métier, `needUid`).
- **R2** (`r2.js`, inchangé) : le classeur l'utilise via `createR2Service`
  câblé sur `svc.r2Call({ accessToken })` — jamais de clé côté client.
  En e2e sans token réel, l'archivage échoue proprement (documents
  « indisponibles ») sans bloquer l'extraction.
- **OCR** (`ocr.js`, inchangé) : l'Edge Function `ocr` n'est PAS déployée —
  le classeur affiche un état gracieux « activation en cours » et propose la
  saisie manuelle / le collage de texte. AUCUN appel direct à api.ocr.space
  (la clé en clair de l'ancienne prod ne doit jamais revenir côté client).

Écarts assumés (phase 8) :
- Sous-comptes tiers auto (401001…) : NON portés — le plan révisé est strict
  (1420 comptes, `validateEntry` engine-wide) ; le tiers reste dans le libellé
  (401/411). Registre de comptes personnalisés en `fm_settings` : piste future.
- Convertisseur : pas d'API de taux externe (l'ancien site utilisait déjà des
  taux hors-ligne codés en dur) ; taux modifiables en `fm_settings`, croisés
  recalculés par proportion. Historique graphique supprimé (données
  décoratives codées en dur dans l'ancien site).
- Classeur : pas d'OCR automatique tant que l'Edge Function `ocr` n'est pas
  déployée (point serveur connu) ; extraction sur texte collé + saisie
  manuelle opérationnelles.
