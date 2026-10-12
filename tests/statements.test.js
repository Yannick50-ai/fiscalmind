/**
 * Tests des calculs : balance, grand livre, bilan, compte de résultat,
 * TAFIRE, notes annexes — sur un mini-cas d'entreprise complet.
 * node:test + node:assert/strict, zéro dépendance.
 *
 * Mini-cas (exercice 2025, montants FCFA) :
 *  E0 08/01 AC : achat matériel 1 180 000 TTC → 244 / 4451 / 401
 *  E1 05/01 BQ : apport en capital 5 000 000   → 521 / 101
 *  E2 12/01 AC : achat marchandises 1 180 000 TTC → 601 / 4452 / 401
 *  E3 20/01 VT : vente 2 360 000 TTC           → 411 / 701 / 443
 *  E4 31/01 PA : salaires 1 800 000           → 6611 / 422
 *  E5 31/12 OD : dotation amortissements 200 000 → 681 / 281
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addEntry, toLines } from '../src/engine/journal.js';
import { periodBalances, cumulativeBalances, trialBalance } from '../src/engine/trial-balance.js';
import { generalLedger } from '../src/engine/general-ledger.js';
import {
  sumRubrique, resultatNet, bilanData, compteResultatData, annexesData
} from '../src/engine/financial-statements.js';
import { tafireData, bfe } from '../src/engine/tafire.js';

function v(date, journal, piece, libelle, lignes) {
  return { date, journal, piece, libelle, lignes };
}
const L = (compte, debit, credit) => ({ compte, debit, credit });

function buildJournal() {
  let entries = [];
  const add = e => {
    const r = addEntry(entries, e);
    assert.equal(r.ok, true, 'écriture invalide : ' + JSON.stringify(r.errors));
    entries = r.entries;
  };
  add(v('2025-01-08', 'AC', 'AC2025-0001', 'Achat matériel informatique', [
    L('244', 1000000, 0), L('4451', 180000, 0), L('401', 0, 1180000)]));
  add(v('2025-01-05', 'BQ', 'BQ2025-0001', 'Apport en capital', [
    L('521', 5000000, 0), L('101', 0, 5000000)]));
  add(v('2025-01-12', 'AC', 'AC2025-0002', 'Achat marchandises', [
    L('601', 1000000, 0), L('4452', 180000, 0), L('401', 0, 1180000)]));
  add(v('2025-01-20', 'VT', 'VT2025-0001', 'Vente marchandises', [
    L('411', 2360000, 0), L('701', 0, 2000000), L('443', 0, 360000)]));
  add(v('2025-01-31', 'PA', 'PA2025-0001', 'Salaires janvier', [
    L('6611', 1800000, 0), L('422', 0, 1800000)]));
  add(v('2025-12-31', 'OD', 'OD2025-0001', 'Dotation aux amortissements', [
    L('681', 200000, 0), L('281', 0, 200000)]));
  return toLines(entries);
}

const PERIODE = { from: '2025-01-01', to: '2025-12-31' };
const lines = buildJournal();
const S = periodBalances(lines, PERIODE);           // toutes classes, période
const C = cumulativeBalances(lines, { upTo: '2025-12-31' }); // classes 1-5

test('balance équilibrée : total débits = total crédits', () => {
  const b = trialBalance(lines, PERIODE);
  assert.equal(b.tot.md, 11720000);
  assert.equal(b.tot.mc, 11720000);
  assert.equal(b.tot.sd, b.tot.sc);
  const c401 = b.rows.find(r => r.compte === '401');
  assert.equal(c401.md, 0);
  assert.equal(c401.mc, 2360000);
  assert.equal(c401.sc, 2360000);
  const c521 = b.rows.find(r => r.compte === '521');
  assert.equal(c521.sd, 5000000);
  assert.ok(b.classes.some(k => k.classe === '4'));
});

test('balance : filtre période', () => {
  const jan = trialBalance(lines, { from: '2025-01-01', to: '2025-01-31' });
  assert.ok(!jan.rows.some(r => r.compte === '681')); // dotation en décembre
  assert.equal(jan.tot.md, 11520000);
});

test('grand livre : tri par date et solde progressif', () => {
  const gl = generalLedger(lines, '401', PERIODE);
  assert.equal(gl.rows.length, 2);
  assert.ok(gl.rows[0].date <= gl.rows[1].date);
  assert.equal(gl.rows[0].credit, 1180000);
  assert.equal(gl.rows[0].solde, -1180000);
  assert.equal(gl.rows[1].solde, -2360000);
  assert.equal(gl.solde, -2360000);
  assert.equal(gl.tot.credit, 2360000);
  assert.ok(gl.intitule.length > 0);
});

test('grand livre : compte sans mouvement', () => {
  const gl = generalLedger(lines, '706', PERIODE);
  assert.equal(gl.rows.length, 0);
  assert.equal(gl.solde, 0);
});

test('compte de résultat : cascade jusqu’au résultat net', () => {
  const cr = compteResultatData(S);
  assert.equal(cr.ca, 2000000);
  assert.equal(cr.achats, 1000000);
  assert.equal(cr.personnel, 1800000);
  assert.equal(cr.ebe, -800000);
  assert.equal(cr.dotations, 200000);
  assert.equal(cr.resExpl, -1000000);
  assert.equal(cr.resNet, -1000000);
});

test('bilan : Actif = Passif, résultat cohérent avec le CR', () => {
  const cr = compteResultatData(S);
  const b = bilanData(C, cr.resNet);
  assert.equal(b.res, -1000000);
  const kp = b.passif[0].lignes.find(l => /Résultat net/.test(l.label));
  assert.ok(/perte/.test(kp.label));
  assert.equal(kp.valeur, -1000000);
  assert.equal(b.totA, 8520000);
  assert.equal(b.totP, 8520000);
  assert.equal(b.totA, b.totP);
  // ventilation des comptes mixtes : 401 créditeur → passif uniquement
  const fourActif = b.actif[1].lignes.find(l => /Fournisseurs débiteurs/.test(l.label));
  const fourPassif = b.passif[2].lignes.find(l => /^Fournisseurs/.test(l.label));
  assert.equal(fourActif.valeur, 0);
  assert.equal(fourPassif.valeur, 2360000);
  // 244 brut − 281 amortissements
  const immo = b.actif[0].lignes.find(l => /^Immobilisations corporelles/.test(l.label));
  assert.equal(immo.valeur, 800000);
});

test('TVA à décaisser = 443 − 4452', () => {
  const tvaDue = -S['443'].solde - S['4452'].solde; // 360 000 − 180 000
  assert.equal(tvaDue, 180000);
});

test('sumRubrique : ventilation par sens du solde (comptes mixtes)', () => {
  const mixte = {
    '401': { md: 1000, mc: 600, solde: 400 },   // débiteur
    '409': { md: 500, mc: 0, solde: 500 }       // débiteur
  };
  assert.equal(sumRubrique(mixte, ['40'], null, 'D'), 900);
  assert.equal(sumRubrique(mixte, ['40'], null, 'C'), 0);
  const mixte2 = { '401': { md: 600, mc: 1000, solde: -400 } }; // créditeur
  assert.equal(sumRubrique(mixte2, ['40'], null, 'D'), 0);
  assert.equal(sumRubrique(mixte2, ['40'], null, 'C'), -400);
});

test('sumRubrique : préfixes "moins" déduits (28/29)', () => {
  const s = {
    '244': { md: 1000000, mc: 0, solde: 1000000 },
    '281': { md: 0, mc: 200000, solde: -200000 }
  };
  assert.equal(sumRubrique(s, ['22', '23', '24', '28', '29'], ['28', '29'], 'D'), 800000);
});

test('resultatNet : sémantique du source (classes 6/7/8)', () => {
  const s = {
    '701': { md: 0, mc: 2000000, solde: -2000000 },
    '601': { md: 1000000, mc: 0, solde: 1000000 }
  };
  assert.equal(resultatNet(s), 1000000);
  // sur des soldes limités aux classes 1-5 (cas du bilan source) → 0
  assert.equal(resultatNet(C), 0);
});

test('TAFIRE : autocontrôle trésorerie', () => {
  const t = tafireData(lines, PERIODE);
  assert.equal(t.cafg, -800000);
  assert.equal(t.dBFE, -1980000);
  assert.equal(t.ete, 1180000);
  assert.equal(t.acqImmo, 1000000);
  assert.equal(t.dTvaImmo, 180000); // 4451 en emplois stables, pas dans le BFE
  assert.equal(t.augCapital, 5000000);
  assert.equal(t.emplois, 1180000);
  assert.equal(t.ressources, 4200000);
  assert.equal(t.dFR, 3020000);
  assert.equal(t.dTresoCalc, 5000000);
  assert.equal(t.dTresoReel, 5000000);
  assert.equal(t.dTresoCalc, t.dTresoReel);
});

test('bfe : 4451 exclue des créances d’exploitation', () => {
  // BFE = 0 (stocks) + 2 540 000 (411 + 4452) − 4 520 000 (401 + 422 + 443)
  assert.equal(bfe(S), -1980000);
});

test('notes annexes : données calculées', () => {
  const a = annexesData(S);
  const immo24 = a.immos.find(r => r.prefix === '24');
  assert.equal(immo24.montant, 1000000);
  assert.equal(a.amortissements, 200000);
  const cre41 = a.creances.find(r => r.prefix === '41');
  assert.equal(cre41.montant, 2360000);
  const det40 = a.dettes.find(r => r.prefix === '40');
  assert.equal(det40.montant, 2360000);
  const sal = a.personnel.find(r => r.compte === '6611');
  assert.equal(sal.montant, 1800000);
});
