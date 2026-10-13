// FiscalMind Africa — pages d'administration (#/admin, protégée + garde admin).
//
// Port fidèle de l'appli d'origine :
// - GET admin-users -> { users: [...] } ; GET admin-stats -> {...} ;
// - POST admin-users : set_plan / set_admin / revoke / delete_user / resolve_unmatched ;
// - garde stricte : plan === 'admin' (is_admin lu depuis app_metadata côté
//   serveur) sinon redirection ; jamais d'action sur soi-même ni sur un admin.

import { esc, toast, $, confirmDialog } from '../ui.js';
import { getSession, supabaseService, getAccessToken } from '../auth.js';
import { refreshQuota, isAdmin } from '../licence.js';
import { navigate } from '../router.js';
import { planLabel, licenceInfo, canManageUser, fmtXof, fmtDateFR, PLAN_NAMES, planShare, maskEmail, errorDotColor, deployDotColor, pulseBadge, isMissingKeyError } from '../../../src/admin/format.js';

function shell() { return document.getElementById('appMain'); }

let TAB = 'overview';
let ALL_USERS = [];

/** Carte statistique réutilisée par les onglets Vue globale et Intégrations. */
function statCard(label, value, sub) {
  return '<div class="stat-card"><div class="stat-value">' + value + '</div>' +
    '<div class="stat-label">' + label + '</div>' +
    (sub ? '<div class="stat-sub">' + sub + '</div>' : '') + '</div>';
}

async function svcToken() {
  const svc = supabaseService();
  if (!svc) throw new Error('Service non configuré.');
  const token = await getAccessToken();
  if (!token) throw new Error('Non connecté.');
  return { svc, token };
}

export async function renderAdminPage() {
  const session = getSession();
  shell().innerHTML = '<div class="card"><p style="color:var(--text-muted);">Vérification des droits…</p></div>';
  await refreshQuota();
  if (!isAdmin()) {
    toast('Accès réservé aux administrateurs.', 'error');
    navigate('/journal');
    return;
  }
  shell().innerHTML =
    '<div class="admin-tabs">' +
      '<button class="admin-tab' + (TAB === 'overview' ? ' active' : '') + '" data-atab="overview">Vue globale</button>' +
      '<button class="admin-tab' + (TAB === 'users' ? ' active' : '') + '" data-atab="users">Utilisateurs</button>' +
      '<button class="admin-tab' + (TAB === 'integrations' ? ' active' : '') + '" data-atab="integrations" data-testid="tab-integrations">🔌 Intégrations</button>' +
      '<button class="admin-tab' + (TAB === 'sources' ? ' active' : '') + '" data-atab="sources">📚 Sources</button>' +
      '<button class="admin-tab' + (TAB === 'settings' ? ' active' : '') + '" data-atab="settings">⚙️ Paramètres</button>' +
    '</div>' +
    '<div id="adminContent"><p style="color:var(--text-muted);">Chargement…</p></div>';

  document.querySelectorAll('[data-atab]').forEach((b) => {
    b.addEventListener('click', () => { TAB = b.dataset.atab; renderAdminPage(); });
  });

  if (TAB === 'overview') await renderOverview(session);
  else if (TAB === 'settings') await renderSettings();
  else if (TAB === 'integrations') await renderIntegrations();
  else if (TAB === 'sources') await renderSources();
  else await renderUsers(session);
}

/* ------------------------------------------------------------------ */
/* Vue globale                                                         */
/* ------------------------------------------------------------------ */

