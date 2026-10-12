# Analyse — Liasse / CE / PT / Ratios (2e classeur)

**Fichier** : `~/workspace/user/files/LIASSE__CE__PT__RATIOS_MSG-NO-Pro_V2_-_Light.xlsm_0_j8s6.xlsx`
**131 feuilles**, s'ouvre **sans mot de passe** (protection interne des feuilles : `Menz12011956MSG`).
**Date d'analyse** : 8 octobre 2026 — lecture des FORMULES (`data_only=False`) + extraction VBA complète (`oletools`).
**Référence VBA** : `migration/references/vba-liasse-ce-pt-ratios.txt` (68 modules `.bas` significatifs, code nettoyé).

> Produit commercial : **« NO-Pro.V2 »** de MSG (`info@msg-innov.online`, +225 0707253016 / +225 07 00 000 981).
> Le classeur embarque un **DRM de licence** (voir §8). Les données d'exemple sont celles d'un
> dossier burkinabè (ETS AFRICATEX, RCCM BF OUA 2003 A 3167) mais **les taux paramétrés sont
> ivoiriens** (TVA 18 %, BIC 25 %, IMF 0,5 %) — voir §7.

---

## 0. Cartographie des 131 feuilles

| Bloc | Feuilles |
|---|---|
| Paramétrage | ACCUEIL, COUVERTURE, GARDE, PLAN DES COMPTES, Plan Comptable, CODES ACTIVITES |
| Données sources | BALANCE N, BALANCE N-1, GRAND-LIVRE N, TABLES DE CORRESPONDENCE, TABLES DE CORRESPONDENCE N-2 |
| Contrôles | CONTRÔLE D'EQUILIBRE, Contrôle des reports |
| Liasse (présentation) | BILAN, ACTIF, PASSIF, RESULTAT, TFT, FICHE R1/R2/R3/R4, R4, Codes R2, RECEVABILITE, NOTE36 (TABLE DES CODES), NOTE36 Suite (Nomenclature) |
| Liasse (calcul) | BILAN DRAFT, RESULTAT DRAFT, TFT DRAFT |
| Notes | NOTE 1 à 35, 37, 38, 39 (+ 3C BIS, 8A/B/C, 15A/B, 16A/B/BIS/C, 27A/B) |
| DGI/INS | GARDE (DGI-INS), NOTES DGI - INS, COMP-CHARGES, COMP-TVA, COMP-TVA (2), SUPPL1–SUPPL21 (+ SUPPL 22 BAV IBICA), PAGE GARDE IBICA, A1_PREL ET RET SUP IMPUTABLE, GARDE(3), COMMENTAIRE |
| Régimes | GARDE (BNC), GARDE (BA), GARDE (301), GARDE (302) |
| **CE** | COMPTE D'EXPLOITATION REEL, COMPTE D'EXPLOITATION PREVISION |
| **PT** | PLAN DE TRESORERIE REEL, PLAN DE TRESORERIE PREVISIONNEL |
| **RATIOS** | RATIOS DE GESTION |
| Export XML | export, champs variables, champs fixes, tableaux, Referentiels, Export XML, Format Export, Format Import |

---

## 1. Architecture des données (chaîne de calcul)

```
CSV/TXT (grand livre, 9 colonnes, dates ddMMyy)
   │  Power Query « GrandLivreN » (Module48.ImorterGrandLivre_Cliquer)
   ▼
GRAND-LIVRE N  (B1:AS1576 : N° CPTE | DATE | LIBELLES | Md_GL | Mc_GL)
   │
BALANCE N / BALANCE N-1  (balances à 8 colonnes + préfixes 1→9 chiffres)
   │  plages nommées : _cum1.._cum9 (+ _cum11.._cum91 pour N-1),
   │  _sfd/_sfc (soldes finals), _md/_mc (mouvements), _sid/_sic (soldes initiaux)
   ▼
TABLES DE CORRESPONDENCE  (A1:IE1045) — le cœur du classeur :
   • Section Bilan (col C..AC) : double mapping Brut (C..Q) / Amort (R..AC) —
     Code Affectation, Nature, Libellé, Réf Composants, Signe, Imputation,
     Exercice Balance, Montant ; gère N / N-1 / N-2 (col DY/DX, FE/FG/FI/FK/FM/FO)
   • Section CE/PT (col FV..GI) : FV=Code PT, FW=Code CE, FX=Nature (POSTE/Composant),
     FY=Libellé, FZ=N° Compte, GA=Sens Imputation (Débit/Crédit), GB=Signe,
     GC=Imputation GL (=IF(GA="Débit","Md_GL","Mc_GL")), GD=Longueur (="Lg"&LEN&"_GL")
   ▼
Feuilles DRAFT (calcul) : BILAN DRAFT, RESULTAT DRAFT, TFT DRAFT
   • Idiome : =SUMIF(Résultat_N_Code, A11, Résultat_N_Montant)
   • Libellés : =IFERROR(VLOOKUP(A11, RésultatLibellé, 3, FALSE), "")
   ▼
Feuilles de présentation : BILAN, ACTIF, PASSIF, RESULTAT, TFT
   (ex. RESULTAT!I11 ='RESULTAT DRAFT'!I11 — pur report de mise en forme)
```

