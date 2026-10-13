// FiscalMind Africa — persistance 100 % cloud (Supabase).
//
// SaaS strict : AUCUN stockage local (ni localStorage ni sessionStorage).
// Toutes les lectures/écritures passent par PostgREST avec le JWT de session
// (RLS : chaque utilisateur ne voit que ses données). La logique d'accès vit
// dans src/services/fmCloud.js (testable) ; ce module ne fait que brancher
// la session courante. Les écritures utilisent le format canonique du moteur :
// { id, date, journal, piece, libelle, lignes: [...] }.

import { supabaseService, getSession, getAccessToken } from './auth.js';
import {
  CloudError,
  cloudLoadEntries, cloudSaveEntry, cloudDeleteEntry,
  cloudLoadJournals, cloudSaveJournal, cloudDeleteJournal,
  cloudGetSetting, cloudSetSetting,
  cloudLoadChat, cloudSaveChat,
  cloudLoadAudit, cloudSaveAudit,
  cloudLoadImmos, cloudSaveImmo, cloudDeleteImmo,
  cloudLoadAssurances, cloudSaveAssurance, cloudDeleteAssurance,
} from '../../src/services/fmCloud.js';

export { CloudError };

export const JOURNAUX_DEFAUT = {
  AC: 'Achats',
  VT: 'Ventes',
  BQ: 'Banque',
  ES: 'Espèces',
  PA: 'Paie',
  OD: 'Opérations diverses',
  AN: 'À-nouveaux',
};

/** Contexte d'accès : { client, uid } ou lève CloudError (message FR).
 *  Si l'utilisateur est membre d'une équipe, uid = l'ID du propriétaire (données partagées). */
let _teamOwnerId = null;
let _teamOwnerResolved = false;

export async function resolveTeamOwner() {
  if (_teamOwnerResolved) return _teamOwnerId;
  _teamOwnerResolved = true;
  try {
    const svc = supabaseService();
    if (!svc) return null;
    const token = await getAccessToken();
    if (!token) return null;
    const res = await fetch('https://eetmaaopaatbbwhwbdcx.supabase.co/functions/v1/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ action: 'my_team' }),
    });
    const j = await res.json();
    if (j.team && j.role === 'member') {
      _teamOwnerId = j.team.owner_id;
    }
  } catch (e) { /* silencieux */ }
  return _teamOwnerId;
}

export function clearTeamCache() { _teamOwnerId = null; _teamOwnerResolved = false; }

function ctx() {
  const session = getSession();
  if (!session || !session.uid) {
    throw new CloudError('Session expirée. Reconnectez-vous.', 'AUTH');
  }
  const svc = supabaseService();
  if (!svc || !svc.client) {
    throw new CloudError('Connexion au serveur non configurée.', 'CONFIG');
  }
  // Si membre d'une équipe, utiliser les données du propriétaire
  const uid = _teamOwnerId || session.uid;
  return { client: svc.client, uid };
}

/* ------------------------------------------------------------------ */
/* Écritures                                                           */
/* ------------------------------------------------------------------ */

/** Toutes les écritures (format canonique du moteur). */
export async function loadEntries() {
  const { client, uid } = ctx();
  return cloudLoadEntries(client, uid);
}

/** Crée ou met à jour une écriture (upsert par entry.id). */
export async function saveEntry(entry) {
  const { client, uid } = ctx();
  return cloudSaveEntry(client, uid, entry);
}

/** Supprime une écriture par son id. */
export async function deleteEntryById(entryId) {
  const { client, uid } = ctx();
  return cloudDeleteEntry(client, uid, entryId);
}

/* ------------------------------------------------------------------ */
/* Journaux personnalisés                                              */
/* ------------------------------------------------------------------ */

/** Journaux personnalisés [{ code, label }]. */
export async function loadJournaux() {
  const { client, uid } = ctx();
  return cloudLoadJournals(client, uid);
}

/** Crée ou met à jour un journal personnalisé. */
export async function saveJournal(code, label) {
  const { client, uid } = ctx();
  return cloudSaveJournal(client, uid, code, label);
}

/** Supprime un journal personnalisé. */
export async function deleteJournal(code) {
  const { client, uid } = ctx();
  return cloudDeleteJournal(client, uid, code);
}

/** Codes journaux = défauts + personnalisés (pur, synchrone). */
export function journalCodes(custom) {
  const base = Object.assign({}, JOURNAUX_DEFAUT);
  (custom || []).forEach((j) => {
    if (j && j.code && j.label) base[String(j.code).toUpperCase()] = j.label;
  });
  return base;
}

export function journalLabel(codes, code) {
  return (codes && codes[code]) || code;
}

/* ------------------------------------------------------------------ */
/* Préférences (fm_settings)                                           */
/* ------------------------------------------------------------------ */

