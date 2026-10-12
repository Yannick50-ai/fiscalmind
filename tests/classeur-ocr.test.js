/**
 * Tests — Classeur Intelligent : sous-comptes de tiers, traçabilité `doc`,
 * OCR (service + consentement) et factures de démo (flux complet).
 * node:test + node:assert/strict, zéro dépendance.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  registerSubAccount, isSubAccount, isValidAccount, getAccount, clearSubAccounts,
} from '../src/engine/chart-of-accounts.js';
import { validateEntry, addEntry } from '../src/engine/journal.js';
import {
  extractInvoiceData, proposeEntries, toCanonical, extractTotal,
  nextSubAccount, tiersAccountFor,
} from '../src/engine/classeur.js';
import { createOcrService, validateOcrInput } from '../src/services/ocr.js';

/* ---------------- Registre de sous-comptes ---------------- */

test('registerSubAccount : 401001 accepté, sens hérité du parent', () => {
  clearSubAccounts();
  assert.equal(isValidAccount('401001'), false);
  assert.equal(registerSubAccount('401001', 'Fournisseurs — ETS TEST'), true);
  assert.equal(isValidAccount('401001'), true);
  assert.equal(isSubAccount('401001'), true);
  const a = getAccount('401001');
  assert.equal(a.intitule, 'Fournisseurs — ETS TEST');
  assert.equal(a.sens, getAccount('401').sens);
  assert.equal(a.classe, '4');
  clearSubAccounts();
});

test('registerSubAccount : refus (officiel, sans parent, format)', () => {
  clearSubAccounts();
  assert.equal(registerSubAccount('401', 'X'), false); // compte officiel
  assert.equal(registerSubAccount('999999', 'X'), true); // parent 99 existe
  clearSubAccounts();
  assert.equal(registerSubAccount('000001', 'X'), false); // aucun parent 00/000/0000/00000
  assert.equal(registerSubAccount('40', 'X'), false); // 2 chiffres
  assert.equal(registerSubAccount('4010001', 'X'), false); // 7 chiffres
  assert.equal(registerSubAccount('ABC', 'X'), false);
  clearSubAccounts();
});

test('nextSubAccount : anti-collision après suppression', () => {
  assert.equal(nextSubAccount([], 'F'), '401001');
  assert.equal(nextSubAccount([{ type: 'F' }], 'F'), '401002');
  // Tiers supprimé (trou dans la numérotation) -> repart du max existant
  const tiers = [
    { nom: 'A', type: 'F', compte: '401001' },
    { nom: 'C', type: 'F', compte: '401003' },
  ];
  assert.equal(nextSubAccount(tiers, 'F'), '401004');
  assert.equal(nextSubAccount(tiers, 'C'), '411001');
});

test('tiersAccountFor : connu -> existant, inconnu -> nouveau', () => {
  const tiers = [{ nom: 'ETS Test', type: 'F', compte: '401001' }];
  const k = tiersAccountFor(tiers, 'ets test', 'F');
  assert.deepEqual(k, { compte: '401001', isNew: false });
  const n = tiersAccountFor(tiers, 'Nouveau Fournisseur', 'F');
  assert.deepEqual(n, { compte: '401002', isNew: true });
});

/* ---------------- Traçabilité `doc` ---------------- */

test('addEntry : le champ doc (document source) est conservé', () => {
  const r = addEntry([], {
    id: 'e1', date: '2026-10-06', journal: 'AC', piece: 'F-1',
    libelle: 'Achat', doc: 'facture.pdf',
    lignes: [
      { compte: '601', debit: 1000, credit: 0 },
      { compte: '401', debit: 0, credit: 1000 },
    ],
  });
  assert.ok(r.ok);
  assert.equal(r.entries[0].doc, 'facture.pdf');
});

test('validateEntry : accepte un sous-compte enregistré', () => {
  clearSubAccounts();
  registerSubAccount('411001', 'Clients — BOUTIQUE MODERNE');
  const v = validateEntry({
    id: 'e2', date: '2026-10-07', journal: 'VT', piece: 'V-1', libelle: 'Vente',
    lignes: [
      { compte: '411001', debit: 590000, credit: 0 },
      { compte: '701', debit: 0, credit: 500000 },
      { compte: '443', debit: 0, credit: 90000 },
    ],
  });
  assert.ok(v.ok, JSON.stringify(v.errors));
  clearSubAccounts();
});

/* ---------------- Service OCR : consentement et validation ---------------- */

test('createOcrService : consentement explicite requis', async () => {
  const svc = createOcrService({ invokeOcr: async () => ({ ParsedResults: [{ ParsedText: 'Total : 100' }] }) });
  await assert.rejects(
    svc.requestOcr({ accessToken: 'tok', dataUrl: 'data:image/png;base64,AAAA', consent: false }),
    /consentement/i
  );
  await assert.rejects(
    svc.requestOcr({ accessToken: '', dataUrl: 'data:image/png;base64,AAAA', consent: true }),
    /Connexion requise/
  );
});

