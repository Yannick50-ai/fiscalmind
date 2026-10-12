# Analyse DSF OHADA — classeur de Yannick vs SaaS migré

**Fichier analysé** : `/tmp/dsf_decrypted.xlsm` (101 feuilles, mot de passe `executive`)
**Date d'analyse** : 8 octobre 2026
**Méthode** : lecture des FORMULES Excel (openpyxl, `data_only=False`), pas seulement des valeurs.
**Mission** : analyse pure — AUCUNE modification du code du SaaS.

---

## 0. Vue d'ensemble du classeur

| Bloc | Feuilles | Rôle |
|---|---|---|
| Paramétrage | Intro, PLAN DES COMPTES, MENU PRINCIPAL, ENTITE | Identité de l'entité (nom, sigle, RCCM, NIF, exercice, dates) |
| Données sources | BALANCE N-1, BALANCE N | Balances à 8 colonnes + CUM2/CUM3/CUM4/CUM5 (préfixes 2/3/4/5 chiffres) |
| Contrôles | CONTROLE BALANCE, Equilibre comptes balance N-1/N | Équilibre S.I. / mouvements / S.F. des deux balances |
| Fiches | RECEVABILITE, FICHE R1, R2, R3, R4 | Identification (R1-R3), récapitulatif des notes (R4) |
| États (modèle 2) | Bilan actif, Bilan passif, compte de résultat, TFT, TBFT, Bilan modèle 1 | États financiers **système allégé (modèle 2)** |
| Notes | NOTE 1 à 36 (+3A-E, 8A, 15A/B, 16A/B/bis/C, 27A/B) | 46 feuilles, notes annexes OHADA |
| DGI | GARDE (DGI), Liste ETATS SUPPL DGI, SUPPL1-26, A1 | États supplémentaires **à saisie manuelle** |

### Modèle de données (plages nommées)

| Nom | Source | Contenu |
|---|---|---|
| `sfd` / `sfc` | BALANCE N, col. G/H | Soldes finals débit / crédit (exercice N) |
| `_sfd1` / `_sfc1` | BALANCE N-1, col. G/H | Soldes finals N-1 |
| `sid` / `sic` | BALANCE N, col. C/D | Soldes initiaux N |
| `_sid1` / `_sic1` | BALANCE N-1, col. C/D | Soldes initiaux N-1 |
| `md` / `mc` | BALANCE N, col. E/F | Mouvements débit / crédit N |
| `_md1` / `_mc1` | BALANCE N-1, col. E/F | Mouvements N-1 |
| `_cum2/3/4/5` | BALANCE N, col. I/J/K/L | Préfixes 2/3/4/5 chiffres du n° de compte (N) |
| `_cum21/31/41/51` | BALANCE N-1, col. I/J/K/L | Idem (N-1) |

**Idiome central** : `SUMIF(_cum3, 211, sfd)` = total des soldes finals débiteurs des comptes dont le préfixe à 3 chiffres = 211. Les formules combinent les préfixes 2/3/4 chiffres pour un grain fin (ex. `211` vs `2181`).

### ⚠️ Constat structurant n°1 : le classeur est en MODÈLE 2 (système allégé)

Le bilan porte la mention « MODELE 2 : BILAN ACTIF/PASSIF », le flux s'appelle **TFT** (Tableau des Flux de Trésorerie), pas TAFIRE. Le SaaS migré, lui, implémente le **TAFIRE** (système normal). Ce sont deux tableaux différents :
- **TFT** (modèle 2) : présentation directe par nature de flux (opérationnel / investissement / financement), alimenté par le **TBFT** (tableau de bord de contrôle, calculs de variations).
- **TAFIRE** (système normal) : méthode indirecte (CAFG → ETE → FR/BFE).

**Conséquence** : même avec un TAFIRE parfait, le SaaS ne reproduit PAS l'état que Yannick dépose. Il faut implémenter le **TFT + TBFT**.

---

## 1. BILAN ACTIF (modèle 2, refs AA–BZ)

### (a) Logique du classeur

Colonnes : **Brut | Amort/Dépréc | Net N | Net N-1**. Net = Brut − Amort.

