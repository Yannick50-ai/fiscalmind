// FiscalMind Africa — helpers UI partagés (coquille applicative).
// Aucune dépendance métier : uniquement du formatage et des utilitaires DOM.

/** Échappe le HTML (anti-XSS sur les saisies utilisateur). */
export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** 1234567 -> "1 234 567,00" (montants en FCFA). */
export function fmt(n) {
  if (!n) return '';
  return Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** "2026-03-15" -> "15/03/2026". */
export function fmtDate(iso) {
  const p = String(iso || '').split('-');
  return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : String(iso || '');
}

/** Date du jour au format ISO (AAAA-MM-JJ). */
export function todayISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

/** Toast (utilise le conteneur existant de la landing). */
export function toast(msg, type) {
  const box = document.getElementById('toastContainer');
  if (!box) return;
  const el = document.createElement('div');
  el.className = 'toast toast-' + (type || 'info');
  el.innerHTML = '<div class="toast-icon"><i class="fas fa-' +
    (type === 'error' ? 'exclamation-circle' : type === 'success' ? 'check-circle' : 'info-circle') +
    '"></i></div><div style="font-size:14px;">' + esc(msg) + '</div>';
  box.appendChild(el);
  setTimeout(() => el.remove(), 4500);
}

/** Petit sélecteur. */
export function $(sel, root) { return (root || document).querySelector(sel); }
export function $all(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

/** Ligne du tutoriel de bienvenue (emoji + titre + description). */
function tutorialItem(emoji, title, desc) {
  return '<div style="display:flex;gap:12px;align-items:flex-start;">'
    + '<div style="font-size:26px;line-height:1;">' + emoji + '</div>'
    + '<div><strong style="font-size:15px;">' + esc(title) + '</strong>'
    + '<p style="margin:4px 0 0;font-size:13px;color:#666;">' + esc(desc) + '</p></div></div>';
}

/**
 * Tutoriel de bienvenue : présenté une seule fois par UTILISATEUR après l'inscription.
 * Le flag est stocké côté serveur (par compte), pas en localStorage (par navigateur).
 * Explique les fonctionnalités essentielles du SaaS en langage simple.
 * onDone est appelé à la fermeture (bouton "C'est parti !").
 */
export async function showWelcomeTutorial(onDone) {
  const done = () => { if (onDone) onDone(); };
  let seen = false;
  let markSeen;
  try {
    // Flag par utilisateur (serveur).
    const { getSetting, setSetting } = await import('./store.js');
    seen = await getSetting('tutorial_seen', false);
    markSeen = () => setSetting('tutorial_seen', true).catch(() => {});
  } catch (e) {
    // Serveur indisponible : repli sur localStorage, et en cas d'échec
    // total on MONTRE le tuto (mieux vaut une fois de trop que jamais).
    try {
      seen = !!localStorage.getItem('fm_tutorial_seen');
    } catch (e2) { seen = false; }
    markSeen = () => { try { localStorage.setItem('fm_tutorial_seen', '1'); } catch (e3) {} };
  }
  if (seen) { done(); return; }
  const overlay = document.createElement('div');
  overlay.id = 'welcomeTutorial';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
  overlay.innerHTML =
    '<div style="background:#fff;border-radius:16px;max-width:430px;width:100%;padding:24px;max-height:86vh;overflow-y:auto;box-shadow:0 10px 40px rgba(0,0,0,0.3);">'
    + '<h2 style="margin:0 0 6px;font-size:20px;">🎉 Bienvenue sur FiscalMind Africa !</h2>'
    + '<p style="color:#666;font-size:14px;margin:0 0 18px;">Voici l\'essentiel pour bien démarrer :</p>'
    + '<div style="display:flex;flex-direction:column;gap:14px;margin-bottom:22px;">'
    + tutorialItem('⚙️', '1. Configurez votre entreprise', 'Renseignez le nom, l\'IFU et les infos de votre société dans Configuration.')
    + tutorialItem('📝', '2. Tenez votre journal', 'Saisissez vos écritures comptables (achats, ventes, paie…) au quotidien.')
    + tutorialItem('📸', '3. Photographiez vos factures', 'L\'OCR lit la facture et propose les écritures : vous validez en un clic.')
    + tutorialItem('🤖', '4. Interrogez le copilote IA', 'Posez vos questions comptables et fiscales en français, avec les bons numéros de compte.')
    + tutorialItem('📊', '5. Sortez vos états financiers', 'Balance, grand-livre, bilan et compte de résultat calculés depuis votre journal.')
    + '</div>'
    + '<button id="tutorialStart" class="btn btn-primary" style="width:100%;justify-content:center;padding:12px;font-size:16px;">C\'est parti !</button>'
    + '</div>';
  document.body.appendChild(overlay);
  document.getElementById('tutorialStart').addEventListener('click', () => {
    try { markSeen(); } catch (e) {}
    overlay.remove();
    if (onDone) onDone();
  });
}
