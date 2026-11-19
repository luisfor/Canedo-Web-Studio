// File: automatismos/canedo-admin/src/modules/youtube/service.js
// Servicio central para ingesta, verificación de duplicados y preparación de fuentes de YouTube

import { parseAndValidateYouTubeUrl } from "./validator.js";
import { fetchYouTubeMetadata } from "./client.js";

export class YouTubeIngestionService {
  constructor(db, { fetchImpl = fetch } = {}) {
    this.db = db;
    this.fetchImpl = fetchImpl;
  }

  stmt(sql, ...params) {
    return this.db.prepare(sql).bind(...params);
  }

  /**
   * Comprueba en D1 (blog_posts y blog_manual_drafts) si el video_id ya fue utilizado previamente.
   * Busca ocurrencias dentro de content_json y brief_json sin alterar el esquema existente.
   * 
   * @param {string} videoId 
   * @returns {Promise<{ isDuplicate: boolean, publishedPost?: object, draft?: object }>}
   */
  async checkDuplicateVideo(videoId) {
    if (!videoId || typeof videoId !== "string") {
      return { isDuplicate: false };
    }

    // 1. Comprobar si ya existe publicado en blog_posts
    // Buscamos el videoId dentro de content_json
    const searchPattern = `%"videoId":"${videoId}"%`;
    const searchUrlPattern = `%"${videoId}"%`;

    let publishedPost = null;
    if (this.db) {
      try {
        const postRow = await this.stmt(
          `SELECT id, slug, title, date, status FROM blog_posts 
           WHERE content_json LIKE ? OR content_json LIKE ? LIMIT 1`,
          searchPattern,
          searchUrlPattern
        ).first();

        if (postRow) {
          publishedPost = {
            id: postRow.id,
            slug: postRow.slug,
            title: postRow.title,
            date: postRow.date,
            status: postRow.status
          };
        }
      } catch (err) {
        console.warn("[YOUTUBE DUPLICATE CHECK] Aviso al consultar blog_posts:", err.message);
      }

      // 2. Comprobar si existe un borrador pendiente o aprobado en blog_manual_drafts
      let draft = null;
      try {
        const draftRow = await this.stmt(
          `SELECT id, title, status, created_at FROM blog_manual_drafts 
           WHERE (content_json LIKE ? OR brief_json LIKE ?) AND status IN ('draft', 'approved') LIMIT 1`,
          searchUrlPattern,
          searchUrlPattern
        ).first();

        if (draftRow) {
          draft = {
            id: draftRow.id,
            title: draftRow.title,
            status: draftRow.status,
            createdAt: draftRow.created_at
          };
        }
      } catch (err) {
        console.warn("[YOUTUBE DUPLICATE CHECK] Aviso al consultar blog_manual_drafts:", err.message);
      }

      if (publishedPost || draft) {
        return {
          isDuplicate: true,
          publishedPost,
          draft
        };
      }
    }

    return { isDuplicate: false };
  }

  /**
   * Ingesta completa y segura de un enlace de YouTube:
   * 1. Valida URL y Video ID.
   * 2. Consulta metadatos vía oEmbed.
   * 3. Verifica duplicados en la base de datos de producción.
   * 4. Prepara el contenedor de contexto (metadatos + transcripción / notas suministradas).
   * 
   * @param {string} inputUrl - URL del video
   * @param {object} options - Notas opcionales o transcripción manual
   * @returns {Promise<{ ok: boolean, payload?: object, error?: string }>}
   */
  async ingestVideoSource(inputUrl, { notes = null, transcript = null } = {}) {
    // 1. Validar URL
    const validation = parseAndValidateYouTubeUrl(inputUrl);
    if (!validation.ok) {
      return { ok: false, error: validation.error };
    }

    // 2. Obtener metadatos oficiales
    const metaResult = await fetchYouTubeMetadata(inputUrl, { fetchImpl: this.fetchImpl });
    if (!metaResult.ok) {
      return { ok: false, error: metaResult.error, status: metaResult.status };
    }

    const videoData = metaResult.data;

    // 3. Control de duplicados
    const duplicateCheck = await this.checkDuplicateVideo(videoData.videoId);

    // 4. Preparar payload unificado para el futuro pipeline editorial (Fases D3/D4)
    const sourcePayload = {
      sourceType: "youtube",
      videoId: videoData.videoId,
      canonicalUrl: videoData.canonicalUrl,
      title: videoData.title,
      authorName: videoData.authorName,
      authorUrl: videoData.authorUrl,
      thumbnailUrl: videoData.thumbnailUrl,
      isEmbeddable: videoData.isEmbeddable,
      hasTranscript: Boolean(transcript && transcript.trim().length > 0),
      transcript: transcript ? transcript.trim() : null,
      notes: notes ? notes.trim() : null,
      duplicateInfo: duplicateCheck
    };

    return {
      ok: true,
      payload: sourcePayload
    };
  }
}

