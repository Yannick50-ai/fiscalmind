/**
 * Fabrique des services — point d'entrée `src/services/`.
 *
 * `createServices()` assemble les services avec injection de dépendances :
 * en production on passe les implémentations réelles, en tests des mocks.
 * Chaque service reste utilisable seul (imports directs).
 */

import { createSupabaseService, supabaseConfigFromEnv } from './supabase.js';
import { createR2Service } from './r2.js';
import { createOcrService } from './ocr.js';
import * as chariow from './chariow.js';

export { createSupabaseService, supabaseConfigFromEnv };
export { createR2Service };
export { createOcrService };
export { chariow };

/**
 * Assemble les services.
 * @param {object} [p]
 * @param {object} [p.supabase] - service Supabase (défaut : null)
 * @param {object} [p.r2] - service R2 (défaut : null)
 * @param {object} [p.ocr] - service OCR (défaut : null)
 * @param {object} [p.chariowSvc] - module chariow (pur ; défaut : le module réel)
 * @param {object} [p.config] - configuration (ex. { url })
 */
export function createServices({ supabase = null, r2 = null, ocr = null, chariowSvc = null, config = {} } = {}) {
  return {
    supabase,
    r2,
    ocr,
    chariow: chariowSvc || chariow,
    config,
  };
}

/**
 * Câblage production depuis les variables d'environnement.
 * AUCUN secret en dur : SUPABASE_URL / SUPABASE_ANON_KEY uniquement.
 *
 * @param {object} [p]
 * @param {object} [p.env] - défaut : process.env
 * @param {function} p.createClient - injecté (@supabase/supabase-js)
 * @param {function} [p.fetchImpl] - fetch injectable
 */
export function servicesFromEnv({ env = {}, createClient, fetchImpl } = {}) {
  const { url, anonKey } = supabaseConfigFromEnv(env);
  const supabase = createSupabaseService({ url, anonKey, createClient, fetchImpl });

  async function accessToken() {
    const session = await supabase.getSession();
    if (!session || !session.access_token) {
      const e = new Error('Non connecté');
      e.code = 'NOT_AUTHENTICATED';
      throw e;
    }
    return session.access_token;
  }

  const r2 = createR2Service({
    edgeCall: (action, payload) =>
      accessToken().then((token) => supabase.r2Call({ accessToken: token, action, payload })),
    fetchImpl,
  });

  const ocr = createOcrService({
    invokeOcr: ({ accessToken: token, body }) =>
      supabase.edgeFunction({ fn: 'ocr', accessToken: token, body }),
  });

  return createServices({ supabase, r2, ocr, chariowSvc: chariow, config: { url } });
}
