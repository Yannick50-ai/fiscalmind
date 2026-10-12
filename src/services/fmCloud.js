/**
 * FiscalMind Africa — couche d'accès Supabase 100 % cloud (SaaS).
 *
 * AUCUN stockage local ici : chaque lecture/écriture passe par PostgREST.
 * Le `client` est injecté (ex. `svc.client` de src/services/supabase.js,
 * déjà authentifié via le JWT de session — RLS `auth.uid() = user_id`
 * s'applique côté serveur). `uid` = `auth.users.id` de la session.
 *
 * Tables (créées côté dashboard Supabase, voir migration/supabase-fm-entries.sql
 * et migration/supabase-phase8.sql) :
 * - fm_entries(user_id, entry_id text, entry jsonb, pk (user_id, entry_id))
 * - fm_journals(user_id, code, label, unique (user_id, code))
 * - fm_chat(user_id pk, messages jsonb)
 * - fm_settings(user_id, key, value jsonb, pk (user_id, key))
 * - fm_audit(user_id pk, items jsonb)
 * - fm_immos(user_id, immo_id text, immo jsonb, unique (user_id, immo_id))
 * - fm_assurances(user_id, assurance_id text, assurance jsonb, unique (user_id, assurance_id))
 *
 * Erreurs : CloudError { code: 'NETWORK' | 'DB' | 'AUTH' | 'CONFIG', message FR }.
 * 100 % testable : le client PostgREST est un paramètre (mocké dans les tests).
 */

export class CloudError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'CloudError';
    this.code = code || 'DB';
  }
}

/** Vrai si l'erreur ressemble à une panne réseau (pas de fallback silencieux : on la signale). */
export function isNetworkError(err) {
  const m = String((err && err.message) || err || '');
  return /failed to fetch|networkerror|network request failed|timeout|aborterror|econnreset|enotfound/i.test(m);
}

function dbError(what, error) {
  const detail = (error && (error.message || error.code)) || 'inconnue';
  return new CloudError(
    'Erreur serveur pendant ' + what + ' : ' + detail + '. Réessayez.',
    'DB'
  );
}

async function run(promise, what) {
  let res;
  try {
    res = await promise;
  } catch (e) {
    if (isNetworkError(e)) {
      throw new CloudError(
        'Pas de connexion réseau pendant ' + what + '. Vérifiez votre connexion puis réessayez.',
        'NETWORK'
      );
    }
    throw dbError(what, e);
  }
  if (res && res.error) {
    // postgrest-js (supabase-js ≥ 2.117) convertit les pannes réseau en
    // { error } au lieu de lever : on les requalifie en NETWORK pour un
    // message explicite (« pas de connexion » plutôt que « erreur serveur »).
    if (isNetworkError(res.error)) {
      throw new CloudError(
        'Pas de connexion réseau pendant ' + what + '. Vérifiez votre connexion puis réessayez.',
        'NETWORK'
      );
    }
    throw dbError(what, res.error);
  }
  return res ? res.data : null;
}

function needUid(uid) {
  if (!uid) throw new CloudError('Session expirée. Reconnectez-vous.', 'AUTH');
}

/* ------------------------------------------------------------------ */
/* Écritures — fm_entries                                              */
/* ------------------------------------------------------------------ */

/** Toutes les écritures de l'utilisateur (format canonique du moteur). */
export async function cloudLoadEntries(client, uid) {
  needUid(uid);
  const rows = await run(
    client.from('fm_entries').select('entry_id,entry').eq('user_id', uid).order('entry_id'),
    'le chargement du journal'
  );
  return (rows || []).map((r) => r.entry).filter(Boolean);
}

/** Crée ou met à jour UNE écriture (upsert sur la clé métier (user_id, entry_id)). */
export async function cloudSaveEntry(client, uid, entry) {
  needUid(uid);
  if (!entry || !entry.id) throw new CloudError('Écriture invalide : identifiant manquant.', 'DB');
  await run(
    client.from('fm_entries').upsert(
      { user_id: uid, entry_id: String(entry.id), entry },
      { onConflict: 'user_id,entry_id' }
    ),
    "l'enregistrement de l'écriture"
  );
  return true;
}