async function renderOverview(session) {
  const box = $('#adminContent');
  try {
    const { svc, token } = await svcToken();
    const s = await svc.adminStats({ accessToken: token });
    const st = s.storage || {};
    const bp = (s.users && s.users.by_plan) || {};
    const tot = Math.max(1, (s.users && s.users.total) || 0);

    let html =
      '<div class="stat-grid">' +
      statCard('Inscrits', (s.users && s.users.total) || 0, '+' + ((s.users && s.users.new_7d) || 0) + ' cette semaine') +
      statCard('Actifs (30 j)', (s.users && s.users.active_30d) || 0) +
      statCard('Questions (mois)', (s.copilot && s.copilot.questions_month) || 0, ((s.copilot && s.copilot.questions_today) || 0) + " aujourd'hui") +
      statCard('Revenus', fmtXof(s.revenue && s.revenue.total_xof), ((s.revenue && s.revenue.count_done) || 0) + ' paiement(s)') +
      '</div>';

    html += '<div class="card"><h4 class="card-title">Répartition des plans</h4>' +
      Object.keys(PLAN_NAMES).map((p) => {
        const n = bp[p] || 0, pct = planShare(n, tot);
        return '<div style="margin-bottom:10px;"><div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:4px;"><span>' +
          PLAN_NAMES[p] + '</span><strong>' + n + '</strong></div>' +
          '<div class="progress-bar"><div class="progress-fill" style="width:' + pct + '%;"></div></div></div>';
      }).join('') + '</div>';

    const top = (s.copilot && s.copilot.top_users) || [];
    html += '<div class="card"><h4 class="card-title">Top utilisateurs (questions)</h4>' +
      (top.length ? top.map((t) =>
        '<div class="rowline"><span style="word-break:break-all;">' + esc(t.email) + '</span><strong>' + t.questions + ' quest.</strong></div>'
      ).join('') : '<p class="muted">Aucune question ce mois.</p>') + '</div>';

    const alerts = [];
    const unmatched = (s.alerts && s.alerts.unmatched_rows) || [];
    if (unmatched.length) {
      alerts.push('<div style="font-size:14px;margin-bottom:10px;">💳 <strong>' + unmatched.length + '</strong> paiement(s) non rapproché(s) :</div>');
      unmatched.forEach((r) => {
        alerts.push('<div class="alert-row"><span style="word-break:break-all;">' + esc(r.email || '?') +
          '<br><span class="muted-sm">' + esc(r.event_type || '') + ' · ' + fmtDateFR(r.created_at) + '</span></span>' +
          '<button class="btn btn-secondary btn-sm" data-resolve="' + r.id + '">Traité</button></div>');
      });
    }
    if (s.revenue && s.revenue.count_pending > 0) {
      alerts.push('<div style="font-size:14px;margin-bottom:10px;">⏳ <strong>' + s.revenue.count_pending + '</strong> paiement(s) en attente.</div>');
    }
    html += '<div class="card"><h4 class="card-title">Alertes</h4>' +
      (alerts.length ? alerts.join('') : '<p class="muted">✅ Rien à signaler.</p>') + '</div>';

    box.innerHTML = html;
    box.querySelectorAll('[data-resolve]').forEach((b) => {
      b.addEventListener('click', async () => {
        b.disabled = true;
        try {
          const { svc: s2, token: t2 } = await svcToken();
          await s2.adminAction({ accessToken: t2, action: 'resolve_unmatched', row_id: Number(b.dataset.resolve) });
          toast('Marqué comme traité.', 'success');
          renderOverview(session);
        } catch (e) {
          toast((e && e.message) || 'Échec.', 'error');
          b.disabled = false;
        }
      });
    });
  } catch (e) {
    box.innerHTML = '<p style="color:#DC2626;">Impossible de charger les statistiques.</p>';
  }
}

/* ------------------------------------------------------------------ */
/* Intégrations (Edge Function admin-integrations)                     */
/* ------------------------------------------------------------------ */

/** Pastille de couleur (point rond) pour les taux d'erreur et statuts. */
function colorDot(color) {
  return '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' +
    color + ';margin-right:6px;flex-shrink:0;"></span>';
}

/** Encadré d'aide affiché quand une clé externe n'est pas configurée. */
function missingKeyBox() {
  return '<div style="border:1px solid #F59E0B;background:#FFFBEB;border-radius:10px;padding:12px;">' +
    '<p style="margin:0 0 8px;font-size:14px;"><strong>🔑 Clé manquante</strong> — Ajoutez votre clé dans l\'onglet ⚙️ Paramètres.</p>' +
    '<button class="btn btn-primary btn-sm" data-goto-settings data-testid="goto-settings">⚙️ Aller aux paramètres</button></div>';
}

/** Branche les boutons « Aller aux paramètres » d'une section. */
function wireGotoSettings(box) {
  box.querySelectorAll('[data-goto-settings]').forEach((b) => {
    b.addEventListener('click', () => { TAB = 'settings'; renderAdminPage(); });
  });
}

async function renderIntegrations() {
  const box = $('#adminContent');
  const sectionHead = (title, btnId, testid) =>
    '<h4 class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">' +
    '<span>' + title + '</span>' +
    '<button class="btn btn-secondary btn-sm" id="' + btnId + '" data-testid="' + testid + '">🔄 Actualiser</button></h4>';
  box.innerHTML =
    '<div class="card" data-testid="integrations-saspay">' +
      sectionHead('💳 SasPay', 'refreshSasPay', 'refresh-saspay') +
      '<div id="integSasPayBody"><p class="muted">Chargement…</p></div></div>' +
    '<div class="card" data-testid="integrations-supabase">' +
      sectionHead('⚡ Supabase', 'refreshSupabase', 'refresh-supabase') +
      '<div id="integSupabaseBody"><p class="muted">Chargement…</p></div></div>' +
    '<div class="card" data-testid="integrations-cloudflare">' +
      sectionHead('☁️ Cloudflare', 'refreshCloudflare', 'refresh-cloudflare') +
      '<div id="integCloudflareBody"><p class="muted">Chargement…</p></div></div>' +
    '<div class="card" data-testid="integrations-ocr">' +
      sectionHead('🔍 OCR.space', 'refreshOcr', 'refresh-ocr') +
      '<div id="integOcrBody"><p class="muted">Chargement…</p></div></div>' +
    '<div class="card" data-testid="integrations-xkiro">' +
      sectionHead('🤖 IA (xKiro)', 'refreshXkiro', 'refresh-xkiro') +
      '<div id="integXkiroBody"><p class="muted">Chargement…</p></div></div>' +
    '<div class="card" data-testid="integrations-quotas">' +
      sectionHead('👥 Quotas par utilisateur', 'refreshQuotas', 'refresh-quotas') +
      '<div id="integQuotasBody"><p class="muted">Chargement…</p></div></div>';

  $('#refreshSasPay').addEventListener('click', () => loadSasPay());
  $('#refreshSupabase').addEventListener('click', () => loadSupabase());
  $('#refreshCloudflare').addEventListener('click', () => loadCloudflare());
  $('#refreshOcr').addEventListener('click', () => loadOcr());
  $('#refreshXkiro').addEventListener('click', () => loadXkiro());
  $('#refreshQuotas').addEventListener('click', () => loadQuotas());

  await Promise.allSettled([loadSasPay(), loadSupabase(), loadCloudflare(), loadOcr(), loadXkiro(), loadQuotas()]);
}

