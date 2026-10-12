/**
 * FiscalMind Africa — Assurances : polices, alertes, sinistres, primes (pur).
 *
 * Port de fmJoursRestants / fmStatutAssurance / fmPayerPrime de
 * fiscalmind-app.html. 100 % pur : la persistance vit dans fmCloud
 * (table fm_assurances). L'écriture de prime suit le format canonique :
 * 625 « Primes d'assurance » (D) -> 521 banque (C), journal BQ.
 *
 * Police : { id, assureur, numero, type, bien, prime,
 *   dateSouscription, dateExpiration, primes: [annees],
 *   sinistres: [{ id, date, statut, description, reclame, indemnise }] }.
 */

/** Jours restants avant expiration (négatif si expirée). `today` injectable (tests). */
export function joursRestants(dateExpiration, today) {
  const t = today ? new Date(today + 'T00:00:00') : new Date();
  t.setHours(0, 0, 0, 0);
  const exp = new Date(String(dateExpiration) + 'T00:00:00');
  return Math.ceil((exp - t) / 86400000);
}

/** Statut d'une police : { txt, tone: 'danger'|'warn'|'ok' }. */
export function statutAssurance(police, today) {
  const j = joursRestants(police.dateExpiration, today);
  if (j < 0) return { txt: 'Expirée depuis ' + -j + ' j', tone: 'danger' };
  if (j <= 30) return { txt: 'Expire dans ' + j + ' j', tone: 'danger' };
  if (j <= 90) return { txt: 'Expire dans ' + j + ' j', tone: 'warn' };
  return { txt: 'Expire dans ' + j + ' j', tone: 'ok' };
}

/** Polices à renouveler : expiration dans moins de 60 jours (ou déjà expirées). */
export function policesUrgentes(polices, today) {
  return (polices || []).filter((p) => joursRestants(p.dateExpiration, today) <= 60);
}

/** Tri par expiration croissante (immuable). */
export function sortByExpiration(polices) {
  return (polices || []).slice().sort((a, b) =>
    String(a.dateExpiration) < String(b.dateExpiration) ? -1 : 1
  );
}

/** Vrai si la prime de l'année est déjà payée. */
export function isPrimePayee(police, annee) {
  return (police.primes || []).indexOf(Number(annee)) >= 0;
}

let _seq = 0;

/**
 * Écriture canonique de paiement de prime (ou null si déjà payée).
 * 625 « Primes d'assurance » (D) -> 521 banque (C), journal BQ.
 */
export function primeEntry(police, annee, dateISO) {
  const y = Number(annee);
  if (!police || isPrimePayee(police, y)) return null;
  const prime = Math.round(Number(police.prime) || 0);
  if (prime <= 0) return null;
  _seq += 1;
  const label = 'Prime assurance ' + y + ' — ' + police.assureur + ' (' + police.numero + ')';
  return {
    id: 'pr' + Date.now().toString(36) + '-' + _seq,
    date: dateISO || new Date().toISOString().slice(0, 10),
    journal: 'BQ',
    piece: 'ASS' + y,
    libelle: label,
    lignes: [
      { compte: '625', debit: prime, credit: 0 },
      { compte: '521', debit: 0, credit: prime },
    ],
  };
}

/** Nettoie une police saisie (immuable). Retourne { ok, police, errors }. */
export function sanitizePolice(raw) {
  const r = raw || {};
  const errors = [];
  const assureur = String(r.assureur || '').trim().slice(0, 80);
  const numero = String(r.numero || '').trim().slice(0, 40);
  const prime = Math.round(Number(r.prime) || 0);
  const dateSouscription = String(r.dateSouscription || '');
  const dateExpiration = String(r.dateExpiration || '');
  if (!assureur) errors.push('Assureur requis.');
  if (!numero) errors.push('Numéro de police requis.');
  if (prime <= 0) errors.push('Prime annuelle > 0 requise.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateSouscription)) errors.push('Date de souscription requise.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateExpiration)) errors.push("Date d'expiration requise.");
  return {
    ok: errors.length === 0,
    errors,
    police: {
      id: String(r.id || 'as' + Date.now().toString(36)),
      assureur,
      numero,
      type: String(r.type || 'Multirisque').slice(0, 60),
      bien: String(r.bien || '').trim().slice(0, 80),
      prime,
      dateSouscription,
      dateExpiration,
      primes: Array.isArray(r.primes) ? r.primes.map(Number) : [],
      sinistres: Array.isArray(r.sinistres) ? r.sinistres : [],
    },
  };
}

/** Nettoie un sinistre saisi (immuable). Retourne { ok, sinistre, errors }. */
export function sanitizeSinistre(raw) {
  const r = raw || {};
  const errors = [];
  const description = String(r.description || '').trim().slice(0, 200);
  const date = String(r.date || '');
  const statut = ['En cours', 'Indemnisé', 'Rejeté'].indexOf(r.statut) >= 0 ? r.statut : 'En cours';
  if (!description) errors.push('Description requise.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push('Date du sinistre requise.');
  return {
    ok: errors.length === 0,
    errors,
    sinistre: {
      id: String(r.id || 'sn' + Date.now().toString(36)),
      date,
      statut,
      description,
      reclame: Math.max(0, Math.round(Number(r.reclame) || 0)),
      indemnise: Math.max(0, Math.round(Number(r.indemnise) || 0)),
    },
  };
}
