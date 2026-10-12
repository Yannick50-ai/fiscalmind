/**
 * Validateurs des données fiscales 17 pays OHADA — FiscalMind Africa (étape 2).
 * 100 % pur : chaque fonction retourne un tableau d'erreurs (vide = valide).
 */
import { COUNTRIES } from './countries.js';
import { FISCAL_CALENDARS } from './calendars.js';
import { FICHES } from './fiches.js';

export const STATUTS_CONFIANCE = ['Confirmé', 'Partiellement vérifié', 'À vérifier'];
export const CLES_IMPOTS = ['TVA', 'IS', 'SAL', 'SOC', 'ANNUEL'];

/** Taux valide : nombre dans [0,100], ou fourchette {min,max} avec 0 <= min <= max <= 100. */
export function isValidRate(v) {
  if (typeof v === 'number') return isFinite(v) && v >= 0 && v <= 100;
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const { min, max } = v;
    return typeof min === 'number' && typeof max === 'number'
      && isFinite(min) && isFinite(max) && min >= 0 && min <= max && max <= 100;
  }
  return false;
}

export function validateCountries() {
  const errors = [];
  const seen = new Set();
  if (!Array.isArray(COUNTRIES) || COUNTRIES.length !== 17) {
    errors.push(`COUNTRIES: attendu 17 pays, trouvé ${Array.isArray(COUNTRIES) ? COUNTRIES.length : 'non-tableau'}`);
  }
  for (const p of COUNTRIES || []) {
    const tag = p.code || p.nom || '?';
    if (!/^[A-Z]{2}$/.test(p.code || '')) errors.push(`${tag}: code invalide`);
    if (seen.has(p.code)) errors.push(`${tag}: code dupliqué`);
    seen.add(p.code);
    if (!p.nom) errors.push(`${tag}: nom manquant`);
    if (!isValidRate(p.tva)) errors.push(`${tag}: tva hors [0,100] (${JSON.stringify(p.tva)})`);
    if (!isValidRate(p.is)) errors.push(`${tag}: is hors [0,100] (${JSON.stringify(p.is)})`);
    if (!STATUTS_CONFIANCE.includes(p.statut)) errors.push(`${tag}: statut inconnu (${p.statut})`);
    const s = p.social || {};
    if (!isValidRate(s.employer)) errors.push(`${tag}: social.employer invalide (${JSON.stringify(s.employer)})`);
    if (!isValidRate(s.employee)) errors.push(`${tag}: social.employee invalide (${JSON.stringify(s.employee)})`);
    if (!s.org) errors.push(`${tag}: social.org manquant`);
    if (!s.status) errors.push(`${tag}: social.status manquant`);
    for (const k of CLES_IMPOTS) {
      if (!p.labels || !p.labels[k]) errors.push(`${tag}: labels.${k} manquant`);
    }
  }
  return errors;
}

export function validateCalendars() {
  const errors = [];
  const codes = new Set((COUNTRIES || []).map((p) => p.code));
  for (const code of Object.keys(FISCAL_CALENDARS || {})) {
    if (!codes.has(code)) errors.push(`calendriers: code inconnu ${code}`);
  }
  for (const p of COUNTRIES || []) {
    const list = FISCAL_CALENDARS[p.code];
    if (!Array.isArray(list) || list.length === 0) {
      errors.push(`${p.code}: aucune échéance au calendrier`);
      continue;
    }
    list.forEach((e, i) => {
      const tag = `${p.code}[${i}]`;
      if (!Number.isInteger(e.mois) || e.mois < 1 || e.mois > 12) errors.push(`${tag}: mois invalide (${e.mois})`);
      if (!Number.isInteger(e.jour) || e.jour < 1 || e.jour > 31) errors.push(`${tag}: jour invalide (${e.jour})`);
      if (!e.label) errors.push(`${tag}: libellé manquant`);
      if (!CLES_IMPOTS.includes(e.impot)) errors.push(`${tag}: impot inconnu (${e.impot})`);
      if (!e.periodicite) errors.push(`${tag}: periodicite manquante`);
    });
  }
  return errors;
}

export function validateFiches() {
  const errors = [];
  const CHAMPS = ['nom', 'periodicite', 'taux', 'echeance', 'penalites', 'base', 'conseil'];
  for (const p of COUNTRIES || []) {
    const f = FICHES[p.code];
    if (!f) { errors.push(`${p.code}: aucune fiche`); continue; }
    for (const k of CLES_IMPOTS) {
      const fiche = f[k];
      if (!fiche) { errors.push(`${p.code}: fiche ${k} manquante`); continue; }
      for (const c of CHAMPS) {
        if (!fiche[c]) errors.push(`${p.code}/${k}: champ ${c} vide`);
      }
    }
  }
  return errors;
}

/** Valide tout et retourne { countries, calendars, fiches, total }. */
export function validateAll() {
  const countries = validateCountries();
  const calendars = validateCalendars();
  const fiches = validateFiches();
  return { countries, calendars, fiches, total: countries.length + calendars.length + fiches.length };
}