| Réf | Rubrique | Brut (N) | Amort/Dépréc (N) |
|---|---|---|---|
| AD | IMMOBILISATIONS INCORPORELLES | Σ(AE:AH) | Σ(AE:AH) |
| AE | Frais de recherche et prospection | `211`+`2181` (sfd) | `2811`+`2911` (sfc) |
| AF | Brevets, licences, logiciels | `212`+`213`+`214` | `2812`+`2813`+`2814` (+`291x`) |
| AG | Fonds commercial, droit au bail | `215`+`216` | `2815`+`2816` |
| AH | Autres immob. incorporelles | `217`+`218`−`2181` | `2817`+`2818` |
| AI | IMMOBILISATIONS CORPORELLES | Σ(AJ:AN) | Σ(AJ:AN) |
| AJ | Terrains | `22` | `282`+`292` |
| AK | Bâtiments | `231`+`232`+`233`+`237` | `2831`+`2832`+`2837`+`293x` |
| AL | Aménagements, agencements | `234`+`235`+`238`+`239` | `283`−(`2831`+`2832`+`2833`+`2837`) |
| AM | Matériel, mobilier, actifs bio. | `24`−`245`−`2495` | `284`−`2845` |
| AN | Matériel de transport | `245`+`2495` | `2845`+`2945` |
| AP | Avances et acomptes sur immos | `25` (sfd) | `295` (sfc) |
| AQ | IMMOBILISATIONS FINANCIÈRES | AR+AS | AR+AS |
| AR | Titres de participation | `26` (sfd) | `296` (sfc) |
| AS | Autres immob. financières | `27` (sfd) | `297` (sfc) |
| AZ | **TOTAL ACTIF IMMOBILISÉ** | AD+AP+AI+AQ | idem |
| BA | Actif circulant HAO | `485`+`486` (sfd) | `498` (sfc) |
| BB | Stocks et encours | `31`+`32`+`33`+`34`+`35`+`36`+`37`+`38` | `39` (sfc) |
| BG | CRÉANCES ET EMPLOIS ASSIMILÉS | Σ(BH:BJ) | Σ(BH:BJ) |
| BH | Fournisseurs, avances versées | `40` (**sfd uniquement**) | `490` (sfc) |
| BI | Clients | `41`−`419` (**sfd**) | `491` (sfc) |
| BJ | Autres créances | `42`+`43`+`44`+`46`+`47`−`478` (**sfd**) | `492`+`493`+`495`+`496`+`497` (sfc) |
| BK | **TOTAL ACTIF CIRCULANT** | BA+BB+BG | idem |
| BQ | Titres de placement | `50` (sfd) | `590` (sfc) |
| BR | Valeurs à encaisser | `51` (sfd) | `591` (sfc) |
| BS | Banques, chèques, caisse | `52`+`53`+`54`+`57`+`581`+`582` (sfd) | `592`+`593` (sfc) |
| BT | **TOTAL TRÉSORERIE-ACTIF** | BQ+BR+BS | idem |
| BU | Écarts de conversion – actif | `478` (sfd) | — |
| BZ | **TOTAL GÉNÉRAL** | AZ+BK+BT+BU | idem |

**Règles métier** :
- **Comptes mixtes ventilés par sens** : `40` débiteur → BH (actif), `40` créditeur → DJ (passif) ; `41` débiteur → BI, `41` créditeur → DI. Le classeur le fait en prenant `sfd` OU `sfc` séparément — équivalent exact à la ventilation par sens du SaaS.
- **478 exclu des créances** (BJ) et isolé en BU ; **479 exclu des dettes** (DM) et isolé en DV.
- **419** (clients créditeurs) exclu de BI, bascule en DI au passif.
- Les **29x** (dépréciations) sont agrégés dans la colonne Amort/Dépréc avec les 28x.

### (b) État du SaaS (`bilanData`)

Version **simplifiée** (~12 rubriques, pas de refs) :
- Actif : « Immobilisations incorporelles (21) », « corporelles (22 à 24) », « Avances (25) », « financières (26, 27) », « Stocks (31 à 33) », « Fournisseurs débiteurs (40) », « Clients (41) », « Autres créances (42 à 48) », « Banques, caisse (51 à 58) ».
- Ventilation des mixtes par sens : **correcte** (équivalent fonctionnel du sfd/sfc).
- Pas de colonnes Brut/Amort, pas de sous-rubriques, pas de BU (478), pas de BA (HAO).

### (c) Écarts précis

| # | Écart | Gravité |
|---|---|---|
| B1 | Rubriques non conformes au modèle 2 : pas de refs AA–BZ, pas de sous-détail (AE/AF/AG/AH, AJ/AK/AL/AM/AN, BH/BI/BJ, BQ/BR/BS) | Haute — l'état imprimé n'est pas la DSF |
| B2 | Pas de colonnes Brut / Amort-Dépréc / Net (le SaaS ne montre que le net) | Haute |
| B3 | `478` (écart de conversion actif) non isolé en BU ; agrégé dans « Autres créances (42 à 48) » | Moyenne |
| B4 | Actif circulant HAO (BA : 485+486) non isolé | Moyenne |
| B5 | Stocks : SaaS = 31+32+33 ; classeur = 31→38 | Moyenne |
| B6 | Trésorerie-actif : SaaS = 51,52,53,54,56,57,58 ; classeur = 50,51,52,53,54,57,581,582 (+590-593 en dépréc) ; le 56 créditeur appartient au passif | Moyenne |
| B7 | « Bilan modèle 1 » (présentation paysage) absent du SaaS | Basse (confort) |

### (d) Plan

1. Réécrire `bilanData` (actif) sur les rubriques AA–BZ du tableau ci-dessus, avec `brut`, `amort`, `net` par ligne.
2. Isoler 478→BU, 485/486→BA, 50/581/582→BQ/BR/BS.
3. Page États : afficher Brut/Amort/Net (3 colonnes + Net N-1).

---

## 2. BILAN PASSIF (modèle 2, refs CA–DZ)

### (a) Logique du classeur

