/**
 * Tests du moteur de tableau de bord (src/engine/dashboard.js).
 * Scénario : 6 écritures sur 3 mois (capital, achat, vente, salaires, vente, loyer).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  kpis, monthlySeries, chargesBreakdown, treasuryCurve, upcomingDeadlines, lastDayOfMonth,
  marge, bfr, chargesPersonnel, topClients, topFournisseurs, dsoDpo, comparatif, alertesDashboard,
} from '../src/engine/dashboard.js';
import { letterEntries } from '../src/engine/lettrage.js';
import { toMouvements, groupByTiers } from '../src/engine/lettrage.js';

const Y = '2026';
function seed() {
  return [
    { id: 'e1', date: Y + '-01-05', journal: 'OD', piece: 'OD-001', libelle: 'Apport en capital',
      lignes: [{ compte: '101', debit: 0, credit: 5000000 }, { compte: '521', debit: 5000000, credit: 0 }] },
    { id: 'e2', date: Y + '-01-12', journal: 'AC', piece: 'AC-001', libelle: 'Achat marchandises',
      lignes: [{ compte: '601', debit: 1000000, credit: 0 }, { compte: '4452', debit: 180000, credit: 0 }, { compte: '401', debit: 0, credit: 1180000 }] },
    { id: 'e3', date: Y + '-02-10', journal: 'VT', piece: 'VT-001', libelle: 'Vente marchandises',
      lignes: [{ compte: '411', debit: 2360000, credit: 0 }, { compte: '701', debit: 0, credit: 2000000 }, { compte: '443', debit: 0, credit: 360000 }] },
    { id: 'e4', date: Y + '-02-28', journal: 'PA', piece: 'PA-001', libelle: 'Salaires février',
      lignes: [{ compte: '6611', debit: 900000, credit: 0 }, { compte: '422', debit: 0, credit: 900000 }] },
    { id: 'e5', date: Y + '-03-15', journal: 'VT', piece: 'VT-002', libelle: 'Vente mars',
      lignes: [{ compte: '411', debit: 1180000, credit: 0 }, { compte: '701', debit: 0, credit: 1000000 }, { compte: '443', debit: 0, credit: 180000 }] },
    { id: 'e6', date: Y + '-03-20', journal: 'OD', piece: 'OD-002', libelle: 'Loyer mars',
      lignes: [{ compte: '622', debit: 300000, credit: 0 }, { compte: '401', debit: 0, credit: 300000 }] },
  ];
}
const PER = { from: Y + '-01-01', to: Y + '-12-31' };

test('kpis : CA, résultat net, trésorerie, TVA', () => {
  const k = kpis(seed(), PER);
  assert.equal(k.ca, 3000000);
  assert.equal(k.resNet, 800000); // 3 000 000 − (1 000 000 + 900 000 + 300 000)
  assert.equal(k.tresorerie, 5000000);
  assert.equal(k.tva, 360000); // (360 000 + 180 000) − 180 000
  assert.equal(k.balanceOk, true);
  assert.equal(k.nbEcritures, 6);
});

test('kpis : créances clients et dettes fournisseurs non lettrées', () => {
  const k = kpis(seed(), PER);
  assert.equal(k.creancesClients, 3540000); // 2 360 000 + 1 180 000
  assert.equal(k.dettesFournisseurs, 1480000); // 1 180 000 + 300 000
});

test('kpis : les lignes lettrées sont exclues des créances', () => {
  const mv = toMouvements(seed());
  const g411 = groupByTiers(mv)['411'];
  const refs = g411.filter((m) => m.entryId === 'e3').map((m) => ({ entryId: m.entryId, lineIndex: m.lineIndex }));
  const lettrees = letterEntries(seed(), refs, 'A');
  const k = kpis(lettrees, PER);
  assert.equal(k.creancesClients, 1180000); // seule la vente de mars reste
});

test('kpis : TVA négative = crédit de TVA', () => {
  const entries = [
    { id: 'e1', date: Y + '-01-10', journal: 'AC', piece: 'AC-001', libelle: 'Achat',
      lignes: [{ compte: '601', debit: 1000000, credit: 0 }, { compte: '4452', debit: 180000, credit: 0 }, { compte: '401', debit: 0, credit: 1180000 }] },
  ];
  const k = kpis(entries, PER);
  assert.equal(k.tva, -180000);
});

test('kpis : journal vide', () => {
  const k = kpis([], PER);
  assert.deepEqual([k.ca, k.resNet, k.tresorerie, k.tva, k.nbEcritures], [0, 0, 0, 0, 0]);
  assert.equal(k.balanceOk, true);
});

test('monthlySeries : CA et charges par mois', () => {
  const s = monthlySeries(seed(), Y);
  assert.equal(s.length, 12);
  assert.deepEqual([s[0].ca, s[0].charges], [0, 1000000]);
  assert.deepEqual([s[1].ca, s[1].charges], [2000000, 900000]);
  assert.deepEqual([s[2].ca, s[2].charges], [1000000, 300000]);
  assert.deepEqual([s[3].ca, s[3].charges], [0, 0]);
  assert.equal(s[0].mois, 1);
});

test('chargesBreakdown : répartition par nature, triée', () => {
  const b = chargesBreakdown(seed(), PER);
  assert.deepEqual(b.map((g) => g.key), ['achats', 'personnel', 'externes']);
  assert.equal(b[0].montant, 1000000);
  assert.equal(b[1].montant, 900000);
  assert.equal(b[2].montant, 300000);
  assert.ok(b.every((g) => g.montant > 0));
});

test('treasuryCurve : trésorerie cumulée par mois', () => {
  const c = treasuryCurve(seed(), Y);
  assert.equal(c.length, 12);
  assert.ok(c.every((p) => p.montant === 5000000)); // seul l'apport en capital bouge la banque
});

test('lastDayOfMonth : février et mois à 30/31 jours', () => {
  assert.equal(lastDayOfMonth('2026', 2), '2026-02-28');
  assert.equal(lastDayOfMonth('2024', 2), '2024-02-29'); // bissextile
  assert.equal(lastDayOfMonth('2026', 4), '2026-04-30');
  assert.equal(lastDayOfMonth('2026', 12), '2026-12-31');
});

test('upcomingDeadlines : échéances < 30 j', () => {
  const cal = [
    { mois: 1, jour: 15, label: 'Acompte IS', impot: 'IS', periodicite: 'Trimestrielle' },
    { mois: 6, jour: 10, label: 'IUTS', impot: 'SAL', periodicite: 'Mensuelle' },
  ];
  const r = upcomingDeadlines(cal, '2026-01-01', 30);
  assert.equal(r.length, 1);
  assert.equal(r[0].label, 'Acompte IS');
  assert.equal(r[0].dateISO, '2026-01-15');
  assert.equal(r[0].daysLeft, 14);
});

test('upcomingDeadlines : bascule sur l’année suivante', () => {
  const cal = [{ mois: 1, jour: 15, label: 'Acompte IS', impot: 'IS', periodicite: 'Trimestrielle' }];
  const r = upcomingDeadlines(cal, '2026-01-20', 400);
  assert.equal(r.length, 1);
  assert.equal(r[0].dateISO, '2027-01-15');
});

test('upcomingDeadlines : jour clampé en fin de mois', () => {
  const cal = [{ mois: 2, jour: 30, label: 'X', impot: 'IS', periodicite: 'M' }];
  const r = upcomingDeadlines(cal, '2026-02-01', 30);
  assert.equal(r[0].dateISO, '2026-02-28');
});

test('upcomingDeadlines : date invalide -> []', () => {
  assert.deepEqual(upcomingDeadlines([{ mois: 3, jour: 10 }], 'pas-une-date'), []);
  assert.deepEqual(upcomingDeadlines(null, '2026-01-01'), []);
});

/* ---------------- Volet 2 ---------------- */

