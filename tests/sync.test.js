/**
 * Tests de la couche 100 % cloud (phase 7 — pivot SaaS, étape 4).
 *
 * - src/services/fmCloud.js : CRUD fm_entries / fm_journals / fm_settings /
 *   fm_chat avec un client PostgREST MOCKÉ (zéro réseau, zéro DOM).
 * - app/src/store.js : sans session -> CloudError AUTH (jamais de crash),
 *   et scan statique garantissant ZÉRO usage de localStorage/sessionStorage
 *   dans tout le code applicatif (SaaS strict : « RIEN ne doit être stocké
 *   en locale »).
 * - Erreurs réseau -> CloudError{code:'NETWORK', message en français}.
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CloudError, isNetworkError, CHAT_MAX,
  cloudLoadEntries, cloudSaveEntry, cloudDeleteEntry,
  cloudLoadJournals, cloudSaveJournal, cloudDeleteJournal,
  cloudGetSetting, cloudSetSetting,
  cloudLoadChat, cloudSaveChat,
} from '../src/services/fmCloud.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const UID = 'user-123';

/* ------------------------------------------------------------------ */
/* Mock PostgREST (mini-implémentation chaînable)                      */
/* ------------------------------------------------------------------ */

const KEYS = {
  fm_entries: ['user_id', 'entry_id'],
  fm_journals: ['user_id', 'code'],
  fm_chat: ['user_id'],
  fm_settings: ['user_id', 'key'],
};

function makeStore() {
  return {
    tables: { fm_entries: [], fm_journals: [], fm_chat: [], fm_settings: [] },
    // { network: true } -> rejette (fetch) | { db: {...} } -> { error }
    // { netobj: true } -> { error: { message: 'TypeError: Failed to fetch' } }
    //   (comportement réel de postgrest-js ≥ 2.117 : la panne réseau est
    //   convertie en objet { error } au lieu de lever)
    fail: null,
  };
}

function matchKey(row, keyCols, obj) {
  return keyCols.every((c) => row[c] === obj[c]);
}

class Q {
  constructor(table, store) {
    this.table = table;
    this.store = store;
    this.filters = [];
    this.mode = 'select';
    this.orderCol = null;
  }
  select() { this.mode = 'select'; return this; }
  delete() { this.mode = 'delete'; return this; }
  eq(col, val) { this.filters.push([col, val]); return this; }
  order(col) { this.orderCol = col; return this; }
  upsert(obj) {
    const { fail, tables } = this.store;
    if (fail && fail.network) return Promise.reject(new Error('Failed to fetch'));
    if (fail && fail.db) return Promise.resolve({ data: null, error: fail.db });
    if (fail && fail.netobj) {
      return Promise.resolve({
        data: null,
        error: { message: 'TypeError: Failed to fetch', details: 'TypeError: Failed to fetch', hint: '', code: '' },
      });
    }
    const rows = tables[this.table];
    const i = rows.findIndex((r) => matchKey(r, KEYS[this.table], obj));
    const row = { ...obj, updated_at: 'now' };
    if (i >= 0) rows[i] = { ...rows[i], ...row };
    else rows.push(row);
    return Promise.resolve({ data: [row], error: null });
  }
  async maybeSingle() {
    const rows = this._rows();
    const { fail } = this.store;
    if (fail && fail.network) throw new Error('Failed to fetch');
    if (fail && fail.db) return { data: null, error: fail.db };
    if (fail && fail.netobj) {
      return { data: null, error: { message: 'TypeError: Failed to fetch', details: '', hint: '', code: '' } };
    }
    return { data: rows[0] || null, error: null };
  }
  _rows() {
    let rows = this.store.tables[this.table].filter((r) =>
      this.filters.every(([c, v]) => r[c] === v));
    if (this.orderCol) {
      rows = rows.slice().sort((a, b) =>
        String(a[this.orderCol]).localeCompare(String(b[this.orderCol])));
    }
    return rows;
  }
  then(resolve, reject) {
    // Rend `await query` possible (select / delete chaînés).
    const { fail } = this.store;
    if (fail && fail.network) { reject(new Error('Failed to fetch')); return; }
    if (fail && fail.db) { resolve({ data: null, error: fail.db }); return; }
    if (fail && fail.netobj) {
      resolve({ data: null, error: { message: 'TypeError: Failed to fetch', details: '', hint: '', code: '' } });
      return;
    }
    if (this.mode === 'delete') {
      this.store.tables[this.table] = this.store.tables[this.table].filter((r) =>
        !this.filters.every(([c, v]) => r[c] === v));
      resolve({ data: [], error: null });
      return;
    }
    resolve({ data: this._rows(), error: null });
  }
}

function makeClient(store) {
  return { from: (table) => new Q(table, store) };
}

const ENTRY = {
  id: 'e1', date: '2026-01-15', journal: 'AC', piece: 'F-001',
  libelle: 'Achat marchandises',
  lignes: [{ compte: '601', debit: 100000, credit: 0 }, { compte: '401', debit: 0, credit: 100000 }],
};

/* ------------------------------------------------------------------ */
/* fm_entries                                                          */
/* ------------------------------------------------------------------ */

