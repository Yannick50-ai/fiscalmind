/**
 * Tests des services externes (étape 3) — node:test, zéro dépendance.
 * Tous les accès réseau / DB sont mockés : on teste les interfaces,
 * les protocoles et les garde-fous, pas les fournisseurs.
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { createSupabaseService, supabaseConfigFromEnv } from '../src/services/supabase.js';
import {
  createR2Service, detectMime, checkFileSize, checkMime,
  quotaStatus, assertQuotaAvailable,
  R2_QUOTA_BYTES, R2_MAX_FILE_BYTES, r2Error,
} from '../src/services/r2.js';
import {
  verifyWebhookSignature, hmacSha256Hex, parseWebhookEvent, classifyEvent,
  licenseFromSale, createSaleRegistry, processWebhook, CHARIOW_PRODUCTS,
} from '../src/services/chariow.js';
import {
  createOcrService, validateOcrInput, extractOcrText, shouldUseLocalFallback,
  OCR_MAX_CHARS,
} from '../src/services/ocr.js';
import { createServices, servicesFromEnv } from '../src/services/index.js';

/* ---------------- utilitaires de mock ---------------- */

function mockFetch(handler) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    return handler(url, init, calls);
  };
  fn.calls = calls;
  return fn;
}
const jsonRes = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

function mockSupabaseClient() {
  const authCalls = [];
  return {
    authCalls,
    auth: {
      signInWithPassword: async (args) => { authCalls.push(['signInWithPassword', args]); return { data: { user: { id: 'u1' } }, error: null }; },
      signUp: async (args) => { authCalls.push(['signUp', args]); return { data: { user: { id: 'u2' } }, error: null }; },
      signOut: async () => { authCalls.push(['signOut']); return { error: null }; },
      getSession: async () => { authCalls.push(['getSession']); return { data: { session: { access_token: 'tok123', user: { id: 'u1' } } } }; },
      getUser: async () => { authCalls.push(['getUser']); return { data: { user: { id: 'u1', email: 'a@b.c' } } }; },
      onAuthStateChange: (cb) => { authCalls.push(['onAuthStateChange']); return { data: { subscription: { unsubscribe: () => {} } } }; },
    },
  };
}
const mockCreateClient = (url, anonKey, opts) => {
  mockCreateClient.last = { url, anonKey, opts };
  return mockSupabaseClient();
};

/* ================= SUPABASE ================= */

describe('supabase — config', () => {
  it('supabaseConfigFromEnv lit SUPABASE_URL / SUPABASE_ANON_KEY', () => {
    const c = supabaseConfigFromEnv({ SUPABASE_URL: 'https://x.supabase.co/', SUPABASE_ANON_KEY: 'k' });
    assert.equal(c.url, 'https://x.supabase.co');
    assert.equal(c.anonKey, 'k');
  });
  it('supabaseConfigFromEnv lève si incomplet (aucun secret en dur)', () => {
    assert.throws(() => supabaseConfigFromEnv({}), /SUPABASE_URL/);
    assert.throws(() => supabaseConfigFromEnv({ SUPABASE_URL: 'https://x' }), /SUPABASE_ANON_KEY/);
  });
  it('createSupabaseService exige createClient injecté', () => {
    assert.throws(() => createSupabaseService({ url: 'https://x', anonKey: 'k' }), /createClient/);
  });
});

