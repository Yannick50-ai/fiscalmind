// FiscalMind Africa — page Classeur Intelligent (#/classeur).
//
// Import de justificatif -> extraction (type, sens, date, tiers, total,
// TVA 18 %) -> lignes d'écriture modifiables -> « Passer les écritures »
// (contrôle d'équilibre via validateEntry, écritures vers fm_entries).
// Archivage du justificatif sur R2 via l'Edge Function `r2-storage`
// (quota 1 Go / utilisateur, 50 Mo / fichier, jamais de clé côté client).
//
// OCR : l'Edge Function `ocr` n'est PAS encore déployée -> état gracieux
// « activation en cours » : l'utilisateur colle le texte du document
// (ou remplit les champs à la main). AUCUNE clé OCR en dur, AUCUN appel
// direct à un service OCR tiers depuis le navigateur.

import { esc, $, toast } from '../ui.js';
import { saveEntry, saveTiers, loadTiers, CloudError } from '../store.js';
import { supabaseService, getAccessToken } from '../auth.js';
import { validateEntry } from '../../../src/engine/journal.js';
import { ACCOUNTS, getAccount } from '../../../src/engine/chart-of-accounts.js';
import {
  extractInvoiceData, proposeEntries, toCanonical, isKnownTiers,
  tiersAccountFor,
} from '../../../src/engine/classeur.js';
import { createOcrService } from '../../../src/services/ocr.js';
import {
  createR2Service, detectMime, checkFileSize, checkMime, quotaStatus,
  R2_QUOTA_BYTES,
} from '../../../src/services/r2.js';

const S = {
  step: 'import', // import | review | entries
  file: null, // { name, type, size, dataUrl }
  demoName: '', // nom du document de démo chargé (sans fichier réel)
  ext: null, // extraction éditable
  entries: [], // écritures proposées (lignes éditables)
  tiers: [], // registre [{ nom, type: 'F'|'C', compte }]
  docs: [], docsError: null,
  r2: null,
  ocrBusy: false,
  recentEntries: [], // dernières écritures passées (consultation/modification/suppression)
};

/* ------------------------------------------------------------------ */
/* Factures de démo (textes OCR pré-remplis, flux complet testable)     */
/* ------------------------------------------------------------------ */

const DEMOS = {
  achat: {
    label: "Facture d'achat (TVA 18 %)",
    name: 'demo-facture-achat.pdf',
    text: [
      'ETS YANNICK COMMERCE',
      'Facture N° F-2026-128 du 06/10/2026',
      'Fournitures de bureau',
      'Total HT : 1 000 000 F CFA',
      'TVA 18 % : 180 000 F CFA',
      'Total TTC : 1 180 000 F CFA',
      'Net à payer : 1 180 000 F CFA',
    ].join('\n'),
  },
  vente: {
    label: 'Facture de vente',
    name: 'demo-facture-vente.pdf',
    text: [
      'BOUTIQUE MODERNE',
      'Facture de vente N° V-2026-045 du 07/10/2026',
      'Client : BOUTIQUE MODERNE',
      'Marchandises diverses',
      'Total HT : 500 000 F CFA',
      'TVA 18 % : 90 000 F CFA',
      'Total TTC : 590 000 F CFA',
    ].join('\n'),
  },
  dgi: {
    label: 'Bordereau DGI',
    name: 'demo-bordereau-dgi.pdf',
    text: [
      'BORDEREAU DE PAIEMENT',
      'Direction Générale des Impôts',
      'Total : 525 000 F CFA',
      'Liste des montants',
      'Impôt',
      'Acompte provisionnel IS',
      'Droits de timbres',
      'Montant total déclaré',
      '500000',
      '25000',
      'Montant payé : 525000',
    ].join('\n'),
  },
};

function shell() { return document.getElementById('appMain'); }

function errMsg(e) {
  return e instanceof CloudError ? e.message : String((e && e.message) || e || 'Erreur inattendue.');
}

function errorHtml(msg) {
  return '<div class="error-state" data-testid="classeur-error">'
    + '<div class="error-icon">⚠️</div><p>' + esc(msg) + '</p>'
    + '<button class="btn btn-primary" data-testid="classeur-retry" id="classeurRetry">Réessayer</button></div>';
}

function fmtBytes(n) {
  if (!n) return '0 o';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + ' Go';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + ' Mo';
  return Math.round(n / 1e3) + ' ko';
}

/* ---------------- R2 ---------------- */

async function initR2() {
  if (S.r2) return S.r2;
  const svc = supabaseService();
  if (!svc) throw new CloudError('Connexion au serveur non configurée.', 'CONFIG');
  const token = await getAccessToken();
  if (!token) throw new CloudError('Session expirée. Reconnectez-vous.', 'AUTH');
  S.r2 = createR2Service({
    edgeCall: (action, payload) => svc.r2Call({ accessToken: token, action, payload }),
  });
  return S.r2;
}

async function refreshDocs() {
  try {
    // Liste des fichiers via les écritures récentes qui ont un r2Key (12/10/2026)
    // La table fm_uploads ne stocke pas la clé R2 — on utilise les écritures liées
    const seen = new Map();
    for (const e of (S.recentEntries || [])) {
      if (e.r2Key && !seen.has(e.r2Key)) {
        seen.set(e.r2Key, {
          key: e.r2Key,
          name: e.doc || 'document',
          size_bytes: 0,
          size: 0,
        });
      }
    }
    S.docs = Array.from(seen.values());
    S.docsError = null;
  } catch (e) {
    S.docsError = errMsg(e);
    S.docs = [];
  }
}

function docsHtml() {
  const q = quotaStatus(S.docs.map((d) => ({ size: d.size_bytes || d.size })));
  let h = '<div class="card" style="margin-bottom:12px;"><div class="card-body">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">'
    + '<strong>📁 Justificatifs archivés (' + S.docs.length + ')</strong>'
    + '<span class="muted-sm">' + fmtBytes(q.used) + ' / ' + fmtBytes(q.quota) + '</span></div>'
    + '<div style="background:var(--bg-light);border-radius:8px;height:8px;">'
    + '<div style="background:var(--primary);height:8px;border-radius:8px;width:' + Math.round(q.percent) + '%;"></div></div>';
  if (S.docsError) {
    h += '<p class="muted-sm">Documents indisponibles : ' + esc(S.docsError) + '</p>';
  } else if (!S.docs.length) {
    h += '<p class="muted-sm">Aucun justificatif archivé pour le moment.</p>';
  } else {
    h += '<div style="margin-top:8px;display:flex;flex-direction:column;gap:6px;">' + S.docs.slice(0, 20).map((d, i) =>
      '<div style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--bg-light);border-radius:8px;">'
      + '<span style="font-size:18px;">📄</span>'
      + '<div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(d.name || d.key || 'document') + '</div>'
      + '<div class="muted-sm">' + fmtBytes(d.size_bytes || d.size) + '</div></div>'
      + '<button class="btn btn-secondary btn-sm" data-doc-view="' + i + '" style="white-space:nowrap;">👁️ Voir</button>'
      + '</div>'
    ).join('') + (S.docs.length > 20 ? '<div class="muted-sm">… et ' + (S.docs.length - 20) + ' autres</div>' : '') + '</div>';
  }
  return h + '</div></div>';
}

/* ---------------- Rendu ---------------- */

function render() {
  let h = '<div data-testid="classeur-page">'
    + '<div class="page-head"><h2 class="page-title">📂 Classeur Intelligent</h2>'
    + '<p class="page-sub">Factures -> écritures, justificatifs archivés (1 Go)</p></div>';

  h += templatesHtml();

  if (S.step === 'import') h += importHtml();
  else if (S.step === 'review') h += reviewHtml();
  else h += entriesHtml();

  h += recentEntriesHtml();

  h += '</div>';
  shell().innerHTML = h;
  bind();
  loadTemplates();
}

/** Modèles d'écritures récurrentes (13/10/2026). */
function templatesHtml() {
  const tpls = S.templates || [];
  if (!tpls.length) return '';
  let h = '<div class="card" style="margin-bottom:12px;"><div class="card-body">'
    + '<h3 class="card-title" style="margin-bottom:8px;">📋 Modèles d\'écritures</h3>'
    + '<div style="display:flex;gap:6px;flex-wrap:wrap;">';
  tpls.forEach((t, i) => {
    h += '<div style="display:flex;gap:4px;align-items:stretch;">'
      + '<button class="btn btn-secondary" data-tpl-apply="' + i + '" style="font-size:12px;padding:6px 10px;flex:1;">'
      + '📋 ' + esc(t.nom) + '</button>'
      + '<button class="btn btn-secondary" data-tpl-del="' + i + '" title="Supprimer ce modèle" style="font-size:12px;padding:6px 8px;color:#dc2626;">🗑️</button>'
      + '</div>';
  });
  return h + '</div></div></div>';
}

async function loadTemplates() {
  try {
    const { getSetting } = await import('../store.js');
    const raw = await getSetting('modeles_ecritures');
    S.templates = raw ? JSON.parse(raw) : [];
    // Re-rendre juste la section modèles si elle a changé
    const btn = shell().querySelector('[data-tpl-apply]');
    if ((S.templates || []).length && !btn) render();
    // Binder les boutons appliquer
    shell().querySelectorAll('[data-tpl-apply]').forEach((b) => {
      if (!b.dataset.bound) {
        b.dataset.bound = '1';
        b.addEventListener('click', () => applyTemplate(Number(b.dataset.tplApply)));
      }
    });
    // Binder les boutons supprimer (13/10/2026)
    shell().querySelectorAll('[data-tpl-del]').forEach((b) => {
      if (!b.dataset.boundDel) {
        b.dataset.boundDel = '1';
        b.addEventListener('click', async () => {
          const idx = Number(b.dataset.tplDel);
          const { confirmDialog } = await import('../ui.js');
          const ok = await confirmDialog('Supprimer ce modèle ?',
            (S.templates[idx] || {}).nom || '', { okLabel: 'Supprimer', danger: true });
          if (!ok) return;
          S.templates.splice(idx, 1);
          const { setSetting } = await import('../store.js');
          await setSetting('modeles_ecritures', JSON.stringify(S.templates));
          render();
          toast('Modèle supprimé.', 'success');
        });
      }
    });
  } catch (e) { S.templates = []; }
}