/**
 * Appelle admin-integrations pour un service et renvoie le JSON,
 * ou une erreur formatée à afficher (jamais de clé exposée).
 */
async function fetchIntegration(service, bodyId) {
  const box = $(bodyId);
  box.innerHTML = '<p class="muted">Chargement…</p>';
  try {
    const { svc, token } = await svcToken();
    const j = await svc.adminIntegrations({ accessToken: token, service });
    if (j && j.error) {
      if (isMissingKeyError(j.error)) {
        box.innerHTML = missingKeyBox();
        wireGotoSettings(box);
      } else {
        box.innerHTML = '<p style="color:#DC2626;">' + esc(j.error) + '</p>';
      }
      return null;
    }
    return j || {};
  } catch (e) {
    box.innerHTML = '<p style="color:#DC2626;">' + esc((e && e.message) || 'Échec du chargement.') + '</p>';
    return null;
  }
}

async function loadSasPay() {
  const j = await fetchIntegration('saspay', '#integSasPayBody');
  if (!j) return;
  const box = $('#integSasPayBody');
  const s30 = j.sales_30d || {};
  const sales = j.sales || [];

  let html = '<div class="stat-grid">' +
    statCard('Ventes (30 j)', s30.count != null ? s30.count : '—') +
    statCard('Chiffre d\'affaires', fmtXof(s30.total_xof)) +
    '</div>';

  html += '<div style="margin-top:4px;"><h4 class="card-title" style="font-size:15px;">Dernières transactions</h4>' +
    (sales.length ? sales.map((s) =>
      '<div class="card" style="margin-bottom:8px;padding:10px 12px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">' +
      '<strong style="font-size:13px;word-break:break-all;">' + esc(String(s.reference || s.id || '—')) + '</strong>' +
      '<span style="font-weight:600;">' + fmtXof(s.net_amount || s.requested_amount) + '</span></div>' +
      '<div class="muted-sm" style="margin-top:4px;">' + fmtDateFR(s.created_at) + ' · ' + esc(s.status || '—') + '</div></div>'
    ).join('') : '<p class="muted" style="text-align:center;">Aucune vente pour le moment.</p>') +
    '</div>';

  box.innerHTML = html;
}



async function loadSupabase() {
  const j = await fetchIntegration('supabase', '#integSupabaseBody');
  if (!j) return;
  const box = $('#integSupabaseBody');
  const fns = j.functions || [];
  const tables = j.tables || [];
  const taille = j.taille_bdd || '—';
  const quota = j.quota_bdd || '—';

  let html = '<div class="stat-grid" style="margin-bottom:12px;">' +
    '<div class="stat-card"><div class="stat-value">' + esc(String(taille)) + ' / ' + esc(String(quota)) + '</div><div class="stat-label">💾 Taille base</div></div>' +
    '<div class="stat-card"><div class="stat-value">' + esc(String(j.stockage_fichiers || '—')) + '</div><div class="stat-label">📁 Fichiers</div></div>' +
    '<div class="stat-card"><div class="stat-value">' + fns.length + '</div><div class="stat-label">⚡ Fonctions</div></div>' +
    '</div>';

  html += '<h4 class="card-title" style="margin:12px 0 8px;">📊 Tables</h4>' +
    '<div class="table-wrap"><table class="data-table">' +
    '<thead><tr><th>Table</th><th>Lignes</th></tr></thead><tbody>' +
    (tables.length ? tables.map((t) =>
      '<tr><td>' + esc(t.nom || '—') + '</td><td><strong>' + esc(String(t.lignes != null ? t.lignes : '—')) + '</strong></td></tr>'
    ).join('') : '<tr><td colspan="2" class="muted" style="text-align:center;">Aucune donnée.</td></tr>') +
    '</tbody></table></div>';

  html += '<h4 class="card-title" style="margin:12px 0 8px;">⚡ Fonctions Edge</h4>' +
    '<div>' + (fns.length ? fns.map((f) =>
      '<div class="rowline"><span>🟢 ' + esc(f.nom || f.name || '—') + '</span><span class="muted-sm">En ligne</span></div>'
    ).join('') : '<p class="muted">Aucune donnée.</p>') + '</div>';

  box.innerHTML = html;
}

async function loadCloudflare() {
  const j = await fetchIntegration('cloudflare', '#integCloudflareBody');
  if (!j) return;
  const box = $('#integCloudflareBody');
  const deps = j.deployments || [];

  let html = '';
  if (j.stockage_r2) {
    html += '<div class="rowline"><span>💾 Stockage R2</span><strong>' + esc(j.stockage_r2) + '</strong></div>';
  }

  box.innerHTML = deps.length ? deps.map((d) =>
    '<div class="rowline" style="align-items:flex-start;"><span style="display:flex;align-items:center;gap:2px;">' +
    colorDot(deployDotColor(d.status)) +
    '<span>' + esc(String(d.status || '—')) + '<br><span class="muted-sm">' +
    fmtDateFR(d.created_at || d.date) + '</span></span></span>' +
    (d.url ? '<a href="' + esc(d.url) + '" target="_blank" rel="noopener" style="word-break:break-all;font-size:13px;">' +
      esc(d.url) + '</a>' : '<span class="muted-sm">—</span>') +
    '</div>'
  ).join('') : '<p class="muted">Aucun déploiement récent.</p>';
  box.innerHTML = html;
}

