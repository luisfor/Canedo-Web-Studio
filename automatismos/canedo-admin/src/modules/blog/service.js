// File: automatismos/canedo-admin/src/modules/blog/service.js
// Servicio de integración editorial reutilizando la lógica dura de Quality Gate Fase 6L

import {
  createEditorialBrief,
  generateArticle,
  auditArticle,
  countEditorialWords,
  sniffImage,
  slugify
} from "../../../../canedostudio-blog-bot/src/index.js";
import { generateSemanticCover } from "../../../../canedostudio-blog-bot/src/semantic_cover.js";
import { generateRobustArticle, parseMarkdownToBlocks, resolveArticleType } from "./editorial_pipeline.js";
import { persistPost } from "../../../../canedostudio-blog-bot/src/d1_adapter.js";
import {
  saveDraft,
  getDraftById,
  updateDraft,
  markDraftApproved,
  markDraftPublished,
  markDraftDiscarded,
  getPostBySlugForAdmin,
  recordPostHistory,
  setPostStatusInD1,
  updatePostInD1,
  getPostHistoryById
} from "../../db.js";

const MODEL_IMG = "@cf/black-forest-labs/flux-1-schnell";

export async function generateManualDraft(env, { tema, angulo, userId, articleType = 2, targetWords = null, additionalInstructions = "", onHeartbeat }) {
  const resolvedType = resolveArticleType(articleType);
  const topic = {
    id: "manual-" + Date.now().toString(36),
    tema: tema.trim(),
    angulo: (angulo || (additionalInstructions ? `Enfoque: ${additionalInstructions.trim()}` : "enfoque comercial claro y operativo para pymes")).trim(),
    articleType: resolvedType.code,
    targetWords: targetWords || resolvedType.minWords,
    additionalInstructions: additionalInstructions.trim(),
    img: "Editorial photograph for business article about " + tema.trim()
  };

  // 1. Brief editorial
  const brief = await createEditorialBrief(env, topic);
  brief.articleType = resolvedType.code;
  if (typeof onHeartbeat === "function") await onHeartbeat("brief_completed", 0, { thesis: brief.uniqueThesis });

  // 2. Redacción con Quality Gate y reintentos (hasta 2 intentos con presupuesto estricto) usando el pipeline robusto desacoplado
  let article = null;
  let auditResult = null;
  let feedback = null;
  const maxAttempts = 2; // Presupuesto disciplinado: el pipeline seccional y micro-expansión resuelven en intento 1
  const stats = { writerCalls: 0, auditCalls: 0 };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (typeof onHeartbeat === "function") await onHeartbeat("section_generating", 0, { attempt });
      const candidate = await generateRobustArticle(env, brief, topic, attempt, feedback, stats, async (secIdx, totalSec) => {
        if (typeof onHeartbeat === "function") await onHeartbeat("section_generating", 0, { sectionIndex: secIdx, totalSections: totalSec, attempt });
      });
      candidate.articleType = resolvedType.code;
      
      const wordStatsCandidate = countEditorialWords(candidate);
      if (typeof onHeartbeat === "function") await onHeartbeat("section_completed", wordStatsCandidate.bodyWords, { attempt });

      // Pre-filtro determinista de Quality Gate: verificar límites antes de invocar auditoría semántica costosa
      if (wordStatsCandidate.bodyWords < resolvedType.minWords) {
        throw new Error(`Extensión insuficiente: ${wordStatsCandidate.bodyWords} palabras (mínimo requerido: ${resolvedType.minWords}).`);
      }
      if (wordStatsCandidate.bodyWords > resolvedType.maxWords) {
        throw new Error(`Extensión excesiva: ${wordStatsCandidate.bodyWords} palabras (máximo permitido: ${resolvedType.maxWords}).`);
      }

      if (typeof onHeartbeat === "function") await onHeartbeat("semantic_auditing", wordStatsCandidate.bodyWords, { attempt });
      auditResult = await auditArticle(env, candidate, brief, stats);
      if (auditResult && auditResult.approved) {
        article = candidate;
        if (typeof onHeartbeat === "function") await onHeartbeat("quality_gate", wordStatsCandidate.bodyWords, { score: auditResult.overallScore, approved: true });
        break;
      }
      feedback = auditResult;
      if (typeof onHeartbeat === "function") await onHeartbeat("quality_gate_retry", wordStatsCandidate.bodyWords, { score: auditResult.overallScore, approved: false });
    } catch (candidateErr) {
      const isTech =
        candidateErr.message.includes("500") ||
        candidateErr.message.includes("502") ||
        candidateErr.message.includes("503") ||
        candidateErr.message.includes("504") ||
        candidateErr.message.includes("Timeout") ||
        candidateErr.message.includes("unresponsive") ||
        candidateErr.message.includes("fetch failed") ||
        candidateErr.message.includes("network") ||
        candidateErr.message.includes("rate limit");
      if (isTech) {
        throw new Error(`Workers AI Technical Failure: ${candidateErr.message}`);
      }
      // Error de formato o sintaxis: acotar reintento con feedback correctivo
      console.warn(`[BLOG SERVICE WARNING] Intento ${attempt}/${maxAttempts} de generación editorial produjo error:`, candidateErr.message);
      if (attempt === maxAttempts) {
        throw candidateErr;
      }
      feedback = {
        reasons: [{
          metric: "depth",
          score: 0,
          evidence: candidateErr.message,
          problem: "LengthOrStructureViolation",
          correction: `Ajustar el artículo para mantenerse estrictamente entre ${resolvedType.minWords} y ${resolvedType.maxWords} palabras.`
        }]
      };
      if (typeof onHeartbeat === "function") await onHeartbeat("article_attempt_retry", 0, { attempt, reason: candidateErr.message });
    }
  }

  if (!article) {
    throw new Error(`El borrador no superó el Quality Gate tras ${maxAttempts} intentos. Razón: ${feedback?.reasons?.[0]?.evidence || "Fallo de calidad"}`);
  }

  const wordStats = countEditorialWords(article);
  if (typeof onHeartbeat === "function") await onHeartbeat("draft_saving", wordStats.bodyWords);

  const draftId = "draft_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
  const draft = {
    id: draftId,
    topicTema: topic.tema,
    topicAngulo: topic.angulo,
    title: article.title,
    tag: article.tag,
    excerpt: article.excerpt,
    content: article.content,
    brief,
    audit: auditResult,
    wordCount: wordStats.bodyWords,
    status: "draft",
    userId
  };

  if (env.BLOG_DB) {
    await saveDraft(env.BLOG_DB, draft);
  }

  return draft;
}

