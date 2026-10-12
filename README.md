# FiscalMind Africa

SaaS comptable et fiscal pour les PME d'Afrique francophone — zone SYSCOHADA / OHADA.

**Production :** https://fiscalmind-africa.pages.dev/

## C'est quoi ?

FiscalMind Africa est une application web complète de comptabilité et de fiscalité adaptée aux 17 pays de l'espace OHADA. Elle permet à un comptable ou un entrepreneur de tenir sa comptabilité, de suivre ses obligations fiscales et d'interroger un copilote IA expert en SYSCOHADA.

## Fonctionnalités

- **17 modules** : Journal, Grand livre, Balance, États financiers (bilan, compte de résultat, TAFIRE), Lettrage (manuel + automatique), Immobilisations & amortissements, Trésorerie, Tiers (clients/fournisseurs), OCR de factures → écritures comptables, Copilote IA, Calendrier fiscal, Ratios & pilotage, Devises, Équipe, Admin.
- **Fiscalité multi-pays** : à l'inscription, choix parmi les 17 pays OHADA → calendrier fiscal, taux (TVA, IS, cotisations sociales) et réponses du copilote adaptés au pays. Taux personnalisables par le client.
- **Copilote IA** : réponses en français avec numéros de comptes SYSCOHADA, contexte fiscal du pays, sources officielles citées.
- **OCR factures** : photo ou scan → extraction (tiers, montants, TVA, dates) → proposition d'écritures modifiables → archivage.
- **Essai gratuit de 14 jours**, puis abonnements via SasPay (Mobile Money, cartes) avec activation automatique des licences par webhook.
- **PWA installable** sur Android, 100 % responsive (conçu mobile d'abord).
- **Isolation des données** par compte (RLS Supabase), rôles admin / équipe.

## Stack technique

| Couche | Technologie |
|---|---|
| Frontend | Vite + JavaScript vanilla (pas de framework), PWA |
| Backend | Supabase (PostgreSQL + RLS, Auth, Edge Functions, Storage) |
| Hébergement | Cloudflare Pages |
| Paiements | SasPay (webhook HMAC-SHA256) |
| IA | xKiro (via fonction Edge `copilot`) |
| OCR | OCR.space (clé côté serveur uniquement) |

## Structure du dépôt

```
app/                    → application Vite (source)
  src/
    main.js             → point d'entrée
    app.js, router.js   → routage des 17 modules
    auth.js             → authentification Supabase
    licence.js          → plans, quotas, essai 14 jours
    ui.js               → composants UI, tutoriel de bienvenue
    pages/              → un fichier par module (journal.js, etats.js, …)
    styles/             → CSS (design « Afrique Premium », responsive)
  index.html
  manifest.json         → PWA
supabase-functions-*-index.ts → code source des Edge Functions :
  saspay-webhook        → activation auto des licences après paiement
  copilot               → proxy IA + quotas par plan
  ocr                   → extraction de factures (clé serveur)
  team                  → gestion d'équipe (plan Pro)
  admin-settings        → paramètres (IA, clés, quotas)
  admin-integrations    → SasPay, Cloudflare, Supabase, OCR
supabase-*.sql          → schémas et politiques RLS
src/                    → moteur comptable pur (plan comptable SYSCOHADA, 1 420 comptes)
tests/                  → tests unitaires (527 tests)
scripts/                → utilitaires de migration et déploiement
references/             → données fiscales des 17 pays OHADA
```

## Déploiement

```bash
cd app
npm run build
npx wrangler pages deploy dist --project-name=fiscalmind-africa
```

Prérequis : variables `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` au build (sans elles, l'app affiche « Connexion serveur non configurée »).

Les Edge Functions se déploient depuis le dashboard Supabase (copier le contenu des fichiers `supabase-functions-*-index.ts`).

## Tarifs (XOF)

- **Gratuit** : 0 — 10 questions IA/mois, 100 Mo, 30 écritures/mois
- **Essentiel** : 14 900 /mois ou 149 000 /an
- **Pro** : 44 900 /mois ou 449 000 /an (3 utilisateurs, équipe)
- **Offre fondateur −30 % à vie** pour les 50 premiers inscrits

## Sécurité

- Secrets (clés API, webhooks) uniquement côté serveur — jamais dans le frontend.
- RLS sur toutes les tables, quotas atomiques, rate limiting.
- Audit de sécurité : 527/527 tests réussis.

## Licence

Code privé — tous droits réservés. Voir les CGU sur le site.