export async function getSetting(key, fallback) {
  const { client, uid } = ctx();
  return cloudGetSetting(client, uid, key, fallback);
}

export async function setSetting(key, value) {
  const { client, uid } = ctx();
  return cloudSetSetting(client, uid, key, value);
}

/** Période { debut, fin } (AAAA-MM-JJ). */
export async function loadPeriode() {
  return getSetting('periode', null);
}
export async function savePeriode(periode) {
  return setSetting('periode', periode);
}

/** Période par défaut : préférence enregistrée, sinon année des données, sinon année en cours. */
export async function defaultPeriode(existingEntries) {
  // Sans session : lever AUTH (comportement attendu par les tests)
  const { client, uid } = ctx();
  let y = String(new Date().getFullYear());
  try {
    const entries = existingEntries || await loadEntries();
    // Année la PLUS RÉCENTE des écritures (13/10/2026)
    if (entries.length) {
      const maxYear = entries.reduce((m, e) => {
        const ey = String(e.date || '').slice(0, 4);
        return ey > m ? ey : m;
      }, '');
      if (/^\d{4}$/.test(maxYear)) y = maxYear;
    }
  } catch (e) { /* période par défaut quand même */ }
  // Période sauvegardée : l'utiliser seulement si elle contient l'année la plus récente
  // (évite de rester bloqué sur un vieil exercice — 13/10/2026)
  try {
    const saved = await loadPeriode();
    if (saved && saved.debut && saved.fin) {
      const savedYear = String(saved.debut).slice(0, 4);
      if (savedYear === y) return saved;
    }
  } catch (e) { /* ignorer */ }
  return { debut: y + '-01-01', fin: y + '-12-31' };
}

/** Nom d'entreprise pour les en-têtes des exports (jamais « WagaExpress »). */
export async function loadCompany() {
  const v = await getSetting('company', 'Mon entreprise');
  return v || 'Mon entreprise';
}
export async function saveCompany(name) {
  return setSetting('company', String(name || '').trim().slice(0, 80) || 'Mon entreprise');
}

/** Code pays du profil (défaut BF). */
export async function loadCountry() {
  const v = await getSetting('country', 'BF');
  return v || 'BF';
}
export async function saveCountry(code) {
  return setSetting('country', String(code || 'BF').toUpperCase());
}

/* ------------------------------------------------------------------ */
/* Tiers (registre des sous-comptes 401xxx / 411xxx)                   */
/* ------------------------------------------------------------------ */

/**
 * Registre des tiers [{ nom, type: 'F'|'C', compte }] — persisté en
 * `fm_settings` (clé `tiers`), 100 % cloud. Les sous-comptes sont
 * ré-enregistrés au plan via `registerSubAccount` à chaque connexion
 * (voir `ensureTiersRegistered`), pour que `validateEntry` les accepte
 * partout (journal, classeur, lettrage…).
 */
export async function loadTiers() {
  const v = await getSetting('tiers', []);
  return Array.isArray(v) ? v : [];
}
export async function saveTiers(tiers) {
  return setSetting('tiers', Array.isArray(tiers) ? tiers : []);
}

/**
 * Re-enregistre les sous-comptes des tiers connus au plan comptable.
 * Idempotent, à appeler après connexion (coquille applicative).
 * Ne lève jamais : un échec réseau ne doit pas bloquer l'app.
 */
export async function ensureTiersRegistered() {
  try {
    const { registerSubAccount } = await import('../../src/engine/chart-of-accounts.js');
    const tiers = await loadTiers();
    tiers.forEach((t) => {
      if (t && t.compte && t.nom) {
        registerSubAccount(t.compte, (t.type === 'C' ? 'Clients — ' : 'Fournisseurs — ') + t.nom);
      }
    });
  } catch (e) { /* non bloquant */ }
}

/* ------------------------------------------------------------------ */
/* Historique copilote (fm_chat, 100 max)                              */
/* ------------------------------------------------------------------ */

export async function loadChat(conversationId = null) {
  const { client, uid } = ctx();
  return cloudLoadChat(client, uid, conversationId);
}

export async function saveChat(messages, conversationId = null, titre = null) {
  const { client, uid } = ctx();
  return cloudSaveChat(client, uid, messages, conversationId, titre);
}

export async function listChats() {
  const { client, uid } = ctx();
  const { cloudListChats } = await import('../../src/services/fmCloud.js');
  return cloudListChats(client, uid);
}

export async function deleteChat(conversationId) {
  const { client, uid } = ctx();
  const { cloudDeleteChat } = await import('../../src/services/fmCloud.js');
  return cloudDeleteChat(client, uid, conversationId);
}