test('marge : marge brute et taux (CA 3 000 000, achats 601 1 000 000)', () => {
  const m = marge(seed(), PER);
  assert.equal(m.ca, 3000000);
  assert.equal(m.achats, 1000000);
  assert.equal(m.margeBrute, 2000000);
  assert.equal(m.tauxMarge, 66.7); // 2 000 000 / 3 000 000 * 100
});

test('marge : les transports 61x ne sont pas des achats consommés', () => {
  const entries = [
    { id: 'e1', date: Y + '-01-10', journal: 'VT', piece: 'VT-001', libelle: 'Vente',
      lignes: [{ compte: '411', debit: 1180000, credit: 0 }, { compte: '701', debit: 0, credit: 1000000 }] },
    { id: 'e2', date: Y + '-01-11', journal: 'AC', piece: 'AC-001', libelle: 'Transport achats',
      lignes: [{ compte: '611', debit: 200000, credit: 0 }, { compte: '401', debit: 0, credit: 200000 }] },
  ];
  const m = marge(entries, PER);
  assert.equal(m.achats, 0); // 611 exclu
  assert.equal(m.margeBrute, 1000000);
});

test('marge : CA = 0 -> taux 0, marge = -achats', () => {
  const entries = [
    { id: 'e1', date: Y + '-01-10', journal: 'AC', piece: 'AC-001', libelle: 'Achat',
      lignes: [{ compte: '601', debit: 1000000, credit: 0 }, { compte: '401', debit: 0, credit: 1000000 }] },
  ];
  const m = marge(entries, PER);
  assert.equal(m.ca, 0);
  assert.equal(m.margeBrute, -1000000);
  assert.equal(m.tauxMarge, 0);
});

