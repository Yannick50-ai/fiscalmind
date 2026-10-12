/**
 * Service R2 — stockage des documents utilisateurs via l'Edge Function `r2-storage`.
 *
 * Protocole porté de fiscalmind-app.html (~l.2970-3060, fmR2Call) :
 * - JAMAIS de clé R2 côté client : tout passe par POST /functions/v1/r2-storage
 *   avec `Authorization: Bearer <JWT>` et un corps `{ action, ...payload }`.
 * - actions : 'upload-url' → { upload_url, key } ; 'confirm' → enregistre les métadonnées ;
 *   'delete' ; 'list'.
 * - upload réel : PUT direct vers `upload_url` (URL pré-signée) avec Content-Type.
 *
 * Quotas (portés de fmDocsQuota / mémoire 07/10/2026) :
 * - 1 Go par utilisateur, 50 Mo max par fichier.
 *
 * Détection MIME portée de fmMimeOf (~l.2972).
 */

export const R2_QUOTA_BYTES = 1024 * 1024 * 1024; // 1 Go / utilisateur
export const R2_MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 Mo / fichier
export const R2_ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

export function r2Error(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

/** Port de fmMimeOf : type explicite, sinon déduit de l'extension, sinon image/jpeg. */
export function detectMime({ name = '', type = '' } = {}) {
  if (type) return type;
  const n = String(name || '').toLowerCase();
  if (n.endsWith('.pdf')) return 'application/pdf';
  if (n.endsWith('.png')) return 'image/png';
  if (n.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

/** Lève FILE_TOO_LARGE si le fichier dépasse 50 Mo. */
export function checkFileSize(sizeBytes) {
  const s = Number(sizeBytes) || 0;
  if (s <= 0) throw r2Error('INVALID_SIZE', 'Taille de fichier invalide');
  if (s > R2_MAX_FILE_BYTES) {
    throw r2Error('FILE_TOO_LARGE', `Fichier trop volumineux (${s} octets > 50 Mo)`);
  }
  return s;
}

/** Lève UNSUPPORTED_TYPE si le MIME n'est pas pris en charge. */
export function checkMime(mime) {
  if (!R2_ALLOWED_MIME.has(mime)) {
    throw r2Error('UNSUPPORTED_TYPE', `Type de fichier non pris en charge : ${mime}`);
  }
  return mime;
}

/**
 * État du quota à partir d'une liste de documents [{ size }].
 * @returns {{ used: number, quota: number, remaining: number, percent: number }}
 */
export function quotaStatus(docs = []) {
  const used = (docs || []).reduce((a, d) => a + (Number(d && d.size) || 0), 0);
  const quota = R2_QUOTA_BYTES;
  return {
    used,
    quota,
    remaining: Math.max(0, quota - used),
    percent: quota > 0 ? Math.min(100, (used / quota) * 100) : 0,
  };
}

/** Lève QUOTA_EXCEEDED si docs + nouveau fichier dépassent 1 Go. */
export function assertQuotaAvailable(docs = [], newSizeBytes = 0) {
  const { used, quota } = quotaStatus(docs);
  if (used + Number(newSizeBytes) > quota) {
    throw r2Error('QUOTA_EXCEEDED', 'Quota de stockage atteint (1 Go)');
  }
  return true;
}

/**
 * Fabrique le service R2.
 * @param {object} p
 * @param {function} p.edgeCall - injecté : (action, payload) => Promise — appel à r2-storage
 *   (câblé dans services/index.js sur supabase.r2Call avec le JWT courant)
 * @param {function} [p.fetchImpl] - fetch injectable pour le PUT pré-signé
 */
export function createR2Service({ edgeCall, fetchImpl = globalThis.fetch }) {
  if (typeof edgeCall !== 'function') throw new Error('createR2Service : edgeCall requis');
  if (typeof fetchImpl !== 'function') throw new Error('createR2Service : fetchImpl invalide');

  return {
    /**
     * Demande une URL d'upload pré-signée. Valide taille et type AVANT l'appel.
     * @returns {{ upload_url: string, key: string }}
     */
    async getUploadUrl({ filename, contentType, sizeBytes }) {
      const size = checkFileSize(sizeBytes);
      const mime = checkMime(contentType || detectMime({ name: filename }));
      const res = await edgeCall('upload-url', { filename, content_type: mime, size_bytes: size });
      if (!res || !res.upload_url || !res.key) {
        throw r2Error('UPLOAD_URL_FAILED', "Le service n'a pas fourni d'URL d'upload");
      }
      return { upload_url: res.upload_url, key: res.key, mime };
    },

    /** Confirme l'upload : enregistre les métadonnées du document. */
    async confirmUpload({ key, meta = {} }) {
      if (!key) throw r2Error('INVALID_KEY', 'Clé de document manquante');
      return edgeCall('confirm', {
        key,
        name: meta.name || 'document',
        type: meta.type || 'facture',
        date: meta.date || '',
        tag: meta.tag || '',
        org: meta.org || '',
        mime_type: meta.mime_type || '',
        size_bytes: Number(meta.size_bytes) || 0,
      });
    },

    /**
     * Upload complet : URL pré-signée → PUT → confirmation.
     * @param {object} p.file - { name, type, size, body } (body : Blob | Buffer | Uint8Array)
     * @param {object} [p.meta] - métadonnées (name, type, date, tag, org)
     * @param {Array} [p.existingDocs] - documents existants pour le contrôle quota local
     */
    async uploadFile({ file, meta = {}, existingDocs = [] }) {
      if (!file) throw r2Error('NO_FILE', 'Aucun fichier fourni');
      const mime = file.type || detectMime({ name: file.name });
      const size = checkFileSize(file.size);
      checkMime(mime);
      assertQuotaAvailable(existingDocs, size);

      const { upload_url, key } = await this.getUploadUrl({
        filename: file.name || 'document',
        contentType: mime,
        sizeBytes: size,
      });
      const put = await fetchImpl(upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': mime },
        body: file.body,
      });
      if (!put.ok) throw r2Error('UPLOAD_FAILED', `Échec de l'envoi (${put.status})`);

      const confirmed = await this.confirmUpload({
        key,
        meta: { ...meta, name: file.name, mime_type: mime, size_bytes: size },
      });
      return { key, ...confirmed };
    },

    /** Supprime un document. */
    async deleteFile({ key }) {
      if (!key) throw r2Error('INVALID_KEY', 'Clé de document manquante');
      return edgeCall('delete', { key });
    },

    /** Liste les documents de l'utilisateur. */
    async listDocs() {
      return edgeCall('list', {});
    },

    quotaStatus,
    assertQuotaAvailable,
  };
}