| Réf | Rubrique | Formule N (sfc sauf mention) |
|---|---|---|
| CA | Capital | `101`+`102`+`103`+`104` |
| CB | Apporteurs, capital non appelé (−) | `109` sfc − `109` sfd |
| CD | Primes liées au capital | `105` |
| CE | Écarts de réévaluation | `106` |
| CF | Réserves indisponibles | `111`+`112`+`113` |
| CG | Réserves libres | `118` |
| CH | Report à nouveau (+/−) | `121` sfc − `129` sfd |
| CJ | **Résultat net de l'exercice** | **=`'compte de résultat'!F54`** (lien, pas un calcul de comptes) |
| CL | Subventions d'investissement | `14` |
| CM | Provisions réglementées | `15` |
| CP | **TOTAL CAPITAUX PROPRES** | Σ(CA:CM) |
| DA | Emprunts et dettes financières | `161`→`168` + `181`→`184` |
| DB | Dettes de location-acquisition | `17` |
| DC | Provisions pour risques et charges | `19` |
| DD | **TOTAL DETTES FINANCIÈRES** | DA+DB+DC |
| DF | **TOTAL RESSOURCES STABLES** | CP+DD |
| DH | Dettes circulantes HAO | `481`+`482`+`484`+`488`+`4998` |
| DI | Clients, avances reçues | `41` (**sfc uniquement**) |
| DJ | Fournisseurs d'exploitation | `40` (**sfc uniquement**) |
| DK | Dettes fiscales et sociales | `44`+`42`+`43` |
| DM | Autres dettes | `185`+`45`+`46`+`47` − `479` |
| DN | Provisions pour risques (court terme) | `499`−`4998` + `599` |
| DP | **TOTAL PASSIF CIRCULANT** | Σ(DH:DN) |
| DQ | Banques, crédits d'escompte | `564`+`565` |
| DR | Banques, crédits de trésorerie | `52`+`53` (sfc) + `561`+`566` |
| DT | **TOTAL TRÉSORERIE-PASSIF** | DQ+DR |
| DV | Écart de conversion – passif | `479` (sfc) |
| DZ | **TOTAL GÉNÉRAL** | DF+DP+DT+DV |

**Contrôle** : `'compte de résultat'!F57` = `F54 − 'Bilan passif'!D18` doit être 0 (cohérence CR ↔ Bilan).

### (b) État du SaaS

Simplifié : Capital (10), Réserves (11), Report à nouveau (12), Résultat net, Autres capitaux propres (14,15) / Emprunts (16-18) / Fournisseurs (40), Clients créditeurs (41), Dettes fiscales et sociales (42-44), Autres dettes (45-48) / Découverts (56). Le résultat net est bien injecté (correctif du 8 oct.).

### (c) Écarts précis

| # | Écart | Gravité |
|---|---|---|
| P1 | Pas de refs CA–DZ ni de sous-rubriques (CB, CD, CE, CF, CG, CH, CL, CM, DA, DB, DC, DH, DI, DJ, DK, DM, DN, DQ, DR, DV) | Haute |
| P2 | `479` non isolé en DV (agrégé dans « Autres dettes ») | Moyenne |
| P3 | `4998` non ventilé (DH vs DN) ; `599` absent de DN | Moyenne |
| P4 | Trésorerie-passif : SaaS = 56 uniquement ; classeur = 564+565 / 52+53+561+566 | Moyenne |
| P5 | Le contrôle CR↔Bilan existe dans le SaaS (badge Actif=Passif) mais pas le contrôle explicite CJ=F54 | Basse |

### (d) Plan

1. Réécrire `bilanData` (passif) sur les rubriques CA–DZ.
2. Isoler 479→DV, ventiler 4998 (DH/DN), ajouter 599 à DN.
3. Trésorerie-passif : 564+565 / 52+53+561+566.

---

## 3. COMPTE DE RÉSULTAT (cascade SIG, refs TA–XI)

### (a) Logique du classeur

Produits : `SUMIF(cum, xxx, sfc) − SUMIF(cum, xxx, sfd)` (net des deux sens).
Charges : `−SUMIF(cum, xxx, sfd)`. Variations de stocks : `−(sfd − sfc)`.

| Réf | Libellé | Comptes |
|---|---|---|
| TA | Ventes de marchandises | 701 |
| RA | Achats de marchandises | 601 |
| RB | Variation stocks marchandises | 6031 |
| **XA** | **MARGE COMMERCIALE** | TA+RA+RB |
| TB | Ventes produits fabriqués | 702+703+704 |
| TB | Ventes produits fabriqués | 702+703+704 |
| TC | Travaux, services vendus | 705+706 |
| TD | Produits accessoires | 707 |
| **XB** | **CHIFFRE D'AFFAIRES** | TA+TB+TC+TD |
| TE | Production stockée (ou déstockage) | 73 : −(sfc−sfd) |
| TF | Production immobilisée | 72 |
| TG | Subventions d'exploitation | 71 |
| TH | Autres produits | 75 |
| TI | Transferts de charges d'exploitation | 781 |
| RC | Achats de matières premières | 602 |
| RD | Variation stocks MP | 6032 : −(sfd−sfc) |
| RE | Autres achats | 604+605+608 |
| RF | Variation autres approvisionnements | 6033 : −(sfd−sfc) |
| RG | Transports | 61 |
| RH | Services extérieurs | 62+63 |
| RI | Impôts et taxes | 64 |
| RJ | Autres charges | 65 |
| **XC** | **VALEUR AJOUTÉE** | XB+RA+RB + (TE→RJ) |
| RK | Charges de personnel | 66 |
| **XD** | **EXCÉDENT BRUT D'EXPLOITATION** | XC+RK |
| TJ | Reprises d'amortissements/provisions | 791+798+799 |
| RL | Dotations aux amort./prov. | 681+691 |
| **XE** | **RÉSULTAT D'EXPLOITATION** | XD+TJ+RL |
| TK | Revenus financiers | 77 |
| TL | Reprises financières | 797 |
| TM | Transferts de charges financières | 787 |
| RM | Frais financiers | 67 |
| RN | Dotations financières | 697 |
| **XF** | **RÉSULTAT FINANCIER** | TK+TL+TM+RM+RN |
| **XG** | **RÉSULTAT ACTIVITÉS ORDINAIRES** | XE+XF |
| TN | Produits cessions d'immobilisations | 82 |
| TO | Autres produits HAO | 84+86+88 |
| RO | VNC des cessions d'immobilisations | 81 |
| RP | Autres charges HAO | 83+85 |
| **XH** | **RÉSULTAT HAO** | TN+TO+RO+RP |
| RQ | Participation des travailleurs | 87 |
| RS | Impôts sur le résultat | 89 |
| **XI** | **RÉSULTAT NET** | XG+XH+RQ+RS |

