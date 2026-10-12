// FiscalMind Africa — landing publique (phase 1 de la migration).
// - Marquee des pays + stats : données réelles des modules (src/data, src/engine).
// - Navigation interne (landing <-> pages légales), CTA -> ancre tarifs ou toast.
// Contenu visible par défaut : si ce script échoue, la page reste lisible
// (les animations vivent dans anim.js, indépendant).

// PWA : enregistre le service worker (icône installable, cache hors-ligne)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

import { COUNTRIES } from '../../src/data/countries.js';
import { ACCOUNTS } from '../../src/engine/chart-of-accounts.js';

function showToast(msg, type) {
    var box = document.getElementById('toastContainer');
    if (!box) return;
    var el = document.createElement('div');
    el.className = 'toast toast-' + (type || 'info');
    el.innerHTML = '<div class="toast-icon"><i class="fas fa-info-circle"></i></div>'
        + '<div style="font-size:14px;">' + msg + '</div>';
    box.appendChild(el);
    setTimeout(function () { el.remove(); }, 4200);
}

function showSection(id) {
    document.querySelectorAll('.page-section').forEach(function (s) {
        s.classList.toggle('active', s.id === id);
    });
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

// --- Marquee des 17 pays OHADA (depuis le module ; le HTML contient déjà
// --- une version statique de repli si ce script ne s'exécute pas)
(function buildMarquee() {
    var track = document.querySelector('.marquee-track');
    if (!track || !COUNTRIES || !COUNTRIES.length) return;
    var names = COUNTRIES.map(function (c) { return c.nom; });
    var html = '';
    for (var r = 0; r < 2; r++) {
        names.forEach(function (n) { html += '<span>' + n + '</span><i>●</i>'; });
    }
    track.innerHTML = html;
})();

// --- Stats : valeurs réelles des modules (repli : valeurs déjà dans le HTML)
(function buildStats() {
    var map = { pays: COUNTRIES.length, comptes: Object.keys(ACCOUNTS).length };
    document.querySelectorAll('.stat-num[data-stat]').forEach(function (el) {
        var v = map[el.dataset.stat];
        if (v) el.dataset.count = v;
    });
})();

// --- Navigation + CTA (délégation)
document.addEventListener('click', function (ev) {
    var nav = ev.target.closest('[data-nav]');
    if (nav) {
        ev.preventDefault();
        var dest = nav.dataset.nav;
        if (dest === 'pricing') {
            showSection('landingPage');
            setTimeout(function () {
                var p = document.getElementById('pricing');
                if (p) p.scrollIntoView({ behavior: 'smooth' });
            }, 50);
        } else {
            showSection({ landing: 'landingPage', cgu: 'cguPage', mentions: 'mentionsPage', apropos: 'aproposPage', confidentialite: 'confidentialitePage', securite: 'confidentialitePage' }[dest] || 'landingPage');
        }
        return;
    }
    var t = ev.target.closest('[data-toast]');
    if (t) {
        ev.preventDefault();
        var key = t.dataset.toast;
        var msgs = {
            demo: "La démo interactive arrive avec le lancement.",
            contact: "Le formulaire de contact arrive avec le lancement.",
            security: "Page en préparation.",
            privacy: "Page en préparation."
        };
        if (key.indexOf('plan:') === 0) {
            showToast("Les inscriptions au plan <strong>" + key.slice(5) + "</strong> ouvriront bientôt.", 'info');
        } else {
            showToast(msgs[key] || "Bientôt disponible.", 'info');
        }
    }
});
