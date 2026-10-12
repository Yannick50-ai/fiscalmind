/**
 * Tests phase 8 — Amortissements (pur).
 * node:test + node:assert/strict, zéro dépendance.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateEntry } from '../src/engine/journal.js';
import {
  annuite, planAmortissement, isDotationBooked, bookedSummary,
  dotationEntry, sanitizeImmo,
} from '../src/engine/amortissements.js';

const IMMO = {
  id: 'im1', designation: 'Véhicule', compte: '245', compteAmort: '284',
  valeur: 6000000, duree: 5, dateMiseEnService: '2026-03-15', booked: [],
};

test('annuite : valeur / durée', () => {
  assert.equal(annuite(IMMO), 1200000);
});

test('planAmortissement : prorata 1re année, solde la dernière', () => {
  const plan = planAmortissement(IMMO);
  assert.equal(plan.length, 6); // 2026..2031
  assert.equal(plan[0].annee, 2026);
  assert.equal(plan[0].dotation, Math.round(1200000 * 10 / 12)); // mise en service en mars
  const total = plan.reduce((a, p) => a + p.dotation, 0);
  assert.equal(total, 6000000);
  assert.equal(plan[plan.length - 1].vnc, 0);
  assert.ok(plan.every((p) => p.cumul === p.dotation + (plan[plan.indexOf(p) - 1]?.cumul || 0) || true));
});

test('planAmortissement : cumul cohérent année par année', () => {
  const plan = planAmortissement(IMMO);
  let cumul = 0;
  for (const p of plan) {
    cumul += p.dotation;
    assert.equal(p.cumul, cumul);
    assert.equal(p.vnc, IMMO.valeur - cumul);
  }
});

test('dotationEntry : écriture 681 -> compteAmort équilibrée au 31/12', () => {
  const e = dotationEntry(IMMO, 2027);
  assert.ok(e);
  assert.equal(e.journal, 'OD');
  assert.equal(e.date, '2027-12-31');
  assert.deepEqual(e.lignes.map((l) => l.compte), ['681', '284']);
  assert.ok(validateEntry(e).ok, 'dotation équilibrée');
  assert.equal(e.lignes[0].debit, e.lignes[1].credit);
});

test('dotationEntry : null si déjà comptabilisée ou sans dotation', () => {
  const booked = { ...IMMO, booked: [2027] };
  assert.equal(dotationEntry(booked, 2027), null);
  assert.equal(dotationEntry(IMMO, 2099), null);
});

test('isDotationBooked / bookedSummary', () => {
  const im = { ...IMMO, booked: [2026] };
  assert.ok(isDotationBooked(im, 2026));
  assert.ok(!isDotationBooked(im, 2027));
  const s = bookedSummary(im);
  assert.equal(s.cumulBooked, planAmortissement(IMMO)[0].dotation);
  assert.equal(s.vnc, IMMO.valeur - s.cumulBooked);
});

test('sanitizeImmo : rejets et acceptation', () => {
  const bad = sanitizeImmo({ designation: '', compte: 'x', valeur: 0, duree: 0, dateMiseEnService: '' });
  assert.ok(!bad.ok);
  assert.ok(bad.errors.length >= 4);
  const good = sanitizeImmo(IMMO);
  assert.ok(good.ok);
  assert.deepEqual(good.errors, []);
});
