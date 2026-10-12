/**
 * Tests phase 8 — fmCloud : CRUD fm_audit / fm_immos / fm_assurances
 * avec un client PostgREST MOCKÉ (zéro réseau, zéro DOM).
 * Pattern porté de tests/sync.test.js.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CloudError,
  cloudLoadAudit, cloudSaveAudit,
  cloudLoadImmos, cloudSaveImmo, cloudDeleteImmo,
  cloudLoadAssurances, cloudSaveAssurance, cloudDeleteAssurance,
} from '../src/services/fmCloud.js';

const UID = 'user-123';

const KEYS = {
  fm_audit: ['user_id'],
  fm_immos: ['user_id', 'immo_id'],
  fm_assurances: ['user_id', 'assurance_id'],
};

function makeStore() {
  return { tables: { fm_audit: [], fm_immos: [], fm_assurances: [] } };
}

function matchKey(row, keyCols, obj) {
  return keyCols.every((c) => row[c] === obj[c]);
}

class Q {
  constructor(table, store) { this.table = table; this.store = store; this.filters = []; this.orderCol = null; }
  select() { return this; }
  delete() { this._del = true; return this; }
  eq(col, val) { this.filters.push([col, val]); return this; }
  order(col) { this.orderCol = col; return this; }
  upsert(obj) {
    const rows = this.store.tables[this.table];
    const i = rows.findIndex((r) => matchKey(r, KEYS[this.table], obj));
    if (i >= 0) rows[i] = { ...rows[i], ...obj };
    else rows.push({ ...obj });
    return Promise.resolve({ data: [obj], error: null });
  }
  async maybeSingle() {
    const rows = this._rows();
    return { data: rows[0] || null, error: null };
  }
  _rows() {
    return this.store.tables[this.table].filter((r) =>
      this.filters.every(([c, v]) => r[c] === v));
  }
  then(resolve) {
    if (this._del) {
      const t = this.store.tables[this.table];
      this.store.tables[this.table] = t.filter((r) =>
        !this.filters.every(([c, v]) => r[c] === v));
      resolve({ data: [], error: null });
      return;
    }
    let rows = this._rows();
    if (this.orderCol) rows = rows.slice().sort((a, b) => String(a[this.orderCol]).localeCompare(String(b[this.orderCol])));
    resolve({ data: rows, error: null });
  }
}

function client(store) {
  return { from: (table) => new Q(table, store) };
}

test('fm_audit : sauvegarde + chargement (vide si aucun)', async () => {
  const store = makeStore();
  const c = client(store);
  assert.deepEqual(await cloudLoadAudit(c, UID), []);
  const items = [{ id: 'a1', group: 'fisc', title: 'TVA', priority: 'high', note: '', done: true }];
  assert.ok(await cloudSaveAudit(c, UID, items));
  assert.deepEqual(await cloudLoadAudit(c, UID), items);
  // Remplacement complet
  assert.ok(await cloudSaveAudit(c, UID, []));
  assert.deepEqual(await cloudLoadAudit(c, UID), []);
});

test('fm_immos : CRUD par immo_id', async () => {
  const store = makeStore();
  const c = client(store);
  assert.deepEqual(await cloudLoadImmos(c, UID), []);
  const immo = { id: 'im1', designation: 'Véhicule', compte: '245', compteAmort: '284', valeur: 6000000, duree: 5, dateMiseEnService: '2026-03-15', booked: [] };
  assert.ok(await cloudSaveImmo(c, UID, immo));
  assert.deepEqual(await cloudLoadImmos(c, UID), [immo]);
  // Mise à jour (upsert) : dotation comptabilisée
  assert.ok(await cloudSaveImmo(c, UID, { ...immo, booked: [2026] }));
  const loaded = await cloudLoadImmos(c, UID);
  assert.equal(loaded.length, 1);
  assert.deepEqual(loaded[0].booked, [2026]);
  // Suppression
  assert.ok(await cloudDeleteImmo(c, UID, 'im1'));
  assert.deepEqual(await cloudLoadImmos(c, UID), []);
});

test('fm_assurances : CRUD par assurance_id', async () => {
  const store = makeStore();
  const c = client(store);
  assert.deepEqual(await cloudLoadAssurances(c, UID), []);
  const police = { id: 'as1', assureur: 'NSIA', numero: 'P-1', type: 'Auto', bien: '', prime: 150000, dateSouscription: '2026-01-01', dateExpiration: '2026-12-31', primes: [], sinistres: [] };
  assert.ok(await cloudSaveAssurance(c, UID, police));
  assert.deepEqual(await cloudLoadAssurances(c, UID), [police]);
  assert.ok(await cloudSaveAssurance(c, UID, { ...police, primes: [2026] }));
  assert.deepEqual((await cloudLoadAssurances(c, UID))[0].primes, [2026]);
  assert.ok(await cloudDeleteAssurance(c, UID, 'as1'));
  assert.deepEqual(await cloudLoadAssurances(c, UID), []);
});

test('sans uid -> CloudError AUTH', async () => {
  const c = client(makeStore());
  await assert.rejects(() => cloudLoadAudit(c, null), (e) => e instanceof CloudError && e.code === 'AUTH');
  await assert.rejects(() => cloudSaveImmo(c, '', { id: 'x' }), (e) => e.code === 'AUTH');
  await assert.rejects(() => cloudDeleteAssurance(c, undefined, 'x'), (e) => e.code === 'AUTH');
});

test('objet sans id -> CloudError DB', async () => {
  const c = client(makeStore());
  await assert.rejects(() => cloudSaveImmo(c, UID, {}), (e) => e.code === 'DB');
  await assert.rejects(() => cloudSaveAssurance(c, UID, { assureur: 'x' }), (e) => e.code === 'DB');
});
