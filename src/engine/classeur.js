/**
 * FiscalMind Africa — Classeur Intelligent : extraction + proposition d'écritures (pur).
 *
 * Port de la logique de fiscalmind-app.html (fmCleanAmount, fmClasseurExtract,
 * fmClasseurPropose, fmImpotsAccount/fmImpotsLabel, fmExtractImpotsDetails).
 * 100 % pur : aucune dépendance DOM/réseau. Sortie : écritures au format
 * canonique du moteur ({ id, date, journal, piece, libelle, lignes[] }),
 * prêtes pour validateEntry(). Les comptes utilisés existent dans le plan
 * SYSCOHADA révisé (vérifié : 601, 4452, 401, 411, 701, 443, 447, 441, 646,
 * 641, 521, 571 — non renumérotés par la révision).
 */

/** « 1 234 567 » / « 1\u00a0234 » -> 1234567 (arrondi). */
export function cleanAmount(s) {
  return Math.round(Number(String(s == null ? '' : s).replace(/[\s\u00a0]/g, '')) || 0);
}

/**
 * Détecte le type et le sens d'un document à partir de son texte OCR.
 * @returns {'facture'|'impots'|'releve'|'quittance'}
 */
export function detectDocType(text) {
  const low = String(text || '').toLowerCase();
  if (/bordereau de paiement|direction g[eé]n[eé]rale des imp[oô]ts|\bdgi\b/.test(low)) return 'impots';
  if (/relev[ée]/.test(low)) return 'releve';
  if (/re[çc]u|quittance/.test(low)) return 'quittance';
  return 'facture';
}

/** 'facture' + mention client (sans fournisseur) -> vente, sinon achat. */
export function detectSens(text) {
  const low = String(text || '').toLowerCase();
  if (/facture/.test(low) && /client/.test(low) && !/fournisseur/.test(low)) return 'vente';
  return 'achat';
}

/**
 * Détecte un avoir (note de crédit) : c'est une CONTREPASSATION de la facture
 * d'origine — les écritures proposées doivent être inversées.
 */
export function detectAvoir(text) {
  const low = String(text || '').toLowerCase();
  return /\bavoir\b|note de cr[eé]dit|facture d'avoir|avoir n[°o]|facture rectificative/.test(low);
}

/** Première date JJ/MM/AAAA (ou JJ-MM-AA) trouvée -> AAAA-MM-JJ, sinon date du jour. */
export function extractDocDate(text, fallback) {
  const fb = fallback || new Date().toISOString().slice(0, 10);
  const dm = String(text || '').match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (!dm) return fb;
  let y = dm[3];
  if (y.length === 2) y = '20' + y;
  const iso = y + '-' + dm[2].padStart(2, '0') + '-' + dm[1].padStart(2, '0');
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : fb;
}

/**
 * Montant total : priorité au « Total TTC » / « Net à payer » (un document
 * liste souvent « Total HT » avant le TTC — l'ancien prenait le premier
 * « total » trouvé, ce qui donnait le HT), puis « FCFA n », puis max.
 */
export function extractTotal(text) {
  const t = String(text || '');
  const patterns = [
    /(?:total\s*ttc|montant\s*ttc)(?:[^\d]|\n){0,30}([\d][\d ]*)/i,
    /(?:net\s*[aà]\s*payer|montant\s*[aà]\s*payer|montant\s*paye)(?:[^\d]|\n){0,30}([\d][\d ]*)/i,
    /(?:total)(?:[^\d]|\n){0,30}([\d][\d ]*)/i,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m) {
      const v = cleanAmount(m[1]);
      if (v > 0) return v;
    }
  }
  let m = t.match(/(?:f\s?cfa|fcfa|xof)[^\d\n]{0,10}([\d][\d ]*)/i);
  if (m) return cleanAmount(m[1]);
  const amounts = [];
  const re = /([\d][\d ]*)\s*(?:f\s?cfa|fcfa|xof)/gi;
  let x;
  while ((x = re.exec(t))) { const v = cleanAmount(x[1]); if (v > 0) amounts.push(v); }
  return amounts.length ? Math.max.apply(null, amounts) : 0;
}

