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
    const r2 = await initR2();
    const res = await r2.listDocs();
    const list = Array.isArray(res) ? res : (res && res.documents) || [];
    S.docs = list;
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
    h += '<div style="margin-top:8px;">' + S.docs.slice(0, 5).map((d) =>
      '<div class="muted-sm">• ' + esc(d.name || d.key || 'document')
      + ' <span class="muted">(' + fmtBytes(d.size_bytes || d.size) + ')</span></div>'
    ).join('') + (S.docs.length > 5 ? '<div class="muted-sm">… et ' + (S.docs.length - 5) + ' autres</div>' : '') + '</div>';
  }
  return h + '</div></div>';
}

/* ---------------- Rendu ---------------- */

function render() {
  let h = '<div data-testid="classeur-page">'
    + '<div class="page-head"><h2 class="page-title">📂 Classeur Intelligent</h2>'
    + '<p class="page-sub">Factures -> écritures, justificatifs archivés (1 Go)</p></div>'
    + docsHtml();

  if (S.step === 'import') h += importHtml();
  else if (S.step === 'review') h += reviewHtml();
  else h += entriesHtml();

  h += '</div>';
  shell().innerHTML = h;
  bind();
}

function importHtml() {
  return '<div class="card"><div class="card-body">'
    + '<h3 class="card-title" style="margin-bottom:8px;">Importer un document</h3>'
    + '<div class="notice-box">🤖 <strong>Lecture automatique (OCR) :</strong> choisissez votre fichier, cochez l’autorisation, puis lancez la lecture.'
    + ' Le texte détecté remplit automatiquement le champ ci-dessous. En cas d’échec, collez le texte manuellement.</div>'
    + '<input type="file" id="clFile" accept="image/*,application/pdf" class="form-input" data-testid="classeur-file" aria-label="Choisir un justificatif">'
    + (S.file ? '<p class="muted-sm" style="margin-top:8px;">📎 ' + esc(S.file.name) + ' (' + fmtBytes(S.file.size) + ')</p>' : '')
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
    + '<p class="muted-sm">Vérifiez chaque ligne avant de passer au journal. Contrôle d’équilibre débit = crédit.</p>';
  S.entries.forEach((entry, ei) => {
    const td = entry.lignes.reduce((a, l) => a + (Number(l.debit) || 0), 0);
    const tc = entry.lignes.reduce((a, l) => a + (Number(l.credit) || 0), 0);
    const ok = td === tc && td > 0;
    h += '<div style="border:1px solid var(--border);border-radius:12px;padding:10px;margin-bottom:10px;" data-testid="classeur-entry-' + ei + '">'
      + '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:8px;">'
      + '<strong style="font-size:13px;">' + esc(entry.journal) + ' · ' + esc(entry.libelle) + '</strong>'
      + '<span class="' + (ok ? 'badge-ok' : 'badge-ko') + '">' + (ok ? '✓ Équilibrée' : '✗ Déséquilibrée') + '</span></div>'
      + '<div class="form-grid-2" style="margin-bottom:6px;">'
      + '<label style="font-size:11px;">Date<input type="date" class="form-input" data-efield="date" data-ei="' + ei + '" value="' + esc(entry.date) + '"></label>'
      + '<label style="font-size:11px;">Pièce<input class="form-input" data-efield="piece" data-ei="' + ei + '" value="' + esc(entry.piece) + '"></label>'
      + '</div>'
      + '<label style="font-size:11px;">Libellé<input class="form-input" data-efield="libelle" data-ei="' + ei + '" value="' + esc(entry.libelle) + '"></label>'
      + entry.lignes.map((l, li) =>
        '<div class="line-edit" style="margin-top:6px;">'
        + '<div style="flex:1;min-width:0;"><input class="form-input" data-lfield="compte" data-ei="' + ei + '" data-li="' + li + '" value="' + esc(l.compte) + '" inputmode="numeric" aria-label="Compte">'
        + '<div class="sens-hint">' + esc(l.libelle || '') + '</div></div>'
        + '<div class="line-montants">'
        + '<input class="form-input" type="number" min="0" data-lfield="debit" data-ei="' + ei + '" data-li="' + li + '" value="' + (l.debit || '') + '" placeholder="Débit" aria-label="Débit">'
        + '<input class="form-input" type="number" min="0" data-lfield="credit" data-ei="' + ei + '" data-li="' + li + '" value="' + (l.credit || '') + '" placeholder="Crédit" aria-label="Crédit">'
        + '</div></div>'
      ).join('')
      + '<div class="muted-sm">Total débit : ' + td.toLocaleString('fr-FR') + ' F · Total crédit : ' + tc.toLocaleString('fr-FR') + ' F</div>'
      + '</div>';
  });
  h += '<div style="display:flex;gap:8px;flex-wrap:wrap;">'
    + '<button class="btn btn-secondary" id="clBack2" style="flex:1;justify-content:center;">← Retour</button>'
    + '<button class="btn btn-primary" id="clPost" data-testid="classeur-post" style="flex:2;justify-content:center;">Passer les écritures</button>'
    + '</div></div></div>';
  return h;
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
  S.ext = extractInvoiceData(text, S.file ? S.file.name : (S.demoName || ''));
  S.step = 'review';
  render();
}

