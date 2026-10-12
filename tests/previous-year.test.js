/**
 * Tests de src/engine/previous-year.js (soldes N / N-1, Phase 0) — node:test, zéro dépendance.
 * Inclut un test sur les données de démo réelles (demo-data-2024-2025.json).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { previousYearBalances, accountVariation } from '../src/engine/previous-year.js';

const E = (id, date, lignes, journal = 'VT') => ({
  id, date, journal, piece: 'P-' + id, libelle: 'Test', lignes,
});

// Données de démo réelles : écritures demo-an-2024 (2024-01-01) et demo-an-2025 (2025-01-01)
const demoPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'demo-data-2024-2025.json');
const demoEntries = JSON.parse(readFileSync(demoPath, 'utf8')).ecritures;

describe('previousYearBalances — cas nominaux', () => {
  it('année simple : cumulN et mouvN sur les mêmes données', () => {
    const entries = [
      E('e1', '2025-03-10', [
        { compte: '411', debit: 100000, credit: 0 },
        { compte: '701', debit: 0, credit: 100000 },
      ]),
    ];
    const r = previousYearBalances(entries, { year: 2025 });
    assert.equal(r.year, 2025);
    assert.equal(r.cumulN['411'].solde, 100000); // classe 4 → cumulé
    assert.equal(r.mouvN['411'].md, 100000);
    assert.equal(r.mouvN['701'].mc, 100000);
    assert.equal(r.cumulN['701'], undefined); // classe 7 → jamais cumulée
  });

  it('comptes 6/7/8 : mouvements oui, cumul non (N et N-1)', () => {
    const entries = [
      E('e1', '2024-06-01', [{ compte: '601', debit: 50000, credit: 0 }, { compte: '401', debit: 0, credit: 50000 }]),
      E('e2', '2025-06-01', [{ compte: '601', debit: 60000, credit: 0 }, { compte: '401', debit: 0, credit: 60000 }]),
    ];
    const r = previousYearBalances(entries, { year: 2025 });
    // N-1 : mouvements 2024
    assert.equal(r.mouvN1['601'].md, 50000);
    assert.equal(r.cumulN1['601'], undefined); // classe 6 exclue du cumul
    assert.equal(r.cumulN1['401'].solde, -50000);
    // N : mouvements 2025 + cumul au 31/12/2025
    assert.equal(r.mouvN['601'].md, 60000);
    assert.equal(r.cumulN['601'], undefined);
    assert.equal(r.cumulN['401'].solde, -110000);
  });

  it('exercice sans N-1 : objets vides, pas de crash', () => {
    const entries = [
      E('e1', '2025-01-15', [{ compte: '521', debit: 20000, credit: 0 }, { compte: '101', debit: 0, credit: 20000 }]),
    ];
    const r = previousYearBalances(entries, { year: 2025 });
    assert.deepEqual(r.cumulN1, {});
    assert.deepEqual(r.mouvN1, {});
    assert.equal(r.cumulN['521'].solde, 20000);
  });

  it('sans écritures : tout est vide', () => {
    const r = previousYearBalances([], { year: 2025 });
    assert.deepEqual(r.cumulN, {});
    assert.deepEqual(r.cumulN1, {});
    assert.deepEqual(r.mouvN, {});
    assert.deepEqual(r.mouvN1, {});
  });

  it('année invalide : erreur explicite', () => {
    assert.throws(() => previousYearBalances([], { year: 'abc' }), /année/);
  });

  it('écriture à cheval sur le 31/12 : strictement par année civile', () => {
    const entries = [
      E('e1', '2024-12-31', [{ compte: '411', debit: 1000, credit: 0 }, { compte: '701', debit: 0, credit: 1000 }]),
      E('e2', '2025-01-01', [{ compte: '401', debit: 0, credit: 2000 }, { compte: '601', debit: 2000, credit: 0 }]),
    ];
    const r = previousYearBalances(entries, { year: 2025 });
    assert.equal(r.mouvN1['411'].md, 1000);
    assert.equal(r.mouvN1['401'], undefined);
    assert.equal(r.mouvN['401'].mc, 2000);
    assert.equal(r.mouvN['411'], undefined);
    assert.equal(r.cumulN['411'].solde, 1000);
    assert.equal(r.cumulN['401'].solde, -2000);
  });
});

describe('previousYearBalances — données de démo réelles (2024/2025)', () => {
  it('fichier de démo : 2 écritures équilibrées aux dates attendues', () => {
    assert.equal(demoEntries.length, 2);
    const ids = demoEntries.map(e => e.id).sort();
    assert.deepEqual(ids, ['demo-an-2024', 'demo-an-2025']);
    demoEntries.forEach(e => {
      const d = e.lignes.reduce((a, l) => a + l.debit, 0);
      const c = e.lignes.reduce((a, l) => a + l.credit, 0);
      assert.equal(d, c, e.id + ' équilibrée');
    });
  });

  it('year=2025 : cumulN1 = soldes des à-nouveaux 2024 (classes 1-5)', () => {
    const r = previousYearBalances(demoEntries, { year: 2025 });
    // 101 : crédit 254 834 213 dans demo-an-2024 → solde créditeur
    assert.equal(r.cumulN1['101'].solde, -254834213);
    // 411 : débit 903 115 dans demo-an-2024
    assert.equal(r.cumulN1['411'].solde, 903115);
    assert.equal(r.cumulN1['411'].md, 903115);
  });

  it('year=2025 : classes 6/7/8 de 2024 non cumulées, mais en mouvements N-1', () => {
    const r = previousYearBalances(demoEntries, { year: 2025 });
    assert.equal(r.cumulN1['6011'], undefined); // charge → jamais cumulée
    assert.equal(r.cumulN1['701'], undefined);  // produit → jamais cumulé
    assert.equal(r.mouvN1['6011'].md, 25922245); // mouvement N-1 présent
    assert.equal(r.mouvN1['701'].mc, 589463607);
  });

  it('year=2025 : cumulN = cumul des à-nouveaux 2024 + 2025 (classes 1-5)', () => {
    const r = previousYearBalances(demoEntries, { year: 2025 });
    // 101 : 254 834 213 (2024) + 261 490 156 (2025) au crédit
    assert.equal(r.cumulN['101'].solde, -(254834213 + 261490156));
    // 411 : 903 115 (2024) + 1 214 714 (2025) au débit
    assert.equal(r.cumulN['411'].solde, 903115 + 1214714);
    // mouvN = exercice 2025 uniquement
    assert.equal(r.mouvN['101'].mc, 261490156);
    assert.equal(r.mouvN['101'].md, 0);
  });

  it('year=2024 : pas de N-1 → objets vides', () => {
    const r = previousYearBalances(demoEntries, { year: 2024 });
    assert.deepEqual(r.cumulN1, {});
    assert.deepEqual(r.mouvN1, {});
    assert.equal(r.cumulN['101'].solde, -254834213);
    assert.equal(r.mouvN['701'].mc, 589463607);
  });

  it('cumulN1 ne contient aucune classe 6/7/8 sur les données de démo', () => {
    const r = previousYearBalances(demoEntries, { year: 2025 });
    const bad = Object.keys(r.cumulN1).filter(c => ['6', '7', '8'].includes(c.charAt(0)));
    assert.deepEqual(bad, []);
  });
});

describe('accountVariation — helper TFT', () => {
  it('Δ = N − N-1 (md, mc, solde)', () => {
    const cumulN = { '521': { md: 300, mc: 50, solde: 250 } };
    const cumulN1 = { '521': { md: 100, mc: 20, solde: 80 } };
    assert.deepEqual(accountVariation(cumulN, cumulN1, '521'), { md: 200, mc: 30, solde: 170 });
  });

  it('compte absent d’un exercice → traité à zéro', () => {
    assert.deepEqual(accountVariation({ '521': { md: 100, mc: 0, solde: 100 } }, {}, '521'),
      { md: 100, mc: 0, solde: 100 });
    assert.deepEqual(accountVariation({}, {}, '999'), { md: 0, mc: 0, solde: 0 });
  });
});
