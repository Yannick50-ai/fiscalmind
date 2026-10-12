/**
 * Service Chariow — traitement du webhook (Pulses) côté serveur.
 *
 * Logique portée de supabase/functions/chariow-webhook/index.ts (mvp-copilot) :
 * - signature : HMAC-SHA256 du corps BRUT avec le secret du Pulse, header
 *   `x-chariow-signature`, comparaison timing-safe (insensible à la casse) ;
 * - événements ACTIVATE : successful.sale, sale.completed, issued.licence,
 *   license.issued, activated.licence, license.activated ;
 * - événements DEACTIVATE : expired.licence, license.expired, revoked.licence,
 *   license.revoked, refunded.sale → retour au plan démo ;
 * - SÉCURITÉ (07/10/2026) : produit inconnu → journalisé, RIEN n'est activé
 *   (jamais de Pro offert par défaut) ;
 * - ANTI-DOUBLON (07/10/2026) : une seule activation par sale_id
 *   (Chariow envoie plusieurs événements par vente) — en production la
 *   persistance passe par la table `payments` (colonne external_id) ;
 * - lecture tolérante du payload : evt.type || evt.event, evt.data || evt,
 *   d.customer?.email, d.product?.id || d.product_id, d.sale?.id || d.id,
 *   d.license?.expiresAt || d.license?.expires_at, d.sale?.amount ?? d.amount.
 *
 * Le secret du Pulse (whsec_…) et la table des produits passent par variables
 * d'environnement côté serveur. AUCUN secret ici.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

/** Produits de la boutique WagaExpress → plan SaaS (30 jours). */
export const CHARIOW_PRODUCTS = {
  prd_co1troj3: { plan: 'starter', days: 30, label: 'Starter' },
  prd_zg2w9ck2: { plan: 'pro', days: 30, label: 'Pro' },
};

export const CHARIOW_ACTIVATE_EVENTS = new Set([
  'successful.sale', 'sale.completed',
  'successful_sale', 'sale_completed',
  'issued.licence', 'license.issued',
  'issued_licence', 'license_issued',
  'activated.licence', 'license.activated',
  'activated_licence', 'license_activated',
]);

export const CHARIOW_DEACTIVATE_EVENTS = new Set([
  'expired.licence', 'license.expired',
  'expired_licence', 'license_expired',
  'revoked.licence', 'license.revoked',
  'revoked_licence', 'license_revoked',
  'refunded.sale', 'refunded_sale',
]);