describe('supabase — auth', () => {
  let svc, client;
  beforeEach(() => {
    client = mockSupabaseClient();
    svc = createSupabaseService({ url: 'https://x.supabase.co', anonKey: 'anon', createClient: () => client });
  });
  it('signIn transmet email/password à signInWithPassword', async () => {
    await svc.signIn({ email: 'a@b.c', password: 'secret' });
    assert.deepEqual(client.authCalls[0], ['signInWithPassword', { email: 'a@b.c', password: 'secret' }]);
  });
  it("signUp crée le compte avec plan 'demo' en user_metadata", async () => {
    await svc.signUp({ email: 'a@b.c', password: 'secret', name: 'Yannick' });
    const [, args] = client.authCalls[0];
    assert.deepEqual(args, { email: 'a@b.c', password: 'secret', options: { data: { name: 'Yannick', plan: 'demo' } } });
  });
  it('getSession retourne la session ou null', async () => {
    const s = await svc.getSession();
    assert.equal(s.access_token, 'tok123');
  });
  it('signOut appelle auth.signOut', async () => {
    await svc.signOut();
    assert.deepEqual(client.authCalls[0], ['signOut']);
  });
});

describe('supabase — edge functions', () => {
  let fetchImpl, svc;
  beforeEach(() => {
    fetchImpl = mockFetch(async (url, init) => jsonRes(200, { answer: 'ok', plan: 'starter', remaining: 49 }));
    svc = createSupabaseService({ url: 'https://x.supabase.co', anonKey: 'anon', createClient: mockCreateClient, fetchImpl });
  });
  it("edgeFunction envoie le Bearer JWT et le corps JSON vers /functions/v1/<fn>", async () => {
    const r = await svc.edgeFunction({ fn: 'copilot', accessToken: 'tok123', body: { question: 'TVA ?' } });
    assert.equal(r.answer, 'ok');
    const [{ url, init }] = fetchImpl.calls;
    assert.equal(url, 'https://x.supabase.co/functions/v1/copilot');
    assert.equal(init.method, 'POST');
    assert.equal(init.headers.Authorization, 'Bearer tok123');
    assert.equal(init.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(init.body), { question: 'TVA ?' });
  });
  it('edgeFunction lève avec le message serveur si !ok', async () => {
    fetchImpl = mockFetch(async () => jsonRes(403, { error: 'Quota épuisé' }));
    svc = createSupabaseService({ url: 'https://x.supabase.co', anonKey: 'anon', createClient: mockCreateClient, fetchImpl });
    await assert.rejects(
      svc.edgeFunction({ fn: 'copilot', accessToken: 't', body: {} }),
      (e) => e.message === 'Quota épuisé' && e.status === 403 && e.fn === 'copilot'
    );
  });
  it('edgeFunction exige un accessToken (NOT_AUTHENTICATED)', async () => {
    await assert.rejects(
      svc.edgeFunction({ fn: 'copilot', accessToken: '', body: {} }),
      (e) => e.code === 'NOT_AUTHENTICATED'
    );
  });
  it("getQuota poste { action: 'quota' } vers copilot", async () => {
    await svc.getQuota({ accessToken: 'tok123' });
    const [{ url, init }] = fetchImpl.calls;
    assert.equal(url, 'https://x.supabase.co/functions/v1/copilot');
    assert.deepEqual(JSON.parse(init.body), { action: 'quota' });
  });
  it('askCopilot transmet question, country et taxOverrides', async () => {
    await svc.askCopilot({ accessToken: 't', question: 'IS ?', country: 'Burkina Faso', taxOverrides: { tva: 18 } });
    const [{ init }] = fetchImpl.calls;
    assert.deepEqual(JSON.parse(init.body), { question: 'IS ?', country: 'Burkina Faso', taxOverrides: { tva: 18 } });
  });
  it('adminListUsers fait un GET vers admin-users', async () => {
    await svc.adminListUsers({ accessToken: 't' });
    const [{ url, init }] = fetchImpl.calls;
    assert.equal(url, 'https://x.supabase.co/functions/v1/admin-users');
    assert.equal(init.method, 'GET');
  });
  it('adminSettings sans clé fait un GET vers admin-settings', async () => {
    await svc.adminSettings({ accessToken: 't' });
    const [{ url, init }] = fetchImpl.calls;
    assert.equal(url, 'https://x.supabase.co/functions/v1/admin-settings');
    assert.equal(init.method, 'GET');
    assert.equal(init.body, undefined);
  });
  it("adminSettings avec { key, value } poste vers admin-settings", async () => {
    await svc.adminSettings({ accessToken: 't', key: 'ai_provider', value: 'xkiro' });
    const [{ url, init }] = fetchImpl.calls;
    assert.equal(url, 'https://x.supabase.co/functions/v1/admin-settings');
    assert.equal(init.method, 'POST');
    assert.deepEqual(JSON.parse(init.body), { key: 'ai_provider', value: 'xkiro' });
  });
  it("adminSettings avec action test_ai poste { action: 'test_ai' }", async () => {
    await svc.adminSettings({ accessToken: 't', action: 'test_ai' });
    const [{ url, init }] = fetchImpl.calls;
    assert.equal(url, 'https://x.supabase.co/functions/v1/admin-settings');
    assert.deepEqual(JSON.parse(init.body), { action: 'test_ai' });
  });
  it('adminIntegrations fait un GET ?service=... vers admin-integrations avec le JWT', async () => {
    await svc.adminIntegrations({ accessToken: 't', service: 'chariow' });
    const [{ url, init }] = fetchImpl.calls;
    assert.equal(url, 'https://x.supabase.co/functions/v1/admin-integrations?service=chariow');
    assert.equal(init.method, 'GET');
    assert.equal(init.headers.Authorization, 'Bearer t');
    assert.equal(init.body, undefined);
  });
  it('adminIntegrations encode le nom du service et exige un service', async () => {
    await svc.adminIntegrations({ accessToken: 't', service: 'a b' });
    const [{ url }] = fetchImpl.calls;
    assert.equal(url, 'https://x.supabase.co/functions/v1/admin-integrations?service=a%20b');
    await assert.rejects(
      svc.adminIntegrations({ accessToken: 't' }),
      (e) => e.message === 'adminIntegrations : service requis'
    );
  });
  it("r2Call poste { action, ...payload } vers r2-storage", async () => {
    await svc.r2Call({ accessToken: 't', action: 'list', payload: {} });
    const [{ url, init }] = fetchImpl.calls;
    assert.equal(url, 'https://x.supabase.co/functions/v1/r2-storage');
    assert.deepEqual(JSON.parse(init.body), { action: 'list' });
  });
});

