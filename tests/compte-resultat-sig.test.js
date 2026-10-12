/**
 * Tests Phase 2 — Compte de résultat aux SIG officiels OHADA.
 * node:test + node:assert/strict, zéro dépendance.
 *
 * Couvre :
 *  - la cascade complète des SIG (XA, XB, XC, XD, XE, XF, XG, XH, XI)
 *    sur un montage équilibré ;
 *  - les variations de stocks : stockage PUIS déstockage (6031, 73) ;
 *  - les mappings fins du classeur : 601→RA vs 602→RC vs 604+605+608→RE,
 *    681+691→RL vs 697→RN, 791+798+799→TJ vs 797→TL, 781→TI et 787→TM
 *    isolés ;
 *  - les colonnes N / N-1 (dont N-1 depuis les données de démo
 *    demo-data-2024-2025.json) ;
 *  - la cohérence XI = résultat net injecté au bilan modèle 2 (ligne CJ)
 *    et XI = resultatNet(mouvN) de financial-statements.js (moteur
 *    existant, non modifié).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compteResultatSIG } from '../src/engine/compte-resultat-sig.js';
import { bilanModele2 } from '../src/engine/bilan-modele2.js';
import { previousYearBalances } from '../src/engine/previous-year.js';
import { resultatNet } from '../src/engine/financial-statements.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const L = (compte, debit, credit) => ({ compte, debit, credit });
const E = (id, date, lignes) => ({ id, date, journal: 'OD', piece: id, libelle: id, lignes });

function val(cr, ref, col = 'n') {
  const l = cr.lignes.find((x) => x.ref === ref);
  assert.ok(l, 'ligne ' + ref + ' présente');
  return l[col];
}

/* ------------------------------------------------------------------ */
/* Montage complet : un exercice avec tous les blocs du classeur        */
/* ------------------------------------------------------------------ */

