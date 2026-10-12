/**
 * Tests de src/engine/tft.js (TFT + TBFT, méthode directe) — node:test, zéro dépendance.
 *
 * Montage comptable équilibré sur deux exercices (N-1 = 2024, N = 2025) :
 *  - 2024 : capital 2 000 000 (cash), machine A 600 000 à crédit (4042,
 *    400 000 payés), machine B 100 000 cash, vente 1 000 000 (TVA 180 000),
 *    achats 500 000 payés, salaires 300 000 payés, dotation 80 000, IS 50 000 ;
 *  - 2025 : encaissement client 2024, vente 500 000 (TVA 90 000),
 *    achats 200 000 payés, salaires 150 000 payés, dotation 60 000,
 *    IS 30 000, paiement IS 2024, cession machine B (VNC 80 000, prix 90 000),
 *    solde fournisseur machine A (200 000).
 *
 * Valeurs attendues (calculées à la main, voir le détail dans chaque test) :
 *  N-1 : ZA=0, FA=150 000, ZB=−800 000, FG=−500 000, ZC=−500 000,
 *        ZF=2 000 000, ZG=700 000, ZH=700 000 ;
 *  N   : ZA=700 000, FA=120 000, FD=590 000, FE=70 000, ZB=780 000,
 *        FG=−200 000, FI=90 000, ZC=−110 000, ZF=0, ZG=670 000, ZH=1 370 000.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { tftData } from '../src/engine/tft.js';
import { compteResultatSIG } from '../src/engine/compte-resultat-sig.js';
import { previousYearBalances } from '../src/engine/previous-year.js';

const E = (id, date, lignes, journal = 'VT') => ({
  id, date, journal, piece: 'P-' + id, libelle: 'Test ' + id, lignes,
});
const L = (compte, debit, credit) => ({ compte, debit, credit });

const ENTRIES = [
  // ---- 2024 (N-1) ----
  E('e1', '2024-01-15', [L('521', 2000000, 0), L('101', 0, 2000000)]),
  E('e2', '2024-02-01', [L('244', 600000, 0), L('4042', 0, 600000)]),
  E('e3', '2024-03-01', [L('4042', 400000, 0), L('521', 0, 400000)]),
  E('e4', '2024-04-01', [L('244', 100000, 0), L('521', 0, 100000)]),
  E('e5', '2024-05-01', [L('411', 1180000, 0), L('701', 0, 1000000), L('443', 0, 180000)]),
  E('e6', '2024-06-01', [L('601', 500000, 0), L('401', 0, 500000)]),
  E('e7', '2024-07-01', [L('401', 500000, 0), L('521', 0, 500000)]),
  E('e8', '2024-08-01', [L('661', 300000, 0), L('421', 0, 300000)]),
  E('e9', '2024-08-02', [L('421', 300000, 0), L('521', 0, 300000)]),
  E('e10', '2024-12-31', [L('6813', 80000, 0), L('284', 0, 80000)]),
  E('e11', '2024-12-31', [L('891', 50000, 0), L('441', 0, 50000)]),
  // ---- 2025 (N) ----
  E('f1', '2025-01-10', [L('521', 1180000, 0), L('411', 0, 1180000)]),
  E('f2', '2025-03-01', [L('411', 590000, 0), L('701', 0, 500000), L('443', 0, 90000)]),
  E('f3', '2025-04-01', [L('601', 200000, 0), L('401', 0, 200000)]),
  E('f4', '2025-04-02', [L('401', 200000, 0), L('521', 0, 200000)]),
  E('f5', '2025-05-01', [L('661', 150000, 0), L('421', 0, 150000)]),
  E('f6', '2025-05-02', [L('421', 150000, 0), L('521', 0, 150000)]),
  E('f7', '2025-06-01', [L('6813', 60000, 0), L('284', 0, 60000)]),
  E('f8', '2025-07-01', [L('891', 30000, 0), L('441', 0, 30000)]),
  E('f9', '2025-08-01', [L('441', 50000, 0), L('521', 0, 50000)]),
  E('f10', '2025-09-01', [L('284', 20000, 0), L('812', 80000, 0), L('244', 0, 100000)]),
  E('f11', '2025-09-02', [L('521', 90000, 0), L('821', 0, 90000)]),
  E('f12', '2025-10-01', [L('4042', 200000, 0), L('521', 0, 200000)]),
];

const byRef = (t) => Object.fromEntries(t.lignes.map((l) => [l.ref, l]));
const val = (t, ref, col = 'n') => byRef(t)[ref][col];

/** Somme des soldes débiteurs / créditeurs sur des mouvements { c: { md, mc, solde } }. */
function sfdM(mouv, prefixes) {
  let t = 0;
  for (const c of Object.keys(mouv)) {
    if (!prefixes.some((p) => c.startsWith(p))) continue;
    if (mouv[c].solde > 0) t += mouv[c].solde;
  }
  return t;
}
function sfcM(mouv, prefixes) {
  let t = 0;
  for (const c of Object.keys(mouv)) {
    if (!prefixes.some((p) => c.startsWith(p))) continue;
    if (mouv[c].solde < 0) t -= mouv[c].solde;
  }
  return t;
}

