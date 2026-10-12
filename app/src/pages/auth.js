// FiscalMind Africa — page Connexion / Inscription.
// Branchée sur src/services/supabase.js via src/auth.js (aucun secret en dur).
// SaaS strict : connexion réelle obligatoire, aucun mode démo.

import { esc, toast, showWelcomeTutorial } from '../ui.js';
import { signInReal, signUpReal, isSupabaseConfigured, getSession, getRememberMe } from '../auth.js';
import { navigate } from '../router.js';
import { resolveTeamOwner, clearTeamCache } from '../store.js';
import { getQuotaInfo, refreshQuota, isAdmin } from '../licence.js';

function shell() { return document.getElementById('appMain'); }

export function renderAuthPage(query) {
  if (getSession()) { navigate('/journal'); return; }
  const tab = query.tab === 'signup' ? 'signup' : 'signin';
  const configured = isSupabaseConfigured();
  // Vérifier confirmed=1 dans le hash ET dans la vraie query string (redirection Supabase)
  let confirmed = query.confirmed === '1';
  if (!confirmed && typeof window !== 'undefined') {
    try {
      confirmed = new URLSearchParams(window.location.search).get('confirmed') === '1';
    } catch (e) {}
  }
  // Le message ne s'affiche qu'UNE fois : on nettoie l'URL pour qu'il
  // ne réapparaisse pas à la prochaine visite de la page de connexion.
  if (confirmed && typeof window !== 'undefined' && window.history && window.history.replaceState) {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('confirmed');
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    } catch (e) {}
  }

  shell().innerHTML =
    '<div class="auth-wrap" data-testid="auth-page">'
    + '<div class="logo" style="justify-content:center;margin-bottom:18px;">'
    + '<div class="logo-icon">🧠</div><div class="logo-text">FiscalMind<span>Africa</span></div></div>'
    + '<div class="card"><div class="card-body">'
    + '<h2 class="page-title" style="margin-top:0;">' + (tab === 'signup' ? 'Créer un compte' : 'Connexion') + '</h2>'
    + (confirmed
      ? '<p class="notice-ok"><i class="fas fa-check-circle"></i> Email confirmé ! Connectez-vous pour commencer.</p>'
      : '')
    + (!configured
      ? '<p class="demo-note"><i class="fas fa-info-circle"></i> Connexion serveur non configurée sur cet environnement. Vérifiez la configuration.</p>'
      : '')
    + '<div class="auth-tabs" role="tablist">'
    + '<button class="auth-tab' + (tab === 'signin' ? ' active' : '') + '" data-authtab="signin" data-testid="tab-signin">Connexion</button>'
    + '<button class="auth-tab' + (tab === 'signup' ? ' active' : '') + '" data-authtab="signup" data-testid="tab-signup">Inscription</button>'
    + '</div>'
    + '<form id="authForm" data-testid="auth-form">'
    + (tab === 'signup'
      ? '<div class="form-group"><label class="form-label" for="authName">Nom complet</label>'
        + '<input class="form-input" id="authName" data-testid="auth-name" type="text" autocomplete="name" placeholder="Votre nom"></div>'
      : '')
    + '<div class="form-group"><label class="form-label" for="authEmail">Email</label>'
    + '<input class="form-input" id="authEmail" data-testid="auth-email" type="email" autocomplete="email" required placeholder="vous@exemple.com"></div>'
    + '<div class="form-group"><label class="form-label" for="authPassword">Mot de passe</label>'
    + '<div class="password-wrap"><input class="form-input" id="authPassword" data-testid="auth-password" type="password" autocomplete="current-password" required minlength="6" placeholder="6 caractères minimum">'
    + '<button type="button" class="password-toggle" id="authPasswordToggle" data-testid="auth-password-toggle" aria-label="Afficher le mot de passe" title="Afficher / masquer">👁️</button></div></div>'
    + (tab === 'signin'
      ? '<div class="form-group"><label class="remember-me" style="display:flex;align-items:center;gap:8px;font-size:14px;cursor:pointer;">'
        + '<input type="checkbox" id="authRemember" data-testid="auth-remember" ' + (getRememberMe() ? 'checked' : '')
        + ' style="width:18px;height:18px;accent-color:var(--accent);"> Se souvenir de moi</label></div>'
      : '')
    + '<div class="form-error" id="authError" data-testid="auth-error" hidden></div>'
    + '<button class="btn btn-primary btn-block" type="submit" data-testid="auth-submit">'
    + (tab === 'signup' ? '<i class="fas fa-user-plus"></i> Créer mon compte' : '<i class="fas fa-sign-in-alt"></i> Se connecter')
    + '</button></form>'
    + '<p style="text-align:center;margin:16px 0 0;"><a href="#/" style="color:var(--text-muted);font-size:13px;">← Retour à l\'accueil</a></p>'
    + '</div></div></div>';

  shell().querySelectorAll('[data-authtab]').forEach((b) => {
    b.addEventListener('click', () => navigate('/connexion?tab=' + b.dataset.authtab));
  });

  // Afficher / masquer le mot de passe.
  const pwdInput = document.getElementById('authPassword');
  const pwdToggle = document.getElementById('authPasswordToggle');
  if (pwdToggle && pwdInput) {
    pwdToggle.addEventListener('click', () => {
      const show = pwdInput.type === 'password';
      pwdInput.type = show ? 'text' : 'password';
      pwdToggle.textContent = show ? '🙈' : '👁️';
      pwdToggle.setAttribute('aria-label', show ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
    });
  }

  document.getElementById('authForm').addEventListener('submit', async (ev) => {    ev.preventDefault();
    const errBox = document.getElementById('authError');
    errBox.hidden = true;
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    const remember = tab === 'signin' && !!document.getElementById('authRemember')?.checked;
    const btn = ev.target.querySelector('[type="submit"]');
    btn.disabled = true;
    try {
      let res;
      if (tab === 'signup') {
        // Vérifier si l'email est déjà utilisé
        try {
          const checkRes = await fetch('https://eetmaaopaatbbwhwbdcx.supabase.co/functions/v1/check-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
          });
          const check = await checkRes.json();
          if (check.exists) {
            errBox.textContent = 'Adresse email déjà utilisée. Connectez-vous plutôt.';
            errBox.hidden = false;
            btn.disabled = false;
            return;
          }
        } catch (e) { /* continuer quand même */ }
        const name = (document.getElementById('authName') || {}).value || '';
        res = await signUpReal(email, password, name.trim());
        if (res.ok && res.needsConfirmation) {
          toast('Vérifiez votre email pour confirmer votre compte. Si vous avez déjà un compte avec cet email, connectez-vous plutôt.', 'success');
          navigate('/connexion');
          return;
        }
      } else {
        res = await signInReal(email, password, remember);
      }
      if (!res.ok) {
        errBox.textContent = res.error;
        errBox.hidden = false;
        return;
      }
      toast(tab === 'signup' ? 'Compte créé, bienvenue !' : 'Connexion réussie.', 'success');
      // Résoudre l'équipe (données partagées si membre)
      clearTeamCache();
      resolveTeamOwner().catch(() => {});
      // Si un paiement était en attente (clic sur un plan avant inscription), rediriger vers SasPay
      // SAUF si admin ou abonnement déjà actif
      const pendingPayment = window.__fmPendingPayment;
      window.__fmPendingPayment = null; // toujours nettoyer
      // Suite de l'inscription/connexion : paiement éventuel puis navigation.
      // À la première inscription, on force le passage par la Configuration
      // (infos entreprise) avant toute utilisation.
      const proceedAfterAuth = (isFirst) => {
        if (pendingPayment) {
          // Notifie l'essai gratuit si le paiement n'est pas finalisé (au lieu
          // de basculer silencieusement en mode essai). Vérifie après 15 s pour
          // laisser le temps au webhook SasPay d'activer la licence si payé.
          const notifyTrialIfUnpaid = () => {
            setTimeout(async () => {
              try {
                await refreshQuota();
                const q2 = getQuotaInfo();
                const p2 = (q2 && q2.plan) || 'gratuit';
                if (p2 !== 'essentiel' && p2 !== 'pro' && !isAdmin()) {
                  toast('🎁 Essai gratuit de 14 jours activé. Pour passer à un abonnement, allez dans Configuration → Ma licence.', 'info');
                }
              } catch (e) { /* silencieux */ }
            }, 15000);
          };
          try {
            const q = getQuotaInfo();
            const plan = (q && q.plan) || 'gratuit';
            const isAdminUser = isAdmin();
            const hasActiveSub = plan === 'essentiel' || plan === 'pro';
            if (!isAdminUser && !hasActiveSub) {
              toast('Compte créé ! Vous allez être redirigé vers le paiement.', 'info');
              setTimeout(() => window.open(pendingPayment, '_blank'), 1500);
              notifyTrialIfUnpaid();
            }
          } catch (e) {
            // En cas d'erreur, rediriger quand même (nouvel utilisateur)
            toast('Compte créé ! Vous allez être redirigé vers le paiement.', 'info');
            setTimeout(() => window.open(pendingPayment, '_blank'), 1500);
            notifyTrialIfUnpaid();
          }
          // Si admin ou déjà abonné : pas de redirection, juste nettoyer
        }
        if (isFirst) {
          // Première connexion : la page Configuration s'ouvre pour
          // renseigner les informations de l'entreprise avant utilisation.
          navigate('/config');
        } else {
          navigate('/journal');
        }
      };
      // Après inscription OU connexion : vérifier si c'est la première fois.
      // (Un nouvel inscrit passe par "confirmation email" puis CONNEXION, pas par l'onglet inscription.
      //  Donc on ne peut pas se fier à tab === 'signup' — on vérifie par utilisateur.)
      // LOGIQUE : en cas d'erreur de lecture, on suppose PREMIÈRE connexion.
      // Mieux vaut montrer le tuto une fois de trop à un ancien que de le
      // rater pour un nouveau. L'admin ne fait jamais l'onboarding.
      const isFirstLogin = async () => {
        try {
          if (isAdmin()) return false;
          const { getSetting } = await import('../store.js');
          return !(await getSetting('onboarding_done', false));
        } catch (e) { return true; }
      };
      const markOnboarded = async () => {
        try {
          const { setSetting } = await import('../store.js');
          await setSetting('onboarding_done', true);
        } catch (e) {}
      };
      if (await isFirstLogin()) {
        // Première connexion : tutoriel de bienvenue (par utilisateur), puis configuration.
        await showWelcomeTutorial(async () => {
          await markOnboarded();
          proceedAfterAuth(true);
        });
      } else {
        proceedAfterAuth(false);
      }
    } finally {
      btn.disabled = false;
    }
  });
}