/** Appliquer un modèle : charge ses lignes dans l'éditeur. */
function applyTemplate(idx) {
  const t = (S.templates || [])[idx];
  if (!t) return;
  S.entries = [{
    id: 'cl' + Date.now().toString(36),
    date: new Date().toISOString().slice(0, 10),
    journal: t.journal || 'OD',
    piece: '',
    libelle: t.nom.replace(/\s*\([^)]*\)\s*$/, ''),
    lignes: (t.lignes || []).map((l) => ({ ...l })),
  }];
  S.step = 'entries';
  S.editingRecent = false;
  render();
  toast('Modèle "' + t.nom + '" appliqué.', 'info');
}

/** Dernières écritures passées : consultation, modification, suppression (12/10/2026). */
function recentEntriesHtml() {
  if (!S.recentEntries.length) return '';
  let h = '<div class="card" style="margin-top:12px;"><div class="card-body">'
    + '<h3 class="card-title" style="margin-bottom:8px;">📝 Dernières écritures passées</h3>';
  S.recentEntries.forEach((e, i) => {
    const total = (e.lignes || []).reduce((a, l) => a + (l.debit || 0), 0);
    // Badge statut (13/10/2026) : brouillon → validé
    const statut = e.statut || 'brouillon';
    const badge = statut === 'valide'
      ? '<span style="font-size:10px;background:#dcfce7;color:#166534;padding:2px 8px;border-radius:10px;font-weight:600;">🟢 Validée</span>'
      : '<span style="font-size:10px;background:#fef9c3;color:#854d0e;padding:2px 8px;border-radius:10px;font-weight:600;">🟡 Brouillon</span>';
    // Lien visuel de contre-passation (13/10/2026) — même couleur pour les deux, bien visible
    const LINK_COLOR = '#d97706'; // ambre/orangé — même couleur pour l'originale et l'extourne
    let lienHtml = '';
    if (e.extourneDe) {
      // Utiliser le n° stocké directement, sinon recherche (13/10/2026)
      const origPiece = e.extournePiece || (() => {
        const orig = S.recentEntries.find((x) => x.id === e.extourneDe);
        return orig ? orig.piece : '?';
      })();
      const origJournal = e.extourneJournal || (() => {
        const orig = S.recentEntries.find((x) => x.id === e.extourneDe);
        return orig ? orig.journal : '';
      })();
      lienHtml = '<div style="font-size:12px;color:' + LINK_COLOR + ';margin-top:6px;font-weight:700;background:#fef3c7;border-radius:8px;padding:6px 8px;">🔗 Extourne de la pièce ' + esc(origJournal ? origJournal + ' ' : '') + 'n° ' + esc(origPiece) + '</div>';
    } else if (e.contrePasseePar) {
      const revPiece = e.contrePasseePiece || (() => {
        const rev = S.recentEntries.find((x) => x.id === e.contrePasseePar);
        return rev ? rev.piece : '?';
      })();
      const revJournal = e.contrePasseeJournal || (() => {
        const rev = S.recentEntries.find((x) => x.id === e.contrePasseePar);
        return rev ? rev.journal : '';
      })();
      lienHtml = '<div style="font-size:12px;color:' + LINK_COLOR + ';margin-top:6px;font-weight:700;background:#fef3c7;border-radius:8px;padding:6px 8px;">🔗 Contre-passée par la pièce ' + esc(revJournal ? revJournal + ' ' : '') + 'n° ' + esc(revPiece) + '</div>';
    }
    // Bordure de même couleur si liée — les deux écritures partagent la même identité visuelle
    const isLinked = e.extourneDe || e.contrePasseePar;
    const borderColor = isLinked ? LINK_COLOR : 'var(--border)';
    h += '<div style="border:2px solid ' + borderColor + ';border-radius:10px;padding:8px;margin-bottom:8px;' + (isLinked ? 'background:#fffbeb;' : '') + '">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;">'
      + '<strong style="font-size:13px;">' + esc(e.journal || '') + ' · ' + esc(e.libelle || '') + '</strong>'
      + '<span class="muted-sm">' + esc(e.date || '') + '</span></div>'
      + '<div class="muted-sm">' + (e.lignes || []).length + ' lignes · ' + total.toLocaleString('fr-FR') + ' F'
      + (e.doc ? ' · 📎 ' + esc(e.doc) : '') + ' · ' + badge + '</div>'
      + lienHtml
      + '<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;">'
      + '<button class="btn btn-secondary" data-cl-edit="' + i + '" style="flex:1;font-size:12px;padding:6px;min-width:70px;">✏️ Modifier</button>'
      + (statut === 'brouillon'
        ? '<button class="btn btn-secondary" data-cl-validate="' + i + '" style="flex:1;font-size:12px;padding:6px;min-width:70px;color:#166534;font-weight:600;">✅ Valider</button>'
        : '')
      // Délettrer si l'écriture a des lignes lettrées (13/10/2026)
      + ((e.lignes || []).some((l) => l.lettre)
        ? '<button class="btn btn-secondary" data-cl-unletter="' + i + '" style="flex:1;font-size:12px;padding:6px;min-width:70px;">🔓 Délettrer</button>'
        : '')
      + (e.r2Key ? '<button class="btn btn-secondary" data-cl-view="' + i + '" style="flex:1;font-size:12px;padding:6px;min-width:70px;">👁️ Voir</button>' : '')
      + '<button class="btn btn-secondary" data-cl-pdf="' + i + '" style="flex:1;font-size:12px;padding:6px;min-width:70px;">🖨️ PDF</button>'
      + '<button class="btn btn-secondary" data-cl-rev="' + i + '" style="flex:1;font-size:12px;padding:6px;min-width:70px;">↩️ Extourner</button>'
      + '<button class="btn btn-secondary" data-cl-tpl="' + i + '" style="flex:1;font-size:12px;padding:6px;min-width:70px;">💾 Modèle</button>'
      + '<button class="btn btn-secondary" data-cl-del="' + i + '" style="flex:1;font-size:12px;padding:6px;min-width:70px;color:#dc2626;">🗑️ Supprimer</button>'
      + '</div></div>';
  });
  return h + '</div></div>';
}

function importHtml() {
  return '<div class="card"><div class="card-body">'
    + '<h3 class="card-title" style="margin-bottom:8px;">Importer un document</h3>'
    + '<div class="notice-box">🤖 <strong>Lecture automatique (OCR) :</strong> choisissez votre fichier, cochez l’autorisation, puis lancez la lecture.'
    + ' Le texte détecté remplit automatiquement le champ ci-dessous. En cas d’échec, collez le texte manuellement.</div>'
    // Zone d'upload style drag & drop (12/10/2026)
    + '<div id="clDropZone" style="border:2px dashed var(--primary);border-radius:12px;padding:28px 16px;text-align:center;margin:12px 0;background:color-mix(in srgb, var(--primary) 6%, transparent);cursor:pointer;">'
    + '<div style="font-size:36px;margin-bottom:8px;">☁️</div>'
    + '<div style="font-weight:600;font-size:14px;margin-bottom:4px;">Glissez-déposez votre fichier ici</div>'
    + '<div class="muted-sm" style="margin-bottom:10px;">ou</div>'
    + '<span class="btn btn-primary" style="display:inline-block;padding:8px 20px;">Parcourir</span>'
    + '<input type="file" id="clFile" accept="image/*,application/pdf,.tiff,.tif,.bmp,.docx,.xlsx" data-testid="classeur-file" aria-label="Choisir un justificatif" style="display:none;">'
    + (S.file ? '<p class="muted-sm" style="margin-top:10px;margin-bottom:0;">📎 ' + esc(S.file.name) + ' (' + fmtBytes(S.file.size) + ')</p>' : '')
    + '</div>'
    + '<label style="font-size:12px;display:flex;gap:8px;align-items:flex-start;margin-top:10px;">'
    + '<input type="checkbox" id="clOcrConsent" style="margin-top:3px;" data-testid="classeur-ocr-consent">'
    + '<span>J’autorise l’envoi de ce document au service OCR en ligne pour la lecture automatique du texte.</span></label>'
    + '<button class="btn btn-primary" id="clOcr" data-testid="classeur-ocr" style="width:100%;justify-content:center;margin-top:8px;'
    + (S.ocrBusy ? 'opacity:.6;' : '') + '" ' + (S.ocrBusy ? 'disabled' : '') + '>'
    + (S.ocrBusy ? 'Lecture OCR en cours…' : '🔍 Lire automatiquement (OCR)') + '</button>'
    + '<label style="font-size:12px;margin-top:10px;">Texte du document (collez le contenu lu)<textarea id="clText" class="form-input" rows="5" data-testid="classeur-text" placeholder="Ex. ETS YANNICK — Facture n° 12 du 06/10/2026 — Total TTC : 1 180 000 F CFA — TVA : 180 000 F CFA"></textarea></label>'
    + '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">'
    + '<button class="btn btn-primary" id="clAnalyze" data-testid="classeur-analyze" style="flex:1;justify-content:center;">Analyser</button>'
    + '<button class="btn btn-secondary" id="clManual" style="flex:1;justify-content:center;">Saisie manuelle</button>'
    + '</div>'
    + '<div style="margin-top:12px;"><p class="muted-sm" style="margin-bottom:6px;">🧪 <strong>Tester sans document</strong> — charge une facture de démo et lance l’analyse :</p>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;">'
    + Object.keys(DEMOS).map((k) =>
      '<button class="btn btn-secondary btn-sm" data-demo="' + k + '" data-testid="classeur-demo-' + k + '">' + esc(DEMOS[k].label) + '</button>'
    ).join('')
    + '</div></div>'
    + (S.file ? '<button class="btn btn-secondary" id="clArchive" data-testid="classeur-archive" style="width:100%;justify-content:center;margin-top:8px;">☁️ Archiver le justificatif (R2)</button>' : '')
    + '</div></div>';
}

