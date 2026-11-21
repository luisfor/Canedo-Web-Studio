// File: automatismos/canedostudio-blog-bot/src/semantic_cover.js
/**
 * Módulo de Generación Visual Semántica y Fotografía Editorial para Canedo Studio (Fase V1)
 * Diseñado para Cloudflare Workers AI (Llama 3.1 8B + Flux-1 Schnell).
 *
 * Principios:
 * 1. La escena debe representar el contenido real del artículo (atención al cliente, finanzas,
 *    industria, ciberseguridad, automatización), evitando el sesgo monótono de fondos negros o rayos.
 * 2. Si Llama 3.1 8B está disponible en el entorno, se genera un brief visual conciso en inglés.
 * 3. Si Llama 3.1 8B falla o no está disponible, se utiliza un mapeador determinista amplio en inglés.
 * 4. Si Flux falla o sufre timeout, se preserva la portada de contingencia estructurada.
 * 5. Cero listas indiscriminadas de palabras prohibidas que puedan romper conceptos legítimos (ej. electricidad técnica).
 */

export const MODEL_TEXT_VISUAL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
export const MODEL_IMAGE_FLUX = "@cf/black-forest-labs/flux-1-schnell";

// Estilo fotográfico maestro editorial de Canedo Studio
export const EDITORIAL_STYLE_MASTER =
  "High-end editorial photograph for a prestigious business publication. Authentic professional environment, " +
  "natural architectural lighting and realistic atmosphere, high-detail medium format camera aesthetic, " +
  "cinematic depth of field, clear foreground-to-background composition. " +
  "AVOID: darkness, lightning strikes, abstract floating spheres, neon lasers, cartoon, 3d render, CGI, text, letters, watermarks, exaggerated fake smiles.";

/**
 * Mapeador determinista de respaldo cuando Llama 8B no está disponible o falla.
 * Diseñado para abarcar múltiples áreas empresariales con descripciones en inglés concretas.
 * 
 * @param {string} fullContext - Texto contextual normalizado
 * @param {string} defaultTitle - Título por defecto
 * @returns {string} Escena fotográfica concreta
 */
export function buildDeterministicScene(fullContext, defaultTitle = "business workplace") {
  const ctx = (fullContext || "").toLowerCase();

  if (/reputaci[oó]n|reseña|google maps|opinion|valoraci[oó]n|estrella/i.test(ctx)) {
    return "A local business manager in an inviting contemporary office checking positive customer feedback on a tablet, street view visible through glass window";
  }
  if (/atenci[oó]n|cliente|soporte|mostrador|queja|servicio al cliente|customer/i.test(ctx)) {
    return "A modern business customer service counter, attentive professional representative warmly assisting a customer, authentic human interaction, natural daylight";
  }
  if (/seguridad|ciberseguridad|hacker|vulnerab|protecci[oó]n datos|firewall/i.test(ctx)) {
    return "A cybersecurity specialist calmly monitoring corporate systems and analytics displays in a professional IT security office, focused atmosphere";
  }
  if (/electric|energ[ií]a|instalaci[oó]n el[eé]ctric|tensi[oó]n/i.test(ctx)) {
    return "A certified technical engineer safely inspecting a clean industrial electrical control panel with professional testing tools, realistic workshop";
  }
  if (/taller|mec[aá]nic|automotri|veh[ií]cul/i.test(ctx)) {
    return "Precision automotive engineering workshop, modern diagnostic tools and organized professional vehicle maintenance bay, natural workshop light";
  }
  if (/dent|odont|clinic|salud bucal/i.test(ctx)) {
    return "Contemporary high-end dental clinic room, advanced clinical equipment, pristine clean medical setting, soft natural lighting";
  }
  if (/salud|m[eé]dic|hospital|terap|fisioterap/i.test(ctx)) {
    return "Modern professional healthcare consultation room, specialist doctor reviewing charts, authentic medical clinic environment";
  }
  if (/asesor|contab|fiscal|legal|abogad|finanz|impuesto/i.test(ctx)) {
    return "Contemporary executive financial advisory office, clean desk, documents and laptop, architectural corporate meeting space";
  }
  if (/inmobiliar|propiedad|real estate|vivienda|arquitect/i.test(ctx)) {
    return "Elegant bright real estate office with architectural models and bright interior views, modern property consulting environment";
  }
  if (/restauran|gastronom|hosteler|hotel|caf[eé]/i.test(ctx)) {
    return "Artisanal modern restaurant or boutique cafe, head chef or barista preparing gourmet presentation in a warm welcoming atmosphere";
  }
  if (/comercio|tienda|retail|boutique|escaparate/i.test(ctx)) {
    return "Boutique retail shop interior, stylish product display shelves, boutique owner arranging elegant merchandise, warm ambient lighting";
  }
  if (/automatiz|ia|inteligencia artificial|robot|software|digitaliz/i.test(ctx)) {
    return "Modern dynamic team collaborating with productivity software and digital workflow interfaces in an open-plan innovation office, bright daylight";
  }

  // Fallback genérico sobrio y diurno
  return "A modern executive meeting room, professionals discussing project strategy around a conference table with natural daylight";
}

/**
 * Genera un brief visual en inglés para Flux utilizando Llama 3.1 8B.
 * Trata el título y resumen como datos pasivos para evitar prompt injection.
 * 
 * @param {object} params
 * @param {object} params.ai - Binding Workers AI (env.AI)
 * @param {string} params.title - Título del artículo
 * @param {string} params.summary - Resumen o extracto del artículo
 * @param {string} params.tag - Tag o sector (opcional)
 * @returns {Promise<{ scene: string, source: "llama_8b" | "deterministic" }>}
 */