/** Montant de TVA détecté (montant ou « TVA … % : montant »). */
export function extractTva(text) {
  let m = String(text || '').match(/tva[^\n]*?([\d][\d\s]*)\s*(?:f\s?cfa|fcfa|xof)/i);
  if (m) return cleanAmount(m[1]);
  m = String(text || '').match(/tva[^\n]*?%\s*:?\s*([\d][\d\s]*)/i);
  return m ? cleanAmount(m[1]) : 0;
}

/** Nom du tiers : première ligne en MAJUSCULES parmi les 6 premières (hors bordereaux DGI). */
export function extractTiers(text, type) {
  if (type === 'impots') return 'DGI';
  const lines = String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);
  for (const l of lines.slice(0, 6)) {
    const up = l.replace(/[^A-Za-zÀ-ÿ ]/g, '').trim();
    if (up.length >= 4 && up === up.toUpperCase() && /[A-ZÀ-Þ]{3,}/.test(up)) {
      return up.slice(0, 42);
    }
  }
  return 'Tiers';
}

/** Compte d'impôt suggéré depuis le nom de la taxe (port de fmImpotsAccount). */
export function impotsAccount(name) {
  const low = String(name || '').toLowerCase();
  if (/acompte provisionn/.test(low)) return '441';
  if (/timbre/.test(low)) return '646';
  if (/apprentissage/.test(low)) return '641';
  if (/valeur ajout/.test(low)) return '443';
  return '447';
}

/** Libellé lisible depuis le nom de la taxe (port de fmImpotsLabel). */
export function impotsLabel(name, salaryTaxShort) {
  const low = String(name || '').toLowerCase();
  if (/acompte provisionn/.test(low)) return 'Acompte provisionnel IS';
  if (/timbre/.test(low)) return 'Droits de timbres';
  if (/traitements et sala/.test(low)) return salaryTaxShort || 'IUTS';
  if (/pr[eé]l[eè]vements/.test(low)) return "Prélèvements à titre d'acompte";
  if (/retenue obligatoire/.test(low)) return 'Retenue sur salaires';
  if (/apprentissage/.test(low)) return "Taxe patronale d'apprentissage";
  if (/valeur ajout/.test(low)) return 'TVA due';
  return String(name || '').replace(/\.{3,}$/, '');
}

/**
 * Détails d'un bordereau DGI : [{ label, amount, account }]
 * (port de fmExtractImpotsDetails : noms entre « liste des montants » et
 * « montant total déclaré », montants après).
 */
export function extractImpotsDetails(text, salaryTaxShort) {
  const lines = String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const start = lines.findIndex((l) => /liste des montants/i.test(l));
  const amtIdx = lines.findIndex((l) => /montant total d[ée]clar[ée]/i.test(l));
  if (start < 0 || amtIdx < 0) return [];
  const skipRe = /^(imp[oô]t|p[ée]riode|date limite|n[°o])$/i;
  const periodRe = /^([a-zéû]+\s+)?\d{4}$/i;
  const names = [];
  for (let i = start + 1; i < amtIdx; i++) {
    const l = lines[i];
    if (skipRe.test(l) || periodRe.test(l) || /^\d{2}\/\d{2}\/\d{4}$/.test(l) || /^\d{1,2}$/.test(l)) continue;
    names.push(l);
  }
  const amounts = [];
  for (let i = amtIdx + 1; i < lines.length; i++) {
    const l = lines[i];
    if (/montant paye/i.test(l) || /^total/i.test(l)) break;
    const v = cleanAmount(l);
    if (v > 0) amounts.push(v);
  }
  const n = Math.min(names.length, amounts.length);
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({
      label: impotsLabel(names[i], salaryTaxShort),
      amount: amounts[i],
      account: impotsAccount(names[i]),
    });
  }
  return out;
}

/**
 * Extraction complète d'un document.
 * @returns {{ type, sens, date, tiers, total, tva, details, fileName }}
 */
