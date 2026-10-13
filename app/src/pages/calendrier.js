// FiscalMind Africa — page Calendrier fiscal (#/calendrier).
//
// Les 435 échéances viennent de src/data/calendars.js, les fiches
// stratégiques de src/data/fiches.js. Vue mensuelle avec pastilles par jour,
// liste des échéances du mois, clic sur une échéance -> fiche stratégique
// (périodicité, taux, échéance, pénalités, base, conseil).
// Pays : sélecteur parmi les 17 pays OHADA (défaut BF, persisté sur le serveur).

import { esc, $, $all, toast } from '../ui.js';
import { loadCountry, saveCountry, getEffectiveCnssFrequency, loadTvaSubject, loadBicPrelevement } from '../store.js';
import { getCountry, countryCodes } from '../../../src/data/countries.js';
import { getMonthDeadlines } from '../../../src/data/calendars.js';
import { isDemoMode, demoBannerHtml, wireDemoExit } from '../demo-mode.js';
import { getFiche } from '../../../src/data/fiches.js';

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet',
  'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

const S = { code: 'BF', year: 0, month: 0, cnssFreq: 'trimestrielle', tvaSubject: true, bicPrelevement: false };

/** Échéances CNSS dynamiques selon la fréquence configurée (12/10/2026).
 *  Mensuelle (≥ 20 salariés) : le 15 de chaque mois.
 *  Trimestrielle (< 20 salariés) : 30/04, 31/07, 31/10, 31/01. */
function cnssDeadlines(mois) {
  const out = [];
  if (S.cnssFreq === 'mensuelle') {
    out.push({ mois, jour: 15, label: 'Déclaration + paiement CNSS', impot: 'SOC', periodicite: 'Mensuelle (≥ 20 salariés)' });
  } else {
    const trim = { 4: 30, 7: 31, 10: 31, 1: 31 };
    if (trim[mois]) {
      out.push({ mois, jour: trim[mois], label: 'Déclaration + paiement CNSS', impot: 'SOC', periodicite: 'Trimestrielle (< 20 salariés)' });
    }
  }
  return out;
}

/** Corrections BF d'après la DGI (bordereau eSINTAX sept. 2026, 12/10/2026) :
 *  - IUTS/TPA/FSP : le 12 du mois (pas le 10) — le « 10 » est obsolète
 *  - TVA : le 15 du mois (pas le 25) — masquée si l'entreprise n'est pas assujettie
 *  - TPA, FSP, timbres, retenues foncières : absents → ajoutés
 *  - Prélèvements BIC : affichés seulement si l'entreprise les applique
 *  Le fichier calendars.js est généré (ne pas éditer), on corrige ici. */
function bfMonthlyFixes(mois) {
  if (S.code !== 'BF') return [];
  const out = [
    { mois, jour: 12, label: 'Déclaration IUTS', impot: 'SAL', periodicite: 'Mensuelle (retenue à la source)' },
    { mois, jour: 12, label: 'Taxe patronale d\u2019apprentissage (TPA)', impot: 'SAL', periodicite: 'Mensuelle — 3 % masse salariale' },
    { mois, jour: 12, label: 'FSP — Fonds de Soutien Patriotique', impot: 'SAL', periodicite: 'Mensuelle — 1 % du salaire net' },
    { mois, jour: 15, label: 'Droits de timbres sur états', impot: 'TIMBRE', periodicite: 'Mensuelle' },
    { mois, jour: 15, label: 'Retenues sur revenus fonciers', impot: 'FONCIER', periodicite: 'Mensuelle (retenue à la source)' },
  ];
  if (S.tvaSubject) {
    out.push({ mois, jour: 15, label: 'Déclaration TVA', impot: 'TVA', periodicite: 'Mensuelle' });
  }
  if (S.bicPrelevement) {
    out.push({ mois, jour: 15, label: 'Prélèvements BIC (acomptes)', impot: 'BIC', periodicite: 'Mensuelle (retenue à la source)' });
  }
  return out;
}

/** Labels statiques BF à remplacer par les échéances corrigées. */
function isBfReplaced(label) {
  if (S.code !== 'BF') return false;
  return /^(déclaration iuts|déclaration tva|tpa|fsp|cnss|droits de timbres|prélèvements|retenues sur revenus)/i.test(label || '');
}

