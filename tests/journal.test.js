/**
 * Tests du journal : validation partie double, CRUD, formats.
 * node:test + node:assert/strict, zéro dépendance.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateEntry, addEntry, updateEntry, deleteEntry,
  flattenEntry, toLines, fromLegacyLines, newEntryId
} from '../src/engine/journal.js';

const VOUCHER_OK = {
  date: '2025-01-12', journal: 'AC', piece: 'AC2025-0002',
  libelle: 'Achat marchandises',
  lignes: [
    { compte: '601', debit: 1000000, credit: 0 },
    { compte: '4452', debit: 180000, credit: 0 },
    { compte: '401', debit: 0, credit: 1180000 }
  ]
};

test('écriture équilibrée valide', () => {
  const v = validateEntry(VOUCHER_OK);
  assert.equal(v.ok, true);
  assert.deepEqual(v.errors, []);
});

test('écriture déséquilibrée rejetée', () => {
  const bad = {
    ...VOUCHER_OK,
    lignes: [
      { compte: '601', debit: 1000000, credit: 0 },
      { compte: '401', debit: 0, credit: 1100000 }
    ]
  };
  const v = validateEntry(bad);
  assert.equal(v.ok, false);
  assert.ok(v.errors.some(e => /déséquilibrée/.test(e)));
});

test('une seule ligne rejetée (partie double)', () => {
  const v = validateEntry({ ...VOUCHER_OK, lignes: [{ compte: '601', debit: 1000, credit: 0 }] });
  assert.equal(v.ok, false);
});

test('compte inconnu au plan rejeté', () => {
  const v = validateEntry({
    ...VOUCHER_OK,
    lignes: [
      { compte: '601', debit: 1000000, credit: 0 },
      { compte: '999999', debit: 0, credit: 1000000 }
    ]
  });
  assert.equal(v.ok, false);
  assert.ok(v.errors.some(e => /inconnu au plan comptable/.test(e)));
});

test('compte mal formé rejeté', () => {
  for (const c of ['ABC', '4', '1234567', '']) {
    const v = validateEntry({
      ...VOUCHER_OK,
      lignes: [
        { compte: '601', debit: 1000, credit: 0 },
        { compte: c, debit: 0, credit: 1000 }
      ]
    });
    assert.equal(v.ok, false, 'compte ' + JSON.stringify(c));
  }
});

test('montant négatif rejeté', () => {
  const v = validateEntry({
    ...VOUCHER_OK,
    lignes: [
      { compte: '601', debit: -1000, credit: 0 },
      { compte: '401', debit: 0, credit: 1000 }
    ]
  });
  assert.equal(v.ok, false);
  assert.ok(v.errors.some(e => /positifs/.test(e)));
});

test('débit ET crédit sur la même ligne rejetés', () => {
  const v = validateEntry({
    ...VOUCHER_OK,
    lignes: [
      { compte: '601', debit: 1000, credit: 500 },
      { compte: '401', debit: 0, credit: 1500 }
    ]
  });
  assert.equal(v.ok, false);
  assert.ok(v.errors.some(e => /un seul montant/.test(e)));
});

test('date / libellé / journal obligatoires', () => {
  assert.equal(validateEntry({ ...VOUCHER_OK, date: 'pas-une-date' }).ok, false);
  assert.equal(validateEntry({ ...VOUCHER_OK, date: '2025-13-40' }).ok, false);
  assert.equal(validateEntry({ ...VOUCHER_OK, libelle: '   ' }).ok, false);
  assert.equal(validateEntry({ ...VOUCHER_OK, journal: '' }).ok, false);
});

test('addEntry : immuable, id généré si absent', () => {
  const before = [];
  const r = addEntry(before, VOUCHER_OK);
  assert.equal(r.ok, true);
  assert.equal(before.length, 0);
  assert.equal(r.entries.length, 1);
  assert.ok(/^e[0-9a-z]+$/.test(r.entries[0].id));
  assert.equal(r.entries[0].lignes.length, 3);
});

test('addEntry : échec → tableau inchangé', () => {
  const before = [];
  const r = addEntry(before, { ...VOUCHER_OK, lignes: [] });
  assert.equal(r.ok, false);
  assert.equal(r.entries, before);
});

test('updateEntry : modification + revalidation', () => {
  const r1 = addEntry([], { ...VOUCHER_OK, id: 'e1' });
  const r2 = updateEntry(r1.entries, 'e1', { libelle: 'Achat modifié' });
  assert.equal(r2.ok, true);
  assert.equal(r2.entries[0].libelle, 'Achat modifié');
  assert.equal(r1.entries[0].libelle, 'Achat marchandises'); // original intact

  const r3 = updateEntry(r2.entries, 'e1', {
    lignes: [{ compte: '601', debit: 999, credit: 0 }] // déséquilibre l'écriture
  });
  assert.equal(r3.ok, false);
  assert.equal(r3.entries, r2.entries);

  const r4 = updateEntry(r2.entries, 'introuvable', { libelle: 'x' });
  assert.equal(r4.ok, false);
});

test('deleteEntry : immuable', () => {
  const r1 = addEntry([], { ...VOUCHER_OK, id: 'e1' });
  const r2 = addEntry(r1.entries, { ...VOUCHER_OK, id: 'e2', piece: 'AC2025-0003' });
  const next = deleteEntry(r2.entries, 'e1');
  assert.equal(next.length, 1);
  assert.equal(next[0].id, 'e2');
  assert.equal(r2.entries.length, 2);
});

test('flattenEntry / toLines : vue lignes', () => {
  const lines = toLines([{ ...VOUCHER_OK, id: 'e1' }]);
  assert.equal(lines.length, 3);
  assert.deepEqual(lines[0], {
    id: 'e1', date: '2025-01-12', journal: 'AC', piece: 'AC2025-0002',
    compte: '601', libelle: 'Achat marchandises', debit: 1000000, credit: 0
  });
});

test('fromLegacyLines : regroupe les lignes par pièce', () => {
  const legacy = [
    { d: '2025-01-12', j: 'AC', p: 'AC2025-0002', c: '601', lib: 'Achat', debit: 1000000, credit: 0 },
    { d: '2025-01-12', j: 'AC', p: 'AC2025-0002', c: '4452', lib: 'Achat', debit: 180000, credit: 0 },
    { d: '2025-01-12', j: 'AC', p: 'AC2025-0002', c: '401', lib: 'Achat', debit: 0, credit: 1180000 },
    { d: '2025-01-13', j: 'BQ', p: '', c: '521', lib: 'Dépôt', debit: 500000, credit: 0 }
  ];
  const vouchers = fromLegacyLines(legacy);
  assert.equal(vouchers.length, 2);
  assert.equal(vouchers[0].lignes.length, 3);
  assert.equal(vouchers[0].piece, 'AC2025-0002');
  assert.equal(validateEntry(vouchers[0]).ok, true);
});

test('newEntryId : format stable', () => {
  assert.ok(/^e[0-9a-z]+$/.test(newEntryId()));
});
