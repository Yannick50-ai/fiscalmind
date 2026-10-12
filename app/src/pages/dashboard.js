// FiscalMind Africa — tableau de bord (page d'accueil connectée).
//
// Route '' (avec session) et '#/accueil'. Contenu calculé par le moteur
// (src/engine/dashboard.js) depuis les écritures du store sur l'exercice
// sélectionné : cartes KPI cliquables, graphiques SVG faits main (zéro
// dépendance), alertes (échéances fiscales, factures non lettrées, équilibre).
// La landing reste affichée pour les visiteurs (voir app.js).

import { esc, fmt, fmtDate, todayISO, toast, $ } from '../ui.js';
import { loadEntries, savePeriode, defaultPeriode, loadCountry } from '../store.js';
import {
  kpis, monthlySeries, chargesBreakdown, treasuryCurve, upcomingDeadlines,
  bfr, chargesPersonnel, topClients, topFournisseurs, dsoDpo, comparatif, alertesDashboard,
} from '../../../src/engine/dashboard.js';
import { FISCAL_CALENDARS } from '../../../src/data/calendars.js';

const S = { entries: [], periode: null, country: 'BF', k: null };

const MOIS_FR = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const DONUT_COLORS = ['#f97316', '#16a34a', '#2563eb', '#9333ea', '#eab308', '#ef4444', '#0d9488'];

function shell() { return document.getElementById('appMain'); }

/** 66.7 -> "66,7 %" */
export function fmtPct(n) {
  const v = Number(n) || 0;
  return v.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' %';
}

/** +12.5 -> "+12,5 %" · -3 -> "-3 %" (évolution N/N-1). */
export function fmtEvo(pct) {
  const v = Number(pct) || 0;
  return (v > 0 ? '+' : '') + fmtPct(v);
}

/** 2 400 000 -> "2,4 M" · 850 000 -> "850 k" · 950 -> "950,00". */
export function fmtShort(n) {
  const v = Math.round(Number(n) || 0);
  const a = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  const fr1 = (x) => x.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
  if (a >= 1e9) return sign + fr1(a / 1e9) + ' Md';
  if (a >= 1e6) return sign + fr1(a / 1e6) + ' M';
  if (a >= 1e3) return sign + fr1(a / 1e3) + ' k';
  return fmt(v) || '0';
}

async function countryOf() {
  try { return await loadCountry(); }
  catch (e) { return 'BF'; }
}

/* ------------------------------------------------------------------ */
/* Graphiques SVG (faits main, zéro dépendance)                        */
/* ------------------------------------------------------------------ */

/** Barres groupées CA vs charges, 12 mois. */
function svgBars(series) {
  const W = 360, H = 210, x0 = 8, baseY = 172, plotH = 148, plotW = W - x0 - 8;
  const maxV = Math.max(1, ...series.flatMap((s) => [s.ca, s.charges]));
  const gw = plotW / 12, bw = Math.min(13, (gw - 6) / 2);
  let bars = '';
  series.forEach((s, i) => {
    const gx = x0 + i * gw;
    const hCa = Math.round((s.ca / maxV) * plotH);
    const hCh = Math.round((s.charges / maxV) * plotH);
    bars += '<rect class="chart-bar" data-month="' + s.mois + '" data-kind="ca" x="' + (gx + 2).toFixed(1)
      + '" y="' + (baseY - hCa) + '" width="' + bw + '" height="' + hCa + '" rx="2" fill="#16a34a"><title>CA ' + MOIS_FR[i] + ' : ' + fmt(s.ca) + ' F</title></rect>';
    bars += '<rect class="chart-bar" data-month="' + s.mois + '" data-kind="charges" x="' + (gx + 3 + bw).toFixed(1)
      + '" y="' + (baseY - hCh) + '" width="' + bw + '" height="' + hCh + '" rx="2" fill="#f97316"><title>Charges ' + MOIS_FR[i] + ' : ' + fmt(s.charges) + ' F</title></rect>';
    bars += '<text x="' + (gx + gw / 2).toFixed(1) + '" y="' + (baseY + 16) + '" text-anchor="middle" font-size="10" fill="var(--text-muted)">' + MOIS_FR[i] + '</text>';
  });
  const maxLabel = fmtShort(maxV);
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="Chiffre d’affaires et charges par mois" data-testid="chart-ca-charges">'
    + '<text x="' + x0 + '" y="14" font-size="10" fill="var(--text-muted)">' + esc(maxLabel) + ' F</text>'
    + '<line x1="' + x0 + '" y1="' + baseY + '" x2="' + (W - 8) + '" y2="' + baseY + '" stroke="var(--border)" stroke-width="1"/>'
    + bars
    + '<g font-size="11" fill="var(--text)">'
    + '<rect x="' + x0 + '" y="' + (H - 14) + '" width="10" height="10" rx="2" fill="#16a34a"/><text x="' + (x0 + 14) + '" y="' + (H - 5) + '">CA</text>'
    + '<rect x="' + (x0 + 52) + '" y="' + (H - 14) + '" width="10" height="10" rx="2" fill="#f97316"/><text x="' + (x0 + 66) + '" y="' + (H - 5) + '">Charges</text>'
    + '</g></svg>';
}

