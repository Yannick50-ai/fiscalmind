/**
 * Tests phase 8 — Audit Readiness (pur).
 * node:test + node:assert/strict, zéro dépendance.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AUDIT_GROUPS, AUDIT_PRIO, AUDIT_DEFAULTS, defaultAuditItems,
  sanitizeAuditItem, toggleAuditItem, addAuditItem, updateAuditItem,
  deleteAuditItem, itemsOfGroup, auditProgress,
} from '../src/engine/audit.js';

test('constantes : 4 groupes, 3 priorités, 17 éléments par défaut', () => {
  assert.equal(Object.keys(AUDIT_GROUPS).length, 4);
  assert.equal(Object.keys(AUDIT_PRIO).length, 3);
  assert.equal(AUDIT_DEFAULTS.length, 17);
});

test('defaultAuditItems : ids stables, tous non cochés', () => {
  const items = defaultAuditItems();
  assert.equal(items.length, 17);
  assert.ok(items.every((it) => it.done === false));
  assert.deepEqual(items.map((it) => it.id), items.map((_, i) => 'a' + (i + 1)));
});

test('toggleAuditItem : bascule immuable', () => {
  const items = defaultAuditItems();
  const toggled = toggleAuditItem(items, 'a1');
  assert.ok(toggled.find((it) => it.id === 'a1').done);
  assert.ok(!items.find((it) => it.id === 'a1').done);
});

test('addAuditItem / updateAuditItem / deleteAuditItem', () => {
  let items = defaultAuditItems();
  items = addAuditItem(items, { group: 'fisc', title: 'Nouveau contrôle', priority: 'low', note: 'x' });
  assert.equal(items.length, 18);
  const added = items[items.length - 1];
  assert.equal(added.priority, 'low');
  items = updateAuditItem(items, added.id, { title: 'Modifié', done: true });
  assert.equal(items.find((it) => it.id === added.id).title, 'Modifié');
  items = deleteAuditItem(items, added.id);
  assert.equal(items.length, 17);
});

test('sanitizeAuditItem : groupe/priorité invalides repliés', () => {
  const it = sanitizeAuditItem({ group: 'nope', priority: 'nope', title: '  Titre  ' });
  assert.equal(it.group, 'ctrl');
  assert.equal(it.priority, 'medium');
  assert.equal(it.title, 'Titre');
});

test('itemsOfGroup + auditProgress : avancement global et par groupe', () => {
  const items = defaultAuditItems();
  const prog = auditProgress(toggleAuditItem(items, 'a1'));
  assert.equal(prog.total, 17);
  assert.equal(prog.done, 1);
  assert.equal(prog.percent, Math.round((1 / 17) * 100));
  const legal = itemsOfGroup(items, 'legal');
  assert.equal(legal.length, 4);
  assert.deepEqual(auditProgress(items, 'legal'), { done: 0, total: 4, percent: 0 });
  assert.deepEqual(auditProgress([], 'legal'), { done: 0, total: 0, percent: 0 });
});