test('createOcrService : succès -> texte extrait', async () => {
  const svc = createOcrService({
    invokeOcr: async () => ({ ParsedResults: [{ ParsedText: '  Facture Total : 200  ' }] }),
  });
  const { text } = await svc.requestOcr({
    accessToken: 'tok', dataUrl: 'data:image/png;base64,AAAA', consent: true,
  });
  assert.equal(text, 'Facture Total : 200');
});

test('createOcrService : texte vide -> OCR_EMPTY avec fallback local', async () => {
  const svc = createOcrService({ invokeOcr: async () => ({ ParsedResults: [] }) });
  try {
    await svc.requestOcr({ accessToken: 'tok', dataUrl: 'data:image/png;base64,AAAA', consent: true });
    assert.fail('aurait dû lever');
  } catch (e) {
    assert.equal(e.code, 'OCR_EMPTY');
    assert.equal(e.localFallback, true);
  }
});

test('validateOcrInput : types et tailles', () => {
  assert.equal(validateOcrInput({}).ok, false);
  assert.equal(validateOcrInput({ dataUrl: 'data:text/plain;base64,AAAA' }).ok, false);
  assert.equal(validateOcrInput({ dataUrl: 'data:image/png;base64,AAAA' }).ok, true);
  assert.equal(validateOcrInput({ dataUrl: 'data:application/pdf;base64,AAAA' }).ok, true);
  assert.equal(validateOcrInput({ dataUrl: 'x'.repeat(1_800_001) }).ok, false);
});

/* ---------------- Factures de démo : flux complet ---------------- */

const DEMO_ACHAT = [
  'ETS YANNICK COMMERCE',
  'Facture N° F-2026-128 du 06/10/2026',
  'Fournitures de bureau',
  'Total HT : 1 000 000 F CFA',
  'TVA 18 % : 180 000 F CFA',
  'Total TTC : 1 180 000 F CFA',
  'Net à payer : 1 180 000 F CFA',
].join('\n');

const DEMO_VENTE = [
  'BOUTIQUE MODERNE',
  'Facture de vente N° V-2026-045 du 07/10/2026',
  'Client : BOUTIQUE MODERNE',
  'Marchandises diverses',
  'Total HT : 500 000 F CFA',
  'TVA 18 % : 90 000 F CFA',
  'Total TTC : 590 000 F CFA',
].join('\n');

const DEMO_DGI = [
  'BORDEREAU DE PAIEMENT',
  'Direction Générale des Impôts',
  'Total : 525 000 F CFA',
  'Liste des montants',
  'Impôt',
  'Acompte provisionnel IS',
  'Droits de timbres',
  'Montant total déclaré',
  '500000',
  '25000',
  'Montant payé : 525000',
].join('\n');

function checkBalanced(entries) {
  assert.ok(entries.length > 0, 'au moins une écriture proposée');
  entries.forEach((e) => {
    const v = validateEntry(toCanonical(e));
    assert.ok(v.ok, 'écriture valide : ' + JSON.stringify(v.errors));
  });
}

test('démo achat : extraction + 601/4452/401 équilibrée et valide', () => {
  const ext = extractInvoiceData(DEMO_ACHAT, 'demo-facture-achat.pdf');
  assert.equal(ext.type, 'facture');
  assert.equal(ext.sens, 'achat');
  assert.equal(ext.tiers, 'ETS YANNICK COMMERCE');
  assert.equal(ext.date, '2026-10-06');
  assert.equal(ext.total, 1180000);
  assert.equal(ext.tva, 180000);
  const entries = proposeEntries(ext, {});
  assert.equal(entries.length, 1);
  const comptes = entries[0].lignes.map((l) => l.compte);
  assert.deepEqual(comptes, ['601', '4452', '401']);
  assert.equal(entries[0].lignes[0].debit, 1000000); // HT
  assert.equal(entries[0].journal, 'AC');
  checkBalanced(entries);
});

test('démo vente : extraction + 411/701/443 équilibrée et valide', () => {
  const ext = extractInvoiceData(DEMO_VENTE, 'demo-facture-vente.pdf');
  assert.equal(ext.sens, 'vente');
  assert.equal(ext.tiers, 'BOUTIQUE MODERNE');
  assert.equal(ext.total, 590000);
  assert.equal(ext.tva, 90000);
  const entries = proposeEntries(ext, {});
  const comptes = entries[0].lignes.map((l) => l.compte);
  assert.deepEqual(comptes, ['411', '701', '443']);
  assert.equal(entries[0].journal, 'VT');
  checkBalanced(entries);
});

test('démo bordereau DGI : 2 taxes détaillées (441, 646) + 521', () => {
  const ext = extractInvoiceData(DEMO_DGI, 'demo-bordereau-dgi.pdf');
  assert.equal(ext.type, 'impots');
  assert.equal(ext.tiers, 'DGI');
  assert.equal(ext.total, 525000);
  assert.equal(ext.details.length, 2);
  const entries = proposeEntries(ext, {});
  assert.equal(entries.length, 1);
  const comptes = entries[0].lignes.map((l) => l.compte);
  assert.deepEqual(comptes, ['441', '646', '521']);
  assert.equal(entries[0].journal, 'BQ');
  checkBalanced(entries);
});

