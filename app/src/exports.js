/**
 * FiscalMind Africa — utilitaires d'export partagés (Excel .xls via HTML + PDF via impression).
 *
 * Règle produit (Yannick, 8 oct. 2026) : les états financiers de la liasse
 * (bilan modèle 2, CR aux SIG, TFT/TBFT, notes annexes, CE, PT, ratios, fiches R1–R4)
 * se GÉNÈRENT depuis « États financiers » en **Excel et PDF** au format professionnel :
 * en-tête d'entreprise (depuis « Mon entreprise », jamais WagaExpress), période,
 * montants en FCFA, présentation aux normes. Le CSV brut reste réservé à
 * Balance/Grand livre.
 *
 * Excel : document HTML autonome téléchargé en `.xls` (MIME application/vnd.ms-excel),
 * lisible par Excel/LibreOffice — zéro dépendance. Les nombres sont écrits avec
 * `mso-number-format` pour rester numériques dans Excel.
 */
import { esc, fmtDate } from './ui.js';

/** Nombre entier formaté pour l'export (jamais de chaîne vide). */
export function fmtX(n) {
  const v = Math.round(Number(n) || 0);
  return String(v);
}

/** Date du jour au format JJ/MM/AAAA pour les en-têtes. */
function todayFR() {
  return fmtDate(new Date().toISOString().slice(0, 10));
}

/**
 * Construit le document HTML complet pour l'export Excel.
 * @param {Object} opts
 * @param {string} opts.company   nom d'entreprise (« Mon entreprise »)
 * @param {string} opts.title     titre de l'état (ex. « Bilan — modèle 2 »)
 * @param {string} opts.periode   libellé de période (ex. « Exercice 2025 »)
 * @param {string} opts.bodyHtml  une ou plusieurs <table> + paragraphes HTML
 * @returns {string} document HTML autonome
 */
export function buildExcelDoc({ company, title, periode, bodyHtml }) {
  const css = [
    'body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#1a1a1a;}',
    '.doc-company{font-size:16pt;font-weight:bold;color:#8a6a1f;}',
    '.doc-title{font-size:13pt;font-weight:bold;margin-top:6pt;}',
    '.doc-meta{font-size:9pt;color:#555;margin-bottom:12pt;}',
    'table{border-collapse:collapse;margin-bottom:14pt;}',
    'th{background:#1f3a5f;color:#ffffff;font-weight:bold;border:1px solid #1f3a5f;padding:4pt 6pt;}',
    'td{border:1px solid #9aa5b1;padding:3pt 6pt;}',
    'td.num{mso-number-format:"#,##0";text-align:right;}',
    'tr.total td{background:#f3e9c8;font-weight:bold;}',
    'tr.sub td{background:#eef2f7;font-weight:bold;}',
    'tr.sig td{background:#e8f0e8;font-weight:bold;}',
    '.foot{font-size:8pt;color:#777;margin-top:10pt;}',
  ].join('');
  return '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">'
    + '<head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets>'
    + '<x:ExcelWorksheet><x:Name>' + esc(String(title).slice(0, 28)) + '</x:Name>'
    + '<x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet>'
    + '</x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->'
    + '<style>' + css + '</style></head><body>'
    + '<div class="doc-company">' + esc(company || 'Mon entreprise') + '</div>'
    + '<div class="doc-title">' + esc(title) + '</div>'
    + '<div class="doc-meta">' + esc(periode || '') + ' — Montants en FCFA — Édité le ' + todayFR() + '</div>'
    + bodyHtml
    + '<div class="foot">FiscalMind Africa — SYSCOHADA révisé</div>'
    + '</body></html>';
}

/**
 * Télécharge un document Excel (.xls) construit par buildExcelDoc.
 * @param {string} filename  ex. 'bilan_2025.xls'
 * @param {string} htmlDoc   document retourné par buildExcelDoc
 */
