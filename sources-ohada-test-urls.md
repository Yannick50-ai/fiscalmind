# Test des URLs — Référentiel OHADA

**Date du test :** 11 octobre 2026
**Méthode :** `curl` HEAD (repli GET), timeout 10 s, suivi des redirections, user-agent navigateur.
**Fichier source :** `src/data/sources-ohada.json` (non modifié)

## Résumé

| Statut | Nombre | Détail |
|---|---|---|
| ✅ OK (200) | 31 | Sites joignables |
| ⚠️ 403 | 4 | Blocage anti-bot probable — à vérifier dans un navigateur |
| ❌ 000 (injoignable) | 3 | Connexion impossible, même après nouvel essai |

## URLs en erreur — à vérifier manuellement

### ❌ Injoignables (000)

| Pays | Usage | URL |
|---|---|---|
| Bénin | fiscal:site_officiel | https://impots.bj/ |
| Centrafrique | social:site_officiel | https://cnsscentrafrique.org/ |
| RD Congo | social:site_officiel | https://cnss.cd/ |

> Ces 3 sites ne répondent pas du tout (timeout / connexion refusée), même après un second essai avec un user-agent différent. Possible : site hors ligne, DNS, ou blocage géographique de notre IP de sortie (USA). **À tester depuis le téléphone de Yannick (Burkina Faso).**

### ⚠️ 403 Forbidden (blocage anti-bot probable)

| Pays | Usage | URL |
|---|---|---|
| Guinée | fiscal:site_officiel | https://dgi.gov.gn/ |
| Guinée | social:site_officiel | https://cnss.gov.gn/ |
| Guinée | social:presentation | https://cnss.gov.gn/a-propos-de-nous/ |
| Tchad | fiscal:site_officiel | https://dgi.td/ |

> Code 403 = le serveur répond mais refuse les robots. Ces sites fonctionnent **probablement dans un vrai navigateur**. Pas d'action requise sauf si un utilisateur signale un lien mort.

## URLs OK (200) — 31

| Pays / Source | URL |
|---|---|
| Bénin [social] | https://cnss.bj/ |
| Bénin [cleiss] | https://www.cleiss.fr/docs/textes/ |
| Burkina Faso [fiscal] | https://dgi.bf/ |
| Burkina Faso [social] | https://cnssbf.org/ |
| Burkina Faso [social:textes_lois] | https://cnssbf.org/?page_id=1213 |
| Cameroun [fiscal] | https://www.impots.cm/fr/dgi |
| Cameroun [social] | https://www.cnps.cm/fr/ |
| Cameroun [social:portail] | https://e-services.cnps.cm/ |
| Congo [social] | https://www.cnss.cg/ |
| Congo [cleiss] | https://www.cleiss.fr/docs/ol/congo.html |
| Côte d'Ivoire [fiscal] | http://dgi.gouv.ci/ |
| Côte d'Ivoire [social] | https://www.cnps.ci/ |
| Côte d'Ivoire [social:portail] | https://e.cnps.ci/connexion |
| Côte d'Ivoire [social:portail] | https://www.cnps.ci/services-en-ligne/ |
| Côte d'Ivoire [cleiss] | https://www.cleiss.fr/docs/ol/cotedivoire.html |
| Gabon [fiscal] | https://dgi.ga/ |
| Gabon [fiscal:textes_ohada] | https://dgi.ga/texte-communautaires/textes-ohada/ |
| Gabon [social] | https://cnss.ga/ |
| Guinée-Bissau [social] | https://www.inss.gw/pt |
| Guinée équatoriale [social] | https://www.inseso.org/fr/ |
| Mali [fiscal] | https://www.dgi.gouv.ml/ |
| Niger [fiscal] | https://finances.gouv.ne/index.php/direction-services/administration-centrale/les-directions-generales/la-direction-generale-des-impots |
| Niger [social] | https://cnss.ne/ |
| RD Congo [fiscal] | https://dgi.gouv.cd/ |
| RD Congo [fiscal:communiques] | https://dgi.gouv.cd/communiques-officiels/ |
| Togo [social] | https://cnss.tg/ |
| Togo [social:documentation] | https://cnss.tg/documentation/ |
| Togo [cleiss] | https://www.cleiss.fr/docs/ol/togo.html |
| OHADA — États membres | https://www.ohada.org/les-etats-membres-de-lohada/ |
| OHADA — Présentation générale | https://www.ohada.org/presentation-generale/ |
| Cleiss — Organismes étrangers | https://www.cleiss.fr/docs/liens/conventions.html |

## Recommandations

1. **Les 3 URLs en 000** : les remplacer ou les retirer du JSON si elles restent injoignables depuis le Burkina aussi. Vérification manuelle recommandée.
2. **Les 4 URLs en 403** : probablement OK en navigation réelle — pas d'action, sauf signalement utilisateur.
3. **Note** : notre IP de sortie est localisée aux USA ; certains sites gouvernementaux africains bloquent les IP étrangères. Un test depuis le téléphone (Burkina) serait plus fiable pour les cas douteux.