async function loadOcr() {
  const j = await fetchIntegration('ocr', '#integOcrBody');
  if (!j) return;
  const box = $('#integOcrBody');
  box.innerHTML =
    '<div class="rowline"><span>Statut</span><strong>' + esc(j.statut || '—') + '</strong></div>' +
    '<div class="rowline"><span>Clé configurée</span><span class="muted">' + esc(j.cle_masquee || '—') + '</span></div>' +
    '<div class="rowline"><span>Quota mensuel</span><strong>' + esc(j.quota_mensuel || '—') + '</strong></div>' +
    '<div class="rowline"><span>Lectures (24h)</span><span class="muted">' + esc(String(j.lectures_24h ?? '—')) + '</span></div>' +
    '<div class="rowline"><span>Limite</span><span class="muted">' + esc(j.limite || '—') + '</span></div>';
}

async function loadXkiro() {
  const j = await fetchIntegration('xkiro', '#integXkiroBody');
  if (!j) return;
  const box = $('#integXkiroBody');
  box.innerHTML =
    '<div class="rowline"><span>Statut</span><strong>' + esc(j.statut || '—') + '</strong></div>' +
    '<div class="rowline"><span>Plan</span><span class="muted">' + esc(j.plan || '—') + '</span></div>' +
    '<div class="rowline"><span>Tokens (aujourd\'hui)</span><strong>' + esc(j.tokens_jour || '—') + '</strong></div>' +
    '<div class="rowline"><span>Solde wallet</span><span class="muted">' + esc(j.solde_wallet || '—') + '</span></div>';
}

async function loadQuotas() {
  const j = await fetchIntegration('quotas', '#integQuotasBody');
  if (!j) return;
  const box = $('#integQuotasBody');
  const lignes = j.utilisateurs || [];
  box.innerHTML =
    '<p class="muted-sm" style="margin-bottom:8px;">' + lignes.length + ' inscrit(s) — 30 derniers jours</p>' +
    (lignes.length ? lignes.map((u) =>
      '<div class="card" style="margin-bottom:8px;padding:10px 12px;">' +
      '<strong style="font-size:13px;word-break:break-all;">' + esc(u.email || '—') + '</strong>' +
      '<div class="muted-sm" style="margin:4px 0;">Inscrit : ' + esc(u.inscrit_le || '—') + '</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:6px 12px;font-size:13px;">' +
      '<span>🔍 <strong>' + esc(String(u.ocr_lectures ?? 0)) + '</strong></span>' +
      '<span>💬 <strong>' + esc(String(u.messages_copilot ?? 0)) + '</strong></span>' +
      '<span>🤖 <strong>' + esc(String(u.ia_tokens ?? 0)) + '</strong></span>' +
      '<span>📝 <strong>' + esc(String(u.ecritures ?? 0)) + '</strong></span>' +
      '<span>💾 <strong>' + esc(u.stockage_mo || '0 Mo') + '</strong></span>' +
      '</div></div>'
    ).join('') : '<p class="muted" style="text-align:center;">Aucun inscrit.</p>');
}

/* ------------------------------------------------------------------ */
/* Utilisateurs                                                        */
/* ------------------------------------------------------------------ */

async function renderUsers(session) {
  const box = $('#adminContent');
  box.innerHTML =
    '<div class="card"><input id="usersSearch" class="form-input" placeholder="🔍 Rechercher un email…" data-testid="users-search">' +
    '<p class="muted-sm" id="usersCount" style="margin:8px 0 0;"></p></div>' +
    '<div id="usersList"></div>' +
    '<div id="licModal"></div>';

  try {
    const { svc, token } = await svcToken();
    const j = await svc.adminListUsers({ accessToken: token });
    ALL_USERS = j.users || [];
    $('#usersCount').textContent = ALL_USERS.length + ' inscrit' + (ALL_USERS.length > 1 ? 's' : '');
    drawUsers(session);
    $('#usersSearch').addEventListener('input', () => drawUsers(session));
  } catch (e) {
    $('#usersList').innerHTML = '<div class="card" style="text-align:center;color:#DC2626;">Impossible de charger la liste.</div>';
  }
}