/** Donut de répartition des charges. */
function svgDonut(groups) {
  const total = groups.reduce((a, g) => a + g.montant, 0);
  const size = 190, c = size / 2, r = 62, C = 2 * Math.PI * r;
  let segs = '', offset = 0;
  groups.forEach((g, i) => {
    const frac = total ? g.montant / total : 0;
    const len = Math.max(0, frac * C - 2);
    segs += '<circle cx="' + c + '" cy="' + c + '" r="' + r + '" fill="none" stroke="' + DONUT_COLORS[i % DONUT_COLORS.length]
      + '" stroke-width="30" stroke-dasharray="' + len.toFixed(1) + ' ' + C.toFixed(1)
      + '" stroke-dashoffset="' + (-offset).toFixed(1) + '" transform="rotate(-90 ' + c + ' ' + c + '">'
      + '<title>' + esc(g.label) + ' : ' + fmt(g.montant) + ' F</title></circle>';
    offset += frac * C;
  });
  const legend = groups.map((g, i) =>
    '<div class="legend-row"><span class="legend-dot" style="background:' + DONUT_COLORS[i % DONUT_COLORS.length] + '"></span>'
    + '<span class="legend-label">' + esc(g.label) + '</span>'
    + '<span class="legend-value">' + esc(fmtShort(g.montant)) + '</span></div>').join('');
  return '<div class="donut-wrap" data-testid="chart-charges-donut">'
    + '<svg viewBox="0 0 ' + size + ' ' + size + '" width="150" role="img" aria-label="Répartition des charges">'
    + segs
    + '<text x="' + c + '" y="' + (c - 4) + '" text-anchor="middle" font-size="15" font-weight="800" fill="var(--text)">' + esc(fmtShort(total)) + '</text>'
    + '<text x="' + c + '" y="' + (c + 14) + '" text-anchor="middle" font-size="10" fill="var(--text-muted)">F CFA</text>'
    + '</svg><div class="legend-list">' + legend + '</div></div>';
}

