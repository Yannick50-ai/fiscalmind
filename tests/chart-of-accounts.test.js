/**
 * Tests du plan comptable SYSCOHADA révisé.
 * node:test + node:assert/strict, zéro dépendance.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CLASSES, ACCOUNTS, getAccount, isValidAccount, classOf,
  sensNormal, accountsByClass
} from '../src/engine/chart-of-accounts.js';
import { accountLabel } from '../src/engine/labels.js';

test('plan complet : 1421 comptes distincts (1422 lignes dont un doublon exact « 91 »)', () => {
  // Le fichier source liste 1421 lignes ; la clé '91' y figure deux fois
  // avec un contenu identique → 1421 clés distinctes (voir NOTES.md). 611 réintégré le 13/10/2026.
  assert.equal(Object.keys(ACCOUNTS).length, 1421);
});

test('neuf classes du plan révisé', () => {
  assert.equal(Object.keys(CLASSES).length, 9);
  assert.ok(CLASSES['1'].length > 0);
  assert.ok(CLASSES['9'].length > 0);
});

test('getAccount / isValidAccount', () => {
  assert.equal(isValidAccount('6611'), true);
  const a = getAccount('6611');
  assert.equal(a.classe, '6');
  assert.equal(a.sens, 'D');
  assert.ok(a.intitule.length > 0);
  assert.equal(isValidAccount('101'), true);
  assert.equal(isValidAccount('401'), true);
  assert.equal(isValidAccount('409'), true);
  assert.equal(isValidAccount('411'), true);
  assert.equal(isValidAccount('419'), true);
  assert.equal(isValidAccount('441'), true);
  assert.equal(isValidAccount('443'), true);
  assert.equal(isValidAccount('4451'), true);
  assert.equal(isValidAccount('4452'), true);
  assert.equal(isValidAccount('521'), true);
  assert.equal(isValidAccount('571'), true);
  assert.equal(isValidAccount('601'), true);
  assert.equal(isValidAccount('6641'), true);
  assert.equal(isValidAccount('681'), true);
  assert.equal(isValidAccount('701'), true);
  assert.equal(isValidAccount('281'), true);
  assert.equal(getAccount('nimporte quoi'), null);
});

test('comptes inconnus rejetés', () => {
  assert.equal(isValidAccount('999999'), false);
  assert.equal(isValidAccount('ABC'), false);
  assert.equal(isValidAccount(''), false);
  assert.equal(isValidAccount('401001'), false); // sous-compte de tiers : pas au plan révisé
});

test('sens normal (logique portée de fmSensNormal)', () => {
  assert.equal(sensNormal('411'), 'D');
  assert.equal(sensNormal('401'), 'C');
  assert.equal(sensNormal('521'), 'D');
  assert.equal(sensNormal('701'), 'C');
  assert.equal(sensNormal('601'), 'D');
  assert.equal(sensNormal('101'), 'C');
});

test('classOf / accountsByClass', () => {
  assert.equal(classOf('701'), '7');
  assert.equal(classOf(''), '');
  const c6 = accountsByClass('6');
  assert.ok(c6.includes('6611'));
  assert.ok(c6.includes('601'));
  assert.ok(c6.every(n => n.charAt(0) === '6'));
});

test('accountLabel : libellé exact, repli parent, repli générique', () => {
  assert.equal(accountLabel('401'), getAccount('401').intitule);
  assert.equal(accountLabel('401001'), getAccount('401').intitule + ' (s/cpte 401001)');
  // '99' existe au plan → repli sur le parent le plus proche
  assert.equal(accountLabel('999999'), getAccount('99').intitule + ' (s/cpte 999999)');
  // aucun parent au plan → libellé générique
  assert.equal(accountLabel('009999'), 'Compte 009999');
});
