/**
 * Tests des paramètres système — masquage des secrets et whitelist.
 * Règles miroir de la Edge Function `admin-settings` (voir
 * supabase-functions-admin-settings-index.ts) : toute modification de
 * la logique doit être reportée des deux côtés.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  SETTING_KEYS,
  SENSITIVE_SETTING_KEYS,
  isAllowedSettingKey,
  maskSecret,
  maskSettings,
} from '../src/admin/sys-settings.js';

describe('sys-settings', () => {
  it('maskSecret garde 6 premiers + •••• + 4 derniers', () => {
    assert.equal(maskSecret('sk-xt-abcdef123456c146'), 'sk-xt-••••c146');
  });

  it('maskSecret respecte le format du cahier des charges', () => {
    // ex. attendu : "sk-xt-••••c146"
    const m = maskSecret('sk-xt-zzzzz12345c146');
    assert.match(m, /^.{6}••••.{4}$/);
    assert.ok(m.startsWith('sk-xt-'));
    assert.ok(m.endsWith('c146'));
  });

  it('maskSecret masque intégralement les secrets courts', () => {
    assert.equal(maskSecret('abc'), '••••');
    assert.equal(maskSecret('1234567890'), '••••'); // 10 caractères
    assert.equal(maskSecret(''), '••••');
    assert.equal(maskSecret(null), '••••');
    assert.equal(maskSecret(undefined), '••••');
  });

  it('maskSecret ne tronque pas un secret de 11 caractères', () => {
    assert.equal(maskSecret('12345678901'), '123456••••8901');
  });

  it('isAllowedSettingKey : whitelist exacte', () => {
    const expected = ['ai_provider', 'ai_api_key', 'ai_model', 'quota_demo', 'quota_starter', 'quota_pro', 'quota_enterprise'];
    assert.deepEqual([...SETTING_KEYS].sort(), expected.sort());
    for (const k of expected) assert.ok(isAllowedSettingKey(k), k + ' doit être autorisée');
    for (const k of ['is_admin', 'plan', 'secret', '', null, undefined, 42]) {
      assert.ok(!isAllowedSettingKey(k), String(k) + ' ne doit PAS être autorisée');
    }
  });

  it('maskSettings ne masque que les clés sensibles', () => {
    const out = maskSettings({
      ai_provider: 'xkiro',
      ai_api_key: 'sk-xt-abcdef123456c146',
      quota_demo: '20',
    });
    assert.equal(out.ai_provider, 'xkiro');
    assert.equal(out.quota_demo, '20');
    assert.equal(out.ai_api_key, 'sk-xt-••••c146');
  });

  it('maskSettings ne modifie pas l\'objet d\'origine', () => {
    const src = { ai_api_key: 'sk-xt-abcdef123456c146' };
    maskSettings(src);
    assert.equal(src.ai_api_key, 'sk-xt-abcdef123456c146');
  });

  it('maskSettings tolère un objet vide ou absent', () => {
    assert.deepEqual(maskSettings({}), {});
    assert.deepEqual(maskSettings(null), {});
    assert.deepEqual(maskSettings(undefined), {});
  });

  it('seule ai_api_key est déclarée sensible', () => {
    assert.deepEqual(SENSITIVE_SETTING_KEYS, ['ai_api_key']);
  });
});