/** Courbe de trésorerie cumulée. */
function svgTreso(curve) {
  const W = 360, H = 170, x0 = 8, baseY = 140, plotH = 116, plotW = W - x0 - 8;
  const maxV = Math.max(1, ...curve.map((p) => p.montant));
  const minV = Math.min(0, ...curve.map((p) => p.montant));
  const span = maxV - minV || 1;
  const px = (i) => (x0 + (i / 11) * plotW).toFixed(1);
  const py = (v) => (baseY - ((v - minV) / span) * plotH).toFixed(1);
  const pts = curve.map((p, i) => px(i) + ',' + py(p.montant)).join(' ');
  const area = 'M' + px(0) + ',' + baseY + ' L' + curve.map((p, i) => px(i) + ',' + py(p.montant)).join(' L') + ' L' + px(11) + ',' + baseY + ' Z';
  const dots = curve.map((p, i) =>
    '<circle class="chart-dot" data-month="' + p.mois + '" cx="' + px(i) + '" cy="' + py(p.montant) + '" r="3.5" fill="#2563eb"><title>' + MOIS_FR[i] + ' : ' + fmt(p.montant) + ' F</title></circle>').join('');
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="Trésorerie cumulée par mois" data-testid="chart-treso">'
    + '<path d="' + area + '" fill="#2563eb" opacity="0.12"/>'
    + '<polyline points="' + pts + '" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-linejoin="round"/>'
    + dots
    + '<text x="' + x0 + '" y="14" font-size="10" fill="var(--text-muted)">' + esc(fmtShort(maxV)) + ' F</text>'
    + '<text x="' + x0 + '" y="' + (H - 6) + '" font-size="10" fill="var(--text-muted)">J</text>'
    + '<text x="' + (W - 14) + '" y="' + (H - 6) + '" font-size="10" fill="var(--text-muted)">D</text>'
    + '</svg>';
}

/* ------------------------------------------------------------------ */
/* Rendu                                                               */
/* ------------------------------------------------------------------ */

function kpiCard(testid, icon, label, value, sub, goto, valueClass) {
  return '<button class="stat-card kpi-card" data-goto="' + goto + '" data-testid="' + testid + '">'
    + '<div class="kpi-top"><span class="kpi-icon">' + icon + '</span></div>'
    + '<div class="kpi-value ' + (valueClass || '') + '">' + esc(value) + '</div>'
    + '<div class="stat-label">' + esc(label) + '</div>'
    + (sub ? '<div class="stat-sub">' + esc(sub) + '</div>' : '')
    + '</button>';
}

function renderKpis() {
  const k = S.k;
  const resCls = k.resNet < 0 ? 'kpi-neg' : 'kpi-pos';
  const margeCls = k.tauxMarge < 0 ? 'kpi-neg' : 'kpi-pos';
  const tvaSub = k.tva > 0 ? 'à décaisser' : k.tva < 0 ? 'crédit de TVA' : 'soldée';
  return '<div class="stat-grid" data-testid="kpi-grid">'
    + kpiCard('kpi-ca', '💰', "Chiffre d'affaires", fmtShort(k.ca) + ' F', 'classe 70', '/etats?tab=cr')
    + kpiCard('kpi-resnet', '📈', 'Résultat net', fmtShort(k.resNet) + ' F', k.resNet < 0 ? 'perte' : 'bénéfice', '/etats?tab=cr', resCls)
    + kpiCard('kpi-treso', '🏦', 'Trésorerie', fmtShort(k.tresorerie) + ' F', 'banques + caisse', '/etats?tab=bilan')
    + kpiCard('kpi-creances', '🧾', 'Créances clients', fmtShort(k.creancesClients) + ' F', 'non lettrées', '/etats?tab=balance')
    + kpiCard('kpi-dettes', '📦', 'Dettes fournisseurs', fmtShort(k.dettesFournisseurs) + ' F', 'non lettrées', '/etats?tab=balance')
    + kpiCard('kpi-tva', '🧮', 'TVA', fmtShort(k.tva) + ' F', tvaSub, '/etats?tab=balance')
    + kpiCard('kpi-marge-brute', '💹', 'Marge brute', fmtShort(k.margeBrute) + ' F', 'taux : ' + fmtPct(k.tauxMarge), '/etats?tab=cr', margeCls)
    + kpiCard('kpi-bfr', '⚖️', 'BFR', fmtShort(S.bfr.bfr) + ' F', 'besoin en fonds de roulement', '/etats?tab=bilan')
    + kpiCard('kpi-personnel', '👥', 'Charges de personnel', fmtShort(S.chargesPerso) + ' F', 'comptes 66', '/etats?tab=cr')
    + '</div>';
}

/* ------------------------------------------------------------------ */
/* Volet 2 — comparatif N/N-1, top tiers, DSO/DPO                      */
/* ------------------------------------------------------------------ */

