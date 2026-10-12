# Données de démo 2024–2025 — LISEZMOI

Fichier : `demo-data-2024-2025.json` (12 Ko) — généré le 8 octobre 2026.
Source : `~/workspace/user/files/DONNEE_DE_LA_DEMO.xlsm_2_f9t8.xlsx` (Yannick).

## 1. Contenu

Deux écritures d'**à-nouveaux** au format canonique du moteur `{id, date, journal, piece, libelle, lignes:[{compte,debit,credit}]}` :

- `demo-an-2024` — date 2024-01-01, journal `AN`, pièce `AN-2024`
  - Libellé : « À-nouveaux 2024 — reprise des soldes (données de test) »
  - 73 lignes | Total débit 1 115 949 793 | Total crédit 1 115 949 793 | **Écart : 0** ✓
- `demo-an-2025` — date 2025-01-01, journal `AN`, pièce `AN-2025`
  - Libellé : « À-nouveaux 2025 — reprise des soldes (données de test) »
  - 79 lignes | Total débit 1 032 506 390 | Total crédit 1 032 506 390 | **Écart : 0** ✓

Montants en nombres entiers (FCFA). Chaque ligne : débit OU crédit, jamais les deux.

## 2. Méthode de conversion des comptes

Les balances utilisent des numéros à 7 chiffres (ex. `2442000`) issus de l'ancien plan ;
le nouveau plan SYSCOHADA révisé utilise des numéros courts (2 à 5 chiffres, 1420 comptes).
Pour chaque compte de la balance, la cible = **le plus long préfixe présent dans le nouveau plan**, avec :

1. `direct` : le numéro (ou son préfixe) existe tel quel dans le nouveau plan ;
2. `renuméroté` : traduction via `correspondance-ancien-nouveau.json` (ex. `5212000` → `5215` Banques en devises) ;
3. `préfixe parent` : repli sur le compte parent (ex. `6013250` → `6013`) — les sous-comptes détaillés sont agrégés ;
4. `manuel` : 2 cas (voir §3).

Aucune agrégation ne mélange du débit et du crédit (vérifié : 0 cas de netting masqué).

Répartition des méthodes :

- 2024 : 1 comptes en « manuel (890 inexistant) »
- 2024 : 93 comptes en « préfixe parent »
- 2024 : 1 comptes en « renuméroté »
- 2025 : 2 comptes en « manuel (890 inexistant) »
- 2025 : 98 comptes en « préfixe parent »
- 2025 : 1 comptes en « renuméroté »

## 3. Cas spéciaux (à valider par Yannick)

| Compte source | Libellé balance | Cible | Choix |
|---|---|---|---|
| `8900000` | IMPOT BIC | `891` | « 890 » n'existe dans aucun des deux plans ; BIC = bénéfices industriels et commerciaux → 891 « Impôts sur les bénéfices de l'exercice ». |
| `8901000` | IMPOTS FSP | `4478` | ✅ Corrigé le 8 oct. (Yannick) : la FSP est un sous-compte de **447** → `4478` « Autres impôts et contributions ». |
| `5212000` | (banque devises) | `5215` | Renumérotation officielle 5212 → 5215 appliquée. |
| `2843000` | AMORT DU MAT ET MOB DE BUREA | `2844` | ✅ Corrigé le 8 oct. (Yannick) : erreur de saisie dans la balance source, le bon compte est `2844` « Amortissements du matériel et mobilier ». |

## 4. Comptes sans correspondance

**Aucun.** Les 134 codes distincts des deux balances ont tous trouvé une cible dans le plan révisé.

## 5. Équilibre

- Balance N-1 : S.F. débit = S.F. crédit = 1 115 949 793 → écart 0 ✓
- Balance N : S.F. débit = S.F. crédit = 1 032 506 390 → écart 0 ✓
- Écritures générées : équilibrées au franc près, aucun compte d'écart nécessaire.

## 6. Couverture par classe (après conversion)

