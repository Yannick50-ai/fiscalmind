/**
 * Tableau de bord — calculs purs pour la page d'accueil connectée.
 * 100 % pur (aucun DOM, aucun localStorage) : les données (écritures,
 * calendriers fiscaux) sont passées en paramètres.
 *
 * Conventions : montants en FCFA entiers, solde = md − mc
 * (positif = débiteur, négatif = créditeur).
 */

import { toLines } from './journal.js';
import { periodBalances, cumulativeBalances, trialBalance } from './trial-balance.js';
import { sumRubrique, compteResultatData } from './financial-statements.js';
import { toMouvements } from './lettrage.js';

const PREFIXES_TRESO = ['51', '52', '53', '54', '56', '57', '58'];
const PREFIXES_CHARGES = ['60', '61', '62', '63', '64', '65', '66', '67', '68', '69'];

/* Volet 2 — périmètres comptables SYSCOHADA (documentés pour l'audit) :
 * - PREFIXES_ACHATS : achats stockés consommés. 601 marchandises, 602 matières
 *   premières, 603 variations de stocks (sens 'D' = déstockage/production
 *   consommée ; la variation créditrice = hausse de stocks, elle réduit le
 *   coût consommé et est donc exclue), 604 matières consommables, 605 autres
 *   achats, 608 emballages. Les 61x (transports) sont des services extérieurs
 *   en SYSCOHADA → traités en charges externes, pas dans la marge brute.
 * - PREFIXES_STOCKS : classes 3 (31 marchandises … 39 dépréciations).
 * - BFR : les comptes 44 et 47 sont netés au niveau du préfixe (part
 *   débitrice → actif circulant, part créditrice → passif circulant).
 */
const PREFIXES_ACHATS = ['601', '602', '603', '604', '605', '608'];
const PREFIXES_STOCKS = ['31', '32', '33', '34', '35', '36', '37', '38', '39'];

/** Arrondi entier, avec normalisation du -0 (deepStrictEqual distingue -0 de 0). */
function r0(n) { const v = Math.round(Number(n) || 0); return v === 0 ? 0 : v; }

/** Arrondi à 1 décimale (pourcentages), avec normalisation du -0. */
function r1(n) { const v = Math.round(Number(n) * 10) / 10; return v === 0 ? 0 : v; }

/** Dernier jour du mois m (1-12) de l'année y, au format AAAA-MM-JJ. */
export function lastDayOfMonth(y, m) {
  const d = new Date(Number(y), Number(m), 0);
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function inRange(dateISO, from, to) {
  const d = String(dateISO || '');
  return (!from || d >= from) && (!to || d <= to);
}

/**
 * Indicateurs clés sur la période.
 * @returns { ca, resNet, tresorerie, creancesClients, dettesFournisseurs,
 *            tva (positif = à décaisser, négatif = crédit), margeBrute,
 *            tauxMarge (%, 0 si CA=0), balanceOk, nbEcritures }
 */
export function kpis(entries, { from, to } = {}) {
  const list = Array.isArray(entries) ? entries : [];
  const inPer = list.filter((e) => inRange(e && e.date, from, to));
  const lines = toLines(inPer);
  const soldesPeriode = periodBalances(lines, { from, to });
  const soldesCumul = cumulativeBalances(toLines(list), { upTo: to });
  const cr = compteResultatData(soldesPeriode);
  const m = marge(list, { from, to });

  const tresorerie = r0(sumRubrique(soldesCumul, PREFIXES_TRESO));
  const s443 = (soldesCumul['443'] && soldesCumul['443'].solde) || 0;
  const s4452 = (soldesCumul['4452'] && soldesCumul['4452'].solde) || 0;
  const tva = r0(-s443 - s4452); // >0 : à décaisser, <0 : crédit de TVA

  // Créances clients (411) et dettes fournisseurs (401) non lettrées, sur la période.
  let creancesClients = 0;
  let dettesFournisseurs = 0;
  for (const m of toMouvements(inPer)) {
    if (m.lettre) continue;
    const net = m.debit - m.credit;
    if (m.compte.indexOf('411') === 0) creancesClients += net;
    else if (m.compte.indexOf('401') === 0) dettesFournisseurs -= net;
  }

  const bal = trialBalance(lines, { from, to });
  const balanceOk = bal.totalDebit === bal.totalCredit;

  return {
    ca: r0(cr.ca),
    resNet: r0(cr.resNet),
    tresorerie,
    creancesClients: r0(creancesClients),
    dettesFournisseurs: r0(dettesFournisseurs),
    tva,
    margeBrute: m.margeBrute,
    tauxMarge: m.tauxMarge,
    balanceOk,
    nbEcritures: inPer.length,
  };
}

/**
 * CA vs charges par mois sur l'année y.
 * @returns [{ mois: 1..12, ca, charges }]
 */
export function monthlySeries(entries, year) {
  const y = String(year);
  const lines = toLines(Array.isArray(entries) ? entries : []);
  const out = [];
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    const from = y + '-' + mm + '-01';
    const to = lastDayOfMonth(y, m);
    const soldes = periodBalances(lines, { from, to });
    out.push({
      mois: m,
      ca: r0(-sumRubrique(soldes, ['70'])),
      charges: r0(sumRubrique(soldes, PREFIXES_CHARGES)),
    });
  }
  return out;
}