function montageComplet() {
  return [
    // --- Marge commerciale ---
    E('v1', '2025-02-01', [L('411', 1000000, 0), L('701', 0, 1000000)]),   // TA
    E('a1', '2025-02-02', [L('601', 600000, 0), L('401', 0, 600000)]),     // RA
    E('s1', '2025-02-03', [L('311', 100000, 0), L('6031', 0, 100000)]),    // RB stockage
    // --- Chiffre d'affaires ---
    E('v2', '2025-03-01', [L('411', 500000, 0), L('702', 0, 500000)]),     // TB
    E('v3', '2025-03-02', [L('411', 200000, 0), L('706', 0, 200000)]),     // TC
    E('v4', '2025-03-03', [L('411', 50000, 0), L('707', 0, 50000)]),       // TD
    // --- Production / valeur ajoutée ---
    E('p1', '2025-04-01', [L('331', 80000, 0), L('73', 0, 80000)]),        // TE stockage
    E('p2', '2025-04-02', [L('241', 30000, 0), L('72', 0, 30000)]),        // TF
    E('p3', '2025-04-03', [L('521', 20000, 0), L('71', 0, 20000)]),        // TG
    E('p4', '2025-04-04', [L('411', 10000, 0), L('758', 0, 10000)]),       // TH
    E('p5', '2025-04-05', [L('471', 5000, 0), L('781', 0, 5000)]),         // TI
    E('c1', '2025-05-01', [L('602', 150000, 0), L('401', 0, 150000)]),     // RC
    E('c2', '2025-05-02', [L('6032', 40000, 0), L('321', 0, 40000)]),      // RD déstockage
    E('c3', '2025-05-03', [L('604', 25000, 0), L('401', 0, 25000)]),       // RE
    E('c4', '2025-05-04', [L('605', 15000, 0), L('401', 0, 15000)]),       // RE
    E('c5', '2025-05-05', [L('608', 10000, 0), L('401', 0, 10000)]),       // RE
    E('c6', '2025-05-06', [L('322', 12000, 0), L('6033', 0, 12000)]),      // RF stockage
    E('c7', '2025-05-07', [L('611', 18000, 0), L('401', 0, 18000)]),       // RG
    E('c8', '2025-05-08', [L('621', 30000, 0), L('401', 0, 30000)]),       // RH
    E('c9', '2025-05-09', [L('631', 20000, 0), L('401', 0, 20000)]),       // RH
    E('c10', '2025-05-10', [L('641', 12000, 0), L('442', 0, 12000)]),      // RI
    E('c11', '2025-05-11', [L('651', 8000, 0), L('401', 0, 8000)]),        // RJ
    E('c12', '2025-05-12', [L('661', 300000, 0), L('421', 0, 300000)]),    // RK
    // --- Exploitation : reprises / dotations ---
    E('r1', '2025-06-01', [L('291', 10000, 0), L('791', 0, 10000)]),       // TJ
    E('r2', '2025-06-02', [L('491', 5000, 0), L('798', 0, 5000)]),         // TJ
    E('r3', '2025-06-03', [L('599', 3000, 0), L('799', 0, 3000)]),         // TJ
    E('d1', '2025-06-04', [L('681', 40000, 0), L('281', 0, 40000)]),       // RL
    E('d2', '2025-06-05', [L('691', 12000, 0), L('291', 0, 12000)]),       // RL
    // --- Financier ---
    E('f1', '2025-07-01', [L('521', 15000, 0), L('771', 0, 15000)]),       // TK
    E('f2', '2025-07-02', [L('296', 4000, 0), L('797', 0, 4000)]),         // TL
    E('f3', '2025-07-03', [L('471', 2000, 0), L('787', 0, 2000)]),         // TM
    E('f4', '2025-07-04', [L('671', 9000, 0), L('521', 0, 9000)]),         // RM
    E('f5', '2025-07-05', [L('697', 6000, 0), L('296', 0, 6000)]),         // RN
    // --- HAO ---
    E('h1', '2025-08-01', [L('521', 50000, 0), L('821', 0, 50000)]),       // TN
    E('h2', '2025-08-02', [L('521', 7000, 0), L('841', 0, 7000)]),         // TO
    E('h3', '2025-08-03', [L('812', 30000, 0), L('244', 0, 30000)]),       // RO
    E('h4', '2025-08-04', [L('831', 5000, 0), L('521', 0, 5000)]),         // RP
    // --- Participation / IS ---
    E('z1', '2025-09-01', [L('871', 10000, 0), L('471', 0, 10000)]),       // RQ
    E('z2', '2025-09-02', [L('891', 60000, 0), L('441', 0, 60000)]),       // RS
    // --- N-1 ---
    E('n1', '2024-02-01', [L('411', 400000, 0), L('701', 0, 400000)]),
    E('n2', '2024-02-02', [L('601', 250000, 0), L('401', 0, 250000)]),
  ];
}

test('structure : 42 lignes TA→XI, refs officielles, SIG marqués', () => {
  const cr = compteResultatSIG(montageComplet(), { year: 2025 });
  assert.equal(cr.year, 2025);
  assert.equal(cr.lignes.length, 42);
  assert.equal(cr.lignes[0].ref, 'TA');
  assert.equal(cr.lignes[cr.lignes.length - 1].ref, 'XI');
  const sigs = cr.lignes.filter((l) => l.isSig).map((l) => l.ref);
  assert.deepEqual(sigs, ['XA', 'XB', 'XC', 'XD', 'XE', 'XF', 'XG', 'XH', 'XI']);
  const xi = cr.lignes.find((l) => l.ref === 'XI');
  assert.equal(xi.signe, '');
  assert.equal(cr.lignes.find((l) => l.ref === 'TA').signe, '+');
  assert.equal(cr.lignes.find((l) => l.ref === 'RA').signe, '−');
  assert.equal(cr.lignes.find((l) => l.ref === 'RB').signe, '+/−');
});