/** Mini bar-chart N vs N-1 (CA, résultat net, trésorerie), gère les négatifs. */
function svgComparatif(c, yN, yN1) {
  const rows = [
    ['CA', c.ca, '#16a34a'],
    ['Résultat net', c.resNet, '#2563eb'],
    ['Trésorerie', c.tresorerie, '#f97316'],
  ];
  const W = 360, zeroY = 104, halfH = 66, baseY = 176;
  const maxAbs = Math.max(1, ...rows.flatMap(([, r]) => [Math.abs(r.n), Math.abs(r.n1)]));
  let bars = '';
  rows.forEach(([label, r, fillN], i) => {
    const cx = 62 + i * 118, bw = 30;
    [[r.n1, cx - bw - 3, '#94a3b8', 'N-1'], [r.n, cx + 3, fillN, 'N']].forEach(([v, x, fill, tag]) => {
      const h = Math.round((Math.abs(v) / maxAbs) * halfH);
      const y = v >= 0 ? zeroY - h : zeroY;
      bars += '<rect x="' + x.toFixed(1) + '" y="' + y + '" width="' + bw + '" height="' + Math.max(h, 2) + '" rx="2" fill="' + fill + '">'
        + '<title>' + esc(label) + ' ' + tag + ' : ' + fmt(v) + ' F</title></rect>';
      bars += '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (v >= 0 ? y - 4 : y + h + 12) + '" text-anchor="middle" font-size="9" fill="var(--text-muted)">' + esc(fmtShort(v)) + '</text>';
    });
    bars += '<text x="' + cx + '" y="' + baseY + '" text-anchor="middle" font-size="10" fill="var(--text)">' + esc(label) + '</text>';
    const pctFill = r.pct === null ? 'var(--text-muted)' : r.pct < 0 ? '#dc2626' : '#16a34a';
    const pctTxt = r.pct === null ? '—' : fmtEvo(r.pct);
    bars += '<text x="' + cx + '" y="' + (baseY + 14) + '" text-anchor="middle" font-size="10" font-weight="700" fill="' + pctFill + '">' + esc(pctTxt) + '</text>';
  });
  return '<svg viewBox="0 0 ' + W + ' ' + (baseY + 22) + '" width="100%" role="img" aria-label="Comparatif N / N-1" data-testid="chart-comparatif">'
    + '<line x1="8" y1="' + zeroY + '" x2="' + (W - 8) + '" y2="' + zeroY + '" stroke="var(--border)" stroke-width="1"/>'
    + bars
    + '<g font-size="11" fill="var(--text)">'
    + '<rect x="8" y="4" width="10" height="10" rx="2" fill="#94a3b8"/><text x="22" y="13">' + esc(yN1) + '</text>'
    + '<rect x="64" y="4" width="10" height="10" rx="2" fill="#16a34a"/><text x="78" y="13">' + esc(yN) + '</text>'
    + '</g></svg>';
}

function renderComparatif() {
  const y = Number(S.periode.debut.slice(0, 4));
  const c = comparatif(S.entries, {
    from: S.periode.debut, to: S.periode.fin,
    prevFrom: (y - 1) + '-01-01', prevTo: (y - 1) + '-12-31',
  });
  const row = (label, r) => {
    const pct = r.pct === null
      ? '<span class="muted">—</span>'
      : '<span class="' + (r.pct < 0 ? 'kpi-neg' : 'kpi-pos') + '"><strong>' + esc(fmtEvo(r.pct)) + '</strong></span>';
    return '<div class="legend-row"><span class="legend-label">' + esc(label) + '</span>'
      + '<span class="legend-value">' + esc(fmtShort(r.n1)) + ' → ' + esc(fmtShort(r.n)) + ' F</span>' + pct + '</div>';
  };
  return '<h3 class="dash-section">📊 Comparatif N / N-1</h3>'
    + '<div class="chart-card" data-testid="comparatif-n1">'
    + '<div class="chart-title">Exercice ' + y + ' vs ' + (y - 1) + '</div>'
    + '<div class="chart-scroll">' + svgComparatif(c, String(y), String(y - 1)) + '</div>'
    + '<div class="legend-list">'
    + row("Chiffre d'affaires", c.ca) + row('Résultat net', c.resNet) + row('Trésorerie', c.tresorerie)
    + '</div></div>';
}