function shell() { return document.getElementById('appMain'); }

function impotBadge(impot) {
  const colors = {
    TVA: '#dbeafe;color:#1e40af', IS: '#dcfce7;color:#166534', SAL: '#fef3c7;color:#92400e',
    SOC: '#fae8ff;color:#86198f', ANNUEL: '#ffedd5;color:#9a3412',
    TIMBRE: '#e0e7ff;color:#3730a3', BIC: '#d1fae5;color:#065f46', FONCIER: '#fce7f3;color:#9d174d',
  };
  const style = colors[impot] || '#f1f5f9;color:#475569';
  return '<span class="event-badge" style="background:' + style.split(';')[0] + ';color:'
    + style.split(';')[1] + ';font-size:11px;">' + esc(impot) + '</span>';
}

function render() {
  const country = getCountry(S.code) || getCountry('BF');
  const staticDeadlines = getMonthDeadlines(S.code, S.month + 1);
  // Remplacer les échéances CNSS statiques par les dynamiques (fréquence configurée)
  // + corrections BF d'après la DGI (IUTS/TPA/FSP au 12, TVA au 15)
  const deadlines = staticDeadlines.filter((d) => !/cnss/i.test(d.label || '') && !isBfReplaced(d.label))
    .concat(cnssDeadlines(S.month + 1))
    .concat(bfMonthlyFixes(S.month + 1));
  const byDay = {};
  deadlines.forEach((d) => { (byDay[d.jour] = byDay[d.jour] || []).push(d); });

  const first = new Date(S.year, S.month, 1);
  const startOffset = (first.getDay() + 6) % 7; // lundi = 0
  const daysInMonth = new Date(S.year, S.month + 1, 0).getDate();
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === S.year && today.getMonth() === S.month;

  let cells = '';
  for (let i = 0; i < startOffset; i++) cells += '<div class="cal-day cal-empty"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const list = byDay[d] || [];
    const isToday = isCurrentMonth && today.getDate() === d;
    cells += '<div class="cal-day' + (isToday ? ' cal-today' : '') + (list.length ? ' cal-has' : '') + '"'
      + (list.length ? ' data-day="' + d + '" data-testid="cal-day-' + d + '" role="button" tabindex="0"' : '')
      + '><span class="cal-num">' + d + '</span>'
      + (list.length
        ? '<span class="cal-dots">' + list.slice(0, 3).map(() => '<i></i>').join('')
          + (list.length > 3 ? '<em>+' + (list.length - 3) + '</em>' : '') + '</span>'
        : '')
      + '</div>';
  }

  let h = '<div data-testid="calendrier-page">'
    + (isDemoMode() ? demoBannerHtml() : '')
    + '<div class="page-head"><h2 class="page-title">📅 Calendrier fiscal</h2>'
    + '<p class="page-sub">Échéances fiscales — ' + esc(country.nom) + '</p></div>'

    + '<div class="cal-controls">'
    + '<select data-testid="cal-country" class="form-input" style="flex:1;min-width:0;" aria-label="Pays">'
    + countryCodes().map((code) => {
      const c = getCountry(code);
      return '<option value="' + esc(code) + '"' + (code === S.code ? ' selected' : '') + '>'
        + esc(c ? c.nom : code) + '</option>';
    }).join('') + '</select>'
    + '<div class="cal-monthnav">'
    + '<button class="btn btn-secondary btn-sm" data-testid="cal-prev" aria-label="Mois précédent">‹</button>'
    + '<strong data-testid="cal-title">' + MONTHS[S.month] + ' ' + S.year + '</strong>'
    + '<button class="btn btn-secondary btn-sm" data-testid="cal-next" aria-label="Mois suivant">›</button>'
    + '</div></div>'

    + '<div class="cal-grid" data-testid="cal-grid">'
    + DAYS.map((d) => '<div class="cal-dow">' + d + '</div>').join('')
    + cells + '</div>'

    + '<h3 class="section-title" style="margin:18px 0 8px;">Échéances du mois (' + deadlines.length + ')</h3>';

  if (!deadlines.length) {
    h += '<div class="empty-state"><div style="font-size:36px;">📅</div>'
      + '<div>Aucune échéance répertoriée pour ce mois dans ce pays.</div></div>';
  } else {
    h += '<div class="cal-list">' + deadlines.slice().sort((a, b) => a.jour - b.jour).map((d, i) =>
      '<button class="cal-item" data-fiche="' + i + '" data-testid="cal-item-' + d.jour + '-' + i + '">'
      + '<span class="cal-item-day">' + d.jour + '</span>'
      + '<span class="cal-item-body"><strong>' + esc(d.label) + '</strong>'
      + '<small>' + esc(d.periodicite || '') + '</small></span>'
      + impotBadge(d.impot) + '</button>'
    ).join('') + '</div>';
  }

  h += '<div id="ficheModal"></div></div>';
  shell().innerHTML = h;
  // garde les données pour le gestionnaire de clic fiche
  shell()._deadlines = deadlines;
  bind();
  if (isDemoMode()) wireDemoExit();
}

