// FiscalMind Africa — page Lettrage (#/lettrage, protégée).
//
// Lettrage des comptes de tiers (classe 4) : la logique pure vit dans
// src/engine/lettrage.js (port de renderLettrage / fmLettrerGroupe /
// fmDelettrerLettre / fmNextLettre du source). Ici : cases à cocher par
// écriture, boutons Lettrer/Délettrer (lettres auto A, B, C…), filtre
// « Non lettrées », clic sur un tiers → balance + grand livre du compte.

import { esc, fmt, fmtDate, toast, $, $all } from '../ui.js';
import { loadEntries, saveEntry } from '../store.js';
import { isDemoMode, getDemoEntries, demoBannerHtml, wireDemoExit } from '../demo-mode.js';
import { toLines } from '../../../src/engine/journal.js';
import { getAccount } from '../../../src/engine/chart-of-accounts.js';
import { generalLedger } from '../../../src/engine/general-ledger.js';
import {
  toMouvements, groupByTiers, unlettered, usedLetters, nextLetter,
  groupBalance, groupTotals, validateLettering, letterEntries,
  unletterEntries, letterOf, autoLetterEntries,
} from '../../../src/engine/lettrage.js';

const S = {
  entries: [], groups: {}, onlyUnlettered: false, detail: null,
};

function shell() { return document.getElementById('appMain'); }

function accountLabel(compte) {
  const a = getAccount(compte);
  return a ? a.intitule : 'Compte ' + compte;
}

function refresh() {
  S.groups = groupByTiers(toMouvements(S.entries));
}

function fmtN(n) {
  const v = Math.round(Number(n) || 0);
  return v === 0 ? '0,00' : fmt(v);
}

function render() {
  const comptes = Object.keys(S.groups).sort()
    .filter((c) => !S.onlyUnlettered || unlettered(S.groups[c]).length > 0);
  const totalGroupes = Object.keys(S.groups).length;
  const demo = isDemoMode();

  let h = '<div data-testid="lettrage-page">'
    + (demo ? demoBannerHtml() : '')
    + '<div class="page-head"><h2 class="page-title">🔗 Lettrage</h2>'
    + '<p class="page-sub">Comptes de tiers (classe 4) — rapprochez les écritures qui se compensent.</p></div>'
    + (demo ? '' : '<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">'
    + '<button class="btn btn-primary" id="autoLetterBtn" data-testid="auto-letter">✨ Lettrage automatique</button></div>')
    + '<label class="filter-check" style="display:flex;align-items:center;gap:8px;margin:0 0 12px;font-size:14px;">'
    + '<input type="checkbox" data-testid="filter-unlettered"' + (S.onlyUnlettered ? ' checked' : '')
    + ' style="width:18px;height:18px;accent-color:var(--primary);"> Afficher uniquement les comptes non lettrés</label>';

  if (!comptes.length) {
    h += '<div class="empty-state"><div style="font-size:40px;">🔗</div><div>'
      + (totalGroupes
        ? 'Tous les comptes de tiers sont lettrés ✓'
        : 'Aucune écriture sur des comptes de tiers pour le moment.')
      + '</div></div>';
  }

  h += comptes.map((c) => {
    const g = S.groups[c];
    const bal = groupBalance(g);
    const lettres = usedLetters(g);
    const nl = unlettered(g);
    let card = '<div class="card" style="margin-bottom:16px;" data-testid="tiers-card-' + esc(c) + '">'
      + '<div class="card-header"><h3 class="card-title">'
      + '<a href="javascript:void(0)" data-tier="' + esc(c) + '" data-testid="tier-link-' + esc(c) + '"'
      + ' style="color:var(--primary);text-decoration:underline;">' + esc(c) + ' — ' + esc(accountLabel(c)) + '</a>'
      + '</h3><span style="font-size:12px;color:var(--text-muted);">Solde non lettré : <strong>'
      + esc(fmtN(bal.solde)) + '</strong></span></div><div class="card-body">';
    if (nl.length) {
      card += '<div style="overflow-x:auto;"><table class="financial-table"><thead><tr>'
        + '<th></th><th>Date</th><th>Libellé</th>'
        + '<th style="text-align:right;">Débit</th><th style="text-align:right;">Crédit</th>'
        + '</tr></thead><tbody>'
        + nl.map((m) => '<tr><td><input type="checkbox" class="lt-sel" data-c="' + esc(c) + '"'
          + ' value="' + esc(m.entryId) + '|' + m.lineIndex + '"'
          + ' style="width:18px;height:18px;accent-color:var(--primary);" aria-label="Sélectionner"></td>'
          + '<td style="white-space:nowrap;">' + esc(fmtDate(m.date)) + '</td>'
          + '<td>' + esc(m.libelle) + '</td>'
          + '<td style="text-align:right;white-space:nowrap;">' + esc(fmtN(m.debit)) + '</td>'
          + '<td style="text-align:right;white-space:nowrap;">' + esc(fmtN(m.credit)) + '</td></tr>').join('')
        + '</tbody></table></div>'
        + (isDemoMode() ? '' : '<button class="btn btn-primary btn-sm" style="margin-top:10px;" data-letter="' + esc(c) + '"'
        + ' data-testid="letter-btn-' + esc(c) + '">Lettrer la sélection ✓</button>');
    } else {
      card += '<p style="font-size:13px;color:var(--text-muted);margin:0;" data-testid="all-lettered-' + esc(c) + '">'
        + 'Tout est lettré sur ce compte ✓</p>';
    }
    if (lettres.length) {
      card += '<div style="margin-top:10px;">' + lettres.map((L) => {
        const n = g.filter((m) => m.lettre === L).length;
        return '<span class="event-badge" style="background:#dbeafe;color:#1e40af;margin:0 6px 6px 0;display:inline-block;"'
          + ' data-testid="letter-badge-' + esc(c) + '-' + esc(L) + '">'
          + esc(L) + ' (' + n + ') <a href="javascript:void(0)" data-unletter="' + esc(c) + '|' + esc(L) + '"'
          + ' data-testid="unletter-' + esc(c) + '-' + esc(L) + '"'
          + ' style="color:#1e40af;margin-left:4px;" title="Délettrer">✕</a></span>';
      }).join('') + '</div>';
    }
    return card + '</div></div>';
  }).join('');

  // Détail tiers : balance + grand livre du compte
  if (S.detail) {
    h += renderDetail(S.detail);
  }

  shell().innerHTML = h + '</div>';
  bind();
  if (isDemoMode()) wireDemoExit();
}