export async function modifyDraftWithInstructions(env, { draftId, instructions, userId }) {
  if (!env.BLOG_DB) throw new Error("BLOG_DB no disponible");
  const draft = await getDraftById(env.BLOG_DB, draftId);
  if (!draft) throw new Error("Borrador no encontrado");
  if (draft.status !== "draft") throw new Error(`El borrador se encuentra en estado '${draft.status}' y no puede ser modificado`);

  const topic = {
    id: "mod-" + Date.now().toString(36),
    tema: draft.topicTema,
    angulo: (draft.topicAngulo + ". Instrucciones de ajuste: " + instructions).trim(),
    img: "Editorial photograph for business article about " + draft.topicTema
  };

  const feedback = {
    reasons: [{ criterion: "user_instructions", evidence: `El usuario solicita explícitamente: ${instructions}` }]
  };

  let article = null;
  let auditResult = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    const candidate = await generateArticle(env, draft.brief, topic, attempt, feedback);
    auditResult = await auditArticle(env, candidate, draft.brief);
    if (auditResult && auditResult.approved) {
      article = candidate;
      break;
    }
  }

  if (!article) {
    throw new Error("No fue posible aplicar las modificaciones manteniendo el estándar del Quality Gate");
  }

  const wordStats = countEditorialWords(article);

  await updateDraft(env.BLOG_DB, draftId, {
    title: article.title,
    tag: article.tag,
    excerpt: article.excerpt,
    content_json: article.content,
    audit_json: auditResult,
    word_count: wordStats.bodyWords
  });

  return await getDraftById(env.BLOG_DB, draftId);
}

