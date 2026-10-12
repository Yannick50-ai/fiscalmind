// Tests des helpers purs de l'onglet 🔌 Intégrations (src/admin/format.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maskEmail, errorDotColor, deployDotColor, pulseBadge, isMissingKeyError } from '../src/admin/format.js';

test('maskEmail : 2 premiers caractères + domaine', () => {
  assert.equal(maskEmail('yannick@example.com'), 'ya***@example.com');
  assert.equal(maskEmail('a@example.com'), 'a***@example.com');
  assert.equal(maskEmail('ab@example.com'), 'ab***@example.com');
});

test('maskEmail : valeurs invalides → tiret', () => {
  assert.equal(maskEmail(null), '—');
  assert.equal(maskEmail(undefined), '—');
  assert.equal(maskEmail(''), '—');
  assert.equal(maskEmail('pasunemail'), '—');
  assert.equal(maskEmail('@domaine.com'), '—');
});

test('errorDotColor : verte < 1 %, orange < 5 %, rouge sinon', () => {
  assert.equal(errorDotColor(0), '#16A34A');
  assert.equal(errorDotColor(0.9), '#16A34A');
  assert.equal(errorDotColor(1), '#EA7C1F');
  assert.equal(errorDotColor(4.99), '#EA7C1F');
  assert.equal(errorDotColor(5), '#DC2626');
  assert.equal(errorDotColor(42), '#DC2626');
});

test('errorDotColor : valeurs manquantes ou invalides → vert', () => {
  assert.equal(errorDotColor(null), '#16A34A');
  assert.equal(errorDotColor(undefined), '#16A34A');
  assert.equal(errorDotColor('pasunnum'), '#16A34A');
});

test('deployDotColor : succès / échec / en cours', () => {
  assert.equal(deployDotColor('success'), '#16A34A');
  assert.equal(deployDotColor('SUCCEEDED'), '#16A34A');
  assert.equal(deployDotColor('failed'), '#DC2626');
  assert.equal(deployDotColor('failure'), '#DC2626');
  assert.equal(deployDotColor('building'), '#EA7C1F');
  assert.equal(deployDotColor(null), '#EA7C1F');
});

test('pulseBadge : actif / inactif', () => {
  assert.equal(pulseBadge(true), '🟢 Actif');
  assert.equal(pulseBadge(false), '🔴 Inactif');
  assert.equal(pulseBadge(undefined), '🔴 Inactif');
});

test('isMissingKeyError : détecte "non configuré"', () => {
  assert.equal(isMissingKeyError('Clé API non configurée pour ce service'), true);
  assert.equal(isMissingKeyError('non configuré'), true);
  assert.equal(isMissingKeyError('Erreur réseau'), false);
  assert.equal(isMissingKeyError(''), false);
  assert.equal(isMissingKeyError(null), false);
  assert.equal(isMissingKeyError(undefined), false);
});