/**
 * Répartition des charges par nature sur la période.
 * @returns [{ key, label, montant }] trié décroissant, montants > 0 uniquement.
 */
export function chargesBreakdown(entries, { from, to } = {}) {
  const GROUPS = [
    ['achats', 'Achats', ['60', '61']],
    ['externes', 'Charges externes', ['62', '63']],
    ['impots', 'Impôts et taxes', ['64']],
    ['autres', 'Autres charges', ['65']],
    ['personnel', 'Charges de personnel', ['66']],
    ['financieres', 'Charges financières', ['67']],
    ['dotations', 'Dotations', ['68', '69']],
  ];
  const soldes = periodBalances(toLines(Array.isArray(entries) ? entries : []), { from, to });
  return GROUPS
    .map(([key, label, prefixes]) => ({ key, label, montant: r0(sumRubrique(soldes, prefixes)) }))
    .filter((g) => g.montant > 0)
    .sort((a, b) => b.montant - a.montant);
}

/**
 * Trésorerie cumulée en fin de chaque mois de l'année y.
 * @returns [{ mois: 1..12, montant }]
 */
export function treasuryCurve(entries, year) {
  const y = String(year);
  const lines = toLines(Array.isArray(entries) ? entries : []);
  const out = [];
  for (let m = 1; m <= 12; m++) {
    const soldes = cumulativeBalances(lines, { upTo: lastDayOfMonth(y, m) });
    out.push({ mois: m, montant: r0(sumRubrique(soldes, PREFIXES_TRESO)) });
  }
  return out;
}

/**
 * Prochaines échéances fiscales (données calendriers passées en paramètre).
 * @param {Array} calendars - [{ mois, jour, label, impot, periodicite }]
 * @param {string} todayISO - AAAA-MM-JJ
 * @param {number} withinDays - horizon (défaut 30)
 * @returns [{ label, impot, periodicite, dateISO, daysLeft }] trié par date.
 */
