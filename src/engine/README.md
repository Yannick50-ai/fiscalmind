# Moteur comptable — FiscalMind Africa

Étape 1 de la migration : le cœur métier (plan comptable, partie double,
balance, grand livre, bilan, compte de résultat, TAFIRE, notes annexes)
extrait de `fiscalmind-app.html` en **modules ES 100 % purs** (aucun DOM,
aucun localStorage), couverts par des tests unitaires (`node:test`, zéro
dépendance).

```
src/engine/
├── chart-of-accounts.js   Plan SYSCOHADA révisé : 1420 comptes (classes 1-9),
│                          sens normal, intitulés  [FICHIER GELÉ — ne pas régénérer]
├── labels.js              accountLabel() — port de fmCompteLabel (repli parent)
├── journal.js             Écritures : modèle pièce, validation partie double,
│                          CRUD immuable, conversions de formats
├── trial-balance.js       periodBalances / cumulativeBalances / trialBalance
├── general-ledger.js      generalLedger (solde progressif)
├── financial-statements.js sumRubrique, resultatNet, bilanData,
│                          compteResultatData, annexesData
├── tafire.js              balancesBefore, periodMovements, bfe, tafireData
├── previous-year.js      previousYearBalances (soldes N/N-1 : cumulN, cumulN1,
│                          mouvN, mouvN1) + accountVariation (Δ pour le TFT)
├── NOTES.md               Décisions de portage, écarts assumés (À LIRE)
└── README.md              Ce fichier
```

## Formats

**Canonique (pièce)** — utilisé par `journal.js` :
```js
{ id: 'e...', date: '2025-01-12', journal: 'AC', piece: 'AC2025-0002',
  libelle: "Achat marchandises",
  lignes: [ { compte: '601', debit: 1000000, credit: 0 },
            { compte: '4452', debit: 180000, credit: 0 },
            { compte: '401',  debit: 0,       credit: 1180000 } ] }
```

**Lignes** — utilisées par tous les calculs (`toLines()` les produit) :
```js
{ id, date, journal, piece, compte, libelle, debit, credit }
```

**Historique** — le source stockait `{d, j, p, c, lib, debit, credit}` ;
`fromLegacyLines()` regroupe ces lignes par `(journal, pièce)` vers le
format canonique.

**Soldes** — `{ compte: { md, mc, solde } }`, `solde = md − mc`
(positif = débiteur, négatif = créditeur). Montants en FCFA entiers.

## Correspondance source → moteur

| Source (`fiscalmind-app.html`) | Moteur | Ligne source ≈ |
|---|---|---|
| `FM_PLAN` / `FM_CLASSES` | `chart-of-accounts.js` | 4328 / 4357 |
| `fmSensNormal` | `sensNormal` (déjà dans chart-of-accounts.js) | 4913 |
| `fmCompteLabel` | `labels.js › accountLabel` | 4901 |
| `saveEntry` (contrôles) + `fmNewEntryId` | `journal.js › validateEntry, newEntryId` | 4964 / 4895 |
| `fmSoldesPeriode` | `trial-balance.js › periodBalances` | 3616 |
| `fmSoldesCumules` | `trial-balance.js › cumulativeBalances` | 3628 |
| `fmBalance` | `trial-balance.js › trialBalance` | 4450 |
| `fmGrandLivre` | `general-ledger.js › generalLedger` | 4468 |
| `fmSommeRubrique` | `financial-statements.js › sumRubrique` | 3651 |
| `fmResultatNet` | `financial-statements.js › resultatNet` | 3666 |
| `fmBilanData` | `financial-statements.js › bilanData` (résultat en paramètre, voir NOTES.md §1) | 3675 |
| `fmCRData` | `financial-statements.js › compteResultatData` | 3715 |
| `fmRenderAnnexes` | `financial-statements.js › annexesData` (données, pas de HTML) | 3885 |
| `fmSoldesAvant` | `tafire.js › balancesBefore` | 3800 |
| `fmMouvementsPeriode` | `tafire.js › periodMovements` | 3812 |
| `fmBFE` | `tafire.js › bfe` | 3820 |
| `fmTAFIREData` | `tafire.js › tafireData` | 3830 |

## Exemple d'utilisation

```js
import { addEntry, toLines } from './src/engine/journal.js';
import { periodBalances, cumulativeBalances } from './src/engine/trial-balance.js';
import { bilanData, compteResultatData } from './src/engine/financial-statements.js';

let journal = [];
for (const ecriture of ecritures) {
  const r = addEntry(journal, ecriture);   // valide (partie double, plan comptable)
  if (!r.ok) throw new Error(r.errors.join('\n'));
  journal = r.entries;
}
const lignes = toLines(journal);
const periode = { from: '2025-01-01', to: '2025-12-31' };

const cr = compteResultatData(periodBalances(lignes, periode));
const bilan = bilanData(cumulativeBalances(lignes, { upTo: periode.to }), cr.resNet);
console.log('Actif = Passif ?', bilan.totA === bilan.totP); // true si journal cohérent
```

## Soldes N / N-1 (Phase 0 — infrastructure)

`previous-year.js › previousYearBalances(entries, { year })` fournit en un
appel les quatre vues exigées par les états à deux colonnes
(cf. `analyse-dsf-ohada.md` §0 et §4) : `cumulN` / `cumulN1` (soldes cumulés
au 31/12, classes 1-5, via `cumulativeBalances`) et `mouvN` / `mouvN1`
(mouvements de l'exercice, toutes classes, via `periodBalances`).
`accountVariation(cumulN, cumulN1, compte)` calcule le Δ N − N-1 par poste
pour le TFT.

**Hypothèse structurante : exercices = année civile (1/1 → 31/12).**
C'est l'hypothèse du SaaS : les exercices à cheval ne sont pas gérés —
N couvre strictement `AAAA-01-01` → `AAAA-12-31`.

## Tests

```sh
npm test   # node --test tests/*.test.js — 35 tests, 0 dépendance
```

Le mini-cas d'entreprise (`tests/statements.test.js`) vérifie : balance
équilibrée, cascade du compte de résultat, **Actif = Passif** (8 520 000 F),
cohérence résultat bilan/compte de résultat, TVA à décaisser (443 − 4452),
autocontrôle du TAFIRE (`dTresoCalc = dTresoReel`).
