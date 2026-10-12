/**
 * Tests phase 8 — Convertisseur de devises (pur).
 * node:test + node:assert/strict, zéro dépendance.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FX_CURRENCIES, FX_SYMBOLS, DEFAULT_FX_RATES, fxRate, convert, sanitizeFxRates,
} from '../src/engine/convertisseur.js';

test('constantes : 5 devises, matrice complète', () => {
  assert.deepEqual(FX_CURRENCIES, ['XOF', 'USD', 'EUR', 'NGN', 'GBP']);
  for (const from of FX_CURRENCIES) {
    for (const to of FX_CURRENCIES) {
      if (from === to) continue; // la diagonale vaut 1 par convention (fxRate)
      assert.ok(typeof DEFAULT_FX_RATES[from][to] === 'number', from + '->' + to);
    }
  }
  assert.equal(FX_SYMBOLS.XOF, 'CFA');
});

test('fxRate : 1 si identiques, null si inconnu', () => {
  assert.equal(fxRate(DEFAULT_FX_RATES, 'XOF', 'XOF'), 1);
  assert.equal(fxRate(DEFAULT_FX_RATES, 'EUR', 'XOF'), 659.02);
  assert.equal(fxRate({}, 'USD', 'XOF'), null);
});

test('convert : montants arrondis à 2 décimales', () => {
  assert.equal(convert(1000000, 'XOF', 'EUR', DEFAULT_FX_RATES), 1520);
  assert.equal(convert(1000, 'EUR', 'XOF', DEFAULT_FX_RATES), 659020);
  assert.equal(convert(500, 'USD', 'USD', DEFAULT_FX_RATES), 500);
  assert.equal(convert(1, 'USD', 'XOF', {}), null);
  // NGN -> XOF : 1.45
  assert.equal(convert(100000, 'NGN', 'XOF', DEFAULT_FX_RATES), 145000);
});

test('sanitizeFxRates : invalides repliés sur précédent, diagonale = 1', () => {
  const s = sanitizeFxRates({ USD: { XOF: 'abc' }, EUR: { XOF: 700 } }, DEFAULT_FX_RATES);
  assert.equal(s.USD.XOF, 601.23);
  assert.equal(s.EUR.XOF, 700);
  assert.equal(s.XOF.XOF, 1);
  assert.equal(s.GBP.USD, 1.267);
});
