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
import { generateRobustArticle, parseMarkdownToBlocks, resolveArticleType } from "./editorial_pipeline.js";
import { persistPost } from "../../../../canedostudio-blog-bot/src/d1_adapter.js";
import { saveDraft, getDraftById, updateDraft, markDraftApproved, markDraftPublished, markDraftDiscarded } from "../../db.js";

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
      const prompt =
        "Premium editorial photograph for a business blog, dark luxurious style, deep black background, " +
        "subtle electric blue and warm gold accent lighting, cinematic, high detail, rich composition with " +
        "multiple visual elements and clear depth, atmospheric light, photographic realism. " +
        "AVOID: minimalism, abstract shapes, a single floating object on emptiness, text, words, letters. " +
        "Scene: Editorial image about " + draft.title;
      
      const result = await env.AI.run(MODEL_IMG, { prompt });
      if (result instanceof ArrayBuffer) imgBytes = result;
      else if (result && typeof result.arrayBuffer === "function") imgBytes = await result.arrayBuffer();
      else if (result && result.image) {
        const bin = atob(result.image);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        imgBytes = arr.buffer;
      }
    } catch (aiErr) {
      console.warn("[FLUX AI WARNING] Falló generación de portada con Flux, aplicando contingencia:", aiErr.message);
    }
  }

  if (!imgBytes || imgBytes.byteLength < 1000) {
    // Portada de contingencia mínima si la IA devuelve bytes inválidos o timeout
    const fallback = new Uint8Array(12000);
    fallback[0] = 0xff; fallback[1] = 0xd8; fallback[2] = 0xff;
    imgBytes = fallback.buffer;
  }

  const kind = sniffImage(imgBytes);
  const coverKey = "img:covers/" + slug + "." + kind.ext;

  if (env.ADMIN_KV) {
    await env.ADMIN_KV.put(coverKey, imgBytes);
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

  // Persistir en D1 y KV con el adaptador existente. Si falla, el error detiene el flujo
  // y permite que el job sea reintentado con el mismo slug de forma idempotente.
  await persistPost(env, post, { enableD1: true, enableKV: true, kvLimit: 30 });

  // Actualizar estado en D1
  await markDraftPublished(env.BLOG_DB, draftId, slug);

  return { slug, post };
}

export async function discardDraft(env, draftId, userId) {
  if (!env.BLOG_DB) return false;
  return await markDraftDiscarded(env.BLOG_DB, draftId, userId);
}
