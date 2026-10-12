/**
 * Lettrage des comptes de tiers — moteur pur (FiscalMind Africa).
 *
 * Logique portée de `renderLettrage` / `fmLettrerGroupe` / `fmDelettrerLettre` /
 * `fmNextLettre` (fiscalmind-app.html, ~lignes 5063-5186).
 *
 * Différence assumée avec le source : le source lettrait des lignes isolées
 * {d,j,p,c,lib,debit,credit,lettre}. Ici le modèle canonique est la pièce
 * {id, date, journal, piece, libelle, lignes:[{compte, debit, credit, lettre?}]} ;
 * le lettrage s'applique aux LIGNES (mouvements), repérées par
 * {entryId, lineIndex}. La lettre est conservée par `normalizedEntry`
 * (journal.js) et survit aux modifications d'écritures.
 *
 * Mouvement : { entryId, lineIndex, date, journal, piece, libelle,
 *               compte, debit, credit, lettre }
 */

/** Aplatit les écritures en mouvements (la lettre de chaque ligne est conservée). */
export function toMouvements(entries) {
  const out = [];
  for (const e of entries || []) {
    const lignes = (e && e.lignes) || [];
    lignes.forEach((l, i) => {
      out.push({
        entryId: e.id,
        lineIndex: i,
        date: String(e.date || ''),
        journal: String(e.journal || ''),
        piece: String(e.piece || ''),
        libelle: String(e.libelle || ''),
        compte: String((l || {}).compte || ''),
        debit: Math.round(Number((l || {}).debit) || 0),
        credit: Math.round(Number((l || {}).credit) || 0),
        lettre: String((l || {}).lettre || ''),
      });
    });
  }
  return out;
}

function byDate(a, b) {
  if (a.date < b.date) return -1;
  if (a.date > b.date) return 1;
  return 0;
}

/**
 * Regroupe les mouvements des comptes de tiers (classe 4) par compte,
 * triés par date — port de la boucle `byC` de renderLettrage.
 * Retourne { compte: [mouvements] }.
 */
export function groupByTiers(mouvements) {
  const byC = {};
  for (const m of mouvements || []) {
    if (!/^\d+$/.test(m.compte) || m.compte.charAt(0) !== '4') continue;
    (byC[m.compte] = byC[m.compte] || []).push(m);
  }
  for (const c of Object.keys(byC)) byC[c].sort(byDate);
  return byC;
}

/** Mouvements non lettrés d'un groupe. */
export function unlettered(mouvements) {
  return (mouvements || []).filter((m) => !m.lettre);
}

/** Lettres utilisées sur un compte, triées — port du calcul `lettres` de renderLettrage. */
export function usedLetters(accountMouvements) {
  return [...new Set((accountMouvements || []).filter((m) => m.lettre).map((m) => m.lettre))].sort();
}

/**
 * Prochaine lettre disponible sur un compte (A, B, … Z, AA, AB…) —
 * port fidèle de `fmNextLettre`.
 */