export function downloadExcel(filename, htmlDoc) {
  const blob = new Blob(['\ufeff' + htmlDoc], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
}

/* ------------------------------------------------------------------ */
/* Export multi-feuilles (SpreadsheetML) — une feuille par tableau      */
/* ------------------------------------------------------------------ */

/**
 * Échappe une chaîne pour le XML SpreadsheetML.
 */
function escXml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/**
 * Nom d'onglet Excel sûr : 31 caractères max, sans / \ ? * [ ].
 */
export function safeSheetName(name) {
  return String(name || 'Feuille').replace(/[/\\?*[\]]/g, '—').slice(0, 31) || 'Feuille';
}

/**
 * Construit un classeur Excel multi-feuilles au format SpreadsheetML
 * (XML Spreadsheet 2003) — zéro dépendance, s'ouvre dans Excel,
 * LibreOffice et WPS avec un onglet par feuille.
 *
 * @param {Object} opts
 * @param {Array}  opts.sheets  [{ name, title, headers:[], rows: [[cell]] }]
 *   cell = valeur brute, ou { v, num:true, bold:true, style:'header'|'total' }
 * @returns {string} document XML SpreadsheetML
 */
export function buildMultiSheetExcel({ sheets }) {
  const styles =
    '<Styles>'
    + '<Style ss:ID="sTitle"><Font ss:Bold="1" ss:Size="14" ss:Color="#8A6A1F"/></Style>'
    + '<Style ss:ID="sHeader"><Font ss:Bold="1" ss:Color="#FFFFFF"/>'
    + '<Interior ss:Color="#1F3A5F" ss:Pattern="Solid"/>'
    + '<Borders>'
    + '<Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>'
    + '<Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>'
    + '<Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>'
    + '<Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>'
    + '</Borders></Style>'
    + '<Style ss:ID="sCell"><Borders>'
    + '<Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>'
    + '<Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>'
    + '<Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>'
    + '<Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>'
    + '</Borders></Style>'
    + '<Style ss:ID="sNum"><Borders>'
    + '<Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>'
    + '<Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>'
    + '<Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>'
    + '<Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>'
    + '</Borders><NumberFormat ss:Format="#,##0"/></Style>'
    + '<Style ss:ID="sTotal"><Font ss:Bold="1"/>'
    + '<Interior ss:Color="#F3E9C8" ss:Pattern="Solid"/><Borders>'
    + '<Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>'
    + '<Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>'
    + '<Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>'
    + '<Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>'
    + '</Borders></Style>'
    + '<Style ss:ID="sTotalNum"><Font ss:Bold="1"/>'
    + '<Interior ss:Color="#F3E9C8" ss:Pattern="Solid"/><Borders>'
    + '<Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>'
    + '<Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>'
    + '<Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>'
    + '<Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>'
    + '</Borders><NumberFormat ss:Format="#,##0"/></Style>'
    + '</Styles>';

  const cellXml = (c) => {
    const cell = (c && typeof c === 'object' && 'v' in c) ? c : { v: c };
    const isNum = !!cell.num && Number.isFinite(Number(cell.v));
    const style = cell.style === 'header' ? 'sHeader'
      : cell.style === 'total' ? (isNum ? 'sTotalNum' : 'sTotal')
      : isNum ? 'sNum' : 'sCell';
    const type = isNum ? 'Number' : 'String';
    const val = isNum ? String(Math.round(Number(cell.v))) : escXml(cell.v);
    return '<Cell ss:StyleID="' + style + '"><Data ss:Type="' + type + '">' + val + '</Data></Cell>';
  };

  const worksheets = (sheets || []).map((sh) => {
    let t = '<Worksheet ss:Name="' + escXml(safeSheetName(sh.name)) + '"><Table>';
    if (sh.title) {
      t += '<Row><Cell ss:StyleID="sTitle" ss:MergeAcross="'
        + Math.max(0, (sh.headers || []).length - 1) + '"><Data ss:Type="String">'
        + escXml(sh.title) + '</Data></Cell></Row><Row></Row>';
    }
    if (sh.headers && sh.headers.length) {
      t += '<Row>' + sh.headers.map((h) => cellXml({ v: h, style: 'header' })).join('') + '</Row>';
    }
    (sh.rows || []).forEach((r) => {
      t += '<Row>' + r.map(cellXml).join('') + '</Row>';
    });
    return t + '</Table></Worksheet>';
  }).join('');

  return '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<?mso-application progid="Excel.Sheet"?>\n'
    + '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"'
    + ' xmlns:o="urn:schemas-microsoft-com:office:office"'
    + ' xmlns:x="urn:schemas-microsoft-com:office:excel"'
    + ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"'
    + ' xmlns:html="http://www.w3.org/TR/REC-html40">'
    + styles + worksheets + '</Workbook>';
}

/**
 * Télécharge un classeur multi-feuilles (.xls SpreadsheetML).
 * @param {string} filename  ex. 'notes_annexes_2025.xls'
 * @param {string} xmlDoc    document retourné par buildMultiSheetExcel
 */
export function downloadMultiSheetExcel(filename, xmlDoc) {
  const blob = new Blob(['\ufeff' + xmlDoc], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
}

/**
 * En-tête d'impression partagé (PDF via window.print) : injecte l'en-tête
 * professionnel dans l'élément #printHeader s'il existe.
 */
export function renderSharedPrintHeader(company, title, periode) {
  const el = document.getElementById('printHeader');
  if (!el) return;
  el.innerHTML = '<div class="print-company">' + esc(company || 'Mon entreprise') + '</div>'
    + '<div class="print-title">' + esc(title) + ' — ' + esc(periode || '') + '</div>'
    + '<div class="print-date">Édité le ' + todayFR() + ' — montants en FCFA</div>';
}
