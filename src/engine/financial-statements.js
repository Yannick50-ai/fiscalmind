/**
 * États financiers SYSCOHADA calculés depuis le journal
 * (moteur comptable FiscalMind Africa).
 *
 * Ports fidèles de fiscalmind-app.html :
 *  - sumRubrique        ← fmSommeRubrique (~ligne 3651)
 *  - resultatNet        ← fmResultatNet    (~ligne 3666)
 *  - bilanData          ← fmBilanData      (~ligne 3675)
 *  - compteResultatData ← fmCRData         (~ligne 3715)
 *  - annexesData        ← fmRenderAnnexes  (~ligne 3885, version données)
 *
 * Conventions :
 *  - les soldes sont { compte: { md, mc, solde } } avec solde = md − mc
 *    (positif = débiteur, négatif = créditeur) ;
 *  - montants en FCFA entiers ;
 *  - les fonctions retournent des DONNÉES structurées (aucun HTML).
 *
 * IMPORTANT — résultat net du bilan (voir NOTES.md) : dans le source,
 * fmBilanData appelait fmResultatNet sur des soldes cumulés LIMITÉS aux
 * classes 1-5, ce qui rendait la ligne « Résultat net » systématiquement
 * égale à 0 (vérifié empiriquement). Ici, bilanData reçoit le résultat net
 * en paramètre explicite — normalement
 * `compteResultatData(soldesPeriode).resNet` — ce qui rétablit l'intention
 * du source : Actif = Passif avec le résultat en capitaux propres.
 */

/**
 * Somme d'une rubrique — port exact de fmSommeRubrique.
 * Sans `sens`, les soldes sont additionnés avec leur signe (un solde de sens
 * anormal vient en déduction, comportement SYSCOHADA attendu).
 * Avec sens='D' : seuls les soldes débiteurs (> 0) comptent ;
 * avec sens='C' : seuls les soldes créditeurs (< 0) comptent.
 * Les préfixes de `moins` sont additionnés avec leur signe (ex. les 28/29
 * viennent en déduction des immobilisations brutes).
 */
export function sumRubrique(soldes, prefixes, moins, sens) {
  let t = 0;
  Object.keys(soldes || {}).forEach(c => {
    if (!prefixes.some(p => c.indexOf(p) === 0)) return;
    const sld = soldes[c].solde;
    if ((moins || []).some(p => c.indexOf(p) === 0)) { t += sld; return; }
    if (sens === 'D' && sld <= 0) return;
    if (sens === 'C' && sld >= 0) return;
    t += sld;
  });
  return t;
}

/**
 * Résultat net depuis des soldes — port exact de fmResultatNet :
 * Σ (crédits − débits) des classes 6/7/8, moins le solde du compte '13'.
 * Attention : sur des soldes limités aux classes 1-5, retourne 0
 * (sauf écriture directe sur le compte '13') — voir NOTES.md.
 */
export function resultatNet(soldes) {
  let r = 0;
  Object.keys(soldes || {}).forEach(c => {
    const f = c.charAt(0);
    if (f === '6' || f === '7' || f === '8') r += soldes[c].mc - soldes[c].md;
  });
  if (soldes && soldes['13']) r -= soldes['13'].solde;
  return Math.round(r);
}

/**
 * Bilan — port fidèle de fmBilanData (structure des rubriques SYSCOHADA).
 *
 * @param {Object} soldesCumul  soldes cumulés classes 1-5 (cumulativeBalances)
 * @param {number} resNet       résultat net de l'exercice (ex. compteResultatData(...).resNet)
 * @returns { actif: [{ titre, lignes: [{ label, valeur }] }],
 *            passif: [...], totA, totP, res }
 * Les comptes mixtes (40, 41, 42-48…) sont ventilés selon le sens du solde :
 * la partie débitrice à l'actif (RA), la partie créditrice au passif (RC).
 */
export function bilanData(soldesCumul, resNet) {
  const S = soldesCumul || {};
  const RA = (label, prefixes, moins) => ({ label, valeur: Math.max(0, sumRubrique(S, prefixes, moins, 'D')) });
  const RC = (label, prefixes, moins) => ({ label, valeur: Math.max(0, -sumRubrique(S, prefixes, moins, 'C')) });
  const res = Math.round(Number(resNet) || 0);

  const actif = [
    { titre: 'ACTIF IMMOBILISÉ', lignes: [
      RA('Immobilisations incorporelles (21)', ['21']),
      RA('Immobilisations corporelles (22 à 24)', ['22', '23', '24', '28', '29'], ['28', '29']),
      RA('Avances et acomptes sur immobilisations (25)', ['25']),
      RA('Immobilisations financières (26, 27)', ['26', '27']) ] },
    { titre: 'ACTIF CIRCULANT', lignes: [
      RA('Stocks (31 à 33)', ['31', '32', '33', '39'], ['39']),
      RA('Fournisseurs débiteurs (40)', ['40']),
      RA('Clients (41)', ['41']),
      RA('Autres créances (42 à 48)', ['42', '43', '44', '45', '46', '47', '48']) ] },
    { titre: 'TRÉSORERIE-ACTIF', lignes: [
      RA('Banques, caisse (51 à 58)', ['51', '52', '53', '54', '56', '57', '58']) ] }
  ];
  const passif = [
    { titre: 'CAPITAUX PROPRES', lignes: [
      RC('Capital (10)', ['10']),
      RC('Réserves (11)', ['11']),
      RC('Report à nouveau (12)', ['12']),
      { label: res >= 0 ? 'Résultat net : bénéfice (13)' : 'Résultat net : perte (13)', valeur: res },
      RC('Autres capitaux propres (14, 15)', ['14', '15']) ] },
    { titre: 'DETTES FINANCIÈRES', lignes: [
      RC('Emprunts et dettes financières (16 à 18)', ['16', '17', '18']) ] },
    { titre: 'PASSIF CIRCULANT', lignes: [
      RC('Fournisseurs (40)', ['40']),
      RC('Clients créditeurs (41)', ['41']),
      RC('Dettes fiscales et sociales (42 à 44)', ['42', '43', '44']),
      RC('Autres dettes (45 à 48)', ['45', '46', '47', '48']) ] },
    { titre: 'TRÉSORERIE-PASSIF', lignes: [
      RC('Découverts bancaires (56)', ['56']) ] }
  ];
  const totA = actif.reduce((a, s) => a + s.lignes.reduce((x, l) => x + l.valeur, 0), 0);
  const totP = passif.reduce((a, s) => a + s.lignes.reduce((x, l) => x + l.valeur, 0), 0);
  return { actif, passif, totA, totP, res };
}

