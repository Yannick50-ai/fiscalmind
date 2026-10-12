// FiscalMind Africa — coquille applicative (phase 2 de la migration).
// Routeur hash : '#/' landing (existante) · '#/connexion' · '#/journal' (protégée).
// La landing reste gérée par main.js ; ce module affiche/masque la coquille.

import { startRouter, navigate, parseHash } from './router.js';
import { renderAuthPage } from './pages/auth.js';
import { renderJournalPage } from './pages/journal.js';
import { renderEtatsPage } from './pages/etats.js';
import { renderLettragePage } from './pages/lettrage.js';
import { renderCalendrierPage } from './pages/calendrier.js';
import { renderCopilotePage } from './pages/copilote.js';
import { renderAdminPage } from './pages/admin.js';
import { renderDashboardPage } from './pages/dashboard.js';
import { renderPilotagePage } from './pages/pilotage.js';
import { renderRatiosPage } from './pages/ratios.js';
import { renderNotesPage } from './pages/notes.js';
import { renderEchangesPage } from './pages/echanges.js';
import { renderFichesPage } from './pages/fiches.js';
import { renderClasseurPage } from './pages/classeur.js';
import { renderAuditPage } from './pages/audit.js';
import { renderAmortissementsPage } from './pages/amortissements.js';
import { renderAssurancesPage } from './pages/assurances.js';
import { renderConvertisseurPage } from './pages/convertisseur.js';
import { renderConfigPage } from './pages/config.js';
import { renderDemoPage } from './pages/demo.js';
import { getSession, signOut, restorePersistedSession } from './auth.js';
import { ensureTiersRegistered } from './store.js';
import { refreshQuota, clearQuota, updateNavVisibility } from './licence.js';
import { maybeSeedDemoData } from './demo-seed.js';
import { esc, toast } from './ui.js';
import { enterDemoMode, isDemoMode, demoBannerHtml, wireDemoExit } from './demo-mode.js';

function showShell() {
  document.getElementById('appShell').hidden = false;
  document.querySelectorAll('.page-section').forEach((s) => s.classList.remove('active'));
  const session = getSession();
  const emailEl = document.getElementById('appUserEmail');
  if (emailEl) emailEl.textContent = session ? session.email : '';
  // Masque le bouton Déconnexion et le FAB quand personne n'est connecté
  // (pages publiques : démo, connexion).
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.style.display = session ? '' : 'none';
  const fab = document.getElementById('newEntryFab');
  if (fab) fab.style.display = session ? '' : 'none';
  // Rafraîchit le plan/quota (affiche le bouton Admin si admin)
  if (session) {
    refreshQuota().then(() => { maybeSeedDemoData(); }).catch(() => {});
    // Sous-comptes de tiers (401001…) : ré-enregistrés au plan à chaque
    // connexion pour que la validation les accepte partout.
    ensureTiersRegistered();
  }
  else updateNavVisibility();
  window.scrollTo(0, 0);
}

function showLanding() {
  document.getElementById('appShell').hidden = true;
  // Réactive la landing (main.js gère les sections internes via data-nav)
  if (!document.querySelector('.page-section.active')) {
    document.getElementById('landingPage').classList.add('active');
  }
  window.scrollTo(0, 0);
}

function markNav(name) {
  document.querySelectorAll('.bottom-nav .nav-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.route === name);
  });
  document.querySelectorAll('.drawer-item').forEach((b) => {
    b.classList.toggle('active', b.dataset.route === name);
  });
  closeDrawer();
}

/* --- Menu latéral (hamburger ☰) --- */
function openDrawer() {
  document.getElementById('drawer').classList.add('open');
  document.getElementById('drawerBackdrop').classList.add('open');
}
function closeDrawer() {
  const d = document.getElementById('drawer');
  if (d) d.classList.remove('open');
  const b = document.getElementById('drawerBackdrop');
  if (b) b.classList.remove('open');
}

