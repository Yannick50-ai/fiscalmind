// Tests du rendu markdown léger du copilote (src/copilot/format.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, highlightAccounts, renderMarkdown, QUICK_PROMPTS } from '../src/copilot/format.js';

test('escapeHtml neutralise les injections', () => {
  assert.equal(escapeHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
  assert.equal(escapeHtml('a & b'), 'a &amp; b');
});

test('renderMarkdown : gras et titres', () => {
  const h = renderMarkdown('## Titre\nDu **gras** ici');
  assert.match(h, /<strong class="md-h">Titre<\/strong>/);
  assert.match(h, /<strong>gras<\/strong>/);
});

test('renderMarkdown : listes à puces', () => {
  const h = renderMarkdown('- un\n- deux');
  assert.match(h, /<ul><li>un<\/li><li>deux<\/li><\/ul>/);
});

test('renderMarkdown : code inline protégé', () => {
  const h = renderMarkdown('utilisez `401` pour solder');
  assert.match(h, /<code>401<\/code>/);
  assert.doesNotMatch(h, /<span class="acct">401<\/span>/);
});

test('highlightAccounts : numéros de comptes mis en valeur, pas dans les balises', () => {
  const h = highlightAccounts('Le compte 411 et <strong>701</strong> puis 12 et 123456.');
  assert.match(h, /<span class="acct">411<\/span>/);
  assert.match(h, /<strong><span class="acct">701<\/span><\/strong>/); // mis en valeur même dans une balise
  assert.doesNotMatch(h, /<span class="acct">12<\/span>/); // trop court
  assert.doesNotMatch(h, /<span class="acct">123456<\/span>/); // trop long
});

test('renderMarkdown : réponse complète type', () => {
  const src = 'Le compte **411** (clients) se solde par :\n- débit 411\n- crédit 521\nVoir `sensNormal`.';
  const h = renderMarkdown(src);
  assert.match(h, /<span class="acct">411<\/span>/);
  assert.match(h, /<span class="acct">521<\/span>/);
  assert.match(h, /<ul>/);
  assert.match(h, /<code>sensNormal<\/code>/);
});

test('renderMarkdown : HTML injecté dans une réponse reste inerte', () => {
  const h = renderMarkdown('<img src=x onerror=alert(1)>');
  assert.doesNotMatch(h, /<img/);
  assert.match(h, /&lt;img/);
});

test('QUICK_PROMPTS : 5 suggestions en français', () => {
  assert.equal(QUICK_PROMPTS.length, 5);
  assert.ok(QUICK_PROMPTS.every((q) => q.label && q.prompt));
});