function drawUsers(session) {
  const box = $('#usersList');
  const q = ($('#usersSearch').value || '').trim().toLowerCase();
  const list = ALL_USERS.filter((u) => !q || (u.email || '').toLowerCase().includes(q));
  if (!list.length) {
    box.innerHTML = '<div class="card muted" style="text-align:center;">Aucun inscrit trouvé.</div>';
    return;
  }
  box.innerHTML = list.map((u) => {
    const lic = licenceInfo(u);
    const badge = u.is_admin ? 'badge-admin' : 'badge-plan';
    const manageable = canManageUser(u, session.uid);
    const btns = manageable
      ? '<div style="margin-top:8px;display:flex;gap:8px;">' +
        '<button class="btn btn-secondary btn-sm" data-manage="' + u.id + '">Gérer</button>' +
        '<button class="btn btn-danger btn-sm" data-deluser="' + u.id + '" title="Supprimer ce compte"><i class="fas fa-trash"></i></button></div>'
      : (u.id === session.uid ? '<div class="muted-sm" style="margin-top:4px;">Vous</div>' : '');
    return '<div class="card" style="margin-bottom:10px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">' +
      '<strong style="word-break:break-all;font-size:14px;">' + esc(u.email || '—') + '</strong>' +
      '<span class="' + badge + '">' + esc(planLabel(u)) + '</span></div>' +
      '<div class="muted-sm" style="margin-top:6px;">Inscrit le ' + fmtDateFR(u.created_at) +
      ' · Dernière connexion : ' + (u.last_sign_in_at ? fmtDateFR(u.last_sign_in_at) : 'Jamais') + '</div>' +
      '<div style="margin-top:4px;font-size:13px;' + (lic.expired ? 'color:#DC2626;' : '') + '">' + esc(lic.text) + '</div>' +
      btns + '</div>';
  }).join('');

  box.querySelectorAll('[data-manage]').forEach((b) =>
    b.addEventListener('click', () => openLicenseModal(b.dataset.manage, session)));
  box.querySelectorAll('[data-deluser]').forEach((b) =>
    b.addEventListener('click', () => deleteUser(b.dataset.deluser, session)));
}

function openLicenseModal(uid, session) {
  const u = ALL_USERS.find((x) => x.id === uid);
  if (!u || !canManageUser(u, session.uid)) return;
  const lic = licenceInfo(u);
  $('#licModal').innerHTML =
    '<div class="modal-overlay active"><div class="modal">' +
    '<h3>Gérer la licence</h3>' +
    '<p class="muted-sm">' + esc(u.email || '') + '</p>' +
    '<p style="font-size:13px;">Plan actuel : <strong>' + esc(planLabel(u)) + '</strong>' +
    (lic.text !== '—' ? ' · ' + esc(lic.text) : '') + '</p>' +
    '<label>Plan<select id="licPlan" class="form-input">' +
      ['demo', 'starter', 'pro', 'enterprise'].map((p) =>
        '<option value="' + p + '"' + ((u.plan || 'demo') === p ? ' selected' : '') + '>' + p.toUpperCase() + '</option>').join('') +
    '</select></label>' +
    '<label>Durée (jours)<input id="licDays" type="number" class="form-input" value="30" min="1"></label>' +
    '<label class="checkline"><input type="checkbox" id="licAdmin"' + (u.is_admin ? ' checked' : '') + '> Administrateur</label>' +
    '<div class="modal-actions">' +
      '<button class="btn btn-secondary" id="licCancel">Annuler</button>' +
      '<button class="btn btn-danger" id="licRevoke">Révoquer</button>' +
      '<button class="btn btn-primary" id="licSave">Enregistrer</button>' +
    '</div></div></div>';

  $('#licCancel').addEventListener('click', closeLicModal);
  $('#licSave').addEventListener('click', async () => {
    const plan = $('#licPlan').value;
    const days = parseInt($('#licDays').value, 10) || 30;
    const isAdm = $('#licAdmin').checked;
    try {
      const { svc, token } = await svcToken();
      await svc.adminAction({ accessToken: token, action: 'set_plan', user_id: uid, plan, days });
      await svc.adminAction({ accessToken: token, action: 'set_admin', user_id: uid, is_admin: isAdm });
      closeLicModal();
      toast('Licence mise à jour.', 'success');
      renderUsers(session);
    } catch (e) { toast((e && e.message) || 'Échec.', 'error'); }
  });
  $('#licRevoke').addEventListener('click', async () => {
    if (!await confirmDialog('Révoquer la licence ?', 'Le compte repassera en démo.', { okLabel: 'Révoquer', danger: true })) return;
    try {
      const { svc, token } = await svcToken();
      await svc.adminAction({ accessToken: token, action: 'revoke', user_id: uid });
      closeLicModal();
      toast('Licence révoquée.', 'success');
      renderUsers(session);
    } catch (e) { toast((e && e.message) || 'Échec.', 'error'); }
  });
}

function closeLicModal() { $('#licModal').innerHTML = ''; }

async function deleteUser(uid, session) {
  const u = ALL_USERS.find((x) => x.id === uid);
  if (!u || !canManageUser(u, session.uid)) return;
  const email = u.email || '?';
  // Double confirmation (plus stricte que l'original : action irréversible)
  if (!await confirmDialog('Supprimer le compte ?', email + '\nIl ne pourra plus se connecter et ses données liées seront effacées.', { okLabel: 'Continuer', danger: true })) return;
  if (!await confirmDialog('Confirmation finale', 'Supprimer définitivement ' + email + ' ?\nCette action est IRRÉVERSIBLE.', { okLabel: 'Supprimer', danger: true })) return;
  try {
    const { svc, token } = await svcToken();
    await svc.adminAction({ accessToken: token, action: 'delete_user', user_id: uid });
    toast('Compte ' + email + ' supprimé.', 'success');
    renderUsers(session);
  } catch (e) { toast((e && e.message) || 'Échec de la suppression.', 'error'); }
}

/* ------------------------------------------------------------------ */
/* Paramètres système (Edge Function admin-settings)                   */
/* ------------------------------------------------------------------ */

