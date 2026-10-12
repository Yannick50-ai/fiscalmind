# Données fiscales 17 pays OHADA — notes d'extraction (étape 2)

## Provenance

Deux sources combinées, sans invention :

1. **`~/workspace/fiscal-pays-recherche/*.json`** (17 fichiers) — recherche sur sites
   officiels (DGI, CNSS, Cleiss…) réalisée le 8 oct. 2026. Contient : taux TVA/IS
   (nombres), données sociales (chaînes descriptives), déclarations (nom/fréquence/
   échéance), impôt sur les salaires, niveau de confiance.
2. **`FM_COUNTRY_DATA` dans `fiscalmind-app.html`** (lignes 5191–5672) — état
   **déployé en production le 8 oct. 2026**, incluant les corrections de la
   vérification experte fournie par Yannick. Contient : calendriers mensuels
   (`events`), fiches stratégiques (`rules`), libellés, et `socialDetail` pour
   7 pays (architecture `{employer, employee, combined, basis, org, status}`).

Génération reproductible : `scripts/build-country-data.js`
(`node scripts/build-country-data.js`). Ne pas éditer les fichiers générés à la main.

## Corrections expertes appliquées (prioritaires sur les JSON bruts)

| Pays | JSON brut (social) | Valeur retenue | Statut |
|---|---|---|---|
| BF | 16,5 % / 5,5 % | **16 % / 5,5 %** (total 21,5 %) | Confirmé (CNSS) |
| GN | 18 % / 2,5 % (confiance basse) | **18 % / 5 %** (total 23 %) | Confirmé par CNSS |
| GW | 14 % (+2 % AT) / 8 % « à vérifier » | **≈14 % / ≈8 %** (total ≈22 %) | Provisoire — à vérifier |
| ML | 16 % / 3,5 %+3,5 % | **18,9–21,9 % / 6,66 %** (fourchette) | Partiellement confirmé |
| NE | 16 % / 5,5 % | **16,4 % / 5,25 %** (total 21,65 %) | Confirmé avec périmètre (+0,5 % ANPE séparée) |
| CD | 20,28 % / 4 % | **13 % / 5 %** (total 18 %, périmètre CNSS) | Confirmé pour CNSS — hors INPP/ONEM |

TVA/IS : les taux JSON et déployés concordent partout (18 % ×9 pays, 19 % NE/CF,
19,25 % CM, 20 % GN, 16 % CD, 15 % GQ, 10 % GW/KM ; IS 27,5 % BF, 33 % CM, etc.).

## Pays sans vérification experte (11)

`socialDetail` absent du frontend déployé → valeurs numériques extraites des JSON,
statut **« À vérifier »**. Calculs effectués (documentés champ `notes` par pays) :
- **CM** : employeur 4,2 + 7 + AT(1,75–5) → fourchette {12,95 ; 16,2}.
- **KM** : 5 % retraite + 2,5–5 % AT-MP + 1 % maternité → {8,5 ; 11} (non-fonctionnaires).
- **GA** : 8 + 7 + 1,75 → 16,75 (source unique).
- **CG** : 8 + 12,28 + 4,55 → 24,83 / salarié 4 + 2,27 → 6,27 (CAMU à vérifier).
- **SN** : 7 + AT(1–5) + 8,4 → {16,4 ; 20,4} (régime général, hors cadre et IPM).
- **BJ/CI** : fourchettes reprises telles quelles des JSON.
- **GQ/CF/TD/TG** : totaux directs des JSON.

## Manques et limites constatés dans les sources

- **Calendriers clairsemés** : GN (2 échéances), GQ (3), CG (2) — très probablement
  incomplets dans la source déployée. Les 14 autres pays ont 15 à 49 échéances.
- **GW** : taux sociaux approximatifs (≈), base « à vérifier ».
- **KM/SN** : plusieurs régimes possibles (fonctionnaires/cadres) — seul le régime
  général est retenu, noté dans `notes`.
- **`confidence` JSON → `statut`** : haute → « Confirmé », moyenne →
  « Partiellement vérifié », basse → « À vérifier ». C'est une confiance dans la
  *recherche*, pas une certification des taux : les taux sociaux des 11 pays non
  vérifiés restent « À vérifier » quel que soit le statut pays.
- **Champ `combined`** : `null` quand l'employeur est une fourchette (ML, BJ, CM,
  KM, CI, SN) — pas de total unique possible.

## Extensions de schéma vs le besoin UI

Le besoin UI (`fmCountryData`) exigeait `{code, nom, tva, is, social{…}, statut}`.
Ajouts nécessaires et documentés : `devise`, `administrationFiscale`, `orgSocial`,
`impotSalaires`, `labels` (TVA/IS/SAL/SOC/ANNUEL), `social.notes`, `social.basis`.
`tva`/`is` sont des **nombres** (%, ex. 27.5) ; `social.employer/employee` : nombre
ou `{min, max}` pour les fourchettes.

## `applyTaxOverrides`

Port pur de la logique `fmCountryData()` + `fmGetTaxOverrides()` (fusion des
« Paramètres fiscaux » personnalisés). Seules les valeurs numériques finies sont
appliquées ; `combined` est recalculé ; le statut devient
« Personnalisé par l'utilisateur ». L'objet d'origine n'est jamais muté.
