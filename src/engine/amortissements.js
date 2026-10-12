/**
 * FiscalMind Africa — Amortissements linéaires + prorata temporis (pur).
 *
 * Port de fmImmoAnnuite / fmPlanAmorto / fmGenererDotation de
 * fiscalmind-app.html. 100 % pur : la persistance vit dans fmCloud
 * (table fm_immos). L'écriture de dotation suit le format canonique :
 * 681 (débit) -> compte d'amortissement (crédit), journal OD, au 31/12.
 *
 * Immobilisation : { id, designation, compte, compteAmort, valeur,
 *   duree (années), dateMiseEnService (AAAA-MM-JJ), booked: [annees] }.
 */

/** Annuité constante = valeur / durée. */
export function annuite(immo) {
  return Number(immo.valeur) / Number(immo.duree);
}

/**
 * Plan d'amortissement : [{ annee, dotation, cumul, vnc }].
 * - année 0 (mise en service) : prorata temporis (13 - mois) / 12
 * - dernière année : solde pour atteindre exactement la valeur
 * - sinon : annuité constante (arrondie).
 */
export function planAmortissement(immo) {
  const ann = annuite(immo);
  const d0 = new Date(String(immo.dateMiseEnService) + 'T00:00:00');
  const y0 = d0.getFullYear();
  const m0 = d0.getMonth() + 1;
  const duree = Number(immo.duree);
  const valeur = Number(immo.valeur);
  const plan = [];
  let cumul = 0;
  for (let i = 0; i <= duree; i++) {
    let dot;
    if (i === 0) dot = (ann * (13 - m0)) / 12;
    else if (i === duree) dot = valeur - cumul;
    else dot = ann;
    dot = Math.max(0, Math.round(dot));
    cumul += dot;
    plan.push({ annee: y0 + i, dotation: dot, cumul, vnc: valeur - cumul });
  }
  return plan;
}

/** Vrai si la dotation d'une année est déjà comptabilisée. */
export function isDotationBooked(immo, annee) {
  return (immo.booked || []).indexOf(Number(annee)) >= 0;
}

/** Cumul comptabilisé + VNC résiduelle. */
export function bookedSummary(immo) {
  const plan = planAmortissement(immo);
  const cumulBooked = plan
    .filter((p) => isDotationBooked(immo, p.annee))
    .reduce((a, p) => a + p.dotation, 0);
  return {
    cumulBooked,
    vnc: Number(immo.valeur) - cumulBooked,
    percent: Number(immo.valeur) > 0 ? Math.round((cumulBooked / Number(immo.valeur)) * 100) : 0,
  };
}

let _seq = 0;

/**
 * Écriture canonique de dotation pour une année (ou null si rien à passer).
 * 681 « Dotations aux amortissements » (D) -> compteAmort (C), journal OD, 31/12.
 */
export function dotationEntry(immo, annee) {
  const p = planAmortissement(immo).find((x) => x.annee === Number(annee));
  if (!p || !p.dotation) return null;
  if (isDotationBooked(immo, annee)) return null;
  _seq += 1;
  const label = 'Dotation amortissements ' + p.annee + ' — ' + immo.designation;
  return {
    id: 'am' + Date.now().toString(36) + '-' + _seq,
    date: p.annee + '-12-31',
    journal: 'OD',
    piece: 'DOT' + p.annee,
    libelle: label,
    lignes: [
      { compte: '681', debit: p.dotation, credit: 0 },
      { compte: String(immo.compteAmort), debit: 0, credit: p.dotation },
    ],
  };
}

/** Nettoie une immobilisation saisie (immuable). Retourne { ok, immo, errors }. */
export function sanitizeImmo(raw) {
  const r = raw || {};
  const errors = [];
  const designation = String(r.designation || '').trim().slice(0, 80);
  const compte = String(r.compte || '').trim();
  const compteAmort = String(r.compteAmort || '').trim();
  const valeur = Math.round(Number(r.valeur) || 0);
  const duree = parseInt(r.duree, 10) || 0;
  const dateMiseEnService = String(r.dateMiseEnService || '');
  if (!designation) errors.push('Désignation requise.');
  if (!/^\d{2,6}$/.test(compte)) errors.push('Compte immobilisation : 2 à 6 chiffres.');
  if (!/^\d{2,6}$/.test(compteAmort)) errors.push("Compte d'amortissement : 2 à 6 chiffres.");
  if (valeur <= 0) errors.push("Valeur d'acquisition > 0 requise.");
  if (duree <= 0 || duree > 50) errors.push('Durée : 1 à 50 ans.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateMiseEnService)) errors.push('Date de mise en service requise.');
  return {
    ok: errors.length === 0,
    errors,
    immo: {
      id: String(r.id || 'im' + Date.now().toString(36)),
      designation, compte, compteAmort, valeur, duree, dateMiseEnService,
      booked: Array.isArray(r.booked) ? r.booked.map(Number) : [],
    },
  };
}