/**
 * Compte de résultat — port fidèle de fmCRData.
 * Cascade : CA → EBE → résultat d'exploitation → résultat financier →
 * résultat des activités ordinaires → résultat HAO → résultat net.
 *
 * @param {Object} soldesPeriode soldes de la période, TOUTES classes (periodBalances)
 * @returns l'objet complet de la cascade (voir source), dont resNet.
 */
export function compteResultatData(soldesPeriode) {
  const S = soldesPeriode || {};
  const P = pfx => -sumRubrique(S, pfx);
  const C = pfx => sumRubrique(S, pfx);
  const ca = P(['70']);
  const autresProd = P(['71', '72', '73', '75']);
  const achats = C(['60', '61']);
  const chExt = C(['62', '63']);
  const impots = C(['64']);
  const autresCh = C(['65']);
  const personnel = C(['66']);
  const ebe = ca + autresProd - achats - chExt - impots - autresCh - personnel;
  const dotations = C(['68', '69']);
  const reprises = P(['78']);
  const resExpl = ebe - dotations + reprises;
  const prodFin = P(['77']);
  const chFin = C(['67']);
  const resFin = prodFin - chFin;
  const rao = resExpl + resFin;
  const prodHAO = P(['82', '84', '86', '88']);
  const chHAO = C(['81', '83', '85']);
  const participation = C(['87']);
  const is = C(['89']);
  const resHAO = prodHAO - chHAO;
  const resNet = Math.round(rao + resHAO - participation - is);
  return { ca, autresProd, achats, chExt, impots, autresCh, personnel, ebe, dotations, reprises, resExpl, prodFin, chFin, resFin, rao, prodHAO, chHAO, participation, is, resHAO, resNet };
}

/**
 * Notes annexes — version DONNÉES de fmRenderAnnexes (~ligne 3885).
 * Seules les notes calculables depuis le journal sont retournées ;
 * les notes rédactionnelles (principes, engagements, effectifs) restent
 * du ressort de l'interface.
 *
 * @returns { immos: [{ prefix, label, brut }], amortissements,
 *            stocks: [...], creances: [...], dettes: [...],
 *            personnel: [{ compte, label, montant }] }
 */

import { accountLabel } from './labels.js';
export function annexesData(soldesPeriode) {
  const S = soldesPeriode || {};
  const brut = pfx => Object.keys(S).reduce((a, c) =>
    a + (pfx.some(x => c.indexOf(x) === 0) ? Math.max(0, S[c].solde) : 0), 0);
  const depr = pfx => Object.keys(S).reduce((a, c) =>
    a + (pfx.some(x => c.indexOf(x) === 0) ? Math.max(0, -S[c].solde) : 0), 0);
  const rows = (defs, fn) => defs
    .map(([p, label]) => ({ prefix: p, label, montant: Math.round(fn([p])) }))
    .filter(r => r.montant !== 0);

  const immos = rows(
    [['21', 'Immobilisations incorporelles'], ['22', 'Terrains'],
     ['23', 'Bâtiments, installations'], ['24', 'Matériel et mobilier'],
     ['25', 'Avances et acomptes'], ['26', 'Avances et prêts'],
     ['27', 'Autres immobilisations financières']],
    pfx => brut(pfx));
  const stocks = rows(
    [['31', 'Marchandises'], ['32', 'Matières premières'],
     ['33', 'Autres approvisionnements']],
    pfx => brut(pfx));
  const creances = rows(
    [['41', 'Clients'], ['42', 'Personnel'], ['43', 'Organismes sociaux'],
     ['44', 'État et collectivités'], ['45', 'Organismes divers'],
     ['46', 'Associés et groupe'], ['47', 'Débiteurs divers']],
    pfx => Math.max(0, sumRubrique(S, pfx, null, 'D')));
  const dettes = rows(
    [['40', 'Fournisseurs'], ['41', 'Clients créditeurs'], ['42', 'Personnel'],
     ['43', 'Organismes sociaux'], ['44', 'État et collectivités'],
     ['45', 'Organismes divers'], ['46', 'Associés et groupe'],
     ['47', 'Créditeurs divers'], ['16', 'Emprunts et dettes financières']],
    pfx => Math.max(0, -sumRubrique(S, pfx, null, 'C')));
  const personnel = Object.keys(S)
    .filter(c => c.indexOf('66') === 0 && S[c].solde)
    .sort()
    .map(c => ({ compte: c, label: accountLabel(c), montant: Math.round(S[c].solde) }));

  return {
    immos,
    amortissements: Math.round(depr(['28', '29'])),
    stocks, creances, dettes, personnel
  };
}
