/**
 * Tests de src/engine/csv-import.js — node:test, zéro dépendance.
 *
 * Vérifie : dates ddMMyy (comme le classeur), séparateur auto-détecté,
 * regroupement par pièce+date, équilibre débit=crédit, erreurs localisées
 * (une ligne fautive ne jette pas le fichier), colonne ecriture_id,
 * en-tête nommé.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseJournalCsv, parseCompte, parseDateCsv, parseMontant } from '../src/engine/csv-import.js';

describe('parseDateCsv', () => {
  it('ddMMyy : 010126 → 2026-01-01 (format du classeur)', () => {
    assert.equal(parseDateCsv('010126'), '2026-01-01');
  });
  it('ddMMyy : fin de mois et siècle (yy > 50 → 19yy)', () => {
    assert.equal(parseDateCsv('311299'), '1999-12-31');
    assert.equal(parseDateCsv('150425'), '2025-04-15');
  });
  it('ddMMyy invalide rejeté (jour 32, mois 13, 31/02)', () => {
    assert.equal(parseDateCsv('320126'), null);
    assert.equal(parseDateCsv('011326'), null);
    assert.equal(parseDateCsv('310226'), null);
  });
  it('jj/mm/aaaa et variantes', () => {
    assert.equal(parseDateCsv('08/10/2026'), '2026-10-08');
    assert.equal(parseDateCsv('8-1-2025'), '2025-01-08');
    assert.equal(parseDateCsv('01.12.2024'), '2024-12-01');
  });
  it('aaaa-mm-jj', () => {
    assert.equal(parseDateCsv('2026-10-08'), '2026-10-08');
  });
  it('formats inconnus rejetés', () => {
    assert.equal(parseDateCsv('2026'), null);
    assert.equal(parseDateCsv('08/10/26'), null);
    assert.equal(parseDateCsv('demain'), null);
    assert.equal(parseDateCsv(''), null);
  });
});

describe('parseMontant', () => {
  it('formats français acceptés', () => {
    assert.equal(parseMontant('1 234,56'), 1234.56);
    assert.equal(parseMontant('1180000'), 1180000);
    assert.equal(parseMontant(''), 0);
    assert.equal(parseMontant('  '), 0);
    assert.equal(parseMontant('-500'), -500);
  });
  it('non numérique → null', () => {
    assert.equal(parseMontant('abc'), null);
    assert.equal(parseMontant('12.34.56'), null);
  });
});

describe('parseCompte', () => {
  it('1 à 6 chiffres', () => {
    assert.equal(parseCompte('521'), '521');
    assert.equal(parseCompte('401001'), '401001');
    assert.equal(parseCompte('52A'), null);
    assert.equal(parseCompte('1234567'), null);
    assert.equal(parseCompte(''), null);
  });
});

const CSV_OK = [
  '521;010126;BQ;P1;Capital;2000000;',
  '101;010126;BQ;P1;Capital;;2000000',
  '411;150326;VT;V12;Vente;1180000;',
  '701;150326;VT;V12;Vente;;1000000',
  '443;150326;VT;V12;Vente;;180000',
].join('\n');

describe('parseJournalCsv — cas nominal', () => {
  it('2 écritures regroupées par pièce+date, dates ddMMyy', () => {
    const r = parseJournalCsv(CSV_OK);
    assert.equal(r.erreurs.length, 0, JSON.stringify(r.erreurs));
    assert.equal(r.ecritures.length, 2);
    const e1 = r.ecritures[0];
    assert.equal(e1.date, '2026-01-01');
    assert.equal(e1.piece, 'P1');
    assert.equal(e1.journal, 'BQ');
    assert.equal(e1.lignes.length, 2);
    assert.deepEqual(e1.lignes[0], { compte: '521', debit: 2000000, credit: 0 });
    assert.equal(r.stats.ecrituresCreees, 2);
    assert.equal(r.stats.lignesLues, 5);
  });
  it('séparateur virgule auto-détecté', () => {
    const r = parseJournalCsv('521,010126,BQ,P1,Capital,2000000,\n101,010126,BQ,P1,Capital,,2000000');
    assert.equal(r.erreurs.length, 0, JSON.stringify(r.erreurs));
    assert.equal(r.ecritures.length, 1);
  });
  it('en-tête nommé mappé par nom (ordre différent)', () => {
    const r = parseJournalCsv([
      'Libellé;Compte;Crédit;Débit;Date;Pièce;Journal',
      'Capital;521;;2000000;01/02/2026;P1;BQ',
      'Capital;101;2000000;;01/02/2026;P1;BQ',
    ].join('\n'));
    assert.equal(r.erreurs.length, 0, JSON.stringify(r.erreurs));
    assert.equal(r.ecritures.length, 1);
    assert.equal(r.ecritures[0].date, '2026-02-01');
  });
  it('champs entre guillemets avec point-virgule', () => {
    const r = parseJournalCsv([
      '521;010126;BQ;P1;"Capital; apport";2000000;',
      '101;010126;BQ;P1;"Capital; apport";;2000000',
    ].join('\n'));
    assert.equal(r.erreurs.length, 0);
    assert.equal(r.ecritures[0].libelle, 'Capital; apport');
  });
  it('colonne ecriture_id : regroupement par id', () => {
    const r = parseJournalCsv([
      'ecriture_id;compte;date;journal;piece;libelle;debit;credit',
      'E1;521;010126;BQ;P1;Capital;2000000;',
      'E1;101;020126;BQ;P1;Capital;;2000000',
    ].join('\n'));
    assert.equal(r.erreurs.length, 0, JSON.stringify(r.erreurs));
    assert.equal(r.ecritures.length, 1, 'même ecriture_id malgré des dates différentes');
  });
});

describe('parseJournalCsv — erreurs localisées', () => {
  const CSV_MIX = [
    '521;010126;BQ;P1;Capital;2000000;',
    '101;010126;BQ;P1;Capital;;2000000',
    '52X;010126;BQ;P2;Mauvais compte;100;',
    '521;321326;BQ;P3;Mauvaise date;100;',
    '101;010126;BQ;P1;Capital;;ABC',
  ].join('\n');

  it('les lignes fautives sont signalées avec leur n° sans jeter le fichier', () => {
    const r = parseJournalCsv(CSV_MIX);
    // L3 : compte invalide ; L4 : date invalide ; L5 : montant invalide
    assert.equal(r.erreurs.length, 3);
    assert.deepEqual(r.erreurs.map((e) => e.ligne), [3, 4, 5]);
    assert.ok(r.erreurs[0].message.includes('Compte'));
    assert.ok(r.erreurs[1].message.includes('Date'));
    assert.ok(r.erreurs[2].message.includes('Montant'));
    // L'écriture P1 (lignes 1-2) est toujours importée.
    assert.equal(r.ecritures.length, 1);
    assert.equal(r.ecritures[0].piece, 'P1');
  });

  it('déséquilibre : écriture rejetée, erreur localisée sur la 1re ligne du groupe', () => {
    const r = parseJournalCsv([
      '521;010126;BQ;P9;A;1000;',
      '101;010126;BQ;P9;A;;900',
    ].join('\n'));
    assert.equal(r.ecritures.length, 0);
    assert.equal(r.erreurs.length, 1);
    assert.equal(r.erreurs[0].ligne, 1);
    assert.ok(r.erreurs[0].message.includes('déséquilibrée'));
  });

  it('ligne à montants nuls rejetée', () => {
    const r = parseJournalCsv('521;010126;BQ;P1;A;;');
    assert.equal(r.ecritures.length, 0);
    assert.ok(r.erreurs[0].message.includes('nuls'));
  });

  it('pièce manquante rejetée', () => {
    const r = parseJournalCsv('521;010126;BQ;;A;100;');
    assert.equal(r.ecritures.length, 0);
    assert.ok(r.erreurs[0].message.includes('Pièce'));
  });

  it('fichier vide → zéro écriture, zéro erreur', () => {
    const r = parseJournalCsv('   \n');
    assert.equal(r.ecritures.length, 0);
    assert.equal(r.erreurs.length, 0);
  });

  it('ids uniques et préfixe personnalisable', () => {
    const r = parseJournalCsv(CSV_OK, { idPrefix: 'csv-xyz' });
    assert.ok(r.ecritures[0].id.startsWith('csv-xyz-'));
    assert.notEqual(r.ecritures[0].id, r.ecritures[1].id);
  });
});