/** Supprime une écriture par son identifiant métier. */
export async function cloudDeleteEntry(client, uid, entryId) {
  needUid(uid);
  await run(
    client.from('fm_entries').delete().eq('user_id', uid).eq('entry_id', String(entryId)),
    "la suppression de l'écriture"
  );
  return true;
}

/* ------------------------------------------------------------------ */
/* Journaux personnalisés — fm_journals                                */
/* ------------------------------------------------------------------ */

/** Journaux personnalisés [{ code, label }] (les codes par défaut sont constants côté app). */
export async function cloudLoadJournals(client, uid) {
  needUid(uid);
  const rows = await run(
    client.from('fm_journals').select('code,label').eq('user_id', uid).order('code'),
    'le chargement des journaux'
  );
  return (rows || []).map((r) => ({ code: r.code, label: r.label }));
}

/** Crée ou met à jour un journal personnalisé. */
export async function cloudSaveJournal(client, uid, code, label) {
  needUid(uid);
  code = String(code || '').toUpperCase();
  if (!code || !label) throw new CloudError('Code et libellé du journal requis.', 'DB');
  await run(
    client.from('fm_journals').upsert(
      { user_id: uid, code, label: String(label) },
      { onConflict: 'user_id,code' }
    ),
    "l'enregistrement du journal"
  );
  return true;
}

/** Supprime un journal personnalisé. */
export async function cloudDeleteJournal(client, uid, code) {
  needUid(uid);
  await run(
    client.from('fm_journals').delete().eq('user_id', uid).eq('code', String(code).toUpperCase()),
    'la suppression du journal'
  );
  return true;
}

/* ------------------------------------------------------------------ */
/* Préférences — fm_settings (entreprise, pays, période, exercice…)    */
/* ------------------------------------------------------------------ */

/** Lit une préférence (fallback si absente). */
export async function cloudGetSetting(client, uid, key, fallback) {
  needUid(uid);
  const row = await run(
    client.from('fm_settings').select('value').eq('user_id', uid).eq('key', String(key)).maybeSingle(),
    'la lecture du paramètre « ' + key + ' »'
  );
  const v = row && row.value !== undefined ? row.value : undefined;
  return v === undefined ? fallback : v;
}

/** Écrit une préférence. */
export async function cloudSetSetting(client, uid, key, value) {
  needUid(uid);
  await run(
    client.from('fm_settings').upsert(
      { user_id: uid, key: String(key), value: value === undefined ? null : value },
      { onConflict: 'user_id,key' }
    ),
    'la sauvegarde du paramètre « ' + key + ' »'
  );
  return true;
}

/* ------------------------------------------------------------------ */
/* Audit Readiness — fm_audit (une ligne par utilisateur)              */
/* ------------------------------------------------------------------ */

/** Éléments d'audit [{ id, group, title, priority, note, done }] (vide si aucun). */
export async function cloudLoadAudit(client, uid) {
  needUid(uid);
  const row = await run(
    client.from('fm_audit').select('items').eq('user_id', uid).maybeSingle(),
    "le chargement de l'audit"
  );
  const items = row && row.items;
  return Array.isArray(items) ? items : [];
}

/** Remplace les éléments d'audit. */
export async function cloudSaveAudit(client, uid, items) {
  needUid(uid);
  await run(
    client.from('fm_audit').upsert(
      { user_id: uid, items: Array.isArray(items) ? items : [] },
      { onConflict: 'user_id' }
    ),
    "la sauvegarde de l'audit"
  );
  return true;
}

/* ------------------------------------------------------------------ */
/* Immobilisations — fm_immos                                          */
/* ------------------------------------------------------------------ */

/** Toutes les immobilisations de l'utilisateur (format moteur amortissements). */
export async function cloudLoadImmos(client, uid) {
  needUid(uid);
  const rows = await run(
    client.from('fm_immos').select('id,asset').eq('user_id', uid).order('id'),
    'le chargement des immobilisations'
  );
  return (rows || []).map((r) => r.asset).filter(Boolean);
}

/** Crée ou met à jour UNE immobilisation (upsert sur (user_id, id)). */
export async function cloudSaveImmo(client, uid, immo) {
  needUid(uid);
  if (!immo || !immo.id) throw new CloudError('Immobilisation invalide : identifiant manquant.', 'DB');
  await run(
    client.from('fm_immos').upsert(
      { user_id: uid, id: String(immo.id), asset: immo },
      { onConflict: 'user_id,id' }
    ),
    "l'enregistrement de l'immobilisation"
  );
  return true;
}