test('SIG : cascade complète vérifiée à la main', () => {
  const cr = compteResultatSIG(montageComplet(), { year: 2025 });
  assert.equal(val(cr, 'TA'), 1000000);
  assert.equal(val(cr, 'RA'), -600000);
  assert.equal(val(cr, 'RB'), 100000); // stockage marchandises
  assert.equal(val(cr, 'XA'), 500000); // 1000000 − 600000 + 100000
  assert.equal(val(cr, 'XB'), 1750000); // TA+TB+TC+TD
  // XC = 1750000 −600000 +100000 +80000 +30000 +20000 +10000 +5000
  //      −150000 −40000 −50000 +12000 −18000 −50000 −12000 −8000
  assert.equal(val(cr, 'XC'), 1079000);
  assert.equal(val(cr, 'RK'), -300000);
  assert.equal(val(cr, 'XD'), 779000);
  assert.equal(val(cr, 'TJ'), 18000); // 791+798+799
  assert.equal(val(cr, 'RL'), -52000); // 681+691
  assert.equal(val(cr, 'XE'), 745000);
  assert.equal(val(cr, 'TK'), 15000);
  assert.equal(val(cr, 'TL'), 4000); // 797 isolé de TJ
  assert.equal(val(cr, 'TM'), 2000); // 787 isolé
  assert.equal(val(cr, 'RM'), -9000);
  assert.equal(val(cr, 'RN'), -6000); // 697 isolé de RL
  assert.equal(val(cr, 'XF'), 6000);
  assert.equal(val(cr, 'XG'), 751000);
  assert.equal(val(cr, 'TN'), 50000);
  assert.equal(val(cr, 'TO'), 7000);
  assert.equal(val(cr, 'RO'), -30000);
  assert.equal(val(cr, 'RP'), -5000);
  assert.equal(val(cr, 'XH'), 22000);
  assert.equal(val(cr, 'RQ'), -10000);
  assert.equal(val(cr, 'RS'), -60000);
  assert.equal(val(cr, 'XI'), 703000);
  assert.equal(cr.resNet, 703000);
});

test('mappings fins : 601/602/604+605+608, 681+691/697, 791+798+799/797, 781/787', () => {
  const cr = compteResultatSIG(montageComplet(), { year: 2025 });
  assert.equal(val(cr, 'RA'), -600000, '601 seul en RA');
  assert.equal(val(cr, 'RC'), -150000, '602 seul en RC');
  assert.equal(val(cr, 'RE'), -50000, '604+605+608 en RE');
  assert.equal(val(cr, 'TI'), 5000, '781 isolé en TI (pas dans TJ)');
  assert.equal(val(cr, 'TM'), 2000, '787 isolé en TM (pas dans TL)');
  assert.equal(val(cr, 'TJ'), 18000, 'TJ = 791+798+799 sans 781 ni 797');
  assert.equal(val(cr, 'TL'), 4000, 'TL = 797 seul');
  assert.equal(val(cr, 'RL'), -52000, 'RL = 681+691 sans 697');
  assert.equal(val(cr, 'RN'), -6000, 'RN = 697 seul');
});

test('variations de stocks : stockage puis déstockage', () => {
  // Stockage marchandises : D 311 / C 6031 → RB positif
  const stock = [E('s', '2025-01-15', [L('311', 100000, 0), L('6031', 0, 100000)])];
  let cr = compteResultatSIG(stock, { year: 2025 });
  assert.equal(val(cr, 'RB'), 100000);
  assert.equal(val(cr, 'XA'), 100000);
  // Déstockage marchandises : D 6031 / C 311 → RB négatif
  const destock = [E('d', '2025-02-15', [L('6031', 60000, 0), L('311', 0, 60000)])];
  cr = compteResultatSIG(destock, { year: 2025 });
  assert.equal(val(cr, 'RB'), -60000);
  assert.equal(val(cr, 'XA'), -60000);
  // Cumulés : stockage 100 000 puis déstockage 60 000 → RB = +40 000
  cr = compteResultatSIG(stock.concat(destock), { year: 2025 });
  assert.equal(val(cr, 'RB'), 40000);
  // Production stockée (73) : stockage → TE positif, déstockage → TE négatif
  const pstock = [E('p', '2025-03-01', [L('331', 80000, 0), L('73', 0, 80000)])];
  cr = compteResultatSIG(pstock, { year: 2025 });
  assert.equal(val(cr, 'TE'), 80000);
  const pdestock = [E('q', '2025-04-01', [L('73', 30000, 0), L('331', 0, 30000)])];
  cr = compteResultatSIG(pdestock, { year: 2025 });
  assert.equal(val(cr, 'TE'), -30000);
  // RD (6032) déstockage MP et RF (6033) stockage autres approvisionnements
  const mix = [
    E('m1', '2025-05-01', [L('6032', 40000, 0), L('321', 0, 40000)]),
    E('m2', '2025-05-02', [L('322', 12000, 0), L('6033', 0, 12000)]),
  ];
  cr = compteResultatSIG(mix, { year: 2025 });
  assert.equal(val(cr, 'RD'), -40000);
  assert.equal(val(cr, 'RF'), 12000);
});