test('marge : journal vide', () => {
  assert.deepEqual(marge([], PER), { margeBrute: 0, tauxMarge: 0, ca: 0, achats: 0 });
});

test('kpis : intègre margeBrute et tauxMarge', () => {
  const k = kpis(seed(), PER);
  assert.equal(k.margeBrute, 2000000);
  assert.equal(k.tauxMarge, 66.7);
});

test('bfr : actif circulant − passif circulant en cumulé', () => {
  const b = bfr(seed(), { to: Y + '-12-31' });
  // AC = créances 3 540 000 (stocks 0, 44 débiteur net 0, 47 débiteur net 0)
  assert.equal(b.actifCirculant, 3540000);
  // PC = 401 : 1 480 000 + 422 : 900 000 + 44 créditeur net : 360 000
  assert.equal(b.passifCirculant, 2740000);
  assert.equal(b.bfr, 800000);
});

test('bfr : stocks et 47 débiteur/créditeur netés', () => {
  const entries = [
    { id: 'e1', date: Y + '-01-05', journal: 'OD', piece: 'OD-001', libelle: 'Stock initial',
      lignes: [{ compte: '311', debit: 500000, credit: 0 }, { compte: '101', debit: 0, credit: 500000 }] },
    { id: 'e2', date: Y + '-02-10', journal: 'OD', piece: 'OD-002', libelle: 'Avance divers',
      lignes: [{ compte: '471', debit: 120000, credit: 0 }, { compte: '521', debit: 0, credit: 120000 }] },
    { id: 'e3', date: Y + '-03-10', journal: 'OD', piece: 'OD-003', libelle: 'Dette divers',
      lignes: [{ compte: '521', debit: 80000, credit: 0 }, { compte: '472', debit: 0, credit: 80000 }] },
  ];
  const b = bfr(entries, { to: Y + '-12-31' });
  assert.equal(b.actifCirculant, 540000); // 500 000 + max(120 000 − 80 000, 0) neté au préfixe 47
  assert.equal(b.passifCirculant, 0); // 47 net = +40 000 débiteur → rien au passif
  assert.equal(b.bfr, 540000);
});

test('bfr : journal vide', () => {
  assert.deepEqual(bfr([], { to: Y + '-12-31' }), { actifCirculant: 0, passifCirculant: 0, bfr: 0 });
});

test('chargesPersonnel : soldes débiteurs des 66', () => {
  assert.equal(chargesPersonnel(seed(), PER), 900000);
  assert.equal(chargesPersonnel([], PER), 0);
});

test('topClients : créances non lettrées par compte, tri décroissant', () => {
  const t = topClients(seed(), PER);
  assert.deepEqual(t, [{ label: '411', montant: 3540000 }]);
});