export function extractInvoiceData(text, fileName, salaryTaxShort) {
  const type = detectDocType(text);
  const sens = detectSens(text);
  return {
    type,
    sens,
    avoir: detectAvoir(text),
    date: extractDocDate(text),
    tiers: extractTiers(text, type),
    total: extractTotal(text),
    tva: extractTva(text),
    details: type === 'impots' ? extractImpotsDetails(text, salaryTaxShort) : [],
    fileName: fileName || '',
  };
}

function pieceOf(fileName) {
  return String(fileName || '').replace(/\.[^.]+$/, '').slice(0, 24);
}

function mkEntry({ id, date, journal, piece, libelle, lignes }) {
  return { id, date, journal, piece, libelle, lignes };
}

let _seq = 0;
function nid(prefix) {
  _seq += 1;
  return (prefix || 'cl') + Date.now().toString(36) + '-' + _seq;
}

/**
 * Propose les écritures canoniques depuis une extraction.
 * @param {object} ext - résultat de extractInvoiceData()
 * @param {object} [opts] - { reglement: '' | 'ES' | 'BQ', salaryTaxShort }
 * @returns {Array} écritures canoniques (prêtes pour validateEntry).
 */
export function proposeEntries(ext, opts) {
  const o = opts || {};
  const total = Math.round(Number(ext.total) || 0);
  const tva = Math.round(Number(ext.tva) || 0);
  const out = [];
  if (!ext || total <= 0) return out;
  const piece = pieceOf(ext.fileName);
  const date = ext.date;

  // --- Bordereau DGI ---
  if (ext.type === 'impots') {
    const dets = (ext.details || []).filter((x) => x.amount > 0);
    const sumD = dets.reduce((a, x) => a + x.amount, 0);
    const lignes = [];
    if (dets.length >= 2 && sumD === total) {
      dets.forEach((dt) => lignes.push({
        compte: dt.account, libelle: dt.label + ' — Bordereau DGI',
        debit: dt.amount, credit: 0,
      }));
    } else {
      lignes.push({
        compte: '447', libelle: 'Paiement impôts et taxes — Bordereau DGI',
        debit: total, credit: 0,
      });
    }
    lignes.push({
      compte: '521', libelle: 'Paiement DGI au guichet',
      debit: 0, credit: total,
    });
    out.push(mkEntry({
      id: nid('cl'), date, journal: 'BQ', piece,
      libelle: 'Paiement impôts — Bordereau DGI',
      lignes,
    }));
    return out;
  }

  // --- Facture achat / vente (un avoir = CONTREPASSATION : écritures inversées) ---
  const avoir = !!ext.avoir;
  const base = (avoir ? 'Avoir — ' : '') + (ext.sens === 'achat' ? 'Achat — ' : 'Vente — ') + ext.tiers;
  const j = ext.sens === 'achat' ? 'AC' : 'VT';
  const lignes = [];
  // Sens comptable : pour un avoir, on inverse débit/crédit par rapport à la facture.
  const D = (compte, libelle, montant) => lignes.push(avoir
    ? { compte, libelle, debit: 0, credit: montant }
    : { compte, libelle, debit: montant, credit: 0 });
  const C = (compte, libelle, montant) => lignes.push(avoir
    ? { compte, libelle, debit: montant, credit: 0 }
    : { compte, libelle, debit: 0, credit: montant });
  if (tva > 0 && total > tva) {
    const ht = total - tva;
    if (ext.sens === 'achat') {
      D('601', base, ht);
      D('4452', 'TVA récupérable — ' + ext.tiers, tva);
      C('401', 'Facture ' + ext.tiers, total);
    } else {
      D('411', 'Facture ' + ext.tiers, total);
      C('701', base, ht);
      C('443', 'TVA facturée — ' + ext.tiers, tva);
    }
  } else if (ext.sens === 'achat') {
    D('601', base, total);
    C('401', 'Facture ' + ext.tiers, total);
  } else {
    D('411', 'Facture ' + ext.tiers, total);
    C('701', base, total);
  }
  out.push(mkEntry({
    id: nid('cl'), date, journal: j, piece,
    libelle: base + ' (' + piece + ')',
    lignes,
  }));

  // --- Règlement éventuel (2e écriture, journal ES/BQ) ---
  // Pour un avoir, le « règlement » est un REMBOURSEMENT : sens inversé.
  const reg = o.reglement;
  if (reg === 'ES' || reg === 'BQ') {
    const cp = reg === 'ES' ? '571' : '521';
    const rlignes = [];
    const RD = (compte, libelle, montant) => rlignes.push(avoir
      ? { compte, libelle, debit: 0, credit: montant }
      : { compte, libelle, debit: montant, credit: 0 });
    const RC = (compte, libelle, montant) => rlignes.push(avoir
      ? { compte, libelle, debit: montant, credit: 0 }
      : { compte, libelle, debit: 0, credit: montant });
    const regLib = avoir ? 'Remboursement avoir ' : 'Règlement facture ';
    if (ext.sens === 'achat') {
      RD('401', regLib + ext.tiers, total);
      RC(cp, (reg === 'ES' ? (avoir ? 'Remboursement espèces' : 'Paiement en espèces') : (avoir ? 'Remboursement par banque' : 'Paiement par banque')) + ' — ' + ext.tiers, total);
    } else {
      RD(cp, (reg === 'ES' ? (avoir ? 'Remboursement espèces' : 'Encaissement espèces') : (avoir ? 'Remboursement banque' : 'Encaissement banque')) + ' — ' + ext.tiers, total);
      RC('411', regLib + ext.tiers, total);
    }
    out.push(mkEntry({
      id: nid('cl'), date, journal: reg, piece,
      libelle: 'Règlement ' + ext.tiers + ' (' + piece + ')',
      lignes: rlignes,
    }));
  }
  return out;
}