/** Liste simple (top 5) avec montants, style légende du donut. */
function topList(testid, title, items, emptyMsg) {
  const rows = items.length
    ? items.map((t, i) =>
      '<div class="legend-row"><span class="legend-dot" style="background:' + DONUT_COLORS[i % DONUT_COLORS.length] + '"></span>'
      + '<span class="legend-label">' + esc(t.label) + '</span>'
      + '<span class="legend-value">' + esc(fmtShort(t.montant)) + ' F</span></div>').join('')
    : '<p class="muted">' + esc(emptyMsg) + '</p>';
  return '<h3 class="dash-section">' + title + '</h3>'
    + '<div class="chart-card" data-testid="' + testid + '"><div class="legend-list">' + rows + '</div></div>';
}

function renderDsoDpo() {
  const d = dsoDpo(S.entries, { from: S.periode.debut, to: S.periode.fin });
  const row = (label, v) =>
    '<div class="legend-row"><span class="legend-label">' + esc(label) + '</span>'
    + '<span class="legend-value"><strong>' + v + ' j</strong></span></div>';
  return '<h3 class="dash-section">⏱️ Délais de paiement</h3>'
    + '<div class="chart-card" data-testid="dso-dpo"><div class="legend-list">'
    + row('DSO — encaissement clients', d.dso)
    + row('DPO — paiement fournisseurs', d.dpo)
    + '</div></div>';
}

function renderCharts() {
  const y = S.periode.debut.slice(0, 4);
  const series = monthlySeries(S.entries, y);
  const charges = chargesBreakdown(S.entries, { from: S.periode.debut, to: S.periode.fin });
  const treso = treasuryCurve(S.entries, y);
  return '<h3 class="dash-section">📊 Activité ' + esc(y) + '</h3>'
    + '<div class="chart-card"><div class="chart-title">CA vs charges par mois</div><div class="chart-scroll">' + svgBars(series) + '</div></div>'
    + (charges.length
      ? '<div class="chart-card"><div class="chart-title">Charges par nature</div>' + svgDonut(charges) + '</div>'
      : '')
    + '<div class="chart-card"><div class="chart-title">Trésorerie cumulée</div><div class="chart-scroll">' + svgTreso(treso) + '</div></div>';
}

function renderAlerts() {
  const k = S.k;
  const items = [];
  // Volet 2 — alertes métier calculées par le moteur (même pattern que ci-dessous).
  alertesDashboard(k).forEach((a) => {
    const goto = a.code === 'decouvert' ? '/etats?tab=bilan' : '/etats?tab=cr';
    const unit = a.code === 'marge-negative' ? ' %' : ' F';
    items.push('<button class="alert-row alert-btn" data-goto="' + goto + '" data-testid="' + a.testid + '">'
      + '<span>⚠️ <strong>' + esc(a.label) + '</strong> : ' + esc(fmtShort(a.montant)) + unit + '</span><span>›</span></button>');
  });
  const deadlines = upcomingDeadlines(FISCAL_CALENDARS[S.country] || [], todayISO(), 30);
  deadlines.slice(0, 3).forEach((d) => {
    const quand = d.daysLeft === 0 ? "aujourd'hui" : 'dans ' + d.daysLeft + ' j';
    items.push('<button class="alert-row alert-btn" data-goto="/calendrier" data-testid="alert-deadline">'
      + '<span>⏰ <strong>' + esc(d.label) + '</strong> — ' + esc(fmtDate(d.dateISO)) + ' (' + quand + ')</span><span>›</span></button>');
  });
  if (k.creancesClients > 0) {
    items.push('<button class="alert-row alert-btn" data-goto="/lettrage" data-testid="alert-creances">'
      + '<span>📩 Factures clients non lettrées : <strong>' + esc(fmtShort(k.creancesClients)) + ' F</strong></span><span>›</span></button>');
  }
  items.push('<button class="alert-row alert-btn" data-goto="/etats?tab=balance" data-testid="alert-balance">'
    + '<span>' + (k.balanceOk ? '✅ Balance équilibrée' : '❌ Balance déséquilibrée — à vérifier') + '</span><span>›</span></button>');
  if (!items.length) return '';
  return '<h3 class="dash-section">🔔 Alertes</h3><div data-testid="alerts-list">' + items.join('') + '</div>';
}