export function chariowError(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

/** HMAC-SHA256 hexadécimal du message avec le secret. */
export function hmacSha256Hex(message, secret) {
  return createHmac('sha256', String(secret)).update(String(message), 'utf8').digest('hex');
}

/**
 * Vérifie la signature du webhook (timing-safe, insensible à la casse).
 * Chariow préfixe la signature de "sha256=" — on le retire avant comparaison.
 * @returns {boolean}
 */
export function verifyWebhookSignature({ rawBody, signature, secret }) {
  if (!signature || !secret) return false;
  const expected = hmacSha256Hex(rawBody, secret);
  const cleaned = String(signature).replace(/^sha256=/i, '').toLowerCase();
  const a = Buffer.from(cleaned, 'utf8');
  const b = Buffer.from(expected.toLowerCase(), 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Extrait les champs utiles du payload avec les variantes de format.
 * Lève INVALID_JSON si le corps n'est pas du JSON.
 */
export function parseWebhookEvent(rawBody) {
  let evt;
  try {
    evt = JSON.parse(rawBody);
  } catch {
    throw chariowError('INVALID_JSON', 'Corps du webhook : JSON invalide');
  }
  const type = evt.type || evt.event || '';
  const d = evt.data || evt;
  const email = d.customer && d.customer.email ? String(d.customer.email).toLowerCase() : null;
  return {
    type,
    email,
    productId: (d.product && d.product.id) || d.product_id || null,
    saleId: (d.sale && d.sale.id) || d.id || null,
    expiresAt: (d.license && (d.license.expiresAt || d.license.expires_at)) || null,
    amount: (d.sale && d.sale.amount) ?? d.amount ?? 0,
  };
}

/** 'activate' | 'deactivate' | 'ignore' selon le type d'événement. */
export function classifyEvent(type) {
  if (CHARIOW_ACTIVATE_EVENTS.has(type)) return 'activate';
  if (CHARIOW_DEACTIVATE_EVENTS.has(type)) return 'deactivate';
  return 'ignore';
}

/**
 * Déduit la licence d'une vente.
 * Produit inconnu → { rejected: true } : RIEN n'est activé (sécurité 07/10/2026).
 */
export function licenseFromSale({ productId, expiresAt, now = new Date() }) {
  const p = productId ? CHARIOW_PRODUCTS[productId] : undefined;
  if (!p) return { rejected: true, reason: 'unknown_product' };
  const exp = expiresAt || new Date(now.getTime() + p.days * 24 * 3600 * 1000).toISOString();
  return { plan: p.plan, days: p.days, expiresAt: exp };
}

/**
 * Registre anti-doublon en mémoire (tests / usage simple).
 * EN PRODUCTION : persistance obligatoire (table `payments`, colonne external_id)
 * — le registre mémoire ne survit pas au redémarrage de l'instance.
 */
export function createSaleRegistry() {
  const seen = new Set();
  return {
    has: (saleId) => !!saleId && seen.has(saleId),
    add: (saleId) => { if (saleId) seen.add(saleId); },
    size: () => seen.size,
  };
}

/**
 * Pipeline complet du webhook (logique pure ; persistance injectée).
 * @param {object} p
 * @param {string} p.rawBody - corps BRUT reçu (pour le HMAC)
 * @param {string} p.signature - header x-chariow-signature
 * @param {string} p.secret - secret du Pulse (env serveur)
 * @param {object} [p.registry] - registre anti-doublon (défaut : mémoire)
 * @param {function} [p.resolveUser] - injecté : (email) => Promise<userId|null>
 *   (en prod : table profiles ; email sans compte → chariow_unmatched)
 * @param {Date} [p.now]
 * @returns {Promise<object>} { status, ... } — status :
 *   invalid_signature | invalid_json | ignored | missing_email | no_matching_user |
 *   downgraded | already_processed | unknown_product | activated
 */
export async function processWebhook({
  rawBody,
  signature,
  secret,
  registry = createSaleRegistry(),
  resolveUser,
  now = new Date(),
}) {
  if (!verifyWebhookSignature({ rawBody, signature, secret })) {
    return { status: 'invalid_signature' };
  }
  let evt;
  try {
    evt = parseWebhookEvent(rawBody);
  } catch {
    return { status: 'invalid_json' };
  }
  const kind = classifyEvent(evt.type);
  if (kind === 'ignore') return { status: 'ignored', type: evt.type };
  if (!evt.email) return { status: 'missing_email', type: evt.type };

  const userId = resolveUser ? await resolveUser(evt.email) : null;
  if (!userId) return { status: 'no_matching_user', email: evt.email, type: evt.type };

  if (kind === 'deactivate') {
    // Expiration / révocation / remboursement → retour au plan démo.
    return { status: 'downgraded', userId, email: evt.email, type: evt.type };
  }

  if (evt.saleId && registry.has(evt.saleId)) {
    return { status: 'already_processed', userId, saleId: evt.saleId };
  }
  const lic = licenseFromSale({ productId: evt.productId, expiresAt: evt.expiresAt, now });
  if (lic.rejected) {
    return { status: 'unknown_product', userId, email: evt.email, productId: evt.productId, saleId: evt.saleId };
  }
  if (evt.saleId) registry.add(evt.saleId);
  return {
    status: 'activated',
    userId,
    email: evt.email,
    plan: lic.plan,
    expiresAt: lic.expiresAt,
    saleId: evt.saleId,
    amount: evt.amount,
  };
}