describe('tftData — structure', () => {
  it('25 lignes, refs ZA→ZH dans l\'ordre officiel', () => {
    const t = tftData(ENTRIES, { year: 2025 });
    assert.equal(t.year, 2025);
    assert.deepEqual(t.lignes.map((l) => l.ref), [
      'ZA', 'FA', 'FB', 'FC', 'FD', 'FE', 'ZB',
      'FF', 'FG', 'FH', 'FI', 'FJ', 'ZC',
      'FK', 'FL', 'FM', 'FN', 'ZD',
      'FO', 'FP', 'FQ', 'ZE', 'ZF',
      'ZG', 'ZH',
    ]);
    for (const l of t.lignes) {
      assert.equal(typeof l.n, 'number', l.ref + '.n');
      assert.equal(typeof l.n1, 'number', l.ref + '.n1');
    }
  });

  it('détail TBFT : 4 sections non vides', () => {
    const t = tftData(ENTRIES, { year: 2025 });
    for (const sec of ['za', 'A', 'B', 'C']) {
      assert.ok(Array.isArray(t.tbft[sec]) && t.tbft[sec].length > 0, 'section ' + sec);
      for (const d of t.tbft[sec]) {
        assert.equal(typeof d.label, 'string');
      }
    }
  });

  it('year invalide → erreur', () => {
    assert.throws(() => tftData(ENTRIES, { year: 'x' }), /year/);
  });

  it('aucune écriture → zéros partout, contrôles verts', () => {
    const t = tftData([], { year: 2025 });
    for (const l of t.lignes) assert.equal(l.n, 0, l.ref);
    assert.equal(t.controles.zhEqTresoNette, true);
    assert.equal(t.controles.zgEqSomme, true);
    assert.equal(t.fqAValider, true);
  });
});

describe('tftData — colonne N-1 (2024)', () => {
  const t = tftData(ENTRIES, { year: 2025 });
  it('ZA = 0 (trésorerie au 1/1/2024)', () => assert.equal(val(t, 'ZA', 'n1'), 0));
  it('FA (CAFG) = 150 000', () => assert.equal(val(t, 'FA', 'n1'), 150000));
  it('ZB = −800 000', () => assert.equal(val(t, 'ZB', 'n1'), -800000));
  it('FG = −500 000 (400 000 cash + 100 000 cash)', () => assert.equal(val(t, 'FG', 'n1'), -500000));
  it('ZC = −500 000', () => assert.equal(val(t, 'ZC', 'n1'), -500000));
  it('ZF = 2 000 000 (augmentation de capital)', () => assert.equal(val(t, 'ZF', 'n1'), 2000000));
  it('ZG = 700 000, ZH = 700 000', () => {
    assert.equal(val(t, 'ZG', 'n1'), 700000);
    assert.equal(val(t, 'ZH', 'n1'), 700000);
  });
  it('ZA(N-1) = ZH(N-1) − ZG(N-1)', () => {
    assert.equal(val(t, 'ZA', 'n1'), val(t, 'ZH', 'n1') - val(t, 'ZG', 'n1'));
  });
});

describe('tftData — colonne N (2025)', () => {
  const t = tftData(ENTRIES, { year: 2025 });
  it('ZA = 700 000 (trésorerie au 1/1/2025)', () => assert.equal(val(t, 'ZA'), 700000));
  it('FA (CAFG) = 120 000', () => assert.equal(val(t, 'FA'), 120000));
  it('FD = 590 000 (Δ créances : 590 000 − 1 180 000, signe −)', () => assert.equal(val(t, 'FD'), 590000));
  it('FE = 70 000 (Δ dettes : 300 000 − 230 000)', () => assert.equal(val(t, 'FE'), 70000));
  it('ZB = 780 000', () => assert.equal(val(t, 'ZB'), 780000));
  it('FG = −200 000 (solde fournisseur machine A payé)', () => assert.equal(val(t, 'FG'), -200000));
  it('FI = 90 000 (cession machine B)', () => assert.equal(val(t, 'FI'), 90000));
  it('ZC = −110 000', () => assert.equal(val(t, 'ZC'), -110000));
  it('ZF = 0', () => assert.equal(val(t, 'ZF'), 0));
  it('ZG = 670 000, ZH = 1 370 000', () => {
    assert.equal(val(t, 'ZG'), 670000);
    assert.equal(val(t, 'ZH'), 1370000);
  });
});