function reviewHtml() {
  const e = S.ext;
  return '<div class="card"><div class="card-body">'
    + '<h3 class="card-title" style="margin-bottom:8px;">Vérifiez l’extraction</h3>'
    + '<div class="form-grid-2">'
    + '<label style="font-size:12px;">Type<select id="cl-type" class="form-input">'
    + ['facture', 'impots', 'releve', 'quittance'].map((t) =>
      '<option value="' + t + '"' + (e.type === t ? ' selected' : '') + '>' + t + '</option>').join('')
    + '</select></label>'
    + '<label style="font-size:12px;">Sens<select id="cl-sens" class="form-input">'
    + ['achat', 'vente'].map((s) =>
      '<option value="' + s + '"' + (e.sens === s ? ' selected' : '') + '>' + s + '</option>').join('')
    + '</select></label>'
    + '<label style="font-size:12px;">Date<input id="cl-date" type="date" class="form-input" value="' + esc(e.date) + '"></label>'
    + '<label style="font-size:12px;">Tiers<input id="cl-tiers" class="form-input" value="' + esc(e.tiers) + '"></label>'
    + '<label style="font-size:12px;">Total (XOF)<input id="cl-total" type="number" min="0" class="form-input" value="' + e.total + '"></label>'
    + '<label style="font-size:12px;">TVA (XOF)<input id="cl-tva" type="number" min="0" class="form-input" value="' + e.tva + '"></label>'
    + '</div>'
    + (e.type !== 'impots'
      ? '<label style="font-size:12px;">Règlement<select id="cl-reglement" class="form-input">'
        + '<option value="">Non réglé</option><option value="ES">Réglé en espèces (571)</option><option value="BQ">Réglé par banque (521)</option>'
        + '</select></label>'
      : '')
    + (!e.total ? '<div class="notice-box">⚠️ Aucun total détecté — vérifiez le montant.</div>' : '')
    + (e.type !== 'impots' && !e.tva ? '<div class="notice-box">⚠️ TVA non détectée — l’écriture sera passée sans TVA.</div>' : '')
    + (e.avoir ? '<div class="notice-ok">↩ Avoir détecté — les écritures seront <strong>contrepassées</strong> (sens inversé).</div>' : '')
    + '<label style="font-size:12px;display:flex;align-items:center;gap:8px;margin:6px 0;">'
    + '<input type="checkbox" id="cl-avoir"' + (e.avoir ? ' checked' : '') + '> C’est un avoir (contrepassation)</label>'
    + tiersNoticeHtml()
    + '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">'
    + '<button class="btn btn-secondary" id="clBack" style="flex:1;justify-content:center;">← Retour</button>'
    + '<button class="btn btn-primary" id="clPropose" data-testid="classeur-propose" style="flex:2;justify-content:center;">Proposer les écritures →</button>'
    + '</div></div></div>';
}