/**
 * Convertit une écriture proposée (lignes avec libellé d'aide à la révision)
 * en écriture canonique du moteur ({ compte, debit, credit } par ligne),
 * prête pour validateEntry() puis saveEntry().
 */
export function toCanonical(entry) {
  return {
    id: entry.id,
    date: entry.date,
    journal: entry.journal,
    piece: entry.piece,
    libelle: entry.libelle,
    lignes: (entry.lignes || []).map((l) => ({
      compte: String(l.compte || ''),
      debit: Math.round(Number(l.debit) || 0),
      credit: Math.round(Number(l.credit) || 0),
    })),
  };
}

/** Vrai si un tiers est déjà connu (comparaison insensible à la casse). */
export function isKnownTiers(tiersConnus, nom) {
  const n = String(nom || '').toLowerCase().trim();
  return (tiersConnus || []).some((t) => String(t).toLowerCase().trim() === n);
}

/**
 * Prochain sous-compte disponible : 401001, 401002… / 411001…
 * (port de fmCreateTiers, durci : repart du plus grand sous-compte existant
 * pour éviter toute collision après suppression d'un tiers).
 */
export function nextSubAccount(tiersExistants, type) {
  const base = type === 'C' ? '411' : '401';
  let max = 0;
  (tiersExistants || []).forEach((t) => {
    const c = String((t && t.compte) || '');
    if (c.startsWith(base) && /^\d+$/.test(c)) {
      const n = parseInt(c.slice(base.length), 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
  });
  const countBased = (tiersExistants || []).filter((t) => t && t.type === type).length + 1;
  return base + String(Math.max(max + 1, countBased)).padStart(3, '0');
}

/**
 * Compte à utiliser pour un tiers : sous-compte existant si connu, sinon
 * prochain sous-compte à créer (port de fmCreateTiers / fmClasseurPost).
 * @returns {{ compte: string, isNew: boolean }}
 */
export function tiersAccountFor(tiersConnus, nom, type) {
  const n = String(nom || '').toLowerCase().trim();
  const found = (tiersConnus || []).find((t) => String(t.nom || '').toLowerCase().trim() === n);
  if (found && found.compte) return { compte: String(found.compte), isNew: false };
  return { compte: nextSubAccount(tiersConnus, type), isNew: true };
}