test('topClients : regroupement par auxiliaire quand présent', () => {
  const entries = [
    { id: 'e1', date: Y + '-01-10', journal: 'VT', piece: 'VT-001', libelle: 'Vente A',
      lignes: [{ compte: '411', debit: 500000, credit: 0, auxiliaire: 'CLI-ALPHA' }, { compte: '701', debit: 0, credit: 500000 }] },
    { id: 'e2', date: Y + '-02-10', journal: 'VT', piece: 'VT-002', libelle: 'Vente B',
      lignes: [{ compte: '411', debit: 900000, credit: 0, auxiliaire: 'CLI-BETA' }, { compte: '701', debit: 0, credit: 900000 }] },
    { id: 'e3', date: Y + '-03-10', journal: 'VT', piece: 'VT-003', libelle: 'Vente A2',
      lignes: [{ compte: '411', debit: 300000, credit: 0, auxiliaire: 'CLI-ALPHA' }, { compte: '701', debit: 0, credit: 300000 }] },
  ];
  const t = topClients(entries, PER);
  assert.deepEqual(t, [
    { label: 'CLI-BETA', montant: 900000 },
    { label: 'CLI-ALPHA', montant: 800000 },
  ]);
});

test('topClients : les lignes lettrées sont exclues', () => {
  const mv = toMouvements(seed());
  const g411 = groupByTiers(mv)['411'];
  const refs = g411.filter((m) => m.entryId === 'e3').map((m) => ({ entryId: m.entryId, lineIndex: m.lineIndex }));
  const t = topClients(letterEntries(seed(), refs, 'A'), PER);
  assert.deepEqual(t, [{ label: '411', montant: 1180000 }]);
});

test('topClients : top n et journal vide', () => {
  const entries = [1, 2, 3, 4, 5, 6].map((i) => ({
    id: 'e' + i, date: Y + '-01-10', journal: 'VT', piece: 'VT-00' + i, libelle: 'Vente',
    lignes: [{ compte: '411' + i, debit: i * 100000, credit: 0 }, { compte: '701', debit: 0, credit: i * 100000 }],
  }));
  assert.equal(topClients(entries, PER, 3).length, 3);
  assert.equal(topClients(entries, PER, 3)[0].montant, 600000);
  assert.deepEqual(topClients([], PER), []);
});

test('topFournisseurs : dettes non lettrées (crédits − débits)', () => {
  const t = topFournisseurs(seed(), PER);
  assert.deepEqual(t, [{ label: '401', montant: 1480000 }]);
});

test('topFournisseurs : acompte au débit réduit la dette, tri décroissant', () => {
  const entries = [
    { id: 'e1', date: Y + '-01-10', journal: 'AC', piece: 'AC-001', libelle: 'Achat A',
      lignes: [{ compte: '601', debit: 1000000, credit: 0 }, { compte: '401', debit: 0, credit: 1000000, auxiliaire: 'FRN-X' }] },
    { id: 'e2', date: Y + '-02-10', journal: 'BQ', piece: 'BQ-001', libelle: 'Acompte X',
      lignes: [{ compte: '401', debit: 400000, credit: 0, auxiliaire: 'FRN-X' }, { compte: '521', debit: 0, credit: 400000 }] },
    { id: 'e3', date: Y + '-03-10', journal: 'AC', piece: 'AC-002', libelle: 'Achat Y',
      lignes: [{ compte: '601', debit: 800000, credit: 0 }, { compte: '401', debit: 0, credit: 800000, auxiliaire: 'FRN-Y' }] },
  ];
  const t = topFournisseurs(entries, PER);
  assert.deepEqual(t, [
    { label: 'FRN-Y', montant: 800000 },
    { label: 'FRN-X', montant: 600000 },
  ]);
});

test('dsoDpo : DSO 431 j, DPO 540 j sur le seed', () => {
  const d = dsoDpo(seed(), PER);
  assert.equal(d.dso, 431); // 3 540 000 / 3 000 000 * 365
  assert.equal(d.dpo, 540); // 1 480 000 / 1 000 000 * 365
});

