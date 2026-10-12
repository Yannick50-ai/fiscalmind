// FiscalMind Africa — page Convertisseur (#/convertisseur).
//
// Conversion NGN/USD/EUR/GBP <-> XOF sur des taux de référence MODIFIABLES,
// stockés en fm_settings (clé 'fx_rates'). Aucune API externe (comme l'ancien
// site) : les taux sont indicatifs et ajustables par l'utilisateur.

import { esc, $, toast } from '../ui.js';
import { loadFxRates, saveFxRates, CloudError } from '../store.js';
import {
  FX_CURRENCIES, FX_SYMBOLS, DEFAULT_FX_RATES, fxRate, convert, sanitizeFxRates,
} from '../../../src/engine/convertisseur.js';

const S = { rates: null, edit: false };

function shell() { return document.getElementById('appMain'); }

function errorHtml(msg) {
  return '<div class="error-state" data-testid="fx-error">'
    + '<div class="error-icon">⚠️</div><p>' + esc(msg) + '</p>'
    + '<button class="btn btn-primary" data-testid="fx-retry" id="fxRetry">Réessayer</button></div>';
}

function errMsg(e) {
  return e instanceof CloudError ? e.message : 'Erreur inattendue.';
}

function fmtNum(n) {
  return Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function render() {
  const cur = (id) => { const el = $(id); return el ? el.value : null; };
  const keepAmount = cur('#fxAmount');
  const keepFrom = cur('#fxFrom');
  const keepTo = cur('#fxTo');

  let h = '<div data-testid="fx-page">'
    + '<div class="page-head"><h2 class="page-title">💱 Convertisseur</h2>'
    + '<p class="page-sub">Taux de référence modifiables (indicatifs)</p></div>'

    + '<div class="card" style="margin-bottom:12px;"><div class="card-body">'
    + '<div class="form-grid-2" style="align-items:end;">'
    + '<label style="font-size:12px;">Devise<select id="fxFrom" class="form-input" data-testid="fx-from">'
    + FX_CURRENCIES.map((c) => '<option value="' + c + '"' + (c === (keepFrom || 'XOF') ? ' selected' : '') + '>' + c + ' ' + FX_SYMBOLS[c] + '</option>').join('')
    + '</select></label>'
    + '<label style="font-size:12px;">Montant<input id="fxAmount" type="number" min="0" class="form-input" data-testid="fx-amount" value="' + esc(keepAmount || '1000000') + '"></label>'
    + '</div>'
    + '<div style="text-align:center;margin:8px 0;font-size:20px;">⬇</div>'
    + '<div class="form-grid-2" style="align-items:end;">'
    + '<label style="font-size:12px;">Devise<select id="fxTo" class="form-input" data-testid="fx-to">'
    + FX_CURRENCIES.map((c) => '<option value="' + c + '"' + (c === (keepTo || 'EUR') ? ' selected' : '') + '>' + c + ' ' + FX_SYMBOLS[c] + '</option>').join('')
    + '</select></label>'
    + '<label style="font-size:12px;">Résultat<input id="fxResult" class="form-input" data-testid="fx-result" readonly style="background:var(--bg-light);font-weight:700;"></label>'
    + '</div>'
    + '<div class="muted-sm" style="margin-top:8px;" data-testid="fx-rateinfo" id="fxRateInfo"></div>'
    + '<button class="btn btn-secondary" id="fxSwap" style="margin-top:10px;width:100%;justify-content:center;">⇄ Inverser</button>'
    + '</div></div>'

    + '<div class="card"><div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">'
    + '<h3 class="card-title">📋 Taux de référence</h3>'
    + '<button class="btn btn-secondary btn-sm" id="fxEdit" data-testid="fx-edit">' + (S.edit ? 'Terminer' : 'Modifier') + '</button>'
    + '</div><div class="card-body">'
    + '<p class="muted-sm" style="margin-top:0;">1 unité de devise = X XOF. Modifiez un taux puis « Terminer » pour l’enregistrer.</p>'
    + '<div class="table-wrap"><table class="etats-table"><thead><tr><th>Devise</th><th class="num">Taux → XOF</th></tr></thead><tbody>'
    + FX_CURRENCIES.filter((c) => c !== 'XOF').map((c) =>
      '<tr><td><strong>' + c + '</strong> ' + FX_SYMBOLS[c] + '</td><td class="num">'
      + (S.edit
        ? '<input class="form-input" data-fxrate="' + c + '" type="number" min="0" step="any" value="' + S.rates[c].XOF + '" style="width:130px;text-align:right;">'
        : fmtNum(S.rates[c].XOF))
      + '</td></tr>').join('')
    + '</tbody></table></div>'
    + (S.edit ? '<button class="btn btn-primary" id="fxSave" data-testid="fx-save" style="width:100%;justify-content:center;margin-top:8px;">Enregistrer les taux</button>' : '')
    + '</div></div></div>';

  shell().innerHTML = h;
  const update = () => {
    const amount = Number($('#fxAmount').value) || 0;
    const from = $('#fxFrom').value;
    const to = $('#fxTo').value;
    const r = fxRate(S.rates, from, to);
    const res = convert(amount, from, to, S.rates);
    $('#fxResult').value = res === null ? '—' : fmtNum(res);
    $('#fxRateInfo').textContent = r === null
      ? 'Taux indisponible pour cette paire.'
      : '1 ' + from + ' = ' + r + ' ' + to + ' · taux de référence (indicatif)';
  };
  $('#fxAmount').addEventListener('input', update);
  $('#fxFrom').addEventListener('change', update);
  $('#fxTo').addEventListener('change', update);
  $('#fxSwap').addEventListener('click', () => {
    const f = $('#fxFrom'), t = $('#fxTo');
    const tmp = f.value; f.value = t.value; t.value = tmp;
    update();
  });
  update();
  $('#fxEdit').addEventListener('click', () => { S.edit = !S.edit; render(); });
  const saveBtn = $('#fxSave');
  if (saveBtn) saveBtn.addEventListener('click', async () => {
    const raw = {};
    shell().querySelectorAll('[data-fxrate]').forEach((inp) => {
      const c = inp.dataset.fxrate;
      raw[c] = { XOF: Number(inp.value) };
    });
    // Reconstruit la matrice complète : on ne modifie que les taux -> XOF,
    // les croisements sont recalculés par proportion.
    const base = JSON.parse(JSON.stringify(S.rates));
    Object.keys(raw).forEach((c) => {
      const v = Number(raw[c].XOF);
      if (v > 0) base[c].XOF = v;
    });
    S.rates = sanitizeFxRates(completeMatrix(base), S.rates);
    try {
      await saveFxRates(S.rates);
      toast('Taux enregistrés.', 'success');
    } catch (e) { toast('Sauvegarde impossible : ' + errMsg(e), 'error'); }
    S.edit = false;
    render();
  });
}

/** Complète la matrice : XOF->c = 1/(c->XOF), croisements par proportion. */
function completeMatrix(base) {
  const out = JSON.parse(JSON.stringify(base));
  for (const c of FX_CURRENCIES) {
    out[c] = out[c] || {};
    out.XOF[c] = c === 'XOF' ? 1 : 1 / out[c].XOF;
    out[c].XOF = c === 'XOF' ? 1 : out[c].XOF;
  }
  for (const a of FX_CURRENCIES) {
    for (const b of FX_CURRENCIES) {
      if (a !== b && !(out[a][b] > 0)) {
        out[a][b] = out[a].XOF / out[b].XOF;
      }
    }
  }
  return out;
}

async function load() {
  shell().innerHTML = '<div class="loading-state">Chargement des taux…</div>';
  try {
    const saved = await loadFxRates();
    S.rates = sanitizeFxRates(saved || DEFAULT_FX_RATES, DEFAULT_FX_RATES);
    S.edit = false;
    render();
  } catch (e) {
    shell().innerHTML = errorHtml(errMsg(e));
    const r = $('#fxRetry');
    if (r) r.addEventListener('click', load);
  }
}

export function renderConvertisseurPage() {
  load();
}