function entriesHtml() {
  let h = '<div class="card"><div class="card-body">'
    + '<h3 class="card-title" style="margin-bottom:8px;">Écritures proposées (' + S.entries.length + ')</h3>'
    + '<p class="muted-sm">Vérifiez chaque ligne avant de passer au journal. Contrôle d’équilibre débit = crédit.</p>'
    // Outils comptables (13/10/2026 — inspiré Dolibarr)
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">'
    + '<button class="btn btn-secondary btn-sm" id="clBtnAvoir" title="Inverser débit/crédit (avoir)">🔄 Avoir (inverser D/C)</button>'
    + '<button class="btn btn-secondary btn-sm" id="clBtnRas" title="Ajouter une retenue à la source">💰 + Retenue à la source</button>'
    + '<button class="btn btn-secondary btn-sm" id="clBtnSituation" title="Facture de situation BTP : appliquer un % d\'avancement">🏗️ Situation (% avancement)</button>'
    + '<button class="btn btn-secondary btn-sm" id="clBtnAcompte" title="Ajouter un acompte client reçu">💵 + Acompte client</button>'
    + '<button class="btn btn-secondary btn-sm" id="clBtnGarantie" title="Ajouter une retenue de garantie BTP (5%)">🛡️ + Retenue de garantie</button>'
    + '</div>';

  // Avertissement dettes fiscales non constatées — affichage soigné (12/10/2026)
  if (S.liabilityWarnings && S.liabilityWarnings.length > 0) {
    h += '<div id="clLiabilityWarn" style="background:#fef3c7;border:1px solid #f59e0b;border-radius:12px;padding:12px;margin-bottom:12px;">'
      + '<div style="font-weight:700;font-size:14px;margin-bottom:8px;">⚠️ Dettes non constatées</div>'
      + '<div style="font-size:12px;margin-bottom:8px;">Ces impôts n\'ont pas été constatés en comptabilité (paie, factures) :</div>'
      + S.liabilityWarnings.map((w) => '<div style="font-size:12px;padding:6px 0;border-top:1px solid #fde68a;">' + esc(w.replace(/^• /, '')) + '</div>').join('')
      + '<div style="display:flex;gap:8px;margin-top:10px;">'
      + '<button class="btn btn-secondary" id="clWarnCancel" style="flex:1;justify-content:center;">← Corriger</button>'
      + '<button class="btn btn-primary" id="clWarnConfirm" style="flex:1;justify-content:center;">Passer quand même</button>'
      + '</div></div>';
  }
  S.entries.forEach((entry, ei) => {
    const td = entry.lignes.reduce((a, l) => a + (Number(l.debit) || 0), 0);
    const tc = entry.lignes.reduce((a, l) => a + (Number(l.credit) || 0), 0);
    const ok = td === tc && td > 0;
    h += '<div style="border:1px solid var(--border);border-radius:12px;margin-bottom:10px;overflow:hidden;" data-testid="classeur-entry-' + ei + '">'
      + '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;padding:10px 10px 6px;">'
      + '<strong style="font-size:13px;">' + esc(entry.journal) + ' · ' + esc(entry.libelle) + '</strong>'
      + '<span class="' + (ok ? 'badge-ok' : 'badge-ko') + '">' + (ok ? '✓ Équilibrée' : '✗ Déséquilibrée') + '</span></div>'
      // Tableau comptable classique : Pièce | Date | Libellé | Compte | Débit | Crédit (12/10/2026)
      + '<div style="overflow-x:auto;">'
      + '<table class="journal-table" style="width:100%;border-collapse:collapse;font-size:12px;min-width:520px;">'
      + '<thead><tr style="background:var(--primary);color:#fff;">'
      + '<th style="padding:8px 6px;text-align:center;font-weight:600;">Pièce</th>'
      + '<th style="padding:8px 6px;text-align:center;font-weight:600;">Date</th>'
      + '<th style="padding:8px 6px;text-align:center;font-weight:600;">Compte</th>'
      + '<th style="padding:8px 6px;text-align:left;font-weight:600;">Libellé</th>'
      + '<th style="padding:8px 6px;text-align:right;font-weight:600;">Débit</th>'
      + '<th style="padding:8px 6px;text-align:right;font-weight:600;">Crédit</th>'
      + '</tr></thead><tbody>'
      + entry.lignes.map((l, li) => {
        const d = Number(l.debit) || 0, c = Number(l.credit) || 0;
        // Valeurs par défaut si vides (12/10/2026)
        const pieceVal = entry.piece || fmtDate(entry.date).replace(/\//g, '') || '';
        // Libellé = intitulé officiel SYSCOHADA du compte (12/10/2026)
        const libelleVal = l.libelle || syscohadaLabel(l.compte) || (l.compte ? 'Compte ' + l.compte : '');
        return '<tr style="border-top:1px solid var(--border);">'
        + '<td style="padding:6px;text-align:center;"><input class="form-input" data-efield="piece" data-ei="' + ei + '" value="' + esc(pieceVal) + '" placeholder="N°" style="width:56px;padding:4px 6px;font-size:12px;text-align:center;"></td>'
        + '<td style="padding:6px;text-align:center;font-size:11px;white-space:nowrap;">' + esc(fmtDate(entry.date)) + '</td>'
        + '<td style="padding:6px;text-align:center;"><input class="form-input" data-lfield="compte" data-ei="' + ei + '" data-li="' + li + '" value="' + esc(l.compte) + '" inputmode="numeric" style="width:64px;padding:4px 6px;font-size:12px;font-weight:700;text-align:center;"></td>'
        + '<td style="padding:6px;"><input class="form-input" data-lfield="libelle" data-ei="' + ei + '" data-li="' + li + '" value="' + esc(libelleVal) + '" placeholder="Libellé" style="width:100%;min-width:110px;padding:4px 6px;font-size:12px;"></td>'
        + '<td style="padding:6px;text-align:right;"><input class="form-input" type="number" min="0" data-lfield="debit" data-ei="' + ei + '" data-li="' + li + '" value="' + (d || '') + '" style="width:84px;padding:4px 6px;font-size:12px;text-align:right;"></td>'
        + '<td style="padding:6px;text-align:right;"><input class="form-input" type="number" min="0" data-lfield="credit" data-ei="' + ei + '" data-li="' + li + '" value="' + (c || '') + '" style="width:84px;padding:4px 6px;font-size:12px;text-align:right;"></td>'
        + '</tr>';
      }).join('')
      + '<tr style="border-top:2px solid var(--border);font-weight:700;background:var(--bg-light);">'
      + '<td colspan="4" style="padding:8px 6px;text-align:right;font-size:12px;">Total</td>'
      + '<td style="padding:8px 6px;text-align:right;font-size:12px;">' + td.toLocaleString('fr-FR') + '</td>'
      + '<td style="padding:8px 6px;text-align:right;font-size:12px;">' + tc.toLocaleString('fr-FR') + '</td>'
      + '</tr>'
      + '</tbody></table></div>'
      + '</div>';
  });
  h += '<div style="display:flex;gap:8px;flex-wrap:wrap;">'
    + '<button class="btn btn-secondary" id="clBack2" style="flex:1;justify-content:center;">← Retour</button>'
    + '<button class="btn btn-primary" id="clPost" data-testid="classeur-post" style="flex:2;justify-content:center;">Passer les écritures</button>'
    + '</div></div></div>';
  return h;
}

/** Formate une date AAAA-MM-JJ en JJ/MM/AAAA. */
function fmtDate(d) {
  if (!d) return '';
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[3] + '/' + m[2] + '/' + m[1] : String(d);
}

/** Charge JSZip depuis le CDN (pour lire docx/xlsx). */
let _jszipPromise = null;
function loadJsZip() {
  if (!_jszipPromise) {
    _jszipPromise = new Promise((resolve, reject) => {
      if (window.JSZip) return resolve(window.JSZip);
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      s.onload = () => resolve(window.JSZip);
      s.onerror = () => reject(new Error('JSZip non chargé'));
      document.head.appendChild(s);
    });
  }
  return _jszipPromise;
}

function dataUrlToBuffer(dataUrl) {
  const b64 = String(dataUrl).split(',')[1] || '';
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

/** Extrait le texte d'un fichier .docx (12/10/2026). */
async function extractDocxText(dataUrl) {
  const JSZip = await loadJsZip();
  const zip = await JSZip.loadAsync(dataUrlToBuffer(dataUrl));
  const xmlFile = zip.file('word/document.xml');
  if (!xmlFile) throw new Error('Document Word invalide');
  const xml = await xmlFile.async('text');
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const paragraphs = doc.getElementsByTagName('w:p');
  const lines = [];
  for (const p of paragraphs) {
    const texts = p.getElementsByTagName('w:t');
    let line = '';
    for (const t of texts) line += t.textContent;
    if (line.trim()) lines.push(line.trim());
  }
  if (!lines.length) throw new Error('Aucun texte trouvé');
  return lines.join('\n');
}

/** Extrait le texte d'un fichier .xlsx (12/10/2026). */
async function extractXlsxText(dataUrl) {
  const JSZip = await loadJsZip();
  const zip = await JSZip.loadAsync(dataUrlToBuffer(dataUrl));
  // Lire les chaînes partagées
  const sharedFile = zip.file('xl/sharedStrings.xml');
  const shared = [];
  if (sharedFile) {
    const xml = await sharedFile.async('text');
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    const sis = doc.getElementsByTagName('si');
    for (const si of sis) {
      const ts = si.getElementsByTagName('t');
      let s = '';
      for (const t of ts) s += t.textContent;
      shared.push(s);
    }
  }
  // Lire la première feuille
  const sheetFile = zip.file('xl/worksheets/sheet1.xml');
  if (!sheetFile) throw new Error('Feuille Excel introuvable');
  const xml = await sheetFile.async('text');
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const rows = doc.getElementsByTagName('row');
  const lines = [];
  for (const row of rows) {
    const cells = row.getElementsByTagName('c');
    const vals = [];
    for (const c of cells) {
      const t = c.getAttribute('t');
      const v = c.getElementsByTagName('v')[0];
      if (!v) continue;
      if (t === 's') vals.push(shared[Number(v.textContent)] || '');
      else vals.push(v.textContent);
    }
    const line = vals.filter((x) => x !== '').join(' | ');
    if (line.trim()) lines.push(line);
  }
  if (!lines.length) throw new Error('Aucune donnée trouvée');
  return lines.join('\n');
}

/** Envoie le texte Office à l'IA pour extraction structurée (12/10/2026). */
async function analyzeOfficeText(text) {
  if (!text || text.length < 10) { toast('Texte trop court pour analyse.', 'error'); return; }
  const svc = supabaseService();
  const token = await getAccessToken();
  if (!svc || !token) { toast('Session expirée.', 'error'); return; }
  let tvaSubject = true, bicPrelevement = false;
  try {
    const { loadTvaSubject, loadBicPrelevement } = await import('../store.js');
    tvaSubject = await loadTvaSubject();
    bicPrelevement = await loadBicPrelevement();
  } catch (e) { /* défauts */ }
  toast('Analyse IA du document…', 'info');
  try {
    const ocrSvc = createOcrService({
      invokeOcr: ({ accessToken, body }) => svc.edgeFunction({ fn: 'ocr', accessToken, body }),
    });
    // Réutiliser l'extraction IA via un appel OCR avec le texte pré-extrait
    // (l'Edge Function accepte aussi du texte direct via le champ 'text')
    const { raw } = await ocrSvc.requestOcr({
      accessToken: token, dataUrl: '', language: 'fre', consent: true,
      tvaSubject, bicPrelevement, preExtractedText: text,
    });
    S.aiExtraction = (raw && raw.aiExtraction) || null;
    if (S.aiExtraction) toast('Document analysé par IA.', 'success');
    else toast('Texte extrait. Cliquez sur Analyser.', 'info');
  } catch (e) {
    toast('Texte extrait. Cliquez sur Analyser pour continuer.', 'info');
  }
}

/** Retourne l'intitulé officiel SYSCOHADA d'un compte (12/10/2026). */
function syscohadaLabel(num) {
  const n = String(num || '').trim();
  // D'abord les sous-comptes enregistrés (tiers), puis le plan officiel
  try {
    const acc = getAccount(n);
    if (acc && acc.intitule) return acc.intitule;
  } catch (e) { /* repli */ }
  const a = ACCOUNTS[n];
  return a ? a.intitule : '';
}

/* ---------------- Événements ---------------- */

/**
 * Notice « nouveau tiers » (port de fmClasseurTiersNotice) : si le tiers
 * détecté n'est pas connu, propose le type (fournisseur/client) — un
 * sous-compte (401001, 411001…) sera créé à la passation.
 */
function tiersNoticeHtml() {
  const e = S.ext;
  if (!e || e.type === 'impots') return '';
  const nom = String(e.tiers || '').trim();
  if (!nom || nom === 'Tiers' || nom === 'DGI') return '';
  if (isKnownTiers(S.tiers.map((t) => t.nom), nom)) return '';
  return '<div class="notice-box">⚠️ <strong>Nouveau tiers détecté : ' + esc(nom) + '</strong><br>'
    + '<label style="font-size:12px;">Type de tiers : <select id="cl-tiers-type" class="form-input" style="margin-top:6px;max-width:280px;">'
    + '<option value="F"' + (e.sens === 'achat' ? ' selected' : '') + '>Fournisseur → sous-compte 401</option>'
    + '<option value="C"' + (e.sens === 'vente' ? ' selected' : '') + '>Client → sous-compte 411</option>'
    + '</select></label>'
    + '<div class="muted-sm">Un sous-compte sera créé automatiquement (ex. 401001) et réutilisé ensuite.</div></div>';
}

function analyzeText() {
  const ta = $('#clText');
  const text = ta ? ta.value : '';
  if (!text.trim()) { toast('Collez le texte du document ou utilisez la saisie manuelle.', 'error'); return; }
  // Utiliser l'extraction IA si disponible (12/10/2026), sinon regex
  if (S.aiExtraction && S.aiExtraction.lignes && S.aiExtraction.lignes.length > 0) {
    S.ext = extFromAI(S.aiExtraction, text, S.file ? S.file.name : (S.demoName || ''));
    if (S.ext) {
      toast('Document analysé par IA — vérifiez les écritures proposées.', 'success');
    } else {
      S.ext = extractInvoiceData(text, S.file ? S.file.name : (S.demoName || ''));
    }
  } else {
    S.ext = extractInvoiceData(text, S.file ? S.file.name : (S.demoName || ''));
  }
  S.step = 'review';
  render();
}

/** Convertit l'extraction IA en format ext (12/10/2026). */
function extFromAI(ai, text, fileName) {
  try {
    if (!ai || !ai.type || !Array.isArray(ai.lignes)) return null;
    const total = Number(ai.total) || ai.lignes.reduce((a, l) => a + (Number(l.montant) || 0), 0);
    if (total <= 0) return null;
    return {
      type: ai.type === 'bordereau_dgi' ? 'impots' : (ai.type.startsWith('facture') ? 'facture' : 'autre'),
      sens: ai.type === 'facture_vente' ? 'vente' : 'achat',
      date: ai.date || new Date().toISOString().slice(0, 10),
      tiers: ai.tiers || '',
      total,
      tva: 0,
      fileName: fileName || '',
      details: ai.lignes.map((l) => ({
        label: String(l.label || ''),
        amount: Number(l.montant) || 0,
        account: String(l.compte || '447'),
      })).filter((d) => d.amount > 0),
      aiSource: true,
    };
  } catch (e) {
    console.error('[classeur] extFromAI:', e.message);
    return null;
  }
}

/**
 * Lecture OCR automatique via l'Edge Function `ocr` (port de fmOcrOnline,
 * sans clé en dur : JWT + consentement explicite). 2 tentatives, puis
 * repli gracieux sur le collage manuel du texte.
 */
async function ocrRead() {
  if (S.ocrBusy) return;
  if (!S.file || !S.file.dataUrl) { toast("Choisissez d'abord un fichier à lire.", 'error'); return; }

  // Documents Office : extraction directe du texte (pas besoin d'OCR) — 12/10/2026
  const fileName = (S.file.name || '').toLowerCase();
  if (fileName.endsWith('.docx') || fileName.endsWith('.xlsx')) {
    S.ocrBusy = true;
    render();
    try {
      const text = fileName.endsWith('.docx')
        ? await extractDocxText(S.file.dataUrl)
        : await extractXlsxText(S.file.dataUrl);
      S.ocrBusy = false;
      render();
      const ta = document.getElementById('clText');
      if (ta) ta.value = text;
      // Envoyer le texte à l'IA pour extraction structurée
      await analyzeOfficeText(text);
    } catch (e) {
      S.ocrBusy = false;
      render();
      toast('Lecture impossible : ' + (e.message || 'format non pris en charge'), 'error');
    }
    return;
  }

  const consentEl = $('#clOcrConsent');
  if (!consentEl || !consentEl.checked) {
    toast("Cochez l'autorisation d'envoi au service OCR pour lancer la lecture.", 'error');
    return;
  }
  const svc = supabaseService();
  if (!svc || typeof svc.edgeFunction !== 'function') {
    toast('Connexion serveur non configurée.', 'error');
    return;
  }
  const token = await getAccessToken();
  if (!token) { toast('Session expirée. Reconnectez-vous.', 'error'); return; }
  const ocrSvc = createOcrService({
    invokeOcr: ({ accessToken, body }) => svc.edgeFunction({ fn: 'ocr', accessToken, body }),
  });
  // Charger les paramètres fiscaux pour l'extraction IA (12/10/2026)
  let tvaSubject = true, bicPrelevement = false;
  try {
    const { loadTvaSubject, loadBicPrelevement } = await import('../store.js');
    tvaSubject = await loadTvaSubject();
    bicPrelevement = await loadBicPrelevement();
  } catch (e) { /* défauts */ }
  S.ocrBusy = true;
  render();
  let lastErr = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { text, raw } = await ocrSvc.requestOcr({
        accessToken: token, dataUrl: S.file.dataUrl, language: 'fre', consent: true,
        tvaSubject, bicPrelevement,
      });
      S.ocrBusy = false;
      render(); // réactive le bouton
      const ta = document.getElementById('clText');
      if (ta) ta.value = text;
      // Stocker l'extraction IA si disponible (12/10/2026)
      S.aiExtraction = (raw && raw.aiExtraction) || null;
      toast('Texte lu par OCR — vérifiez l’extraction.', 'success');
      analyzeText();
      return;
    } catch (e) {
      lastErr = e;
      if (attempt === 1) await new Promise((r) => setTimeout(r, 1500));
    }
  }
  S.ocrBusy = false;
  render();
  const code = lastErr && lastErr.code;
  toast(
    code === 'OCR_EMPTY'
      ? 'Aucun texte détecté dans le document — collez le texte ou saisissez manuellement.'
      : 'Lecture OCR indisponible pour le moment — collez le texte du document ci-dessous.',
    'error'
  );
}