function renderDetail(compte) {
  const g = S.groups[compte] || [];
  const tot = groupTotals(g);
  const gl = generalLedger(toLines(S.entries), compte, {});
  const a = getAccount(compte);
  let h = '<div class="card" style="margin:4px 0 24px;border:2px solid var(--primary);" data-testid="tier-detail">'
    + '<div class="card-header"><h3 class="card-title">👤 ' + esc(compte) + ' — '
    + esc(a ? a.intitule : 'Compte ' + compte) + '</h3>'
    + '<button class="btn btn-secondary btn-sm" data-close-detail>Fermer</button></div>'
    + '<div class="card-body">'
    + '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:14px;">'
    + '<div style="background:var(--bg-light);border-radius:10px;padding:10px;text-align:center;">'
    + '<small style="color:var(--text-muted);">Total débit</small><br><strong>' + esc(fmtN(tot.debit)) + '</strong></div>'
    + '<div style="background:var(--bg-light);border-radius:10px;padding:10px;text-align:center;">'
    + '<small style="color:var(--text-muted);">Total crédit</small><br><strong>' + esc(fmtN(tot.credit)) + '</strong></div>'
    + '<div style="background:var(--bg-light);border-radius:10px;padding:10px;text-align:center;">'
    + '<small style="color:var(--text-muted);">Solde ' + (tot.solde >= 0 ? 'débiteur' : 'créditeur') + '</small><br><strong>'
    + esc(fmtN(Math.abs(tot.solde))) + '</strong></div></div>';
  if (gl.rows.length) {
    h += '<div style="overflow-x:auto;"><table class="financial-table"><thead><tr>'
      + '<th>Date</th><th>Libellé</th>'
      + '<th style="text-align:right;">Débit</th><th style="text-align:right;">Crédit</th>'
      + '<th style="text-align:right;">Solde</th><th style="text-align:center;">Let.</th>'
      + '</tr></thead><tbody>'
      + gl.rows.map((r) => {
        const lettre = (g.find((m) => m.entryId === r.id && m.compte === compte) || {}).lettre || '';
        return '<tr><td style="white-space:nowrap;">' + esc(fmtDate(r.date)) + '</td>'
          + '<td>' + esc(r.libelle) + '</td>'
          + '<td style="text-align:right;white-space:nowrap;">' + esc(fmtN(r.debit)) + '</td>'
          + '<td style="text-align:right;white-space:nowrap;">' + esc(fmtN(r.credit)) + '</td>'
          + '<td style="text-align:right;white-space:nowrap;"><strong>' + esc(fmtN(r.solde)) + '</strong></td>'
          + '<td style="text-align:center;">' + esc(lettre) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  } else {
    h += '<p style="font-size:13px;color:var(--text-muted);">Aucune écriture.</p>';
  }
  return h + '</div></div>';
}

function bind() {
  const f = $('[data-testid="filter-unlettered"]', shell());
  if (f) f.addEventListener('change', () => { S.onlyUnlettered = f.checked; render(); });

  const autoBtn = $('#autoLetterBtn', shell());
  if (autoBtn) autoBtn.addEventListener('click', async () => {
    autoBtn.disabled = true;
    autoBtn.textContent = '⏳ Lettrage en cours…';
    try {
      const entries = await loadEntries();
      const { entries: updated, matched } = autoLetterEntries(entries);
      if (matched === 0) {
        toast('Aucune écriture à rapprocher automatiquement.', 'info');
      } else {
        // Sauvegarder les écritures modifiées
        for (const e of updated) {
          const orig = entries.find((o) => (o.id || o.ref) === (e.id || e.ref));
          if (orig && JSON.stringify(orig.lignes) !== JSON.stringify(e.lignes)) {
            await saveEntry(e);
          }
        }
        toast(matched + ' écriture(s) lettrée(s) automatiquement !', 'success');
      }
      render();
    } catch (err) {
      toast(err.message || 'Échec du lettrage automatique.', 'error');
      autoBtn.disabled = false;
      autoBtn.textContent = '✨ Lettrage automatique';
    }
  });

  $all('[data-tier]', shell()).forEach((a) => {
    a.addEventListener('click', () => {
      S.detail = S.detail === a.dataset.tier ? null : a.dataset.tier;
      render();
      const d = $('[data-testid="tier-detail"]', shell());
      if (d) d.scrollIntoView({ block: 'nearest' });
    });
  });
  const close = $('[data-close-detail]', shell());
  if (close) close.addEventListener('click', () => { S.detail = null; render(); });

  $all('[data-letter]', shell()).forEach((btn) => {
    btn.addEventListener('click', async () => {
      const c = btn.dataset.letter;
      const sel = $all('.lt-sel[data-c="' + c + '"]:checked', shell()).map((x) => {
        const [entryId, lineIndex] = x.value.split('|');
        return (S.groups[c] || []).find((m) => m.entryId === entryId && String(m.lineIndex) === lineIndex);
      }).filter(Boolean);
      const v = validateLettering(sel);
      if (!v.ok) { toast(v.errors[0], 'error'); return; }
      const L = nextLetter(S.groups[c]);
      const before = S.entries;
      S.entries = letterEntries(S.entries, sel, L);
      btn.disabled = true;
      try {
        await persistChanged(before, S.entries);
      } catch (err) {
        btn.disabled = false;
        toast(err.message || 'Lettrage impossible.', 'error');
        return;
      }
      refresh();
      render();
      toast(sel.length + ' écritures lettrées (' + L + ')', 'success');
    });
  });

  $all('[data-unletter]', shell()).forEach((a) => {
    a.addEventListener('click', async () => {
      const [c, L] = a.dataset.unletter.split('|');
      const before = S.entries;
      const { entries, count } = unletterEntries(S.entries, c, L);
      S.entries = entries;
      try {
        await persistChanged(before, S.entries);
      } catch (err) {
        toast(err.message || 'Délettrage impossible.', 'error');
        return;
      }
      refresh();
      render();
      toast('Lettrage ' + L + ' retiré (' + count + ')', 'success');
    });
  });
}

export async function renderLettragePage() {
  S.detail = null;
  shell().innerHTML = '<div class="loading-state">Chargement du lettrage…</div>';
  try {
    S.entries = isDemoMode() ? await getDemoEntries() : await loadEntries();
  } catch (err) {
    shell().innerHTML = '<div class="error-state" data-testid="lettrage-error">'
      + '<div class="error-icon">⚠️</div><p>' + esc(err.message || 'Erreur de chargement.') + '</p>'
      + '<button class="btn btn-primary" id="lettrageRetry">Réessayer</button></div>';
    document.getElementById('lettrageRetry').addEventListener('click', () => renderLettragePage());
    return;
  }
  refresh();
  render();
}

/** Persiste les écritures modifiées par une opération de lettrage (diff par id). */
async function persistChanged(before, after) {
  const beforeById = new Map((before || []).map((e) => [e.id, e]));
  const changed = (after || []).filter((e) => {
    const b = beforeById.get(e.id);
    return !b || JSON.stringify(b.lignes) !== JSON.stringify(e.lignes);
  });
  for (const e of changed) {
    await saveEntry(e);
  }
}