const AI_MODELS = [
  'qwen/qwen3.8-max:free',
  'anthropic/claude-haiku-4.5',
  'anthropic/claude-sonnet-4.6',
];
const QUOTA_PLANS = ['demo', 'starter', 'pro', 'enterprise'];

/** Clés externes gérables depuis l'onglet Paramètres (jamais affichées en clair). */
const EXT_KEYS = ['chariow_api_key', 'cloudflare_api_token', 'cloudflare_account_id', 'supabase_mgmt_token', 'ocr_api_key'];

/**
 * Champ « clé API externe » : même pattern que le champ ai_api_key —
 * type password + bouton révéler/masquer, jamais de valeur en clair,
 * le masque serveur sert de placeholder.
 */
function extKeyField(key, label, s) {
  const placeholder = s[key]
    ? esc(s[key]) + ' — laisse vide pour conserver'
    : 'Colle la clé ici';
  return '<label>' + label +
    '<input id="ext_' + key + '" type="password" class="form-input" autocomplete="new-password" placeholder="' + placeholder + '"></label>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:4px 0 8px;">' +
    '<button class="btn btn-secondary btn-sm" data-toggle="ext_' + key + '">👁️ Révéler</button></div>';
}

async function renderSettings() {
  const box = $('#adminContent');
  box.innerHTML = '<p style="color:var(--text-muted);">Chargement…</p>';
  let s = {};
  try {
    const { svc, token } = await svcToken();
    const j = await svc.adminSettings({ accessToken: token });
    s = (j && j.settings) || {};
  } catch (e) {
    box.innerHTML = '<p style="color:#DC2626;">Impossible de charger les paramètres.</p>';
    return;
  }

  const model = s.ai_model || AI_MODELS[0];
  const modelKnown = AI_MODELS.includes(model);
  const keyPlaceholder = s.ai_api_key
    ? esc(s.ai_api_key) + ' — laisse vide pour conserver'
    : 'Colle ta clé API ici';

  box.innerHTML =
    '<div class="card"><h4 class="card-title">🤖 Fournisseur IA</h4>' +
    '<label>Fournisseur<select id="setProvider" class="form-input">' +
      '<option value="xkiro"' + ((s.ai_provider || 'xkiro') === 'xkiro' ? ' selected' : '') + '>xKiro</option>' +
      '<option value="anthropic"' + (s.ai_provider === 'anthropic' ? ' selected' : '') + '>Anthropic (direct)</option>' +
    '</select></label>' +
    '<label>Clé API<input id="setApiKey" type="password" class="form-input" autocomplete="new-password" placeholder="' + keyPlaceholder + '"></label>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:4px 0 8px;">' +
      '<button class="btn btn-secondary btn-sm" id="toggleKey">👁️ Révéler</button>' +
      '<button class="btn btn-secondary btn-sm" id="testAi">🔌 Tester la connexion</button>' +
    '</div>' +
    '<label>Modèle<select id="setModel" class="form-input">' +
      AI_MODELS.map((m) =>
        '<option value="' + esc(m) + '"' + (model === m ? ' selected' : '') + '>' + esc(m) + '</option>').join('') +
      '<option value="__custom"' + (modelKnown ? '' : ' selected') + '>✏️ Personnalisé…</option>' +
    '</select></label>' +
    '<div id="customModelWrap" style="' + (modelKnown ? 'display:none;' : '') + 'margin-top:8px;">' +
    '<label>Modèle personnalisé<input id="setModelCustom" class="form-input" value="' + (modelKnown ? '' : esc(model)) + '" placeholder="fournisseur/modele"></label></div>' +
    '<button class="btn btn-primary" id="saveAi" style="margin-top:10px;">💾 Enregistrer la configuration IA</button>' +
    '<p class="muted-sm" id="aiStatus" style="margin:8px 0 0;"></p></div>' +

    '<div class="card"><h4 class="card-title">📊 Quotas mensuels (questions)</h4>' +
    QUOTA_PLANS.map((p) =>
      '<label>Plan ' + p.toUpperCase() +
      '<input type="number" min="0" step="1" class="form-input" id="quota_' + p +
      '" value="' + esc(String(s['quota_' + p] != null ? s['quota_' + p] : '')) + '" placeholder="défaut"></label>'
    ).join('') +
    '<button class="btn btn-primary" id="saveQuotas" style="margin-top:10px;">💾 Enregistrer les quotas</button>' +
    '<p class="muted-sm">Laisse un champ vide pour garder le quota par défaut du code.</p></div>' +

    '<div class="card" data-testid="external-keys-section"><h4 class="card-title">🔑 Clés API externes</h4>' +
    extKeyField('chariow_api_key', 'Clé API Chariow', s) +
    extKeyField('cloudflare_api_token', 'Token API Cloudflare', s) +
    extKeyField('ocr_api_key', 'Clé API OCR.space', s) +
    '<label>Account ID Cloudflare (non sensible)' +
    '<input id="ext_cloudflare_account_id" type="text" class="form-input" autocomplete="off"' +
    ' value="' + esc(s.cloudflare_account_id || '') + '" placeholder="Identifiant du compte Cloudflare"></label>' +
    extKeyField('supabase_mgmt_token', 'Token management Supabase', s) +
    '<button class="btn btn-primary" id="saveExtKeys" style="margin-top:10px;">💾 Enregistrer les clés</button>' +
    '<p class="muted-sm">Un champ vide laisse la valeur existante inchangée. Les secrets ne sont jamais affichés en clair.</p></div>';

  $('#toggleKey').addEventListener('click', () => {
    const inp = $('#setApiKey');
    const show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    $('#toggleKey').textContent = show ? '🙈 Masquer' : '👁️ Révéler';
  });

  $('#setModel').addEventListener('change', () => {
    $('#customModelWrap').style.display = $('#setModel').value === '__custom' ? '' : 'none';
  });

  // Révéler / masquer pour les 3 champs secrets de la section Clés API externes
  // (même pattern que le champ ai_api_key).
  box.querySelectorAll('[data-toggle]').forEach((b) => {
    b.addEventListener('click', () => {
      const inp = document.getElementById(b.dataset.toggle);
      if (!inp) return;
      const show = inp.type === 'password';
      inp.type = show ? 'text' : 'password';
      b.textContent = show ? '🙈 Masquer' : '👁️ Révéler';
    });
  });

  $('#saveExtKeys').addEventListener('click', async () => {
    const btn = $('#saveExtKeys'); btn.disabled = true;
    try {
      for (const k of EXT_KEYS) {
        const inp = document.getElementById('ext_' + k);
        const v = inp ? inp.value.trim() : '';
        if (v !== '') await saveOne(k, v); // champ vide = on ne touche pas à la valeur existante
      }
      toast('Clés enregistrées.', 'success');
      renderSettings(); // rafraîchir (masques à jour)
    } catch (e) {
      toast((e && e.message) || "Échec de l'enregistrement.", 'error');
      btn.disabled = false;
    }
  });

  async function saveOne(key, value) {
    const { svc, token } = await svcToken();
    await svc.adminSettings({ accessToken: token, key, value });
  }

  $('#saveAi').addEventListener('click', async () => {
    const btn = $('#saveAi'); btn.disabled = true;
    try {
      await saveOne('ai_provider', $('#setProvider').value);
      const keyVal = $('#setApiKey').value.trim();
      if (keyVal) await saveOne('ai_api_key', keyVal); // champ vide = on ne touche pas à la clé existante
      const mSel = $('#setModel').value;
      const mVal = mSel === '__custom' ? $('#setModelCustom').value.trim() : mSel;
      if (mVal) await saveOne('ai_model', mVal);
      toast('Paramètre enregistré.', 'success');
      renderSettings(); // rafraîchir (clé masquée à jour)
    } catch (e) {
      toast((e && e.message) || "Échec de l'enregistrement.", 'error');
      btn.disabled = false;
    }
  });

  $('#saveQuotas').addEventListener('click', async () => {
    const btn = $('#saveQuotas'); btn.disabled = true;
    try {
      for (const p of QUOTA_PLANS) {
        const v = $('#quota_' + p).value.trim();
        if (v !== '') await saveOne('quota_' + p, v); // vide = quota par défaut conservé
      }
      toast('Paramètre enregistré.', 'success');
    } catch (e) { toast((e && e.message) || "Échec de l'enregistrement.", 'error'); }
    btn.disabled = false;
  });

  $('#testAi').addEventListener('click', async () => {
    const btn = $('#testAi'); btn.disabled = true;
    const st = $('#aiStatus');
    st.textContent = 'Test en cours…';
    try {
      const { svc, token } = await svcToken();
      const r = await svc.adminSettings({ accessToken: token, action: 'test_ai' });
      if (r && r.ok) {
        st.textContent = '✅ Connexion IA réussie.';
        toast('Connexion IA réussie.', 'success');
      } else {
        st.textContent = '❌ ' + ((r && r.error) || 'Échec du test.');
        toast('Échec du test : ' + ((r && r.error) || ''), 'error');
      }
    } catch (e) {
      st.textContent = '❌ ' + ((e && e.message) || 'Échec du test.');
      toast((e && e.message) || 'Échec du test.', 'error');
    }
    btn.disabled = false;
  });
}