**Contrôles** :
- `Contrôle des reports` (642 lignes) : conformité report des soldes N-1 → S.I. de N,
  par compte (classes 1–5), écarts en colonnes H/I.
- `CONTRÔLE D'EQUILIBRE` : Actif = Passif (BILAN!H39 vs M39) ; cohérence
  immobilisations bilan ↔ SUPPL4 (tableau d'amortissements) ; messages « Ecart détecté ».

---

## 2. LIASSE — Bilan / Résultat / TFT

**Constat important** : les feuilles de présentation portent la mention « SYSTEME NORMAL »
(`COMPTE DE RESULTAT SYSTEME NORMAL`, `FLUX DE TRESORERIE SYSTEME NORMAL`), mais le
**TFT est bien le TFT méthode directe** (sections A–H, refs ZA/FA/FB…, « Variation du BF
lié aux activités opérationnelles », « VARIATION DE LA TRÉSORERIE NETTE »), **identique
dans sa structure au TFT du 1er classeur** (modèle 2). La mention « système normal » est
une incohérence d'étiquette du modèle, pas un TAFIRE.

- **BILAN** (A1:AC42), **ACTIF** (A1:M41), **PASSIF** (A1:M41) : présentation Brut/Amort/Net ;
  totaux en H39/M39.
- **RESULTAT** (A1:N56) : refs TA→XI, SIG XA→XI — même structure que le 1er classeur.
- **TFT** (A1:Q45) : A=opérationnel (ZA, FA→FE), B=investissement, C/D/E=financement,
  F, G=variation nette, H=trésorerie au 31/12 ; contrôle « Trésorerie actif N − Trésorerie passif N ».
- **NOTE 31** : répartition du résultat (capital, CA HT =RESULTAT!I18, RAO, participation,
  IS =−RESULTAT!I51, résultat net), masse salariale (661+662 / 664+668 / 667).
- **COMP-TVA** : TVA facturée (4431–4435, par nature) / récupérable (4451–4456) / prorata
  (`=IFERROR(MIN(1, IF(AL11<>"",AL11, AQ19/RESULTAT!$I$18)), 0)`), État TVA due (4441) /
  crédit à reporter (4449). Les cellules ACCUEIL!AJxx acceptent une **saisie manuelle
  prioritaire** (`=IF(AL17<>"",VALUE(AL17),SUMIF(...))`) — logique « auto sauf override ».

---

## 3. CE — Compte d'exploitation (réel + prévision)

### 3.1 Structure (COMPTE D'EXPLOITATION REEL, B2:GV6000)

Hiérarchie à **4 niveaux** détectée automatiquement par la colonne B :
`=IF(E8<>"",4, IF(H8<>"",3, IF(K8<>"",2, ...)))` — le niveau dépend de la colonne du libellé
(E=niveau 4, H=niveau 3, K=niveau 2, N=niveau 1).

Colonnes clés par ligne :
- **R** = REF OHADA (TA, RA, RB… XI — voir table en annexe A)
- **S** = REF du SIG parent (`=IF(M8<>"",M8, IF(J8<>"",J8, IF(G8<>"",G8, ...)))`)
- **P** = SIGNE, **T** = libellé via `VLOOKUP(R8, 'TABLES DE CORRESPONDENCE'!FW5:FZ600, 3, FALSE)`
- **U** = libellé selon niveau (`=IF(B8=4,E8, IF(B8=3,H8, IF(B8=2,K8, IF(B8=1,N8,T8))))`)
- **FA** = signe (`=IF(C8="-",-1,1)`)
- **FB..FN** = colonnes **mensuelles** (libellés mois+année depuis `'TABLES DE CORRESPONDENCE'!HA4…`)
- **FO** = `TOTAL ExerciceN` ; **AI** = `=SUM(W8:AH8)` (total annuel)
- Valeur ligne : `V8 = IF($B8=4, GI8, IF($B8=3, FB8*$FA8, IF($B8=2, DT8, IF($B8=1, CL8, BD8))))`
- Mensuel niveau 3 : `FB8 = $FA8 * IF($EY8<>"", SUMIF($G$8:$G8, $EY8, EJ$8:EJ8), EJ8)`
  (cumul filtré par code REF — sous-totaux courants par ligne)

Le CE est donc un **compte de résultat mensuel de gestion** : mêmes REFs que le CR OHADA,
alimenté par le **GRAND-LIVRE N** (Md_GL/Mc_GL) via la table de correspondance, avec
cumul mensuel par poste.

### 3.2 Prévision (COMPTE D'EXPLOITATION PREVISION, B2:AO601)

Même structure ; chaque ligne reprend REF et libellé du REEL. Logique de projection :
- `V8 = 'COMPTE D''EXPLOITATION REEL'!AI8` (total réel N, base de projection pour N+1)
- `AN8 = IF(AM8<>"", AM8, IF(AL8<>"", AL8*V8, AK8*V8))` — **VARIATION SOUHAITEE** :
  saisie absolue (AM) OU taux × total (AL = « Taux de variation souhaité »,
  AK = « Taux de variation calculé »)
- `W8 = IFERROR(($AN8/$V8) * 'COMPTE D''EXPLOITATION REEL'!W8 + 'COMPTE D''EXPLOITATION REEL'!W8, 0)`

**Formule clé** : `prévision_mensuelle = réel_mensuel × (1 + variation_souhaitée / total_réel)`
→ la saisonnalité du réel est conservée, l'utilisateur ne saisit qu'un objectif global
(montant ou %). C'est un vrai petit moteur de budget, pas une simple copie.

---

## 4. PT — Plan de trésorerie (réel + prévisionnel)

### 4.1 Structure (PLAN DE TRESORERIE REEL, B1:GV6000)

Même architecture hiérarchique 4 niveaux que le CE. REFs propres (col R) :

| REF | Libellé | Comptes (sens) |
|---|---|---|
| **ENCAISSEMENTS (TE)** | | |
| E1 | Règlements Clients | 411 (Crédit) |
| E2 | Apports en Capital / C/C Associés | 10, 46 (Crédit) |
| E3 | Emprunts | 16 (Crédit) |
| E4 | Autres produits (Cessions, etc.) | 82, 745 (Crédit) |
| **TOTAL AUTRES ENCAIS/DECAISS (AO)** | | |
| AF | Autres opérations | 52±, 57± + tous les comptes ci-dessus (attrape-tout) |
| **DECAISSEMENTS (TD)** | | |
| D1 | Règlements Fournisseurs | 401 (Débit) |
| D2 | Salaires | 422 (Débit) |
| D3 | Charges Sociales (CNPS/CSS…) | 43 (Débit) |
| D4 | Impôts & Taxes (TVA, IS…) | 44 (Débit) |
| D5 | Remboursement Emprunt | 16 (Débit), 67 (Débit) |
| D6 | Investissements (Matériel…) | 20, 21, 22, 23, 24, 25, 26, 27 (Débit) |

Mensualisation identique au CE (FB..FN, cumul par REF). C'est un **tableau de bord
de trésorerie par nature de flux**, alimenté par les mouvements du grand livre.

### 4.2 Prévisionnel (PLAN DE TRESORERIE PREVISIONNEL, B1:GY601)

Même moteur que CE PREVISION : `W8 = IFERROR(($AN8/$V8)*'PLAN DE TRESORERIE REEL'!W8 + 'PLAN DE TRESORERIE REEL'!W8, 0)`,
avec `V8 = 'PLAN DE TRESORERIE REEL'!AI8` et la même colonne AN « VARIATION SOUHAITEE ».
→ budget de trésorerie mensuel N+1 par nature d'encaissement/décaissement.

---

## 5. RATIOS DE GESTION (C3:H26)

**20 ratios en 5 catégories**, calculés sur N et N-1, avec interprétation et normes
(voir table complète en annexe B). Sources : BILAN (cellules M/N/H/I + lignes 18–39),
RESULTAT (I/J 18/34/52), NOTE 34 (K13/K14 = CAF/FRNG), NOTE 27B (K16 = effectif),
ACCUEIL (AL39/AL61 = TVA sur CA pour le DSO).

Points notables :
- **DSO** = `SUMIF(Lg3_N, 411, Sfd_N) × 306 / (RESULTAT!I18 + ACCUEIL!AL39)` — créances TTC
  sur CA TTC, base **306 jours** (année commerciale 360 − ? ; à noter : 306, pas 360).
- **DPO** = `SUMIF(Lg3_N, 401, sfc) / (SUMIF(Lg2_N, 60, Sfd_N) + SUMIF(Lg2_N, 61, Sfd_N) + …)`
  (fournisseurs sur achats TTC — formule tronquée à l'affichage, à relire dans le fichier).
- **BFR** = `NOTE34!K14 − E21` où E21 = trésorerie nette (H37−M37) ; **FRNG** = `NOTE34!K14`.
  ⚠️ La N-1 du BFR fait référence à `'RATIOS DE GESTION'!F21` (la cellule N du BFR elle-même
  dans la colonne N-1) — auto-référence inter-colonnes à vérifier avant codage.
- Plages nommées **différentes du 1er classeur** : `Lg3_N`, `Sfd_N`, `Lg2_N`…
  (vs `_cum3`, `sfd` dans le 1er).

---

## 6. Export XML / télédéclaration

Modules **IKA Conseil** (Justine Ventalon, v1.3 du 15/01/2019) — génération EDI XML
pour e-impôts :
- `module_teleliasse_1.GenererXML` : vérifie NCC + exercice (Export XML!G11/G12),
  appelle `GenererListeChamps`, demande le dossier, nomme le fichier
  `NO-{exercice}-{ncc}-{ddmmyyyy-hhnnss}.xml`, exporte via le **XmlMap `EDI_Mappage`**
  (XSD lié au classeur) avec `SaveAsXMLData`.
- `GenererListeChampsVariables/Fixes` : parcourt les tables `ListeColonnesTableauxVariables`
  et `ListeChampsTableauxFixes` (feuille `champs variables`/`champs fixes`), localise chaque
  tableau via la feuille `tableaux` (code → onglet + plage), et ne retient que les
  **cellules non vides** → liste dans la feuille `export`.
- `GetValeur` : dates → `'dd/mm/yyyy`, nombres → arrondi 4 décimales (préfixe `'` conservé
  pour les zéros initiaux type NCC).
- `module_teleliasse_2.AjouterLigne(codeTableau)` : insertion de lignes dans les tableaux
  variables **en préservant les formules** (copie la ligne du dessus, efface les constantes),
  met à jour la plage dans `tableaux` via `=ADDRESS(...)`. Cas spéciaux : NOTE13B, FR2B,
  NOTE32, NOTE33, SUPPL1 (ligne fixe en fin).
- `module_teleliasse_3.GenererMappingFixe/Variable` : (re)génération du mapping.
- Feuilles : `tableaux` (A1:P136 — registre code tableau → onglet/plage/type),
  `Referentiels` (A1:L457 — pays, natures de contrat, etc.), `Format Export/Import`,
  `Export XML`, `export`, `champs variables`, `champs fixes`.
- `Teleliasse.Teleliasse` / `liasseMSG` : bascule de **visibilité des feuilles** par
  commutateurs (cellules N9, XX9, AN9, EX1, A57, AR23) + masquage des shapes sauf
  Logo/Image ; `imprimerLiasse` : sélectionne les feuilles visibles (hors balances,
  contrôles, TDC, export), compte les pages, aperçu avant impression.

---

## 7. Taux fiscaux ivoiriens relevés (feuille ACCUEIL)

| Paramètre | Cellule | Valeur | Libellé / usage |
|---|---|---|---|
| TVA | AL9 | **0,18** | « TAUX DE LA TVA » (AJ9 = AL9) |
| Prorata déduction | AJ11/AJ13 | calculé | `MIN(1, …/RESULTAT!$I$18)` ou saisie AL11/AL13 |
| Régime bénéfice | Z15 | sélecteur | « Impôt BIC » / BNC / BA / NA |
| Taux BIC | Z17 | **0,25** | « TAUX DE l'Impôt BIC APPLIQUE » |
| Taux IMF | Z19 | **0,005** | « TAUX DE L'IMF APPLIQUE » (Impôt Minimum Forfaitaire) |
| IMF min / max | Z21 / AB21 | libellés | bornes (valeurs à relire : ligne 22) |
| BA seuils | Z23 / AB23 | 400 000 / 35 000 000 | « BENEFICE AGRICOLE (BA) » |
| TVA ventilée | AJ17…AJ72 | SUMIF | 4431–4435 (facturée), 4451–4456 (récupérable), N et N-1, avec override manuel (col AL) |

> **Comparaison avec les données pays du SaaS** (`migration/src/data/`) : le SaaS a déjà
> TVA 18 % et IS 25 % pour la CI — **cohérent**. L'**IMF à 0,5 %** et les seuils BA
> (400 000 / 35 000 000) sont **nouveaux** et à ajouter aux données CI.
> ⚠️ Les valeurs d'exemple du dossier (ETS AFRICATEX, Ouagadougou) sont burkinabè :
> ne pas en déduire des taux BF.

---

## 8. VBA — inventaire et rôles

### 8.1 DRM / licence (ne PAS reproduire — protection commerciale du vendeur)

- `ThisWorkbook.Workbook_Open` : lit le **n° de série BIOS** (WMI `Win32_BIOS`) → TBFT!AA12,
  compteur d'ouvertures (AB5), date (AB7/AA7) ; si non activé → `InputBox` « ENTREZ VOTRE
  CLE DE LICENCE NO-Pro.V2 » (+225 0707253016 / +225 07 00 000 981, info@msg-innov.online) ;
  **ferme le classeur** si la clé ne correspond pas (AA6/AA13) et que AC5 ≠ "vert".
- `CmdActivation.Activation`, `Licence_bas.VerifLicence`, `creerLicence_Bas.creerLicence`,
  `ID.HdNum` (n° disque dur probable), `MD5.cls` (hash 508 lignes — vérification de clé).
- `Déverrouillage.Déprot` / `Verrouillage.Prot` : (dé)protection par mot de passe.
- `Workbook_BeforeClose` : repasse en calcul auto, sauvegarde.

### 8.2 Macros fonctionnelles (à reproduire dans le SaaS)

| Module | Macro | Rôle | Criticité SaaS |
|---|---|---|---|
| module_teleliasse_1 | GenererXML | Export EDI XML e-impôts (NCC+exercice requis) | **Haute** — export DGI |
| module_teleliasse_1 | GenererListeChamps(Variables/Fixes) | Collecte des champs non vides via registre `tableaux` | Haute |
| module_teleliasse_2 | AjouterLigne | Insertion lignes tableaux variables (formules préservées) | Moyenne |
| Module48 | ImorterGrandLivre_Cliquer | **Import CSV/TXT du grand livre via Power Query** (9 col., dates `ddMMyy`, ex. « 010126 » → N° CPTE/DATE/LIBELLES/Md_GL/Mc_GL) | **Haute** — pipeline d'import |
| ChargerDonnées | Charger_Donnée | Mapping `Format Import` → ACCUEIL (identité entité) | Moyenne |
| Module53 | ActualiserCE/ActualiserPT_Cliquer | Filtre d'affichage CE/PT (col Q = 1 ou vide) | Basse |
| Module15/16 | Bilan/Résultat/TFT_Cliquer… | Navigation inter-feuilles | Basse |
| Module19 | Afficher/Masquer_Notes_Vides | Masque les notes sans données | Moyenne |
| Module20 | Exporter_Vers_Excel_Cliquer | Export + recadrage zone d'impression | Moyenne |
| Module21 | ValiderTFTN_Cliquer… | Validation/annulation TFT | Moyenne |
| Module29 | CorrespondenceN_Cliquer… | Accès TDC N / N-2 | Basse |
| Module49 | Sous_Total1/2/3, Total_Général_Cliquer | Sous-totaux | Basse |
| BoutonsBalance | ViderBalanceN_Cliquer… | Vide balances + zones liées (TDC, contrôles, NOTE 27B/31) | Moyenne |
| imprimerLiasse | imprimerLiasse | Impression liasse (feuilles visibles, nb pages → GARDE!F44) | Moyenne |
| Feuil*.cls (×~150) | Worksheet_Change | **Anti-copier-coller** : convertit tout collage en valeurs seules | Ne pas reproduire |

### 8.3 Divers
- `ConvFormule.Eval` : évalue une formule depuis son texte (`Application.Caller.Parent.Evaluate`).
- `RemplacerLogo/AjouterLogo/SupprimerLogo`, `OuvrirForm` (UserForms 1–10 : activation,
  concepteur, NCC…), `Filtre_Nomenclature`, `Recadrage`, `NBpages`, `MasquerAfficherLignes`.

---

## 9. Régimes BNC / BA / 301 / 302

- `GARDE (BNC)` (B1:V50) : « DETERMINATION DES BENEFICES NON COMMERCIAUX » — page de garde,
  activée si `O7 ≠ 0` (cf. NOTES DGI - INS!I20).
- `GARDE (BA)` (B1:R46) : « DETERMINATION DES BENEFICES AGRICOLES ».
- `GARDE (301)` / `GARDE (302)` : déclarations des rémunérations versées (personnel /
  tiers) — pages de garde + états.
- `PAGE GARDE IBICA` (B1:Q50) : « DETERMINATION DU RESULTAT FISCAL ET DE L'IMPOT » (BIC),
  `O7 = IF(ACCUEIL!Z15="Impôt BIC", 1, 0)` — pilotée par le sélecteur de régime Z15.
- `SUPPL17` : (page IBICA associée), `SUPPL 22 BAV IBICA`.
- ⚠️ Dans cette version « Light », les pages BNC/BA/IBICA sont des **gardes quasi vides**
  (le détail calculé n'est pas embarqué) — le périmètre réel du calcul BNC/BA reste à
  valider sur une version complète.

---

## 10. Comparaison avec le 1er classeur et le SaaS

### 10.1 vs 1er classeur (DSF_OHADA_FINAL, modèle 2)
- **TFT identique** dans sa structure (méthode directe, sections A–H, refs ZA/FA…) malgré
  l'étiquette « SYSTEME NORMAL » ici.
- **Nouveautés** : CE réel/prévision, PT réel/prévisionnel, RATIOS (20), export XML
  EDI complet (IKA Conseil), import grand livre par Power Query, TDC **tri-exercices**
  (N/N-1/N-2), régimes BNC/BA/301/302, DRM commercial.
- Plages nommées **différentes** : `Lg3_N/Sfd_N` ici vs `_cum3/sfd` là-bas — deux
  générations du produit.

### 10.2 vs SaaS migré (`migration/`)
| Bloc | État SaaS | Apport du classeur |
|---|---|---|
| Bilan/CR/TFT | partiel (cf. analyse-dsf-ohada.md) | tables de correspondance tri-exercices |
| **CE** | ❌ absent | **moteur à créer** : hiérarchie 4 niveaux, REFs TA→XI, mensualisation depuis le grand livre, mapping TDC |
| **PT** | ❌ absent | **moteur à créer** : refs E1–E4/D1–D6/AF, mensualisation |
| **Prévisions** | ❌ absent | moteur `réel × (1 + variation/total)` — simple et puissant |
| **Ratios** | ❌ absent (dashboard a des KPIs, pas ces ratios) | **20 ratios** avec formules + normes (annexe B) |
| Export XML DGI | ❌ absent | spec EDI : nommage `NO-{exercice}-{ncc}-{date}.xml`, champs non vides, arrondis |
| Import comptable | journal manuel + OCR | **import CSV grand livre** (format 9 col., dates ddMMyy) |
| Contrôles | balance équilibrée | **contrôle des reports N-1→N**, équilibre bilan, cohérence immos |
| Taux CI | TVA 18 %, IS 25 % déjà OK | **+ IMF 0,5 %**, seuils BA 400 000 / 35 000 000 |
| BNC/BA | ❌ absent | pages de garde seules ici — périmètre à compléter |

---

## Annexe A — Table CE : REF → comptes (TABLES DE CORRESPONDENCE, col FW/FZ/GA)

| REF | Libellé | Comptes (sens) |
|---|---|---|
| TA | Ventes de marchandises | 701 (Crédit) |
| RA | Achats de marchandises | 601 (Débit) |
| RB | Variation de stocks de marchandises | 6031 (Débit) |
| TB | Ventes de produits fabriqués | 702, 703, 704 (Crédit) |
| TC | Travaux, services vendus | 705, 706 (Crédit) |
| TD | Produits accessoires | 707 (Crédit) |
| TE | Production stockée (ou déstockage) | 73 (Crédit) |
| TF | Production immobilisée | 72 (Crédit) |
| TG | Subventions d'exploitation | 71 (Crédit) |
| TH | Autres produits | 75 (Crédit) |
| TI | Transferts de charges d'exploitation | 781 (Crédit) |
| RC | Achats de matières premières et fournitures liées | 602, 602 (Débit) ⚠️ doublon dans le classeur |
| RD | Variation de stocks de matières premières | 6032 (Débit) |
| RE | Autres achats | 604, 605, 608 (Débit) |
| RF | Variation de stocks d'autres approvisionnements | 6033 (Débit) |
| RG | Transports | 61 (Débit) |
| RH | Services extérieurs | 62, 63 (Débit) |
| RI | Impôts et taxes | 64 (Débit) |
| RJ | Autres charges | 65 (Débit) |
| RK | Charges de personnel | 66 (Débit) |
| TJ | Reprises d'amortissements, provisions et dépréciations | 791, 798, 799 (Crédit) |
| RL | Dotations aux amortissements, aux provisions et dépréciations | 681, 691 (Débit) |
| TK | Revenus financiers et assimilés | 77 (Crédit) |
| TL | Reprises de provisions et dépréciations financières | 797 (Crédit) |
| TM | Transferts de charges financières | 787 (Crédit) |
| RM | Frais financiers et charges assimilées | 67 (Débit) |
| RN | Dotations aux provisions et aux dépréciations financières | 697 (Débit) |
| TN | Produits des cessions d'immobilisations | 82 (Crédit) |
| TO | Autres Produits HAO | 84, 86, 88 (Crédit) |
| RO | Valeurs comptables des cessions d'immobilisations | 81 (Débit) |
| RP | Autres Charges HAO | 83, 85 (Débit) |
| RQ | Participation des travailleurs | 87 (Débit) |
| RS | Impôts sur le résultat | 89 (Débit) |

SIG : XA = TA+RA+RB (marge commerciale) · XB = TA+TB+TC+TD (CA) · XC = XB+RA+RB+TE…RJ
(VA) · XD = XC+RK (EBE) · XE = XD+TJ+RL · XF = TK+TL+TM+RM+RN · XG = XE+XF ·
XH = TN+TO+RO+RP · XI = XG+XH+RQ+RS (résultat net).

---

## Annexe B — Les 20 ratios (formules N ; N-1 en miroir)

| # | Catégorie | Ratio | Formule (N) | Norme |
|---|---|---|---|---|
| 1 | Généraux | Autonomie financière | BILAN!M21 / BILAN!M39 | > 20–25 % |
| 2 | Généraux | Financement des immobilisations | BILAN!M26 / BILAN!H26 | > 1 |
| 3 | Généraux | Productivité | RESULTAT!I18 / 'NOTE 27B'!K16 | croissant, vs secteur |
| 4 | Généraux | Liquidité générale | BILAN!H33 / BILAN!M33 | > 1 |
| 5 | Généraux | CAF | 'NOTE 34'!K13 | > 0 |
| 6 | Généraux | Solvabilité générale | BILAN!H39 / (BILAN!M39 − BILAN!M21) | > 1 |
| 7 | Rentabilité | ROE | BILAN!M18 / BILAN!M21 | > 10–15 % |
| 8 | Rentabilité | Marge bénéficiaire nette | RESULTAT!I52 / RESULTAT!I18 | selon secteur |
| 9 | Rentabilité | ROA | BILAN!M18 / BILAN!H39 | > 5 % |
| 10 | Rentabilité | Marge brute d'exploitation | RESULTAT!I34 / RESULTAT!I18 | à maximiser |
| 11 | Endettement | Capacité de remboursement | (BILAN!M25 + BILAN!M37 − BILAN!H37) / RESULTAT!I34 | < 3–4 ans |
| 12 | Endettement | Gearing | (BILAN!M25 + BILAN!M37 − BILAN!H37) / BILAN!M21 | < 1 |
| 13 | Endettement | Indépendance financière | BILAN!M21 / BILAN!M25 | > 1 |
| 14 | Trésorerie | Trésorerie immédiate | BILAN!H37 / (BILAN!M33 + BILAN!M37) | 0,1 – 0,3 |
| 15 | Trésorerie | Trésorerie nette | BILAN!H37 − BILAN!M37 | > 0 |
| 16 | Trésorerie | DSO (délai clients) | SUMIF(Lg3_N,411,Sfd_N) × 306 / (RESULTAT!I18 + ACCUEIL!AL39) | < délai contractuel |
| 17 | Trésorerie | DPO (délai fournisseurs) | SUMIF(Lg3_N,401,sfc) / (achats TTC : 60+61+… — cf. fichier) | à optimiser |
| 18 | Trésorerie | Rotation du BFR (jours) | ('NOTE 34'!K14 − E21) × 360 / RESULTAT!I18 | le plus bas possible |
| 19 | FdR | BFR | 'NOTE 34'!K14 − E21 (E21 = trésorerie nette) | ± selon activité |
| 20 | FdR | FRNG | 'NOTE 34'!K14 | > 0 |

Références cellules BILAN : M21 = capitaux propres, M39 = total passif, H39 = total actif,
H26/M26 = actif immobilisé net / capitaux permanents, H33/M33 = actif/dettes circulant,
H37/M37 = trésorerie actif/passif, M18 = résultat net, M25 = dettes financières.
RESULTAT : I18 = CA (XB), I34 = EBE (XD), I44 = RAO (XG), I52 = résultat net (XI).

---

## Annexe C — Taux fiscaux ivoiriens (récap)

| Impôt | Taux | Source cellule | Note |
|---|---|---|---|
| TVA | 18 % | ACCUEIL!AL9 | déjà dans le SaaS ✓ |
| BIC (IS CI) | 25 % | ACCUEIL!Z17 | déjà dans le SaaS ✓ (sélecteur Z15 : BIC/BNC/BA) |
| IMF | 0,5 % | ACCUEIL!Z19 | **nouveau** — à ajouter aux données CI |
| BA seuils | 400 000 / 35 000 000 | ACCUEIL!Z23/AB23 | **nouveau** |
| Prorata TVA | calculé | ACCUEIL!AJ11 | MIN(1, …/CA) ou saisie manuelle |

---

## Annexe D — Inventaire VBA (68 modules .bas — résumé par famille)

| Famille | Modules | Rôle |
|---|---|---|
| Télédéclaration EDI | module_teleliasse_1, module_teleliasse_2, module_teleliasse_3, Teleliasse | Génération XML, mapping champs, ajout lignes, visibilité feuilles |
| Licence/DRM | ThisWorkbook, CmdActivation, Licence_bas, creerLicence_Bas, ID, MD5, Déverrouillage, Verrouillage | BIOS/HD → clé, fermeture si invalide — **ne pas reproduire** |
| Import données | Module48, ChargerDonnées, Explorer1 | Power Query grand livre CSV, mapping Format Import → ACCUEIL |
| Navigation | Module13, Module15, Module16, Module17, Module18, Module29, OuvrirForm | Accès feuilles par boutons |
| Mise en forme | Module19, Module20, Module49, MasquerAfficherLignes, NBpages, Recadrage, Filtre_Nomenclature, RemplacerLogo, Module31, Module27, SupprimerImage | Notes vides, export Excel, sous-totaux, logos |
| Saisie | Module1, Module39–46, Dupliquer_Ligne10, SuppressionLigne, Module6, Module7, Module8, Module9 | Ajout/suppression lignes tableaux, lignes auto/manuelles |
| CE/PT | Module51, Module53 | Accès CE/PT, filtres d'actualisation |
| Divers | Module2, Module3, Module4, Module5, Module10, Module12, Module21, Module23, Module24, Module30, Module32, Module34, Module36, Module37, ConvFormule, Deselection, CompterSelection | Vidage zones, validation TFT, téléchargement, réinitialisation, Eval() |

Code intégral nettoyé : `migration/references/vba-liasse-ce-pt-ratios.txt`.

---

## Zones ambiguës / à valider avec Yannick

1. **RS doublons** : la REF RC mappe deux fois le compte 602 (lignes 90–91 du TDC) — coquille
   du classeur ou volontaire ? (impact nul si dédupliqué).
2. **DSO base 306 jours** : le ratio utilise ×306 et non ×360 — usage ivoirien (360−54 ?) ou
   coquille ? À confirmer avant codage.
3. **BFR N-1** : la formule N-1 référence `'RATIOS DE GESTION'!F21` (la colonne N du BFR
   lui-même) — auto-référence probablement issue d'une copie ; la logique attendue est
   `NOTE34!L14 − trésorerie nette N-1`.
4. **DPO** : formule tronquée à l'affichage (dénominateur = achats TTC : 60+61+…) — relire
   la cellule exacte dans le fichier avant implémentation.
5. **BNC/BA/IBICA** : pages de garde quasi vides dans cette version « Light » — le calcul
   détaillé du résultat fiscal par régime n'est pas analysable ici.
6. **Étiquette « SYSTEME NORMAL »** sur un TFT méthode directe : incohérence du modèle ;
   le TFT reste celui du 1er classeur (pas un TAFIRE).