describe('fmCloud — écritures', () => {
  let store, client;
  beforeEach(() => { store = makeStore(); client = makeClient(store); });

  it('save puis load : l\'écriture canonique est conservée', async () => {
    await cloudSaveEntry(client, UID, ENTRY);
    const entries = await cloudLoadEntries(client, UID);
    assert.equal(entries.length, 1);
    assert.deepEqual(entries[0], ENTRY);
  });

  it('upsert sur (user_id, entry_id) : une 2e sauvegarde remplace', async () => {
    await cloudSaveEntry(client, UID, ENTRY);
    await cloudSaveEntry(client, UID, { ...ENTRY, libelle: 'Modifié' });
    const entries = await cloudLoadEntries(client, UID);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].libelle, 'Modifié');
  });

  it('deux utilisateurs ne se mélangent pas (RLS simulée)', async () => {
    await cloudSaveEntry(client, UID, ENTRY);
    await cloudSaveEntry(client, 'autre-user', { ...ENTRY, id: 'e1' });
    assert.equal((await cloudLoadEntries(client, UID)).length, 1);
    assert.equal((await cloudLoadEntries(client, 'autre-user')).length, 1);
  });

  it('deleteEntry supprime par entry_id', async () => {
    await cloudSaveEntry(client, UID, ENTRY);
    await cloudSaveEntry(client, UID, { ...ENTRY, id: 'e2' });
    await cloudDeleteEntry(client, UID, 'e1');
    const entries = await cloudLoadEntries(client, UID);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].id, 'e2');
  });

  it('saveEntry sans id -> CloudError', async () => {
    await assert.rejects(() => cloudSaveEntry(client, UID, { ...ENTRY, id: undefined }), CloudError);
  });
});

/* ------------------------------------------------------------------ */
/* fm_journals                                                         */
/* ------------------------------------------------------------------ */

describe('fmCloud — journaux', () => {
  let store, client;
  beforeEach(() => { store = makeStore(); client = makeClient(store); });

  it('save + load + delete', async () => {
    await cloudSaveJournal(client, UID, 'BQ2', 'Banque BSIC');
    await cloudSaveJournal(client, UID, 'ES2', 'Caisse boutique');
    let j = await cloudLoadJournals(client, UID);
    assert.deepEqual(j, [
      { code: 'BQ2', label: 'Banque BSIC' },
      { code: 'ES2', label: 'Caisse boutique' },
    ]);
    await cloudDeleteJournal(client, UID, 'BQ2');
    j = await cloudLoadJournals(client, UID);
    assert.deepEqual(j, [{ code: 'ES2', label: 'Caisse boutique' }]);
  });

  it('le code est normalisé en majuscules', async () => {
    await cloudSaveJournal(client, UID, 'bq2', 'Banque');
    const j = await cloudLoadJournals(client, UID);
    assert.equal(j[0].code, 'BQ2');
  });
});

/* ------------------------------------------------------------------ */
/* fm_settings + fm_chat                                               */
/* ------------------------------------------------------------------ */

describe('fmCloud — paramètres et chat', () => {
  let store, client;
  beforeEach(() => { store = makeStore(); client = makeClient(store); });

  it('getSetting retourne le fallback si absent, puis la valeur', async () => {
    assert.equal(await cloudGetSetting(client, UID, 'company', 'Mon entreprise'), 'Mon entreprise');
    await cloudSetSetting(client, UID, 'company', 'ETS Ouédraogo');
    assert.equal(await cloudGetSetting(client, UID, 'company', 'Mon entreprise'), 'ETS Ouédraogo');
  });

  it('setSetting écrase (clé métier user_id+key)', async () => {
    await cloudSetSetting(client, UID, 'country', 'BF');
    await cloudSetSetting(client, UID, 'country', 'ML');
    assert.equal(await cloudGetSetting(client, UID, 'country', null), 'ML');
  });

  it('chat : vide au départ, save remplace, 100 messages max', async () => {
    assert.deepEqual(await cloudLoadChat(client, UID), []);
    const big = Array.from({ length: 120 }, (_, i) => ({ role: 'user', text: 'm' + i }));
    await cloudSaveChat(client, UID, big);
    const back = await cloudLoadChat(client, UID);
    assert.equal(back.length, CHAT_MAX);
    assert.equal(back[0].text, 'm20');
  });
});

/* ------------------------------------------------------------------ */
/* Erreurs                                                             */
/* ------------------------------------------------------------------ */