test('dsoDpo : 0 si CA = 0 ou achats = 0', () => {
  const sansCA = [
    { id: 'e1', date: Y + '-01-10', journal: 'AC', piece: 'AC-001', libelle: 'Achat',
      lignes: [{ compte: '601', debit: 1000000, credit: 0 }, { compte: '401', debit: 0, credit: 1000000 }] },
  ];
  assert.deepEqual(dsoDpo(sansCA, PER), { dso: 0, dpo: 365 });
  const sansAchats = [
    { id: 'e1', date: Y + '-01-10', journal: 'VT', piece: 'VT-001', libelle: 'Vente',
      lignes: [{ compte: '411', debit: 1180000, credit: 0 }, { compte: '701', debit: 0, credit: 1000000 }] },
  ];
  assert.deepEqual(dsoDpo(sansAchats, PER), { dso: 431, dpo: 0 });
  assert.deepEqual(dsoDpo([], PER), { dso: 0, dpo: 0 });
});

test('comparatif : N vs N-1 vide -> pct null', () => {
  const c = comparatif(seed(), { from: PER.from, to: PER.to, prevFrom: '2025-01-01', prevTo: '2025-12-31' });
  assert.equal(c.ca.n, 3000000);
  assert.equal(c.ca.n1, 0);
  assert.equal(c.ca.pct, null);
  assert.equal(c.resNet.n, 800000);
  assert.equal(c.tresorerie.n, 5000000);
});

test('comparatif : évolution en % (n − n1) / |n1| * 100', () => {
  const entries = [
    ...seed(),
    { id: 'p1', date: '2025-03-10', journal: 'VT', piece: 'VT-101', libelle: 'Vente N-1',
      lignes: [{ compte: '411', debit: 2360000, credit: 0 }, { compte: '701', debit: 0, credit: 2000000 }, { compte: '443', debit: 0, credit: 360000 }] },
  ];
  const c = comparatif(entries, { from: PER.from, to: PER.to, prevFrom: '2025-01-01', prevTo: '2025-12-31' });
  assert.equal(c.ca.n1, 2000000);
  assert.equal(c.ca.pct, 50); // (3 000 000 − 2 000 000) / 2 000 000 * 100
});

test('comparatif : base N-1 négative (dénominateur |n1|)', () => {
  const entries = [
    { id: 'p1', date: '2025-03-10', journal: 'OD', piece: 'OD-101', libelle: 'Perte N-1',
      lignes: [{ compte: '658', debit: 500000, credit: 0 }, { compte: '521', debit: 0, credit: 500000 }] },
  ];
  const c = comparatif(entries, { from: PER.from, to: PER.to, prevFrom: '2025-01-01', prevTo: '2025-12-31' });
  assert.equal(c.resNet.n1, -500000);
  assert.equal(c.resNet.pct, 100); // (0 − (−500 000)) / 500 000 * 100
});

test('alertesDashboard : aucune alerte sur le seed', () => {
  assert.deepEqual(alertesDashboard(kpis(seed(), PER)), []);
});

test('alertesDashboard : découvert bancaire si trésorerie < 0', () => {
  const a = alertesDashboard({ tresorerie: -25000, tauxMarge: 10 });
  assert.equal(a.length, 1);
  assert.equal(a[0].code, 'decouvert');
  assert.equal(a[0].testid, 'alerte-decouvert');
  assert.equal(a[0].label, 'Découvert bancaire');
});

test('alertesDashboard : marge négative si tauxMarge < 0', () => {
  const a = alertesDashboard({ tresorerie: 1000, tauxMarge: -5.2 });
  assert.equal(a.length, 1);
  assert.equal(a[0].code, 'marge-negative');
  assert.equal(a[0].testid, 'alerte-marge');
  assert.equal(a[0].label, 'Marge brute négative');
});

test('alertesDashboard : les deux alertes cumulées', () => {
  const a = alertesDashboard({ tresorerie: -1, tauxMarge: -0.1 });
  assert.deepEqual(a.map((x) => x.code), ['decouvert', 'marge-negative']);
});