/* ------------------------------------------------------------------ */
/* Onglet Sources OHADA — référentiel des sources officielles par pays */
/* ------------------------------------------------------------------ */

const SOURCES_OHADA = [
  { pays: "Bénin", iso: "BJ", fiscal: { nom: "DGI", url: "https://impots.bj/", statut: "verifiee" }, social: { nom: "CNSS", url: "https://cnss.bj/", statut: "verifiee" } },
  { pays: "Burkina Faso", iso: "BF", fiscal: { nom: "DGI", url: "https://dgi.bf/", statut: "verifiee" }, social: { nom: "CNSS", url: "https://cnssbf.org/", statut: "verifiee" } },
  { pays: "Cameroun", iso: "CM", fiscal: { nom: "DGI", url: "https://www.impots.cm/fr/dgi", statut: "verifiee" }, social: { nom: "CNPS", url: "https://www.cnps.cm/fr/", statut: "verifiee" } },
  { pays: "Centrafrique", iso: "CF", fiscal: { nom: "DGI", url: null, statut: "a_valider" }, social: { nom: "CNSS", url: "https://cnsscentrafrique.org/", statut: "verifiee" } },
  { pays: "Comores", iso: "KM", fiscal: { nom: "DGI", url: null, statut: "a_valider" }, social: { nom: "Prévoyance sociale", url: null, statut: "a_valider" } },
  { pays: "Congo", iso: "CG", fiscal: { nom: "DGI", url: null, statut: "a_valider" }, social: { nom: "CNSS", url: "https://www.cnss.cg/", statut: "verifiee" } },
  { pays: "Côte d'Ivoire", iso: "CI", fiscal: { nom: "DGI", url: "http://dgi.gouv.ci/", statut: "verifiee" }, social: { nom: "CNPS", url: "https://www.cnps.ci/", statut: "verifiee" } },
  { pays: "Gabon", iso: "GA", fiscal: { nom: "DGI", url: "https://dgi.ga/", statut: "verifiee" }, social: { nom: "CNSS", url: "https://cnss.ga/", statut: "verifiee" } },
  { pays: "Guinée", iso: "GN", fiscal: { nom: "DGI", url: "https://dgi.gov.gn/", statut: "verifiee" }, social: { nom: "CNSS", url: "https://cnss.gov.gn/", statut: "verifiee" } },
  { pays: "Guinée-Bissau", iso: "GW", fiscal: { nom: "DGCI", url: null, statut: "a_valider" }, social: { nom: "INSS", url: "https://www.inss.gw/pt", statut: "verifiee" } },
  { pays: "Guinée équatoriale", iso: "GQ", fiscal: { nom: "DGI", url: null, statut: "a_valider" }, social: { nom: "INSESO", url: "https://www.inseso.org/fr/", statut: "verifiee" } },
  { pays: "Mali", iso: "ML", fiscal: { nom: "DGI", url: "https://www.dgi.gouv.ml/", statut: "verifiee" }, social: { nom: "INPS", url: null, statut: "a_valider" } },
  { pays: "Niger", iso: "NE", fiscal: { nom: "DGI", url: "https://finances.gouv.ne/", statut: "verifiee" }, social: { nom: "CNSS", url: "https://cnss.ne/", statut: "verifiee" } },
  { pays: "RD Congo", iso: "CD", fiscal: { nom: "DGI", url: "https://dgi.gouv.cd/", statut: "verifiee" }, social: { nom: "CNSS", url: "https://cnss.cd/", statut: "verifiee" } },
  { pays: "Sénégal", iso: "SN", fiscal: { nom: "DGID", url: null, statut: "a_valider" }, social: { nom: "CNSS/IPRES", url: null, statut: "a_valider" } },
  { pays: "Tchad", iso: "TD", fiscal: { nom: "DGI", url: "https://dgi.td/", statut: "verifiee" }, social: { nom: "CNPS", url: null, statut: "a_valider" } },
  { pays: "Togo", iso: "TG", fiscal: { nom: "Direction des impôts", url: null, statut: "a_valider" }, social: { nom: "CNSS", url: "https://cnss.tg/", statut: "verifiee" } },
];