| Exercice | Classe | Lignes | Débit | Crédit |
|---|---|---|---|---|
| 2024 | 1 | 1 | 0 | 254 834 213 |
| 2024 | 2 | 10 | 188 621 771 | 173 615 730 |
| 2024 | 3 | 1 | 254 058 144 | 0 |
| 2024 | 4 | 11 | 12 112 719 | 88 761 558 |
| 2024 | 5 | 4 | 69 074 810 | 0 |
| 2024 | 6 | 42 | 586 504 849 | 0 |
| 2024 | 7 | 3 | 0 | 598 738 292 |
| 2024 | 8 | 1 | 5 577 500 | 0 |
| 2025 | 1 | 1 | 0 | 261 490 156 |
| 2025 | 2 | 11 | 189 514 271 | 179 226 141 |
| 2025 | 3 | 1 | 215 227 608 | 0 |
| 2025 | 4 | 15 | 30 256 393 | 50 820 561 |
| 2025 | 5 | 3 | 68 315 448 | 0 |
| 2025 | 6 | 43 | 523 405 670 | 0 |
| 2025 | 7 | 4 | 0 | 540 969 532 |
| 2025 | 8 | 1 | 5 787 000 | 0 |

## 7. Proposition d'import (page Configuration)

Bouton « **Charger les données de démo 2024–2025** » dans la future page Configuration :

1. Vérifie que `demo-an-2024` / `demo-an-2025` n'existent pas déjà dans `fm_entries` (idempotence — ne jamais dupliquer) ;
2. Insère chaque écriture via le store (`fmCloud` → table `fm_entries`, `entry_id` = `demo-an-2024` / `demo-an-2025`) ;
3. Affiche le récapitulatif (nb de lignes, totaux) + bouton « Supprimer les données de démo » (suppression par `entry_id`) ;
4. Opération réservée au compte admin, à faire **une fois connecté** (données 100 % cloud, RLS par utilisateur).

Taille : 12 Ko — import instantané.

## 8. Table de mapping complète (ancien → nouveau)

### Exercice 2024

