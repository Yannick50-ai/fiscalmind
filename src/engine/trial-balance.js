/**
 * Balance des comptes (moteur comptable FiscalMind Africa).
 *
 * Travaille sur des LIGNES { date, compte, debit, credit }
 * (voir journal.js : `toLines`). Période explicite { from, to } (incluses,
 * format 'AAAA-MM-JJ').
 *
 * Fonctions portées fidèlement de fiscalmind-app.html :
 *  - periodBalances   ← fmSoldesPeriode  (~ligne 3616) : soldes de la période,
 *                       toutes classes, comptes numériques uniquement ;
 *  - cumulativeBalances ← fmSoldesCumules (~ligne 3628) : soldes cumulés
 *                       jusqu'à `upTo` inclus, CLASSES 1 À 5 UNIQUEMENT
 *                       (bilan : les classes 6/7/8 ne s'y cumulent pas) ;
 *  - trialBalance     ← fmBalance        (~ligne 4450) : balance détaillée
 *                       avec sous-totaux par classe et totaux généraux.
 */

import { CLASSES } from './chart-of-accounts.js';
import { accountLabel } from './labels.js';

const NUM_RE = /^\d+$/;

function inPeriod(date, from, to) {
  const d = String(date || '');
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

function newSoldes() {
  return {};
}

function addMouvement(map, compte, debit, credit) {
  if (!map[compte]) map[compte] = { md: 0, mc: 0 };
  map[compte].md += debit || 0;
  map[compte].mc += credit || 0;
}

function finalize(map) {
  Object.keys(map).forEach(c => { map[c].solde = map[c].md - map[c].mc; });
  return map;
}

/**
 * Soldes par compte sur la période — { compte: { md, mc, solde } }.
 * solde = md - mc (positif = débiteur, négatif = créditeur).
 */
export function periodBalances(lines, { from, to } = {}) {
  const map = newSoldes();
  (lines || []).forEach(e => {
    if (!inPeriod(e.date, from, to)) return;
    const c = String(e.compte || '');
    if (!NUM_RE.test(c)) return;
    addMouvement(map, c, e.debit, e.credit);
  });
  return finalize(map);
}

/**
 * Soldes cumulés depuis l'origine jusqu'à `upTo` inclus — classes 1 à 5
 * uniquement (utilisé par le bilan). Comportement identique au source.
 */
export function cumulativeBalances(lines, { upTo } = {}) {
  const map = newSoldes();
  (lines || []).forEach(e => {
    if (upTo && String(e.date || '') > upTo) return;
    const c = String(e.compte || '');
    if (!NUM_RE.test(c)) return;
    const cls = c.charAt(0);
    if (cls < '1' || cls > '5') return; // Bilan = classes 1 à 5 uniquement
    addMouvement(map, c, e.debit, e.credit);
  });
  return finalize(map);
}

/**
 * Balance complète sur la période — port fidèle de fmBalance :
 *  { rows: [{ compte, intitule, md, mc, sd, sc }],           // triés par compte
 *    classes: [{ classe, label, md, mc, sd, sc }],
 *    tot: { md, mc, sd, sc } }
 * sd/sc = soldes débiteur/créditeur (jamais négatifs).
 * Note : comme dans le source, aucun filtre "compte numérique" ici.
 */
export function trialBalance(lines, { from, to } = {}) {
  const map = {};
  (lines || []).forEach(e => {
    if (!inPeriod(e.date, from, to)) return;
    const c = String(e.compte || '');
    if (!map[c]) map[c] = { compte: c, intitule: accountLabel(c), md: 0, mc: 0 };
    map[c].md += e.debit || 0;
    map[c].mc += e.credit || 0;
  });
  const rows = Object.values(map).sort((a, b) => (a.compte < b.compte ? -1 : 1));
  rows.forEach(r => {
    const s = r.md - r.mc;
    r.sd = s > 0 ? s : 0;
    r.sc = s < 0 ? -s : 0;
  });
  const cls = {};
  rows.forEach(r => {
    const k = r.compte.charAt(0);
    if (!cls[k]) cls[k] = { classe: k, label: CLASSES[k] || ('CLASSE ' + k), md: 0, mc: 0, sd: 0, sc: 0 };
    cls[k].md += r.md; cls[k].mc += r.mc; cls[k].sd += r.sd; cls[k].sc += r.sc;
  });
  const tot = { md: 0, mc: 0, sd: 0, sc: 0 };
  rows.forEach(r => { tot.md += r.md; tot.mc += r.mc; tot.sd += r.sd; tot.sc += r.sc; });
  return { rows, classes: Object.values(cls), tot };
}
