/**
 * FiscalMind Africa — rendu markdown léger des réponses du copilote.
 *
 * Port fidèle de `fmMd()` de l'appli d'origine (titres, gras, sauts de ligne),
 * étendu prudemment : listes à puces, code inline, et mise en valeur des
 * numéros de comptes SYSCOHADA (3 à 5 chiffres).
 *
 * 100 % pur : aucune dépendance DOM. Le texte est échappé AVANT toute
 * transformation, donc aucune injection HTML possible.
 */

/** Échappe les caractères HTML spéciaux. */
export function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Met en valeur les numéros de comptes (3 à 5 chiffres isolés) dans un
 * fragment déjà échappé, sans toucher au contenu des balises HTML.
 */
export function highlightAccounts(escapedHtml) {
  return String(escapedHtml)
    .split(/(<[^>]+>)/g)
    .map((part) =>
      part.startsWith('<')
        ? part
        : part.replace(/\b(\d{3,5})\b/g, '<span class="acct">$1</span>')
    )
    .join('');
}

/**
 * Rend un texte markdown léger en HTML sûr.
 * Supporté : titres ## / ###, **gras**, `code`, listes (- ou *), paragraphes.
 */
export function renderMarkdown(src) {
  let h = escapeHtml(src);

  // Code inline `...` (protégé des transformations suivantes via un marqueur)
  const codes = [];
  h = h.replace(/`([^`\n]+)`/g, (_, c) => {
    codes.push(c);
    return '\u0000CODE' + (codes.length - 1) + '\u0000';
  });

  // Titres
  h = h.replace(/^### (.*)$/gm, '<strong class="md-h">$1</strong>');
  h = h.replace(/^## (.*)$/gm, '<strong class="md-h">$1</strong>');

  // Gras
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Listes à puces : lignes commençant par - ou *
  h = h.replace(/^(?:-|\*) (.+)$/gm, '<li>$1</li>');
  h = h.replace(/((?:<li>.*?<\/li>\r?\n?)+)/g, (m) => '<ul>' + m.replace(/\r?\n/g, '') + '</ul>');

  // Numéros de comptes en valeur (hors balises)
  h = highlightAccounts(h);

  // Restaure le code inline
  h = h.replace(/\u0000CODE(\d+)\u0000/g, (_, i) => '<code>' + codes[Number(i)] + '</code>');

  // Sauts de ligne
  h = h.replace(/\n/g, '<br>');

  return h;
}

/** Questions rapides suggérées au démarrage (comme l'original, en français). */
export const QUICK_PROMPTS = [
  { icon: '📊', label: "Taux d'amortissement", prompt: "Quels sont les taux d'amortissement SYSCOHADA ?" },
  { icon: '💰', label: 'Calcul TVA', prompt: 'Comment calculer la TVA au Burkina Faso ?' },
  { icon: '📅', label: 'Échéances', prompt: 'Échéances fiscales octobre 2026' },
  { icon: '🏛️', label: 'IS vs IUTS', prompt: 'Différence entre IS et IUTS' },
  { icon: '✓', label: 'Clôture annuelle', prompt: 'Checklist clôture annuelle' },
];

/** Message d'accueil du copilote (comme l'original). */
export const WELCOME_HTML =
  '<div class="message-header"><i class="fas fa-robot"></i> FiscalMind IA</div>' +
  "Bonjour ! Je suis votre copilote comptable et fiscal spécialisé en droit OHADA " +
  "et fiscalité locale (Burkina Faso, Côte d'Ivoire, Sénégal, etc.)." +
  '<br><br>Je peux vous aider sur :' +
  '<ul style="margin: 8px 0; padding-left: 20px;">' +
  '<li>Interprétation du SYSCOHADA révisé 2018</li>' +
  '<li>Fiscalité locale (CGI, TVA, IS, IUTS)</li>' +
  '<li>Préparation aux contrôles fiscaux</li>' +
  '<li>Écritures comptables et clôture</li>' +
  '</ul>' +
  'Posez-moi votre question ! 👇';
