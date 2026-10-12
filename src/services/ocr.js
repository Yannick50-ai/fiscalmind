/**
 * Service OCR — lecture des justificatifs via l'Edge Function `ocr`.
 *
 * Contexte : la prod actuelle appelle encore https://api.ocr.space/parse/image
 * DIRECTEMENT depuis le navigateur avec une clé en clair (fmOcrOnline ~l.3166,
 * clé par défaut 'K82080794088957'). CIBLE de la migration : la clé OCR.space
 * ne doit JAMAIS transiter côté client — appel via Edge Function `ocr`
 * (pattern : edge-function-ocr.ts) avec :
 * - utilisateur authentifié (JWT Supabase, verify_jwt),
 * - origine autorisée (ALLOWED_ORIGINS),
 * - type et taille de fichier vérifiés côté client ET serveur,
 * - limite de débit par utilisateur,
 * - CONSENTEMENT EXPLICITE de l'utilisateur avant tout envoi à OCR.space,
 * - fallback OCR local (Tesseract) si refus ou indisponibilité.
 *
 * Constantes portées de edge-function-ocr.ts :
 * - MAX_CHARS = 1 800 000 (~1,3 Mo de fichier une fois décodé),
 * - LANGS = fre, eng,
 * - DATA_URL = /^data:(image\/(png|jpe?g|webp|gif)|application\/pdf);base64,...$/,
 * - limite de débit : 20 requêtes / 10 min / utilisateur (mémoire d'instance).
 */

export const OCR_MAX_CHARS = 1_800_000;
export const OCR_LANGS = ['fre', 'eng'];
export const OCR_DATA_URL_RE =
  /^data:(image\/(png|jpe?g|webp|gif)|application\/pdf);base64,[A-Za-z0-9+/=]+$/;
export const OCR_FN_NAME = 'ocr';

export function ocrError(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

/**
 * Valide l'entrée avant envoi (miroir des contrôles serveur).
 * @returns {{ ok: boolean, code?: string, error?: string, language?: string }}
 */
export function validateOcrInput({ dataUrl, language } = {}) {
  if (typeof dataUrl !== 'string' || !dataUrl) {
    return { ok: false, code: 'MISSING_FILE', error: 'Aucun document fourni' };
  }
  if (dataUrl.length > OCR_MAX_CHARS) {
    return { ok: false, code: 'FILE_TOO_LARGE', error: 'Document trop volumineux pour l’OCR' };
  }
  if (!OCR_DATA_URL_RE.test(dataUrl)) {
    return { ok: false, code: 'UNSUPPORTED_TYPE', error: 'Type de document non pris en charge (image ou PDF attendu)' };
  }
  const lang = OCR_LANGS.includes(String(language)) ? String(language) : 'fre';
  return { ok: true, language: lang };
}

/** Extrait le texte de la réponse de l'Edge Function (format OCR.space filtré). */
export function extractOcrText(ocrResponse) {
  const pr = ocrResponse && ocrResponse.ParsedResults && ocrResponse.ParsedResults[0];
  const text = pr && typeof pr.ParsedText === 'string' ? pr.ParsedText.trim() : '';
  return text;
}

/**
 * Faut-il basculer sur l'OCR local (Tesseract) ?
 * Oui si l'utilisateur refuse l'envoi au service en ligne, ou si le service
 * distant a échoué et qu'un secours local est disponible.
 */
export function shouldUseLocalFallback({ consent, serviceError } = {}) {
  if (consent === false) return true;
  return !!serviceError;
}

/**
 * Fabrique le service OCR.
 * @param {object} p
 * @param {function} p.invokeOcr - injecté : ({ accessToken, body }) => Promise<réponse>
 *   (câblé dans services/index.js sur l'Edge Function `ocr` via Supabase)
 */
export function createOcrService({ invokeOcr }) {
  if (typeof invokeOcr !== 'function') throw new Error('createOcrService : invokeOcr requis');

  return {
    /**
     * Demande une lecture OCR du document.
     * @param {object} p
     * @param {string} p.accessToken - JWT Supabase (authentification obligatoire)
     * @param {string} p.dataUrl - document en data URL base64 (image ou PDF)
     * @param {string} [p.language='fre']
     * @param {boolean} p.consent - CONSENTEMENT EXPLICITE requis (false → refus)
     * @returns {Promise<{ text: string, raw: object }>}
     */
    async requestOcr({ accessToken, dataUrl, language = 'fre', consent = false }) {
      if (consent !== true) {
        throw ocrError('CONSENT_REQUIRED', "Envoi au service OCR refusé : consentement explicite requis");
      }
      if (!accessToken) {
        const e = ocrError('NOT_AUTHENTICATED', 'Connexion requise pour l’OCR');
        throw e;
      }
      const v = validateOcrInput({ dataUrl, language });
      if (!v.ok) throw ocrError(v.code, v.error);

      let res;
      try {
        res = await invokeOcr({ accessToken, body: { base64Image: dataUrl, language: v.language } });
      } catch (e) {
        const err = ocrError('OCR_SERVICE_ERROR', 'Service OCR indisponible');
        err.cause = e;
        err.localFallback = true;
        throw err;
      }
      const text = extractOcrText(res);
      if (!text) {
        const err = ocrError('OCR_EMPTY', 'Aucun texte détecté dans le document');
        err.localFallback = true;
        throw err;
      }
      return { text, raw: res };
    },

    validateOcrInput,
    extractOcrText,
    shouldUseLocalFallback,
  };
}