/* ================= R2 ================= */

describe('r2 — garde-fous purs', () => {
  it('detectMime : type explicite prioritaire, sinon extension, sinon image/jpeg', () => {
    assert.equal(detectMime({ name: 'x.pdf' }), 'application/pdf');
    assert.equal(detectMime({ name: 'x.PNG' }), 'image/png');
    assert.equal(detectMime({ name: 'x.webp' }), 'image/webp');
    assert.equal(detectMime({ name: 'x.jpg' }), 'image/jpeg');
    assert.equal(detectMime({ name: 'x.JPG', type: 'image/png' }), 'image/png');
    assert.equal(detectMime({ name: 'sans-extension' }), 'image/jpeg');
  });
  it('checkFileSize refuse > 50 Mo', () => {
    assert.equal(checkFileSize(1024), 1024);
    assert.throws(() => checkFileSize(R2_MAX_FILE_BYTES + 1), (e) => e.code === 'FILE_TOO_LARGE');
    assert.throws(() => checkFileSize(0), (e) => e.code === 'INVALID_SIZE');
  });
  it('checkMime refuse les types non pris en charge', () => {
    assert.equal(checkMime('application/pdf'), 'application/pdf');
    assert.throws(() => checkMime('text/plain'), (e) => e.code === 'UNSUPPORTED_TYPE');
    assert.throws(() => checkMime('video/mp4'), (e) => e.code === 'UNSUPPORTED_TYPE');
  });
  it('quotaStatus calcule utilisé / restant / pourcentage', () => {
    const q = quotaStatus([{ size: 600 * 1024 * 1024 }, { size: 100 }]);
    assert.equal(q.used, 600 * 1024 * 1024 + 100);
    assert.equal(q.quota, R2_QUOTA_BYTES);
    assert.equal(q.remaining, R2_QUOTA_BYTES - q.used);
    assert.ok(q.percent > 58 && q.percent < 59);
  });
  it('assertQuotaAvailable lève QUOTA_EXCEEDED au-delà d’1 Go', () => {
    assert.equal(assertQuotaAvailable([{ size: 100 }], 1024), true);
    assert.throws(
      () => assertQuotaAvailable([{ size: R2_QUOTA_BYTES - 10 }], 100),
      (e) => e.code === 'QUOTA_EXCEEDED'
    );
  });
});

