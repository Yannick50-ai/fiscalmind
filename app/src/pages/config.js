// FiscalMind Africa — page Configuration (#/config).
//
// 1. Mon entreprise : nom (en-tête des exports, jamais « WagaExpress »),
//    IFU, régime fiscal — stockés en fm_settings.
// 2. Paramètres fiscaux : TVA / IS / cotisations employeur / salarié,
//    modifiables par le client (surcharges en fm_settings 'tax_overrides'),
//    réinitialisation aux valeurs du pays.
// 3. Ma licence : plan courant + quota copilote, boutons d'achat Chariow
//    (Starter 29 900 / Pro 79 900 XOF — paiement avec l'email du compte).

import { esc, $, $all, toast } from '../ui.js';
import {
  loadCompany, saveCompany, loadCompanyIfu, saveCompanyIfu,
  loadCompanyRegime, saveCompanyRegime, loadCountry,
  loadTaxOverrides, saveTaxOverrides, saveEntry, CloudError,
  loadCompanyR1, saveCompanyR1, loadDirigeants, saveDirigeants,
  loadAssocies, saveAssocies,
  loadEmployeeCount, saveEmployeeCount, loadCnssFrequency, saveCnssFrequency,
  loadTvaSubject, saveTvaSubject, loadBicPrelevement, saveBicPrelevement,
  loadDefaultAccounts, saveDefaultAccounts,
} from '../store.js';
import { getQuotaInfo, isAdmin } from '../licence.js';
import { getAccessToken, supabaseService, getSession } from '../auth.js';
import { validateEntry } from '../../../src/engine/journal.js';
import { loadEntries, deleteEntryById } from '../store.js';

const DEMO_URL = './demo-data-2024-2025.json';
const DEMO_IDS = ['demo-an-2024', 'demo-an-2025'];
import { getCountry } from '../../../src/data/countries.js';

const SASPAY_URLS = {
  essentiel_mensuel: 'https://link.saspay.me/z9bcbdu2dpc',
  essentiel_annuel: 'https://link.saspay.me/6omguaao7we',
  essentiel_fondateur: 'https://link.saspay.me/ehsw8c2qi18',
  pro_mensuel: 'https://link.saspay.me/wcvjrykr8uc',
  pro_annuel: 'https://link.saspay.me/oiuz_mfqe0u',
  pro_fondateur: 'https://link.saspay.me/vocf4sozc0c',
};

const PLANS = {
  essentiel: { name: 'Essentiel', price: '14 900 XOF', quota: '30 questions/mois' },
  pro: { name: 'Pro', price: '44 900 XOF', quota: '300 questions/mois' },
};

const S = {
  company: '', ifu: '', regime: '', country: 'BF', overrides: {},
  r1: {}, dirigeants: [], associes: [],
  employeeCount: 0, cnssFrequency: 'auto',
  tvaSubject: true, bicPrelevement: false,
  defaultAccounts: { client: '411', fournisseur: '401', tvaCollectee: '4431', tvaDeductible: '4451', vente: '701', achat: '601' },
};

function cnssFrequencyOptions() {
  const opts = [
    ['auto', 'Automatique (selon effectif : ≥ 20 = mensuelle)'],
    ['mensuelle', 'Mensuelle (≥ 20 salariés)'],
    ['trimestrielle', 'Trimestrielle (< 20 salariés)'],
  ];
  return opts.map(([v, label]) => '<option value="' + v + '"' + (S.cnssFrequency === v ? ' selected' : '') + '>'
    + esc(label) + '</option>').join('');
}

const R1_LABELS = [
  ['sigle', 'Sigle'],
  ['adresse', 'Adresse postale'],
  ['adresseGeo', 'Adresse géographique complète (immeuble, rue, quartier, ville, pays)'],
  ['rccm', 'N° Registre de Commerce (RCCM)'],
  ['greffe', 'Greffe'],
  ['nes', 'N° de télédéclarant (NES)'],
  ['caisseSociale', 'N° de caisse sociale'],
  ['codeImportateur', 'N° Code Importateur'],
  ['codeActivite', 'Code activité principale'],
  ['activitePrincipale', 'Désignation précise de l’activité principale'],
  ['capaciteProd', '% Capacité de production utile'],
  ['exerciceDebut', 'Exercice — début (AAAA-MM-JJ)'],
  ['exerciceFin', 'Exercice — fin (AAAA-MM-JJ)'],
  ['dureeMois', 'Durée de l’exercice (en mois)'],
  ['telephone', 'Téléphone'],
  ['email', 'Email'],
  ['boitePostale', 'Boîte postale'],
  ['ville', 'Ville'],
  ['contactNom', 'Personne à contacter — nom'],
  ['contactAdresse', 'Personne à contacter — adresse'],
  ['contactTel', 'Personne à contacter — téléphone'],
  ['contactEmail', 'Personne à contacter — email'],
  ['contactQualite', 'Personne à contacter — qualité'],
  ['expertNom', 'Expert-comptable — nom'],
  ['expertContact', 'Expert-comptable — contact'],
];

