/**
 * Tests des données fiscales 17 pays OHADA (étape 2).
 * node:test + node:assert/strict, zéro dépendance.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COUNTRIES, getCountry, countryCodes, applyTaxOverrides,
} from '../src/data/countries.js';
import { FISCAL_CALENDARS, getCalendar, getMonthDeadlines } from '../src/data/calendars.js';
import { FICHES, getFiche } from '../src/data/fiches.js';
import {
  STATUTS_CONFIANCE, CLES_IMPOTS, isValidRate,
  validateCountries, validateCalendars, validateFiches,
} from '../src/data/validate.js';

const CODES_ATTENDUS = ['BF', 'BJ', 'CD', 'CF', 'CG', 'CI', 'CM', 'GA', 'GN', 'GQ', 'GW', 'KM', 'ML', 'NE', 'SN', 'TD', 'TG'];

test('exactement 17 pays OHADA', () => {
  assert.equal(COUNTRIES.length, 17);
  assert.deepEqual([...countryCodes()].sort(), [...CODES_ATTENDUS].sort());
});

test('getCountry : recherche insensible à la casse, null si inconnu', () => {
  assert.equal(getCountry('BF').nom, 'Burkina Faso');
  assert.equal(getCountry('bf').nom, 'Burkina Faso');
  assert.equal(getCountry('XX'), null);
  assert.equal(getCountry(''), null);
});

test('chaque pays a code/nom/tva/is/social/statut', () => {
  for (const p of COUNTRIES) {
    assert.match(p.code, /^[A-Z]{2}$/, `code ${p.code}`);
    assert.ok(p.nom, `nom manquant pour ${p.code}`);
    assert.equal(typeof p.tva, 'number', `tva ${p.code}`);
    assert.equal(typeof p.is, 'number', `is ${p.code}`);
    assert.ok(p.social && typeof p.social === 'object', `social ${p.code}`);
    assert.ok(p.statut, `statut ${p.code}`);
  }
});

test('taux TVA/IS dans [0,100]', () => {
  for (const p of COUNTRIES) {
    assert.ok(p.tva >= 0 && p.tva <= 100, `tva ${p.code} = ${p.tva}`);
    assert.ok(p.is >= 0 && p.is <= 100, `is ${p.code} = ${p.is}`);
  }
});

test('taux sociaux valides (nombre ou fourchette)', () => {
  for (const p of COUNTRIES) {
    assert.ok(isValidRate(p.social.employer), `employer ${p.code}`);
    assert.ok(isValidRate(p.social.employee), `employee ${p.code}`);
    assert.ok(p.social.org, `org ${p.code}`);
    assert.ok(p.social.status, `status ${p.code}`);
  }
});

test('statuts dans l\u2019enum de confiance', () => {
  for (const p of COUNTRIES) {
    assert.ok(STATUTS_CONFIANCE.includes(p.statut), `${p.code}: ${p.statut}`);
  }
});

test('garde-fous anti-régression sur valeurs vérifiées', () => {
  assert.equal(getCountry('BF').is, 27.5);
  assert.equal(getCountry('BF').tva, 18);
  assert.equal(getCountry('BF').social.employer, 16);
  assert.equal(getCountry('BF').social.employee, 5.5);
  assert.equal(getCountry('CM').tva, 19.25);
  assert.equal(getCountry('GN').tva, 20);
  assert.equal(getCountry('CD').tva, 16);
  assert.equal(getCountry('GQ').tva, 15);
  assert.equal(getCountry('GW').tva, 10);
  assert.equal(getCountry('KM').tva, 10);
  assert.equal(getCountry('NE').tva, 19);
  assert.equal(getCountry('ML').social.employee, 6.66);
  assert.deepEqual(getCountry('ML').social.employer, { min: 18.9, max: 21.9 });
  assert.equal(getCountry('NE').social.employer, 16.4);
  assert.equal(getCountry('CD').social.employer, 13);
  assert.equal(getCountry('GW').social.status, 'Provisoire — à vérifier');
});

test('chaque pays a au moins une échéance au calendrier', () => {
  for (const code of CODES_ATTENDUS) {
    const cal = getCalendar(code);
    assert.ok(cal.length >= 1, `${code} sans échéance`);
  }
  assert.deepEqual(getCalendar('XX'), []);
});

test('échéances : mois/jour/impôt valides', () => {
  for (const [code, list] of Object.entries(FISCAL_CALENDARS)) {
    for (const e of list) {
      assert.ok(e.mois >= 1 && e.mois <= 12, `${code} mois ${e.mois}`);
      assert.ok(e.jour >= 1 && e.jour <= 31, `${code} jour ${e.jour}`);
      assert.ok(e.label, `${code} label vide`);
      assert.ok(CLES_IMPOTS.includes(e.impot), `${code} impot ${e.impot}`);
      assert.ok(e.periodicite, `${code} periodicite vide`);
    }
  }
});

test('getMonthDeadlines filtre par mois', () => {
  const jan = getMonthDeadlines('BF', 1);
  assert.ok(jan.length >= 1);
  assert.ok(jan.every((e) => e.mois === 1));
  assert.deepEqual(getMonthDeadlines('BF', 13), []);
});

test('fiches : 5 impôts par pays, champs renseignés', () => {
  const CHAMPS = ['nom', 'periodicite', 'taux', 'echeance', 'penalites', 'base', 'conseil'];
  for (const code of CODES_ATTENDUS) {
    for (const k of CLES_IMPOTS) {
      const f = getFiche(code, k);
      assert.ok(f, `fiche ${code}/${k} manquante`);
      for (const c of CHAMPS) assert.ok(f[c], `fiche ${code}/${k}.${c} vide`);
    }
  }
  assert.equal(getFiche('BF', 'TVA').periodicite, 'Mensuelle');
  assert.equal(getFiche('XX', 'TVA'), null);
  assert.equal(getFiche('BF', 'XXX'), null);
});

test('validateurs : 0 erreur sur les données livrées', () => {
  assert.deepEqual(validateCountries(), []);
  assert.deepEqual(validateCalendars(), []);
  assert.deepEqual(validateFiches(), []);
});

test('applyTaxOverrides : pur, applique, recalcule, ignore l\u2019invalide', () => {
  const bf = getCountry('BF');
  const next = applyTaxOverrides(bf, { tva: 20, employer: 18 });
  assert.equal(next.tva, 20);
  assert.equal(next.social.employer, 18);
  assert.equal(next.social.combined, 23.5);
  assert.equal(next.social.status, "Personnalisé par l'utilisateur");
  assert.equal(bf.tva, 18, 'original non muté');
  assert.equal(bf.social.employer, 16, 'original non muté');
  const same = applyTaxOverrides(bf, { tva: 'abc', is: NaN });
  assert.equal(same, bf, 'overrides invalides → objet inchangé');
  const partial = applyTaxOverrides(bf, {});
  assert.equal(partial, bf);
});
