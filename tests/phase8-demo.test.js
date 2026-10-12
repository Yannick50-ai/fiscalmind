/**
 * Tests phase 8 — Données de démo 2024–2025 (section Configuration).
 * node:test + node:assert/strict, zéro dépendance.
 *
 * - Le JSON embarqué (app/public/demo-data-2024-2025.json) contient 2
 *   écritures d'à-nouveaux valides et équilibrées (validateEntry).
 * - Insertion idempotente : deux chargements -> une seule ligne par
 *   entry_id (upsert sur (user_id, entry_id)).
 * - Suppression par entry_id.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateEntry } from '../src/engine/journal.js';
import {
  cloudSaveEntry, cloudDeleteEntry,
} from '../src/services/fmCloud.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEMO_IDS = ['demo-an-2024', 'demo-an-2025'];

function loadDemoJson() {
  const raw = readFileSync(join(ROOT, 'app', 'public', 'demo-data-2024-2025.json'), 'utf8');
  return JSON.parse(raw);
}

/* Mini-mock PostgREST (pattern de tests/sync.test.js, table fm_entries). */
function makeClient() {
  const rows = [];
  const q = {
    filters: [],
    select() { return this; },
    delete() { this._del = true; return this; },
    eq(col, val) { this.filters.push([col, val]); return this; },
    order() { return this; },
    upsert(obj) {
      const i = rows.findIndex((r) => r.user_id === obj.user_id && r.entry_id === obj.entry_id);
      if (i >= 0) rows[i] = { ...rows[i], ...obj };
      else rows.push({ ...obj });
      return Promise.resolve({ data: [obj], error: null });
    },
    then(resolve) {
      if (this._del) {
        for (let i = rows.length - 1; i >= 0; i--) {
          if (this.filters.every(([c, v]) => rows[i][c] === v)) rows.splice(i, 1);
        }
        resolve({ data: [], error: null });
        return;
      }
      resolve({ data: rows.filter((r) => this.filters.every(([c, v]) => r[c] === v)), error: null });
    },
  };
  return { client: { from: () => Object.create(q, { filters: { value: [], writable: true }, _del: { value: false, writable: true } }) }, rows };
}

test('demo JSON : 2 écritures AN valides et équilibrées', () => {
  const data = loadDemoJson();
  assert.ok(Array.isArray(data.ecritures), 'clé ecritures présente');
  assert.equal(data.ecritures.length, 2);
  for (const e of data.ecritures) {
    assert.ok(DEMO_IDS.includes(e.id), 'id attendu : ' + e.id);
    assert.equal(e.journal, 'AN');
    const v = validateEntry(e);
    assert.ok(v.ok, e.id + ' valide : ' + v.errors.join('; '));
    const td = e.lignes.reduce((a, l) => a + l.debit, 0);
    const tc = e.lignes.reduce((a, l) => a + l.credit, 0);
    assert.equal(td, tc, e.id + ' équilibrée');
    assert.ok(e.lignes.length >= 70, e.id + ' : ' + e.lignes.length + ' lignes');
  }
});

test('chargement idempotent : 2 chargements -> 2 lignes uniques', async () => {
  const { client, rows } = makeClient();
  const data = loadDemoJson();
  for (let round = 0; round < 2; round++) {
    for (const e of data.ecritures) await cloudSaveEntry(client, 'uid-demo', e);
  }
  assert.equal(rows.length, 2, 'une ligne par entry_id malgré 2 chargements');
  assert.deepEqual(rows.map((r) => r.entry_id).sort(), DEMO_IDS);
});

test('suppression par entry_id', async () => {
  const { client, rows } = makeClient();
  const data = loadDemoJson();
  for (const e of data.ecritures) await cloudSaveEntry(client, 'uid-demo', e);
  assert.equal(rows.length, 2);
  await cloudDeleteEntry(client, 'uid-demo', 'demo-an-2024');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].entry_id, 'demo-an-2025');
  await cloudDeleteEntry(client, 'uid-demo', 'demo-an-2025');
  assert.equal(rows.length, 0);
});