function loadDemo(kind) {
  const d = DEMOS[kind];
  if (!d) return;
  S.file = null;
  S.demoName = d.name;
  S.step = 'import';
  render();
  const ta = document.getElementById('clText');
  if (ta) ta.value = d.text;
  toast('Facture de démo chargée : ' + d.label, 'success');
  analyzeText();
}

function bind() {
  if (S.step === 'import') {
    const fi = $('#clFile');
    if (fi) fi.addEventListener('change', onFilePick);
    // Zone drag & drop : clic -> ouvre le sélecteur, drop -> fichier (12/10/2026)
    const dz = $('#clDropZone');
    if (dz && fi) {
      dz.addEventListener('click', () => fi.click());
      ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => {
        e.preventDefault();
        dz.style.borderColor = 'var(--primary-dark, #c2410c)';
        dz.style.background = 'color-mix(in srgb, var(--primary) 12%, transparent)';
      }));
      ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => {
        e.preventDefault();
        dz.style.borderColor = 'var(--primary)';
        dz.style.background = 'color-mix(in srgb, var(--primary) 6%, transparent)';
      }));
      dz.addEventListener('drop', (e) => {
        const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) { fi.files = e.dataTransfer.files; onFilePick({ target: fi }); }
      });
    }
    const ocrBtn = $('#clOcr');
    if (ocrBtn) ocrBtn.addEventListener('click', ocrRead);
    shell().querySelectorAll('[data-demo]').forEach((b) =>
      b.addEventListener('click', () => loadDemo(b.dataset.demo)));
    $('#clAnalyze').addEventListener('click', analyzeText);
    $('#clManual').addEventListener('click', () => {
      S.ext = {
        type: 'facture', sens: 'achat', date: new Date().toISOString().slice(0, 10),
        tiers: '', total: 0, tva: 0, details: [], fileName: S.file ? S.file.name : (S.demoName || ''),
      };
      S.step = 'review';
      render();
    });
    const arch = $('#clArchive');
    if (arch) arch.addEventListener('click', archiveFile);
  } else if (S.step === 'review') {
    $('#clBack').addEventListener('click', () => { S.step = 'import'; render(); });
    $('#clPropose').addEventListener('click', () => {
      const g = (id) => document.getElementById(id).value;
      S.ext = {
        ...S.ext,
        type: g('cl-type'), sens: g('cl-sens'), date: g('cl-date'),
        tiers: g('cl-tiers').trim() || 'Tiers',
        total: Math.round(Number(g('cl-total')) || 0),
        tva: Math.round(Number(g('cl-tva')) || 0),
        avoir: !!document.getElementById('cl-avoir')?.checked,
      };
      const regEl = document.getElementById('cl-reglement');
      S.entries = proposeEntries(S.ext, { reglement: regEl ? regEl.value : '' });
      if (!S.entries.length) { toast('Aucune écriture à proposer — vérifiez le total.', 'error'); return; }
      S.step = 'entries';
      render();
    });
  } else {
    $('#clBack2').addEventListener('click', () => {
      // Si on modifiait une écriture déjà passée, retour à la liste (12/10/2026)
      if (S.editingRecent) {
        S.editingRecent = false;
        S.entries = [];
        S.step = 'import';
      } else {
        S.step = 'review';
      }
      render();
    });
    shell().querySelectorAll('[data-efield]').forEach((inp) =>
      inp.addEventListener('input', () => {
        S.entries[Number(inp.dataset.ei)][inp.dataset.efield] = inp.value;
      }));
    shell().querySelectorAll('[data-lfield]').forEach((inp) =>
      inp.addEventListener('input', () => {
        const line = S.entries[Number(inp.dataset.ei)].lignes[Number(inp.dataset.li)];
        const f = inp.dataset.lfield;
        line[f] = (f === 'compte' || f === 'libelle') ? inp.value.trim() : Math.round(Number(inp.value) || 0);
      }));
    // Re-rendu léger des badges d'équilibre à chaque saisie
    shell().querySelectorAll('[data-lfield]').forEach((inp) =>
      inp.addEventListener('change', () => { render(); }));
    $('#clPost').addEventListener('click', postEntries);
    // Boutons de l'avertissement dettes fiscales (12/10/2026)
    const warnCancel = $('#clWarnCancel');
    if (warnCancel) warnCancel.addEventListener('click', () => {
      S.liabilityWarningShown = false;
      S.liabilityWarnings = [];
      render();
    });
    const warnConfirm = $('#clWarnConfirm');
    if (warnConfirm) warnConfirm.addEventListener('click', () => {
      // L'utilisateur confirme : on passe les écritures sans re-vérifier
      S.liabilityWarningShown = true; // évite la re-vérification
      postEntries();
    });
  }
  // Outils comptables (13/10/2026 — inspiré Dolibarr)
  const btnAvoir = $('#clBtnAvoir');
  if (btnAvoir) btnAvoir.addEventListener('click', () => {
    // Inverser débit/crédit sur toutes les lignes (avoir)
    (S.entries || []).forEach((entry) => {
      (entry.lignes || []).forEach((l) => {
        const d = l.debit || 0, c = l.credit || 0;
        l.debit = c; l.credit = d;
      });
      entry.libelle = 'AVOIR — ' + (entry.libelle || '').replace(/^AVOIR — /, '');
    });
    render();
    toast('Débit/crédit inversés (avoir).', 'success');
  });
  const btnRas = $('#clBtnRas');
  if (btnRas) btnRas.addEventListener('click', async () => {
    // Ajouter une retenue à la source (5% — taux courant au Burkina, modifiable sur la ligne)
    const t = 5;
    (S.entries || []).forEach((entry) => {
      // Base = total des produits (comptes 7) ou total crédit
      let base = 0;
      (entry.lignes || []).forEach((l) => {
        if (String(l.compte || '').charAt(0) === '7') base += (l.credit || 0);
      });
      if (!base) {
        base = (entry.lignes || []).reduce((a, l) => a + (l.credit || 0), 0);
      }
      if (base > 0) {
        const montant = Math.round(base * t / 100);
        entry.lignes.push({
          compte: '447', libelle: 'Retenue à la source ' + t + '% (modifiable)',
          debit: 0, credit: montant,
        });
        // Ajuster le tiers (diminuer son débit du montant de la RAS)
        const tiersLine = (entry.lignes || []).find((l) =>
          ['411', '401'].includes(String(l.compte || '').slice(0, 3)) && (l.debit || 0) > 0);
        if (tiersLine) tiersLine.debit = Math.max(0, (tiersLine.debit || 0) - montant);
      }
    });
    render();
    toast('Retenue à la source (' + t + '%) ajoutée — modifiable sur la ligne.', 'success');
  });
  const btnSituation = $('#clBtnSituation');
  if (btnSituation) btnSituation.addEventListener('click', async () => {
    // Facture de situation BTP : appliquer un % d'avancement aux montants (13/10/2026)
    const { confirmDialog } = await import('../ui.js');
    // Demander le % via un dialogue simple — on utilise un pourcentage à saisir
    const pctStr = window.prompt('Pourcentage d\'avancement à comptabiliser (%) :', '100');
    if (pctStr === null) return;
    const pct = parseFloat(String(pctStr).replace(',', '.'));
    if (!pct || pct <= 0 || pct > 100) { toast('Pourcentage invalide (1-100).', 'error'); return; }
    const ratio = pct / 100;
    (S.entries || []).forEach((entry) => {
      (entry.lignes || []).forEach((l) => {
        l.debit = Math.round((l.debit || 0) * ratio);
        l.credit = Math.round((l.credit || 0) * ratio);
      });
      if (pct < 100) {
        entry.libelle = 'Situation ' + pct + '% — ' + (entry.libelle || '').replace(/^Situation [\d.,]+% — /, '');
      }
    });
    render();
    toast('Avancement ' + pct + '% appliqué.', 'success');
  });
  const btnAcompte = $('#clBtnAcompte');
  if (btnAcompte) btnAcompte.addEventListener('click', () => {
    // Acompte client reçu : 411 → 419 (13/10/2026)
    const montantStr = window.prompt('Montant de l\'acompte reçu (F) :', '');
    if (montantStr === null) return;
    const montant = Math.round(parseFloat(String(montantStr).replace(/[\s,]/g, '')) || 0);
    if (!montant || montant <= 0) { toast('Montant invalide.', 'error'); return; }
    (S.entries || []).forEach((entry) => {
      entry.lignes.push({ compte: '419', libelle: 'Acompte client reçu', debit: 0, credit: montant });
      // Contrepartie : diminuer le net à recevoir du tiers ou ajouter en banque
      const tiersLine = (entry.lignes || []).find((l) =>
        String(l.compte || '').slice(0, 3) === '411' && (l.debit || 0) > 0);
      if (tiersLine) {
        // L'acompte réduit la créance : on ajoute une ligne 411 au crédit
        entry.lignes.push({ compte: tiersLine.compte, libelle: 'Acompte déduit', debit: 0, credit: montant });
      }
    });
    render();
    toast('Acompte ajouté.', 'success');
  });
  const btnGarantie = $('#clBtnGarantie');
  if (btnGarantie) btnGarantie.addEventListener('click', () => {
    // Retenue de garantie BTP 5% : 411 → 4117 (13/10/2026)
    const t = 5;
    (S.entries || []).forEach((entry) => {
      let base = 0;
      let tiersCompte = '411';
      (entry.lignes || []).forEach((l) => {
        if (String(l.compte || '').slice(0, 3) === '411' && (l.debit || 0) > 0) {
          base = Math.max(base, l.debit || 0);
          tiersCompte = l.compte;
        }
      });
      if (base > 0) {
        const montant = Math.round(base * t / 100);
        entry.lignes.push({ compte: '4117', libelle: 'Retenue de garantie ' + t + '%', debit: montant, credit: 0 });
        entry.lignes.push({ compte: tiersCompte, libelle: 'Retenue de garantie déduite', debit: 0, credit: montant });
      }
    });
    render();
    toast('Retenue de garantie (' + t + '%) ajoutée.', 'success');
  });
  // Boutons Modifier/Voir/Supprimer des écritures récentes (12/10/2026)
  shell().querySelectorAll('[data-cl-edit]').forEach((b) =>
    b.addEventListener('click', () => editRecentEntry(Number(b.dataset.clEdit))));
  shell().querySelectorAll('[data-cl-view]').forEach((b) =>
    b.addEventListener('click', () => viewRecentDoc(Number(b.dataset.clView))));
  shell().querySelectorAll('[data-cl-del]').forEach((b) =>
    b.addEventListener('click', () => deleteRecentEntry(Number(b.dataset.clDel))));
  shell().querySelectorAll('[data-cl-pdf]').forEach((b) =>
    b.addEventListener('click', () => printEntryPdf(Number(b.dataset.clPdf))));
  shell().querySelectorAll('[data-cl-rev]').forEach((b) =>
    b.addEventListener('click', () => reverseEntry(Number(b.dataset.clRev))));
  shell().querySelectorAll('[data-cl-validate]').forEach((b) =>
    b.addEventListener('click', () => validerEcriture(Number(b.dataset.clValidate))));
  // Délettrer une écriture (13/10/2026)
  shell().querySelectorAll('[data-cl-unletter]').forEach((b) =>
    b.addEventListener('click', () => unletterRecentEntry(Number(b.dataset.clUnletter))));
  shell().querySelectorAll('[data-cl-tpl]').forEach((b) =>
    b.addEventListener('click', () => saveAsTemplate(Number(b.dataset.clTpl))));
  // Boutons Voir des justificatifs archivés (12/10/2026)
  shell().querySelectorAll('[data-doc-view]').forEach((b) =>
    b.addEventListener('click', () => viewArchivedDoc(Number(b.dataset.docView))));
}

