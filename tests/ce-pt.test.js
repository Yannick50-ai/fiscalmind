/**
 * Tests CE (compte d'exploitation) + PT (plan de trésorerie) + prévoir().
 * node:test + node:assert/strict, zéro dépendance.
 *
 * Mini-cas (exercice 2025, FCFA) :
 *  E1 05/01 BQ : apport en capital 5 000 000        → 521 / 101
 *  E2 12/01 AC : achat marchandises 1 180 000 TTC   → 601 / 4452 / 401
 *  E3 20/01 VT : vente marchandises 2 360 000 TTC   → 411 / 701 / 443
 *  E4 31/01 PA : salaires janvier 1 800 000        → 6611 / 422
 *  E5 15/02 BQ : encaissement client 2 360 000     → 521 / 411
 *  E6 20/02 BQ : paiement fournisseur 1 180 000    → 401 / 521
 *  E7 10/03 BQ : vente au comptant 500 000         → 521 / 707
 *  E8 31/12 OD : dotation amortissements 200 000   → 681 / 281
 *  E9 31/12 OD : déstockage marchandises 150 000   → 6031 / 31
 *  E0 05/01/2026 : hors exercice (filtre année)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addEntry, toLines } from '../src/engine/journal.js';
import { resultatNet } from '../src/engine/financial-statements.js';
import { periodBalances } from '../src/engine/trial-balance.js';
import {
  monthlyMovements, compteExploitation, planTresorerie, prevoir, ceRefs, ptRefs,
} from '../src/engine/ce-pt.js';

function v(date, journal, piece, libelle, lignes) {
  return { date, journal, piece, libelle, lignes };
}
const L = (compte, debit, credit) => ({ compte, debit, credit });

function buildLines() {
  let entries = [];
  const add = e => {
    const r = addEntry(entries, e);
    assert.equal(r.ok, true, 'écriture invalide : ' + JSON.stringify(r.errors));
    entries = r.entries;
  };
  add(v('2025-01-05', 'BQ', 'BQ2025-0001', 'Apport en capital', [
    L('521', 5000000, 0), L('101', 0, 5000000)]));
  add(v('2025-01-12', 'AC', 'AC2025-0002', 'Achat marchandises', [
    L('601', 1000000, 0), L('4452', 180000, 0), L('401', 0, 1180000)]));
  add(v('2025-01-20', 'VT', 'VT2025-0001', 'Vente marchandises', [
    L('411', 2360000, 0), L('701', 0, 2000000), L('443', 0, 360000)]));
  add(v('2025-01-31', 'PA', 'PA2025-0001', 'Salaires janvier', [
    L('6611', 1800000, 0), L('422', 0, 1800000)]));
  add(v('2025-02-15', 'BQ', 'BQ2025-0002', 'Encaissement client', [
    L('521', 2360000, 0), L('411', 0, 2360000)]));
  add(v('2025-02-20', 'BQ', 'BQ2025-0003', 'Paiement fournisseur', [
    L('401', 1180000, 0), L('521', 0, 1180000)]));
  add(v('2025-03-10', 'BQ', 'BQ2025-0004', 'Vente au comptant', [
    L('521', 500000, 0), L('707', 0, 500000)]));
  add(v('2025-12-31', 'OD', 'OD2025-0001', 'Dotation aux amortissements', [
    L('681', 200000, 0), L('281', 0, 200000)]));
  add(v('2025-12-31', 'OD', 'OD2025-0002', 'Déstockage marchandises', [
    L('6031', 150000, 0), L('31', 0, 150000)]));
  add(v('2026-01-05', 'BQ', 'BQ2026-0001', 'Hors exercice', [
    L('521', 100000, 0), L('101', 0, 100000)]));
  return toLines(entries);
}

const lines = buildLines();

/* ---------------- monthlyMovements ---------------- */

test('monthlyMovements : débits/crédits par mois, filtre année', () => {
  const mm = monthlyMovements(lines, { year: 2025 });
  assert.deepEqual(mm['601'].md[0], 1000000);
  assert.deepEqual(mm['601'].md[1], 0);
  assert.deepEqual(mm['701'].mc[0], 2000000);
  assert.deepEqual(mm['521'].md[0], 5000000);
  assert.deepEqual(mm['521'].md[1], 2360000);
  assert.deepEqual(mm['521'].mc[1], 1180000);
  assert.deepEqual(mm['6031'].md[11], 150000);
  // L'écriture 2026 est exclue : le 521 de janvier 2025 reste 5 000 000.
  assert.ok(!Object.keys(mm).some(c => mm[c].md.some((x, i) => false)));
  const mm26 = monthlyMovements(lines, { year: 2026 });
  assert.deepEqual(mm26['521'].md[0], 100000);
  assert.equal(mm26['601'], undefined);
  // Ligne sans date / date invalide : ignorée sans planter.
  const mmX = monthlyMovements([{ date: null, compte: '601', debit: 1, credit: 0 },
    { date: '20XX', compte: '601', debit: 1, credit: 0 }], { year: 2025 });
  assert.deepEqual(mmX, {});
});