describe('r2 — upload / suppression (edgeCall mocké)', () => {
  let edgeCalls, edgeCall, fetchImpl, svc;
  beforeEach(() => {
    edgeCalls = [];
    edgeCall = async (action, payload) => {
      edgeCalls.push({ action, payload });
      if (action === 'upload-url') return { upload_url: 'https://r2.test/put', key: 'docs/u1/facture.pdf' };
      if (action === 'confirm') return { id: 'doc1', name: payload.name };
      if (action === 'delete') return { deleted: true };
      if (action === 'list') return { docs: [] };
      throw new Error('action inconnue');
    };
    fetchImpl = mockFetch(async () => ({ ok: true, status: 200 }));
    svc = createR2Service({ edgeCall, fetchImpl });
  });
  const pdf = (size = 1024) => ({ name: 'facture.pdf', type: 'application/pdf', size, body: Buffer.alloc(size) });

  it('getUploadUrl valide taille et type AVANT l’appel', async () => {
    await assert.rejects(svc.getUploadUrl({ filename: 'gros.pdf', contentType: 'application/pdf', sizeBytes: R2_MAX_FILE_BYTES + 1 }),
      (e) => e.code === 'FILE_TOO_LARGE');
    await assert.rejects(svc.getUploadUrl({ filename: 'x.txt', contentType: 'text/plain', sizeBytes: 10 }),
      (e) => e.code === 'UNSUPPORTED_TYPE');
    assert.equal(edgeCalls.length, 0);
  });
  it('uploadFile : upload-url → PUT pré-signé → confirm', async () => {
    const r = await svc.uploadFile({ file: pdf(), meta: { type: 'facture', org: 'SONABEL' } });
    assert.equal(r.key, 'docs/u1/facture.pdf');
    assert.equal(r.id, 'doc1');
    assert.deepEqual(edgeCalls.map((c) => c.action), ['upload-url', 'confirm']);
    const [{ url, init }] = fetchImpl.calls;
    assert.equal(url, 'https://r2.test/put');
    assert.equal(init.method, 'PUT');
    assert.equal(init.headers['Content-Type'], 'application/pdf');
    const confirm = edgeCalls[1].payload;
    assert.equal(confirm.key, 'docs/u1/facture.pdf');
    assert.equal(confirm.mime_type, 'application/pdf');
    assert.equal(confirm.org, 'SONABEL');
  });
  it('uploadFile refuse si le quota serait dépassé', async () => {
    const docs = [{ size: R2_QUOTA_BYTES - 500 }];
    await assert.rejects(svc.uploadFile({ file: pdf(1000), existingDocs: docs }),
      (e) => e.code === 'QUOTA_EXCEEDED');
    assert.equal(edgeCalls.length, 0);
  });
  it('uploadFile lève UPLOAD_FAILED si le PUT échoue', async () => {
    fetchImpl = mockFetch(async () => ({ ok: false, status: 500 }));
    svc = createR2Service({ edgeCall, fetchImpl });
    await assert.rejects(svc.uploadFile({ file: pdf() }), (e) => e.code === 'UPLOAD_FAILED');
  });
  it('deleteFile appelle edgeCall delete', async () => {
    const r = await svc.deleteFile({ key: 'docs/u1/x.pdf' });
    assert.equal(r.deleted, true);
    assert.deepEqual(edgeCalls[0], { action: 'delete', payload: { key: 'docs/u1/x.pdf' } });
  });
  it('listDocs appelle edgeCall list', async () => {
    const r = await svc.listDocs();
    assert.deepEqual(r, { docs: [] });
  });
  it('r2Error porte un code', () => {
    assert.equal(r2Error('X', 'msg').code, 'X');
  });
});