test('démo achat + règlement espèces : 2e écriture 401/571 en ES', () => {
  const ext = extractInvoiceData(DEMO_ACHAT, 'demo.pdf');
  const entries = proposeEntries(ext, { reglement: 'ES' });
  assert.equal(entries.length, 2);
  assert.equal(entries[1].journal, 'ES');
  const comptes = entries[1].lignes.map((l) => l.compte);
  assert.deepEqual(comptes, ['401', '571']);
  checkBalanced(entries);
});

test('extractTotal : Total TTC prioritaire même après Total HT', () => {
  assert.equal(
    extractTotal('Total HT : 500 000 F CFA\nTVA 18 % : 90 000 F CFA\nTotal TTC : 590 000 F CFA'),
    590000
  );
  assert.equal(extractTotal('Net à payer 500 000'), 500000);
});

test('TVA absente : pas de lignes 4452/443, alerte à afficher', () => {
  const ext = extractInvoiceData(
    'ETS TEST\nFacture du 06/10/2026\nTotal : 500 000 F CFA', 'f.pdf'
  );
  assert.equal(ext.tva, 0);
  const entries = proposeEntries(ext, {});
  const comptes = entries[0].lignes.map((l) => l.compte);
  assert.deepEqual(comptes, ['601', '401']);
  checkBalanced(entries);
});

test('montants invalides : total 0 -> aucune écriture proposée', () => {
  const ext = extractInvoiceData('document illisible sans chiffres', 'x.pdf');
  assert.equal(ext.total, 0);
  assert.deepEqual(proposeEntries(ext, {}), []);
});

test('bordereau DGI : somme détails ≠ total -> repli sur 447 unique', () => {
  const ext = {
    type: 'impots', sens: 'achat', date: '2026-10-08', tiers: 'DGI',
    total: 999999, tva: 0, fileName: 'b.pdf',
    details: [{ label: 'Acompte provisionnel IS', amount: 500000, account: '441' }],
  };
  const entries = proposeEntries(ext, {});
  const comptes = entries[0].lignes.map((l) => l.compte);
  assert.deepEqual(comptes, ['447', '521']);
  checkBalanced(entries);
});

/* ---------------- Avoirs : contrepassation ---------------- */

test('detectAvoir : avoir / note de crédit / facture rectificative', async () => {
  const { detectAvoir } = await import('../src/engine/classeur.js');
  assert.equal(detectAvoir('AVOIR N° AV-2026-001'), true);
  assert.equal(detectAvoir('Note de crédit client'), true);
  assert.equal(detectAvoir("Facture d'avoir fournisseur"), true);
  assert.equal(detectAvoir('Facture rectificative'), true);
  assert.equal(detectAvoir('Facture N° F-2026-001'), false);
});

test('avoir achat : écritures inversées (D 401 / C 601 + C 4452)', () => {
  const ext = extractInvoiceData("AVOIR N° AV-12\nFournisseur : ETS KABORE\nTotal TTC : 118000\nTVA 18% : 18000", 'avoir.pdf');
  assert.equal(ext.avoir, true);
  assert.equal(ext.sens, 'achat');
  const entries = proposeEntries(ext, {});
  assert.equal(entries.length, 1);
  const byCpt = {};
  entries[0].lignes.forEach((l) => { byCpt[l.compte] = l; });
  assert.equal(byCpt['401'].debit, 118000);   // contrepassation : on débite le fournisseur
  assert.equal(byCpt['601'].credit, 100000);  // on crédite la charge
  assert.equal(byCpt['4452'].credit, 18000);  // on crédite la TVA récupérable
  checkBalanced(entries);
});

test('avoir vente : écritures inversées (D 701 + D 443 / C 411)', () => {
  const ext = extractInvoiceData("Avoir client N° AV-7\nClient : SARL DIALLO\nTotal TTC : 59000\nTVA 18% : 9000", 'avoir-v.pdf');
  ext.sens = 'vente'; // forcer le sens pour le test
  const entries = proposeEntries(ext, {});
  const byCpt = {};
  entries[0].lignes.forEach((l) => { byCpt[l.compte] = l; });
  assert.equal(byCpt['411'].credit, 59000);
  assert.equal(byCpt['701'].debit, 50000);
  assert.equal(byCpt['443'].debit, 9000);
  checkBalanced(entries);
});

test('avoir achat réglé : remboursement inversé (D 521 / C 401)', () => {
  const ext = extractInvoiceData("AVOIR N° AV-12\nFournisseur : ETS KABORE\nTotal TTC : 118000\nTVA 18% : 18000", 'avoir.pdf');
  const entries = proposeEntries(ext, { reglement: 'BQ' });
  assert.equal(entries.length, 2);
  const reg = entries[1];
  const byCpt = {};
  reg.lignes.forEach((l) => { byCpt[l.compte] = l; });
  assert.equal(byCpt['521'].debit, 118000);   // remboursement reçu en banque
  assert.equal(byCpt['401'].credit, 118000);
  checkBalanced(entries);
});