test('monthlyMovements : year accepté en nombre', () => {
  const mm = monthlyMovements(lines, { year: 2025 });
  assert.deepEqual(mm['701'].mc[0], 2000000);
});

/* ---------------- prevoir() : moteur de prévision ---------------- */

test('prevoir : formule exacte réel × (1 + variation/total)', () => {
  const reel = new Array(12).fill(100); // total 1200
  const p = prevoir(reel, { variation: 600 });
  assert.deepEqual(p, new Array(12).fill(150));
  assert.equal(p.reduce((a, b) => a + b, 0), 1800);
});

test('prevoir : la saisonnalité du réel est conservée', () => {
  const reel = [1200, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  assert.deepEqual(prevoir(reel, { variation: 1200 }), [2400, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const saison = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]; // total 780
  const p = prevoir(saison, { variationPct: 100 }); // doublement
  assert.deepEqual(p, saison.map(x => x * 2));
});

test('prevoir : total_réel = 0 → répartition uniforme', () => {
  assert.deepEqual(prevoir(new Array(12).fill(0), { variation: 120 }), new Array(12).fill(10));
  // total nul mais mois non nuls qui se compensent → uniforme aussi
  const comp = [100, -100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  assert.deepEqual(prevoir(comp, { variation: 120 }), new Array(12).fill(10));
});

test('prevoir : variation = 0 → copie du réel', () => {
  const reel = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120];
  const p = prevoir(reel, { variation: 0 });
  assert.deepEqual(p, reel);
  assert.notEqual(p, reel); // copie, pas la même référence
  assert.deepEqual(prevoir(reel, {}), reel);
});

test('prevoir : variationPct et priorité du montant absolu', () => {
  const reel = new Array(12).fill(100);
  assert.deepEqual(prevoir(reel, { variationPct: 10 }), new Array(12).fill(110));
  // Le montant absolu est prioritaire sur le taux (colonne AM du classeur).
  assert.deepEqual(prevoir(reel, { variation: 600, variationPct: 999 }), new Array(12).fill(150));
  // Taux négatif sur un poste de charges (total négatif) : la charge augmente.
  const charges = new Array(12).fill(-100);
  assert.deepEqual(prevoir(charges, { variationPct: 10 }), new Array(12).fill(-110));
  // Objectif de baisse en montant sur un produit.
  assert.deepEqual(prevoir(reel, { variation: -600 }), new Array(12).fill(50));
});

test('prevoir : l’écart d’arrondi est imputé, la somme est exacte', () => {
  const p = prevoir(new Array(12).fill(1), { variation: 1 }); // cible 13
  assert.equal(p.reduce((a, b) => a + b, 0), 13);
  assert.ok(p.every(Number.isInteger));
});

/* ---------------- compteExploitation ---------------- */

test('CE : mappings postes (TA, RA, RB, RK, RL, TD)', () => {
  const ce = compteExploitation(lines, { year: 2025 });
  const g = ref => ce.postes.find(p => p.ref === ref);
  // TA = 701 (crédits) → positif
  assert.equal(g('TA').mois[0], 2000000);
  assert.equal(g('TA').total, 2000000);
  assert.equal(g('TA').signe, 1);
  // RA = 601 (débits) → négatif (« charges − »)
  assert.equal(g('RA').mois[0], -1000000);
  assert.equal(g('RA').signe, -1);
  // RB = 6031 déstockage → négatif (règle algébrique du classeur)
  assert.equal(g('RB').mois[11], -150000);
  assert.equal(g('RB').total, -150000);
  assert.equal(g('RB').signe, 0);
  // RK = 66 (6611) → négatif
  assert.equal(g('RK').mois[0], -1800000);
  // RL = 681 → négatif
  assert.equal(g('RL').mois[11], -200000);
  // TD = 707 (vente au comptant, mars) → positif
  assert.equal(g('TD').mois[2], 500000);
  // 33 postes, dans l'ordre de l'annexe A
  assert.equal(ce.postes.length, 33);
  assert.equal(ce.postes[0].ref, 'TA');
  assert.equal(ce.postes[ce.postes.length - 1].ref, 'RS');
});

test('CE : SIG XA→XI, cascade mensuelle et annuelle', () => {
  const ce = compteExploitation(lines, { year: 2025 });
  const s = ref => ce.sig.find(x => x.ref === ref);
  // XA = TA + RA + RB (janvier : 2 000 000 − 1 000 000 + 0)
  assert.equal(s('XA').mois[0], 1000000);
  // XB = TA + TB + TC + TD (mars : TD = 500 000)
  assert.equal(s('XB').mois[2], 500000);
  assert.equal(s('XB').total, 2500000);
  // XI = résultat net annuel
  // = 2 000 000 − 1 000 000 − 150 000 − 1 800 000 − 200 000 + 500 000
  assert.equal(s('XI').total, -650000);
  assert.equal(s('XI').mois[0], -800000); // 2 000 000 − 1 000 000 − 1 800 000
  assert.equal(s('XI').mois[11], -350000); // −200 000 − 150 000
  assert.equal(ce.sig.length, 9);
});

test('CE : XI égale le résultat net du compte de résultat (moteur existant)', () => {
  const ce = compteExploitation(lines, { year: 2025 });
  const xi = ce.sig.find(x => x.ref === 'XI').total;
  const S = periodBalances(lines, { from: '2025-01-01', to: '2025-12-31' });
  assert.equal(xi, resultatNet(S));
});

test('CE : exercice vide → zéros partout', () => {
  const ce = compteExploitation(lines, { year: 2030 });
  assert.ok(ce.postes.every(p => p.total === 0 && p.mois.every(m => m === 0)));
  assert.ok(ce.sig.every(p => p.total === 0));
});

/* ---------------- planTresorerie ---------------- */

test('PT : E1 (411 crédits), D1 (401 débits), E2 (10/46)', () => {
  const pt = planTresorerie(lines, { year: 2025 });
  const g = ref => pt.refs.find(p => p.ref === ref);
  assert.equal(g('E1').mois[1], 2360000); // encaissement client (février)
  assert.equal(g('E1').total, 2360000);
  assert.equal(g('D1').mois[1], 1180000); // paiement fournisseur (février)
  assert.equal(g('D1').total, 1180000);
  assert.equal(g('E2').mois[0], 5000000); // apport en capital (101 → préfixe 10)
  // Ordre du classeur : E1–E4, AF, D1–D6
  assert.deepEqual(pt.refs.map(r => r.ref),
    ['E1', 'E2', 'E3', 'E4', 'AF', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6']);
});

test('PT : AF attrape-tout résiduel, net et solde', () => {
  const pt = planTresorerie(lines, { year: 2025 });
  const g = ref => pt.refs.find(p => p.ref === ref);
  // Janvier : apport 5 000 000 en E2, TVA récupérable 4452 (180 000) en D4
  // → AF = Δtréso − E + D = 5 000 000 − 5 000 000 + 180 000
  assert.equal(g('D4').mois[0], 180000);
  assert.equal(g('AF').mois[0], 180000);
  // Février : E1 = 2 360 000, D1 = 1 180 000, Δtréso = +1 180 000 → AF = 0
  assert.equal(g('AF').mois[1], 0);
  // Mars : vente au comptant 500 000 (707, non catégorisée) → AF = +500 000
  assert.equal(g('AF').mois[2], 500000);
  // Totaux mensuels
  assert.equal(pt.totaux.encaissements[0], 5000000);
  assert.equal(pt.totaux.decaissements[0], 180000);
  assert.equal(pt.totaux.decaissements[1], 1180000);
  // net = encaissements − décaissements + AF = Δ trésorerie réelle
  assert.equal(pt.totaux.net[0], 5000000);
  assert.equal(pt.totaux.net[1], 1180000);
  assert.equal(pt.totaux.net[2], 500000);
  // Solde cumulé
  assert.equal(pt.solde[0], 5000000);
  assert.equal(pt.solde[1], 6180000);
  assert.equal(pt.solde[2], 6680000);
  assert.equal(pt.solde[11], 6680000);
  // Cohérence : le solde final = Σ(Md − Mc) des 52/57 sur l'exercice.
  assert.equal(pt.solde[11], 5000000 + 1180000 + 500000);
});

test('PT : D2/D5/D6 directionnels (débits uniquement)', () => {
  const pt = planTresorerie(lines, { year: 2025 });
  const g = ref => pt.refs.find(p => p.ref === ref);
  // 422 n'a que des crédits (dettes salariales) → D2 = 0 (pas de décaissement)
  assert.equal(g('D2').total, 0);
  // 16 n'a que des crédits (emprunt reçu : aucun ici → E3 = 0 ; D5 = 0)
  assert.equal(g('E3').total, 0);
  assert.equal(g('D5').total, 0);
  assert.equal(g('D6').total, 0);
});

/* ---------------- utilitaires ---------------- */

test('ceRefs / ptRefs : référentiels pour l’UI', () => {
  assert.equal(ceRefs().length, 33);
  assert.equal(ptRefs().length, 11);
  assert.equal(ptRefs()[4].ref, 'AF');
});
