// FiscalMind Africa — page Démo (#/demo, publique).
//
// L'ancienne page démo (aperçu simplifié) est remplacée par les VRAIS modules
// en mode démo : cette route active le mode démo et redirige vers le Journal.
// Voir app/src/demo-mode.js pour le système complet.

import { navigate } from '../router.js';

export async function renderDemoPage() {
  // L'ancienne page démo redirige vers les vrais modules en mode démo.
  // (Le mode démo = les vrais modules Journal/États/Copilote/Lettrage/Calendrier
  //  avec données d'exemple et bandeau "lecture seule".)
  const { enterDemoMode } = await import('../demo-mode.js');
  enterDemoMode();
  navigate('/journal');
}