function regimeOptions() {
  // Régimes fiscaux du Burkina Faso (le 12/10/2026 : BIC/BNC/BA étaient des
  // catégories françaises, incompréhensibles pour l'utilisateur).
  const vals = ['', 'CME', 'RSI', 'RNI'];
  const labels = {
    '': '— Choisir —',
    'CME': 'CME — Contribution des Micro-Entreprises',
    'RSI': 'RSI — Régime Simplifié d\u2019Imposition',
    'RNI': 'RNI — Régime Normal d\u2019Imposition',
  };
  if (S.regime && !vals.includes(S.regime)) vals.push(S.regime);
  return vals.map((v) => '<option value="' + esc(v) + '"' + (S.regime === v ? ' selected' : '') + '>'
    + esc(labels[v] || v) + '</option>').join('');
}

function personRowHtml(kind, p, idx) {
  const pf = kind === 'dir' ? 'dir' : 'ass';
  return '<div class="person-row" data-person-kind="' + kind + '" data-person-idx="' + idx + '" '
    + 'style="display:grid;grid-template-columns:1fr 1fr auto;gap:6px;margin-bottom:6px;align-items:center;">'
    + '<input class="form-input" data-' + pf + '-nom value="' + esc(p.nom || '') + '" placeholder="Nom et prénoms" aria-label="Nom">'
    + '<input class="form-input" data-' + pf + '-qualite value="' + esc(p.qualite || '') + '" placeholder="Qualité (ex. Gérant)" aria-label="Qualité">'
    + '<div style="display:flex;gap:6px;">'
    + (kind === 'dir'
      ? '<input class="form-input" data-' + pf + '-contact value="' + esc(p.contact || '') + '" placeholder="Contact" aria-label="Contact" style="width:110px;">'
      : '<input class="form-input" data-' + pf + '-part value="' + esc(p.part || '') + '" placeholder="Part (ex. 60 %)" aria-label="Part" style="width:110px;">')
    + '<button class="btn btn-secondary btn-sm" data-person-del="' + kind + ':' + idx + '" data-testid="dsf-' + pf + '-del-' + idx + '" aria-label="Supprimer">✕</button>'
    + '</div></div>';
}

function personListHtml(kind) {
  const list = kind === 'dir' ? S.dirigeants : S.associes;
  const pf = kind === 'dir' ? 'dir' : 'ass';
  const title = kind === 'dir' ? 'Dirigeants (fiche R2)' : 'Associés / actionnaires (fiche R3)';
  const sub = kind === 'dir' ? 'nom, qualité, contact' : 'nom, qualité, part au capital';
  let h = '<div style="margin-top:10px;"><div style="font-size:13px;font-weight:600;margin-bottom:2px;">' + title + '</div>'
    + '<div class="muted-sm" style="margin-bottom:6px;">' + sub + '</div>'
    + '<div id="dsf-' + pf + '-list" data-testid="dsf-' + pf + '-list">';
  h += list.map((p, i) => personRowHtml(kind, p, i)).join('');
  h += '</div><button class="btn btn-secondary btn-sm" data-person-add="' + kind + '" data-testid="dsf-' + pf + '-add" style="margin-top:4px;">＋ Ajouter</button></div>';
  return h;
}

/** Relit les lignes de personnes saisies dans les champs vers S (avant re-rendu ou sauvegarde). */
function readPersonLists() {
  const root = shell();
  S.dirigeants = $all('[data-person-kind="dir"]', root).map((row) => ({
    nom: (row.querySelector('[data-dir-nom]') || {}).value || '',
    qualite: (row.querySelector('[data-dir-qualite]') || {}).value || '',
    contact: (row.querySelector('[data-dir-contact]') || {}).value || '',
  }));
  S.associes = $all('[data-person-kind="ass"]', root).map((row) => ({
    nom: (row.querySelector('[data-ass-nom]') || {}).value || '',
    qualite: (row.querySelector('[data-ass-qualite]') || {}).value || '',
    part: (row.querySelector('[data-ass-part]') || {}).value || '',
  }));
}