/** Voir un justificatif archivé sur le cloud (12/10/2026). */
async function viewArchivedDoc(idx) {
  const d = S.docs[idx];
  if (!d || !d.key) {
    toast('Fichier introuvable.', 'error');
    return;
  }
  try {
    toast('Ouverture du fichier…', 'info');
    const r2 = await initR2();
    const { download_url } = await r2.getDownloadUrl({ key: d.key });
    window.open(download_url, '_blank', 'noopener');
  } catch (e) {
    toast('Ouverture impossible : ' + errMsg(e), 'error');
  }
}

/** Demande le journal pour la contre-passation (13/10/2026). */
function askJournalDialog(journalDefaut) {
  return new Promise((resolve) => {
    const journaux = [
      ['AC', 'Achats'],
      ['VT', 'Ventes'],
      ['BQ', 'Banque'],
      ['ES', 'Espèces (Caisse)'],
      ['OD', 'Opérations diverses'],
      ['AN', 'À-nouveaux'],
    ];
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px;';
    const opts = journaux.map(([code, label]) =>
      '<option value="' + code + '"' + (code === journalDefaut ? ' selected' : '') + '>' + code + ' — ' + label + '</option>'
    ).join('');
    overlay.innerHTML = '<div style="background:#fff;border-radius:12px;padding:20px;max-width:340px;width:100%;">'
      + '<h3 style="margin:0 0 8px;font-size:16px;">Contre-passer l\'écriture ?</h3>'
      + '<p style="font-size:13px;color:#555;margin:0 0 12px;">Une écriture inverse sera créée (débits ↔ crédits).<br>Dans quel journal ?</p>'
      + '<select id="revJournal" style="width:100%;padding:10px;font-size:14px;border:1px solid #ccc;border-radius:8px;margin-bottom:16px;">' + opts + '</select>'
      + '<div style="display:flex;gap:8px;">'
      + '<button id="revCancel" style="flex:1;padding:10px;border:1px solid #ccc;border-radius:8px;background:#fff;">Annuler</button>'
      + '<button id="revOk" style="flex:1;padding:10px;border:none;border-radius:8px;background:#EA580C;color:#fff;font-weight:600;">Contre-passer</button>'
      + '</div></div>';
    document.body.appendChild(overlay);
    const close = (val) => { overlay.remove(); resolve(val); };
    overlay.querySelector('#revCancel').onclick = () => close(null);
    overlay.querySelector('#revOk').onclick = () => close(overlay.querySelector('#revJournal').value);
    overlay.onclick = (ev) => { if (ev.target === overlay) close(null); };
  });
}

/** Sauvegarder une écriture comme modèle récurrent (13/10/2026). */
async function saveAsTemplate(idx) {
  const e = S.recentEntries[idx];
  if (!e || !e.lignes || !e.lignes.length) return;
  // Confirmation avant de créer le modèle (13/10/2026)
  const { confirmDialog } = await import('../ui.js');
  const ok = await confirmDialog(
    '💾 Créer un modèle d\'écriture ?',
    'Un modèle, c\'est comme un formulaire vierge : il garde les comptes et les libellés de cette écriture, mais SANS les montants.\n\n'
    + 'À quoi ça sert ? Pour les écritures qui reviennent souvent (loyer, salaire...), tu cliques sur le modèle et tu n\'as plus qu\'à mettre le montant et la date.\n\n'
    + '⚠️ Ça ne modifie pas ton écriture actuelle, ça crée juste un raccourci pour la prochaine fois.',
    { okLabel: 'Oui, créer le modèle', cancelLabel: 'Non' }
  );
  if (!ok) return;
  try {
    const { getSetting, setSetting } = await import('../store.js');
    let templates = [];
    try { templates = JSON.parse(await getSetting('modeles_ecritures') || '[]'); } catch (err) { /* [] */ }
    const tpl = {
      id: 'tpl' + Date.now().toString(36),
      nom: (e.libelle || 'Modèle') + ' (' + (e.journal || 'OD') + ')',
      journal: e.journal,
      lignes: e.lignes.map((l) => ({ compte: l.compte, libelle: l.libelle, debit: 0, credit: 0 })),
    };
    templates.push(tpl);
    await setSetting('modeles_ecritures', JSON.stringify(templates));
    toast('Modèle "' + tpl.nom + '" enregistré 💾', 'success');
  } catch (err) {
    toast('Sauvegarde impossible : ' + errMsg(err), 'error');
  }
}

/** Valider une écriture (13/10/2026) : brouillon → validée (intangible). */
async function validerEcriture(idx) {
  const e = S.recentEntries[idx];
  if (!e) return;
  if ((e.statut || 'brouillon') === 'valide') { toast('Écriture déjà validée.', 'info'); return; }
  const { confirmDialog } = await import('../ui.js');
  const ok = await confirmDialog(
    'Valider l\'écriture ?',
    'Journal ' + (e.journal || '') + ' · Pièce n° ' + (e.piece || ''),
    { okLabel: 'Valider', cancelLabel: 'Annuler' }
  );
  if (!ok) return;
  try {
    const { saveEntry } = await import('../store.js');
    const upd = { ...e, statut: 'valide', dateValidation: new Date().toISOString().slice(0, 10) };
    await saveEntry(upd);
    await refreshRecentEntries();
    render();
    toast('Écriture validée ✅', 'success');
  } catch (err) {
    toast('Validation impossible : ' + errMsg(err), 'error');
  }
}

/** Délettrer une écriture (13/10/2026) : retire les codes de lettrage des lignes. */
async function unletterRecentEntry(idx) {
  const e = S.recentEntries[idx];
  if (!e) return;
  const { confirmDialog } = await import('../ui.js');
  const ok = await confirmDialog('Délettrer l\'écriture ?',
    'Les codes de lettrage seront retirés de toutes les lignes.',
    { okLabel: 'Délettrer' });
  if (!ok) return;
  try {
    const { saveEntry } = await import('../store.js');
    const upd = {
      ...e,
      lignes: (e.lignes || []).map((l) => {
        const nl = { ...l };
        delete nl.lettre;
        return nl;
      }),
    };
    await saveEntry(upd);
    await refreshRecentEntries();
    render();
    toast('Écriture délettrée.', 'success');
  } catch (err) {
    toast('Délettrage impossible : ' + errMsg(err), 'error');
  }
}