/* ================= CHARIOW ================= */

const TEST_SECRET = 'whsec_test_123';
const signBody = (body) => hmacSha256Hex(body, TEST_SECRET);
const salePayload = (over = {}) => JSON.stringify({
  type: 'successful.sale',
  data: {
    customer: { email: 'Client@Example.com' },
    product: { id: 'prd_co1troj3' },
    sale: { id: 'sale_001', amount: 29900 },
    ...over,
  },
});

describe('chariow — signature webhook', () => {
  it('signature valide → true', () => {
    const body = salePayload();
    assert.equal(verifyWebhookSignature({ rawBody: body, signature: signBody(body), secret: TEST_SECRET }), true);
  });
  it('mauvais secret → false', () => {
    const body = salePayload();
    assert.equal(verifyWebhookSignature({ rawBody: body, signature: signBody(body), secret: 'mauvais' }), false);
  });
  it('corps altéré → false', () => {
    const body = salePayload();
    assert.equal(verifyWebhookSignature({ rawBody: body + 'x', signature: signBody(body), secret: TEST_SECRET }), false);
  });
  it('signature absente ou secret absent → false', () => {
    assert.equal(verifyWebhookSignature({ rawBody: 'x', signature: '', secret: TEST_SECRET }), false);
    assert.equal(verifyWebhookSignature({ rawBody: 'x', signature: signBody('x'), secret: '' }), false);
  });
  it('comparaison insensible à la casse (portée du source)', () => {
    const body = salePayload();
    assert.equal(verifyWebhookSignature({ rawBody: body, signature: signBody(body).toUpperCase(), secret: TEST_SECRET }), true);
  });
  it('préfixe sha256= retiré avant comparaison (format Chariow réel)', () => {
    const body = salePayload();
    assert.equal(verifyWebhookSignature({ rawBody: body, signature: 'sha256=' + signBody(body), secret: TEST_SECRET }), true);
    assert.equal(verifyWebhookSignature({ rawBody: body, signature: 'SHA256=' + signBody(body), secret: TEST_SECRET }), true);
  });
});

describe('chariow — parsing et classification', () => {
  it("parseWebhookEvent extrait les champs (variante data.*)", () => {
    const e = parseWebhookEvent(salePayload());
    assert.equal(e.type, 'successful.sale');
    assert.equal(e.email, 'client@example.com');
    assert.equal(e.productId, 'prd_co1troj3');
    assert.equal(e.saleId, 'sale_001');
    assert.equal(e.amount, 29900);
  });
  it('parseWebhookEvent tolère le format à plat (sans data)', () => {
    const e = parseWebhookEvent(JSON.stringify({ event: 'issued.licence', customer: { email: 'A@B.C' }, product_id: 'prd_zg2w9ck2', id: 's9' }));
    assert.equal(e.type, 'issued.licence');
    assert.equal(e.email, 'a@b.c');
    assert.equal(e.productId, 'prd_zg2w9ck2');
    assert.equal(e.saleId, 's9');
  });
  it('parseWebhookEvent lève INVALID_JSON sur corps invalide', () => {
    assert.throws(() => parseWebhookEvent('pas du json'), (e) => e.code === 'INVALID_JSON');
  });
  it('classifyEvent : activate / deactivate / ignore', () => {
    assert.equal(classifyEvent('successful.sale'), 'activate');
    assert.equal(classifyEvent('activated.licence'), 'activate');
    assert.equal(classifyEvent('expired.licence'), 'deactivate');
    assert.equal(classifyEvent('refunded.sale'), 'deactivate');
    assert.equal(classifyEvent('ping'), 'ignore');
    assert.equal(classifyEvent(''), 'ignore');
  });
});

