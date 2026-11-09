/**
 * Servicios reales de Canedo Studio y reglas deterministas de enriquecimiento SEO/AEO/GEO
 * Usado por canedostudio-blog-bot y por Pages Functions.
 */

export const VALID_TARGET_SERVICES = {
  diseno_web: {
    id: "diseno-web",
    title: "Diseño Web Premium",
    url: "/servicios/diseno-web",
    tag: "Diseño web",
    keywords: ["web", "diseño", "conversion", "landing", "ux", "ui", "movil", "velocidad"]
  },
  chatbots_ia: {
    id: "chatbots-ia",
    title: "Chatbots con Inteligencia Artificial",
    url: "/servicios/chatbots-ia",
    tag: "Chatbots",
    keywords: ["chatbot", "atencion", "leads", "conversacional", "soporte", "24/7", "cualificar"]
  },
  automatizacion_resenas: {
    id: "automatizacion-resenas",
    title: "Embudos de Reseñas y Google Maps",
    url: "/servicios/automatizacion-resenas",
    tag: "Reseñas",
    keywords: ["resenas", "reputacion", "google maps", "estrellas", "opiniones", "valoraciones"]
  },
  blog_automatizado: {
    id: "blog-automatizado",
    title: "Blogs Autogestionados con IA",
    url: "/servicios/blog-automatizado",
    tag: "Automatización",
    keywords: ["blog", "contenido", "articulos", "posicionamiento", "trafico", "autoridad", "organico"]
  },
  contacto_estrategico: {
    id: "contacto",
    title: "Diagnóstico Digital y Automatización",
    url: "/contacto",
    tag: "Estrategia",
    keywords: ["estrategia", "diagnostico", "consultoria", "digital", "pyme", "rentabilidad"]
  }
};

export const VALID_SERVICE_KEYS = new Set(Object.keys(VALID_TARGET_SERVICES));

/**
 * Trunca una metadescripción de forma limpia respetando límites de palabras completas
 * y terminando en un signo de puntuación natural.
 */
export function sanitizeMetaDescription(text, maxChars = 155) {
  if (!text || typeof text !== "string") return "";
  let clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxChars) return clean;

  // Cortar en el límite de la última palabra completa
  let truncated = clean.slice(0, maxChars);
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > 50) {
    truncated = truncated.slice(0, lastSpace);
  }

  // Eliminar comas, puntos suspensivos o caracteres huérfanos al final
  truncated = truncated.replace(/[,;:\-\s]+$/, "");

  // Añadir punto final si no termina en puntuación
  if (!/[.!?]$/.test(truncated)) {
    truncated += ".";
  }

  return truncated;
}

/**
 * Valida determinísticamente los metadatos enriquecidos de un artículo.
 * Limpia y normaliza sin lanzar errores fatales innecesarios.
 */
