// File: automatismos/canedostudio-blog-bot/src/article_types.js
// Definición de los 5 tipos de artículos editoriales para Canedo Studio y utilidades de configuración

export const ARTICLE_TYPES = {
  TIPO_1: {
    id: "tipo_1",
    code: 1,
    name: "Noticias y Novedades Tecnológicas",
    shortName: "Novedades Tech",
    minWords: 400,
    maxWords: 700,
    allowedInBlogBot: true,
    allowedInTelegram: true,
    sectionStrategy: "single", // Monolítico en Markdown directo
    description: "Análisis ágil de tendencias, novedades de IA y cambios tecnológicos con impacto en pymes."
  },
  TIPO_2: {
    id: "tipo_2",
    code: 2,
    name: "Consejos Prácticos para Negocios",
    shortName: "Consejos Pyme",
    minWords: 650, // Límite inferior Fase 6L (650)
    maxWords: 900, // Límite superior Fase 6L (900) para garantizar 100% de compatibilidad con Quality Gate Fase 6L
    targetMaxWords: 1000,
    allowedInBlogBot: true,
    allowedInTelegram: true,
    sectionStrategy: "sections", // Seccional resiliente con control determinista de palabras
    description: "Estrategias operativas, mejoras de conversión y optimización de ventas para negocios cotidianos."
  },
  TIPO_3: {
    id: "tipo_3",
    code: 3,
    name: "Artículos SEO Especializados",
    shortName: "SEO Especializado",
    minWords: 1000,
    maxWords: 1500,
    allowedInBlogBot: true,
    allowedInTelegram: true,
    sectionStrategy: "sections", // Esquema + 2 a 3 secciones enlazadas
    description: "Contenido de fondo con intención de búsqueda exhaustiva, preguntas frecuentes y enlaces estratégicos."
  },
  TIPO_4: {
    id: "tipo_4",
    code: 4,
    name: "Tutoriales y Guías Paso a Paso",
    shortName: "Tutorial Práctico",
    minWords: 1500,
    maxWords: 2500,
    allowedInBlogBot: false, // Exclusivo Telegram
    allowedInTelegram: true,
    sectionStrategy: "sections", // Esquema + 3 a 5 secciones paso a paso
    description: "Manuales detallados de implementación con ejemplos, advertencias de error y protocolos aplicables."
  },
  TIPO_5: {
    id: "tipo_5",
    code: 5,
    name: "Guías Técnicas Completas",
    shortName: "Guía Técnica Exhaustiva",
    minWords: 2000,
    maxWords: 3000,
    allowedInBlogBot: false, // Exclusivo Telegram
    allowedInTelegram: true,
    sectionStrategy: "sections", // Esquema + 4 a 6 secciones avanzadas
    description: "Monografías exhaustivas sobre automatizaciones, integraciones y arquitecturas para directivos y líderes técnicos."
  }
};

/**
 * Resuelve la configuración de un tipo a partir de un identificador numérico o string
 */
export function resolveArticleType(typeIdentifier) {
  if (!typeIdentifier) return ARTICLE_TYPES.TIPO_2; // Por defecto Consejos Pyme (700-1000)

  if (typeof typeIdentifier === "number") {
    const key = `TIPO_${typeIdentifier}`;
    return ARTICLE_TYPES[key] || ARTICLE_TYPES.TIPO_2;
  }

  const str = String(typeIdentifier).trim().toLowerCase();
  if (str === "1" || str === "tipo_1" || str.includes("noticia") || str.includes("novedad")) return ARTICLE_TYPES.TIPO_1;
  if (str === "2" || str === "tipo_2" || str.includes("consejo") || str.includes("negocio")) return ARTICLE_TYPES.TIPO_2;
  if (str === "3" || str === "tipo_3" || str.includes("seo")) return ARTICLE_TYPES.TIPO_3;
  if (str === "4" || str === "tipo_4" || str.includes("tutorial") || str.includes("paso")) return ARTICLE_TYPES.TIPO_4;
  if (str === "5" || str === "tipo_5" || str.includes("guia") || str.includes("tecnica")) return ARTICLE_TYPES.TIPO_5;

  return ARTICLE_TYPES.TIPO_2;
}

/**
 * Filtra los tipos elegibles para el Blog Bot automático (Tipos 1, 2 y 3)
 */
export function getBlogBotEligibleTypes() {
  return [ARTICLE_TYPES.TIPO_1, ARTICLE_TYPES.TIPO_2, ARTICLE_TYPES.TIPO_3];
}
