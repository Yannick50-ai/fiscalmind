// FiscalMind Africa — routeur minimal (hash-based, vanilla).
// Routes : '' | '#/' -> landing · '#/connexion' -> auth · '#/journal' -> journal (protégée).

import { getSession } from './auth.js';
import { isDemoMode } from './demo-mode.js';

/** Analyse le hash courant -> { name, query }. */
export function parseHash() {
  let h = window.location.hash || '';
  h = h.replace(/^#\/?/, '');
  const [path, qs] = h.split('?');
  const query = {};
  (qs || '').split('&').forEach((kv) => {
    if (!kv) return;
    const [k, v] = kv.split('=');
    query[decodeURIComponent(k)] = decodeURIComponent(v || '');
  });
  return { name: path || '', query };
}

export function navigate(to) {
  if (window.location.hash === '#' + to) {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = '#' + to;
  }
}

/**
 * Démarre le routeur.
 * @param {object} routes - { '': fn, 'connexion': fn, 'journal': { render, guard: true } }
 */
export function startRouter(routes) {
  function render() {
    const { name, query } = parseHash();
    const def = routes[name];
    if (!def) { navigate('/'); return; }
    // Garde : laisse passer si session OU mode démo (visite sans compte).
    if (def.guard && !getSession() && !isDemoMode()) { navigate('/connexion'); return; }
    (typeof def === 'function' ? def : def.render)(query);
  }
  window.addEventListener('hashchange', render);
  render();
}