/** Contre-passer (extourner) une écriture (13/10/2026) : crée l'écriture inverse. */
async function reverseEntry(idx) {
  const e = S.recentEntries[idx];
  if (!e || !e.lignes || !e.lignes.length) { toast('Écriture introuvable.', 'error'); return; }
  const { confirmDialog } = await import('../ui.js');
  // Demander le journal de contre-passation (13/10/2026)
  const journalChoisi = await askJournalDialog(e.journal || 'OD');
  if (!journalChoisi) return;
  try {
    const { saveEntry, loadEntries } = await import('../store.js');
    // Lignes inversées : débit ↔ crédit
    const lignesInv = e.lignes.map((l) => ({
      compte: l.compte,
      libelle: l.libelle,
      debit: Number(l.credit) || 0,
      credit: Number(l.debit) || 0,
    }));
    // Numéro de pièce : max + 1 pour le journal choisi
    const allEntries = await loadEntries() || [];
    let maxPiece = 0;
    for (const en of allEntries) {
      if ((en.journal || 'OD') === journalChoisi) {
        const n = parseInt(String(en.piece || '').replace(/\D/g, ''), 10);
        if (!isNaN(n)) maxPiece = Math.max(maxPiece, n);
      }
    }
    const newEntry = {
      id: 'cl' + Date.now().toString(36) + '-rev' + Math.floor(Math.random() * 100000),
      journal: journalChoisi,
      piece: String(maxPiece + 1),
      date: new Date().toISOString().slice(0, 10),
      libelle: 'Extourne pièce ' + (e.piece || '') + ' — ' + (e.libelle || ''),
      lignes: lignesInv,
      extourneDe: e.id, // lien vers l'écriture d'origine (13/10/2026)
      extournePiece: e.piece || '', // n° de pièce d'origine, stocké directement (13/10/2026)
      extourneJournal: e.journal || '', // journal d'origine (13/10/2026)
      statut: 'brouillon', // l'extourne naît aussi en brouillon
      // Pas de document lié (la contre-passation est une écriture comptable pure)
    };
    await saveEntry(newEntry);
    // Marquer l'écriture d'origine comme contre-passée
    try {
      const orig = { ...e, contrePasseePar: newEntry.id, contrePasseePiece: newEntry.piece, contrePasseeJournal: newEntry.journal };
      await saveEntry(orig);
    } catch (err2) { /* non bloquant */ }
    await refreshRecentEntries();
    render();
    toast('Écriture contre-passée (pièce n° ' + newEntry.piece + ').', 'success');
  } catch (err) {
    toast('Contre-passation impossible : ' + errMsg(err), 'error');
  }
}

/** Imprimer une écriture en PDF (13/10/2026) : ouvre une vue imprimable. */
function printEntryPdf(idx) {
  const e = S.recentEntries[idx];
  if (!e) return;
  const lignes = e.lignes || [];
  const totalD = lignes.reduce((a, l) => a + (Number(l.debit) || 0), 0);
  const totalC = lignes.reduce((a, l) => a + (Number(l.credit) || 0), 0);
  const fmt = (n) => Number(n || 0).toLocaleString('fr-FR');
  const escH = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let rows = '';
  lignes.forEach((l) => {
    const lbl = l.libelle || syscohadaLabel(l.compte) || '';
    rows += '<tr><td>' + escH(l.compte) + '</td><td>' + escH(lbl) + '</td>'
      + '<td style="text-align:right;">' + (l.debit ? fmt(l.debit) : '') + '</td>'
      + '<td style="text-align:right;">' + (l.credit ? fmt(l.credit) : '') + '</td></tr>';
  });
  const html = '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>Écriture ' + escH(e.journal) + ' n°' + escH(e.piece) + '</title>'
    + '<style>body{font-family:Arial,sans-serif;margin:20px;color:#111;}'
    + 'h1{font-size:20px;margin-bottom:4px;}h2{font-size:14px;color:#555;margin-top:0;}'
    + 'table{width:100%;border-collapse:collapse;margin-top:16px;font-size:13px;}'
    + 'th,td{border:1px solid #999;padding:6px 8px;text-align:left;}'
    + 'th{background:#eef;}tfoot td{font-weight:bold;background:#f8f8f8;}'
    + '.meta{margin:12px 0;font-size:13px;}.meta span{display:inline-block;min-width:140px;color:#555;}'
    + '@media print{.noprint{display:none;}}</style></head><body>'
    + '<h1>Journal ' + escH(e.journal) + ' — Pièce n° ' + escH(e.piece) + '</h1>'
    + '<h2>' + escH(e.libelle) + '</h2>'
    + '<div class="meta"><div><span>Date :</span> ' + escH(e.date) + '</div>'
    + (e.doc ? '<div><span>Justificatif :</span> ' + escH(e.doc) + '</div>' : '')
    + '</div>'
    + '<table><thead><tr><th>Compte</th><th>Libellé</th><th style="text-align:right;">Débit</th><th style="text-align:right;">Crédit</th></tr></thead>'
    + '<tbody>' + rows + '</tbody>'
    + '<tfoot><tr><td colspan="2">Total</td><td style="text-align:right;">' + fmt(totalD) + '</td><td style="text-align:right;">' + fmt(totalC) + '</td></tr></tfoot></table>'
    + '<p style="font-size:11px;color:#888;margin-top:16px;">Document généré par FiscalMind Africa le ' + new Date().toLocaleDateString('fr-FR') + '</p>'
    + '<div class="noprint" style="margin-top:20px;"><button onclick="window.print()" style="padding:10px 24px;font-size:16px;">🖨️ Imprimer / Enregistrer en PDF</button></div>'
    + '<script>window.onload=function(){setTimeout(function(){window.print();},500);};</script>'
    + '</body></html>';
  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); }
  else toast('Popup bloqué : autorisez les popups.', 'error');
}

/** Voir le justificatif lié à une écriture (12/10/2026). */
async function viewRecentDoc(idx) {
  const e = S.recentEntries[idx];
  if (!e || !e.r2Key) { toast('Aucun document lié.', 'error'); return; }
  toast('Ouverture du document…', 'info');
  try {
    const r2 = await initR2();
    const { download_url } = await r2.getDownloadUrl({ key: e.r2Key });
    window.open(download_url, '_blank');
  } catch (err) {
    toast('Ouverture impossible : ' + errMsg(err), 'error');
  }
}

/** Modifier une écriture récente : la recharge dans l'éditeur (12/10/2026). */
async function editRecentEntry(idx) {
  const e = S.recentEntries[idx];
  if (!e) return;
  // Flexibilité (13/10/2026) : même validée, une écriture reste modifiable
  // Charger l'écriture dans l'éditeur
  S.entries = [JSON.parse(JSON.stringify(e))];
  S.editingRecent = true; // le retour revient à la liste, pas à l'analyse
  S.step = 'entries';
  render();
  toast('Écriture chargée pour modification.', 'info');
}

/** Supprimer une écriture récente (12/10/2026). */
async function deleteRecentEntry(idx) {
  const e = S.recentEntries[idx];
  if (!e) return;
  // Flexibilité (13/10/2026) : même validée, une écriture reste supprimable
  // MAIS : empêcher la suppression d'une écriture lettrée (13/10/2026)
  const isLettered = (e.lignes || []).some((l) => l.lettre);
  if (isLettered) {
    toast('Écriture lettrée : délettrez d\'abord (bouton Délettrer).', 'error');
    return;
  }
  const { confirmDialog } = await import('../ui.js');
  const ok = await confirmDialog('Supprimer l\'écriture ?', (e.libelle || '') + ' — ' + (e.date || ''), { okLabel: 'Supprimer', danger: true });
  if (!ok) return;
  try {
    const { deleteEntryById } = await import('../store.js');
    await deleteEntryById(e.id);
    // Fichier lié : supprimé aussi du cloud avec l'écriture (13/10/2026)
    if (e.r2Key) {
      try {
        const r2 = await initR2();
        await r2.deleteFile({ key: e.r2Key });
        toast('Écriture et fichier supprimés.', 'success');
      } catch (err) {
        console.error('[classeur] suppression R2:', err.message);
        toast('Écriture supprimée. Fichier non supprimé : ' + errMsg(err), 'error');
      }
    } else {
      toast('Écriture supprimée.', 'success');
    }
    await refreshRecentEntries();
    render();
  } catch (err) {
    toast('Suppression impossible : ' + errMsg(err), 'error');
  }
}

/**
 * Vérifie que les dettes fiscales à payer ont bien été constatées (12/10/2026).
 * Pour chaque compte 44x débité, contrôle le solde créditeur existant.
 * Retourne la liste des alertes (vide si tout est OK).
 */
async function checkTaxLiabilities(canonical) {
  const warnings = [];
  try {
    const { loadEntries } = await import('../store.js');
    const allEntries = await loadEntries();
    // Calculer les soldes par compte (crédit - débit pour les 44x)
    const balances = {};
    (allEntries || []).forEach((e) => {
      (e.lignes || []).forEach((l) => {
        const c = String(l.compte || '');
        if (!c.startsWith('44')) return;
        balances[c] = (balances[c] || 0) + (Number(l.credit) || 0) - (Number(l.debit) || 0);
      });
    });
    // Vérifier chaque ligne de paiement
    canonical.forEach((entry) => {
      (entry.lignes || []).forEach((l) => {
        const c = String(l.compte || '');
        const debit = Number(l.debit) || 0;
        if (!c.startsWith('44') || debit <= 0) return;
        const balance = balances[c] || 0;
        const label = l.libelle || c;
        if (balance <= 0) {
          warnings.push('• ' + label + ' (' + c + ') : aucune dette constatée, paiement de ' + debit.toLocaleString('fr-FR') + ' F sans dette au préalable.');
        } else if (balance < debit) {
          warnings.push('• ' + label + ' (' + c + ') : dette de ' + balance.toLocaleString('fr-FR') + ' F seulement, paiement de ' + debit.toLocaleString('fr-FR') + ' F.');
        }
      });
    });
  } catch (e) {
    console.error('[classeur] checkTaxLiabilities:', e.message);
  }
  return warnings;
}

function onFilePick(ev) {
  const f = ev.target.files && ev.target.files[0];
  if (!f) return;
  try {
    checkFileSize(f.size);
    checkMime(detectMime({ name: f.name, type: f.type }));
  } catch (e) {
    toast(errMsg(e), 'error');
    ev.target.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    S.file = { name: f.name, type: detectMime({ name: f.name, type: f.type }), size: f.size, dataUrl: String(reader.result) };
    toast('Fichier chargé : ' + f.name, 'success');
    render();
  };
  reader.onerror = () => toast('Lecture du fichier impossible.', 'error');
  reader.readAsDataURL(f);
}

async function archiveFile() {
  if (!S.file) return;
  const btn = $('#clArchive');
  btn.disabled = true;
  btn.textContent = 'Envoi en cours…';
  try {
    const r2 = await initR2();
    await r2.uploadFile({
      file: {
        name: S.file.name,
        type: S.file.type,
        size: S.file.size,
        body: dataUrlToBlob(S.file.dataUrl, S.file.type),
      },
      meta: { type: 'justificatif', date: new Date().toISOString().slice(0, 10), tag: 'classeur' },
      existingDocs: S.docs.map((d) => ({ size: d.size_bytes || d.size })),
    });
    toast('Justificatif archivé sur le cloud.', 'success');
    await refreshDocs();
  } catch (e) {
    toast('Archivage impossible : ' + errMsg(e), 'error');
  }
  render();
}

