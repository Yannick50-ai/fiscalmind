/**
 * Export XML DGI / télédéclaration (EDI) — Phase 7, moteur pur, zéro dépendance.
 *
 * Inspiré du XmlMap `EDI_Mappage` des modules IKA Conseil (analyse
 * migration/analyse-liasse-ce-pt-ratios.md §6) :
 *  - seuls les champs NON VIDES sont exportés (cellules à zéro omises) ;
 *  - montants en FCFA ENTIERS (arrondis) ;
 *  - dates au format `jj/mm/aaaa` ;
 *  - le NCC conserve ses zéros initiaux (exporté en texte).
 *
 * `buildDgiXml({ company, year, bilan, cr, tft, notes, date })` :
 *  - company : { name, ncc, rccm, regime, country } (champs vides omis) ;
 *  - year    : exercice (ex. 2025) ;
 *  - bilan   : sortie de bilanModele2() — { actif: [{ref,label,brut,amort,netN,netN1}],
 *              passif: [{ref,label,netN,netN1}] } ;
 *  - cr      : sortie de compteResultatSIG() — { lignes: [{ref,label,n,n1}] } ;
 *  - tft     : sortie de tftData() — { lignes: [{ref,label,n,n1}] } ;
 *  - notes   : tableau de notesAnnexes() — [{ numero, titre, statut, lignes }] ;
 *  - date    : date de génération (défaut : aujourd'hui) — Date ou 'aaaa-mm-jj'.
 *
 * Retourne : { xml, filename, stats } avec
 *   stats = { lignesBilan, lignesCR, lignesTFT, notes, champsOmits }.
 * `dgiFilename({ year, ncc, date })` → `NO-{exercice}-{ncc}-{aaaammjj}.xml`.
 *
 * Pure ES module, aucun DOM, aucun stockage.
 */

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

/** Échappement XML du texte. */
export function escXml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Montant en FCFA entier (arrondi). Retourne null si vide/nul. */
export function intFcfa(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return null;
  return String(Math.round(n));
}

/** true si le montant est vide ou nul (champ omis de l'export). */
export function isEmptyAmount(v) {
  return v == null || v === '' || Number(v) === 0 || !Number.isFinite(Number(v));
}

/** Date → 'jj/mm/aaaa'. Accepte Date ou 'aaaa-mm-jj'. */
export function fmtDateFR(d) {
  const dt = d instanceof Date ? d : new Date(String(d).slice(0, 10) + 'T00:00:00');
  const p = (x) => String(x).padStart(2, '0');
  return p(dt.getDate()) + '/' + p(dt.getMonth() + 1) + '/' + dt.getFullYear();
}

/** Date → 'aaaammjj' (pour le nom de fichier). */
export function fmtDateFile(d) {
  const dt = d instanceof Date ? d : new Date(String(d).slice(0, 10) + 'T00:00:00');
  const p = (x) => String(x).padStart(2, '0');
  return dt.getFullYear() + p(dt.getMonth() + 1) + p(dt.getDate());
}

/** NCC nettoyé pour le nom de fichier (alphanumérique uniquement). */
export function sanitizeNcc(ncc) {
  const s = String(ncc || '').replace(/[^A-Za-z0-9]/g, '');
  return s || 'SANSNCC';
}

/**
 * Nom de fichier DGI : `NO-{exercice}-{ncc}-{aaaammjj}.xml`
 * (format du classeur NO-Pro.V2, module teleliasse_1.GenererXML).
 */
export function dgiFilename({ year, ncc, date } = {}) {
  return 'NO-' + String(year || '') + '-' + sanitizeNcc(ncc) + '-' + fmtDateFile(date || new Date()) + '.xml';
}

/* ------------------------------------------------------------------ */
/* Construction des lignes                                              */
/* ------------------------------------------------------------------ */

/**
 * Construit un élément <Ligne> à partir d'une ligne d'état et de la liste
 * des colonnes à tester : [['Brut','brut'],['Amort','amort'],['NetN','netN'],...].
 * Retourne null si TOUS les montants sont vides/nuls (règle IKA Conseil).
 * Compte les champs omis dans `omitted` (compteur mutable).
 */
function buildLigne({ ref, label }, colonnes, ligne, omitted) {
  const cells = [];
  for (const [tag, key] of colonnes) {
    const v = intFcfa(ligne[key]);
    if (v === null) { omitted.count += 1; continue; }
    cells.push('<' + tag + '>' + v + '</' + tag + '>');
  }
  if (cells.length === 0) return null;
  return '      <Ligne ref="' + escXml(ref) + '" libelle="' + escXml(label || '') + '">'
    + cells.join('') + '</Ligne>';
}

const COLS_BILAN_ACTIF = [['Brut', 'brut'], ['Amort', 'amort'], ['NetN', 'netN'], ['NetN1', 'netN1']];
const COLS_BILAN_PASSIF = [['NetN', 'netN'], ['NetN1', 'netN1']];
const COLS_CR_TFT = [['N', 'n'], ['N1', 'n1']];

/* ------------------------------------------------------------------ */
/* Export principal                                                     */
/* ------------------------------------------------------------------ */

/**
 * Génère le document XML EDI pour la télédéclaration DGI.
 */