function openFiche(d) {
  const fiche = getFiche(S.code, d.impot);
  const box = $('#ficheModal', shell());
  if (!box) return;
  let body;
  if (fiche) {
    const row = (k, v) => v
      ? '<div class="fiche-row"><span class="fiche-k">' + k + '</span><span>' + esc(v) + '</span></div>' : '';
    body = '<h3 style="margin:0 0 10px;">' + esc(fiche.nom) + '</h3>'
      + '<div class="fiche-grid">'
      + row('Périodicité', fiche.periodicite)
      + row('Taux', fiche.taux)
      + row('Échéance', fiche.echeance)
      + row('Pénalités', fiche.penalites)
      + row('Base', fiche.base)
      + row('Conseil 💡', fiche.conseil)
      + '</div>';
  } else {
    body = '<h3 style="margin:0 0 10px;">' + esc(d.label) + '</h3>'
      + '<p style="font-size:14px;color:var(--text-muted);">Fiche stratégique non disponible'
      + ' pour cet impôt dans ce pays.</p>';
  }
  box.innerHTML = '<div class="modal-overlay active" data-testid="fiche-modal">'
    + '<div class="modal" role="dialog" aria-modal="true">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">'
    + '<span style="font-size:13px;color:var(--text-muted);">' + d.jour + ' ' + MONTHS[S.month] + ' ' + S.year
    + ' · ' + esc(d.label) + '</span>'
    + '<button class="btn btn-secondary btn-sm" data-testid="fiche-close">Fermer</button></div>'
    + body + '</div></div>';
  const close = $('[data-testid="fiche-close"]', box);
  if (close) close.addEventListener('click', () => { box.innerHTML = ''; });
  const overlay = $('.modal-overlay', box);
  if (overlay) overlay.addEventListener('click', (ev) => {
    if (ev.target === overlay) box.innerHTML = '';
  });
}

function bind() {
  const sel = $('[data-testid="cal-country"]', shell());
  if (sel) sel.addEventListener('change', async () => {
    S.code = sel.value;
    try { await saveCountry(S.code); }
    catch (err) { toast(err.message || 'Sauvegarde impossible.', 'error'); }
    render();
  });
  const prev = $('[data-testid="cal-prev"]', shell());
  if (prev) prev.addEventListener('click', () => {
    S.month--; if (S.month < 0) { S.month = 11; S.year--; } render();
  });
  const next = $('[data-testid="cal-next"]', shell());
  if (next) next.addEventListener('click', () => {
    S.month++; if (S.month > 11) { S.month = 0; S.year++; } render();
  });
  $all('[data-fiche]', shell()).forEach((b) => {
    b.addEventListener('click', () => {
      const d = (shell()._deadlines || [])[Number(b.dataset.fiche)];
      if (d) openFiche(d);
      else toast('Échéance introuvable.', 'error');
    });
  });
}

export async function renderCalendrierPage() {
  shell().innerHTML = '<div class="loading-state">Chargement du calendrier…</div>';
  try {
    S.code = await loadCountry();
  } catch (e) { S.code = 'BF'; }
  if (!getCountry(S.code)) S.code = 'BF';
  try {
    S.cnssFreq = await getEffectiveCnssFrequency();
  } catch (e) { S.cnssFreq = 'trimestrielle'; }
  try {
    S.tvaSubject = await loadTvaSubject();
    S.bicPrelevement = await loadBicPrelevement();
  } catch (e) { /* valeurs par défaut */ }
  const now = new Date();
  S.year = now.getFullYear();
  S.month = now.getMonth();
  render();
}