### (b) État du SaaS (`compteResultatData`)

Cascade simplifiée : CA(70) → EBE → résultat d'exploitation → résultat financier → RAO → résultat HAO → résultat net. Les montants agrégés sont justes, mais **ni les refs, ni les SIG intermédiaires officiels** (XA, XB, XC, XD, XE, XF, XG, XH) ne sont produits.

### (c) Écarts précis

| # | Écart | Gravité |
|---|---|---|
| C1 | Pas de refs TA–XI, pas de SIG intermédiaires (XA marge commerciale, XB chiffre d'affaires, XC valeur ajoutée, XD EBE, XE, XF, XG, XH) — l'imprimé n'est pas la DSF | Haute |
| C2 | Achats : SaaS = 60+61 lumpés ; classeur = RA(601), RC(602), RE(604+605+608), RG(61) séparés | Haute |
| C3 | Dotations : SaaS = 68+69 ; classeur = RL(681+691), RN(697) | Haute |
| C4 | Reprises : SaaS = 78 ; classeur = TJ(791+798+799), TL(797) | Haute |
| C5 | TI (781) et TM (787) non isolés dans le SaaS (noyés dans 78) | Moyenne |
| C6 | Variations de stocks : SaaS = néant (variations non calculées !) ; classeur = RB(6031), RD(6032), RF(6033), TE(73) | Haute — impacte la valeur ajoutée |
| C7 | Production : SaaS = 71+72+73+75 lumpés ; classeur = TE, TF, TG, TH séparés | Moyenne |

### (d) Plan

1. Réécrire `compteResultatData` pour retourner **toutes les lignes TA–XI** avec refs et libellés officiels.
2. Implémenter les variations de stocks (6031/6032/6033/73) — actuellement absentes du SaaS.
3. Page États : afficher la cascade complète avec refs.

---

## 4. TFT + TBFT (Tableau des Flux de Trésorerie)

### (a) Logique du classeur

Le **TFT** est la présentation officielle (refs ZA–ZH) ; le **TBFT** (« Tableau de bord de contrôle des flux de trésorerie ») est la feuille de calcul intermédiaire qui alimente chaque ligne du TFT.

**TFT** :
| Réf | Libellé | Source |
|---|---|---|
| ZA | Trésorerie nette au 1er janvier | = TBFT!C8 |
| FA | CAFG | = TBFT!C20 |
| FB | − Actif circulant HAO | = −TBFT!C23 |
| FC | − Variation des stocks | = −TBFT!C24 |
| FD | Variation des créances | = −TBFT!C33 |
| FE | + Variation du passif circulant | = TBFT!C42 |
| **ZB** | **Flux opérationnel** | Σ(FA:FE) |
| FF | − Acquisitions immos incorporelles | = −TBFT!C58 |
| FG | − Acquisitions immos corporelles | = −TBFT!C75 |
| FH | − Acquisitions immos financières | = −TBFT!C79 |
| FI | + Cessions immos incorp./corp. | = TBFT!C83 |
| FJ | + Cessions immos financières | = TBFT!C88 |
| **ZC** | **Flux d'investissement** | Σ(FF:FJ) |
| FK | + Augmentation de capital | = TBFT!C98 |
| FL | + Subventions reçues | = TBFT!C104 |
| FM | − Prélèvements sur capital | = TBFT!C110 |
| FN | − Dividendes versés | = TBFT!C112 |
| **ZD** | **Flux capitaux propres** | Σ(FK:FN) |
| FO | + Emprunts | = TBFT!C114 |
| FP | + Autres dettes financières | = TBFT!C115+C116 |
| FQ | − Remboursements | = TBFT!C117 |
| **ZE** | **Flux capitaux étrangers** | Σ(FO:FQ) |
| **ZF** | **Flux de financement** | ZD+ZE |
| **ZG** | **VARIATION TRÉSORERIE NETTE** | ZB+ZC+ZF |
| **ZH** | **Trésorerie nette au 31/12** | ZG+ZA |

**TBFT** (extraits — logique) :
- **Trésorerie au 1er janvier** : tréso-actif N-1 (50,51,52,53,54,57,581,582 — soldes initiaux N) ± 472 − tréso-passif N-1 (564,565,52,53,561,566 — S.I.).
- **CAFG** = XD (EBE du CR) + 654 (sfd) − 754 (sfc) + XF + TO − RP − RQ − RS.
- **Variations** : pour N, Δ = S.F.(N) − S.F.(N-1) ; pour N-1, Δ = S.F.(N-1) − S.I.(N-1). Ajustements par compte (478, 419, 414, 467, 458, 4494, 4751 côté créances ; 409, 404, 481, 482, 467, 4752, 472 côté dettes) pour exclure les flux d'investissement/financement du BF opérationnel.
- **Investissements** : Δ nettes des postes AD/AI + dotations (6812, 6813, 6913, 6914) + VNC (811, 812, 6541, 6542) ± dettes fournisseurs d'immos (4041/4046/4047, 4811/4812, 4821/4822, 48161/48162, 48171/48172, 48181/48182) − subventions virées (1061, 1062, 154, 1984).
- **Financement** : Δ 10/106/109/467/4581 (capital), Δ 14/799/4582/4494/4497 (subventions), 465 (dividendes), Δ 16/18/183/17 (dettes financières).
- **⚠️ Ambiguïté signalée** : la ligne FQ « Remboursements » (=TBFT!C117 en N, =−TBFT!D117 en N-1) a un signe incohérent entre les deux colonnes — à vérifier avec Yannick avant implémentation.

**Contrôles TFT** (colonne J) : T NET N = tréso-actif N − tréso-passif N (via 'Bilan modèle 1') ; ZG = ZB+ZC+ZF ; ZH = G+A.

### (b) État du SaaS (`tafire.js`)

Le SaaS implémente le **TAFIRE** (système normal), pas le TFT. Aucune des lignes ZA–ZH n'existe.

### (c) Écarts précis

| # | Écart | Gravité |
|---|---|---|
| T1 | Le SaaS n'a pas de TFT — l'état déposé par Yannick est absent | Haute |
| T2 | Le SaaS n'a pas de TBFT (calculs de variations avec ajustements) | Haute |
| T3 | CAFG : le SaaS la calcule (tafire.js) mais avec une formule différente (ebe+prodFin−chFin+prodHAO−chHAO−part−IS) vs classeur (XD+654−754+XF+TO−RP−RQ−RS) | Moyenne |

### (d) Plan

1. Nouveau moteur `src/engine/tft.js` : `tftData(lines, {from, to})` retournant ZA–ZH + détail TBFT, en suivant la logique ci-dessus (soldes N, N-1, S.I.).
2. Clarifier le signe de FQ avec Yannick avant de coder.
3. Page États : nouvel onglet « TFT ».

---

## 5. NOTES ANNEXES (1–36, 46 feuilles)

### (a) Logique du classeur

Trois familles :
1. **Tableaux de mouvements** (calculés depuis la balance) : 3A (immos brutes : ouverture=S.I. déb., acquisitions=MOUV. déb., cessions=MOUV. créd.), 3C (amortissements : ouverture=S.I. créd., dotations=MOUV. créd., sorties=MOUV. déb., clôture=A+B−C), 28 (provisions : même pattern sur 19/29/39/49/59/69).
2. **Soldes N/N-1 + variation %** : 4 (immos financières 271–275), 6 (stocks), 7 (clients), 8 (autres créances), 9 (titres placement), 10 (valeurs à encaisser), 11 (disponibilités), 13 (capital), 14 (primes/réserves), 15A (subventions), 16A (dettes financières + échéancier), 17 (fournisseurs), 18 (dettes fiscales/sociales), 19 (autres dettes), 20 (banques), 21 (CA par zone : 701x–707x), 22 (achats par sous-compte), 23 (transports), 24 (services extérieurs), 25 (impôts), 26 (autres charges), 27A (personnel), 29 (financier), 30 (HAO), 32 (production), 33 (achats production).
3. **Manuelles / rédactionnelles** : 1, 2, 3B (partiel), 3E, 8A, 15B, 16B/bis/C, 27B, 31 (partiel), 35, 36.

**NOTE 34** (synthèse indicateurs) : liens directs vers les SIG du CR + variations % — triviale une fois le CR aligné.

### (b) État du SaaS (`annexesData`)

Très partiel : immos (brut par préfixe), amortissements (28+29 lumpés), stocks (31–33), créances (41–47), dettes (40–48, 16), personnel (comptes 66). Aucune note numérotée, aucun tableau de mouvements, aucune variation %.

### (c) Écarts précis

| # | Écart | Gravité |
|---|---|---|
| N1 | 36 notes officielles absentes (numérotation, intitulés, tableaux) | Haute |
| N2 | Tableaux de mouvements (3A, 3C, 28) non implémentés — pattern S.I./MOUV. pourtant simple | Haute |
| N3 | Variations % N/N-1 absentes partout | Moyenne |
| N4 | Notes par sous-compte (21–27A) absentes | Moyenne |
| N5 | Notes manuelles (1, 2, 16B/C, 27B, 35) : pas de formulaire de saisie | Basse (phase 2) |

### (d) Plan

1. Moteur `src/engine/notes.js` : fonctions par note calculable (priorité : 3A, 3C, 4, 6, 7, 8, 11, 13, 16A, 17, 18, 19, 20, 21, 28).
2. Page « Notes annexes » : sélecteur de note, tableaux N/N-1/var%.
3. Formulaires de saisie pour les notes manuelles (phase 2).

---

## 6. FICHES R1–R4

### (a) Logique du classeur
- **R1** : identification complète (dénomination, sigle, adresse, RCCM, NIF, régime, exercice, contact, expert-comptable) — tirée de la feuille ENTITE.
- **R2/R3** : renseignements divers (dirigeants, associés — saisie manuelle).
- **R4** : fiche récapitulative des notes annexes (liste des notes chiffrées/non chiffrées).

### (b) État du SaaS
La page Configuration a « Mon entreprise » (nom, IFU, etc.) mais pas de fiche R1 normalisée ni R2/R3/R4.

### (c) Écarts
| # | Écart | Gravité |
|---|---|---|
| R1 | Pas de génération des fiches R1–R4 au format DSF | Moyenne |

### (d) Plan
1. Étendre la fiche entreprise (champs R1 : RCCM, régime, dates d'exercice, expert-comptable).
2. Générer R1–R4 en PDF/CSV depuis les paramètres + notes.

---

## 7. ÉTATS SUPPLÉMENTAIRES DGI (SUPPL1–26 + A1)

### (a) Logique du classeur
27 feuilles : détail des charges (SUPPL1, par sous-compte 6011–608x), détail des produits (SUPPL2), TVA (SUPPL3/4 : **mouvements de la période, pas les soldes**), puis états 5–26 et A1 (prélèvements). **Aucune formule** : ce sont des formulaires à saisie manuelle (constaté sur SUPPL1).

### (b) État du SaaS
Non implémentés.

### (c) Écarts
| # | Écart | Gravité |
|---|---|---|
| S1 | 27 états DGI absents | Moyenne (ils sont manuels, pas bloquants pour le calcul) |

### (d) Plan
Phase 2 : formulaires de saisie manuelle avec pré-remplissage suggéré depuis les soldes (ex. SUPPL3 : mouvements 443/445).

---

## 8. CONTRÔLES INTÉGRÉS

| Contrôle classeur | Localisation | Équivalent SaaS |
|---|---|---|
| Équilibre S.I./MOUV./S.F. des balances | CONTROLE BALANCE | ✅ badge « ✓ Équilibrée » (balance) |
| Actif = Passif | implicite (BZ=DZ) | ✅ badge « ✓ Actif = Passif » |
| Résultat CR = Résultat Bilan | CR!F57 = F54−Bilan!D18 | ✅ via injection du resNet (correctif 8 oct.) |
| TFT : ZH = tréso-actif − tréso-passif | TFT!J28, J39 | ❌ pas de TFT |
| Notes non chiffrées → signalées en R4 | RECEVABILITE | ❌ |

---

## 9. Plan d'implémentation ordonné par priorité

### P0 — Conformité des états de dépôt
1. **Bilan modèle 2** : réécrire `bilanData` (actif AA–BZ, passif CA–DZ) avec colonnes Brut/Amort/Net ; isoler 478→BU, 479→DV, 485/486→BA, 4998→DH/DN, 599→DN ; tréso-actif 50/51/52/53/54/57/581/582, tréso-passif 564+565/52+53+561+566.
2. **Compte de résultat SIG** : réécrire `compteResultatData` (lignes TA–XI) ; implémenter les variations de stocks (6031/6032/6033/73) ; mappings fins (601/602/604+605+608/61, 681+691/697, 791+798+799/797, 781/787).
3. Affichage : refs + libellés officiels dans la page États ; exports PDF/CSV alignés.

### P1 — Flux de trésorerie
4. **TFT + TBFT** : nouveau `src/engine/tft.js` (ZA–ZH) ; clarifier le signe de FQ avec Yannick ; onglet TFT.
5. Décision avec Yannick : **garder le TAFIRE en plus** (double présentation) ou le remplacer par le TFT ? (Recommandation : garder les deux, le TAFIRE restant utile en pilotage.)

### P1 — Notes prioritaires
6. `src/engine/notes.js` : 3A, 3C, 4, 6, 7, 8, 11, 13, 16A, 17, 18, 19, 20, 21, 28 + page de visualisation.

### P2 — Fiches et DGI
7. Fiches R1–R4 (champs entreprise étendus + génération).
8. SUPPL1–26 + A1 : formulaires manuels avec pré-remplissage.
9. Notes manuelles restantes (1, 2, 3E, 8A, 15B, 16B/bis/C, 27B, 31, 35).

### Prérequis transverses
- Le SaaS devra gérer **N-1** (soldes d'ouverture / exercice précédent) : le classeur compare systématiquement N vs N-1. Aujourd'hui le SaaS n'a qu'une période courante.
- Les **mouvements débit/crédit par compte** (pas seulement les soldes) sont nécessaires pour 3A/3C/28 et le TBFT — `periodMovements` existe déjà dans tafire.js, à réutiliser.

---

## ANNEXE — Table complète « rubrique → plages de comptes »

### A. Bilan actif (Brut = sfd, Amort = sfc ; Net = Brut − Amort)

| Réf | Rubrique | Brut | Amort/Dépréc |
|---|---|---|---|
| AE | Frais de recherche et prospection | 211, 2181 | 2811, 2911 |
| AF | Brevets, licences, logiciels | 212, 213, 214 | 2812, 2813, 2814, 2912, 2913, 2914 |
| AG | Fonds commercial, droit au bail | 215, 216 | 2815, 2816, 2915, 2916 |
| AH | Autres immob. incorporelles | 217, 218−2181, 2198 | 2817, 2818, 2917, 2919 |
| AJ | Terrains | 22 | 282, 292 |
| AK | Bâtiments | 231, 232, 233, 237 | 2831, 2832, 2837, 2931, 2932, 2933, 2937, 2939 |
| AL | Aménagements, agencements | 234, 235, 238, 239 | 283−(2831+2832+2833+2837), 2939 |
| AM | Matériel, mobilier, actifs bio. | 24−245−2495 | 284−2845, 294−2945−2949 |
| AN | Matériel de transport | 245, 2495 | 2845, 2945, 2949 |
| AP | Avances et acomptes sur immos | 25 | 295 |
| AR | Titres de participation | 26 | 296 |
| AS | Autres immob. financières | 27 | 297 |
| BA | Actif circulant HAO | 485, 486 | 498 |
| BB | Stocks et encours | 31, 32, 33, 34, 35, 36, 37, 38 | 39 |
| BH | Fournisseurs, avances versées | 40 (débiteur) | 490 |
| BI | Clients | 41−419 (débiteur) | 491 |
| BJ | Autres créances | 42, 43, 44, 46, 47 −478 (débiteur) | 492, 493, 495, 496, 497 |
| BQ | Titres de placement | 50 | 590 |
| BR | Valeurs à encaisser | 51 | 591 |
| BS | Banques, chèques, caisse | 52, 53, 54, 57, 581, 582 | 592, 593 |
| BU | Écarts de conversion – actif | 478 | — |

### B. Bilan passif (sfc sauf mention)

| Réf | Rubrique | Comptes |
|---|---|---|
| CA | Capital | 101, 102, 103, 104 |
| CB | Capital non appelé (−) | 109 (sfc − sfd) |
| CD | Primes liées au capital | 105 |
| CE | Écarts de réévaluation | 106 |
| CF | Réserves indisponibles | 111, 112, 113 |
| CG | Réserves libres | 118 |
| CH | Report à nouveau | 121 (sfc) − 129 (sfd) |
| CJ | Résultat net | = Compte de résultat XI |
| CL | Subventions d'investissement | 14 |
| CM | Provisions réglementées | 15 |
| DA | Emprunts et dettes financières | 161–168, 181–184 |
| DB | Dettes de location-acquisition | 17 |
| DC | Provisions risques et charges | 19 |
| DH | Dettes circulantes HAO | 481, 482, 484, 488, 4998 |
| DI | Clients, avances reçues | 41 (créditeur) |
| DJ | Fournisseurs d'exploitation | 40 (créditeur) |
| DK | Dettes fiscales et sociales | 42, 43, 44 |
| DM | Autres dettes | 185, 45, 46, 47 −479 |
| DN | Provisions risques (court terme) | 499−4998, 599 |
| DQ | Banques, crédits d'escompte | 564, 565 |
| DR | Banques, crédits de trésorerie | 52, 53 (créditeur), 561, 566 |
| DV | Écart de conversion – passif | 479 |

### C. Compte de résultat (N et N-1)

| Réf | Libellé | Comptes (produits : sfc−sfd ; charges : −sfd) |
|---|---|---|
| TA | Ventes de marchandises | 701 |
| RA | Achats de marchandises | 601 |
| RB | Variation stocks marchandises | 6031 : −(sfd−sfc) |
| XA | MARGE COMMERCIALE | TA+RA+RB |
| TB | Ventes produits fabriqués | 702, 703, 704 |
| TC | Travaux, services vendus | 705, 706 |
| TD | Produits accessoires | 707 |
| XB | CHIFFRE D'AFFAIRES | TA+TB+TC+TD |
| TE | Production stockée | 73 : −(sfc−sfd) |
| TF | Production immobilisée | 72 |
| TG | Subventions d'exploitation | 71 |
| TH | Autres produits | 75 |
| TI | Transferts de charges d'exploitation | 781 |
| RC | Achats matières premières | 602 |
| RD | Variation stocks MP | 6032 : −(sfd−sfc) |
| RE | Autres achats | 604, 605, 608 |
| RF | Variation autres approvisionnements | 6033 : −(sfd−sfc) |
| RG | Transports | 61 |
| RH | Services extérieurs | 62, 63 |
| RI | Impôts et taxes | 64 |
| RJ | Autres charges | 65 |
| XC | VALEUR AJOUTÉE | XB+RA+RB+TE+TF+TG+TH+TI+RC+RD+RE+RF+RG+RH+RI+RJ |
| RK | Charges de personnel | 66 |
| XD | EXCÉDENT BRUT D'EXPLOITATION | XC+RK |
| TJ | Reprises (exploitation) | 791, 798, 799 |
| RL | Dotations (exploitation) | 681, 691 |
| XE | RÉSULTAT D'EXPLOITATION | XD+TJ+RL |
| TK | Revenus financiers | 77 |
| TL | Reprises financières | 797 |
| TM | Transferts de charges financières | 787 |
| RM | Frais financiers | 67 |
| RN | Dotations financières | 697 |
| XF | RÉSULTAT FINANCIER | TK+TL+TM+RM+RN |
| XG | RÉSULTAT ACTIVITÉS ORDINAIRES | XE+XF |
| TN | Produits cessions d'immos | 82 |
| TO | Autres produits HAO | 84, 86, 88 |
| RO | VNC cessions d'immos | 81 |
| RP | Autres charges HAO | 83, 85 |
| XH | RÉSULTAT HAO | TN+TO+RO+RP |
| RQ | Participation des travailleurs | 87 |
| RS | Impôts sur le résultat | 89 |
| XI | RÉSULTAT NET | XG+XH+RQ+RS |

### D. TFT / TBFT

| Réf TFT | Libellé | Source TBFT |
|---|---|---|
| ZA | Trésorerie nette au 1er janvier | Tréso-actif N-1 (50,51,52,53,54,57,581,582, S.I.) ± 472 − Tréso-passif N-1 (564,565,52,53,561,566, S.I.) |
| FA | CAFG | XD + 654 − 754 + XF + TO − RP − RQ − RS |
| FB | − Actif circulant HAO | BA bilan − 485 |
| FC | − Variation des stocks | BB(N) − BB(N-1) |
| FD | Variation créances et emplois assimilés | BG(N) − BG(N-1), ajusté 478, 419, 414, 467, 458, 4494, 4751 |
| FE | + Variation passif circulant | DP(N) − DP(N-1), ajusté 409, 404, 481, 482, 467, 4752, 472 |
| ZB | Flux opérationnel | FA+FB+FC+FD+FE |
| FF | − Acquisitions immos incorporelles | Δ nettes AD + 6812 + 6913 + 6541 + 811 + 251 ± (4811, 4821, 4041, 4046, 48161, 48171, 48181) |
| FG | − Acquisitions immos corporelles | Δ nettes AI + 6813 + 6914 + 6542 + 812 − 1061 − 1062 − 154 − 1984 − (2286, 2316, 2326, 2416, 2426, 2446, 2456) − 2714 + 252 ± (4812, 4822, 4042, 4047, 48162, 48172, 48182) |
| FH | − Acquisitions immos financières | Δ mouvements 26, 27 ± 4813 |
| FI | + Cessions immos incorp./corp. | 821, 822, 7541, 7542 ± (4851, 4852, 4141, 4142) |
| FJ | + Cessions immos financières | 826 ± (4856, 4143) + Δ 27 |
| ZC | Flux d'investissement | −FF−FG−FH+FI+FJ |
| FK | + Augmentation de capital | Δ 10 − Δ 106 − Δ 109 ± 467, 4581 |
| FL | + Subventions reçues | Δ 14 − Δ 799 ± 4582, 4494, 4497 |
| FM | − Prélèvements sur capital | −(Δ 10 déb. − Δ 106 − Δ 109 + Δ 467 + Δ 4581) |
| FN | − Dividendes versés | −mouvements débiteurs 465 |
| ZD | Flux capitaux propres | FK+FL+FM+FN |
| FO | + Emprunts | Δ 16 |
| FP | + Autres dettes financières | Δ 18 − Δ 183 − mouvements débiteurs 17 |
| FQ | − Remboursements | (mouvements, signe du classeur) |
| ZE | Flux capitaux étrangers | FO+FP+FQ |
| ZF | Flux de financement | ZD+ZE |
| ZG | VARIATION TRÉSORERIE NETTE | ZB+ZC+ZF |
| ZH | Trésorerie nette au 31/12 | ZG+ZA |
| Contrôle | | ZH = Tréso-actif N − Tréso-passif N |

### E. Notes annexes — logique de calcul par note

| Note | Titre | Logique |
|---|---|---|
| 1 | Dettes garanties par sûretés réelles | Manuelle |
| 2 | Informations obligatoires | Manuelle |
| 3A | Immobilisations brutes | S.I. déb. / MOUV. déb. / cessions (MOUV. créd.) par préfixe fin |
| 3B | Biens en location-acquisition | Manuelle/comptes 17, 248 |
| 3C | Amortissements | S.I. créd. / MOUV. créd. (dotations) / MOUV. déb. (sorties) ; cumul = A+B−C |
| 3D | Plus/moins-values de cession | 82 vs 81 |
| 3E | Réévaluations | Manuelle |
| 4 | Immobilisations financières | S.F. déb. 271–275, N/N-1, variation %, ancienneté |
| 5 | Actif/dettes circulants HAO | 485, 486 / 481, 482, 484, 488 |
| 6 | Stocks et encours | 31–38 brut, 39 dépréc. |
| 7 | Clients | 41−419, 491 |
| 8 | Autres créances | 42–47, 478 |
| 8A | Charges immobilisées | 201–208, étalement |
| 9 | Titres de placement | 50, 590 |
| 10 | Valeurs à encaisser | 51, 591 |
| 11 | Disponibilités | 52, 53, 54, 57, 581, 582 |
| 12 | Écarts de conversion, transferts | 478, 479, 781, 787 |
| 13 | Capital | 10, 109, mouvements |
| 14 | Primes et réserves | 105, 106, 11 |
| 15A | Subventions, prov. réglementées | 14, 15 |
| 15B | Autres fonds propres | Manuelle |
| 16A | Dettes financières | 16, 17, 18, 19, échéancier |
| 16B/bis | Engagements de retraite | Manuelle |
| 16C | Actifs/passifs éventuels | Manuelle |
| 17 | Fournisseurs d'exploitation | 40 (créditeur) |
| 18 | Dettes fiscales et sociales | 44, 42, 43 |
| 19 | Autres dettes, prov. court terme | 45–47, 185, 499, 599 |
| 20 | Banques, crédits | 52, 53, 561, 564, 565, 566 |
| 21 | CA et autres produits | 701x–707x par zone (région/hors région/groupe/internet) |
| 22 | Achats | 601–608 par sous-compte |
| 23 | Transports | 61 par sous-compte |
| 24 | Services extérieurs | 62, 63 par sous-compte |
| 25 | Impôts et taxes | 64 par sous-compte |
| 26 | Autres charges | 65 par sous-compte |
| 27A | Charges de personnel | 66 par sous-compte |
| 27B | Effectif, masse salariale | Manuelle |
| 28 | Provisions et dépréciations | Mouvements 19, 29, 39, 49, 59, 69 |
| 29 | Charges et revenus financiers | 67, 77, 787, 797, 697 |
| 30 | Autres charges/produits HAO | 81–88 |
| 31 | Répartition résultat, 5 derniers ex. | Manuelle (partiel) |
| 32 | Production de l'exercice | 72, 73, 702–706 |
| 33 | Achats destinés à la production | 602, 604, 6032, 6033 |
| 34 | Synthèse indicateurs financiers | Liens vers SIG du CR + ratios |
| 35 | Infos sociales/environnementales | Manuelle |
| 36 | Table des codes | Référentiel |

---

*Fin du document — analyse réalisée le 8 octobre 2026 depuis les formules du classeur.*
*Zones signalées comme ambiguës : FQ (signe), NOTE 3B (non échantillonnée en détail), SUPPL6-26 (titres non relevés).*