function dataUrlToBlob(dataUrl, mime) {
  const parts = String(dataUrl).split(',');
  const bin = atob(parts[1] || '');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** Nature des journaux et comptes attendus (13/10/2026) — contrôle de cohérence. */
const JOURNAL_NATURES = {
  AC: { label: 'Achats', comptes: ['40', '445', '6'] },
  VT: { label: 'Ventes', comptes: ['41', '443', '7'] },
  BQ: { label: 'Banque', comptes: ['51', '52'] },
  ES: { label: 'Caisse', comptes: ['57'] },
  PA: { label: 'Paie', comptes: ['42', '43', '44', '66'] },
  OD: { label: 'Opérations diverses', comptes: [] }, // tout accepté
  AN: { label: 'À-nouveaux', comptes: [] }, // tout accepté
};

/** Vérifie la cohérence comptes/journal. Retourne un avertissement ou ''. */
function checkJournalCoherence(entry) {
  const j = JOURNAL_NATURES[entry.journal];
  if (!j || !j.comptes.length) return '';
  const comptes = (entry.lignes || []).map((l) => String(l.compte || ''));
  const incoherents = comptes.filter((c) => !j.comptes.some((prefix) => c.startsWith(prefix)));
  if (incoherents.length && comptes.length) {
    return 'Journal ' + entry.journal + ' (' + j.label + ') : compte(s) inhabituel(s) ' + [...new Set(incoherents)].join(', ');
  }
  return '';
}

async function postEntries() {
  const canonical = S.entries.map(toCanonical);

  // Nouveau tiers -> création du sous-compte (401001, 411001…), port de fmClasseurPost.
  // Le sous-compte est enregistré au plan (validateEntry l'accepte) et persisté
  // en `fm_settings` (clé `tiers`) pour les prochaines sessions.
  const ext = S.ext || {};
  const tiersNom = String(ext.tiers || '').trim();
  const needTiers = ext.type !== 'impots' && tiersNom && tiersNom !== 'Tiers'
    && !isKnownTiers(S.tiers.map((t) => t.nom), tiersNom);
  let subCompte = null;
  if (needTiers) {
    const typeSel = document.getElementById('cl-tiers-type');
    const type = (typeSel && typeSel.value) || (ext.sens === 'vente' ? 'C' : 'F');
    const res = tiersAccountFor(S.tiers, tiersNom, type);
    if (res.isNew) {
      // Nouveau tiers détecté -> demander confirmation avant de créer le compte.
      const typeLabel = type === 'C' ? 'client' : 'fournisseur';
      const { confirmDialog: cd2 } = await import('../ui.js');
      const ok = await cd2(
        'Nouveau tiers : ' + tiersNom,
        'Créer le compte ' + res.compte + ' (' + typeLabel + ') ?',
        { okLabel: 'Créer le compte', cancelLabel: 'Compte collectif (' + (type === 'C' ? '411' : '401') + ')' }
      );
      if (ok) {
        const { registerSubAccount } = await import('../../../src/engine/chart-of-accounts.js');
        registerSubAccount(res.compte, (type === 'C' ? 'Clients — ' : 'Fournisseurs — ') + tiersNom);
        S.tiers = [...S.tiers, { nom: tiersNom, type, compte: res.compte }];
        try { await saveTiers(S.tiers); } catch (e) { /* non bloquant */ }
        toast('Nouveau tiers créé : ' + tiersNom + ' (' + res.compte + ')', 'success');
        subCompte = res.compte;
      } else {
        toast('Compte collectif utilisé (' + (type === 'C' ? '411' : '401') + ') — aucun tiers créé.', 'info');
      }
    } else {
      subCompte = res.compte;
    }
  }
  if (subCompte) {
    canonical.forEach((e) => e.lignes.forEach((l) => {
      if (l.compte === '401' || l.compte === '411') l.compte = subCompte;
    }));
  }

  // Traçabilité au document source (port de fmClasseurPost : doc: docName).
  const docName = S.file ? S.file.name : (S.demoName || '');
  if (docName) canonical.forEach((e) => { e.doc = docName; });

  // Avertir si aucun fichier n'est joint (12/10/2026) — le bouton "Voir" nécessite un fichier
  if (!S.file || !S.file.dataUrl) {
    const { confirmDialog: cd3 } = await import('../ui.js');
    const cont = await cd3(
      'Aucun document joint',
      'Aucun fichier n\'est sélectionné.\nL\'écriture sera passée SANS justificatif lié (pas de bouton "Voir").\n\nContinuer quand même ?',
      { okLabel: 'Continuer sans fichier', cancelLabel: 'Choisir un fichier' }
    );
    if (!cont) return;
  }

  // Upload automatique du fichier sur le cloud R2 (12/10/2026) — lié aux écritures
  let r2Key = null;
  if (S.file && S.file.dataUrl) {    try {
      const r2 = await initR2();
      const up = await r2.uploadFile({
        file: {
          name: S.file.name,
          type: S.file.type,
          size: S.file.size,
          body: dataUrlToBlob(S.file.dataUrl, S.file.type),
        },
        meta: { type: 'justificatif', date: new Date().toISOString().slice(0, 10), tag: 'classeur' },
        existingDocs: S.docs.map((d) => ({ size: d.size_bytes || d.size })),
      });
      r2Key = up.key;
      if (r2Key) canonical.forEach((e) => { e.r2Key = r2Key; });
      await refreshDocs();
    } catch (e) {
      console.error('[classeur] upload auto:', e.message);
      toast('Upload cloud échoué : ' + errMsg(e), 'error');
      // Non bloquant : les écritures passent même si l'upload échoue
    }
  }

  for (let i = 0; i < canonical.length; i++) {
    const v = validateEntry(canonical[i]);
    if (!v.ok) {
      toast('Écriture ' + (i + 1) + ' invalide : ' + v.errors[0], 'error');
      return;
    }
  }

  // Contrôle de cohérence journal/comptes (13/10/2026) — avertissement non bloquant
  const coherenceWarns = [];
  for (const e of canonical) {
    const w = checkJournalCoherence(e);
    if (w) coherenceWarns.push(w);
  }
  if (coherenceWarns.length) {
    const { confirmDialog: cd3 } = await import('../ui.js');
    const go = await cd3(
      'Cohérence des journaux',
      [...new Set(coherenceWarns)].join('\n') + '\n\nContinuer quand même ?',
      { okLabel: 'Continuer', cancelLabel: 'Corriger' }
    );
    if (!go) { render(); return; }
  }

  // Contrôle : pour un bordereau DGI, vérifier que les dettes fiscales existent (12/10/2026).
  // Les impôts doivent avoir été constatés (paie, factures) avant d'être payés.
  if (ext.type === 'impots' && !S.liabilityWarningShown) {
    const warnings = await checkTaxLiabilities(canonical);
    if (warnings.length > 0) {
      S.liabilityWarnings = warnings;
      S.liabilityWarningShown = true;
      render();
      // Faire défiler jusqu'à l'avertissement
      setTimeout(() => {
        const el = document.getElementById('clLiabilityWarn');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      return;
    }
  }
  S.liabilityWarningShown = false;
  S.liabilityWarnings = [];

  try {
    // Numérotation automatique des pièces par journal (13/10/2026) :
    // le numéro est calculé depuis les écritures EXISTANTES (max + 1 par journal).
    // Si aucune écriture, on commence à 1.
    const { loadEntries } = await import('../store.js');
    const allEntries = await loadEntries() || [];
    const maxByJournal = {};
    for (const en of allEntries) {
      const j = en.journal || 'OD';
      const n = parseInt(String(en.piece || '').replace(/\D/g, ''), 10);
      if (!isNaN(n)) maxByJournal[j] = Math.max(maxByJournal[j] || 0, n);
    }
    for (const e of canonical) {
      const journal = e.journal || 'OD';
      const next = (maxByJournal[journal] || 0) + 1;
      maxByJournal[journal] = next;
      e.piece = String(next);
      e.statut = 'brouillon'; // toute nouvelle écriture naît en brouillon (13/10/2026)
      await saveEntry(e);
    }
    toast(canonical.length + ' écriture(s) passée(s) au journal.', 'success');
    S.step = 'import'; S.ext = null; S.entries = []; S.demoName = ''; S.editingRecent = false;
    await refreshRecentEntries();
    await refreshDocs();
  } catch (e) {
    toast('Passation impossible : ' + errMsg(e), 'error');
    return;
  }
  render();
}

async function load() {
  shell().innerHTML = '<div class="loading-state">Chargement du classeur…</div>';
  try {
    try { S.tiers = await loadTiers(); } catch (e) { S.tiers = []; }
    // Ré-enregistrer les sous-comptes des tiers au plan (13/10/2026) — sinon leurs libellés sont perdus au rechargement
    try {
      const { registerSubAccount } = await import('../../../src/engine/chart-of-accounts.js');
      for (const t of (S.tiers || [])) {
        if (t.compte && t.nom) {
          registerSubAccount(t.compte, (t.type === 'C' ? 'Clients — ' : 'Fournisseurs — ') + t.nom);
        }
      }
    } catch (e) { /* non bloquant */ }
    await refreshRecentEntries();
    await refreshDocs();
    render();
  } catch (e) {
    shell().innerHTML = errorHtml(errMsg(e));
    const r = $('#classeurRetry');
    if (r) r.addEventListener('click', load);
  }
}

/** Charge les 10 dernières écritures pour consultation (12/10/2026). */
async function refreshRecentEntries() {
  try {
    const { loadEntries } = await import('../store.js');
    const all = await loadEntries();
    // Trier par date décroissante, prendre les 10 dernières
    S.recentEntries = (all || [])
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
      .slice(0, 10);
  } catch (e) {
    S.recentEntries = [];
  }
}

export function renderClasseurPage() {
  load();
}

// Réinitialise l'état local de la page (tests e2e).
export function __resetClasseurState() {
  S.step = 'import'; S.file = null; S.demoName = ''; S.ext = null; S.entries = [];
  S.tiers = []; S.ocrBusy = false;
}