export async function regenerateDraft(env, { draftId, userId }) {
  if (!env.BLOG_DB) throw new Error("BLOG_DB no disponible");
  const draft = await getDraftById(env.BLOG_DB, draftId);
  if (!draft) throw new Error("Borrador no encontrado");
  if (draft.status !== "draft") throw new Error(`El borrador se encuentra en estado '${draft.status}' y no puede ser regenerado`);

  // Si es un borrador originado desde YouTube, regenerar con el pipeline de YouTube
  if (draft.sourceType === "youtube" || draft.brief?.sourcePayload || draft.brief?.sourceType === "youtube") {
    const sourcePayload = draft.brief?.sourcePayload;
    if (!sourcePayload || !sourcePayload.videoId) {
      throw new Error("No se encontraron los metadatos originales de YouTube para regenerar");
    }
    const { generateYouTubeDraft } = await import("../youtube/editorial_pipeline.js");
    const angle = draft.topicAngulo || "informativo";
    const ytResult = await generateYouTubeDraft({
      env,
      sourcePayload,
      userId,
      angle
    });
    if (!ytResult.ok || !ytResult.draft) {
      throw new Error(ytResult.error || "Falló la regeneración del artículo de YouTube");
    }

    const newDraft = ytResult.draft;
    await updateDraft(env.BLOG_DB, draftId, {
      title: newDraft.title,
      tag: newDraft.tag,
      excerpt: newDraft.excerpt,
      content_json: JSON.parse(newDraft.content_json),
      brief_json: JSON.parse(newDraft.brief_json),
      audit_json: JSON.parse(newDraft.audit_json),
      word_count: newDraft.word_count
    });

    return await getDraftById(env.BLOG_DB, draftId);
  }

  const topic = {
    id: "regen-" + Date.now().toString(36),
    tema: draft.topicTema,
    angulo: draft.topicAngulo,
    img: "Editorial photograph for business article about " + draft.topicTema
  };

  const brief = await createEditorialBrief(env, topic);
  let article = null;
  let auditResult = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    const candidate = await generateArticle(env, brief, topic, attempt, null);
    auditResult = await auditArticle(env, candidate, brief);
    if (auditResult && auditResult.approved) {
      article = candidate;
      break;
    }
  }

  if (!article) {
    throw new Error("La regeneración no superó el Quality Gate tras 3 intentos");
  }

  const wordStats = countEditorialWords(article);

  await updateDraft(env.BLOG_DB, draftId, {
    title: article.title,
    tag: article.tag,
    excerpt: article.excerpt,
    content_json: article.content,
    brief_json: brief,
    audit_json: auditResult,
    word_count: wordStats.bodyWords
  });

  return await getDraftById(env.BLOG_DB, draftId);
}

export async function approveDraftOnly(env, draftId, userId) {
  if (!env.BLOG_DB) throw new Error("BLOG_DB no disponible");
  const draft = await getDraftById(env.BLOG_DB, draftId);
  if (!draft) throw new Error("Borrador no encontrado");
  if (draft.status === "approved") return draft;
  if (draft.status === "published") throw new Error("El borrador ya fue publicado previamente");
  if (draft.status === "discarded") throw new Error("El borrador fue descartado y no puede aprobarse");

  const approved = await markDraftApproved(env.BLOG_DB, draftId, userId);
  if (!approved) throw new Error("No fue posible cambiar el estado a aprobado (concurrencia o ya procesado)");
  return await getDraftById(env.BLOG_DB, draftId);
}