/**
 * Lecture OCR automatique via l'Edge Function `ocr` (port de fmOcrOnline,
 * sans clé en dur : JWT + consentement explicite). 2 tentatives, puis
 * repli gracieux sur le collage manuel du texte.
 */
async function ocrRead() {
  if (S.ocrBusy) return;
  if (!S.file || !S.file.dataUrl) { toast("Choisissez d'abord un fichier à lire.", 'error'); return; }
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
  S.ocrBusy = true;
  render();
  let lastErr = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { text } = await ocrSvc.requestOcr({
        accessToken: token, dataUrl: S.file.dataUrl, language: 'fre', consent: true,
      });
      S.ocrBusy = false;
      render(); // réactive le bouton
      const ta = document.getElementById('clText');
      if (ta) ta.value = text;
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
    $('#clBack2').addEventListener('click', () => { S.step = 'review'; render(); });
    shell().querySelectorAll('[data-efield]').forEach((inp) =>
      inp.addEventListener('input', () => {
        S.entries[Number(inp.dataset.ei)][inp.dataset.efield] = inp.value;
      }));
    shell().querySelectorAll('[data-lfield]').forEach((inp) =>
      inp.addEventListener('input', () => {
        const line = S.entries[Number(inp.dataset.ei)].lignes[Number(inp.dataset.li)];
        line[inp.dataset.lfield] = inp.dataset.lfield === 'compte' ? inp.value.trim() : Math.round(Number(inp.value) || 0);
      }));
    // Re-rendu léger des badges d'équilibre à chaque saisie
    shell().querySelectorAll('[data-lfield]').forEach((inp) =>
      inp.addEventListener('change', () => { render(); }));
    $('#clPost').addEventListener('click', postEntries);
  }
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
      const ok = window.confirm(
        'Nouveau tiers détecté : ' + tiersNom + '\n\n' +
        'Créer le compte ' + res.compte + ' (' + typeLabel + ') ?\n\n' +
        'OK = créer le compte tiers\n' +
        'Annuler = utiliser le compte collectif (' + (type === 'C' ? '411' : '401') + ')'
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

  for (let i = 0; i < canonical.length; i++) {
    const v = validateEntry(canonical[i]);
    if (!v.ok) {
      toast('Écriture ' + (i + 1) + ' invalide : ' + v.errors[0], 'error');
      return;
    }
  }
  try {
    for (const e of canonical) await saveEntry(e);
    toast(canonical.length + ' écriture(s) passée(s) au journal.', 'success');
    S.step = 'import'; S.ext = null; S.entries = []; S.demoName = '';
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
    await refreshDocs();
    render();
  } catch (e) {
    shell().innerHTML = errorHtml(errMsg(e));
    const r = $('#classeurRetry');
    if (r) r.addEventListener('click', load);
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
