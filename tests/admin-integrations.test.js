/**
 * Tests des intégrations externes (Chariow / Supabase / Cloudflare).
 * Règles miroir de la Edge Function `admin-integrations` (voir
 * supabase-functions-admin-integrations-index.ts) via le module
 * src/admin/integrations.js : toute modification de la logique doit être
 * reportée des deux côtés.
 *
 * Aucun appel HTTP réel : fetch est injecté (mocks).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  maskSecret,
  maskEmail,
  isKnownService,
  toArray,
  ExternalApiError,
  httpErrorMessage,
  networkErrorMessage,
  chariowHeaders,
  formatChariowSale,
  formatChariowProduct,
  formatChariowPulse,
  pickMainPulse,
  parseSupabaseFunctionStats,
  supabaseFunctionStatsUrl,
  formatCloudflareDeployment,
  fetchChariowStatus,
  fetchSupabaseStatus,
  fetchCloudflareStatus,
  TARGET_SUPABASE_FUNCTIONS,
  SUPABASE_PROJECT_REF,
  BROWSER_UA,
} from '../src/admin/integrations.js';

// --- utilitaires de mock -----------------------------------------------

const jsonResponse = (data, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => data,
});
const httpFail = (status) => async () => jsonResponse({}, status);
const netFail = () => async () => {
  throw new Error('socket hang up');
};
const timeoutFail = () => async () => {
  const e = new Error('The operation was aborted due to timeout');
  e.name = 'TimeoutError';
  throw e;
};
const abortFail = () => async () => {
  const e = new Error('aborted');
  e.name = 'AbortError';
  throw e;
};

describe('maskSecret (ré-export sys-settings)', () => {
  it('garde 6 premiers + •••• + 4 derniers', () => {
    assert.equal(maskSecret('sk-xt-abcdef123456c146'), 'sk-xt-••••c146');
  });
  it('masque intégralement les secrets courts', () => {
    assert.equal(maskSecret('abc'), '••••');
    assert.equal(maskSecret(''), '••••');
    assert.equal(maskSecret(null), '••••');
  });
});

describe('maskEmail', () => {
  it("masque l'email : 1er caractère + ***@domaine", () => {
    assert.equal(maskEmail('jean.dupont@gmail.com'), 'j***@gmail.com');
    assert.equal(maskEmail('acheteur.test.fiscalmind@gmail.com'), 'a***@gmail.com');
  });
  it('gère les parties locales courtes', () => {
    assert.equal(maskEmail('a@b.co'), 'a***@b.co');
    assert.equal(maskEmail('x@y.com'), 'x***@y.com');
  });
  it('masque intégralement les emails invalides', () => {
    assert.equal(maskEmail(''), '••••');
    assert.equal(maskEmail('sans-arobase'), '••••');
    assert.equal(maskEmail('a@'), '••••');
    assert.equal(maskEmail('@b.com'), '••••');
    assert.equal(maskEmail(null), '••••');
    assert.equal(maskEmail(undefined), '••••');
  });
  it('rogne les espaces', () => {
    assert.equal(maskEmail('  jean@gmail.com  '), 'j***@gmail.com');
  });
});

describe('isKnownService', () => {
  it('accepte les 3 services connus (insensible à la casse)', () => {
    for (const s of ['chariow', 'supabase', 'cloudflare', '  Chariow ']) {
      assert.ok(isKnownService(s), s);
    }
  });
  it('rejette le reste', () => {
    for (const s of ['stripe', '', null, undefined, 42, 'chariow2']) {
      assert.ok(!isKnownService(s), String(s));
    }
  });
});

describe('toArray', () => {
  it('accepte les variantes de payload', () => {
    assert.deepEqual(toArray([1, 2]), [1, 2]);
    assert.deepEqual(toArray({ data: [1] }), [1]);
    assert.deepEqual(toArray({ items: [2] }), [2]);
    assert.deepEqual(toArray({ result: [3] }), [3]);
  });
  it('renvoie [] pour le reste', () => {
    assert.deepEqual(toArray(null), []);
    assert.deepEqual(toArray(undefined), []);
    assert.deepEqual(toArray({}), []);
    assert.deepEqual(toArray('x'), []);
  });
});

describe('formatChariowSale', () => {
  const saleNiche = {
    id: 'sale_123',
    created_at: '2026-10-08T12:00:00Z',
    amount: 29900,
    status: 'paid',
    product: { id: 'prd_co1troj3', name: 'Licence Starter' },
    customer: { email: 'jean.dupont@gmail.com' },
  };
  it('formate une vente complète', () => {
    assert.deepEqual(formatChariowSale(saleNiche), {
      id: 'sale_123',
      date: '2026-10-08T12:00:00Z',
      produit: 'Licence Starter',
      montant: 29900,
      email_masque: 'j***@gmail.com',
      statut: 'paid',
    });
  });
  it('tolère la forme plate (product_id, email racine)', () => {
    const out = formatChariowSale(
      { id: 7, createdAt: '2026-10-01', total: '79900', state: 'completed', product_id: 'prd_zg2w9ck2', email: 'acheteur.test.fiscalmind@gmail.com' },
      { prd_zg2w9ck2: 'Licence Pro' }
    );
    assert.equal(out.produit, 'Licence Pro');
    assert.equal(out.montant, 79900);
    assert.equal(out.email_masque, 'a***@gmail.com');
    assert.equal(out.statut, 'completed');
    assert.equal(out.id, 7);
  });
  it('valeurs par défaut quand tout manque', () => {
    assert.deepEqual(formatChariowSale(null), {
      id: null,
      date: null,
      produit: '—',
      montant: 0,
      email_masque: '—',
      statut: '—',
    });
  });
});

describe('formatChariowProduct', () => {
  it('formate un produit complet', () => {
    assert.deepEqual(formatChariowProduct({ id: 'prd_co1troj3', name: 'Licence Starter', price: 29900 }), {
      id: 'prd_co1troj3',
      nom: 'Licence Starter',
      prix: 29900,
    });
  });
  it('tolère les variantes (title, amount)', () => {
    assert.deepEqual(formatChariowProduct({ id: 'x', title: 'Pack', amount: '5000' }), {
      id: 'x',
      nom: 'Pack',
      prix: 5000,
    });
  });
  it('défauts', () => {
    assert.deepEqual(formatChariowProduct({}), { id: null, nom: '—', prix: 0 });
  });
});

describe('formatChariowPulse / pickMainPulse', () => {
  it('pulse actif avec événements', () => {
    assert.deepEqual(
      formatChariowPulse({ id: 'pulse_zkhu53pnaic0', url: 'https://xxx.supabase.co/functions/v1/chariow-webhook', events: ['successful_sale', 'refunded_sale'] }),
      {
        actif: true,
        id: 'pulse_zkhu53pnaic0',
        url: 'https://xxx.supabase.co/functions/v1/chariow-webhook',
        evenements_configures: ['successful_sale', 'refunded_sale'],
        derniers_evenements: [],
      }
    );
  });
  it('pulse inactif (disabled / sans événements)', () => {
    assert.equal(formatChariowPulse({ id: 'p', status: 'disabled', events: ['x'] }).actif, false);
    assert.equal(formatChariowPulse({ id: 'p', events: [] }).actif, false);
    assert.equal(formatChariowPulse({ id: 'p' }).actif, false);
  });
  it("pickMainPulse préfère l'URL Supabase/webhook", () => {
    const pulses = [
      { id: 'p1', url: 'https://example.com/hook', events: ['a'] },
      { id: 'p2', url: 'https://xxx.supabase.co/functions/v1/chariow-webhook', events: ['successful_sale'] },
    ];
    assert.equal(pickMainPulse(pulses).id, 'p2');
    assert.equal(pickMainPulse([pulses[0]]).id, 'p1');
    assert.equal(pickMainPulse([]), null);
    assert.equal(pickMainPulse(null), null);
  });
});

describe('parseSupabaseFunctionStats', () => {
  it('calcule invocations et taux d’erreur par fonction', () => {
    const out = parseSupabaseFunctionStats({
      result: [
        { fn: 'copilot', invocations: 100, erreurs: 4 },
        { fn: 'chariow-webhook', invocations: 20, erreurs: 0 },
        { fn: '', invocations: 5, erreurs: 5 },
      ],
    });
    assert.deepEqual(out.copilot, { invocations: 100, tauxErreur: 4 });
    assert.deepEqual(out['chariow-webhook'], { invocations: 20, tauxErreur: 0 });
    assert.ok(!('' in out));
  });
  it('taux_erreur null quand aucune invocation', () => {
    assert.deepEqual(parseSupabaseFunctionStats([{ fn: 'copilot', invocations: 0, erreurs: 0 }]).copilot, {
      invocations: 0,
      tauxErreur: null,
    });
  });
  it('tolère un corps vide', () => {
    assert.deepEqual(parseSupabaseFunctionStats({}), {});
    assert.deepEqual(parseSupabaseFunctionStats(null), {});
  });
  it('cibles surveillées = les 5 fonctions du projet', () => {
    assert.deepEqual(TARGET_SUPABASE_FUNCTIONS, [
      'copilot',
      'chariow-webhook',
      'admin-settings',
      'admin-users',
      'admin-stats',
    ]);
  });
});

describe('supabaseFunctionStatsUrl', () => {
  it('pointe le bon projet et une fenêtre de 24 h', () => {
    const u = new URL(supabaseFunctionStatsUrl());
    assert.ok(u.origin + u.pathname === `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/analytics/endpoints/logs`);
    const start = new Date(u.searchParams.get('iso_timestamp_start'));
    const end = new Date(u.searchParams.get('iso_timestamp_end'));
    assert.ok(!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()));
    assert.equal(end.getTime() - start.getTime(), 24 * 3600 * 1000);
    assert.match(u.searchParams.get('iso_timestamp_end'), /Z$/);
    assert.match(u.searchParams.get('sql'), /function_edge_logs/);
  });
});

describe('formatCloudflareDeployment', () => {
  it('mappe les statuts FR', () => {
    assert.deepEqual(
      formatCloudflareDeployment({ created_on: '2026-10-09T04:20:00Z', latest_stage: { status: 'success' }, url: 'https://abc.fiscalmind-africa.pages.dev' }),
      { date: '2026-10-09T04:20:00Z', statut: 'réussi', url: 'https://abc.fiscalmind-africa.pages.dev' }
    );
    assert.equal(formatCloudflareDeployment({ latest_stage: { status: 'failure' } }).statut, 'échec');
    assert.equal(formatCloudflareDeployment({ latest_stage: { status: 'active' } }).statut, 'en cours');
    assert.equal(formatCloudflareDeployment({ latest_stage: { status: 'idle' } }).statut, 'en cours');
  });
  it('défauts', () => {
    assert.deepEqual(formatCloudflareDeployment({}), { date: null, statut: '—', url: null });
  });
});

describe('httpErrorMessage / networkErrorMessage', () => {
  it('401/403/404/429/5xx → messages FR', () => {
    assert.match(httpErrorMessage(401, 'Chariow'), /clé rejetée/);
    assert.match(httpErrorMessage(401, 'Chariow'), /⚙️ Paramètres/);
    assert.match(httpErrorMessage(403, 'X'), /accès refusé/i);
    assert.match(httpErrorMessage(404, 'X'), /introuvable/);
    assert.match(httpErrorMessage(429, 'X'), /trop de requêtes/);
    assert.match(httpErrorMessage(500, 'X'), /erreur interne/);
    assert.match(httpErrorMessage(418, 'X'), /HTTP 418/);
  });
  it('timeout/abort → délai de 20 s', () => {
    assert.match(networkErrorMessage({ name: 'TimeoutError' }), /20 s/);
    assert.match(networkErrorMessage({ name: 'AbortError' }), /20 s/);
    assert.match(networkErrorMessage(new Error('x')), /injoignable/);
    assert.match(networkErrorMessage(null), /injoignable/);
  });
});

describe('ExternalApiError', () => {
  it('porte le statut HTTP', () => {
    const e = new ExternalApiError(401, 'msg');
    assert.equal(e.status, 401);
    assert.equal(e.name, 'ExternalApiError');
    assert.equal(e.message, 'msg');
  });
});

describe('chariowHeaders', () => {
  it('Bearer + UA navigateur (WAF Cloudflare)', () => {
    const h = chariowHeaders('tok123');
    assert.equal(h.Authorization, 'Bearer tok123');
    assert.equal(h['User-Agent'], BROWSER_UA);
    assert.match(h['User-Agent'], /Mozilla/);
  });
});

describe('fetchChariowStatus (mocks)', () => {
  const products = [{ id: 'prd_co1troj3', name: 'Licence Starter', price: 29900 }];
  const sales = [
    { id: 's1', created_at: '2026-10-08T10:00:00Z', amount: 29900, status: 'paid', product_id: 'prd_co1troj3', customer: { email: 'jean.dupont@gmail.com' } },
  ];
  const pulses = [{ id: 'pulse_1', url: 'https://xxx.supabase.co/functions/v1/chariow-webhook', events: ['successful_sale'] }];
  const router = (map) => async (url) => {
    if (url.includes('/sales')) return map.sales();
    if (url.includes('/products')) return map.products();
    if (url.includes('/pulses')) return map.pulses();
    throw new Error('route inconnue: ' + url);
  };

  it('tout OK → ventes, produits, pulse formatés', async () => {
    const out = await fetchChariowStatus(
      router({ sales: async () => jsonResponse(sales), products: async () => jsonResponse(products), pulses: async () => jsonResponse(pulses) }),
      'tok'
    );
    assert.equal(out.sales.length, 1);
    assert.equal(out.sales[0].email_masque, 'j***@gmail.com');
    assert.equal(out.sales[0].produit, 'Licence Starter');
    assert.equal(out.products[0].nom, 'Licence Starter');
    assert.equal(out.pulse.actif, true);
    assert.deepEqual(out.erreurs, {});
  });

  it('endpoint /sales absent (404) → dégradation partielle', async () => {
    const out = await fetchChariowStatus(
      router({ sales: httpFail(404), products: async () => jsonResponse(products), pulses: async () => jsonResponse(pulses) }),
      'tok'
    );
    assert.equal(out.sales, null);
    assert.match(out.erreurs.sales, /introuvable/);
    assert.ok(out.products !== null, 'les produits ne doivent pas casser');
    assert.ok(out.pulse !== null, 'le pulse ne doit pas casser');
  });

  it('timeout sur /pulses → message FR, le reste intact', async () => {
    const out = await fetchChariowStatus(
      router({ sales: async () => jsonResponse(sales), products: async () => jsonResponse(products), pulses: timeoutFail() }),
      'tok'
    );
    assert.equal(out.pulse, null);
    assert.match(out.erreurs.pulse, /20 s/);
    assert.ok(out.sales !== null);
  });

  it('erreur réseau sur tout → 3 sections à null avec messages FR', async () => {
    const out = await fetchChariowStatus(netFail(), 'tok');
    assert.equal(out.sales, null);
    assert.equal(out.products, null);
    assert.equal(out.pulse, null);
    assert.match(out.erreurs.sales, /injoignable/);
    assert.match(out.erreurs.products, /injoignable/);
    assert.match(out.erreurs.pulse, /injoignable/);
  });

  it('limite à 20 ventes', async () => {
    const many = Array.from({ length: 35 }, (_, i) => ({ id: 's' + i, amount: 100 }));
    const out = await fetchChariowStatus(
      router({ sales: async () => jsonResponse(many), products: async () => jsonResponse([]), pulses: async () => jsonResponse([]) }),
      'tok'
    );
    assert.equal(out.sales.length, 20);
  });
});

describe('fetchSupabaseStatus (mocks)', () => {
  const fns = [{ slug: 'copilot' }, { slug: 'chariow-webhook' }, { slug: 'admin-settings' }];
  const okFetch = async (url) => {
    if (url.includes('/analytics/')) {
      return jsonResponse({ result: [{ fn: 'copilot', invocations: 50, erreurs: 2 }] });
    }
    return jsonResponse(fns);
  };

  it('fusionne fonctions déployées + stats', async () => {
    const out = await fetchSupabaseStatus(okFetch, 'tok');
    assert.equal(out.functions.length, 5);
    const copilot = out.functions.find((f) => f.nom === 'copilot');
    assert.equal(copilot.deployee, true);
    assert.equal(copilot.invocations_24h, 50);
    assert.equal(copilot.taux_erreur, 4);
    const webhook = out.functions.find((f) => f.nom === 'chariow-webhook');
    assert.equal(webhook.invocations_24h, null, 'pas de ligne stats → null');
    assert.equal(webhook.taux_erreur, null);
    const missing = out.functions.find((f) => f.nom === 'admin-stats');
    assert.equal(missing.deployee, false, 'non déployée → deployee false');
    assert.ok(!('note' in out), 'pas de note quand les stats sont OK');
  });

  it('analytics en échec (403) → note + stats à null, liste conservée', async () => {
    const out = await fetchSupabaseStatus(async (url) => {
      if (url.includes('/analytics/')) return jsonResponse({}, 403);
      return jsonResponse(fns);
    }, 'tok');
    assert.ok(out.functions.every((f) => f.invocations_24h === null));
    assert.match(out.note, /indisponibles/);
    assert.equal(out.functions.find((f) => f.nom === 'copilot').deployee, true);
  });

  it('liste des fonctions en 401 → lève ExternalApiError', async () => {
    await assert.rejects(
      () => fetchSupabaseStatus(httpFail(401), 'tok'),
      (err) => err instanceof ExternalApiError && err.status === 401 && /clé rejetée/.test(err.message)
    );
  });

  it('token invalide sur analytics → timeout → note', async () => {
    const out = await fetchSupabaseStatus(async (url) => {
      if (url.includes('/analytics/')) return timeoutFail()(url);
      return jsonResponse(fns);
    }, 'tok');
    assert.match(out.note, /20 s/);
  });
});

describe('fetchCloudflareStatus (mocks)', () => {
  it('retourne les 5 derniers déploiements', async () => {
    const out = await fetchCloudflareStatus(
      async () => jsonResponse({ success: true, result: [
        { created_on: '2026-10-09T04:20:00Z', latest_stage: { status: 'success' }, url: 'https://abc.fiscalmind-africa.pages.dev' },
        { created_on: '2026-10-08T22:00:00Z', latest_stage: { status: 'failure' }, url: 'https://def.fiscalmind-africa.pages.dev' },
      ] }),
      'tok',
      'acc123'
    );
    assert.equal(out.deployments.length, 2);
    assert.equal(out.deployments[0].statut, 'réussi');
    assert.equal(out.deployments[1].statut, 'échec');
  });

  it('success:false → lève avec le message Cloudflare', async () => {
    await assert.rejects(
      () => fetchCloudflareStatus(
        async () => jsonResponse({ success: false, errors: [{ code: 10000, message: 'Authentication error' }] }),
        'tok',
        'acc'
      ),
      (err) => /Cloudflare : Authentication error/.test(err.message)
    );
  });

  it('401 → ExternalApiError avec message FR', async () => {
    await assert.rejects(
      () => fetchCloudflareStatus(httpFail(401), 'tok', 'acc'),
      (err) => err instanceof ExternalApiError && /clé rejetée/.test(err.message)
    );
  });

  it('timeout réseau → Error FR', async () => {
    await assert.rejects(
      () => fetchCloudflareStatus(abortFail(), 'tok', 'acc'),
      (err) => /20 s/.test(err.message)
    );
  });
});