/** Valeurs des champs « Mon entreprise » à préserver lors du re-rendu DSF. */
function keepCompanyFields() {
  const v = (sel) => { const el = $(sel); return el ? el.value : null; };
  return { company: v('#cfg-company'), ifu: v('#cfg-ifu'), regime: v('#cfg-regime') };
}
function restoreCompanyFields(keep) {
  const set = (sel, val) => { const el = $(sel); if (el && val !== null && val !== undefined) el.value = val; };
  set('#cfg-company', keep.company); set('#cfg-ifu', keep.ifu); set('#cfg-regime', keep.regime);
}

function bindDsfSave() {
  const dsfSave = $('#dsfSave');
  if (!dsfSave) return;
  dsfSave.addEventListener('click', async () => {
    const r1 = {};
    R1_LABELS.forEach(([k]) => {
      const el = $('#dsf-' + k);
      r1[k] = el ? el.value.trim() : '';
    });
    readPersonLists();
    try {
      await saveCompanyR1(r1);
      await saveDirigeants(S.dirigeants);
      await saveAssocies(S.associes);
      S.r1 = await loadCompanyR1();
      S.dirigeants = await loadDirigeants();
      S.associes = await loadAssocies();
      toast('Identification DSF enregistrée.', 'success');
    } catch (e) { toast('Sauvegarde impossible : ' + errMsg(e), 'error'); }
  });
}

function bindPersonButtons() {
  const root = shell();
  $all('[data-person-add]', root).forEach((b) => {
    b.addEventListener('click', () => {
      readPersonLists();
      if (b.dataset.personAdd === 'dir') S.dirigeants.push({ nom: '', qualite: '', contact: '' });
      else S.associes.push({ nom: '', qualite: '', part: '' });
      const dsf = $('#dsfSection');
      const keep = keepCompanyFields();
      if (dsf) { dsf.outerHTML = dsfSectionHtml(); bindPersonButtons(); bindDsfSave(); }
      restoreCompanyFields(keep);
    });
  });
  $all('[data-person-del]', root).forEach((b) => {
    b.addEventListener('click', () => {
      const [kind, idx] = b.dataset.personDel.split(':');
      readPersonLists();
      const arr = kind === 'dir' ? S.dirigeants : S.associes;
      arr.splice(Number(idx), 1);
      const dsf = $('#dsfSection');
      const keep = keepCompanyFields();
      if (dsf) { dsf.outerHTML = dsfSectionHtml(); bindPersonButtons(); bindDsfSave(); }
      restoreCompanyFields(keep);
    });
  });
}

function dsfSectionHtml() {
  let h = '<div class="card" style="margin-bottom:12px;" id="dsfSection"><div class="card-body">'
    + '<h3 class="card-title" style="margin-bottom:4px;">🪪 Identification DSF (fiches R1–R3)</h3>'
    + '<p class="muted-sm">Identité de l’entité pour la DSF OHADA : alimente les fiches R1–R3.</p>'
    + '<div class="form-grid-2">'
    + R1_LABELS.map(([k, label]) => '<label style="font-size:12px;">' + esc(label)
      + '<input id="dsf-' + k + '" class="form-input" data-testid="dsf-' + k + '" value="' + esc(S.r1[k] || '')
      + '" maxlength="120"></label>').join('')
    + '</div>'
    + personListHtml('dir')
    + personListHtml('ass')
    + '<button class="btn btn-primary" id="dsfSave" data-testid="dsf-save" style="width:100%;justify-content:center;margin-top:10px;">Enregistrer l’identification</button>'
    + '</div></div>';
  return h;
}

function shell() { return document.getElementById('appMain'); }

function errMsg(e) {
  return e instanceof CloudError ? e.message : 'Erreur inattendue.';
}

function errorHtml(msg) {
  return '<div class="error-state" data-testid="config-error">'
    + '<div class="error-icon">⚠️</div><p>' + esc(msg) + '</p>'
    + '<button class="btn btn-primary" data-testid="config-retry" id="configRetry">Réessayer</button></div>';
}

function taxFields() {
  const d = getCountry(S.country) || getCountry('BF');
  const sd = (d && d.social) || {};
  return [
    { key: 'tva', label: 'TVA (taux normal)', base: d.tva != null ? d.tva + ' %' : '—', status: d.statut || '' },
    { key: 'is', label: 'Impôt sur les sociétés', base: d.is != null ? d.is + ' %' : '—', status: d.statut || '' },
    { key: 'emp', label: 'Cotisation sociale employeur', base: sd.employer != null ? sd.employer + ' %' : '—', status: sd.status || '' },
    { key: 'sal', label: 'Cotisation sociale salarié', base: sd.employee != null ? sd.employee + ' %' : '—', status: sd.status || '' },
  ];
}