/* ------------------------------------------------------------------ */
/* Profil entreprise : IFU, régime (fm_settings) — le nom reste 'company' */
/* ------------------------------------------------------------------ */

export async function loadCompanyIfu() {
  const v = await getSetting('company_ifu', '');
  return v || '';
}
export async function saveCompanyIfu(ifu) {
  return setSetting('company_ifu', String(ifu || '').trim().slice(0, 40));
}

export async function loadCompanyRegime() {
  const v = await getSetting('company_regime', '');
  return v || '';
}
export async function saveCompanyRegime(regime) {
  return setSetting('company_regime', String(regime || '').trim().slice(0, 60));
}

/** Nombre de salariés (pour la fréquence CNSS : >= 20 = mensuelle, < 20 = trimestrielle). */
export async function loadEmployeeCount() {
  const v = await getSetting('employee_count', 0);
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
export async function saveEmployeeCount(n) {
  const v = parseInt(n, 10);
  return setSetting('employee_count', Number.isFinite(v) && v >= 0 ? v : 0);
}

/** Fréquence CNSS : 'auto' (déduite de l'effectif), 'mensuelle' ou 'trimestrielle' (forçage manuel). */
export async function loadCnssFrequency() {
  const v = await getSetting('cnss_frequency', 'auto');
  return ['auto', 'mensuelle', 'trimestrielle'].includes(v) ? v : 'auto';
}
export async function saveCnssFrequency(f) {
  return setSetting('cnss_frequency', ['auto', 'mensuelle', 'trimestrielle'].includes(f) ? f : 'auto');
}

/** Fréquence CNSS effective : manuelle si forçée, sinon déduite (≥ 20 salariés = mensuelle). */
export async function getEffectiveCnssFrequency() {
  const f = await loadCnssFrequency();
  if (f !== 'auto') return f;
  const n = await loadEmployeeCount();
  return n >= 20 ? 'mensuelle' : 'trimestrielle';
}

/** Assujetti à la TVA (défaut : oui). Si non, le calendrier masque la TVA. */
export async function loadTvaSubject() {
  const v = await getSetting('tva_subject', true);
  return v !== false && v !== 'false' && v !== 0;
}
export async function saveTvaSubject(yes) {
  return setSetting('tva_subject', !!yes);
}

/** Prélèvement BIC 2% applicable (défaut : non). Si oui, le calendrier l'affiche. */
export async function loadBicPrelevement() {
  const v = await getSetting('bic_prelevement', false);
  return v === true || v === 'true' || v === 1;
}
export async function saveBicPrelevement(yes) {
  return setSetting('bic_prelevement', !!yes);
}

/* ------------------------------------------------------------------ */
/* Mois verrouillés — validation par période (13/10/2026)               */
/* Format : ["2026-09", "2026-10"] — un mois verrouillé est intangible  */
/* ------------------------------------------------------------------ */

export async function loadLockedMonths() {
  const v = await getSetting('locked_months', []);
  return Array.isArray(v) ? v : [];
}
export async function saveLockedMonths(months) {
  return setSetting('locked_months', Array.isArray(months) ? months : []);
}
export async function isMonthLocked(yearMonth) {
  const locked = await loadLockedMonths();
  return locked.includes(String(yearMonth));
}

/* ------------------------------------------------------------------ */
/* Comptes comptables par défaut (13/10/2026 — inspiré Dolibarr)        */
/* Clés : client, fournisseur, tvaCollectee, tvaDeductible, vente, achat */
/* ------------------------------------------------------------------ */

export const DEFAULT_ACCOUNTS = {
  client: '411',
  fournisseur: '401',
  tvaCollectee: '4431',
  tvaDeductible: '4451',
  vente: '701',
  achat: '601',
};

export async function loadDefaultAccounts() {
  const v = await getSetting('default_accounts', {});
  return { ...DEFAULT_ACCOUNTS, ...(v || {}) };
}
export async function saveDefaultAccounts(accounts) {
  const clean = {};
  for (const k of Object.keys(DEFAULT_ACCOUNTS)) {
    if (accounts[k]) clean[k] = String(accounts[k]).trim();
  }
  return setSetting('default_accounts', clean);
}

/* ------------------------------------------------------------------ */
/* Paramètres fiscaux personnalisés (fm_settings 'tax_overrides')       */
/* Clés : tva, is, emp, sal — valeurs en %, '' = défaut du pays.        */
/* ------------------------------------------------------------------ */

export async function loadTaxOverrides() {
  const v = await getSetting('tax_overrides', {});
  return v && typeof v === 'object' ? v : {};
}
export async function saveTaxOverrides(overrides) {
  const clean = {};
  ['tva', 'is', 'emp', 'sal'].forEach((k) => {
    const v = overrides && overrides[k];
    clean[k] = v === undefined || v === null || v === '' ? '' : String(v).slice(0, 12);
  });
  return setSetting('tax_overrides', clean);
}

/* ------------------------------------------------------------------ */
/* Identification DSF — fiches R1–R3 (fm_settings, 100 % cloud)        */
/* ------------------------------------------------------------------ */

/**
 * Champs R1 complémentaires { sigle, adresse, rccm, exerciceDebut,
 * exerciceFin, telephone, email, expertNom, expertContact,
 * nes, greffe, caisseSociale, codeImportateur, codeActivite,
 * boitePostale, ville, adresseGeo, activitePrincipale, capaciteProd,
 * contactNom, contactAdresse, contactTel, contactEmail, contactQualite,
 * dureeMois }.
 * (nom → clé 'company', nif → 'company_ifu', regime → 'company_regime')
 */
export async function loadCompanyR1() {
  const v = await getSetting('company_r1', {});
  return v && typeof v === 'object' ? v : {};
}
export async function saveCompanyR1(r1) {
  const clean = {};
  ['sigle', 'adresse', 'rccm', 'exerciceDebut', 'exerciceFin',
   'telephone', 'email', 'expertNom', 'expertContact',
   'nes', 'greffe', 'caisseSociale', 'codeImportateur', 'codeActivite',
   'boitePostale', 'ville', 'adresseGeo', 'activitePrincipale', 'capaciteProd',
   'contactNom', 'contactAdresse', 'contactTel', 'contactEmail', 'contactQualite',
   'dureeMois'].forEach((k) => {
    clean[k] = String((r1 && r1[k]) || '').trim().slice(0, 120);
  });
  return setSetting('company_r1', clean);
}

/** Dirigeants (fiche R2) : [{ nom, qualite, contact }]. */
export async function loadDirigeants() {
  const v = await getSetting('company_dirigeants', []);
  return Array.isArray(v) ? v : [];
}
export async function saveDirigeants(liste) {
  const clean = (Array.isArray(liste) ? liste : []).map((d) => ({
    nom: String((d && d.nom) || '').trim().slice(0, 80),
    qualite: String((d && d.qualite) || '').trim().slice(0, 80),
    contact: String((d && d.contact) || '').trim().slice(0, 60),
  })).filter((d) => d.nom || d.qualite || d.contact);
  return setSetting('company_dirigeants', clean);
}

/** Associés / actionnaires (fiche R3) : [{ nom, qualite, part }]. */
export async function loadAssocies() {
  const v = await getSetting('company_associes', []);
  return Array.isArray(v) ? v : [];
}
export async function saveAssocies(liste) {
  const clean = (Array.isArray(liste) ? liste : []).map((a) => ({
    nom: String((a && a.nom) || '').trim().slice(0, 80),
    qualite: String((a && a.qualite) || '').trim().slice(0, 80),
    part: String((a && a.part) || '').trim().slice(0, 40),
  })).filter((a) => a.nom || a.qualite || a.part);
  return setSetting('company_associes', clean);
}

/* ------------------------------------------------------------------ */
/* Taux de change de référence modifiables (fm_settings 'fx_rates')    */
/* ------------------------------------------------------------------ */

export async function loadFxRates() {
  const v = await getSetting('fx_rates', null);
  return v && typeof v === 'object' ? v : null;
}
export async function saveFxRates(rates) {
  return setSetting('fx_rates', rates);
}

/* ------------------------------------------------------------------ */
/* Audit Readiness (fm_audit)                                          */
/* ------------------------------------------------------------------ */

export async function loadAudit() {
  const { client, uid } = ctx();
  return cloudLoadAudit(client, uid);
}

export async function saveAudit(items) {
  const { client, uid } = ctx();
  return cloudSaveAudit(client, uid, items);
}

/* ------------------------------------------------------------------ */
/* Immobilisations (fm_immos)                                          */
/* ------------------------------------------------------------------ */

export async function loadImmos() {
  const { client, uid } = ctx();
  return cloudLoadImmos(client, uid);
}

export async function saveImmo(immo) {
  const { client, uid } = ctx();
  return cloudSaveImmo(client, uid, immo);
}

export async function deleteImmo(immoId) {
  const { client, uid } = ctx();
  return cloudDeleteImmo(client, uid, immoId);
}

/* ------------------------------------------------------------------ */
/* Assurances (fm_assurances)                                          */
/* ------------------------------------------------------------------ */

export async function loadAssurances() {
  const { client, uid } = ctx();
  return cloudLoadAssurances(client, uid);
}

export async function saveAssurance(police) {
  const { client, uid } = ctx();
  return cloudSaveAssurance(client, uid, police);
}

export async function deleteAssurance(assuranceId) {
  const { client, uid } = ctx();
  return cloudDeleteAssurance(client, uid, assuranceId);
}