| Ancien | Libellé (balance) | Nouveau | Intitulé (plan révisé) | Méthode |
|---|---|---|---|---|
| `1010000` | CAPITAL SOCIALE | `101` | CAPITAL SOCIAL | préfixe parent |
| `2470000` | AMENG ET AGENCEMENT | `247` | AGENCEMENTS, AMENAGEMENTS DU MATERIEL ET D | préfixe parent |
| `4010000` | FOURNISSEURS | `401` | FOURNISSEURS, DETTES EN COMPTE | préfixe parent |
| `4110000` | CLIENTS | `411` | CLIENTS | préfixe parent |
| `4760000` | CHARGES CONST D AVANCE | `476` | CHARGES CONSTATEES D'AVANCE | préfixe parent |
| `5213000` | SGBF SIEGE | `521` | BANQUES LOCALES | préfixe parent |
| `6160000` | TRANSPORT DE PLIS | `616` | TRANSPORTS DE PLIS | préfixe parent |
| `6323100` | TS EN DOUANE | `632` | REMUNERATIONS D'INTERMEDIAIRES ET DE CONSE | préfixe parent |
| `6352000` | COTISATION CBC | `635` | COTISATIONS | préfixe parent |
| `6386000` | FRAIS DE RAMASSAGE D ORDURES | `638` | AUTRES CHARGES EXTERNES | préfixe parent |
| `6460000` | DROIT ENREGISTREMENT BAIL | `646` | DROITS D'ENREGISTREMENT | préfixe parent |
| `6480000` | ACHAT DE STICKER | `648` | AUTRES IMPOTS ET TAXES | préfixe parent |
| `6580000` | CHARGES DIVERSES | `658` | CHARGES DIVERSES | préfixe parent |
| `6760000` | PERTES SUR TAUX DE CHANGE | `676` | PERTES DE CHANGE FINANCIERES | préfixe parent |
| `7010000` | VENTE TAXABLES EN GROS | `701` | VENTES DE MARCHANDISES | préfixe parent |
| `7010001` | VENTE TAXABLE DETAILS | `701` | VENTES DE MARCHANDISES | préfixe parent |
| `7010002` | VENTE EXO TVA SIEGE | `701` | VENTES DE MARCHANDISES | préfixe parent |
| `7010003` | VENTE EXO 2% | `701` | VENTES DE MARCHANDISES | préfixe parent |
| `7010004` | VENTE TAX DETAILS O 2000 | `701` | VENTES DE MARCHANDISES | préfixe parent |
| `7010005` | VENTE EXO TVA O 2000 | `701` | VENTES DE MARCHANDISES | préfixe parent |
| `7010006` | VENTE EXO2% O2000 | `701` | VENTES DE MARCHANDISES | préfixe parent |
| `7580000` | PRODUITS DIVERS | `758` | PRODUITS DIVERS | préfixe parent |
| `8900000` | IMPOT BIC | `891` | IMPOTS SUR LES BENEFICES DE L'EXERCICE | manuel (890 inexistant) |
| `2313000` | BATIMENTS | `2313` | Bâtiments administratifs et commerciaux | préfixe parent |
| `2442000` | MATERIEL INFORMATIQUES | `2442` | Matériel informatique | préfixe parent |
| `2444000` | MAT ET MOB DE BUREAU | `2444` | Mobilier de bureau | préfixe parent |
| `2451000` | MAT DE TRANSPORT | `2451` | Matériel automobile | préfixe parent |
| `2831000` | AMORT DU BATIMENT | `2831` | Amortissements des bâtiments industriels,  | préfixe parent |
| `2838000` | AMORT AUTRES INST ET AGNG | `2838` | Amortissements des autres installations et | préfixe parent |
| `2843000` | AMORT DU MAT ET MOB DE BUREAU | `2844` | Amortissements du matériel et mobilier | corrigé 8 oct. (erreur de saisie source) |
| `2844200` | AMORT DU MATERIEL INFORMATIQUE | `2844` | Amortissements du matériel et mobilier | préfixe parent |
| `2845000` | AMORT DU MATERIEL  DE TRANSPORT | `2845` | Amortissements du matériel de transport | préfixe parent |
| `3111000` | STOCK DE MARCHANDISES | `3111` | Marchandises A1 | préfixe parent |
| `4211000` | PERSONNEL AVANCE | `4211` | Personnel, avances | préfixe parent |
| `4313000` | CNSS | `4313` | Caisse de retraite obligatoire | préfixe parent |
| `4428000` | ACPTE 2% CLIENTS | `4428` | Autres impôts et taxes | préfixe parent |
| `4428100` | TIMBRES QUITTANCES | `4428` | Autres impôts et taxes | préfixe parent |
| `4441000` | TVA DUE OU CREDIT TVA | `4441` | Etat, T.V.A. due | préfixe parent |
| `4454100` | TVA SUR P/C TIERS | `4454` | T.V.A. récupérable sur services extérieurs | préfixe parent |
| `4472000` | TPA | `4472` | Impôts sur salaires | préfixe parent |
| `4472100` | IUTS | `4472` | Impôts sur salaires | préfixe parent |
| `4491000` | ETAT BIC | `4491` | Etat, obligations cautionnées | préfixe parent |
| `4492200` | RETENUE 5% ET 25 %/FACT FRS | `4492` | Etat, avances et acomptes versés sur impôt | préfixe parent |
| `4492210` | RETENUE/TRANSPORTS | `4492` | Etat, avances et acomptes versés sur impôt | préfixe parent |
| `521100` | BICIAB | `5211` | Banques en monnaie nationale | préfixe parent |
| `5212000` | SGBF | `5215` | Banques en devises | renuméroté |
| `5711000` | CAISSE PRINCIPALE | `5711` | Caisse en monnaie nationale | préfixe parent |
| `5711100` | CAISSE O 2000 | `5711` | Caisse en monnaie nationale | préfixe parent |
| `6011100` | ACHATS LOCAL | `6011` | dans la Région (5) | préfixe parent |
| `6012000` | ACHATS HORS UEMOA | `6012` | hors Région (5) | préfixe parent |
| `6013000` | DROIT DE DOUANE | `6013` | aux entités du groupe dans la Région | préfixe parent |
| `6013100` | FRAIS TRCB/BAD/DEBOURS/ANALYSE | `6013` | aux entités du groupe dans la Région | préfixe parent |
| `6013250` | TRANSPORT ROUTIER | `6013` | aux entités du groupe dans la Région | préfixe parent |
| `6013400` | ASSURANCE SUR MARCHANDISES | `6013` | aux entités du groupe dans la Région | préfixe parent |
| `6013500` | FRET | `6013` | aux entités du groupe dans la Région | préfixe parent |
| `6031000` | VARIATION DE STOCK | `6031` | Variations des stocks de marchandises | préfixe parent |
| `6051000` | EAU | `6051` | Fournitures non stockables -Eau | préfixe parent |
| `6051200` | EAU ZOUZOU | `6051` | Fournitures non stockables -Eau | préfixe parent |
| `6051300` | EAU JEUNES | `6051` | Fournitures non stockables -Eau | préfixe parent |
| `6051400` | EAU SALLE DE SPORTS | `6051` | Fournitures non stockables -Eau | préfixe parent |
| `6052000` | ELECTRICITE | `6052` | Fournitures non stockables - Electricité | préfixe parent |
| `6052100` | ELECTRICITE DOM JEUNE | `6052` | Fournitures non stockables - Electricité | préfixe parent |
| `6052200` | ELECTRICITE SALLE SPORTS | `6052` | Fournitures non stockables - Electricité | préfixe parent |
| `6052400` | ELECTRICTE JEAN | `6052` | Fournitures non stockables - Electricité | préfixe parent |
| `6052500` | ELECTRCITE ZOUZOU | `6052` | Fournitures non stockables - Electricité | préfixe parent |
| `6053000` | CARBURANT ET LUBRIFIANTS | `6053` | Fournitures non stockables – Autres énergi | préfixe parent |
| `6056000` | ACHATS DE PETIT MAT ET OUT | `6056` | Achats de petit matériel et outillage | préfixe parent |
| `6222000` | LOCATION DE BATIMENTS | `6222` | Locations de bâtiments | préfixe parent |
| `6241000` | ENT ET REP DU BATIMENTS | `6241` | Entretien et réparations des biens immobil | préfixe parent |
| `6242000` | ENT ET REP MAT TRANSPORTS | `6242` | Entretien et réparations des biens mobilie | préfixe parent |
| `6243000` | ENT ET REP DU MATERIELS | `6243` | Maintenance | préfixe parent |
| `6251000` | ASSURANCES MULTIRISQUES | `6251` | Assurances multirisques | préfixe parent |
| `6252000` | ASSURANCE MAT DE TRANSPORT | `6252` | Assurances matériel de transport | préfixe parent |
| `6272000` | CATALOGUES INSERTION PUBLICITE | `6272` | Catalogues, imprimés publicitaires | préfixe parent |
| `6281000` | FRAIS DE TELEPHONE | `6281` | Frais de téléphone | préfixe parent |
| `6317000` | COMMISSION TPE | `6317` | Frais sur instruments monnaie électronique | préfixe parent |
| `6318000` | FRAIS BANCAIRE | `6318` | Autres frais bancaires | préfixe parent |
| `6318100` | FRAIS CAUTION BANCAIRE | `6318` | Autres frais bancaires | préfixe parent |
| `6324000` | HONNORAIRES | `6324` | Honoraires des professions règlementées | préfixe parent |
| `6412000` | PATENTE | `6412` | Patentes, licences et taxes annexes | préfixe parent |
| `64140000` | TPA | `6414` | Taxes d'apprentissage | préfixe parent |
| `6462000` | DROIT DE TIMBRES | `6462` | Droits de timbre | préfixe parent |
| `6463000` | TAXES SUR LES VEHICULES DE SOCIETE | `6463` | Taxes sur les véhicules de société | préfixe parent |
| `6511000` | PERTE/CREANCE CLIENTS | `6511` | Clients | préfixe parent |
| `6581000` | CHARGESB A REINTEGRER | `6581` | Indemnités de fonction et autres rémunérat | préfixe parent |
| `6582100` | FRAIS DE RECOUVREMENT | `6582` | Dons | préfixe parent |
| `6611000` | APPOINTEMENTS,SALAIRES | `6611` | Appointements salaires et commissions | préfixe parent |
| `6613000` | CONGES PAYES | `6613` | Congés payés | préfixe parent |
| `6614000` | INDEMNITES DE PREAVIS,LIC,ET RECH D | `6614` | Indemnités de préavis, de licenciement et  | préfixe parent |
| `6641000` | CHARGES SOCIALES,REMUNERATION | `6641` | Charges sociales sur rémunération du perso | préfixe parent |
| `6684000` | VISITE MEDICAL, PHARMACIE | `6684` | Médecine du travail et pharmacie | préfixe parent |
| `6745000` | INTERET BANCAIRE | `6745` | Intérêts bancaires et sur opérations de fi | préfixe parent |
| `6782000` | PERTE SUR OPERATIONS FINANCIERES | `6782` | sur opérations financières | préfixe parent |
| `68130000` | DOTAT AUX AMORTS DES IM | `6813` | Dotations aux amortissements des immobilis | préfixe parent |
| `7011000` | VENTE  EN GROS  O 2000 | `7011` | dans la Région (7) | préfixe parent |

