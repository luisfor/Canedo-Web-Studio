/**
 * Adaptador de Persistencia D1 + Dual-Write KV para canedostudio-blog-bot
 * 
 * Principios:
 * 1. Cloudflare D1 (BLOG_DB) es la Fuente de Verdad Canónica permanente (ACID).
 * 2. Cloudflare KV (BLOG_POSTS) es el búfer de retrocompatibilidad con la web actual.
 * 3. En D1 NUNCA se aplica truncamiento FIFO (se conservan todos los artículos).
 * 4. En KV se mantiene el array de los posts más recientes para que la web siga consumiéndolos.
 * 5. Reintentos exponenciales y manejo de fallos para garantizar tolerancia a caídas transitorias.
 * 6. Notificación IndexNow automática y desacoplada tras confirmación de persistencia.
 */

import {
  notifyIndexNow,
  buildArticleCanonicalUrl,
  checkUrlPublicAvailability,
  INDEXNOW_KEY,
  INDEXNOW_HOST
} from "./seo/indexnow_client.js";
import { resolveRelatedArticlesFromD1 } from "./seo/service_mapping.js";

export async function persistPost(env, post, options = {}) {
  const {
    enableD1 = true,
    enableKV = true,
    enableIndexNow = true,
    maxRetries = 2,
    retryDelayMs = 150,
    kvLimit = 30,
    fetchFn = globalThis.fetch
  } = options;

  const result = {
    slug: post.slug,
    d1: { success: false, attempts: 0, error: null, action: "none" },
    kv: { success: false, attempts: 0, error: null },
    indexNow: { success: false, skipped: true, error: null },
    timestamp: new Date().toISOString()
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // 1. ESCRITURA EN CLOUDFLARE D1 (ALMACENAMIENTO PERMANENTE SIN TRUNCAMIENTO)
  let d1Action = "inserted";
  if (enableD1 && env.BLOG_DB && typeof env.BLOG_DB.prepare === "function") {
    // Comprobar si ya existe y si ha cambiado el contenido para asegurar idempotencia estricta
    let existingPost = null;
    try {
      existingPost = await env.BLOG_DB.prepare(
        "SELECT title, excerpt, content_json, status FROM blog_posts WHERE slug = ? LIMIT 1"
      ).bind(post.slug).first();
    } catch (e) {
      // Si la consulta previa falla, se continúa con el flujo estándar de inserción
    }

    // Solo resolver artículos relacionados si el post es de versión enriquecida (V2) o los solicita explícitamente
    const isEnrichedV2 = Boolean(
      post.seoVersion === "2.0" ||
      post.executiveSummary ||
      post.targetService ||
      (post.faqs && post.faqs.length > 0) ||
      (Array.isArray(post.relatedSlugs) && post.relatedSlugs.length > 0)
    );

    let finalRelatedSlugs = Array.isArray(post.relatedSlugs) ? post.relatedSlugs : [];
    if (isEnrichedV2 && finalRelatedSlugs.length === 0 && env.BLOG_DB) {
      try {
        finalRelatedSlugs = await resolveRelatedArticlesFromD1(env.BLOG_DB, post, { limit: 3 });
      } catch (err) {
        // Fallback no bloqueante
      }
    }

    // Si el post trae metadatos enriquecidos de la Fase 2C.2A / 2B, se guardan estructurados en content_json
    // preservando el array de bloques o el objeto contenedor retrocompatible
    const enrichedPayload = {
      blocks: Array.isArray(post.content) ? post.content : [],
      seoVersion: post.seoVersion || "2.0",
      executiveSummary: post.executiveSummary || null,
      targetService: post.targetService || null,
      customMetaDesc: post.customMetaDesc || null,
      faqs: post.faqs || [],
      relatedSlugs: finalRelatedSlugs
    };

    // Si no es un post enriquecido V2, se mantiene el array nativo idéntico al histórico (compatibilidad 100%)
    const newContentJson = isEnrichedV2
      ? JSON.stringify(enrichedPayload)
      : JSON.stringify(post.content || []);
    if (existingPost) {
      const isIdentical =
        existingPost.title === post.title &&
        existingPost.excerpt === (post.excerpt || "") &&
        existingPost.content_json === newContentJson &&
        existingPost.status === (post.status || "published");

      if (isIdentical) {
        d1Action = "unchanged";
      } else {
        d1Action = "updated";
      }
    } else {
      d1Action = "inserted";
    }

    result.d1.action = d1Action;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      result.d1.attempts = attempt;
      try {
        const sql = `
          INSERT INTO blog_posts (slug, title, tag, date, reading_time, cover_url, excerpt, content_json, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'published')
          ON CONFLICT(slug) DO UPDATE SET
            title = excluded.title,
            tag = excluded.tag,
            date = excluded.date,
            reading_time = excluded.reading_time,
            cover_url = excluded.cover_url,
            excerpt = excluded.excerpt,
            content_json = excluded.content_json,
            status = 'published',
            updated_at = CURRENT_TIMESTAMP;
        `;
        await env.BLOG_DB.prepare(sql).bind(
          post.slug,
          post.title,
          post.tag,
          post.date,
          post.readingTime || "3 min",
          post.cover || "",
          post.excerpt || "",
          newContentJson
        ).run();

        result.d1.success = true;
        result.d1.error = null;
        break;
      } catch (err) {
        result.d1.error = err.message;
        console.error(`Error escribiendo en D1 (intento ${attempt}):`, err);
        if (attempt <= maxRetries) {
          await sleep(retryDelayMs * attempt);
        }
      }
    }
  } else if (!enableD1) {
    result.d1.skipped = true;
  } else {
    result.d1.error = "BLOG_DB binding no disponible";
  }

  // 2. ESCRITURA EN CLOUDFLARE KV (BUFFER RETROCOMPATIBLE PARA LA WEB)
  if (enableKV && env.BLOG_POSTS && typeof env.BLOG_POSTS.get === "function") {
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      result.kv.attempts = attempt;
      try {
        const raw = await env.BLOG_POSTS.get("posts");
        const postsData = JSON.parse(raw || '{"posts":[]}');
        const posts = Array.isArray(postsData.posts) ? postsData.posts : [];

        // Deduplicar slug en caso de re-publicación y agregar al inicio
        const filtered = posts.filter((p) => p.slug !== post.slug);
        filtered.unshift(post);

        // En KV se mantiene el límite de compatibilidad para la web actual
        postsData.posts = kvLimit > 0 ? filtered.slice(0, kvLimit) : filtered;
        await env.BLOG_POSTS.put("posts", JSON.stringify(postsData));

        result.kv.success = true;
        result.kv.error = null;
        break;
      } catch (err) {
        result.kv.error = err.message;
        console.error(`Error escribiendo en KV (intento ${attempt}):`, err);
        if (attempt <= maxRetries) {
          await sleep(retryDelayMs * attempt);
        }
      }
    }
  } else if (!enableKV) {
    result.kv.skipped = true;
  } else {
    result.kv.error = "BLOG_POSTS binding no disponible";
  }

  // 3. INTEGRACIÓN CON WEBHOOK EXTERNO (SI ESTÁ CONFIGURADO)
  if (env.MAKE_WEBHOOK_URL) {
    try {
      await fetch(env.MAKE_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "post.published",
          post,
          timestamp: new Date().toISOString()
        })
      });
    } catch (e) {
      console.warn("Advertencia: fallo al notificar MAKE_WEBHOOK_URL:", e);
    }
  }

  // Si fallan tanto D1 como KV, lanzar error
  if (!result.d1.success && !result.kv.success) {
    throw new Error(`CRITICAL_STORAGE_FAILURE: D1 (${result.d1.error}) | KV (${result.kv.error})`);
  }

  // 4. NOTIFICACIÓN AUTOMÁTICA INDEXNOW (DESACOPLADA, IDEMPOTENTE Y VERIFICADA)
  // Se ejecuta SOLAMENTE tras confirmar persistencia de un artículo publicado
  // y cuando se trata de una inserción nueva o actualización con cambios reales
  const isEligibleStatus = post.slug && (post.status === "published" || !post.status);
  const shouldNotify = isEligibleStatus && (d1Action === "inserted" || d1Action === "updated");

  if (enableIndexNow && shouldNotify) {
    try {
      const canonicalUrl = buildArticleCanonicalUrl(post.slug, env.INDEXNOW_HOST || INDEXNOW_HOST);
      const indexNowKey = env.INDEXNOW_KEY || INDEXNOW_KEY;

      // Comprobación de disponibilidad pública real antes del despacho
      const avail = await checkUrlPublicAvailability(canonicalUrl, {
        fetchFn,
        timeoutMs: 3000,
        expectedHost: env.INDEXNOW_HOST || INDEXNOW_HOST
      });

      if (!avail.available) {
        console.warn(`Aviso IndexNow: URL aún no reporta disponibilidad pública (${avail.reason || avail.status}). Se omite notificación inmediata para proteger cuota y calidad.`);
        result.indexNow = {
          success: false,
          skipped: true,
          reason: `public_check_failed_${avail.reason || avail.status}`,
          submittedCount: 0
        };
      } else {
        const notifyResult = await notifyIndexNow([canonicalUrl], {
          host: env.INDEXNOW_HOST || INDEXNOW_HOST,
          key: indexNowKey,
          fetchFn
        });

        result.indexNow = {
          success: notifyResult.success,
          status: notifyResult.status,
          submittedCount: notifyResult.submittedCount,
          skipped: false,
          error: notifyResult.error || null
        };
      }
    } catch (inErr) {
      // Un fallo en IndexNow jamás debe impedir que el artículo se considere publicado
      console.warn("Advertencia: Excepción capturada en notificación IndexNow:", inErr.message);
      result.indexNow = {
        success: false,
        skipped: false,
        error: inErr.message
      };
    }
  } else {
    result.indexNow = {
      success: false,
      skipped: true,
      reason: !isEligibleStatus
        ? (post.status && post.status !== "published" ? "draft_or_archived" : "disabled")
        : (d1Action === "unchanged" ? "idempotent_unchanged" : "disabled")
    };
  }

  return result;
}