function renderExercices() {
  const years = new Set([String(new Date().getFullYear())]);
  S.entries.forEach((e) => { if (e.date) years.add(String(e.date).slice(0, 4)); });
  const cur = S.periode.debut.slice(0, 4);
  $('#dashExercice').innerHTML = Array.from(years).sort().reverse()
    .map((y) => '<option value="' + y + '"' + (y === cur ? ' selected' : '') + '>Exercice ' + y + '</option>').join('');
}

function renderEmpty() {
  shell().innerHTML =
    '<div data-testid="dashboard-page">'
    + '<h2 class="page-title">🏠 Accueil</h2>'
    + '<div class="empty-dash" data-testid="dashboard-empty">'
    + '<div class="empty-dash-icon">📊</div>'
    + '<p><strong>Ton tableau de bord t’attend.</strong></p>'
    + '<p class="muted">Saisis ta première écriture et retrouve ici tes indicateurs, graphiques et alertes.</p>'
    + '<button class="btn btn-primary" data-goto="/journal" data-testid="dashboard-empty-cta">＋ Saisir ma première écriture</button>'
    + '</div></div>';
}

function renderContent() {
  const { debut, fin } = S.periode;
  S.k = kpis(S.entries, { from: debut, to: fin });
  if (S.k.nbEcritures === 0) { renderEmpty(); return; }
  S.bfr = bfr(S.entries, { to: fin });
  S.chargesPerso = chargesPersonnel(S.entries, { from: debut, to: fin });
  shell().innerHTML =
    '<div data-testid="dashboard-page">'
    + '<h2 class="page-title">🏠 Accueil</h2>'
    + '<div class="journal-toolbar"><select id="dashExercice" class="form-input" data-testid="dash-exercice" aria-label="Exercice"></select></div>'
    + renderKpis()
    + renderComparatif()
    + topList('top-clients', '🏆 Top 5 clients', topClients(S.entries, { from: debut, to: fin }), 'Aucune créance client non lettrée.')
    + topList('top-fournisseurs', '🏆 Top 5 fournisseurs', topFournisseurs(S.entries, { from: debut, to: fin }), 'Aucune dette fournisseur non lettrée.')
    + renderDsoDpo()
    + renderCharts()
    + renderAlerts()
    + '</div>';
  renderExercices();
  $('#dashExercice').addEventListener('change', async (e) => {
    const y = e.target.value;
    S.periode = { debut: y + '-01-01', fin: y + '-12-31' };
    try { await savePeriode(S.periode); }
    catch (err) { toast(err.message || 'Erreur de sauvegarde.', 'error'); }
    renderContent();
  });
}

/** Page d'accueil connectée = tableau de bord (la landing reste pour les visiteurs). */
export async function renderDashboardPage() {
  shell().innerHTML = '<div data-testid="dashboard-page"><div class="loading-state">Chargement du tableau de bord…</div></div>';
  try {
    const [entries, periode, country] = await Promise.all([
      loadEntries(), defaultPeriode(), countryOf(),
    ]);
    S.entries = entries;
    S.periode = periode;
    S.country = country;
  } catch (err) {
    shell().innerHTML = '<div class="error-state" data-testid="dashboard-error">'
      + '<div class="error-icon">⚠️</div><p>' + esc(err.message || 'Erreur de chargement.') + '</p>'
      + '<button class="btn btn-primary" id="dashRetry">Réessayer</button></div>';
    document.getElementById('dashRetry').addEventListener('click', () => renderDashboardPage());
    return;
  }
  renderContent();
}
