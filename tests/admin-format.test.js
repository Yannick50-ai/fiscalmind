// Tests des helpers admin (src/admin/format.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planLabel, licenceInfo, canManageUser, fmtXof, fmtDateFR, planShare } from '../src/admin/format.js';

test('planLabel : ADMIN / plan / démo', () => {
  assert.equal(planLabel({ is_admin: true, plan: 'pro' }), 'ADMIN');
  assert.equal(planLabel({ plan: 'starter' }), 'STARTER');
  assert.equal(planLabel({}), 'DÉMO');
  assert.equal(planLabel(null), '—');
});

test('licenceInfo : démo expirée / en cours', () => {
  const now = new Date('2026-10-08T12:00:00Z').getTime();
  const old = licenceInfo({ plan: 'demo', created_at: '2026-10-01T00:00:00Z' }, now);
  assert.equal(old.expired, true);
  assert.equal(old.text, 'Expirée');
  const fresh = licenceInfo({ plan: 'demo', created_at: '2026-10-07T00:00:00Z' }, now);
  assert.equal(fresh.expired, false);
  assert.match(fresh.text, /Jusqu'au/);
});

test('licenceInfo : plan payant avec expiration', () => {
  const now = new Date('2026-10-08T12:00:00Z').getTime();
  const ok = licenceInfo({ plan: 'pro', plan_expires_at: '2026-11-01T00:00:00Z' }, now);
  assert.equal(ok.expired, false);
  const out = licenceInfo({ plan: 'pro', plan_expires_at: '2026-09-01T00:00:00Z' }, now);
  assert.equal(out.expired, true);
  assert.equal(out.text, 'Expirée');
});

test('licenceInfo : admin et sans date → tiret', () => {
  assert.deepEqual(licenceInfo({ is_admin: true }), { text: '—', expired: false });
  assert.deepEqual(licenceInfo({ plan: 'starter' }), { text: '—', expired: false });
});

test('canManageUser : ni soi-même ni un admin', () => {
  assert.equal(canManageUser({ id: 'a' }, 'a'), false); // soi-même
  assert.equal(canManageUser({ id: 'b', is_admin: true }, 'a'), false); // admin
  assert.equal(canManageUser({ id: 'b' }, 'a'), true);
  assert.equal(canManageUser(null, 'a'), false);
});

test('fmtXof et fmtDateFR', () => {
  assert.equal(fmtXof(29900), '29' + '\u202F' + '900 XOF');
  assert.equal(fmtXof(0), '0 XOF');
  assert.equal(fmtDateFR('2026-10-08T00:00:00Z'), '08/10/2026');
  assert.equal(fmtDateFR(null), '—');
});

test('planShare : pourcentages bornés', () => {
  assert.equal(planShare(25, 100), 25);
  assert.equal(planShare(0, 0), 0);
});