function statusBadge(st) {
  if (!st) return '';
  const col = /confirmé/i.test(st) ? '#16a34a' : (/provisoire|partiellement/i.test(st) ? '#d97706' : '#dc2626');
  return ' <span style="font-size:10px;font-weight:600;color:' + col + ';border:1px solid ' + col
    + ';border-radius:20px;padding:2px 8px;">' + esc(String(st).split('(')[0].trim()) + '</span>';
}

function render() {
  const quota = getQuotaInfo();
  const plan = (quota && quota.plan) || 'demo';
  const planLabel = { demo: 'Démo', starter: 'Starter', pro: 'Pro', enterprise: 'Enterprise', admin: 'Admin' }[plan] || plan;

  let h = '<div data-testid="config-page">'
    + '<div class="page-head"><h2 class="page-title">⚙️ Configuration</h2>'
    + '<p class="page-sub">Entreprise, fiscalité et licence</p></div>'

    // --- Mon entreprise ---
    + '<div class="card" style="margin-bottom:12px;"><div class="card-body">'
    + '<h3 class="card-title" style="margin-bottom:10px;">🏢 Mon entreprise</h3>'
    + '<label style="font-size:12px;">Nom (en-tête des exports)<input id="cfg-company" class="form-input" data-testid="cfg-company" value="' + esc(S.company) + '" maxlength="80"></label>'
    + '<div class="form-grid-2">'
    + '<label style="font-size:12px;">IFU<input id="cfg-ifu" class="form-input" value="' + esc(S.ifu) + '" maxlength="40"></label>'
    + '<label style="font-size:12px;">Régime fiscal<select id="cfg-regime" class="form-input">' + regimeOptions() + '</select></label>'
    + '</div>'
    + '<div class="form-grid-2">'
    + '<label style="font-size:12px;">Nombre de salariés<input id="cfg-employees" type="number" min="0" class="form-input" value="' + esc(String(S.employeeCount)) + '"></label>'
    + '<label style="font-size:12px;">Fréquence CNSS<select id="cfg-cnss" class="form-input">' + cnssFrequencyOptions() + '</select></label>'
    + '</div>'
    + '<p class="muted-sm" style="margin:4px 0 0;">CNSS : ≥ 20 salariés = déclaration mensuelle (le 15), &lt; 20 = trimestrielle.</p>'
    + '<div class="form-grid-2" style="margin-top:8px;">'
    + '<label style="font-size:12px;display:flex;align-items:center;gap:8px;"><input type="checkbox" id="cfg-tva" ' + (S.tvaSubject ? 'checked' : '') + ' style="width:18px;height:18px;"> Entreprise assujettie à la TVA</label>'
    + '<label style="font-size:12px;display:flex;align-items:center;gap:8px;"><input type="checkbox" id="cfg-bic" ' + (S.bicPrelevement ? 'checked' : '') + ' style="width:18px;height:18px;"> Prélèvement BIC 2% applicable</label>'
    + '</div>'
    + '<button class="btn btn-primary" id="cfgSaveCompany" data-testid="cfg-save-company" style="width:100%;justify-content:center;margin-top:8px;">Enregistrer</button>'
    + '</div></div>'

    // --- Comptes comptables par défaut (13/10/2026 — inspiré Dolibarr) ---
    + '<div class="card" style="margin-bottom:12px;"><div class="card-body">'
    + '<h3 class="card-title" style="margin-bottom:4px;">🧾 Comptes par défaut</h3>'
    + '<p class="muted-sm">Utilisés automatiquement lors de la saisie des écritures.</p>'
    + '<div class="form-grid-2">'
    + '<label style="font-size:12px;">Clients<input id="cfg-acc-client" class="form-input" value="' + esc(S.defaultAccounts.client) + '" maxlength="10"></label>'
    + '<label style="font-size:12px;">Fournisseurs<input id="cfg-acc-fournisseur" class="form-input" value="' + esc(S.defaultAccounts.fournisseur) + '" maxlength="10"></label>'
    + '</div>'
    + '<div class="form-grid-2">'
    + '<label style="font-size:12px;">TVA collectée<input id="cfg-acc-tvacol" class="form-input" value="' + esc(S.defaultAccounts.tvaCollectee) + '" maxlength="10"></label>'
    + '<label style="font-size:12px;">TVA déductible<input id="cfg-acc-tvaded" class="form-input" value="' + esc(S.defaultAccounts.tvaDeductible) + '" maxlength="10"></label>'
    + '</div>'
    + '<div class="form-grid-2">'
    + '<label style="font-size:12px;">Ventes<input id="cfg-acc-vente" class="form-input" value="' + esc(S.defaultAccounts.vente) + '" maxlength="10"></label>'
    + '<label style="font-size:12px;">Achats<input id="cfg-acc-achat" class="form-input" value="' + esc(S.defaultAccounts.achat) + '" maxlength="10"></label>'
    + '</div>'
    + '<button class="btn btn-primary" id="cfgSaveAccounts" style="width:100%;justify-content:center;margin-top:8px;">Enregistrer les comptes</button>'
    + '</div></div>'

    // --- Identification DSF (fiches R1–R3) ---
    + dsfSectionHtml()

    // --- Paramètres fiscaux ---
    + '<div class="card" style="margin-bottom:12px;"><div class="card-body">'
    + '<h3 class="card-title" style="margin-bottom:4px;">🧮 Paramètres fiscaux</h3>'
    + '<p class="muted-sm">Pays : <strong>' + esc((getCountry(S.country) || {}).nom || S.country) + '</strong> — ajustez les taux si votre situation diffère.</p>'
    + taxFields().map((f) => {
      const isOver = S.overrides[f.key] !== undefined && S.overrides[f.key] !== '';
      return '<div style="margin-bottom:10px;padding:10px;border:1px solid var(--border);border-radius:10px;' + (isOver ? 'border-color:var(--primary);' : '') + '">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;gap:6px;">'
        + '<span style="font-size:13px;font-weight:600;">' + esc(f.label) + '</span>' + statusBadge(f.status) + '</div>'
        + '<div style="display:flex;gap:8px;align-items:center;">'
        + '<span class="muted-sm" style="min-width:90px;">Défaut : <b>' + esc(f.base) + '</b></span>'
        + '<input type="text" inputmode="decimal" class="form-input" data-taxkey="' + f.key + '" data-testid="cfg-tax-' + f.key + '" placeholder="Personnaliser" value="' + esc(isOver ? S.overrides[f.key] : '') + '" style="flex:1;">'
        + '<span class="muted-sm">%</span></div>'
        + (isOver ? '<div style="font-size:11px;color:var(--primary);margin-top:4px;">✓ Valeur personnalisée active</div>' : '')
        + '</div>';
    }).join('')
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;">'
    + '<button class="btn btn-primary" id="cfgSaveTax" data-testid="cfg-save-tax" style="flex:1;justify-content:center;">Enregistrer</button>'
    + '<button class="btn btn-secondary" id="cfgResetTax" data-testid="cfg-reset-tax" style="flex:1;justify-content:center;">Réinitialiser</button>'
    + '</div></div></div>'

    // --- Ma licence ---
    + '<div class="card"><div class="card-body">'
    + '<h3 class="card-title" style="margin-bottom:10px;">🎫 Ma licence</h3>'
    + '<div class="rowline"><span>Plan actuel</span><strong>' + esc(planLabel) + '</strong></div>'
    + (quota && quota.remaining !== undefined && quota.remaining !== null
      ? '<div class="rowline"><span>Questions copilote restantes</span><strong>' + esc(String(quota.remaining)) + '</strong></div>'
      : '')
    + '<p class="muted-sm">⚠️ Payez avec l’email de votre compte FiscalMind pour une activation automatique.</p>'
    + ['essentiel', 'pro'].map((k) => {
      const p = PLANS[k];
      const isCur = plan === k;
      const mensuel = SASPAY_URLS[k + '_mensuel'];
      const annuel = SASPAY_URLS[k + '_annuel'];
      const fondateur = SASPAY_URLS[k + '_fondateur'];
      return '<div class="card" style="padding:14px;margin-bottom:10px;' + (isCur ? 'border:2px solid var(--primary);' : '') + '">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">'
        + '<strong>' + p.name + '</strong><strong style="color:var(--primary);">' + p.price + ' /mois</strong></div>'
        + '<div class="muted-sm" style="margin-bottom:10px;">Copilote IA : ' + p.quota + '</div>'
        + (isCur
          ? '<button class="btn btn-secondary" style="width:100%;justify-content:center;" disabled>✓ Votre plan actuel</button>'
          : '<div style="display:flex;gap:8px;margin-bottom:8px;">'
          + '<button class="btn btn-primary" style="flex:1;justify-content:center;" data-saspay="' + mensuel + '">Mensuel</button>'
          + '<button class="btn btn-secondary" style="flex:1;justify-content:center;" data-saspay="' + annuel + '">Annuel (-2 mois)</button></div>'
          + '<button class="btn btn-secondary" style="width:100%;justify-content:center;font-size:12px;" data-saspay="' + fondateur + '">🎖️ Offre fondateur -30% (50 premiers)</button>')
        + '</div>';
    }).join('')
    + '</div></div>'

    // --- Mon équipe (multi-utilisateurs, plan Pro : 3 max) ---
    + '<div class="card" style="margin-top:16px;" data-testid="team-section">'
    + '<h3 class="card-title" style="margin-bottom:10px;">👥 Mon équipe</h3>'
    + '<div id="teamBody"><p class="muted">Chargement…</p></div></div>'

    // --- Données de démo (réservé admin) ---
    + (isAdmin() ? demoSectionHtml() : '')

    + '</div>';

  shell().innerHTML = h;

  $('#cfgSaveCompany').addEventListener('click', async () => {
    try {
      const company = $('#cfg-company').value;
      const ifu = $('#cfg-ifu').value;
      const regime = $('#cfg-regime').value;
      const employees = $('#cfg-employees').value;
      const cnssFreq = $('#cfg-cnss').value;
      const tvaSubject = $('#cfg-tva').checked;
      const bicPrelevement = $('#cfg-bic').checked;
      await saveCompany(company);
      await saveCompanyIfu(ifu);
      await saveCompanyRegime(regime);
      await saveEmployeeCount(employees);
      await saveCnssFrequency(cnssFreq);
      await saveTvaSubject(tvaSubject);
      await saveBicPrelevement(bicPrelevement);
      // Mettre à jour l'état local (le 12/10/2026 : seul S.company était mis à jour,
      // l'IFU et le régime affichés revenaient aux anciennes valeurs).
      S.company = company.trim() || 'Mon entreprise';
      S.ifu = ifu.trim();
      S.regime = regime;
      S.employeeCount = parseInt(employees, 10) || 0;
      S.cnssFrequency = cnssFreq;
      S.tvaSubject = tvaSubject;
      S.bicPrelevement = bicPrelevement;
      toast('Entreprise enregistrée.', 'success');
    } catch (e) { toast('Sauvegarde impossible : ' + errMsg(e), 'error'); }
  });

  $('#cfgSaveAccounts').addEventListener('click', async () => {
    try {
      const accounts = {
        client: $('#cfg-acc-client').value,
        fournisseur: $('#cfg-acc-fournisseur').value,
        tvaCollectee: $('#cfg-acc-tvacol').value,
        tvaDeductible: $('#cfg-acc-tvaded').value,
        vente: $('#cfg-acc-vente').value,
        achat: $('#cfg-acc-achat').value,
      };
      await saveDefaultAccounts(accounts);
      S.defaultAccounts = await loadDefaultAccounts();
      toast('Comptes par défaut enregistrés.', 'success');
    } catch (e) { toast('Sauvegarde impossible : ' + errMsg(e), 'error'); }
  });

  $('#cfgSaveTax').addEventListener('click', async () => {    const ov = {};
    shell().querySelectorAll('[data-taxkey]').forEach((inp) => { ov[inp.dataset.taxkey] = inp.value.trim(); });
    try {
      await saveTaxOverrides(ov);
      S.overrides = await loadTaxOverrides();
      toast('Paramètres fiscaux enregistrés.', 'success');
      render();
    } catch (e) { toast('Sauvegarde impossible : ' + errMsg(e), 'error'); }
  });

  $('#cfgResetTax').addEventListener('click', async () => {
    try {
      await saveTaxOverrides({});
      S.overrides = {};
      toast('Taux réinitialisés aux valeurs du pays.', 'success');
      render();
    } catch (e) { toast('Réinitialisation impossible : ' + errMsg(e), 'error'); }
  });

  shell().querySelectorAll('[data-saspay]').forEach((b) =>
    b.addEventListener('click', () => {
      toast('Redirection vers SasPay… Payez avec l’email de votre compte.', 'info');
      setTimeout(() => window.open(b.dataset.saspay, '_blank'), 600);
    }));

  bindPersonButtons();
  bindDsfSave();

  bindDemoSection();

  // Charger la section équipe
  loadTeamSection();
}

