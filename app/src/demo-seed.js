// FiscalMind Africa — chargement automatique des données de démo.
//
// Les écritures d'à-nouveaux 2024-2025 se chargent automatiquement
// (une seule fois) UNIQUEMENT pour l'administrateur.
// Les nouveaux inscrits ne reçoivent JAMAIS de données de test :
// ils partent d'un espace vierge.
// La page "Démo" publique lit directement le JSON, sans seeding.
// Les écritures marquées `demo: true` sont protégées : non supprimables
// et non modifiables sur un compte démo (visibles avec un badge « Démo ») ;
// l'admin, lui, peut les modifier et les supprimer.
//
// PURGE AUTOMATIQUE : quand un compte passe à un plan payant (fin de l'essai
// ou souscription), les écritures de démo sont supprimées automatiquement.
// Une fois purgées, elles ne reviennent JAMAIS (flag `demo_purged`), même si
// l'abonnement payant expire plus tard — les données de travail de
// l'utilisateur sont toujours conservées.

import { saveEntry, getSetting, setSetting, loadEntries, deleteEntryById } from './store.js';
import { getQuotaInfo, isAdmin } from './licence.js';
import { toast } from './ui.js';

const SEED_FLAG = 'demo_seeded';
const PURGED_FLAG = 'demo_purged';
const SEED_URL = 'demo-data-2024-2025.json';
const PAID_PLANS = ['starter', 'pro', 'enterprise'];

let _checked = false; // une seule vérification par session (mémoire uniquement)

/** Vrai si le compte courant doit recevoir les données de démo. */
/* SEULEMENT l'admin — les nouveaux inscrits ne reçoivent JAMAIS de données de test. */
/* La page "Démo" publique lit directement le JSON, sans seeding. */
function seedEligible() {
  return isAdmin();
}

/**
 * Supprime toutes les écritures de démo (`demo: true`) du compte courant.
 * Ne touche JAMAIS aux écritures de travail de l'utilisateur.
 * Pose le flag `demo_purged` : les données démo ne reviendront jamais.
 */
export async function purgeDemoData() {
  const entries = await loadEntries();
  const demoEntries = entries.filter((e) => e && e.demo === true);
  for (const e of demoEntries) {
    try { await deleteEntryById(e.id); }
    catch (err) { console.warn('[demo-purge]', e.id, (err && err.message) || err); }
  }
  await setSetting(PURGED_FLAG, true);
  return demoEntries.length;
}

export async function maybeSeedDemoData() {
  if (_checked) return;
  _checked = true;
  try {
    // Une fois purgées, les données démo ne doivent JAMAIS revenir —
    // même si l'abonnement payant expire par la suite.
    const purged = await getSetting(PURGED_FLAG, false);
    if (purged) return;

    const q = getQuotaInfo();
    const plan = q && q.plan;

    // Passage à un plan payant : purge les écritures de démo, garde le travail.
    if (plan && PAID_PLANS.includes(plan) && !isAdmin()) {
      const n = await purgeDemoData();
      if (n > 0) toast('Données de démo supprimées — votre espace est prêt.', 'success');
      return;
    }

    if (!seedEligible()) return;
    const done = await getSetting(SEED_FLAG, false);
    if (done) return;
    const res = await fetch(SEED_URL, { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    const ecritures = (data && data.ecritures) || [];
    if (!ecritures.length) return;
    for (const e of ecritures) {
      e.demo = true;
      await saveEntry(e); // upsert sur entry_id : idempotent
    }
    await setSetting(SEED_FLAG, true);
    toast('Données de démo 2024–2025 chargées.', 'success');
  } catch (e) {
    // Jamais bloquant : l'utilisateur peut continuer sans les données de démo.
    console.warn('[demo-seed]', (e && e.message) || e);
  }
}

/** Remet à zéro le drapeau (usage interne/tests). */
export function _resetSeedCheck() { _checked = false; }