describe('chariow — licence', () => {
  const now = new Date('2026-10-08T12:00:00Z');
  it('prd_co1troj3 → starter, 30 jours', () => {
    const l = licenseFromSale({ productId: 'prd_co1troj3', now });
    assert.equal(l.plan, 'starter');
    assert.equal(l.days, 30);
    assert.equal(l.expiresAt, new Date(now.getTime() + 30 * 86400000).toISOString());
  });
  it('prd_zg2w9ck2 → pro, 30 jours', () => {
    const l = licenseFromSale({ productId: 'prd_zg2w9ck2', now });
    assert.equal(l.plan, 'pro');
  });
  it('produit inconnu → rejeté, JAMAIS de Pro offert', () => {
    for (const pid of ['prd_inconnu', null, undefined, '']) {
      const l = licenseFromSale({ productId: pid, now });
      assert.equal(l.rejected, true);
      assert.equal(l.reason, 'unknown_product');
      assert.ok(!('plan' in l), 'aucun plan ne doit être attribué');
    }
  });
  it('expiresAt fourni par la vente est conservé', () => {
    const l = licenseFromSale({ productId: 'prd_co1troj3', expiresAt: '2026-11-07T00:00:00Z', now });
    assert.equal(l.expiresAt, '2026-11-07T00:00:00Z');
  });
  it('CHARIOW_PRODUCTS contient exactement les 2 produits boutique', () => {
    assert.deepEqual(Object.keys(CHARIOW_PRODUCTS).sort(), ['prd_co1troj3', 'prd_zg2w9ck2']);
  });
});

describe('chariow — processWebhook (bout en bout, mocks)', () => {
  const resolveUser = async (email) => (email === 'client@example.com' ? 'user-42' : null);
  const run = (body, opts = {}) => processWebhook({
    rawBody: body,
    signature: signBody(body),
    secret: TEST_SECRET,
    resolveUser,
    ...opts,
  });

  it('vente valide → activated (starter)', async () => {
    const r = await run(salePayload());
    assert.equal(r.status, 'activated');
    assert.equal(r.plan, 'starter');
    assert.equal(r.userId, 'user-42');
    assert.equal(r.saleId, 'sale_001');
  });
  it('sale_id dupliqué → already_processed (anti-doublon)', async () => {
    const registry = createSaleRegistry();
    const body = salePayload();
    const r1 = await run(body, { registry });
    const r2 = await run(body, { registry });
    assert.equal(r1.status, 'activated');
    assert.equal(r2.status, 'already_processed');
  });
  it('produit inconnu → unknown_product (rien n’est activé)', async () => {
    const r = await run(salePayload({ product: { id: 'prd_pirate' } }));
    assert.equal(r.status, 'unknown_product');
    assert.ok(r.plan === undefined);
  });
  it('expired.licence → downgraded', async () => {
    const body = JSON.stringify({ type: 'expired.licence', data: { customer: { email: 'client@example.com' } } });
    const r = await run(body);
    assert.equal(r.status, 'downgraded');
    assert.equal(r.userId, 'user-42');
  });
  it('signature invalide → invalid_signature', async () => {
    const body = salePayload();
    const r = await processWebhook({ rawBody: body, signature: 'mauvaise', secret: TEST_SECRET, resolveUser });
    assert.equal(r.status, 'invalid_signature');
  });
  it('email sans compte → no_matching_user', async () => {
    const body = salePayload({ customer: { email: 'inconnu@x.y' } });
    const r = await run(body);
    assert.equal(r.status, 'no_matching_user');
  });
  it('type inconnu → ignored', async () => {
    const body = JSON.stringify({ type: 'ping', data: {} });
    const r = await run(body);
    assert.equal(r.status, 'ignored');
  });
  it('email manquant → missing_email', async () => {
    const body = JSON.stringify({ type: 'successful.sale', data: { product: { id: 'prd_co1troj3' } } });
    const r = await run(body);
    assert.equal(r.status, 'missing_email');
  });
});