/* ---------------- Mon équipe (multi-utilisateurs) ---------------- */

async function loadTeamSection() {
  const box = $('#teamBody');
  if (!box) return;
  try {
    const svc = supabaseService();
    if (!svc) { box.innerHTML = '<p class="muted">Connexion requise.</p>'; return; }
    const token = await getAccessToken();
    const res = await fetch('https://eetmaaopaatbbwhwbdcx.supabase.co/functions/v1/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ action: 'my_team' }),
    });
    const j = await res.json();

    if (!j.team) {
      // Pas d'équipe : proposer d'en créer une (si Pro) ou message
      if (j.plan === 'pro') {
        box.innerHTML = '<p class="muted-sm">Le plan Pro permet jusqu\'à 3 utilisateurs.</p>'
          + '<button class="btn btn-primary" id="teamCreate" style="margin-top:8px;">Créer mon équipe</button>';
        $('#teamCreate').addEventListener('click', async () => {
          const r = await fetch('https://eetmaaopaatbbwhwbdcx.supabase.co/functions/v1/team', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({ action: 'create_team', name: 'Mon équipe' }),
          });
          const jr = await r.json();
          if (jr.ok) { toast('Équipe créée !', 'success'); loadTeamSection(); }
          else toast(jr.error || 'Erreur', 'error');
        });
      } else {
        box.innerHTML = '<p class="muted-sm">Le multi-utilisateur est disponible avec le plan Pro (3 utilisateurs).</p>';
      }
      return;
    }

    // Afficher les membres
    let html = '<p class="muted-sm">' + j.membres.length + ' / ' + j.max + ' membre(s)</p>';
    html += '<div style="margin:8px 0;">' + j.membres.map((m) =>
      '<div class="rowline"><span>' + esc(m.email) + (m.role === 'owner' ? ' 👑' : '') + (m.accepted_at ? '' : ' <em>(invité)</em>') + '</span>'
      + (j.role === 'owner' && m.role !== 'owner'
        ? '<button class="btn btn-secondary" style="font-size:12px;padding:4px 8px;" data-remove="' + m.id + '">Retirer</button>'
        : '') + '</div>'
    ).join('') + '</div>';

    // Invitation (owner uniquement, si place disponible)
    if (j.role === 'owner' && j.membres.length < j.max) {
      html += '<div style="display:flex;gap:8px;margin-top:8px;">'
        + '<input type="email" id="teamInviteEmail" placeholder="Email à inviter" style="flex:1;padding:8px;border:1px solid var(--border);border-radius:6px;">'
        + '<button class="btn btn-primary" id="teamInviteBtn">Inviter</button></div>';
    }

    // Bouton accepter si invitation en attente
    const myEmail = (getSession()?.email || '').toLowerCase();
    const pending = j.membres.find((m) => (m.email || '').toLowerCase() === myEmail && !m.accepted_at);
    if (pending) {
      html += '<button class="btn btn-primary" id="teamAcceptBtn" style="margin-top:8px;width:100%;">Accepter l\'invitation</button>';
    }

    box.innerHTML = html;

    // Bind events
    const inviteBtn = $('#teamInviteBtn');
    if (inviteBtn) inviteBtn.addEventListener('click', async () => {
      const email = $('#teamInviteEmail').value.trim();
      if (!email) { toast('Entrez un email', 'error'); return; }
      const r = await fetch('https://eetmaaopaatbbwhwbdcx.supabase.co/functions/v1/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ action: 'invite', email }),
      });
      const jr = await r.json();
      if (jr.ok) { toast(jr.has_account ? 'Invitation envoyée !' : 'Invitation créée. Le destinataire doit créer un compte avec cet email.', 'success'); loadTeamSection(); }
      else toast(jr.error || 'Erreur', 'error');
    });

    box.querySelectorAll('[data-remove]').forEach((b) =>
      b.addEventListener('click', async () => {
        if (!confirm('Retirer ce membre ?')) return;
        const r = await fetch('https://eetmaaopaatbbwhwbdcx.supabase.co/functions/v1/team', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body: JSON.stringify({ action: 'remove', member_id: b.dataset.remove }),
        });
        const jr = await r.json();
        if (jr.ok) { toast('Membre retiré', 'success'); loadTeamSection(); }
        else toast(jr.error || 'Erreur', 'error');
      }));

    const acceptBtn = $('#teamAcceptBtn');
    if (acceptBtn) acceptBtn.addEventListener('click', async () => {
      const r = await fetch('https://eetmaaopaatbbwhwbdcx.supabase.co/functions/v1/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ action: 'accept' }),
      });
      const jr = await r.json();
      if (jr.ok) { toast('Invitation acceptée !', 'success'); loadTeamSection(); }
      else toast(jr.error || 'Erreur', 'error');
    });
  } catch (e) {
    box.innerHTML = '<p class="muted">Erreur de chargement.</p>';
  }
}

