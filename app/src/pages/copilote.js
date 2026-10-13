// FiscalMind Africa — page Copilote IA (#/copilote, protégée).
//
// Conversation avec la Edge Function `copilot` via src/services/supabase.js.
// Comportements portés fidèlement de l'appli d'origine :
// - payload { question, country, taxOverrides } (fmLiveAnswer) ;
// - quota : { action: 'quota' } -> { plan, remaining } ;
// - 402 -> message « quota épuisé » + bouton abonnement ;
// - réponse rendue en markdown léger (src/copilot/format.js).
// Historique persisté sur le serveur (table fm_chat, 100 max).

import { esc, toast, $ } from '../ui.js';
import { supabaseService, getAccessToken, isSupabaseConfigured } from '../auth.js';
import { loadChat, saveChat, listChats, deleteChat, loadCountry } from '../store.js';
import { refreshQuota, quotaBadgeText } from '../licence.js';
import { getCountry } from '../../../src/data/countries.js';
import { renderMarkdown, QUICK_PROMPTS, WELCOME_HTML } from '../../../src/copilot/format.js';
import { isDemoMode, demoBannerHtml, wireDemoExit } from '../demo-mode.js';

const CHAT_MAX = 100;

function shell() { return document.getElementById('appMain'); }

async function loadHistory() {
  try { return await loadChat(); }
  catch (e) { return []; }
}
async function saveHistory(h) {
  // Titre = 40 premiers caractères du premier message utilisateur
  let titre = null;
  const firstUser = h.find(m => m.role === 'user');
  if (firstUser && firstUser.text) titre = firstUser.text.slice(0, 40);
  const cid = await saveChat(h, S.conversationId, titre);
  if (cid && !S.conversationId) S.conversationId = cid;
}

async function countryName() {
  let code = 'BF';
  try { code = await loadCountry(); } catch (e) { /* défaut */ }
  const c = getCountry(code);
  return (c && c.nom) || 'Burkina Faso';
}

function bubble(role, html) {
  if (role === 'user') {
    return '<div class="message user">' + esc(html) + '</div>';
  }
  return '<div class="message assistant"><div class="message-header"><i class="fas fa-robot"></i> FiscalMind IA</div>' + html + '</div>';
}

const S = { history: [], conversationId: null, conversations: [] };

function renderAll() {
  const box = $('#chatMessages');
  if (!box) return;
  const h = S.history;
  if (isDemoMode()) {
    // Mode démo : exemples de questions/réponses prédéfinis
    box.innerHTML = '<div class="message assistant">'
      + '<p>👋 Voici ce que je peux faire pour vous. En mode démo, voici des exemples :</p></div>'
      + '<div class="message user">Quel est le taux de TVA au Burkina Faso ?</div>'
      + '<div class="message assistant"><p>Le taux normal de TVA au Burkina Faso est de <strong>18&nbsp;%</strong>.</p></div>'
      + '<div class="message user">Comment comptabiliser une facture d\'achat ?</div>'
      + '<div class="message assistant"><p>Débit <strong>601</strong> et <strong>4452</strong>, Crédit <strong>401</strong> pour le montant TTC.</p></div>'
      + '<div class="message assistant"><p style="color:#92400E;">💡 <a href="#/connexion?tab=signup" style="color:#EA580C;font-weight:600;">Créez un compte gratuit</a> pour poser vos vraies questions.</p></div>';
  } else if (!h.length) {
    box.innerHTML = '<div class="message assistant">' + WELCOME_HTML + '</div>';
  } else {
    box.innerHTML = h.map((m) => m.role === 'user' ? bubble('user', m.text) : renderAssistantStored(m.text)).join('');
  }
  box.scrollTop = box.scrollHeight;
  const badge = $('#copilotQuota');
  if (badge) badge.textContent = quotaBadgeText();
  const planBtn = box.querySelector('[data-goto-plan]');
  if (planBtn) {
    planBtn.addEventListener('click', () => {
      toast('Les abonnements Starter et Pro sont disponibles sur la boutique WagaExpress.', 'info');
    });
  }
}

/** Ajoute un message à l'historique (mémoire + serveur). */
async function pushMessage(msg) {
  S.history = [...S.history, msg].slice(-CHAT_MAX);
  try { await saveHistory(S.history); }
  catch (e) { toast('Historique non sauvegardé : ' + (e.message || 'erreur réseau.'), 'error'); }
}