export function upcomingDeadlines(calendars, todayISO, withinDays = 30) {
  const t = String(todayISO || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return [];
  const [ty, tm, td] = t.split('-').map(Number);
  const today = new Date(ty, tm - 1, td);
  const out = [];
  for (const ev of calendars || []) {
    const mois = Number(ev && ev.mois);
    let jour = Number(ev && ev.jour);
    if (!mois || !jour || mois < 1 || mois > 12) continue;
    // Prochaine occurrence >= aujourd'hui (cette année ou la suivante).
    let y = ty;
    let last = Number(lastDayOfMonth(y, mois).slice(8, 10));
    if (jour > last) jour = last;
    let cand = new Date(y, mois - 1, jour);
    if (cand < today) {
      y = ty + 1;
      last = Number(lastDayOfMonth(y, mois).slice(8, 10));
      const j2 = Math.min(Number(ev.jour), last);
      cand = new Date(y, mois - 1, j2);
    }
    const daysLeft = r0((cand - today) / 86400000);
    if (daysLeft >= 0 && daysLeft <= withinDays) {
      const p = (n) => String(n).padStart(2, '0');
      out.push({
        label: String(ev.label || ''),
        impot: String(ev.impot || ''),
        periodicite: String(ev.periodicite || ''),
        dateISO: cand.getFullYear() + '-' + p(cand.getMonth() + 1) + '-' + p(cand.getDate()),
        daysLeft,
      });
    }
  }
  out.sort((a, b) => (a.dateISO < b.dateISO ? -1 : a.dateISO > b.dateISO ? 1 : 0));
  return out;
}

/* ------------------------------------------------------------------ */
/* Volet 2 — nouveaux indicateurs                                      */
/* ------------------------------------------------------------------ */

/**
 * Marge brute = CA − coût d'achat des marchandises/matières consommées
 * (soldes débiteurs des comptes PREFIXES_ACHATS, sens 'D').
 * tauxMarge = margeBrute / CA * 100 (0 si CA = 0).
 * @returns { margeBrute, tauxMarge, ca, achats }
 */
export function marge(entries, { from, to } = {}) {
  const list = Array.isArray(entries) ? entries : [];
  const soldes = periodBalances(toLines(list.filter((e) => inRange(e && e.date, from, to))), { from, to });
  const ca = r0(-sumRubrique(soldes, ['70']));
  const achats = r0(sumRubrique(soldes, PREFIXES_ACHATS, null, 'D'));
  const margeBrute = r0(ca - achats);
  return { margeBrute, tauxMarge: ca === 0 ? 0 : r1((margeBrute / ca) * 100), ca, achats };
}

/**
 * BFR = actif circulant − passif circulant, en cumulé à la date `to`.
 * AC = stocks (31..39) + créances clients (41) + parts débitrices nettes
 *      de 44 (État, débiteur net) et 47 (débiteurs divers, débiteur net).
 * PC = dettes fournisseurs (401) + dettes fiscales/sociales
 *      (42, 43 et 44 créditeur net) + autres dettes (47 créditeur net).
 * @returns { actifCirculant, passifCirculant, bfr } (positif = besoin)
 */
export function bfr(entries, { to } = {}) {
  const soldes = cumulativeBalances(toLines(Array.isArray(entries) ? entries : []), { upTo: to });
  const net44 = sumRubrique(soldes, ['44']);
  const net47 = sumRubrique(soldes, ['47']);
  const actifCirculant = r0(
    sumRubrique(soldes, PREFIXES_STOCKS)
    + sumRubrique(soldes, ['41'])
    + Math.max(net44, 0) + Math.max(net47, 0)
  );
  const passifCirculant = r0(
    -sumRubrique(soldes, ['401'])
    - sumRubrique(soldes, ['42', '43'])
    - Math.min(net44, 0) - Math.min(net47, 0)
  );
  return { actifCirculant, passifCirculant, bfr: r0(actifCirculant - passifCirculant) };
}

/**
 * Charges de personnel sur la période = soldes débiteurs des comptes 66.
 * @returns montant (entier FCFA)
 */
export function chargesPersonnel(entries, { from, to } = {}) {
  const list = (Array.isArray(entries) ? entries : []).filter((e) => inRange(e && e.date, from, to));
  return r0(sumRubrique(periodBalances(toLines(list), { from, to }), ['66'], null, 'D'));
}

/** Trie décroissant et coupe au top n : [{ label, montant }] (soldes nuls exclus). */
function topMontants(byLabel, n) {
  const nn = Math.max(1, Math.floor(Number(n)) || 5);
  return Array.from(byLabel.entries())
    .map(([label, montant]) => ({ label: String(label), montant: r0(montant) }))
    .filter((t) => t.montant !== 0)
    .sort((a, b) => b.montant - a.montant)
    .slice(0, nn);
}

/** Regroupe les mouvements non lettrés d'un préfixe par auxiliaire (ou compte). */
function groupTiersNonLettres(entries, prefix, net) {
  const list = (Array.isArray(entries) ? entries : []);
  const by = new Map();
  for (const e of list) {
    for (const l of (e && e.lignes) || []) {
      const compte = String((l || {}).compte || '');
      if (compte.indexOf(prefix) !== 0) continue;
      if (String((l || {}).lettre || '')) continue; // lettré = soldé
      const key = String((l || {}).auxiliaire || compte);
      const v = net(Number((l || {}).debit) || 0, Number((l || {}).credit) || 0);
      by.set(key, (by.get(key) || 0) + v);
    }
  }
  return by;
}

/**
 * Top n clients par créances non lettrées sur la période
 * (411*, regroupé par auxiliaire si le champ existe, sinon par compte).
 * @returns [{ label, montant }] tri décroissant, montants = débits − crédits.
 */
export function topClients(entries, { from, to } = {}, n = 5) {
  const inPer = (Array.isArray(entries) ? entries : []).filter((e) => inRange(e && e.date, from, to));
  return topMontants(groupTiersNonLettres(inPer, '411', (d, c) => d - c), n);
}

/**
 * Top n fournisseurs par dettes non lettrées sur la période (401*, idem).
 * @returns [{ label, montant }] tri décroissant, montants = crédits − débits.
 */
export function topFournisseurs(entries, { from, to } = {}, n = 5) {
  const inPer = (Array.isArray(entries) ? entries : []).filter((e) => inRange(e && e.date, from, to));
  return topMontants(groupTiersNonLettres(inPer, '401', (d, c) => c - d), n);
}

/**
 * DSO = créancesClients / CA * 365 et DPO = dettesFournisseurs / achats * 365,
 * sur la période (créances/dettes non lettrées, achats = PREFIXES_ACHATS
 * débiteurs). 0 si CA = 0 (DSO) ou achats = 0 (DPO). Arrondi à l'entier.
 * @returns { dso, dpo } en jours
 */
export function dsoDpo(entries, { from, to } = {}) {
  const list = Array.isArray(entries) ? entries : [];
  const k = kpis(list, { from, to });
  const achats = r0(sumRubrique(
    periodBalances(toLines(list.filter((e) => inRange(e && e.date, from, to))), { from, to }),
    PREFIXES_ACHATS, null, 'D'
  ));
  return {
    dso: k.ca === 0 ? 0 : r0((k.creancesClients / k.ca) * 365),
    dpo: achats === 0 ? 0 : r0((k.dettesFournisseurs / achats) * 365),
  };
}

/** Évolution N vs N-1 en % : (n − n1) / |n1| * 100, null si n1 = 0. */
function evoPct(n, n1) {
  if (n1 === 0) return null;
  return r1(((n - n1) / Math.abs(n1)) * 100);
}

/**
 * Comparatif exercice N / N-1 : CA, résultat net, trésorerie.
 * @returns { ca: { n, n1, pct }, resNet: { n, n1, pct }, tresorerie: { n, n1, pct } }
 */
export function comparatif(entries, { from, to, prevFrom, prevTo } = {}) {
  const list = Array.isArray(entries) ? entries : [];
  const n = kpis(list, { from, to });
  const n1 = kpis(list, { from: prevFrom, to: prevTo });
  const row = (a, b) => ({ n: a, n1: b, pct: evoPct(a, b) });
  return {
    ca: row(n.ca, n1.ca),
    resNet: row(n.resNet, n1.resNet),
    tresorerie: row(n.tresorerie, n1.tresorerie),
  };
}

/**
 * Alertes calculées depuis le résultat de kpis() — même forme que les
 * alertes rendues dans la page (code, testid, libellé, montant).
 * decouvertBancaire : tresorerie < 0 · margeNegative : tauxMarge < 0.
 * @returns [{ code, testid, label, montant }]
 */
export function alertesDashboard(k) {
  const kk = k || {};
  const out = [];
  if (Number(kk.tresorerie) < 0) {
    out.push({ code: 'decouvert', testid: 'alerte-decouvert', label: 'Découvert bancaire', montant: r0(kk.tresorerie) });
  }
  if (Number(kk.tauxMarge) < 0) {
    out.push({ code: 'marge-negative', testid: 'alerte-marge', label: 'Marge brute négative', montant: r0(kk.tauxMarge) });
  }
  return out;
}