async function renderSources() {
  const box = $('#adminContent');
  const badge = (statut) => statut === 'verifiee'
    ? '<span style="color:#16A34A;">✅ Vérifiée</span>'
    : '<span style="color:#D97706;">⏳ À valider</span>';
  const lien = (s) => s.url
    ? '<a href="' + esc(s.url) + '" target="_blank" rel="noopener" style="font-size:12px;word-break:break-all;">' + esc(s.nom) + '</a>'
    : '<span class="muted-sm">' + esc(s.nom) + ' — source en cours de validation</span>';

  const aValider = SOURCES_OHADA.filter(p => p.fiscal.statut === 'a_valider' || p.social.statut === 'a_valider').length;

  box.innerHTML =
    '<div class="card"><h4 class="card-title">📚 Sources officielles OHADA</h4>' +
    '<p class="muted-sm">Référentiel du 11/10/2026 — ' + SOURCES_OHADA.length + ' pays · ' +
    '<strong>' + aValider + ' pays</strong> avec sources à valider</p>' +
    '<p class="muted-sm">Couverture OHADA : 17 États membres. Les données fiscales et sociales sont compilées à partir des administrations fiscales nationales, des caisses de sécurité sociale et des sources communautaires OHADA.</p></div>' +
    '<div class="card"><h4 class="card-title">🌍 Sources communautaires</h4>' +
    '<div class="rowline"><span>OHADA — États membres</span><a href="https://www.ohada.org/les-etats-membres-de-lohada/" target="_blank" rel="noopener" style="font-size:12px;">ohada.org</a></div>' +
    '<div class="rowline"><span>Cleiss — Conventions</span><a href="https://www.cleiss.fr/docs/textes/" target="_blank" rel="noopener" style="font-size:12px;">cleiss.fr</a></div>' +
    '<div class="rowline"><span>CIPRES</span><span class="muted-sm">18 États (17 OHADA + Madagascar)</span></div></div>' +
    SOURCES_OHADA.map(p =>
      '<div class="card" style="margin-bottom:8px;"><h4 class="card-title" style="font-size:15px;">' + esc(p.pays) +
      ' <span class="muted-sm">(' + p.iso + ')</span></h4>' +
      '<div class="rowline"><span>🏛️ Fiscal : ' + lien(p.fiscal) + '</span>' + badge(p.fiscal.statut) + '</div>' +
      '<div class="rowline"><span>🤝 Social : ' + lien(p.social) + '</span>' + badge(p.social.statut) + '</div></div>'
    ).join('');
}
