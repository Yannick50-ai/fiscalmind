/**
 * Import CSV des écritures — Phase 7, moteur pur, zéro dépendance.
 *
 * Reproduit le pipeline du classeur NO-Pro.V2
 * (Module48.ImorterGrandLivre_Cliquer, voir
 * migration/analyse-liasse-ce-pt-ratios.md §8.2) : import comptable
 * ligne par ligne, dates `ddMMyy` (ex. « 010126 » → 2026-01-01).
 *
 * Format attendu : `compte;date;journal;piece;libelle;debit;credit`
 * (séparateur `;` ou `,` auto-détecté ; une ligne d'en-tête nommée est
 * reconnue et mappée par nom de colonne, sinon les colonnes sont
 * positionnelles).
 *
 * `parseJournalCsv(text, options?)` :
 *  - options: { idPrefix } — préfixe des id d'écritures générés
 *    (défaut 'imp') ;
 *  - dates acceptées : `ddMMyy` (6 chiffres), `jj/mm/aaaa`
 *    (séparateurs / - .), `aaaa-mm-jj` (ISO) ;
 *  - regroupement des lignes en écritures par `piece`+`date`
 *    (ou par `ecriture_id` si la colonne est présente) ;
 *  - contrôle d'équilibre débit = crédit par écriture
 *    (tolérance 0,005 FCFA) ;
 *  - une ligne fautive ne jette jamais tout le fichier :
 *    retourne { ecritures, erreurs, stats } avec
 *    erreurs = [{ ligne (n° dans le fichier, 1-based), message }].
 *
 * Écritures retournées au format canonique du moteur :
 * { id, date (aaaa-mm-jj), journal, piece, libelle,
 *   lignes: [{ compte, debit, credit }] }.
 *
 * Pure ES module, aucun DOM, aucun stockage.
 */

const TOLERANCE = 0.005;

/* ------------------------------------------------------------------ */
/* Découpage CSV                                                        */
/* ------------------------------------------------------------------ */