export function nextLetter(accountMouvements) {
  const nums = usedLetters(accountMouvements).map((L) => {
    let n = 0;
    for (const ch of String(L)) n = n * 26 + (ch.charCodeAt(0) - 64);
    return n;
  });
  let n = Math.max.apply(null, [0].concat(nums)) + 1;
  let out = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/**
 * Soldes des lignes NON lettrées d'un groupe — port du « Solde non lettré »
 * de renderLettrage.
 */
export function groupBalance(mouvements) {
  const nl = unlettered(mouvements);
  const debit = nl.reduce((a, m) => a + m.debit, 0);
  const credit = nl.reduce((a, m) => a + m.credit, 0);
  return { debit, credit, solde: debit - credit, count: nl.length };
}

/**
 * Soldes de TOUTES les lignes d'un groupe (lettrées ou non).
 */
export function groupTotals(mouvements) {
  const ms = mouvements || [];
  const debit = ms.reduce((a, m) => a + m.debit, 0);
  const credit = ms.reduce((a, m) => a + m.credit, 0);
  return { debit, credit, solde: debit - credit, count: ms.length };
}

/**
 * Valide une sélection à lettrer — port des contrôles de `fmLettrerGroupe`
 * (≥2 écritures, débits = crédits, montants non nuls), durci : même compte
 * et lignes non déjà lettrées (le source ne proposait que des lignes non
 * lettrées via ses cases à cocher).
 */
export function validateLettering(selection) {
  const errors = [];
  const sel = selection || [];
  if (sel.length < 2) errors.push('Sélectionnez au moins 2 écritures à lettrer.');
  const comptes = [...new Set(sel.map((m) => m.compte))];
  if (comptes.length > 1) errors.push('Les écritures lettrées doivent porter sur le même compte.');
  if (sel.some((m) => m.lettre)) errors.push('Certaines écritures sélectionnées sont déjà lettrées.');
  const td = sel.reduce((a, m) => a + m.debit, 0);
  const tc = sel.reduce((a, m) => a + m.credit, 0);
  if (td === 0 && tc === 0) {
    errors.push('Sélection vide : tous les montants sont à zéro.');
  } else if (td !== tc) {
    errors.push('Sélection déséquilibrée : le total débit doit égaler le total crédit.');
  }
  return { ok: errors.length === 0, errors, totalDebit: td, totalCredit: tc };
}

/**
 * Applique une lettre aux lignes référencées (immuable : nouvelles écritures).
 * `refs` : [{ entryId, lineIndex }].
 */
export function letterEntries(entries, refs, lettre) {
  const keys = new Set((refs || []).map((r) => r.entryId + '|' + r.lineIndex));
  return (entries || []).map((e) => ({
    ...e,
    lignes: (e.lignes || []).map((l, i) =>
      keys.has(e.id + '|' + i) ? { ...l, lettre: String(lettre) } : l
    ),
  }));
}

/**
 * Retire une lettre sur un compte (immuable) — port de `fmDelettrerLettre`.
 * Retourne { entries, count }.
 */
export function unletterEntries(entries, compte, lettre) {
  let count = 0;
  const next = (entries || []).map((e) => ({
    ...e,
    lignes: (e.lignes || []).map((l) => {
      if (String(l.compte) === String(compte) && String(l.lettre || '') === String(lettre)) {
        count++;
        const { lettre: _dropped, ...rest } = l;
        return rest;
      }
      return l;
    }),
  }));
  return { entries: next, count };
}

/** Lettre d'un mouvement ('' si non lettré). */
export function letterOf(mouvement) {
  return String((mouvement || {}).lettre || '');
}

/**
 * Lettrage automatique : pour chaque compte, associe les débits et crédits
 * non lettrés de même montant. Retourne { entries, matched }.
 */
export function autoLetterEntries(entries) {
  const mouvements = toMouvements(entries || []);
  const byAccount = groupByTiers(mouvements);
  let lettreCode = 65; // 'A'
  const used = new Set();
  // Collecter les lettres déjà utilisées
  Object.values(byAccount).flat().forEach((m) => {
    if (m.lettre) used.add(m.lettre);
  });
  const getNextLetter = () => {
    while (used.has(String.fromCharCode(lettreCode))) lettreCode++;
    const l = String.fromCharCode(lettreCode);
    used.add(l);
    lettreCode++;
    return l;
  };

  const toLetter = []; // { ref, compte, lettre }
  let matched = 0;

  Object.entries(byAccount).forEach(([compte, mouvs]) => {
    const free = mouvs.filter((m) => !m.lettre);
    const debits = free.filter((m) => (m.debit || 0) > 0).sort((a, b) => (a.debit || 0) - (b.debit || 0));
    const credits = free.filter((m) => (m.credit || 0) > 0).sort((a, b) => (a.credit || 0) - (b.credit || 0));
    const usedDebit = new Set();
    const usedCredit = new Set();

    credits.forEach((c) => {
      const ci = credits.indexOf(c);
      if (usedCredit.has(ci)) return;
      // Chercher un débit du même montant
      const di = debits.findIndex((d, idx) =>
        !usedDebit.has(idx) && Math.abs((d.debit || 0) - (c.credit || 0)) < 0.005
      );
      if (di >= 0) {
        const lettre = getNextLetter();
        toLetter.push({ ref: debits[di].ref, compte, lettre });
        toLetter.push({ ref: c.ref, compte, lettre });
        usedDebit.add(di);
        usedCredit.add(ci);
        matched += 2;
      }
    });
  });

  // Appliquer les lettres
  let result = entries || [];
  const byRefCompte = {};
  toLetter.forEach((t) => {
    const key = t.ref + '|' + t.compte;
    byRefCompte[key] = t.lettre;
  });
  result = result.map((e) => ({
    ...e,
    lignes: (e.lignes || []).map((l) => {
      const key = (e.id || e.ref) + '|' + String(l.compte);
      // Chercher par ref d'écriture
      const mKey = Object.keys(byRefCompte).find((k) => k.startsWith((e.id || e.ref) + '|') && k.endsWith('|' + String(l.compte)));
      if (mKey && !l.lettre) {
        return { ...l, lettre: byRefCompte[mKey] };
      }
      return l;
    }),
  }));

  return { entries: result, matched };
}