/** Supprime une immobilisation par son identifiant métier. */
export async function cloudDeleteImmo(client, uid, immoId) {
  needUid(uid);
  await run(
    client.from('fm_immos').delete().eq('user_id', uid).eq('id', String(immoId)),
    "la suppression de l'immobilisation"
  );
  return true;
}

/* ------------------------------------------------------------------ */
/* Assurances — fm_assurances                                          */
/* ------------------------------------------------------------------ */

/** Toutes les polices de l'utilisateur (format moteur assurances). */
export async function cloudLoadAssurances(client, uid) {
  needUid(uid);
  const rows = await run(
    client.from('fm_assurances').select('id,policy').eq('user_id', uid).order('id'),
    'le chargement des assurances'
  );
  return (rows || []).map((r) => r.policy).filter(Boolean);
}

/** Crée ou met à jour UNE police (upsert sur (user_id, id)). */
export async function cloudSaveAssurance(client, uid, police) {
  needUid(uid);
  if (!police || !police.id) throw new CloudError('Police invalide : identifiant manquant.', 'DB');
  await run(
    client.from('fm_assurances').upsert(
      { user_id: uid, id: String(police.id), policy: police },
      { onConflict: 'user_id,id' }
    ),
    "l'enregistrement de la police"
  );
  return true;
}

/** Supprime une police par son identifiant métier. */
export async function cloudDeleteAssurance(client, uid, assuranceId) {
  needUid(uid);
  await run(
    client.from('fm_assurances').delete().eq('user_id', uid).eq('id', String(assuranceId)),
    'la suppression de la police'
  );
  return true;
}

export const CHAT_MAX = 100;

/** Historique [{ role, text }] (vide si aucun). */
export async function cloudLoadChat(client, uid, conversationId = null) {
  needUid(uid);
  if (conversationId) {
    const row = await run(
      client.from('fm_chat').select('messages').eq('user_id', uid).eq('conversation_id', conversationId).maybeSingle(),
      "le chargement de l'historique"
    );
    const m = row && row.messages;
    return Array.isArray(m) ? m.slice(-CHAT_MAX) : [];
  }
  // Sans ID : prend la conversation la plus récente
  const rows = await run(
    client.from('fm_chat').select('messages, updated_at').eq('user_id', uid),
    "le chargement de l'historique"
  );
  if (!Array.isArray(rows) || !rows.length) return [];
  rows.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  const m = rows[0].messages;
  return Array.isArray(m) ? m.slice(-CHAT_MAX) : [];
}

/** Remplace l'historique (conservés : 100 derniers). */
export async function cloudSaveChat(client, uid, messages, conversationId = null, titre = null) {
  needUid(uid);
  const m = Array.isArray(messages) ? messages.slice(-CHAT_MAX) : [];
  // Trouve ou crée la conversation
  let cid = conversationId;
  if (!cid) {
    const rows = await run(
      client.from('fm_chat').select('conversation_id, updated_at').eq('user_id', uid),
      "la recherche de conversation"
    );
    if (Array.isArray(rows) && rows.length) {
      rows.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
      cid = rows[0].conversation_id;
    } else {
      cid = crypto.randomUUID();
    }
  }
  const payload = { user_id: uid, conversation_id: cid, messages: m };
  if (titre) payload.titre = titre;
  await run(
    client.from('fm_chat').upsert(payload, { onConflict: 'user_id,conversation_id' }),
    "la sauvegarde de l'historique"
  );
  return cid;
}

/** Liste les conversations [{ conversation_id, titre, updated_at }]. */
export async function cloudListChats(client, uid) {
  needUid(uid);
  const rows = await run(
    client.from('fm_chat').select('conversation_id, titre, updated_at').eq('user_id', uid).order('updated_at', { ascending: false }).limit(50),
    "la liste des conversations"
  );
  return Array.isArray(rows) ? rows : [];
}

/** Supprime une conversation. */
export async function cloudDeleteChat(client, uid, conversationId) {
  needUid(uid);
  await run(
    client.from('fm_chat').delete().eq('user_id', uid).eq('conversation_id', conversationId),
    "la suppression de la conversation"
  );
  return true;
}