import { EDITORIAL_FALLBACK_COVER_B64 } from "./fallback_cover_b64.js";

function createValidFallbackCover() {
  const binaryString = atob(EDITORIAL_FALLBACK_COVER_B64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function publishApprovedDraft(env, draftId, userId) {
  // Guard de seguridad obligatorio: Bloqueo de publicación en backend
  const publishEnabled = String(env.ADMIN_PUBLISH_ENABLED).toLowerCase() === "true";
  if (!publishEnabled) {
    throw new Error("ADMIN_PUBLISH_DISABLED: La publicación administrativa en producción está deshabilitada (ADMIN_PUBLISH_ENABLED=false)");
  }

  if (!env.BLOG_DB) throw new Error("BLOG_DB no disponible");

  // Mutex / Concurrencia segura: Marcar aprobado antes de publicar para evitar doble publicación simultánea
  const draft = await getDraftById(env.BLOG_DB, draftId);
  if (!draft) throw new Error("Borrador no encontrado");
  if (draft.status === "published") throw new Error("El borrador ya fue publicado previamente");
  if (draft.status === "discarded") throw new Error("El borrador fue descartado");

  // Validar aprobación
  if (draft.status !== "approved") {
    const approved = await markDraftApproved(env.BLOG_DB, draftId, userId);
    if (!approved) throw new Error("No fue posible cambiar el estado a aprobado (concurrencia o ya procesado)");
  }

  // Obtener o generar un slug determinista estable basado en el título del borrador
  // Esto garantiza que cualquier reintento use exactamente la misma clave y URL sin duplicar artículos
  const slug = draft.publishedSlug || slugify(draft.title);

  // 1. Generar portada fotográfica con Flux 1 Schnell
  let imgBytes;
  if (env.AI) {
    try {
      const summaryText = draft.summary || draft.executive_summary || "";
      const coverResult = await generateSemanticCover({
        ai: env.AI,
        title: draft.title,
        summary: summaryText,
        tag: draft.service_key || draft.tag,
        fallbackCoverFn: createValidFallbackCover
      });

      imgBytes = coverResult.bytes;
      if (coverResult.meta.isFallback) {
        console.warn(`[ADMIN COVER FALLBACK] Se aplicó portada de contingencia para el borrador '${draft.title}'. Causa: ${coverResult.meta.fluxError || "Bytes insuficientes"}`);
      } else {
        console.log(`[ADMIN COVER SUCCESS] Portada generada (${coverResult.meta.briefSource}) para borrador '${draft.title}' en ${coverResult.meta.durationMs}ms`);
      }
    } catch (aiErr) {
      console.warn("[FLUX AI WARNING] Falló generación de portada con Flux, aplicando contingencia:", aiErr.message);
    }
  }

  if (!imgBytes || imgBytes.byteLength < 1000) {
    // Portada de contingencia estructurada con cabeceras JPEG válidas si la IA devuelve bytes inválidos o timeout
    imgBytes = createValidFallbackCover();
  }

  const kind = sniffImage(imgBytes);
  const coverKey = "img:covers/" + slug + "." + kind.ext;

  const kvTarget = env.BLOG_POSTS || env.ADMIN_KV;
  if (kvTarget) {
    await kvTarget.put(coverKey, imgBytes);
  }

  const post = {
    slug,
    title: draft.title,
    tag: draft.tag,
    date: new Date().toISOString().slice(0, 10),
    readingTime: Math.max(3, Math.round(draft.wordCount / 200)) + " min",
    cover: "/media/covers/" + slug + "." + kind.ext,
    excerpt: draft.excerpt,
    content: draft.content,
    seoVersion: "2.0",
    executiveSummary: draft.brief?.uniqueThesis || null,
    targetService: "contacto_estrategico",
    customMetaDesc: draft.excerpt,
    faqs: [],
    relatedSlugs: []
  };

  // Persistir en D1 y KV con el adaptador existente garantizando el binding correcto hacia BLOG_POSTS
  const adapterEnv = {
    ...env,
    BLOG_POSTS: kvTarget
  };
  await persistPost(adapterEnv, post, { enableD1: true, enableKV: true, kvLimit: 30 });

  // Actualizar estado en D1
  await markDraftPublished(env.BLOG_DB, draftId, slug);

  return { slug, post };
}

export async function discardDraft(env, draftId, userId) {
  if (!env.BLOG_DB) return false;
  return await markDraftDiscarded(env.BLOG_DB, draftId, userId);
}

/**
 * Despublica un artículo de forma segura:
 * 1. Respalda en blog_post_history
 * 2. Cambia status a 'unpublished' en D1
 * 3. Remueve el artículo del KV buffer 'posts'
 */
export async function unpublishArticle(env, slug, userId) {
  if (!env.BLOG_DB) throw new Error("BLOG_DB no disponible");
  const post = await getPostBySlugForAdmin(env.BLOG_DB, slug);
  if (!post) throw new Error(`Artículo no encontrado: ${slug}`);
  if (post.status !== "published") throw new Error(`El artículo no está publicado (estado actual: ${post.status})`);

  // 1. Respaldar en historial antes de cambiar estado
  await recordPostHistory(env.BLOG_DB, post, userId, "unpublish", "Despublicado por el administrador");

  // 2. Control de concurrencia optimista
  const expectedVersion = post.updated_at;

  // 3. Actualizar D1
  const updatedD1 = await setPostStatusInD1(env.BLOG_DB, slug, "unpublished", expectedVersion);
  if (!updatedD1) {
    throw new Error("CONFLICTO_CONCURRENTE: El artículo fue modificado o ya cambió de estado concurrentemente.");
  }

  // 4. Sincronizar KV removiendo del buffer público con reporte de consistencia
  let kvSyncStatus = "not_applicable";
  let kvError = null;

  const kvTarget = env.BLOG_POSTS || env.ADMIN_KV;
  if (kvTarget && typeof kvTarget.get === "function") {
    try {
      const raw = await kvTarget.get("posts");
      if (raw) {
        const postsData = JSON.parse(raw);
        const posts = Array.isArray(postsData.posts) ? postsData.posts : (Array.isArray(postsData) ? postsData : []);
        const filtered = posts.filter(p => p.slug !== slug);
        if (Array.isArray(postsData.posts)) {
          postsData.posts = filtered;
          await kvTarget.put("posts", JSON.stringify(postsData));
        } else {
          await kvTarget.put("posts", JSON.stringify({ posts: filtered }));
        }
        kvSyncStatus = "removed_from_kv";
      }
    } catch (err) {
      kvSyncStatus = "failed";
      kvError = err.message;
      console.warn(`[KV INCONSISTENCY ON UNPUBLISH] Error al remover de KV para '${slug}': ${err.message}. D1 garantiza que la petición pública retorne 404.`);
    }
  }

  return { ok: true, slug, previousStatus: "published", newStatus: "unpublished", kvSyncStatus, kvError };
}

/**
 * Restaura un artículo previamente despublicado:
 * 1. Respalda en blog_post_history
 * 2. Cambia status a 'published' en D1
 * 3. Reinserta en KV buffer 'posts'
 */
export async function restoreArticle(env, slug, userId) {
  if (!env.BLOG_DB) throw new Error("BLOG_DB no disponible");
  const post = await getPostBySlugForAdmin(env.BLOG_DB, slug);
  if (!post) throw new Error(`Artículo no encontrado: ${slug}`);
  if (post.status === "published") throw new Error("El artículo ya se encuentra publicado");

  // 1. Respaldar en historial antes de restaurar
  await recordPostHistory(env.BLOG_DB, post, userId, "restore", "Restaurado a publicado por el administrador");

  // 2. Control de concurrencia optimista
  const expectedVersion = post.updated_at;

  // 3. Actualizar D1
  const updatedD1 = await setPostStatusInD1(env.BLOG_DB, slug, "published", expectedVersion);
  if (!updatedD1) {
    throw new Error("CONFLICTO_CONCURRENTE: El artículo fue modificado concurrentemente.");
  }

  // 4. Reinsertar en KV
  let kvSyncStatus = "not_applicable";
  let kvError = null;

  const kvTarget = env.BLOG_POSTS || env.ADMIN_KV;
  if (kvTarget && typeof kvTarget.get === "function") {
    try {
      const adapterEnv = { ...env, BLOG_POSTS: kvTarget };
      const fullPost = {
        slug: post.slug,
        title: post.title,
        tag: post.tag,
        date: post.date,
        readingTime: post.reading_time || "4 min",
        cover: post.cover_url || `/media/covers/${post.slug}.jpg`,
        excerpt: post.excerpt,
        content: post.content
      };
      await persistPost(adapterEnv, fullPost, { enableD1: false, enableKV: true, kvLimit: 30 });
      kvSyncStatus = "synced";
    } catch (err) {
      kvSyncStatus = "failed";
      kvError = err.message;
      console.warn(`[KV INCONSISTENCY ON RESTORE] Error al reinsertar en KV para '${slug}': ${err.message}.`);
    }
  }

  return { ok: true, slug, previousStatus: post.status, newStatus: "published", kvSyncStatus, kvError };
}

/**
 * Edita campos de un artículo existente con historial y validación
 */
export async function editArticleDetails(env, slug, updates, userId, changeSummary = "Edición granular") {
  if (!env.BLOG_DB) throw new Error("BLOG_DB no disponible");
  const currentPost = await getPostBySlugForAdmin(env.BLOG_DB, slug);
  if (!currentPost) throw new Error(`Artículo no encontrado: ${slug}`);

  // 1. Respaldar versión previa completa en historial
  await recordPostHistory(env.BLOG_DB, currentPost, userId, "edit", changeSummary);

  // 2. Control de concurrencia optimista: verificar que no haya sido mutado entre la lectura y la escritura
  const expectedVersion = currentPost.updated_at;

  // 3. Aplicar actualización en D1 manteniendo el slug original inmutable
  const updated = await updatePostInD1(env.BLOG_DB, slug, updates, expectedVersion);
  if (!updated) {
    throw new Error("CONFLICTO_CONCURRENTE: El artículo fue modificado por otra sesión o proceso. Por favor recarga los datos antes de editar.");
  }

  // 4. Obtener post actualizado de D1 (fuente de verdad primaria)
  const freshPost = await getPostBySlugForAdmin(env.BLOG_DB, slug);

  // 5. Estrategia de consistencia eventual D1 -> KV con recuperación verificable
  let kvSyncStatus = "not_applicable";
  let kvError = null;

  if (freshPost.status === "published") {
    const kvTarget = env.BLOG_POSTS || env.ADMIN_KV;
    if (kvTarget && typeof kvTarget.get === "function") {
      try {
        const adapterEnv = { ...env, BLOG_POSTS: kvTarget };
        const fullPost = {
          slug: freshPost.slug,
          title: freshPost.title,
          tag: freshPost.tag,
          date: freshPost.date,
          readingTime: freshPost.reading_time || "4 min",
          cover: freshPost.cover_url || `/media/covers/${freshPost.slug}.jpg`,
          excerpt: freshPost.excerpt,
          content: freshPost.content
        };
        await persistPost(adapterEnv, fullPost, { enableD1: false, enableKV: true, kvLimit: 30 });
        kvSyncStatus = "synced";
      } catch (err) {
        kvSyncStatus = "failed";
        kvError = err.message;
        console.warn(`[KV INCONSISTENCY DETECTED] Falló sincronización de KV para slug '${slug}': ${err.message}. D1 permanece consistente como fuente de verdad.`);
      }
    }
  }

  return { ok: true, post: freshPost, kvSyncStatus, kvError };
}

/**
 * Revierte un artículo a una versión histórica previa
 */
export async function rollbackArticleToHistory(env, historyId, userId) {
  if (!env.BLOG_DB) throw new Error("BLOG_DB no disponible");
  const historyEntry = await getPostHistoryById(env.BLOG_DB, historyId);
  if (!historyEntry) throw new Error(`Entrada de historial #${historyId} no encontrada`);

  const slug = historyEntry.post_slug;
  const currentPost = await getPostBySlugForAdmin(env.BLOG_DB, slug);
  if (!currentPost) throw new Error(`El artículo ${slug} ya no existe en D1`);

  // 1. Guardar estado actual antes del rollback
  await recordPostHistory(env.BLOG_DB, currentPost, userId, "rollback", `Rollback hacia versión #${historyId}`);

  // 2. Control de concurrencia optimista
  const expectedVersion = currentPost.updated_at;

  // 3. Restaurar valores desde el historial
  const updates = {
    title: historyEntry.title,
    tag: historyEntry.tag,
    excerpt: historyEntry.excerpt,
    content_json: historyEntry.content_json,
    status: historyEntry.status,
    reading_time: historyEntry.reading_time
  };

  const ok = await updatePostInD1(env.BLOG_DB, slug, updates, expectedVersion);
  if (!ok) {
    throw new Error("CONFLICTO_CONCURRENTE: El artículo fue modificado por otro proceso mientras se preparaba el rollback.");
  }

  const restored = await getPostBySlugForAdmin(env.BLOG_DB, slug);

  // 4. Sincronizar KV según el nuevo estado restaurado con manejo defensivo de inconsistencias
  let kvSyncStatus = "not_applicable";
  let kvError = null;

  const kvTarget = env.BLOG_POSTS || env.ADMIN_KV;
  if (kvTarget && typeof kvTarget.get === "function") {
    if (restored.status === "published") {
      try {
        const adapterEnv = { ...env, BLOG_POSTS: kvTarget };
        const fullPost = {
          slug: restored.slug,
          title: restored.title,
          tag: restored.tag,
          date: restored.date,
          readingTime: restored.reading_time || "4 min",
          cover: restored.cover_url || `/media/covers/${restored.slug}.jpg`,
          excerpt: restored.excerpt,
          content: restored.content
        };
        await persistPost(adapterEnv, fullPost, { enableD1: false, enableKV: true, kvLimit: 30 });
        kvSyncStatus = "synced";
      } catch (err) {
        kvSyncStatus = "failed";
        kvError = err.message;
        console.warn(`[KV INCONSISTENCY ON ROLLBACK] Falló re-inserción en KV para ${slug}: ${err.message}.`);
      }
    } else {
      // Remover de KV si la versión recuperada no estaba publicada
      try {
        const raw = await kvTarget.get("posts");
        if (raw) {
          const postsData = JSON.parse(raw);
          const posts = Array.isArray(postsData.posts) ? postsData.posts : (Array.isArray(postsData) ? postsData : []);
          const filtered = posts.filter(p => p.slug !== slug);
          if (Array.isArray(postsData.posts)) {
            postsData.posts = filtered;
            await kvTarget.put("posts", JSON.stringify(postsData));
          } else {
            await kvTarget.put("posts", JSON.stringify({ posts: filtered }));
          }
          kvSyncStatus = "removed_from_kv";
        }
      } catch (err) {
        kvSyncStatus = "failed";
        kvError = err.message;
        console.warn(`[KV INCONSISTENCY ON ROLLBACK REMOVAL] Falló remoción de KV para ${slug}: ${err.message}.`);
      }
    }
  }

  return { ok: true, slug, restoredPost: restored, kvSyncStatus, kvError };
}