// Restaure la session persistée ("Se souvenir de moi") avant de démarrer le routeur,
// pour que les routes protégées fonctionnent dès le rechargement de la page.
restorePersistedSession().catch(() => {}).finally(() => {
startRouter({
  '': () => {
    // Accueil connecté = tableau de bord ; la landing reste pour les visiteurs.
    // Si l'utilisateur vient de confirmer son email (?confirmed=1) mais que le
    // hash #/connexion a été perdu pendant la redirection Supabase, on l'envoie
    // quand même vers la page de connexion pour voir le message de confirmation.
    try {
      if (new URLSearchParams(window.location.search).get('confirmed') === '1' && !getSession()) {
        navigate('/connexion');
        return;
      }
    } catch (e) {}
    if (getSession()) { showShell(); markNav(''); renderDashboardPage(); setHeader('Accueil'); }
    else showLanding();
  },
  'accueil': { guard: true, render: () => { showShell(); markNav(''); renderDashboardPage(); setHeader('Accueil'); } },
  'connexion': (query) => { showShell(); markNav(''); renderAuthPage(query); setHeader('Connexion'); },
  'demo': () => { showShell(); markNav(''); renderDemoPage(); setHeader('Démo'); },
  'journal': { guard: true, render: () => { showShell(); markNav('journal'); renderJournalPage(); setHeader('Journal'); } },
  'etats': { guard: true, render: (query) => { showShell(); markNav('etats'); renderEtatsPage(query); setHeader('États financiers'); } },
  'pilotage': { guard: true, render: (query) => { showShell(); markNav('pilotage'); renderPilotagePage(query); setHeader('Pilotage'); } },
  'ratios': { guard: true, render: () => { showShell(); markNav('ratios'); renderRatiosPage(); setHeader('Ratios de gestion'); } },
  'notes': { guard: true, render: (query) => { showShell(); markNav('notes'); renderNotesPage(query); setHeader('Notes annexes'); } },
  'lettrage': { guard: true, render: () => { showShell(); markNav('lettrage'); renderLettragePage(); setHeader('Lettrage'); } },
  'calendrier': { render: () => { showShell(); markNav('calendrier'); renderCalendrierPage(); setHeader('Calendrier fiscal'); } },
  'copilote': { guard: true, render: () => { showShell(); markNav('copilote'); renderCopilotePage(); setHeader('Copilote IA'); } },
  'admin': { guard: true, render: () => { showShell(); markNav('admin'); renderAdminPage(); setHeader('Administration'); } },
  'classeur': { guard: true, render: () => { showShell(); markNav('classeur'); renderClasseurPage(); setHeader('Classeur Intelligent'); } },
  'audit': { guard: true, render: () => { showShell(); markNav('audit'); renderAuditPage(); setHeader('Audit Readiness'); } },
  'amortissements': { guard: true, render: () => { showShell(); markNav('amortissements'); renderAmortissementsPage(); setHeader('Amortissements'); } },
  'assurances': { guard: true, render: () => { showShell(); markNav('assurances'); renderAssurancesPage(); setHeader('Assurances'); } },
  'convertisseur': { guard: true, render: () => { showShell(); markNav('convertisseur'); renderConvertisseurPage(); setHeader('Convertisseur'); } },
  'config': { guard: true, render: () => { showShell(); markNav('config'); renderConfigPage(); setHeader('Configuration'); } },
  'echanges': { guard: true, render: () => { showShell(); markNav('echanges'); renderEchangesPage(); setHeader('Échanges DGI'); } },
  'fiches': { guard: true, render: () => { showShell(); markNav('fiches'); renderFichesPage(); setHeader('Fiches DSF'); } },
});
}); // fin restorePersistedSession().finally()

function setHeader(title) {
  const t = document.getElementById('appTitle');
  if (t) t.textContent = title;
}

// Navigation basse + tiroir latéral
document.addEventListener('click', (ev) => {
  if (ev.target.closest('#drawerBtn')) { openDrawer(); return; }
  if (ev.target.closest('#drawerClose') || ev.target.closest('#drawerBackdrop')) { closeDrawer(); return; }
  // Entrée en mode démo : "Voir la démo" -> active le mode démo puis ouvre le Journal
  const demoEnter = ev.target.closest('[data-demo-enter]');
  if (demoEnter && !getSession()) {
    enterDemoMode();
    // laisse le href="#/journal" faire la navigation
  }
  const nav = ev.target.closest('[data-goto]');
  if (nav) {
    // En mode démo (page #/demo, pas de session) : les onglets font défiler
    // vers la section correspondante au lieu de demander une connexion.
    if (!getSession() && (window.location.hash || '').startsWith('#/demo')) {
      const demoTargets = { journal: 'demo-journal', etats: 'demo-etats', copilote: 'demo-copilote', lettrage: 'demo-lettrage', calendrier: 'demo-calendrier' };
      const tid = demoTargets[nav.dataset.route];
      if (tid) {
        const el = document.getElementById(tid);
        if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      }
    }
    navigate(nav.dataset.goto); return;
  }
  if (ev.target.closest('#logoutBtn')) {
    signOut().then(() => {
      clearQuota();
      toast('Déconnexion réussie.', 'info');
      navigate('/connexion');
    });
  }
  if (ev.target.closest('#newEntryFab')) {
    const menu = document.getElementById('fabMenu');
    const fab = document.getElementById('newEntryFab');
    const open = menu.hasAttribute('hidden');
    if (open) { menu.removeAttribute('hidden'); fab.classList.add('open'); fab.setAttribute('aria-expanded', 'true'); }
    else { menu.setAttribute('hidden', ''); fab.classList.remove('open'); fab.setAttribute('aria-expanded', 'false'); }
    return;
  }
  if (ev.target.closest('#fabNewEntry')) {
    closeFabMenu();
    navigate('/journal');
    // Laisse le rendu se faire, puis ouvre la modale
    setTimeout(() => {
      const btn = document.querySelector('[data-testid="new-entry-btn"]');
      if (btn) btn.click();
    }, 60);
    return;
  }
  if (ev.target.closest('#fabScanDoc')) {
    closeFabMenu();
    navigate('/classeur');
    return;
  }
  // Clic ailleurs : referme le menu du FAB
  if (!ev.target.closest('#fabMenu')) closeFabMenu();
});

function closeFabMenu() {
  const menu = document.getElementById('fabMenu');
  const fab = document.getElementById('newEntryFab');
  if (menu && !menu.hasAttribute('hidden')) {
    menu.setAttribute('hidden', '');
    if (fab) { fab.classList.remove('open'); fab.setAttribute('aria-expanded', 'false'); }
  }
}

// Lien logo -> accueil
document.addEventListener('DOMContentLoaded', () => {
  const logo = document.getElementById('appLogo');
  if (logo) logo.addEventListener('click', () => navigate('/'));
});