test('colonnes N-1 : exercice précédent isolé', () => {
  const cr = compteResultatSIG(montageComplet(), { year: 2025 });
  assert.equal(val(cr, 'TA', 'n1'), 400000);
  assert.equal(val(cr, 'RA', 'n1'), -250000);
  assert.equal(val(cr, 'XA', 'n1'), 150000);
  assert.equal(val(cr, 'XB', 'n1'), 400000);
  assert.equal(val(cr, 'XI', 'n1'), 150000);
  assert.equal(cr.resNetN1, 150000);
  // L'exercice 2024 vu comme N n'a pas de N-1 dans ce montage
  const cr24 = compteResultatSIG(montageComplet(), { year: 2024 });
  assert.equal(val(cr24, 'XI'), 150000);
  assert.equal(val(cr24, 'XI', 'n1'), 0);
});

test('N-1 depuis les données de démo 2024-2025', () => {
  const demo = JSON.parse(readFileSync(join(ROOT, 'demo-data-2024-2025.json'), 'utf8'));
  const entries = demo.ecritures;
  const cr25 = compteResultatSIG(entries, { year: 2025 });
  const cr24 = compteResultatSIG(entries, { year: 2024 });
  // Cohérence des colonnes : N-1 de 2025 = N de 2024, ligne par ligne
  for (const l of cr25.lignes) {
    const l24 = cr24.lignes.find((x) => x.ref === l.ref);
    assert.equal(l.n1, l24.n, 'N-1(' + l.ref + ') 2025 = N(' + l.ref + ') 2024');
  }
  assert.equal(cr25.resNetN1, cr24.resNet);
  // Données non triviales (montants réels de la démo)
  assert.ok(val(cr25, 'TA') > 0, 'TA 2025 non nul');
  assert.ok(val(cr25, 'TA', 'n1') > 0, 'TA N-1 non nul');
});

test('cohérence : XI = resultatNet(mouvN) et CJ du bilan modèle 2', () => {
  for (const entries of [montageComplet(),
    JSON.parse(readFileSync(join(ROOT, 'demo-data-2024-2025.json'), 'utf8')).ecritures]) {
    for (const year of [2024, 2025]) {
      const cr = compteResultatSIG(entries, { year });
      const { mouvN } = previousYearBalances(entries, { year });
      assert.equal(cr.resNet, resultatNet(mouvN),
        'XI = resultatNet(mouvN) (' + year + ')');
      const b = bilanModele2(entries, { year, resNet: cr.resNet });
      const cj = b.passif.find((r) => r.ref === 'CJ');
      assert.ok(cj, 'ligne CJ présente au passif');
      assert.equal(cj.netN, cr.resNet, 'CJ = XI (' + year + ')');
    }
  }
});

test('année invalide → erreur explicite', () => {
  assert.throws(() => compteResultatSIG([], {}), /year doit être une année entière/);
  assert.throws(() => compteResultatSIG([], { year: 'abc' }), /year doit être une année entière/);
});

test('entrées vides → 42 lignes à zéro', () => {
  const cr = compteResultatSIG([], { year: 2025 });
  assert.equal(cr.lignes.length, 42);
  assert.ok(cr.lignes.every((l) => l.n === 0 && l.n1 === 0));
  assert.equal(cr.resNet, 0);
  assert.equal(cr.resNetN1, 0);
});
