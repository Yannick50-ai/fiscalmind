/**
 * Fiches R1–R4 + contrôle de RECEVABILITÉ de la DSF OHADA — Phase 8.
 *
 * Référence : analyse-dsf-ohada.md §6 (logique du classeur de Yannick).
 *  - R1 : identification complète de l'entité (feuille ENTITE du classeur).
 *  - R2 : renseignements divers — dirigeants (saisie manuelle).
 *  - R3 : renseignements divers — associés / actionnaires (saisie manuelle).
 *  - R4 : fiche récapitulative des notes annexes — liste des notes chiffrées /
 *         non chiffrées / non applicables. Les titres et la nature de chaque
 *         note (calculée / manuelle) viennent de NOTES_TITRES (notes.js,
 *         jamais modifié) ; `notesStatus` permet de forcer un statut.
 *  - RECEVABILITE : contrôles de complétude calculables avant dépôt
 *         (entreprise renseignée ? bilan équilibré ? XI == CJ ? notes
 *         chiffrées présentes ?).
 *
 * buildFiches({ company, dirigeants, associes, notesStatus, bilan, cr })
 *  - company    : { nom, sigle, adresse, rccm, nif, regime, exerciceDebut,
 *                 exerciceFin, telephone, email, expertNom, expertContact }
 *  - dirigeants : [{ nom, qualite, contact }]
 *  - associes   : [{ nom, qualite, part }] (part = % ou fraction, texte libre)
 *  - notesStatus: { [numero]: 'chiffree'|'non_chiffree'|'non_applicable' }
 *  - bilan      : résultat de bilanModele2(entries, { year }) (optionnel)
 *  - cr         : résultat de compteResultatSIG(entries, { year }) (optionnel)
 *
 * → { r1: [{ champ, valeur, obligatoire }], r2, r3, r4, recevabilite }
 *   r2 : [{ nom, qualite, contact }] ; r3 : [{ nom, qualite, part }]
 *   r4 : [{ numero, note, titre, statut }] — statut ∈ 'Chiffrée',
 *        'Non chiffrée', 'Non applicable'
 *   recevabilite : [{ controle, ok, detail }] — ok null = non calculable
 *        (données bilan/CR non fournies).
 *
 * Module ES pur : zéro DOM, zéro stockage.
 */

import { NOTES_TITRES } from './notes.js';

/* ------------------------------------------------------------------ */
/* R1 — identification de l'entité                                     */
/* ------------------------------------------------------------------ */

/** [clé company, libellé officiel, obligatoire] */
const R1_CHAMPS = [
  ['nom', 'Dénomination sociale', true],
  ['sigle', 'Sigle', true],
  ['adresse', 'Adresse complète', true],
  ['rccm', 'RCCM', true],
  ['nif', 'NIF / Numéro de contribuable', true],
  ['regime', 'Régime fiscal', true],
  ['exercice', 'Exercice (début – fin)', true],
  ['telephone', 'Téléphone', true],
  ['email', 'Email', true],
  ['expertNom', 'Expert-comptable — nom', false],
  ['expertContact', 'Expert-comptable — contact', false],
];

export const R1_OBLIGATOIRES = R1_CHAMPS.filter((c) => c[2]).map((c) => c[1]);

const clean = (v) => String(v === undefined || v === null ? '' : v).trim();

/** '2025-01-01' → '01/01/2025' (retourne la chaîne brute si non ISO). */
function fmtIso(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(clean(iso));
  return m ? m[3] + '/' + m[2] + '/' + m[1] : clean(iso);
}

/** Valeur d'affichage d'un champ R1 de la société. */
function companyValue(company, cle) {
  if (cle === 'exercice') {
    const d = fmtIso(company.exerciceDebut);
    const f = fmtIso(company.exerciceFin);
    return d || f ? [d, f].filter(Boolean).join(' – ') : '';
  }
  return clean(company[cle]);
}

export function buildR1(company = {}) {
  const c = company && typeof company === 'object' ? company : {};
  return R1_CHAMPS.map(([cle, champ, obligatoire]) => ({
    champ,
    valeur: companyValue(c, cle),
    obligatoire,
  }));
}

/* ------------------------------------------------------------------ */
/* R2 / R3 — dirigeants et associés (saisie manuelle)                  */
/* ------------------------------------------------------------------ */

export function buildR2(dirigeants = []) {
  return (Array.isArray(dirigeants) ? dirigeants : []).map((d) => ({
    nom: clean(d && d.nom),
    qualite: clean(d && d.qualite),
    contact: clean(d && d.contact),
  })).filter((d) => d.nom || d.qualite || d.contact);
}

export function buildR3(associes = []) {
  return (Array.isArray(associes) ? associes : []).map((a) => ({
    nom: clean(a && a.nom),
    qualite: clean(a && a.qualite),
    part: clean(a && a.part),
  })).filter((a) => a.nom || a.qualite || a.part);
}

/* ------------------------------------------------------------------ */
/* R4 — récapitulatif des notes annexes                                */
/* ------------------------------------------------------------------ */

