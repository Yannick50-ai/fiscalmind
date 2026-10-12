# Scripts e2e archivés (pré-pivot SaaS)

Ces scripts datent d'avant le pivot « 100 % cloud » (phase 7, 8 oct. 2026) :
ils utilisent le **mode démo** (`[data-testid="demo-btn"]`), supprimé depuis —
l'appli exige désormais une session Supabase réelle.

Ils sont conservés pour mémoire (scénarios de test des pages Journal, États,
Dashboard, Lettrage, Copilote/Admin) mais **ne passent plus** en l'état.

Le script e2e actuel est `../sync-390.cjs` : il construit un bundle de test
avec des clés Supabase factices et mocke le REST Supabase en page
(`window.__fmMockDB`), avec session mémoire injectée via `window.__fmSetSession`.
