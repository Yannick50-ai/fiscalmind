/**
 * Tests de src/engine/notes.js (notes annexes OHADA 1–36) — node:test, zéro dépendance.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  notesAnnexes, variationPct, NOTES_TITRES, manualSettingKey, fmtVarPct,
} from '../src/engine/notes.js';

const E = (id, date, lignes, journal = 'OD') => ({
  id, date, journal, piece: 'P-' + id, libelle: 'Test', lignes,
});
const L = (compte, debit, credit) => ({ compte, debit, credit });

function getNote(res, numero) {
  const n = res.notes.find((x) => x.numero === numero);
  assert.ok(n, 'note ' + numero + ' présente');
  return n;
}
function row(note, compte) {
  const r = note.lignes.find((l) => l.compte === compte);
  assert.ok(r, 'ligne ' + compte + ' présente dans la note ' + note.numero);
  return r;
}

describe('notesAnnexes — structure générale', () => {
  it('46 notes dans l’ordre officiel, année invalide rejetée', () => {
    const res = notesAnnexes([], { year: 2025 });
    assert.equal(res.year, 2025);
    assert.equal(res.notes.length, 46);
    const nums = res.notes.map((n) => n.numero);
    assert.deepEqual(nums.slice(0, 7), ['1', '2', '3A', '3B', '3C', '3D', '3E']);
    assert.deepEqual(nums.slice(-3), ['34', '35', '36']);
    assert.ok(nums.includes('15A') && nums.includes('16B') && nums.includes('27B'));
    assert.throws(() => notesAnnexes([], { year: 'xx' }), /année/);
  });

  it('NOTES_TITRES : 46 entrées avec statut calculee/manuelle', () => {
    assert.equal(NOTES_TITRES.length, 46);
    const m1 = NOTES_TITRES.find((t) => t.numero === '1');
    assert.equal(m1.statut, 'manuelle');
    const c3a = NOTES_TITRES.find((t) => t.numero === '3A');
    assert.equal(c3a.statut, 'calculee');
    assert.ok(c3a.titre.length > 3);
  });

  it('manualSettingKey : notes_man_<n>', () => {
    assert.equal(manualSettingKey('1'), 'notes_man_1');
    assert.equal(manualSettingKey('27B'), 'notes_man_27B');
  });
});

describe('note 3A — immobilisations brutes (acquisition puis cession partielle)', () => {
  // 2024 : acquisition 500 000 (S.I. 2025) ; 2025 : +300 000, cession 100 000.
  const entries = [
    E('a1', '2024-06-01', [L('244', 500000, 0), L('521', 0, 500000)]),
    E('a2', '2025-03-01', [L('244', 300000, 0), L('521', 0, 300000)]),
    E('a3', '2025-09-01', [L('521', 100000, 0), L('244', 0, 100000)]),
  ];
  it('ouverture / acquisitions / cessions / clôture sur le poste 24', () => {
    const n = getNote(notesAnnexes(entries, { year: 2025 }), '3A');
    assert.equal(n.type, 'mouvements');
    assert.deepEqual(n.colonnes, ['Rubrique', 'Ouverture', 'Acquisitions', 'Cessions', 'Clôture']);
    const r = row(n, '24');
    assert.equal(r.ouverture, 500000);
    assert.equal(r.plus, 300000);
    assert.equal(r.moins, 100000);
    assert.equal(r.cloture, 700000); // 500 000 + 300 000 − 100 000
  });

  it('ligne TOTAL = somme des postes', () => {
    const n = getNote(notesAnnexes(entries, { year: 2025 }), '3A');
    const t = n.lignes.find((l) => l.isTotal);
    assert.equal(t.ouverture, 500000);
    assert.equal(t.plus, 300000);
    assert.equal(t.moins, 100000);
    assert.equal(t.cloture, 700000);
  });

  it('sans N-1 : ouverture à zéro, clôture = acquisitions − cessions', () => {
    const n = getNote(notesAnnexes(entries, { year: 2024 }), '3A');
    const r = row(n, '24');
    assert.equal(r.ouverture, 0);
    assert.equal(r.plus, 500000);
    assert.equal(r.cloture, 500000);
  });
});

describe('note 3C — amortissements (dotations)', () => {
  const entries = [
    E('d1', '2024-12-01', [L('681', 50000, 0), L('281', 0, 50000)]),
    E('d2', '2025-12-01', [L('681', 60000, 0), L('281', 0, 60000)]),
  ];
  it('ouverture créditrice, dotations au crédit, clôture = ouv + dot', () => {
    const n = getNote(notesAnnexes(entries, { year: 2025 }), '3C');
    assert.deepEqual(n.colonnes, ['Rubrique', 'Ouverture', 'Dotations', 'Sorties', 'Clôture']);
    const r = row(n, '28');
    assert.equal(r.ouverture, 50000);
    assert.equal(r.plus, 60000);
    assert.equal(r.moins, 0);
    assert.equal(r.cloture, 110000);
  });
});

describe('note 28 — provisions (pattern S.I./MOUV. sur 19/29/39/49/59/69)', () => {
  const entries = [
    E('p1', '2024-11-01', [L('691', 20000, 0), L('191', 0, 20000)]), // provision 2024
    E('p2', '2025-05-01', [L('659', 15000, 0), L('591', 0, 15000)]), // dépréciation 2025
    E('p3', '2025-10-01', [L('191', 5000, 0), L('791', 0, 5000)]),   // reprise 2025
  ];
  it('19 : ouverture 20 000, reprise 5 000, clôture 15 000', () => {
    const n = getNote(notesAnnexes(entries, { year: 2025 }), '28');
    assert.deepEqual(n.colonnes, ['Rubrique', 'Ouverture', 'Dotations', 'Reprises', 'Clôture']);
    const r = row(n, '19');
    assert.equal(r.ouverture, 20000);
    assert.equal(r.plus, 0);
    assert.equal(r.moins, 5000);
    assert.equal(r.cloture, 15000);
  });

  it('59 : dotation N au crédit, sans ouverture', () => {
    const n = getNote(notesAnnexes(entries, { year: 2025 }), '28');
    const r = row(n, '59');
    assert.equal(r.ouverture, 0);
    assert.equal(r.plus, 15000);
    assert.equal(r.cloture, 15000);
  });

  it('69 (charge) : dotation au débit des mouvements', () => {
    // La dotation 691 est en 2024 : en N=2025, aucun mouvement → zéros.
    const n = getNote(notesAnnexes(entries, { year: 2025 }), '28');
    const r = row(n, '69');
    assert.equal(r.plus, 0);
    assert.equal(r.cloture, 0);
    // En N=2024, la dotation apparaît au débit des mouvements.
    const n24 = getNote(notesAnnexes(entries, { year: 2024 }), '28');
    const r24 = row(n24, '69');
    assert.equal(r24.plus, 20000);
    assert.equal(r24.moins, 0);
    assert.equal(r24.cloture, 20000);
  });
});

describe('notes de soldes N / N-1 + variation %', () => {
  const entries = [
    E('s1', '2024-04-01', [L('411', 100000, 0), L('701', 0, 100000)]),
    E('s2', '2025-04-01', [L('411', 150000, 0), L('701', 0, 150000)]),
    E('s3', '2025-04-02', [L('521', 80000, 0), L('411', 0, 80000)]),
  ];

  it('note 7 (clients, cumul) : N, N-1 et variation %', () => {
    const n = getNote(notesAnnexes(entries, { year: 2025 }), '7');
    assert.equal(n.type, 'soldes');
    assert.deepEqual(n.colonnes, ['Rubrique', 'N', 'N-1', 'Variation %']);
    const r = row(n, '411');
    assert.equal(r.n, 170000);  // 100 000 + 150 000 − 80 000
    assert.equal(r.n1, 100000);
    assert.equal(r.varPct, 70); // (170 000 − 100 000) / 100 000
  });

  it('note 21 (CA, mouvements) : 701 N=150 000, N-1=100 000, +50 %', () => {
    const n = getNote(notesAnnexes(entries, { year: 2025 }), '21');
    const r = row(n, '701');
    assert.equal(r.n, 150000);
    assert.equal(r.n1, 100000);
    assert.equal(r.varPct, 50);
    const t = n.lignes.find((l) => l.isTotal);
    assert.equal(t.n, 150000);
    assert.equal(t.varPct, 50);
  });

  it('variation % : N-1 = 0 → null (non calculable)', () => {
    assert.equal(variationPct(100, 0), null);
    assert.equal(variationPct(0, 0), null);
    assert.equal(variationPct(150, 100), 50);
    assert.equal(variationPct(70, 100), -30);
  });

  it('fmtVarPct : format français', () => {
    assert.equal(fmtVarPct(50), '+50,0 %');
    assert.equal(fmtVarPct(-30), '-30,0 %');
    assert.equal(fmtVarPct(null), '—');
  });

  it('note 11 (disponibilités) : 521 en valeur absolue', () => {
    const n = getNote(notesAnnexes(entries, { year: 2025 }), '11');
    const r = row(n, '52');
    assert.equal(r.n, 80000); // s3 : D 521 80 000
    assert.equal(r.n1, 0);
    assert.equal(r.varPct, null); // N-1 = 0 → non calculable
  });
});

describe('note 34 — synthèse des SIG', () => {
  it('lignes SIG avec N / N-1 / variation %', () => {
    const entries = [
      E('c1', '2025-03-01', [L('411', 1000000, 0), L('701', 0, 1000000)]),
      E('c2', '2024-03-01', [L('411', 500000, 0), L('701', 0, 500000)]),
    ];
    const n = getNote(notesAnnexes(entries, { year: 2025 }), '34');
    assert.equal(n.type, 'soldes');
    const xb = n.lignes.find((l) => l.compte === 'XB');
    assert.ok(xb, 'SIG XB présent');
    assert.equal(xb.n, 1000000);
    assert.equal(xb.n1, 500000);
    assert.equal(xb.varPct, 100);
    const refs = n.lignes.map((l) => l.compte);
    assert.ok(refs.includes('XI'), 'résultat net XI présent');
  });
});

describe('notes manuelles — données injectées', () => {
  it('note 1 : le texte injecté remplit le formulaire', () => {
    const res = notesAnnexes([], {
      year: 2025,
      manuelles: { 1: { texte: 'Coût historique.' }, '27B': { effectif_moyen: '12' } },
    });
    const n1 = getNote(res, '1');
    assert.equal(n1.type, 'manuelle');
    assert.equal(n1.statut, 'manuelle');
    assert.deepEqual(n1.lignes, []);
    assert.equal(n1.formulaire.length, 1);
    assert.equal(n1.formulaire[0].key, 'texte');
    assert.equal(n1.formulaire[0].value, 'Coût historique.');

    const n27b = getNote(res, '27B');
    assert.equal(n27b.formulaire.length, 3);
    assert.equal(n27b.formulaire[0].value, '12');
    assert.equal(n27b.formulaire[1].value, ''); // non renseigné → ''
  });

  it('note 16B : trois champs d’échéancier', () => {
    const res = notesAnnexes([], { year: 2025, manuelles: { '16B': { moins_1an: '500000' } } });
    const n = getNote(res, '16B');
    assert.equal(n.formulaire.length, 3);
    assert.equal(n.formulaire[0].key, 'moins_1an');
    assert.equal(n.formulaire[0].value, '500000');
  });

  it('sans manuelles : formulaire vide, pas de crash', () => {
    const res = notesAnnexes([], { year: 2025 });
    const n = getNote(res, '35');
    assert.equal(n.formulaire[0].value, '');
  });
});

describe('notes 29/30 — totaux nets produits − charges', () => {
  it('note 29 : résultat financier = revenus − charges', () => {
    const entries = [
      E('f1', '2025-02-01', [L('671', 30000, 0), L('521', 0, 30000)]),
      E('f2', '2025-02-02', [L('521', 50000, 0), L('771', 0, 50000)]),
    ];
    const n = getNote(notesAnnexes(entries, { year: 2025 }), '29');
    const t = n.lignes.find((l) => l.isTotal);
    assert.equal(t.label, 'RÉSULTAT FINANCIER');
    assert.equal(t.n, 20000); // 50 000 − 30 000
  });

  it('note 30 : résultat HAO = produits − charges', () => {
    const entries = [
      E('h1', '2025-02-01', [L('831', 10000, 0), L('521', 0, 10000)]),
      E('h2', '2025-02-02', [L('521', 40000, 0), L('841', 0, 40000)]),
    ];
    const n = getNote(notesAnnexes(entries, { year: 2025 }), '30');
    const t = n.lignes.find((l) => l.isTotal);
    assert.equal(t.label, 'RÉSULTAT HAO');
    assert.equal(t.n, 30000);
  });
});

describe('données vides — structure intacte', () => {
  it('toutes les notes calculées existent avec des zéros', () => {
    const res = notesAnnexes([], { year: 2025 });
    for (const num of ['3A', '3C', '4', '6', '7', '11', '13', '16A', '17', '18', '21', '28', '34']) {
      const n = getNote(res, num);
      assert.ok(n.lignes.length > 0, 'note ' + num + ' a des lignes');
    }
    const n34 = getNote(res, '34');
    assert.ok(n34.lignes.length >= 9, 'SIG présents même sans données');
  });
});
