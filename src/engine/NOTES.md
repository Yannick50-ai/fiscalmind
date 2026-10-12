# NOTES — décisions de portage du moteur comptable

Tenu à jour pendant l'étape 1 de la migration (8 oct. 2026).
Règle : extraction fidèle du code source (`~/workspace/your_files/fiscalmind-africa/fiscalmind-app.html`) ;
tout écart volontaire est documenté ici avec sa justification.

## 1. Résultat net du bilan — écart assumé (bug du source)

**Constat (vérifié empiriquement avec node, le 8 oct. 2026).**
Dans le source, `fmBilanData()` (~l. 3675) appelle `fmResultatNet(S)` où
`S = fmSoldesCumules()` ne contient que les classes **1 à 5**, alors que
`fmResultatNet` (~l. 3666) calcule `Σ(crédits − débits)` sur les classes
**6/7/8** puis soustrait le solde du compte `'13'` (clé exacte).
Avec le journal de démonstration (48 écritures) :
`totA = 9 216 900`, `totP = 8 366 400`, `res = 0` → **le bilan source ne s'équilibre pas**
dès que le résultat est non nul, et la ligne « Résultat net » affiche toujours 0
(sauf écriture directe sur un compte littéral `'13'`, jamais `'131'`/`'139'`).

**Décision.** `bilanData(soldesCumul, resultatNet)` reçoit le résultat net en
paramètre explicite — en pratique `compteResultatData(soldesPeriode).resNet`.
La structure des rubriques (RA/RC, ventilation des comptes mixtes, 28/29 en
déduction) est inchangée ; seule l'alimentation de la ligne « Résultat net
(13) » des capitaux propres est corrigée, ce qui rétablit l'intention évidente
du source (Actif = Passif, résultat cohérent bilan/compte de résultat).
`resultatNet(soldes)` reste exporté avec sa sémantique d'origine (testée).

## 2. Plan comptable — 1421 lignes, 1420 comptes distincts

`chart-of-accounts.js` (fourni, ne pas régénérer) : plan SYSCOHADA **révisé**
complet parsé du fichier Excel de Yannick (8 oct. 2026).
Le fichier contient **1421 lignes** dont la clé `'91'` figure deux fois avec un
contenu strictement identique → **1420 comptes distincts**
(`Object.keys(ACCOUNTS).length === 1420`, asserté dans les tests).
Doublon sans effet (même intitulé, même sens) mais à nettoyer côté source si
le fichier est régénéré.
Correspondance ancien → nouveau plan : `migration/correspondance-ancien-nouveau.json`
(13 renumérotés, 50 supprimés, 214 créés) — à utiliser pour migrer les journaux
existants le jour de la bascule.
`sensNormal()` est le port de `fmSensNormal()` (~l. 4913) déjà intégré au fichier.

## 3. Validation des comptes durcie

Le source (`saveEntry`, ~l. 4975) n'exigeait qu'un **format** : 2 à 6 chiffres —
les sous-comptes de tiers auto-créés (`401001`, `411001`…) passaient.
Le moteur exige désormais `isValidAccount(compte)` : le compte doit exister au
plan révisé (1420 comptes). C'est un **durcissement volontaire** demandé pour la
migration (décision parent, 8 oct. 2026) : fini les comptes « libres ».
Conséquence : à la bascule, les journaux existants devront être convertis via
`correspondance-ancien-nouveau.json` (comptes supprimés/renumérotés) avant
import.

## 4. Modèle « pièce » vs lignes isolées

Le source stocke des **lignes isolées** `{d, j, p, c, lib, debit, credit}` et ne
contrôle l'équilibre débit = crédit que **si la pièce est renseignée** (une
ligne seule sans pièce pouvait rester déséquilibrée, le journal affichant
alors un « Écart »).
Le moteur adopte le modèle canonique **pièce** :
`{id, date, journal, piece, libelle, lignes: [{compte, debit, credit}]}` et
**exige toujours** l'équilibre (c'est l'objet même de la partie double).
`flattenEntry()` / `toLines()` fournissent la vue « lignes » utilisée par tous
les calculs (balance, grand livre, états) ; `fromLegacyLines()` regroupe les
lignes historiques par `(journal, pièce)` pour la migration des données.

## 5. Fidélités diverses (détails)

- `trialBalance` (= `fmBalance`, ~l. 4450) : **aucun** filtre « compte
  numérique », contrairement à `periodBalances`/`cumulativeBalances` qui
  gardent le filtre `/^\d+$/` du source. Sous-totaux par classe + totaux
  conservés (`{md, mc, sd, sc}`).
- `cumulativeBalances` (= `fmSoldesCumules`, ~l. 3628) : classes 1-5
  uniquement, jusqu'à `upTo` inclus — inchangé.
- `balancesBefore` (= `fmSoldesAvant`, ~l. 3800) : **toutes** classes, dates
  strictement antérieures à `from` — inchangé (sert au TAFIRE).
- `bfe` (= `fmBFE`, ~l. 3820) : la `4451` (TVA récupérable sur
  immobilisations) est **exclue** des créances d'exploitation et reprise en
  emplois stables du TAFIRE (`dTvaImmo`) — correctif du 7 oct. conservé.
- `generalLedger` (= `fmGrandLivre`, ~l. 4468) : tri par date croissante,
  solde progressif `+= débit − crédit`, comparaison de compte **stricte**.
- `accountLabel` (= `fmCompteLabel`, ~l. 4901) : repli sur le compte parent le
  plus proche (`… (s/cpte NNN)`), sinon `Compte NNN`. Placé dans `labels.js`
  pour ne pas modifier `chart-of-accounts.js` (fichier gelé).
- Montants : entiers FCFA, `Math.round` comme dans le source ; aucun
  formatage dans le moteur (l'affichage `fr-FR` reste côté UI).
- Périodes : paramètres explicites `{from, to}` / `{upTo}` — le source
  lisait `state.periode` avec un défaut `2025-01-01 → 2025-12-31` ; ce défaut
  n'a pas été repris (pas de valeur cachée dans un moteur pur).

## 6. Non porté (étapes suivantes)

Lettrage, plan d'amortissement détaillé, exports PDF/Excel, UI, persistance
(localStorage/Supabase), R2, Chariow, OCR — conformément au périmètre de
l'étape 1.