/* ================= OCR ================= */

const dataUrl = (mime = 'image/png', b64 = 'aGVsbG8=') => `data:${mime};base64,${b64}`;

describe('ocr — validation d’entrée', () => {
  it('accepte image/png et application/pdf', () => {
    assert.equal(validateOcrInput({ dataUrl: dataUrl('image/png') }).ok, true);
    assert.equal(validateOcrInput({ dataUrl: dataUrl('application/pdf') }).ok, true);
  });
  it('refuse les types non pris en charge', () => {
    const v = validateOcrInput({ dataUrl: dataUrl('text/plain') });
    assert.equal(v.ok, false);
    assert.equal(v.code, 'UNSUPPORTED_TYPE');
  });
  it('refuse les documents trop volumineux', () => {
    const big = 'data:image/png;base64,' + 'A'.repeat(OCR_MAX_CHARS);
    const v = validateOcrInput({ dataUrl: big });
    assert.equal(v.ok, false);
    assert.equal(v.code, 'FILE_TOO_LARGE');
  });
  it('refuse l’absence de document', () => {
    assert.equal(validateOcrInput({}).ok, false);
    assert.equal(validateOcrInput({ dataUrl: '' }).code, 'MISSING_FILE');
  });
  it('langue non reconnue → repli sur fre', () => {
    assert.equal(validateOcrInput({ dataUrl: dataUrl(), language: 'wolof' }).language, 'fre');
    assert.equal(validateOcrInput({ dataUrl: dataUrl(), language: 'eng' }).language, 'eng');
  });
});

describe('ocr — extractOcrText / shouldUseLocalFallback', () => {
  it('extrait ParsedText du premier résultat', () => {
    assert.equal(extractOcrText({ ParsedResults: [{ ParsedText: '  FACTURE 123  ' }] }), 'FACTURE 123');
  });
  it('retourne chaîne vide si rien d’exploitable', () => {
    assert.equal(extractOcrText({}), '');
    assert.equal(extractOcrText({ ParsedResults: [] }), '');
  });
  it('fallback local si consentement refusé', () => {
    assert.equal(shouldUseLocalFallback({ consent: false }), true);
  });
  it('fallback local si erreur de service', () => {
    assert.equal(shouldUseLocalFallback({ consent: true, serviceError: true }), true);
  });
  it('pas de fallback si consentement OK et service OK', () => {
    assert.equal(shouldUseLocalFallback({ consent: true, serviceError: false }), false);
  });
});

