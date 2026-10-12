/**
 * Tests du moteur ratios de gestion (Phase 6) — 20 ratios, 5 catégories,
 * valeurs N et N-1, normes du classeur NO-Pro.V2, badges « à valider ».
 *
 * Conventions : écritures canoniques équilibrées { id, date, journal,
 * piece, libelle, lignes: [{ compte, debit, credit }] }.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ratiosGestion } from '../src/engine/ratios.js';

const Lg = (compte, debit, credit) => ({ compte, debit, credit });
const mk = (id, date, lignes) => ({ id, date, journal: 'OD', piece: id, libelle: id, lignes });

/** Retrouve un ratio par son code dans les 5 catégories. */
function getRatio(res, code) {
  for (const cat of res.categories) {
    const r = cat.ratios.find((x) => x.code === code);
    if (r) return r;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Structure : 5 catégories, 20 ratios, N et N-1                        */
/* ------------------------------------------------------------------ */

test('ratiosGestion : 5 catégories et 20 ratios, champs requis', () => {
  const res = ratiosGestion([], { year: 2025 });
  assert.equal(res.year, 2025);
  assert.equal(res.categories.length, 5);
  const total = res.categories.reduce((t, c) => t + c.ratios.length, 0);
  assert.equal(total, 20);
  assert.deepEqual(
    res.categories.map((c) => c.ratios.length),
    [9, 3, 4, 3, 1],
  );
  for (const cat of res.categories) {
    assert.ok(cat.titre.length > 0);
    for (const r of cat.ratios) {
      assert.ok(r.code && r.label && r.unite && r.norme !== undefined);
      assert.ok(r.interpretation && r.interpretation.length > 0);
      assert.ok('n' in r && 'n1' in r);
      assert.ok(typeof r.formule === 'string' && r.formule.length > 0);
    }
  }
});

test('ratiosGestion : year invalide lève une erreur', () => {
  assert.throws(() => ratiosGestion([], { year: 'abc' }), /year/);
});

/* ------------------------------------------------------------------ */
/* Montage de référence (équilibré) — exercice N = 2025, N-1 = 2024    */
/*                                                                     */
/* N : capital 400 000 (101) + emprunt 100 000 (164) ; ventes 701      */
/* 300 000 (411 : 354 000 TTC, TVA 4431 : 54 000) ; achats 601 120 000  */
/* (401 : 141 600 TTC, TVA 4452 : 21 600) ; dotation 681 20 000 ;       */
/* variation stocks 6031 −50 000 (stock +50 000) ; banque 521.          */
/* N-1 : capital 200 000, ventes 701 100 000 (411 : 118 000 TTC).       */
/* ------------------------------------------------------------------ */

function montage() {
  return [
    // --- N-1 (2024) ---
    mk('n1', '2024-01-05', [Lg('101', 0, 200000), Lg('521', 200000, 0)]),
    mk('n2', '2024-03-01', [Lg('411', 118000, 0), Lg('701', 0, 100000), Lg('4431', 0, 18000)]),
    // --- N (2025) ---
    mk('e1', '2025-01-05', [Lg('101', 0, 400000), Lg('521', 400000, 0)]),
    mk('e2', '2025-02-01', [Lg('164', 0, 100000), Lg('521', 100000, 0)]),
    mk('e3', '2025-03-01', [Lg('411', 354000, 0), Lg('701', 0, 300000), Lg('4431', 0, 54000)]),
    mk('e4', '2025-04-01', [Lg('601', 120000, 0), Lg('4452', 21600, 0), Lg('401', 0, 141600)]),
    mk('e5', '2025-05-01', [Lg('681', 20000, 0), Lg('281', 0, 20000)]),
    mk('e6', '2025-06-01', [Lg('311', 50000, 0), Lg('6031', 0, 50000)]),
  ];
}

test('autonomie financière : CP / DZ, N et N-1', () => {
  const res = ratiosGestion(montage(), { year: 2025 });
  const r = getRatio(res, 'AUTONOMIE');
  // N (cumul) : CP = 600 000 + RN(210 000) = 810 000 ; DZ = 810 000 + 100 000
  //     + 141 600 (401) + 72 000 (4431) = 1 123 600 → 0,7209
  assert.ok(Math.abs(r.n - 0.7209) < 0.0001, 'n=' + r.n);
  // N-1 : CP = 200 000 + RN(100 000) = 300 000 ; DZ = 300 000 + 18 000 = 318 000
  //     → 0,9434
  assert.ok(Math.abs(r.n1 - 0.9434) < 0.0001, 'n1=' + r.n1);
  assert.equal(r.unite, 'pct');
  assert.equal(r.norme, '> 20–25 %');
  assert.equal(r.aValider, undefined);
});

test('liquidité générale : BK / DP, N et N-1', () => {
  const res = ratiosGestion(montage(), { year: 2025 });
  const r = getRatio(res, 'LIQUIDITE');
  // N : BK = 50 000 (311) + 472 000 (411) + 21 600 (4452) = 543 600 ;
  //     DP = 141 600 (401) + 72 000 (4431) = 213 600 → 2,54
  assert.ok(Math.abs(r.n - 2.54) < 0.01, 'n=' + r.n);
  // N-1 : BK = 118 000 ; DP = 18 000 (4431) → 6,56
  assert.ok(Math.abs(r.n1 - 6.56) < 0.01, 'n1=' + r.n1);
  assert.equal(r.norme, '> 1');
});

test('marge nette : XI / XB', () => {
  const res = ratiosGestion(montage(), { year: 2025 });
  const r = getRatio(res, 'MARGE-NETTE');
  // XI = 300 000 − 120 000 + 50 000 − 20 000 = 210 000 ; XB = 300 000 → 0,70
  assert.ok(Math.abs(r.n - 0.7) < 0.0001, 'n=' + r.n);
  // N-1 : XI = 100 000 ; XB = 100 000 → 1,00
  assert.ok(Math.abs(r.n1 - 1) < 0.0001, 'n1=' + r.n1);
});

test('DSO : base 306 jours du classeur, marqué à valider', () => {
  const res = ratiosGestion(montage(), { year: 2025 });
  const r = getRatio(res, 'DSO');
  // N : créances 411 (cumul) = 472 000 ; CA TTC N = 300 000 + 54 000
  // → 472 000 × 306 / 354 000 = 408,0 j
  assert.ok(Math.abs(r.n - 408.0) < 0.1, 'n=' + r.n);
  // N-1 : 118 000 × 306 / 118 000 = 306,0 j
  assert.ok(Math.abs(r.n1 - 306.0) < 0.1, 'n1=' + r.n1);
  assert.equal(r.aValider, true);
  assert.match(r.formule, /306/);
  assert.match(r.noteValider, /306/);
  assert.equal(r.unite, 'j');
});

test('BFR : FRNG − trésorerie nette, N et N-1, marqué à valider', () => {
  const res = ratiosGestion(montage(), { year: 2025 });
  const frng = getRatio(res, 'FRNG');
  const bfr = getRatio(res, 'BFR');
  // N : FRNG = DF (910 000) − AZ (0) = 910 000 ; TN = BT (700 000) − DT (0)
  //     = 700 000 → BFR = 210 000
  assert.equal(frng.n, 910000);
  assert.equal(bfr.n, 210000);
  // N-1 : FRNG = 300 000 ; TN = 200 000 → BFR = 100 000
  assert.equal(frng.n1, 300000);
  assert.equal(bfr.n1, 100000);
  assert.equal(bfr.aValider, true);
  assert.match(bfr.noteValider, /N-1/);
});

test('DPO marqué à valider (formule du classeur tronquée)', () => {
  const res = ratiosGestion(montage(), { year: 2025 });
  const r = getRatio(res, 'DPO');
  // N : dettes 401 = 141 600 ; achats TTC = 120 000 + 21 600 = 141 600
  // → 141 600 × 360 / 141 600 = 360,0 j
  assert.ok(Math.abs(r.n - 360.0) < 0.1, 'n=' + r.n);
  assert.equal(r.n1, null); // aucune dette fournisseur en N-1 → pas de valeur
  assert.equal(r.aValider, true);
  assert.match(r.noteValider, /tronqu/);
  assert.match(r.formule, /360/);
});

test('CAF : RN + dotations − reprises', () => {
  const res = ratiosGestion(montage(), { year: 2025 });
  const r = getRatio(res, 'CAF');
  // N : XI 210 000 + dot 681 20 000 − reprises 0 = 230 000
  assert.equal(r.n, 230000);
  // N-1 : XI 100 000 = 100 000
  assert.equal(r.n1, 100000);
  assert.equal(r.norme, '> 0');
});

test('montage vide : aucun crash, ratios null (pas de valeurs trompeuses)', () => {
  const res = ratiosGestion([], { year: 2025 });
  const auto = getRatio(res, 'AUTONOMIE');
  assert.equal(auto.n, null);
  assert.equal(auto.n1, null);
  const dso = getRatio(res, 'DSO');
  assert.equal(dso.n, null);
  const caf = getRatio(res, 'CAF');
  assert.equal(caf.n, 0); // RN 0 + dot 0 − rep 0 = 0
  const tn = getRatio(res, 'TRESO-NETTE');
  assert.equal(tn.n, 0);
});

test('productivité : null sans effectif, calculée avec effectif', () => {
  const sans = getRatio(ratiosGestion(montage(), { year: 2025 }), 'PRODUCTIVITE');
  assert.equal(sans.n, null);
  assert.match(sans.interpretation, /Effectif non renseigné/);
  const avec = getRatio(ratiosGestion(montage(), { year: 2025, effectif: 3 }), 'PRODUCTIVITE');
  assert.equal(avec.n, 100000); // XB 300 000 / 3
  assert.equal(avec.n1, 33333); // XB N-1 100 000 / 3 = 33 333,33 → arrondi
});