/* ---------------- Données de démo (admin uniquement) ---------------- */

function demoSectionHtml() {
  return '<div class="card" style="margin-top:12px;" data-testid="cfg-demo-section"><div class="card-body">'
    + '<h3 class="card-title" style="margin-bottom:4px;">🧪 Données de démo</h3>'
    + '<p class="muted-sm">À-nouveaux 2024–2025 (2 écritures équilibrées, journal AN). '
    + 'Le chargement est idempotent : relancer ne duplique rien.</p>'
    + '<div class="muted-sm" id="cfgDemoStatus" data-testid="cfg-demo-status" style="margin-bottom:8px;">Vérification…</div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;">'
    + '<button class="btn btn-primary" id="cfgDemoLoad" data-testid="cfg-demo-load" style="flex:1;justify-content:center;">Charger les données de démo 2024–2025</button>'
    + '<button class="btn btn-secondary" id="cfgDemoDelete" data-testid="cfg-demo-delete" style="flex:1;justify-content:center;">Supprimer les données de démo</button>'
    + '</div></div></div>';
}

async function refreshDemoStatus() {
  const el = $('#cfgDemoStatus');
  if (!el) return;
  try {
    const entries = await loadEntries();
    const found = DEMO_IDS.filter((id) => entries.some((e) => e.id === id));
    el.textContent = found.length === DEMO_IDS.length
      ? '✓ Données de démo chargées (' + found.join(', ') + ').'
      : found.length
        ? 'Partiellement chargées : ' + found.join(', ') + '.'
        : 'Non chargées.';
  } catch (e) {
    el.textContent = 'Statut indisponible : ' + errMsg(e);
  }
}