export function validateEnrichedArticleData(data, articleContent = []) {
  const result = {
    isValid: true,
    warnings: [],
    cleaned: {
      seoVersion: "2.0",
      executiveSummary: null,
      faqs: [],
      targetService: "contacto_estrategico",
      customMetaDesc: null,
      relatedSlugs: []
    }
  };

  // 1. targetService
  if (data.targetService && VALID_SERVICE_KEYS.has(data.targetService)) {
    result.cleaned.targetService = data.targetService;
  } else {
    // Si viene inválido o ausente, fallback inteligente basado en el tag y palabras clave
    const tag = String(data.tag || "").toLowerCase();
    const title = String(data.title || "").toLowerCase();
    const context = `${tag} ${title}`;

    if (context.includes("diseño") || context.includes("web") || context.includes("landing")) {
      result.cleaned.targetService = "diseno_web";
    } else if (context.includes("chatbot") || context.includes("asistente") || context.includes("atencion")) {
      result.cleaned.targetService = "chatbots_ia";
    } else if (context.includes("reseña") || context.includes("maps") || context.includes("reputacion")) {
      result.cleaned.targetService = "automatizacion_resenas";
    } else if (context.includes("blog") || context.includes("automatiz") || context.includes("contenido")) {
      result.cleaned.targetService = "blog_automatizado";
    } else {
      result.cleaned.targetService = "contacto_estrategico";
    }
    result.warnings.push(`targetService asignado determinísticamente: ${result.cleaned.targetService}`);
  }

  // 2. executiveSummary (BLUF)
  if (typeof data.executiveSummary === "string" && data.executiveSummary.trim().length >= 30) {
    result.cleaned.executiveSummary = data.executiveSummary.trim().slice(0, 350);
  } else {
    const firstP = articleContent.find(b => b.type === "p" && b.text && b.text.length > 40);
    if (firstP) {
      result.cleaned.executiveSummary = firstP.text.trim().slice(0, 300);
      result.warnings.push("executiveSummary deducido del primer párrafo.");
    }
  }

  // 3. customMetaDesc (con recorte limpio de palabras)
  let rawMeta = data.customMetaDesc;
  if (!rawMeta || typeof rawMeta !== "string" || rawMeta.trim().length < 25) {
    rawMeta = data.excerpt || result.cleaned.executiveSummary || "";
  }
  result.cleaned.customMetaDesc = sanitizeMetaDescription(rawMeta, 155);

  // 4. faqs (máximo 2 preguntas útiles y no vacías)
  if (Array.isArray(data.faqs)) {
    const validFaqs = [];
    for (const f of data.faqs) {
      if (f && typeof f.q === "string" && typeof f.a === "string") {
        const q = f.q.trim();
        const a = f.a.trim();
        if (q.length >= 10 && q.length <= 150 && a.length >= 20 && a.length <= 400) {
          validFaqs.push({ q, a });
          if (validFaqs.length >= 2) break;
        }
      }
    }
    result.cleaned.faqs = validFaqs;
  }

  // 5. relatedSlugs (sanitizados y validados)
  if (Array.isArray(data.relatedSlugs)) {
    const seen = new Set();
    const cleanSlugs = [];
    for (const s of data.relatedSlugs) {
      if (typeof s === "string") {
        const trimmed = s.trim().toLowerCase();
        if (trimmed && !seen.has(trimmed) && trimmed !== String(data.slug || "").toLowerCase()) {
          seen.add(trimmed);
          cleanSlugs.push(trimmed);
          if (cleanSlugs.length >= 3) break;
        }
      }
    }
    result.cleaned.relatedSlugs = cleanSlugs;
  }

  return result;
}

/**
 * Selecciona determinísticamente entre 2 y 3 artículos relacionados de D1 para un artículo nuevo.
 * Reglas:
 * 1. Prioriza coincidencia de categoría/tag idéntica.
 * 2. Desempata por palabras clave temáticas y orden cronológico reciente.
 * 3. Excluye el propio slug del artículo y cualquier artículo que no esté en estado 'published'.
 * 4. Evita escaneos completos (hace queries acotadas por tag o palabras clave).
 */
export async function resolveRelatedArticlesFromD1(db, currentArticle, options = {}) {
  const { limit = 3 } = options;
  if (!db || typeof db.prepare !== "function" || !currentArticle) {
    return [];
  }

  const currentSlug = String(currentArticle.slug || "").trim().toLowerCase();
  const currentTag = String(currentArticle.tag || "Estrategia").trim();

  try {
    // Consulta 1: Buscar artículos publicados con el mismo tag excluyendo el actual
    const sqlSameTag = `
      SELECT slug, title, tag, date
      FROM blog_posts
      WHERE status = 'published' AND slug != ? AND tag = ?
      ORDER BY date DESC, id DESC
      LIMIT ?
    `;
    const tagMatches = await db.prepare(sqlSameTag).bind(currentSlug, currentTag, limit + 2).all();
    const tagList = Array.isArray(tagMatches?.results) ? tagMatches.results : [];

    const selectedSlugs = [];
    const seen = new Set();
    seen.add(currentSlug);

    for (const row of tagList) {
      if (row.slug && !seen.has(row.slug.toLowerCase())) {
        seen.add(row.slug.toLowerCase());
        selectedSlugs.push(row.slug);
        if (selectedSlugs.length >= limit) break;
      }
    }

    // Regla de Calidad AEO: No forzar artículos de otras categorías si no hay coincidencia temática genuina.
    // Si solo hay 1 o 2 artículos de la misma categoría, devolver solo los pertinentes para no diluir relevancia.
    return selectedSlugs.slice(0, limit);
  } catch (err) {
    console.warn("Advertencia: No se pudieron resolver artículos relacionados de D1:", err.message);
    return [];
  }
}