const STATUT_LABEL = {
  chiffree: 'Chiffrée',
  non_chiffree: 'Non chiffrée',
  non_applicable: 'Non applicable',
};

export const NOTES_STATUTS = Object.keys(STATUT_LABEL);

/** Statut par défaut : calculée → Chiffrée, manuelle → Non chiffrée. */
function defaultStatut(noteStatut) {
  return noteStatut === 'calculee' ? 'chiffree' : 'non_chiffree';
}

export function buildR4(notesStatus = {}) {
  return NOTES_TITRES.map((t) => {
    const forced = notesStatus && notesStatus[t.numero];
    const statut = STATUT_LABEL[forced] ? forced : defaultStatut(t.statut);
    return {
      numero: t.numero,
      note: 'Note ' + t.numero,
      titre: t.titre,
      statut: STATUT_LABEL[statut],
      statutCode: statut,
    };
  });
}

/* ------------------------------------------------------------------ */
/* RECEVABILITÉ — contrôles de complétude avant dépôt                   */
/* ------------------------------------------------------------------ */

const FCFA = (n) => Math.round(Number(n) || 0).toLocaleString('fr-FR') + ' FCFA';

export function buildRecevabilite({ company = {}, r4 = [], bilan = null, cr = null } = {}) {
  const controles = [];

  // 1. Fiche R1 complète (champs obligatoires renseignés).
  const r1 = buildR1(company);
  const manquants = r1.filter((r) => r.obligatoire && !r.valeur).map((r) => r.champ);
  controles.push({
    controle: 'Fiche R1 — identification complète',
    ok: manquants.length === 0,
    detail: manquants.length
      ? 'Champs manquants : ' + manquants.join(', ')
      : 'Tous les champs obligatoires sont renseignés.',
  });

  // 2. Dirigeants renseignés (fiche R2).
  const hasDirigeants = Array.isArray(company.dirigeants)
    ? company.dirigeants.length > 0
    : company.hasDirigeants === true;
  controles.push({
    controle: 'Fiches R2/R3 — dirigeants renseignés',
    ok: hasDirigeants,
    detail: hasDirigeants
      ? 'Au moins un dirigeant renseigné en fiche R2.'
      : 'Aucun dirigeant renseigné (fiche R2).',
  });

  // 3. Bilan équilibré (Actif = Passif).
  if (bilan && bilan.controles && typeof bilan.controles.actifEqPassif === 'boolean') {
    controles.push({
      controle: 'Bilan équilibré (Actif = Passif)',
      ok: bilan.controles.actifEqPassif,
      detail: bilan.controles.actifEqPassif
        ? 'Écart : ' + FCFA(bilan.controles.ecart || 0) + ' — équilibré.'
        : 'Écart Actif/Passif : ' + FCFA(bilan.controles.ecart || 0) + ' — à corriger avant dépôt.',
    });
  } else {
    controles.push({
      controle: 'Bilan équilibré (Actif = Passif)',
      ok: null,
      detail: 'Bilan non calculé (aucune donnée d’exercice fournie).',
    });
  }

  // 4. Cohérence CR ↔ Bilan : résultat net XI == CJ.
  if (bilan && cr && Number.isFinite(bilan.resNet) && Number.isFinite(cr.resNet)) {
    const coherent = Math.abs(bilan.resNet - cr.resNet) < 1;
    controles.push({
      controle: 'Cohérence résultat (CR XI = Bilan CJ)',
      ok: coherent,
      detail: coherent
        ? 'Résultat net : ' + FCFA(cr.resNet) + ' (XI = CJ).'
        : 'Écart : CR XI = ' + FCFA(cr.resNet) + ' ≠ Bilan CJ = ' + FCFA(bilan.resNet) + '.',
    });
  } else {
    controles.push({
      controle: 'Cohérence résultat (CR XI = Bilan CJ)',
      ok: null,
      detail: 'Compte de résultat ou bilan non calculé.',
    });
  }

  // 5. Notes chiffrées présentes en R4.
  const chiffrees = r4.filter((n) => n.statutCode === 'chiffree').length;
  controles.push({
    controle: 'Notes annexes chiffrées (R4)',
    ok: chiffrees > 0,
    detail: chiffrees > 0
      ? chiffrees + ' / ' + r4.length + ' notes chiffrées.'
      : 'Aucune note chiffrée — la liasse est incomplète.',
  });

  return controles;
}

/* ------------------------------------------------------------------ */
/* API principale                                                       */
/* ------------------------------------------------------------------ */

export function buildFiches({
  company = {},
  associes = [],
  dirigeants = [],
  notesStatus = {},
  bilan = null,
  cr = null,
} = {}) {
  const c = company && typeof company === 'object' ? company : {};
  const r1 = buildR1(c);
  const r2 = buildR2(dirigeants);
  const r3 = buildR3(associes);
  const r4 = buildR4(notesStatus);
  const recevabilite = buildRecevabilite({
    company: Object.assign({}, c, { hasDirigeants: r2.length > 0 }),
    r4, bilan, cr,
  });
  return { r1, r2, r3, r4, recevabilite };
}