export function buildDgiXml({ company = {}, year, bilan, cr, tft, notes = [], date } = {}) {
  const omitted = { count: 0 };
  const parts = [];
  parts.push('<?xml version="1.0" encoding="UTF-8"?>');
  parts.push('<EDI_Mappage>');

  // ---- En-tête : identification de l'entité (champs vides omis) ----
  parts.push('  <Entete>');
  const entete = [
    ['RaisonSociale', company.name],
    ['NCC', company.ncc],
    ['IFU', company.ifu],
    ['RCCM', company.rccm],
    ['Regime', company.regime],
    ['Pays', company.country],
  ];
  for (const [tag, val] of entete) {
    if (val == null || String(val).trim() === '') { omitted.count += 1; continue; }
    parts.push('    <' + tag + '>' + escXml(String(val).trim()) + '</' + tag + '>');
  }
  parts.push('    <Exercice>' + escXml(String(year || '')) + '</Exercice>');
  parts.push('    <Devise>XOF</Devise>');
  parts.push('    <DateGeneration>' + escXml(fmtDateFR(date || new Date())) + '</DateGeneration>');
  parts.push('  </Entete>');

  // ---- Bilan : refs AA–BZ (actif, Brut/Amort/Net) / CA–DZ (passif) ----
  const stats = { lignesBilan: 0, lignesCR: 0, lignesTFT: 0, notes: 0, champsOmits: 0 };
  parts.push('  <Bilan>');
  parts.push('    <Actif>');
  for (const l of (bilan && bilan.actif) || []) {
    const el = buildLigne(l, COLS_BILAN_ACTIF, l, omitted);
    if (el) { parts.push(el); stats.lignesBilan += 1; }
    else omitted.count += 1;
  }
  parts.push('    </Actif>');
  parts.push('    <Passif>');
  for (const l of (bilan && bilan.passif) || []) {
    const el = buildLigne(l, COLS_BILAN_PASSIF, l, omitted);
    if (el) { parts.push(el); stats.lignesBilan += 1; }
    else omitted.count += 1;
  }
  parts.push('    </Passif>');
  parts.push('  </Bilan>');

  // ---- Compte de résultat : refs TA–XI ----
  parts.push('  <CompteResultat>');
  for (const l of (cr && cr.lignes) || []) {
    const el = buildLigne(l, COLS_CR_TFT, l, omitted);
    if (el) { parts.push(el); stats.lignesCR += 1; }
    else omitted.count += 1;
  }
  parts.push('  </CompteResultat>');

  // ---- TFT : refs ZA–ZH (méthode directe) ----
  parts.push('  <TFT>');
  for (const l of (tft && tft.lignes) || []) {
    const el = buildLigne(l, COLS_CR_TFT, l, omitted);
    if (el) { parts.push(el); stats.lignesTFT += 1; }
    else omitted.count += 1;
  }
  parts.push('  </TFT>');

  // ---- Notes annexes (résumé : une <Note> par note, lignes non vides) ----
  parts.push('  <Notes>');
  for (const note of notes || []) {
    const el = buildNote(note, omitted);
    if (el) { parts.push(el); stats.notes += 1; }
    else omitted.count += 1;
  }
  parts.push('  </Notes>');

  parts.push('</EDI_Mappage>');
  stats.champsOmits = omitted.count;
  return {
    xml: parts.join('\n'),
    filename: dgiFilename({ year, ncc: company.ncc || company.ifu, date: date || new Date() }),
    stats,
  };
}

/**
 * Construit un élément <Note> à partir d'une note annexe
 * ({ numero, titre, statut, lignes, formulaire? }).
 * Lignes de type 'mouvements' : { label, compte, ouverture, plus, moins, cloture }.
 * Lignes de type 'soldes'     : { label, compte, n, n1, varPct }.
 * Notes manuelles : formulaire [{ key, label, type, value }] — champs remplis exportés.
 * Retourne null si rien n'est exportable.
 */
export function buildNote(note, omitted) {
  if (!note) return null;
  const om = omitted || { count: 0 };
  const inner = [];
  for (const l of note.lignes || []) {
    const cells = [];
    const money = [['Ouverture', 'ouverture'], ['Plus', 'plus'], ['Moins', 'moins'],
      ['Cloture', 'cloture'], ['N', 'n'], ['N1', 'n1']];
    for (const [tag, key] of money) {
      const v = intFcfa(l[key]);
      if (v === null) { om.count += 1; continue; }
      cells.push('<' + tag + '>' + v + '</' + tag + '>');
    }
    if (l.varPct != null && l.varPct !== '' && Number.isFinite(Number(l.varPct))) {
      cells.push('<VarPct>' + (Math.round(Number(l.varPct) * 100) / 100) + '</VarPct>');
    } else { om.count += 1; }
    if (cells.length === 0) { om.count += 1; continue; }
    inner.push('      <LigneNote compte="' + escXml(l.compte || '') + '" libelle="'
      + escXml(l.label || '') + '">' + cells.join('') + '</LigneNote>');
  }
  for (const f of note.formulaire || []) {
    if (f.value == null || String(f.value).trim() === '') { om.count += 1; continue; }
    inner.push('      <Champ cle="' + escXml(f.key || '') + '" libelle="' + escXml(f.label || '') + '">'
      + escXml(String(f.value).trim()) + '</Champ>');
  }
  if (inner.length === 0) return null;
  return '    <Note numero="' + escXml(String(note.numero || '')) + '" titre="'
    + escXml(note.titre || '') + '" statut="' + escXml(note.statut || '') + '">'
    + '\n' + inner.join('\n') + '\n    </Note>';
}
