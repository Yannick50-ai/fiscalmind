/**
 * Tests phase 8 — Assurances (pur).
 * node:test + node:assert/strict, zéro dépendance.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateEntry } from '../src/engine/journal.js';
import {
  joursRestants, statutAssurance, policesUrgentes, sortByExpiration,
  isPrimePayee, primeEntry, sanitizePolice, sanitizeSinistre,
} from '../src/engine/assurances.js';

const TODAY = '2026-10-08';
const POLICE = {
  id: 'as1', assureur: 'NSIA', numero: 'P-123', type: 'Multirisque', bien: 'Bureau',
  prime: 250000, dateSouscription: '2026-01-01', dateExpiration: '2026-11-20',
  primes: [], sinistres: [],
};

test('joursRestants : positif, nul, négatif', () => {
  assert.equal(joursRestants('2026-11-20', TODAY), 43);
  assert.equal(joursRestants('2026-10-08', TODAY), 0);
  assert.equal(joursRestants('2026-10-01', TODAY), -7);
});

test('statutAssurance : tons danger/warn/ok', () => {
  assert.equal(statutAssurance({ dateExpiration: '2026-10-20' }, TODAY).tone, 'danger');
  assert.equal(statutAssurance({ dateExpiration: '2026-10-01' }, TODAY).tone, 'danger');
  assert.equal(statutAssurance({ dateExpiration: '2026-12-01' }, TODAY).tone, 'warn');
  assert.equal(statutAssurance({ dateExpiration: '2027-06-01' }, TODAY).tone, 'ok');
});

test('policesUrgentes : <= 60 jours dont expirées', () => {
  const list = [
    { ...POLICE, id: 'a', dateExpiration: '2026-11-20' },
    { ...POLICE, id: 'b', dateExpiration: '2027-06-01' },
    { ...POLICE, id: 'c', dateExpiration: '2026-09-01' },
  ];
  const urg = policesUrgentes(list, TODAY);
  assert.deepEqual(urg.map((p) => p.id).sort(), ['a', 'c']);
});

test('sortByExpiration : croissant', () => {
  const sorted = sortByExpiration([
    { ...POLICE, id: 'b', dateExpiration: '2027-01-01' },
    { ...POLICE, id: 'a', dateExpiration: '2026-11-20' },
  ]);
  assert.deepEqual(sorted.map((p) => p.id), ['a', 'b']);
});

test('primeEntry : écriture 625 -> 521 équilibrée, journal BQ', () => {
  const e = primeEntry(POLICE, 2026, '2026-10-08');
  assert.ok(e);
  assert.equal(e.journal, 'BQ');
  assert.deepEqual(e.lignes.map((l) => l.compte), ['625', '521']);
  assert.equal(e.lignes[0].debit, 250000);
  assert.ok(validateEntry(e).ok, 'prime équilibrée');
});

test('primeEntry : null si déjà payée ou prime nulle', () => {
  assert.equal(primeEntry({ ...POLICE, primes: [2026] }, 2026), null);
  assert.equal(primeEntry({ ...POLICE, prime: 0 }, 2026), null);
});

test('sanitizePolice / sanitizeSinistre', () => {
  const bad = sanitizePolice({ assureur: '', numero: '', prime: 0, dateSouscription: '', dateExpiration: '' });
  assert.ok(!bad.ok && bad.errors.length >= 4);
  assert.ok(sanitizePolice(POLICE).ok);
  const snBad = sanitizeSinistre({ description: '', date: '' });
  assert.ok(!snBad.ok);
  const sn = sanitizeSinistre({ description: 'Dégât des eaux', date: '2026-09-01', statut: 'En cours', reclame: 100000 });
  assert.ok(sn.ok);
  assert.equal(sn.sinistre.reclame, 100000);
  assert.equal(sn.sinistre.statut, 'En cours');
});