### Exercice 2025

| Ancien | Libellé (balance) | Nouveau | Intitulé (plan révisé) | Méthode |
|---|---|---|---|---|
| `1010000` | CAPITAL SOCIALE | `101` | CAPITAL SOCIAL | préfixe parent |
| `2470000` | AMENG ET AGENCEMENT | `247` | AGENCEMENTS, AMENAGEMENTS DU MATERIEL ET D | préfixe parent |
| `4010000` | FOURNISSEURS | `401` | FOURNISSEURS, DETTES EN COMPTE | préfixe parent |
| `4110000` | CLIENTS | `411` | CLIENTS | préfixe parent |
| `4760000` | CHARGES CONST D AVANCE | `476` | CHARGES CONSTATEES D'AVANCE | préfixe parent |
| `5213000` | SGBF SIEGE | `521` | BANQUES LOCALES | préfixe parent |
| `5214000` | CORIS BANK | `521` | BANQUES LOCALES | préfixe parent |
| `6160000` | TRANSPORT DE PLIS | `616` | TRANSPORTS DE PLIS | préfixe parent |
| `6352000` | COTISATION CBC | `635` | COTISATIONS | préfixe parent |
| `6386000` | FRAIS DE RAMASSAGE D ORDURES | `638` | AUTRES CHARGES EXTERNES | préfixe parent |
| `6460000` | DROIT ENREGISTREMENT BAIL | `646` | DROITS D'ENREGISTREMENT | préfixe parent |
| `6480000` | ACHAT DE STICKER | `648` | AUTRES IMPOTS ET TAXES | préfixe parent |
| `6580000` | CHARGES DIVERSES | `658` | CHARGES DIVERSES | préfixe parent |
| `6760000` | PERTES SUR TAUX DE CHANGE | `676` | PERTES DE CHANGE FINANCIERES | préfixe parent |
| `7010000` | VENTE TAXABLES EN GROS | `701` | VENTES DE MARCHANDISES | préfixe parent |
| `7010001` | VENTE TAXABLE DETAILS | `701` | VENTES DE MARCHANDISES | préfixe parent |
| `7010002` | VENTE EXO TVA SIEGE | `701` | VENTES DE MARCHANDISES | préfixe parent |
| `7010003` | VENTE EXO 2% | `701` | VENTES DE MARCHANDISES | préfixe parent |
| `7010004` | VENTE TAX DETAILS O 2000 | `701` | VENTES DE MARCHANDISES | préfixe parent |
| `7010005` | VENTE EXO TVA O 2000 | `701` | VENTES DE MARCHANDISES | préfixe parent |
| `7010006` | VENTE EXO2% O2000 | `701` | VENTES DE MARCHANDISES | préfixe parent |
| `7580000` | PRODUITS DIVERS | `758` | PRODUITS DIVERS | préfixe parent |
| `7760000` | GAIN DE CHANGE | `776` | GAINS DE CHANGE FINANCIERS | préfixe parent |
| `8900000` | IMPOT BIC | `891` | IMPOTS SUR LES BENEFICES DE L'EXERCICE | manuel (890 inexistant) |
| `8901000` | IMPOTS FSP | `4478` | Autres impôts et contributions | corrigé 8 oct. (sous-compte de 447) |
| `2313000` | BATIMENTS | `2313` | Bâtiments administratifs et commerciaux | préfixe parent |
| `2442000` | MATERIEL INFORMATIQUES | `2442` | Matériel informatique | préfixe parent |
| `2443000` | MATERIEL DE CLIMATISATION | `2443` | Matériel bureautique | préfixe parent |
| `2444000` | MAT ET MOB DE BUREAU | `2444` | Mobilier de bureau | préfixe parent |
| `2451000` | MAT DE TRANSPORT | `2451` | Matériel automobile | préfixe parent |
| `2831000` | AMORT DU BATIMENT | `2831` | Amortissements des bâtiments industriels,  | préfixe parent |
| `2838000` | AMORT AUTRES INST ET AGNG | `2838` | Amortissements des autres installations et | préfixe parent |
| `2843000` | AMORT DU MAT ET MOB DE BUREAU | `2844` | Amortissements du matériel et mobilier | corrigé 8 oct. (erreur de saisie source) |
| `2844200` | AMORT DU MATERIEL INFORMATIQUE | `2844` | Amortissements du matériel et mobilier | préfixe parent |
| `2844300` | AMORT DU MATERIEL DE CLIMATISATION | `2844` | Amortissements du matériel et mobilier | préfixe parent |
| `2845000` | AMORT DU MATERIEL  DE TRANSPORT | `2845` | Amortissements du matériel de transport | préfixe parent |
| `3111000` | STOCK DE MARCHANDISES | `3111` | Marchandises A1 | préfixe parent |
| `4098000` | FR RABAIS RISTOURNE A OBTENIRE | `4098` | Fournisseurs, rabais, remises, ristournes  | préfixe parent |
| `4211000` | PERSONNEL AVANCE | `4211` | Personnel, avances | préfixe parent |
| `4211100` | PERSONNEL AVANCE SANOU CHRISTIAN | `4211` | Personnel, avances | préfixe parent |
| `4313000` | CNSS | `4313` | Caisse de retraite obligatoire | préfixe parent |
| `4426000` | DROIT DE DOUANE | `4426` | Droits de douane | préfixe parent |
| `4428000` | ACPTE 2% CLIENTS | `4428` | Autres impôts et taxes | préfixe parent |
| `4428100` | TIMBRES QUITTANCES | `4428` | Autres impôts et taxes | préfixe parent |
| `4441000` | TVA DUE OU CREDIT TVA | `4441` | Etat, T.V.A. due | préfixe parent |
| `4454100` | TVA SUR P/C TIERS | `4454` | T.V.A. récupérable sur services extérieurs | préfixe parent |
| `4472000` | TPA | `4472` | Impôts sur salaires | préfixe parent |
| `4472100` | IUTS | `4472` | Impôts sur salaires | préfixe parent |
| `4491000` | ETAT BIC | `4491` | Etat, obligations cautionnées | préfixe parent |
| `4491100` | ETAT FSP | `4491` | Etat, obligations cautionnées | préfixe parent |
| `4492200` | RETENUE 5% , 10% ET 25 %/FACT FRS | `4492` | Etat, avances et acomptes versés sur impôt | préfixe parent |
| `4492210` | RETENUE/TRANSPORTS | `4492` | Etat, avances et acomptes versés sur impôt | préfixe parent |
| `4492300` | RETENUE IRF | `4492` | Etat, avances et acomptes versés sur impôt | préfixe parent |
| `4495000` | IMPOT A PAYER | `4495` | Etat, subventions d'exploitation à recevoi | préfixe parent |
| `4712000` | CREDITEUR DIVERS | `4712` | Créditeurs divers | préfixe parent |
| `5212000` | SGBF | `5215` | Banques en devises | renuméroté |
| `5711000` | CAISSE PRINCIPALE | `5711` | Caisse en monnaie nationale | préfixe parent |
| `5711100` | CAISSE O 2000 | `5711` | Caisse en monnaie nationale | préfixe parent |
| `6011100` | ACHATS LOCAL | `6011` | dans la Région (5) | préfixe parent |
| `6012000` | ACHATS HORS UEMOA | `6012` | hors Région (5) | préfixe parent |
| `6013000` | DROIT DE DOUANE | `6013` | aux entités du groupe dans la Région | préfixe parent |
| `6013100` | FRAIS TRCB/BAD/DEBOURS/ANALYSE | `6013` | aux entités du groupe dans la Région | préfixe parent |
| `6013250` | TRANSPORT ROUTIER | `6013` | aux entités du groupe dans la Région | préfixe parent |
| `6013400` | ASSURANCE SUR MARCHANDISES | `6013` | aux entités du groupe dans la Région | préfixe parent |
| `6013500` | FRET | `6013` | aux entités du groupe dans la Région | préfixe parent |
| `6013600` | T.S EN DOUANE | `6013` | aux entités du groupe dans la Région | préfixe parent |
| `6031000` | VARIATION DE STOCK | `6031` | Variations des stocks de marchandises | préfixe parent |
| `6051000` | EAU | `6051` | Fournitures non stockables -Eau | préfixe parent |
| `6052000` | ELECTRICITE | `6052` | Fournitures non stockables - Electricité | préfixe parent |
| `6053000` | CARBURANT ET LUBRIFIANTS | `6053` | Fournitures non stockables – Autres énergi | préfixe parent |
| `6056000` | ACHATS DE PETIT MAT ET OUT | `6056` | Achats de petit matériel et outillage | préfixe parent |
| `6222000` | LOCATION DE BATIMENTS | `6222` | Locations de bâtiments | préfixe parent |
| `6241000` | ENT ET REP DU BATIMENTS | `6241` | Entretien et réparations des biens immobil | préfixe parent |
| `6242000` | ENT ET REP MAT TRANSPORTS | `6242` | Entretien et réparations des biens mobilie | préfixe parent |
| `6243000` | ENT ET REP DU MATERIELS | `6243` | Maintenance | préfixe parent |
| `6251000` | ASSURANCES MULTIRISQUES | `6251` | Assurances multirisques | préfixe parent |
| `6252000` | ASSURANCE MAT DE TRANSPORT | `6252` | Assurances matériel de transport | préfixe parent |
| `6272000` | CATALOGUES INSERTION PUBLICITE | `6272` | Catalogues, imprimés publicitaires | préfixe parent |
| `6281000` | FRAIS DE TELEPHONE | `6281` | Frais de téléphone | préfixe parent |
| `6317000` | COMMISSION TPE | `6317` | Frais sur instruments monnaie électronique | préfixe parent |
| `6318000` | FRAIS BANCAIRE | `6318` | Autres frais bancaires | préfixe parent |
| `6318300` | FRAIS CHEQUE IMPAYER | `6318` | Autres frais bancaires | préfixe parent |
| `6324000` | HONNORAIRES | `6324` | Honoraires des professions règlementées | préfixe parent |
| `6411000` | TAXE FONCIERE | `6411` | Impôts fonciers et taxes annexes | préfixe parent |
| `6412000` | PATENTE | `6412` | Patentes, licences et taxes annexes | préfixe parent |
| `64140000` | TPA | `6414` | Taxes d'apprentissage | préfixe parent |
| `6462000` | DROIT DE TIMBRES | `6462` | Droits de timbre | préfixe parent |
| `6463000` | TAXES SUR LES VEHICULES DE SOCIETE | `6463` | Taxes sur les véhicules de société | préfixe parent |
| `6468100` | TAXE PUBLICITAIRE | `6468` | Autres droits d'enregistrement | préfixe parent |
| `6581000` | CHARGES A REINTEGRER | `6581` | Indemnités de fonction et autres rémunérat | préfixe parent |
| `6582100` | FRAIS DE RECOUVREMENT | `6582` | Dons | préfixe parent |
| `6588000` | AUTRE CHARGE DIVERS | `6588` | Autres charges diverses | préfixe parent |
| `6611000` | APPOINTEMENTS,SALAIRES | `6611` | Appointements salaires et commissions | préfixe parent |
| `6613000` | CONGES PAYES | `6613` | Congés payés | préfixe parent |
| `6614000` | INDEMNITES DE PREAVIS,LIC,ET RECH D | `6614` | Indemnités de préavis, de licenciement et  | préfixe parent |
| `6641000` | CHARGES SOCIALES,REMUNERATION | `6641` | Charges sociales sur rémunération du perso | préfixe parent |
| `6684000` | VISITE MEDICAL, PHARMACIE | `6684` | Médecine du travail et pharmacie | préfixe parent |
| `6745000` | INTERET BANCAIRE | `6745` | Intérêts bancaires et sur opérations de fi | préfixe parent |
| `6782000` | PERTE SUR OPERATIONS FINANCIERES | `6782` | sur opérations financières | préfixe parent |
| `68130000` | DOTAT AUX AMORTS DES IM | `6813` | Dotations aux amortissements des immobilis | préfixe parent |
| `7011000` | VENTE  EN GROS  O 2000 | `7011` | dans la Région (7) | préfixe parent |

## 6. Chargement dans l'application (nouveau)

Section « 🧪 Données de démo » de la page **Configuration** (`#/config`),
**réservée aux administrateurs** (`is_admin` via la garde `isAdmin()`,
section masquée pour les autres utilisateurs) :

- **Charger les données de démo 2024–2025** : lit `demo-data-2024-2025.json`
  (embarqué au build via `app/public/`), valide chaque écriture avec
  `validateEntry()`, puis les insère via le store (`saveEntry` → upsert
  Supabase sur la clé `(user_id, entry_id)`). **Idempotent** : relancer le
  chargement ne crée aucun doublon.
- **Supprimer les données de démo** : supprime `demo-an-2024` et `demo-an-2025`
  par `entry_id` (double confirmation).
- Un statut indique si les données sont chargées, partielles ou absentes.

Prérequis : être connecté avec un compte admin ; les écritures sont isolées
par utilisateur (RLS), chaque admin charge sa propre copie.