/** Découpe une ligne CSV en champs (gère les guillemets et "" échappés). */
function splitCsvLine(line, sep) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i += 1; }
        else inQuotes = false;
      } else cur += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === sep) {
      out.push(cur); cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** Normalise un nom de colonne (minuscules, sans accents/espaces). */
function normColName(s) {
  return String(s || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/** Noms de colonnes reconnus pour le mappage par en-tête. */
const KNOWN_COLS = {
  compte: ['compte', 'numcpte', 'nocpte', 'cpt', 'account'],
  date: ['date', 'datedate', 'dat', 'jour'],
  journal: ['journal', 'jnl', 'codejournal'],
  piece: ['piece', 'numpiece', 'refpiece', 'reference', 'ref', 'num'],
  libelle: ['libelle', 'lib', 'libelles', 'intitule', 'designation'],
  debit: ['debit', 'db', 'md', 'montantdebit'],
  credit: ['credit', 'cr', 'mc', 'montantcredit'],
  ecriture_id: ['ecritureid', 'idecriture', 'id', 'numecriture'],
};

function mapHeader(cells) {
  const map = {};
  const normed = cells.map(normColName);
  const hasKnown = normed.some((n) => Object.values(KNOWN_COLS).flat().includes(n));
  if (!hasKnown) return null;
  for (const [key, aliases] of Object.entries(KNOWN_COLS)) {
    const idx = normed.findIndex((n) => aliases.includes(n));
    if (idx >= 0) map[key] = idx;
  }
  return map;
}

/* ------------------------------------------------------------------ */
/* Conversions                                                          */
/* ------------------------------------------------------------------ */

/** Compte OHADA valide : 1 à 6 chiffres. */
export function parseCompte(s) {
  const v = String(s || '').trim();
  return /^\d{1,6}$/.test(v) ? v : null;
}

/**
 * Parse une date acceptée :
 *  - `ddMMyy` (6 chiffres, comme le classeur — ex. 010126 → 2026-01-01 ;
 *    yy ≤ 50 → 20yy, sinon 19yy) ;
 *  - `jj/mm/aaaa` (séparateurs / - .) ;
 *  - `aaaa-mm-jj` (ISO).
 * Retourne 'aaaa-mm-jj' ou null.
 */
export function parseDateCsv(s) {
  const v = String(s || '').trim();
  if (!v) return null;
  const iso = (y, m, d) => {
    const yi = Number(y), mi = Number(m), di = Number(d);
    if (!Number.isInteger(yi) || !Number.isInteger(mi) || !Number.isInteger(di)) return null;
    if (mi < 1 || mi > 12 || di < 1 || di > 31 || yi < 1900 || yi > 2100) return null;
    const p = (x) => String(x).padStart(2, '0');
    const out = yi + '-' + p(mi) + '-' + p(di);
    // Garde-fou : date réelle (rejette 31/02, 29/02 hors bissextile…).
    const chk = new Date(out + 'T00:00:00');
    if (chk.getFullYear() !== yi || chk.getMonth() + 1 !== mi || chk.getDate() !== di) return null;
    return out;
  };
  let m = v.match(/^(\d{2})(\d{2})(\d{2})$/); // ddMMyy
  if (m) {
    const yy = Number(m[3]);
    const full = yy <= 50 ? 2000 + yy : 1900 + yy;
    return iso(full, m[2], m[1]);
  }
  m = v.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/); // jj/mm/aaaa
  if (m) return iso(m[3], m[2], m[1]);
  m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/); // aaaa-mm-jj
  if (m) return iso(m[1], m[2], m[3]);
  return null;
}

/**
 * Parse un montant : espaces (y c. insécables) ignorés, virgule décimale
 * acceptée (« 1 234,56 » → 1234.56). Vide → 0. Retourne null si non numérique.
 */
export function parseMontant(s) {
  const v = String(s == null ? '' : s).replace(/[ \u00a0\u202f\u2009]/g, '').trim();
  if (v === '') return 0;
  const norm = v.replace(/,/g, '.');
  if (!/^-?\d+(\.\d+)?$/.test(norm)) return null;
  const n = Number(norm);
  return Number.isFinite(n) ? n : null;
}

/* ------------------------------------------------------------------ */
/* Parseur principal                                                    */
/* ------------------------------------------------------------------ */

/**
 * Parse un texte CSV d'écritures comptables.
 * @param {string} text - contenu du fichier.
 * @param {object} [options] - { idPrefix }.
 * @returns {{ ecritures: [...], erreurs: [{ ligne, message }], stats }}
 */
export function parseJournalCsv(text, options = {}) {
  const idPrefix = String(options.idPrefix || 'imp');
  const ecritures = [];
  const erreurs = [];
  const rawLines = String(text || '').split(/\r\n|\r|\n/);

  // Lignes non vides avec leur n° réel dans le fichier (1-based).
  const lines = [];
  rawLines.forEach((raw, i) => {
    if (raw.trim() !== '') lines.push({ no: i + 1, raw });
  });
  if (lines.length === 0) {
    return { ecritures, erreurs, stats: { lignesLues: 0, lignesValides: 0, ecrituresCreees: 0, lignesEnErreur: 0 } };
  }

  // Séparateur auto-détecté sur la première ligne.
  const first = lines[0].raw;
  const nSemi = (first.match(/;/g) || []).length;
  const nComma = (first.match(/,/g) || []).length;
  const sep = nSemi >= nComma && nSemi > 0 ? ';' : (nComma > 0 ? ',' : ';');

  // En-tête éventuel mappé par nom.
  let start = 0;
  let colMap = mapHeader(splitCsvLine(first, sep));
  if (colMap) start = 1;
  else colMap = { compte: 0, date: 1, journal: 2, piece: 3, libelle: 4, debit: 5, credit: 6 };
  const hasEcritureId = colMap.ecriture_id != null;

  const cell = (cells, key) => {
    const idx = colMap[key];
    return idx == null || idx >= cells.length ? '' : cells[idx];
  };

  // Lignes validées → regroupées.
  const groups = new Map(); // clé → { key, lignesNo: [], rows: [] }
  const order = [];
  for (let i = start; i < lines.length; i++) {
    const { no, raw } = lines[i];
    const cells = splitCsvLine(raw, sep);
    const compte = parseCompte(cell(cells, 'compte'));
    const date = parseDateCsv(cell(cells, 'date'));
    const journal = String(cell(cells, 'journal') || '').trim().toUpperCase() || 'OD';
    const piece = String(cell(cells, 'piece') || '').trim();
    const libelle = String(cell(cells, 'libelle') || '').trim();
    const debit = parseMontant(cell(cells, 'debit'));
    const credit = parseMontant(cell(cells, 'credit'));

    if (compte === null) {
      erreurs.push({ ligne: no, message: 'Compte invalide (« ' + cell(cells, 'compte') + ' » — 1 à 6 chiffres attendus).' });
      continue;
    }
    if (date === null) {
      erreurs.push({ ligne: no, message: 'Date invalide (« ' + cell(cells, 'date') + ' » — formats : ddMMyy, jj/mm/aaaa, aaaa-mm-jj).' });
      continue;
    }
    if (piece === '') {
      erreurs.push({ ligne: no, message: 'Pièce manquante (regroupement impossible).' });
      continue;
    }
    if (debit === null || credit === null) {
      erreurs.push({ ligne: no, message: 'Montant non numérique (débit « ' + cell(cells, 'debit') + ' », crédit « ' + cell(cells, 'credit') + ' »).' });
      continue;
    }
    if (debit === 0 && credit === 0) {
      erreurs.push({ ligne: no, message: 'Montants débit et crédit nuls (ligne sans mouvement).' });
      continue;
    }

    const key = hasEcritureId && String(cell(cells, 'ecriture_id') || '').trim() !== ''
      ? 'ID:' + String(cell(cells, 'ecriture_id')).trim()
      : piece + '|' + date;
    if (!groups.has(key)) { groups.set(key, { key, lignesNo: [], rows: [] }); order.push(key); }
    const g = groups.get(key);
    g.lignesNo.push(no);
    g.rows.push({ compte, date, journal, piece, libelle, debit, credit });
  }

  // Écritures : contrôle d'équilibre par groupe.
  let n = 0;
  for (const key of order) {
    const g = groups.get(key);
    const sumD = g.rows.reduce((t, r) => t + r.debit, 0);
    const sumC = g.rows.reduce((t, r) => t + r.credit, 0);
    if (Math.abs(sumD - sumC) >= TOLERANCE) {
      const fmt = (x) => x.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      erreurs.push({
        ligne: g.lignesNo[0],
        message: 'Écriture pièce « ' + g.rows[0].piece + ' » du ' + g.rows[0].date
          + ' déséquilibrée : débit ' + fmt(sumD) + ' ≠ crédit ' + fmt(sumC) + '.',
      });
      continue;
    }
    n += 1;
    ecritures.push({
      id: idPrefix + '-' + n,
      date: g.rows[0].date,
      journal: g.rows[0].journal,
      piece: g.rows[0].piece,
      libelle: (g.rows.find((r) => r.libelle) || {}).libelle || g.rows[0].piece,
      lignes: g.rows.map((r) => ({ compte: r.compte, debit: r.debit, credit: r.credit })),
    });
  }

  const lignesValides = Array.from(groups.values()).reduce((t, g) => t + g.lignesNo.length, 0);
  return {
    ecritures,
    erreurs,
    stats: {
      lignesLues: lines.length - start,
      lignesValides,
      ecrituresCreees: ecritures.length,
      lignesEnErreur: erreurs.length,
    },
  };
}