describe('fmCloud — erreurs', () => {
  let store, client;
  beforeEach(() => { store = makeStore(); client = makeClient(store); });

  it('sans uid -> CloudError AUTH (message FR)', async () => {
    await assert.rejects(() => cloudLoadEntries(client, null), (e) => {
      assert.ok(e instanceof CloudError);
      assert.equal(e.code, 'AUTH');
      assert.match(e.message, /Reconnectez/);
      return true;
    });
  });

  it('panne réseau -> CloudError NETWORK en français', async () => {
    store.fail = { network: true };
    await assert.rejects(() => cloudLoadEntries(client, UID), (e) => {
      assert.ok(e instanceof CloudError);
      assert.equal(e.code, 'NETWORK');
      assert.match(e.message, /connexion|réseau/i);
      return true;
    });
    // upsert (non-thenable) aussi
    await assert.rejects(() => cloudSaveEntry(client, UID, ENTRY), (e) => e.code === 'NETWORK');
  });

  it('panne réseau via objet { error } (postgrest-js) -> CloudError NETWORK en français', async () => {
    store.fail = { netobj: true };
    await assert.rejects(() => cloudLoadEntries(client, UID), (e) => {
      assert.ok(e instanceof CloudError);
      assert.equal(e.code, 'NETWORK');
      assert.match(e.message, /connexion|réseau/i);
      assert.doesNotMatch(e.message, /Erreur serveur/);
      return true;
    });
  });

  it('erreur DB (table absente 42P01) -> CloudError DB explicite', async () => {
    store.fail = { db: { code: '42P01', message: 'relation "public.fm_entries" does not exist' } };
    await assert.rejects(() => cloudLoadEntries(client, UID), (e) => {
      assert.ok(e instanceof CloudError);
      assert.equal(e.code, 'DB');
      assert.match(e.message, /Réessayez/);
      return true;
    });
  });

  it('isNetworkError détecte les pannes réseau usuelles', () => {
    assert.ok(isNetworkError(new Error('Failed to fetch')));
    assert.ok(isNetworkError(new Error('NetworkError when attempting to fetch resource.')));
    assert.ok(!isNetworkError(new Error('permission denied')));
    assert.ok(!isNetworkError(null));
  });
});

/* ------------------------------------------------------------------ */
/* app/src/store.js — SaaS strict : pas de session, pas de local      */
/* ------------------------------------------------------------------ */

describe('store 100 % cloud — garde-fous SaaS', () => {
  it('sans session, chaque fonction lève CloudError AUTH (jamais de crash)', async () => {
    // import dynamique : auth.js n\'a aucune session en mémoire ici
    const store = await import('../app/src/store.js');
    const fns = [
      () => store.loadEntries(),
      () => store.saveEntry(ENTRY),
      () => store.deleteEntryById('e1'),
      () => store.loadJournaux(),
      () => store.saveJournal('BQ2', 'Banque'),
      () => store.deleteJournal('BQ2'),
      () => store.loadPeriode(),
      () => store.savePeriode({ debut: '2026-01-01', fin: '2026-12-31' }),
      () => store.loadCompany(),
      () => store.saveCompany('X'),
      () => store.loadCountry(),
      () => store.saveCountry('BF'),
      () => store.loadChat(),
      () => store.saveChat([]),
      () => store.defaultPeriode(),
    ];
    for (const fn of fns) {
      await assert.rejects(fn, (e) => {
        assert.ok(e instanceof store.CloudError, 'doit lever CloudError');
        assert.equal(e.code, 'AUTH');
        assert.match(e.message, /Reconnectez/);
        return true;
      });
    }
  });

  it('journalCodes reste une fonction pure (défauts + perso)', async () => {
    const store = await import('../app/src/store.js');
    const codes = store.journalCodes([{ code: 'bq2', label: 'Banque BSIC' }]);
    assert.equal(codes.AC, 'Achats');
    assert.equal(codes.BQ2, 'Banque BSIC');
    assert.equal(store.journalLabel(codes, 'BQ2'), 'Banque BSIC');
  });

  it('ZÉRO localStorage / sessionStorage dans tout le code applicatif (sauf fm_remember_me)', () => {
    const hits = [];
    const scan = (dir) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) {
          if (name === 'node_modules' || name === 'dist') continue;
          scan(p);
          continue;
        }
        if (!p.endsWith('.js')) continue;
        let src = readFileSync(p, 'utf8');
        src = src.replace(/\/\*[\s\S]*?\*\//g, ''); // commentaires blocs
        const lines = src.split('\n');
        lines.forEach((line, i) => {
          const code = line.split('//')[0]; // commentaires ligne
          if (/(localStorage|sessionStorage)/.test(code)) {
            // Exception autorisée : préférence "Se souvenir de moi" (simple flag,
            // jamais d'identifiant ni de mot de passe stocké).
            if (/fm_remember_me/.test(code)) return;
            hits.push(p.replace(ROOT + '/', '') + ':' + (i + 1) + ' :: ' + line.trim());
          }
        });
      }
    };
    scan(join(ROOT, 'app', 'src'));
    scan(join(ROOT, 'src'));
    assert.deepEqual(hits, [], 'Stockage local détecté :\n' + hits.join('\n'));
  });

  it('le store délègue bien à fmCloud (pas de fetch maison)', () => {
    const src = readFileSync(join(ROOT, 'app', 'src', 'store.js'), 'utf8');
    assert.match(src, /fmCloud\.js/);
    assert.match(src, /cloudLoadEntries/);
    assert.match(src, /cloudSaveEntry/);
    assert.match(src, /cloudLoadChat/);
    assert.match(src, /cloudSetSetting|cloudGetSetting/);
  });
});