export async function renderCopilotePage() {
  const configured = isSupabaseConfigured();
  const demo = isDemoMode();
  shell().innerHTML = '<div class="card copilot-card"><div class="loading-state">Chargement de la conversation…</div></div>';
  try {
    S.history = demo ? [] : await loadHistory();
  } catch (err) {
    shell().innerHTML = '<div class="error-state" data-testid="copilote-error">'
      + '<div class="error-icon">⚠️</div><p>' + esc(err.message || 'Erreur de chargement.') + '</p>'
      + '<button class="btn btn-primary" id="copiloteRetry">Réessayer</button></div>';
    document.getElementById('copiloteRetry').addEventListener('click', () => renderCopilotePage());
    return;
  }

  shell().innerHTML =
    (demo ? demoBannerHtml() : '')
    + '<div class="card copilot-card">' +
      '<div class="card-header">' +
        '<h3 class="card-title"><i class="fas fa-robot" style="color:var(--primary);"></i> Copilote IA</h3>' +
        '<div style="display:flex;gap:8px;align-items:center;">' +
          '<span id="copilotQuota" class="quota-badge"></span>' +
          '<button class="btn btn-secondary btn-sm" data-testid="new-chat-btn" id="newChatBtn" title="Nouvelle discussion"><i class="fas fa-plus"></i></button>' +
          '<button class="btn btn-secondary btn-sm" data-testid="history-btn" id="historyBtn" title="Discussions"><i class="fas fa-history"></i></button>' +
        '</div>' +
      '</div>' +
      '<div id="convList" style="display:none;max-height:200px;overflow-y:auto;border-bottom:1px solid var(--border);margin-bottom:8px;"></div>' +
      (configured ? '' :
        '<div class="notice-box">🔌 Le copilote nécessite une connexion serveur. Vérifiez la configuration.</div>') +
      '<div class="quick-prompts" id="quickPrompts">' +
        QUICK_PROMPTS.map((q, i) =>
          '<button class="quick-prompt" data-qp="' + i + '">' + q.icon + ' ' + esc(q.label) + '</button>'
        ).join('') +
      '</div>' +
      '<div class="chat-messages" id="chatMessages" data-testid="chat-messages"></div>' +
      '<div class="chat-input-row">' +
        '<input id="chatInput" data-testid="chat-input" class="form-input" placeholder="Posez votre question…" autocomplete="off">' +
        '<button class="btn btn-primary" data-testid="chat-send" id="chatSendBtn" aria-label="Envoyer"><i class="fas fa-paper-plane"></i></button>' +
      '</div>' +
    '</div>';

  renderAll();

  // Nouvelle discussion
  $('#newChatBtn').addEventListener('click', async () => {
    S.history = [];
    S.conversationId = null;
    renderAll();
    $('#convList').style.display = 'none';
    toast('Nouvelle discussion.', 'info');
  });

  // Liste des discussions
  $('#historyBtn').addEventListener('click', async () => {
    const list = $('#convList');
    if (list.style.display !== 'none') { list.style.display = 'none'; return; }
    try {
      S.conversations = await listChats();
    } catch (e) { S.conversations = []; }
    if (!S.conversations.length) {
      list.innerHTML = '<p class="muted-sm" style="padding:8px;">Aucune ancienne discussion.</p>';
    } else {
      list.innerHTML = S.conversations.map(c =>
        '<div class="rowline" data-conv="' + esc(c.conversation_id) + '" style="cursor:pointer;">' +
        '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(c.titre || 'Discussion') + '</span>' +
        '<span class="muted-sm">' + esc((c.updated_at || '').slice(0, 10)) + '</span>' +
        '<button class="btn btn-sm" data-delconv="' + esc(c.conversation_id) + '" title="Supprimer" style="color:#DC2626;">✕</button>' +
        '</div>'
      ).join('');
      list.querySelectorAll('[data-conv]').forEach(el => {
        el.addEventListener('click', async (ev) => {
          if (ev.target.closest('[data-delconv]')) return;
          const cid = el.dataset.conv;
          S.conversationId = cid;
          try { S.history = await loadChat(cid); } catch (e) { S.history = []; }
          renderAll();
          list.style.display = 'none';
        });
      });
      list.querySelectorAll('[data-delconv]').forEach(btn => {
        btn.addEventListener('click', async (ev) => {
          ev.stopPropagation();
          const cid = btn.dataset.delconv;
          if (!confirm('Supprimer cette discussion ?')) return;
          try { await deleteChat(cid); } catch (e) { toast('Erreur.', 'error'); return; }
          if (S.conversationId === cid) { S.conversationId = null; S.history = []; renderAll(); }
          $('#historyBtn').click(); $('#historyBtn').click(); // refresh liste
          toast('Discussion supprimée.', 'info');
        });
      });
    }
    list.style.display = 'block';
  });

  $('#quickPrompts').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-qp]');
    if (!b) return;
    $('#chatInput').value = QUICK_PROMPTS[Number(b.dataset.qp)].prompt;
    send();
  });

  $('#chatSendBtn').addEventListener('click', () => send());
  $('#chatInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });
  if (isDemoMode()) {
    wireDemoExit();
    // Mode démo : saisie désactivée, exemples uniquement
    const input = $('#chatInput');
    const sendBtn = $('#chatSendBtn');
    if (input) { input.disabled = true; input.placeholder = 'Créez un compte pour discuter avec le copilote…'; }
    if (sendBtn) sendBtn.disabled = true;
  }
}