export async function generateVisualBrief({ ai, title, summary, tag }) {
  const safeTitle = (title || "").slice(0, 200).replace(/["`\\]/g, " ");
  const safeSummary = (summary || "").slice(0, 400).replace(/["`\\]/g, " ");
  const safeCategory = (tag || "").slice(0, 100).replace(/["`\\]/g, " ").trim();
  const fullContext = `${safeTitle} ${safeSummary} ${safeCategory}`.trim();

  if (!ai || typeof ai.run !== "function") {
    return {
      scene: buildDeterministicScene(fullContext, safeTitle),
      source: "deterministic"
    };
  }

  const systemPrompt =
    "You are a photo director for a premium business magazine. " +
    "Given the title, category, and summary of a business article, output ONLY a single concise English scene description (max 30 words) " +
    "for an authentic editorial photograph depicting the concrete situation or real-world human activity. " +
    "CRITICAL RULES:\n" +
    "- Match the specific business domain (e.g., storefront, customer service counter, medical clinic, industrial workshop, logistics floor, client consultation).\n" +
    "- AVOID GENERIC OFFICE CLICHES: Do NOT default to a person sitting at a desk typing on a laptop or staring at a computer screen unless strictly required by the topic.\n" +
    "- Show active real-world human interactions, physical processes, or tangible business environments.\n" +
    "- Never output abstract sci-fi concepts, glowing spheres, neon lasers, lightning strikes, or black voids.\n" +
    "- Do not include text, signs, logos, or words in the image.\n" +
    "- Output ONLY the plain scene description, nothing else, no markdown, no quotes, no conversational filler.";

  const categoryLine = safeCategory ? `Category: ${safeCategory}\n` : "";
  const userPrompt = `ARTICLE:\nTitle: ${safeTitle}\n${categoryLine}Summary: ${safeSummary}\n\nVisual scene:`;

  try {
    const response = await ai.run(MODEL_TEXT_VISUAL, {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_tokens: 60,
      temperature: 0.2
    });

    let sceneText = "";
    if (typeof response === "string") {
      sceneText = response;
    } else if (response && typeof response.response === "string") {
      sceneText = response.response;
    }

    sceneText = sceneText.trim().replace(/^["'`]|["'`]$/g, "").replace(/^Scene:\s*/i, "");

    // Si Llama devolvió una respuesta válida no vacía
    if (sceneText.length >= 15 && sceneText.length <= 300) {
      return { scene: sceneText, source: "llama_8b" };
    }
  } catch (err) {
    console.warn(`[VISUAL BRIEF WARN] Falló Llama para brief visual (${err.message}). Usando fallback determinista.`);
  }

  return {
    scene: buildDeterministicScene(fullContext, safeTitle),
    source: "deterministic"
  };
}

/**
 * Ensambla el prompt fotográfico final para Flux-1 Schnell.
 * 
 * @param {string} scene - Descripción concreta de la escena
 * @returns {string} Prompt completo para Flux
 */
export function buildFluxPrompt(scene) {
  const cleanScene = (scene || "").trim().replace(/[.\s]+$/, "");
  return `${EDITORIAL_STYLE_MASTER} Scene: ${cleanScene}.`;
}

/**
 * Pipeline completo de generación de portada semántica con manejo de fallbacks.
 * 
 * @param {object} params
 * @param {object} params.ai - Binding Workers AI
 * @param {string} params.title - Título del artículo
 * @param {string} params.summary - Resumen del artículo
 * @param {string} [params.tag] - Tag sectorial
 * @param {Function} [params.fallbackCoverFn] - Función creadora de imagen de respaldo
 * @returns {Promise<{ bytes: ArrayBuffer, meta: object }>}
 */
export async function generateSemanticCover({ ai, title, summary, tag, fallbackCoverFn }) {
  const startTime = Date.now();
  let briefResult = { scene: "", source: "deterministic" };

  try {
    briefResult = await generateVisualBrief({ ai, title, summary, tag });
  } catch (e) {
    briefResult = {
      scene: buildDeterministicScene(`${title} ${summary}`, title),
      source: "deterministic"
    };
  }

  const finalPrompt = buildFluxPrompt(briefResult.scene);
  let bytes = null;
  let fluxError = null;

  if (ai && typeof ai.run === "function") {
    try {
      const result = await ai.run(MODEL_IMAGE_FLUX, { prompt: finalPrompt });
      if (result instanceof ArrayBuffer) {
        bytes = result;
      } else if (result && typeof result.arrayBuffer === "function") {
        bytes = await result.arrayBuffer();
      } else if (result && typeof result.getReader === "function") {
        bytes = await new Response(result).arrayBuffer();
      } else if (result && result.image) {
        const bin = atob(result.image);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        bytes = arr.buffer;
      }
    } catch (err) {
      fluxError = err.message || String(err);
      console.warn(`[FLUX AI WARN] Error al generar imagen con Flux Schnell: ${fluxError}`);
    }
  }

  let isFallback = false;
  if (!bytes || bytes.byteLength < 1000) {
    isFallback = true;
    if (typeof fallbackCoverFn === "function") {
      bytes = fallbackCoverFn();
    } else {
      bytes = new Uint8Array(12000).buffer;
    }
  }

  const durationMs = Date.now() - startTime;

  return {
    bytes,
    meta: {
      scene: briefResult.scene,
      briefSource: briefResult.source,
      fluxPrompt: finalPrompt,
      isFallback,
      fluxError,
      durationMs
    }
  };
}
