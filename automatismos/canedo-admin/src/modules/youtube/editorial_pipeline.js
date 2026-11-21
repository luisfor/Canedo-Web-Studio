// File: automatismos/canedo-admin/src/modules/youtube/editorial_pipeline.js
// Pipeline editorial impulsado por IA para transformar fuentes de YouTube en artículos originales
// Compatible con Workers AI, respetando Quality Gates, atribución y protección contra prompt injection

import { parseMarkdownToBlocks, countWordsInString } from "../blog/editorial_pipeline.js";
import { parseAndValidateYouTubeUrl } from "./validator.js";
import {
  auditArticleWithEditorialStandard,
  buildEnhancedEditorialInstructions
} from "../blog/editorial_standard.js";

/**
 * Sanitiza texto proveniente de fuentes externas no confiables (transcripciones o notas)
 * para neutralizar intentos de prompt injection o instrucciones del sistema camufladas.
 * 
 * @param {string} text - Texto en bruto
 * @param {number} maxLength - Límite de caracteres
 * @returns {string} Texto neutralizado
 */
export function sanitizeSourceText(text, maxLength = 12000) {
  if (!text || typeof text !== "string") return "";
  let clean = text.trim();
  if (clean.length > maxLength) {
    clean = clean.slice(0, maxLength);
  }
  // Neutralizar delimitadores de sistema o comandos simulados
  clean = clean.replace(/```/g, "'''");
  clean = clean.replace(/<\/?(?:system|instruction|prompt)[^>]*>/gi, "");
  return clean;
}

/**
 * Valida que los datos del bloque youtube_embed cumplan estrictamente el contrato
 * 
 * @param {object} block - Objeto de bloque
 * @returns {boolean}
 */
export function validateYouTubeBlock(block) {
  if (!block || typeof block !== "object") return false;
  if (block.type !== "youtube_embed") return false;
  if (!block.videoId || typeof block.videoId !== "string" || !/^[a-zA-Z0-9_-]{11}$/.test(block.videoId)) return false;
  if (!block.title || typeof block.title !== "string" || block.title.trim().length === 0) return false;
  if (!block.authorName || typeof block.authorName !== "string") return false;
  if (block.canonicalUrl && typeof block.canonicalUrl !== "string") return false;
  return true;
}

/**
 * Quality Gate para artículos generados a partir de fuentes de YouTube
 * Integra el Estándar Editorial Inteligente de Canedo Studio (Fase V1-AF)
 * 
 * @param {object} params
 * @param {string} params.markdown - Contenido generado
 * @param {Array} params.blocks - Bloques parseados
 * @param {object} params.source - Metadatos verificados de YouTube
 * @returns {{ passed: boolean, errors: string[], warnings?: string[], score: number, listAnalysis?: object, metrics?: object }}
 */
export function auditYouTubeArticle({ markdown, blocks, source }) {
  return auditArticleWithEditorialStandard({
    markdown,
    blocks,
    source,
    pipelineType: "youtube"
  });
}

/**
 * Genera el prompt estructurado para la IA, adaptado al enfoque editorial seleccionado
 * (informativo, comercial, tecnico) y tratando la transcripción/notas como contexto pasivo.
 */
export function buildYouTubeEditorialPrompt({ source, angle = "informativo" }) {
  const isOwn = Boolean(source.isOwnChannel);
  const authorType = isOwn ? "canal oficial de Canedo Studio" : `canal externo '${source.authorName || "YouTube"}'`;
  
  const sanitizedContext = sanitizeSourceText(
    (source.notes ? `NOTAS DEL ADMINISTRADOR:\n${source.notes}\n\n` : "") +
    (source.transcript ? `TRANSCRIPCIÓN:\n${source.transcript}` : "")
  );

  const enhancedInstructions = buildEnhancedEditorialInstructions({
    title: source.title || "",
    angle,
    sourceOrigin: `video de YouTube (${authorType})`
  });

  const systemInstruction = 
`Eres el Editor Jefe de Canedo Studio (agencia de tecnología, desarrollo web, automatización e IA en Cartagena, Colombia).
Tu labor es escribir un artículo de blog altamente profesional, educativo y riguroso, basándote en la información de un video de YouTube.

${enhancedInstructions}

REGLAS DE ATRIBUCIÓN Y FORMATO ESPECÍFICAS DE YOUTUBE:
- Atribución respetuosa al ${authorType} dentro del cuerpo del texto.
- No incluyas etiquetas HTML ni scripts. El reproductor de YouTube se integrará automáticamente.
- Conclusiones y reflexiones para el negocio con llamada a la acción (CTA) sobria hacia consultoría o automatización en Canedo Studio.`;

  const userPrompt = 
`VIDEO FUENTE:
- Título: ${source.title}
- Canal: ${source.authorName || "YouTube"}
- Video ID: ${source.videoId}
- Tipo: ${isOwn ? "Propio (Canedo Studio)" : "Referencia de terceros"}
- Enfoque solicitado: ${angle}

CONTEXTO Y PUNTOS CLAVE:
${sanitizedContext}

Redacta el artículo completo con formato Markdown profesional, cumpliendo estrictamente con la estructura y cantidad de elementos señalados.`;

  return { systemInstruction, userPrompt };
}

/**
 * Pipeline principal de generación de borrador a partir de YouTube
 * 
 * @param {object} params
 * @param {object} params.env - Entorno de Cloudflare Workers (con env.AI)
 * @param {object} params.sourcePayload - Payload obtenido en Fase D2
 * @param {string} params.userId - Identificador del administrador
 * @param {object} [params.aiModel] - Modelo de IA a utilizar
 * @returns {Promise<{ ok: boolean, draft?: object, error?: string }>}
 */
export async function generateYouTubeDraft({ env, sourcePayload, userId = "admin", angle = "informativo", aiModel = "@cf/meta/llama-3.3-70b-instruct-fp8-fast" }) {
  if (!sourcePayload || !sourcePayload.videoId) {
    return { ok: false, error: "INVALID_SOURCE_PAYLOAD" };
  }

  // 1. Validar que exista sustancia suficiente (contexto)
  const hasTranscript = Boolean(sourcePayload.transcript && sourcePayload.transcript.trim().length > 100);
  const hasNotes = Boolean(sourcePayload.notes && sourcePayload.notes.trim().length > 50);

  if (!hasTranscript && !hasNotes) {
    return {
      ok: false,
      error: "INSUFFICIENT_SOURCE_CONTEXT",
      message: "Se requiere una transcripción de al menos 100 caracteres o notas del video de al menos 50 caracteres."
    };
  }

  // 2. Construir prompts seguros
  const { systemInstruction, userPrompt } = buildYouTubeEditorialPrompt({ source: sourcePayload, angle });

  if (!env || !env.AI || typeof env.AI.run !== "function") {
    return { ok: false, error: "WORKERS_AI_NOT_CONFIGURED" };
  }

  // 3. Ejecutar llamada a Workers AI
  let rawGenerated = "";
  try {
    const aiResponse = await env.AI.run(aiModel, {
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: userPrompt }
      ],
      max_tokens: 2200,
      temperature: 0.35
    });

    rawGenerated = typeof aiResponse === "string" ? aiResponse : aiResponse.response || "";
  } catch (err) {
    console.error("[YOUTUBE AI ERROR] Falló llamada a Workers AI:", err);
    return { ok: false, error: `AI_GENERATION_FAILED: ${err.message}` };
  }

  if (!rawGenerated || rawGenerated.trim().length < 200) {
    return { ok: false, error: "AI_EMPTY_RESPONSE" };
  }

  // 4. Parsear Markdown a bloques estructurados
  const generatedTitle = sourcePayload.title.length < 90 ? sourcePayload.title : `${sourcePayload.title.slice(0, 85)}...`;
  const rawBlocks = parseMarkdownToBlocks(rawGenerated, generatedTitle);

  // 5. Inyectar bloque estructurado youtube_embed (ubicado tras la introducción / primer bloque)
  const youtubeBlock = {
    type: "youtube_embed",
    videoId: sourcePayload.videoId,
    title: sourcePayload.title,
    authorName: sourcePayload.authorName || "YouTube",
    authorUrl: sourcePayload.authorUrl || `https://www.youtube.com/watch?v=${sourcePayload.videoId}`,
    canonicalUrl: sourcePayload.canonicalUrl || `https://www.youtube.com/watch?v=${sourcePayload.videoId}`
  };

  const finalBlocks = [];
  let embedInserted = false;

  for (let i = 0; i < rawBlocks.length; i++) {
    finalBlocks.push(rawBlocks[i]);
    // Insertar el video tras el primer párrafo sustantivo
    if (!embedInserted && (rawBlocks[i].type === "paragraph" || i === 0)) {
      finalBlocks.push(youtubeBlock);
      embedInserted = true;
    }
  }

  if (!embedInserted) {
    finalBlocks.push(youtubeBlock);
  }

  // 6. Ejecutar Quality Gate
  const audit = auditYouTubeArticle({
    markdown: rawGenerated,
    blocks: finalBlocks,
    source: sourcePayload
  });

  const wordCount = countWordsInString(rawGenerated);
  const now = new Date().toISOString();
  const draftId = `draft_yt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  // Generar Slug inicial sanitizado
  const slugBase = sourcePayload.title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const slug = `${slugBase}-${sourcePayload.videoId.slice(0, 6).toLowerCase()}`;

  const draftObject = {
    id: draftId,
    sourceType: "youtube",
    topic_tema: `Video: ${sourcePayload.title}`,
    topic_angulo: angle || (sourcePayload.isOwnChannel ? "Canal Propio" : "Curaduría Externa"),
    title: generatedTitle,
    slug,
    tag: "Estrategia",
    excerpt: `Análisis y lecciones prácticas a partir de '${sourcePayload.title}' por ${sourcePayload.authorName || "YouTube"}.`,
    content_json: JSON.stringify(finalBlocks),
    brief_json: JSON.stringify({
      sourcePayload,
      systemInstruction,
      generatedAt: now
    }),
    audit_json: JSON.stringify(audit),
    word_count: wordCount,
    status: audit.passed ? "draft" : "failed",
    created_by_user_id: String(userId),
    created_at: now,
    updated_at: now
  };

  return {
    ok: true,
    draft: draftObject,
    audit
  };
}
