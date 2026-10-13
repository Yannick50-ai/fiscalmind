// FiscalMind Africa — Mode démo (visite sans compte).
// Quand actif : les vrais modules (Journal, États, Copilote, Lettrage, Calendrier)
// s'ouvrent avec les données de démonstration, en lecture seule.
// Le flag est en mémoire uniquement (règle « zéro stockage local ») :
// un rechargement de page fait sortir du mode démo.

let demoModeActive = false;
let demoEntries = null;

export function isDemoMode() {
  return demoModeActive;
}

export function enterDemoMode() {
  demoModeActive = true;
  demoEntries = null; // recharge au prochain accès
}

export function exitDemoMode() {
  demoModeActive = false;
  demoEntries = null;
}

/** Charge les écritures de démo (mise en cache mémoire). */
export async function getDemoEntries() {
  if (demoEntries) return demoEntries;
  const res = await fetch('demo-data-2024-2025.json');
  if (!res.ok) throw new Error('Données de démo indisponibles.');
  const data = await res.json();
  demoEntries = (data && data.ecritures) || [];
  return demoEntries;
}

/** Bandeau "Mode démo" à afficher en haut de chaque module. */
export function demoBannerHtml() {
  return '<div style="background:#FEF3C7;border:1px solid #F59E0B;border-radius:10px;'
    + 'padding:10px 14px;margin-bottom:14px;display:flex;align-items:center;gap:10px;">'
    + '<span style="font-size:20px;">👁️</span>'
    + '<div style="flex:1;"><strong>Mode démo — lecture seule.</strong>'
    + '<div style="font-size:12px;color:#92400E;">Explorez les vrais modules avec des données d\'exemple. '
    + '<a href="#/connexion?tab=signup" style="color:#EA580C;font-weight:600;">Créez un compte gratuit</a> pour utiliser vos propres données.</div></div>'
    + '<button class="btn btn-secondary btn-sm" id="demoExitBtn" style="flex-shrink:0;">Quitter</button>'
    + '</div>';
}

/** Active le bouton "Quitter" du bandeau démo. */
export function wireDemoExit() {
  const btn = document.getElementById('demoExitBtn');
  if (btn) btn.addEventListener('click', () => {
    exitDemoMode();
    window.location.hash = '#/';
    window.location.reload();
  });
}