describe('tftData — identités d\'agrégation', () => {
  const t = tftData(ENTRIES, { year: 2025 });
  for (const col of ['n', 'n1']) {
    it(`ZB = FA+FB+FC+FD+FE (${col})`, () => {
      assert.equal(val(t, 'ZB', col),
        val(t, 'FA', col) + val(t, 'FB', col) + val(t, 'FC', col) + val(t, 'FD', col) + val(t, 'FE', col));
    });
    it(`ZC = FF+FG+FH+FI+FJ (${col})`, () => {
      assert.equal(val(t, 'ZC', col),
        val(t, 'FF', col) + val(t, 'FG', col) + val(t, 'FH', col) + val(t, 'FI', col) + val(t, 'FJ', col));
    });
    it(`ZD = FK+FL+FM+FN (${col})`, () => {
      assert.equal(val(t, 'ZD', col),
        val(t, 'FK', col) + val(t, 'FL', col) + val(t, 'FM', col) + val(t, 'FN', col));
    });
    it(`ZE = FO+FP+FQ (${col})`, () => {
      assert.equal(val(t, 'ZE', col),
        val(t, 'FO', col) + val(t, 'FP', col) + val(t, 'FQ', col));
    });
    it(`ZF = ZD+ZE (${col})`, () => {
      assert.equal(val(t, 'ZF', col), val(t, 'ZD', col) + val(t, 'ZE', col));
    });
    it(`ZG = ZB+ZC+ZF (${col})`, () => {
      assert.equal(val(t, 'ZG', col), val(t, 'ZB', col) + val(t, 'ZC', col) + val(t, 'ZF', col));
    });
    it(`ZH = ZG+ZA (${col})`, () => {
      assert.equal(val(t, 'ZH', col), val(t, 'ZG', col) + val(t, 'ZA', col));
    });
  }
});

describe('tftData — formule exacte de la CAFG', () => {
  it('FA = XD + 654(sfd) − 754(sfc) + XF + TO + RP + RQ + RS (N et N-1)', () => {
    const t = tftData(ENTRIES, { year: 2025 });
    const cr = compteResultatSIG(ENTRIES, { year: 2025 });
    const { mouvN, mouvN1 } = previousYearBalances(ENTRIES, { year: 2025 });
    const crv = (ref, col) => cr.lignes.find((l) => l.ref === ref)[col];
    for (const [col, mouv] of [['n', mouvN], ['n1', mouvN1]]) {
      const attendu = crv('XD', col)
        + sfdM(mouv, ['654']) - sfcM(mouv, ['754'])
        + crv('XF', col) + crv('TO', col)
        + crv('RP', col) + crv('RQ', col) + crv('RS', col);
      assert.equal(val(t, 'FA', col), attendu, 'colonne ' + col);
    }
  });
});

describe('tftData — contrôles', () => {
  it('ZH = trésorerie nette N (tréso-actif − tréso-passif)', () => {
    const t = tftData(ENTRIES, { year: 2025 });
    assert.equal(t.controles.zhEqTresoNette, true);
    assert.equal(t.controles.tresoNetteN, 1370000);
    assert.equal(t.controles.ecartZH, 0);
  });
  it('ZG = ZB + ZC + ZF', () => {
    const t = tftData(ENTRIES, { year: 2025 });
    assert.equal(t.controles.zgEqSomme, true);
    assert.equal(t.controles.ecartZG, 0);
  });
});

describe('tftData — FQ marquée à valider (ambiguïté du classeur)', () => {
  it('sans remboursement : FQ = 0 mais ligne marquée à valider', () => {
    const t = tftData(ENTRIES, { year: 2025 });
    assert.equal(val(t, 'FQ'), 0);
    assert.equal(t.fqAValider, true);
    assert.equal(byRef(t).FQ.fqAValider, true);
    assert.equal(t.fq.remboursementsN, 0);
    assert.equal(t.fq.alternatifN, 0);
  });

  it('avec remboursement : valeur NON figée, deux signes exposés', () => {
    const loan = [
      E('p1', '2024-06-01', [L('521', 500000, 0), L('162', 0, 500000)]),
      E('p2', '2025-06-01', [L('162', 200000, 0), L('521', 0, 200000)]),
    ];
    const t = tftData(loan, { year: 2025 });
    // La valeur affichée suit l'hypothèse « − » (sortie), mais les deux
    // signes restent exposés : rien n'est figé en dur.
    assert.equal(t.fqAValider, true);
    assert.equal(t.fq.remboursementsN, 200000);
    assert.equal(t.fq.retenuN, -200000);
    assert.equal(t.fq.alternatifN, 200000);
    assert.equal(val(t, 'FQ'), -200000);
    assert.equal(byRef(t).FQ.fqAValider, true);
    // N-1 : aucun remboursement en 2024
    assert.equal(t.fq.remboursementsN1, 0);
  });
});

describe('tftData — détail TBFT cohérent avec le TFT', () => {
  it('les totaux du détail reprennent les lignes FA, ZB, ZC, ZF', () => {
    const t = tftData(ENTRIES, { year: 2025 });
    const find = (sec, prefix) => t.tbft[sec].find((d) => d.label.startsWith(prefix));
    assert.equal(find('A', 'FA — CAFG').n, val(t, 'FA'));
    assert.equal(find('A', 'ZB — Flux opérationnel').n, val(t, 'ZB'));
    assert.equal(find('B', 'ZC — Flux').n, val(t, 'ZC'));
    assert.equal(find('C', 'ZF — Flux de financement').n, val(t, 'ZF'));
    assert.equal(find('za', 'ZA — Trésorerie nette').n, val(t, 'ZA'));
  });
});