describe('ocr — requestOcr (invokeOcr mocké)', () => {
  const invokeOk = async () => ({ ParsedResults: [{ ParsedText: 'TOTAL 118000' }], IsErroredOnProcessing: false });
  let svc;
  beforeEach(() => { svc = createOcrService({ invokeOcr: invokeOk }); });

  it('sans consentement explicite → CONSENT_REQUIRED (aucun appel)', async () => {
    let called = 0;
    svc = createOcrService({ invokeOcr: async () => { called++; return {}; } });
    await assert.rejects(
      svc.requestOcr({ accessToken: 't', dataUrl: dataUrl(), consent: false }),
      (e) => e.code === 'CONSENT_REQUIRED'
    );
    assert.equal(called, 0);
  });
  it('sans token → NOT_AUTHENTICATED', async () => {
    await assert.rejects(
      svc.requestOcr({ accessToken: '', dataUrl: dataUrl(), consent: true }),
      (e) => e.code === 'NOT_AUTHENTICATED'
    );
  });
  it('document invalide → refus avant appel', async () => {
    await assert.rejects(
      svc.requestOcr({ accessToken: 't', dataUrl: dataUrl('text/plain'), consent: true }),
      (e) => e.code === 'UNSUPPORTED_TYPE'
    );
  });
  it('succès → texte extrait', async () => {
    const r = await svc.requestOcr({ accessToken: 'tok', dataUrl: dataUrl(), consent: true });
    assert.equal(r.text, 'TOTAL 118000');
  });
  it('réponse vide → OCR_EMPTY avec localFallback', async () => {
    svc = createOcrService({ invokeOcr: async () => ({ ParsedResults: [{ ParsedText: '   ' }] }) });
    await assert.rejects(
      svc.requestOcr({ accessToken: 't', dataUrl: dataUrl(), consent: true }),
      (e) => e.code === 'OCR_EMPTY' && e.localFallback === true
    );
  });
  it('panne du service → OCR_SERVICE_ERROR avec localFallback', async () => {
    svc = createOcrService({ invokeOcr: async () => { throw new Error('timeout'); } });
    await assert.rejects(
      svc.requestOcr({ accessToken: 't', dataUrl: dataUrl(), consent: true }),
      (e) => e.code === 'OCR_SERVICE_ERROR' && e.localFallback === true
    );
  });
  it("invokeOcr reçoit le token et le corps { base64Image, language }", async () => {
    let seen;
    svc = createOcrService({ invokeOcr: async (args) => { seen = args; return { ParsedResults: [{ ParsedText: 'x' }] }; } });
    await svc.requestOcr({ accessToken: 'tokABC', dataUrl: dataUrl('application/pdf'), language: 'eng', consent: true });
    assert.equal(seen.accessToken, 'tokABC');
    assert.equal(seen.body.language, 'eng');
    assert.ok(seen.body.base64Image.startsWith('data:application/pdf;base64,'));
  });
});

/* ================= INDEX / FABRIQUE ================= */

describe('index — createServices / servicesFromEnv', () => {
  it('createServices assemble les mocks injectés', () => {
    const mocks = { supabase: { id: 'sb' }, r2: { id: 'r2' }, ocr: { id: 'ocr' } };
    const s = createServices(mocks);
    assert.equal(s.supabase.id, 'sb');
    assert.equal(s.r2.id, 'r2');
    assert.equal(s.ocr.id, 'ocr');
    assert.ok(s.chariow.verifyWebhookSignature, 'module chariow par défaut');
  });
  it('servicesFromEnv câble r2 et ocr sur supabase (mocks)', async () => {
    const fetchImpl = mockFetch(async (url) => {
      if (url.includes('r2-storage')) return jsonRes(200, { docs: [{ size: 10 }] });
      return jsonRes(200, { ParsedResults: [{ ParsedText: 'lu' }] });
    });
    const s = servicesFromEnv({
      env: { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon' },
      createClient: mockCreateClient,
      fetchImpl,
    });
    assert.ok(s.supabase && s.r2 && s.ocr && s.chariow);
    const docs = await s.r2.listDocs();
    assert.deepEqual(docs.docs, [{ size: 10 }]);
    assert.equal(docs.status, 200);
    const r2call = fetchImpl.calls.find((c) => c.url.includes('r2-storage'));
    assert.equal(r2call.init.headers.Authorization, 'Bearer tok123');
    const ocrRes = await s.ocr.requestOcr({ accessToken: 'tok', dataUrl: dataUrl(), consent: true });
    assert.equal(ocrRes.text, 'lu');
    const ocrCall = fetchImpl.calls.find((c) => c.url.includes('/functions/v1/ocr'));
    assert.ok(ocrCall, 'appel vers la fonction ocr');
  });
  it('servicesFromEnv lève sans variables d’environnement', () => {
    assert.throws(() => servicesFromEnv({ env: {}, createClient: mockCreateClient }), /SUPABASE_URL/);
  });
});
