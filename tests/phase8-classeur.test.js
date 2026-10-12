/**
 * Tests phase 8 — Classeur Intelligent : extraction + proposition d'écritures.
 * node:test + node:assert/strict, zéro dépendance.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateEntry } from '../src/engine/journal.js';
import {
  cleanAmount, detectDocType, detectSens, extractDocDate, extractTotal,
  extractTva, extractTiers, impotsAccount, impotsLabel, extractImpotsDetails,
  extractInvoiceData, proposeEntries, toCanonical, isKnownTiers, nextSubAccount,
} from '../src/engine/classeur.js';

test('cleanAmount nettoie espaces et insécables', () => {
  assert.equal(cleanAmount('1 234 567'), 1234567);
  assert.equal(cleanAmount('1\u00a0234'), 1234);
  assert.equal(cleanAmount('abc'), 0);
  assert.equal(cleanAmount(''), 0);
});

test('detectDocType : bordereau DGI, relevé, quittance, facture', () => {
  assert.equal(detectDocType('BORDEREAU DE PAIEMENT Direction Générale des Impôts'), 'impots');
  assert.equal(detectDocType('Relevé bancaire'), 'releve');
  assert.equal(detectDocType('Reçu de paiement'), 'quittance');
  assert.equal(detectDocType('Facture n° 12'), 'facture');
});

test('detectSens : vente si facture + client sans fournisseur', () => {
  assert.equal(detectSens('Facture client n° 5'), 'vente');
  assert.equal(detectSens('Facture fournisseur'), 'achat');
  assert.equal(detectSens('Facture client et fournisseur'), 'achat');
});

test('extractDocDate : JJ/MM/AAAA -> AAAA-MM-JJ, AA -> 20AA', () => {
  assert.equal(extractDocDate('le 06/10/2026 à Ouaga'), '2026-10-06');
  assert.equal(extractDocDate('du 06-10-26'), '2026-10-06');
  assert.equal(extractDocDate('sans date', '2026-01-01'), '2026-01-01');
});

test('extractTotal : total TTC prioritaire, puis FCFA, puis max', () => {
  assert.equal(extractTotal('Total TTC : 1 180 000 F CFA'), 1180000);
  assert.equal(extractTotal('Net à payer 500 000'), 500000);
  assert.equal(extractTotal('Montant à régler : 200 000 FCFA'), 200000);
  assert.equal(extractTotal('rien ici'), 0);
});

test('extractTva : montant TVA détecté', () => {
  assert.equal(extractTva('TVA 18 % : 180 000 F CFA'), 180000);
  assert.equal(extractTva('sans tva'), 0);
});

test('extractTiers : première ligne en majuscules', () => {
  assert.equal(extractTiers('ETS YANNICK COMMERCE\nFacture n° 1', 'facture'), 'ETS YANNICK COMMERCE');
  assert.equal(extractTiers('Bordereau DGI', 'impots'), 'DGI');
  assert.equal(extractTiers('facture minuscule', 'facture'), 'Tiers');
});

test('impotsAccount / impotsLabel : mapping des taxes du bordereau', () => {
  assert.equal(impotsAccount('Acompte provisionnel IS'), '441');
  assert.equal(impotsAccount('Droits de timbres'), '646');
  assert.equal(impotsAccount("Taxe patronale d'apprentissage"), '641');
  assert.equal(impotsAccount('Taxe sur la valeur ajoutée'), '443');
  assert.equal(impotsAccount('Autre taxe'), '447');
  assert.equal(impotsLabel('Acompte provisionnel IS'), 'Acompte provisionnel IS');
  assert.equal(impotsLabel('Traitements et salaires', 'ITS'), 'ITS');
});

test('extractImpotsDetails : noms + montants du bordereau', () => {
  const text = 'Bordereau de paiement\nListe des montants\nImpôt\nAcompte provisionnel IS\nDroits de timbres\nMontant total déclaré\n500000\n25000\nMontant payé : 525000';
  const dets = extractImpotsDetails(text);
  assert.equal(dets.length, 2);
  assert.equal(dets[0].account, '441');
  assert.equal(dets[0].amount, 500000);
  assert.equal(dets[1].account, '646');
});

test('proposeEntries : facture achat avec TVA -> 601/4452/401 équilibrée', () => {
  const ext = {
    type: 'facture', sens: 'achat', date: '2026-10-06', tiers: 'ETS TEST',
    total: 1180000, tva: 180000, details: [], fileName: 'facture.pdf',
  };
  const entries = proposeEntries(ext);
  assert.equal(entries.length, 1);
  const v = validateEntry(toCanonical(entries[0]));
  assert.deepEqual(v.errors, v.ok ? [] : v.errors);
  assert.ok(v.ok, 'écriture équilibrée : ' + v.errors.join('; '));
  const e = entries[0];
  assert.equal(e.journal, 'AC');
  const comptes = e.lignes.map((l) => l.compte);
  assert.deepEqual(comptes, ['601', '4452', '401']);
  assert.equal(e.lignes[0].debit, 1000000);
  assert.equal(e.lignes[2].credit, 1180000);
});

test('proposeEntries : facture vente sans TVA -> 411/701', () => {
  const ext = {
    type: 'facture', sens: 'vente', date: '2026-10-06', tiers: 'CLIENT X',
    total: 500000, tva: 0, details: [], fileName: 'f.pdf',
  };
  const entries = proposeEntries(ext);
  assert.equal(entries.length, 1);
  assert.ok(validateEntry(toCanonical(entries[0])).ok);
  assert.equal(entries[0].journal, 'VT');
  assert.deepEqual(entries[0].lignes.map((l) => l.compte), ['411', '701']);
});

test('proposeEntries : règlement espèces ajoute une écriture ES 401/571', () => {
  const ext = {
    type: 'facture', sens: 'achat', date: '2026-10-06', tiers: 'ETS TEST',
    total: 100000, tva: 0, details: [], fileName: 'f.pdf',
  };
  const entries = proposeEntries(ext, { reglement: 'ES' });
  assert.equal(entries.length, 2);
  const reg = entries[1];
  assert.equal(reg.journal, 'ES');
  assert.deepEqual(reg.lignes.map((l) => l.compte), ['401', '571']);
  assert.ok(validateEntry(toCanonical(reg)).ok);
});

test('proposeEntries : bordereau DGI détaillé -> comptes par taxe + 521', () => {
  const ext = {
    type: 'impots', sens: 'achat', date: '2026-10-06', tiers: 'DGI',
    total: 525000, tva: 0, fileName: 'bordereau.pdf',
    details: [
      { label: 'Acompte provisionnel IS', amount: 500000, account: '441' },
      { label: 'Droits de timbres', amount: 25000, account: '646' },
    ],
  };
  const entries = proposeEntries(ext);
  assert.equal(entries.length, 1);
  const e = entries[0];
  assert.equal(e.journal, 'BQ');
  assert.deepEqual(e.lignes.map((l) => l.compte), ['441', '646', '521']);
  assert.ok(validateEntry(toCanonical(e)).ok);
});

test('proposeEntries : bordereau DGI sans détail -> 447/521', () => {
  const ext = {
    type: 'impots', sens: 'achat', date: '2026-10-06', tiers: 'DGI',
    total: 100000, tva: 0, details: [], fileName: 'b.pdf',
  };
  const entries = proposeEntries(ext);
  assert.deepEqual(entries[0].lignes.map((l) => l.compte), ['447', '521']);
  assert.ok(validateEntry(toCanonical(entries[0])).ok);
});

test('proposeEntries : total nul -> aucune écriture', () => {
  assert.deepEqual(proposeEntries({ total: 0, type: 'facture' }), []);
});

test('isKnownTiers / nextSubAccount', () => {
  assert.ok(isKnownTiers(['ETS Test'], 'ets test'));
  assert.ok(!isKnownTiers(['ETS Test'], 'Autre'));
  assert.equal(nextSubAccount([{ type: 'F' }], 'F'), '401002');
  assert.equal(nextSubAccount([], 'C'), '411001');
});

test('extractInvoiceData : extraction complète cohérente', () => {
  const ext = extractInvoiceData('ETS YANNICK\nFacture n° 8 du 06/10/2026\nTotal TTC : 1 180 000 F CFA\nTVA : 180 000 F CFA', 'f.pdf');
  assert.equal(ext.type, 'facture');
  assert.equal(ext.sens, 'achat');
  assert.equal(ext.date, '2026-10-06');
  assert.equal(ext.tiers, 'ETS YANNICK');
  assert.equal(ext.total, 1180000);
  assert.equal(ext.tva, 180000);
});