async function loadDemoData() {
  const btn = $('#cfgDemoLoad');
  btn.disabled = true;
  btn.textContent = 'Chargement…';
  try {
    const res = await fetch(DEMO_URL);
    if (!res.ok) throw new Error('Fichier de démo introuvable (' + res.status + ').');
    const data = await res.json();
    const ecritures = Array.isArray(data.ecritures) ? data.ecritures : [];
    if (!ecritures.length) throw new Error('Aucune écriture dans le fichier de démo.');
    for (const e of ecritures) {
      const v = validateEntry(e);
      if (!v.ok) throw new Error('Écriture ' + (e.id || '?') + ' invalide : ' + v.errors[0]);
    }
    for (const e of ecritures) await saveEntry(e); // upsert par entry.id -> idempotent
    toast(ecritures.length + ' écriture(s) de démo chargée(s) (idempotent).', 'success');
  } catch (e) {
    toast('Chargement impossible : ' + errMsg(e), 'error');
  }
  btn.disabled = false;
  btn.textContent = 'Charger les données de démo 2024–2025';
  refreshDemoStatus();
}

async function deleteDemoData() {
  const btn = $('#cfgDemoDelete');
  if (!btn.dataset.armed) {
    btn.dataset.armed = '1';
    btn.textContent = 'Confirmer la suppression ?';
    setTimeout(() => {
      if (document.body.contains(btn)) { delete btn.dataset.armed; btn.textContent = 'Supprimer les données de démo'; }
    }, 3000);
    return;
  }
  delete btn.dataset.armed;
  btn.disabled = true;
  try {
    for (const id of DEMO_IDS) await deleteEntryById(id);
    toast('Données de démo supprimées.', 'success');
  } catch (e) {
    toast('Suppression impossible : ' + errMsg(e), 'error');
  }
  btn.disabled = false;
  btn.textContent = 'Supprimer les données de démo';
  refreshDemoStatus();
}

