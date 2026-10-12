/**
 * Tests du moteur de lettrage (src/engine/lettrage.js) — node:test, zéro dépendance.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  toMouvements,
  groupByTiers,
  unlettered,
  usedLetters,
  nextLetter,
  groupBalance,
  groupTotals,
  validateLettering,
  letterEntries,
  unletterEntries,
  letterOf,
} from '../src/engine/lettrage.js';
import { addEntry } from '../src/engine/journal.js';

const E = (id, date, lignes, libelle = 'Test') => ({
  id, date, journal: 'VT', piece: 'P-' + id, libelle, lignes,
});

describe('toMouvements / groupByTiers', () => {
  it('ne groupe que les comptes de classe 4', () => {
    const entries = [
      E('e1', '2026-01-05', [{ compte: '411', debit: 1180000, credit: 0 }]),
      E('e2', '2026-01-06', [{ compte: '601', debit: 1000000, credit: 0 }]),
      E('e3', '2026-01-07', [{ compte: '401', debit: 0, credit: 500000 }]),
    ];
    const g = groupByTiers(toMouvements(entries));
    assert.deepEqual(Object.keys(g).sort(), ['401', '411']);
    assert.equal(g['411'][0].lineIndex, 0);
    assert.equal(g['411'][0].entryId, 'e1');
  });

  it('trie les mouvements par date', () => {
    const entries = [
      E('e1', '2026-03-01', [{ compte: '411', debit: 100, credit: 0 }]),
      E('e2', '2026-01-01', [{ compte: '411', debit: 0, credit: 100 }]),
    ];
    const g = groupByTiers(toMouvements(entries));
    assert.equal(g['411'][0].entryId, 'e2');
    assert.equal(g['411'][1].entryId, 'e1');
  });
});

describe('nextLetter', () => {
  it("première lettre = 'A'", () => {
    assert.equal(nextLetter([{ lettre: '' }]), 'A');
    assert.equal(nextLetter([]), 'A');
  });
  it("incrémente : A -> B, Z -> AA", () => {
    assert.equal(nextLetter([{ lettre: 'A' }]), 'B');
    assert.equal(nextLetter([{ lettre: 'A' }, { lettre: 'C' }]), 'D');
    assert.equal(nextLetter([{ lettre: 'Z' }]), 'AA');
  });
});

describe('validateLettering', () => {
  const ok2 = [
    { compte: '411', debit: 1180000, credit: 0, lettre: '' },
    { compte: '411', debit: 0, credit: 1180000, lettre: '' },
  ];
  it('accepte deux écritures qui se compensent', () => {
    const v = validateLettering(ok2);
    assert.equal(v.ok, true);
    assert.equal(v.totalDebit, 1180000);
  });
  it('refuse une seule écriture', () => {
    assert.equal(validateLettering([ok2[0]]).ok, false);
  });
  it('refuse des montants différents', () => {
    const v = validateLettering([
      { compte: '411', debit: 1000, credit: 0, lettre: '' },
      { compte: '411', debit: 0, credit: 900, lettre: '' },
    ]);
    assert.equal(v.ok, false);
    assert.match(v.errors.join(' '), /déséquilibrée/);
  });
  it('refuse des comptes différents', () => {
    const v = validateLettering([
      { compte: '411', debit: 1000, credit: 0, lettre: '' },
      { compte: '401', debit: 0, credit: 1000, lettre: '' },
    ]);
    assert.equal(v.ok, false);
  });
  it('refuse une ligne déjà lettrée', () => {
    const v = validateLettering([
      { compte: '411', debit: 1000, credit: 0, lettre: 'A' },
      { compte: '411', debit: 0, credit: 1000, lettre: '' },
    ]);
    assert.equal(v.ok, false);
  });
});

describe('letterEntries / unletterEntries', () => {
  const entries = [
    E('e1', '2026-01-05', [
      { compte: '411', debit: 1180000, credit: 0 },
      { compte: '701', debit: 0, credit: 1000000 },
      { compte: '443', debit: 0, credit: 180000 },
    ], 'Facture client'),
    E('e2', '2026-02-05', [
      { compte: '521', debit: 1180000, credit: 0 },
      { compte: '411', debit: 0, credit: 1180000 },
    ], 'Règlement client'),
  ];

  it('lettrage : deux écritures 411 qui se compensent -> solde lettré 0', () => {
    const mv = toMouvements(entries);
    const g411 = groupByTiers(mv)['411'];
    assert.equal(g411.length, 2);
    const v = validateLettering(unlettered(g411));
    assert.equal(v.ok, true);
    const L = nextLetter(g411);
    assert.equal(L, 'A');
    const next = letterEntries(entries, g411.map((m) => ({ entryId: m.entryId, lineIndex: m.lineIndex })), L);
    // immuabilité : les écritures d'origine sont intactes
    assert.equal(letterOf(toMouvements(entries)[0]), '');
    const g2 = groupByTiers(toMouvements(next))['411'];
    assert.deepEqual(usedLetters(g2), ['A']);
    assert.equal(groupBalance(g2).solde, 0);
    assert.equal(groupBalance(g2).count, 0);
    assert.equal(groupTotals(g2).count, 2);
  });

  it('délettrage : la lettre disparaît et les lignes redeviennent non lettrées', () => {
    const mv = toMouvements(entries);
    const g411 = groupByTiers(mv)['411'];
    const lettrees = letterEntries(entries, g411.map((m) => ({ entryId: m.entryId, lineIndex: m.lineIndex })), 'A');
    const { entries: delettrees, count } = unletterEntries(lettrees, '411', 'A');
    assert.equal(count, 2);
    const g3 = groupByTiers(toMouvements(delettrees))['411'];
    assert.deepEqual(usedLetters(g3), []);
    assert.equal(groupBalance(g3).count, 2);
  });

  it('délettrage sur un autre compte ne touche pas celui-ci', () => {
    const mv = toMouvements(entries);
    const g411 = groupByTiers(mv)['411'];
    const lettrees = letterEntries(entries, g411.map((m) => ({ entryId: m.entryId, lineIndex: m.lineIndex })), 'A');
    const { entries: res, count } = unletterEntries(lettrees, '401', 'A');
    assert.equal(count, 0);
    assert.deepEqual(usedLetters(groupByTiers(toMouvements(res))['411']), ['A']);
  });
});

describe('intégration journal', () => {
  it("addEntry conserve la lettre d'une ligne", () => {
    const r = addEntry([], {
      date: '2026-01-05', journal: 'VT', piece: 'VT-1', libelle: 'X',
      lignes: [
        { compte: '411', debit: 1180000, credit: 0, lettre: 'A' },
        { compte: '701', debit: 0, credit: 1000000 },
        { compte: '443', debit: 0, credit: 180000 },
      ],
    });
    assert.equal(r.ok, true);
    assert.equal(r.entries[0].lignes[0].lettre, 'A');
    assert.equal(r.entries[0].lignes[1].lettre, undefined);
  });
});
