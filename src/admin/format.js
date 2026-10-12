/**
 * FiscalMind Africa — helpers purs pour les pages d'administration.
 *
 * Logique portée de `renderUsers` / `renderAdminStats` de l'appli d'origine
 * (badges de plan, statut de licence, anti-auto-modification).
 * 100 % pur : aucune dépendance DOM.
 */

/** Libellé du plan d'un inscrit (port de renderUsers). */
export function planLabel(u) {
  if (!u) return '—';
  return u.is_admin ? 'ADMIN' : (u.plan || 'démo').toUpperCase();
}

/**
 * Statut de licence d'un inscrit.
 * Port de la logique de renderUsers :
 * - démo : 3 jours après created_at ;
 * - autres plans : plan_expires_at ;
 * - admin : pas de licence affichée.
 * Retourne { text, expired }.
 */
export function licenceInfo(u, nowMs) {
  const now = typeof nowMs === 'number' ? nowMs : Date.now();
  if (!u || u.is_admin) return { text: '—', expired: false };
  let exp = null;
  if (u.plan === 'demo' && u.created_at) {
    exp = new Date(new Date(u.created_at).getTime() + 3 * 86400000);
  } else if (u.plan_expires_at) {
    exp = new Date(u.plan_expires_at);
  }
  if (!exp || Number.isNaN(exp.getTime())) return { text: '—', expired: false };
  const expired = exp.getTime() < now;
  return {
    text: expired ? 'Expirée' : "Jusqu'au " + exp.toLocaleDateString('fr-FR'),
    expired,
  };
}

/**
 * Un admin peut-il gérer cet inscrit ?
 * Comme l'original : jamais sur un compte admin, et jamais sur soi-même
 * (anti-auto-modification : on ne peut ni se rétrograder ni se supprimer).
 */
export function canManageUser(u, myUid) {
  if (!u || !u.id) return false;
  if (u.id === myUid) return false;
  if (u.is_admin) return false;
  return true;
}

/** Montant en XOF (port de fmtXof). */
export function fmtXof(n) {
  return (n || 0).toLocaleString('fr-FR') + ' XOF';
}

/** Date courte fr-FR, '—' si absente. */
export function fmtDateFR(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR');
}

/** Libellés des plans pour la vue globale (port de renderAdminStats). */
export const PLAN_NAMES = {
  demo: 'Démo',
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
  admin: 'Admin',
};

/** Pourcentage d'un plan pour les barres de progression. */
export function planShare(count, total) {
  const t = Math.max(1, total || 0);
  return Math.round(((count || 0) * 100) / t);
}

/* ------------------------------------------------------------------ */
/* Intégrations admin (onglet 🔌 Intégrations) — helpers purs           */
/* ------------------------------------------------------------------ */

/**
 * Masque un email pour l'affichage admin : 2 premiers caractères de la
 * partie locale + '***' ; le domaine est conservé.
 */
export function maskEmail(email) {
  if (!email || typeof email !== 'string') return '—';
  const at = email.indexOf('@');
  if (at <= 0) return '—';
  const local = email.slice(0, at);
  const shown = local.length <= 2 ? local : local.slice(0, 2);
  return shown + '***' + email.slice(at);
}

/**
 * Couleur de la pastille de taux d'erreur d'une Edge Function :
 * verte < 1 %, orange < 5 %, rouge sinon.
 */
export function errorDotColor(rate) {
  const r = Number(rate) || 0;
  if (r < 1) return '#16A34A';
  if (r < 5) return '#EA7C1F';
  return '#DC2626';
}

/** Couleur de la pastille d'un déploiement selon son statut. */
export function deployDotColor(status) {
  const st = String(status || '').toLowerCase();
  if (st === 'success' || st === 'succeeded' || st === 'ok' || st === 'réussi') return '#16A34A';
  if (st === 'failed' || st === 'failure' || st === 'error' || st === 'échec') return '#DC2626';
  return '#EA7C1F';
}

/** Badge d'état du pulse Chariow. */
export function pulseBadge(active) {
  return active ? '🟢 Actif' : '🔴 Inactif';
}

/**
 * L'erreur renvoyée par l'API signifie-t-elle qu'une clé externe
 * n'est pas configurée ? (alors on propose l'encadré d'aide).
 */
export function isMissingKeyError(error) {
  return typeof error === 'string' && error.includes('non configuré');
}