function bindDemoSection() {
  if (!isAdmin()) return;
  const loadBtn = $('#cfgDemoLoad');
  const delBtn = $('#cfgDemoDelete');
  if (loadBtn) loadBtn.addEventListener('click', loadDemoData);
  if (delBtn) delBtn.addEventListener('click', deleteDemoData);
  refreshDemoStatus();
}

async function load() {
  shell().innerHTML = '<div class="loading-state">Chargement de la configuration…</div>';
  try {
    const [company, ifu, regime, country, overrides, r1, dirigeants, associes, employeeCount, cnssFrequency, tvaSubject, bicPrelevement, defaultAccounts] = await Promise.all([
      loadCompany(), loadCompanyIfu(), loadCompanyRegime(), loadCountry(), loadTaxOverrides(),
      loadCompanyR1(), loadDirigeants(), loadAssocies(), loadEmployeeCount(), loadCnssFrequency(),
      loadTvaSubject(), loadBicPrelevement(), loadDefaultAccounts(),
    ]);
    S.company = company; S.ifu = ifu; S.regime = regime; S.country = country; S.overrides = overrides;
    S.r1 = r1; S.dirigeants = dirigeants; S.associes = associes;
    S.employeeCount = employeeCount; S.cnssFrequency = cnssFrequency;
    S.tvaSubject = tvaSubject; S.bicPrelevement = bicPrelevement;
    S.defaultAccounts = defaultAccounts;
    render();
  } catch (e) {
    shell().innerHTML = errorHtml(errMsg(e));
    const r = $('#configRetry');
    if (r) r.addEventListener('click', load);
  }
}

export function renderConfigPage() {
  load();
}