async function send() {
  const input = $('#chatInput');
  const message = (input.value || '').trim();
  if (!message) return;

  const svc = supabaseService();
  if (!svc) {
    toast('Connectez-vous pour utiliser le copilote.', 'error');
    return;
  }
  const token = await getAccessToken();
  if (!token) {
    toast('Session expirée, reconnectez-vous.', 'error');
    return;
  }

  await pushMessage({ role: 'user', text: message, ts: Date.now() });
  input.value = '';
  renderAll();

  // Indicateur « écrit… »
  const box = $('#chatMessages');
  const typing = document.createElement('div');
  typing.className = 'message assistant';
  typing.id = 'typingInd';
  typing.innerHTML = '<div class="message-header"><i class="fas fa-robot"></i> FiscalMind IA</div><em style="color:var(--text-muted);">En train d\u2019écrire…</em>';
  box.appendChild(typing);
  box.scrollTop = box.scrollHeight;

  try {
    let tvaSubject = true, bicPrelevement = false;
    try {
      const { loadTvaSubject, loadBicPrelevement } = await import('../store.js');
      tvaSubject = await loadTvaSubject();
      bicPrelevement = await loadBicPrelevement();
    } catch (e) { /* défauts */ }
    const res = await svc.askCopilot({
      accessToken: token,
      question: message,
      country: await countryName(),
      taxOverrides: {},
      fiscalContext: { tvaSubject, bicPrelevement },
    });
    typing.remove();
    if (!res || !res.answer) {
      await pushMessage({ role: 'assistant', text: "❌ Service temporairement indisponible, réessayez dans un instant.", ts: Date.now() });
    } else {
      await pushMessage({ role: 'assistant', text: String(res.answer), ts: Date.now() });
      refreshQuota();
    }
    renderAll();
  } catch (e) {
    typing.remove();
    if (e && e.status === 402) {
      // Quota mensuel épuisé (comme l'original)
      await pushMessage({
        role: 'assistant',
        text: 'QUOTA_EXHAUSTED:' + (e.message || 'Quota mensuel épuisé.'),
        ts: Date.now(),
      });
      refreshQuota();
    } else if (e && e.code === 'NOT_AUTHENTICATED') {
      await pushMessage({ role: 'assistant', text: 'Session expirée, reconnectez-vous.', ts: Date.now() });
    } else {
      await pushMessage({ role: 'assistant', text: "❌ Connexion impossible. Vérifiez votre connexion internet.", ts: Date.now() });
    }
    renderAll();
  }
}

/** Rendu d'un message assistant stocké (gère le cas quota épuisé). */
export function renderAssistantStored(text) {
  if (String(text).startsWith('QUOTA_EXHAUSTED:')) {
    const msg = esc(String(text).slice('QUOTA_EXHAUSTED:'.length));
    return bubble('assistant',
      '⚠️ ' + msg +
      '<br><br><button class="btn btn-primary btn-sm" data-goto-plan>🎫 Choisir mon abonnement</button>' +
      '<div style="font-size:12px;color:var(--text-muted);margin-top:8px;">Les abonnements sont disponibles sur la boutique WagaExpress.</div>');
  }
  return bubble('assistant', renderMarkdown(text));
}
