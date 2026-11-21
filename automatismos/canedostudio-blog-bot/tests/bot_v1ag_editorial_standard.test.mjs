import test from "node:test";
import assert from "node:assert/strict";
import { detectListPromise, analyzeSectionEnumeration, buildEnhancedEditorialInstructions } from "../src/editorial_standard.js";
import { resolveArticleType } from "../src/article_types.js";
import { VALID_TARGET_SERVICES, validateEnrichedArticleData } from "../src/seo/service_mapping.js";

// Helper: Crea artículo mock válido para pruebas
function makeArticle({
  title = "Guía operativa de innovación",
  content = [],
  rawMarkdown = null,
  targetService = "contacto_estrategico",
  articleType = 2
} = {}) {
  return {
    title,
    tag: "Estrategia",
    excerpt: "Resumen ejecutivo para empresas.",
    content,
    rawMarkdown,
    targetService,
    articleType
  };
}

test("V1-AG MEJORA 1: Detección y discriminación de promesas en títulos", async (t) => {
  await t.test("1.1 Detecta números de 1 a 99 acompañados de sustantivos de lista", () => {
    const r1 = detectListPromise("7 estrategias de marketing digital para pymes");
    assert.ok(r1 && r1.hasListPromise);
    assert.equal(r1.count, 7);
    assert.equal(r1.noun, "estrategias");

    const r2 = detectListPromise("5 herramientas de IA para optimizar tu despacho contable");
    assert.ok(r2 && r2.hasListPromise);
    assert.equal(r2.count, 5);
    assert.equal(r2.noun, "herramientas");

    const r3 = detectListPromise("10 errores comunes al responder mensajes de clientes");
    assert.ok(r3 && r3.hasListPromise);
    assert.equal(r3.count, 10);
    assert.equal(r3.noun, "errores");
  });

  await t.test("1.2 No confunde años (2025, 2026, 2027), monedas o porcentajes con listas", () => {
    assert.equal(detectListPromise("El futuro de la automatización en 2027"), null);
    assert.equal(detectListPromise("Tendencias del mercado para 2026"), null);
    assert.equal(detectListPromise("Cómo reducir un 40% de costes operativos"), null);
    assert.equal(detectListPromise("Versión 3 de la arquitectura empresarial"), null);
    assert.equal(detectListPromise("Inversión de 500 euros en captación"), null);
  });

  await t.test("1.3 Valida listas sin promesa como artículos ordinarios de estructura libre", () => {
    assert.equal(detectListPromise("Por qué tu cliente no lee los correos de presupuesto"), null);
    assert.equal(detectListPromise("La fricción invisible en la atención por WhatsApp"), null);
  });
});

test("V1-AG MEJORA 1 & 6: Auditoría de cumplimiento semántico de secciones", async (t) => {
  await t.test("2.1 Valida positivamente artículo que cumple exactamente la promesa (ej. 3 estrategias)", () => {
    const md = `En este artículo analizamos la fricción comercial de las pymes y cómo resolverla.

## 1. Automatización de prospección
Primer apartado desarrollado en profundidad con ejemplos para una clínica dental y tiempos de respuesta.

## 2. Chatbots con IA conversacional
Segundo apartado desarrollado con ejemplos cotidianos para un taller automotriz que atiende de noche.

## 3. Embudos de reseñas en Google Maps
Tercer apartado con protocolo de captación de opiniones positivas tras el servicio.

## Conclusiones
Cierre estratégico invitando a diagnóstico con Canedo Studio.`;

    const res = analyzeSectionEnumeration(md, 3, "collection");
    assert.equal(res.itemsCount, 3);
    assert.equal(res.fulfilledPromise, true);
    assert.equal(res.hasDuplicates, false);
    assert.equal(res.errors.length, 0);
  });

  await t.test("2.2 Detecta y rechaza lista incompleta (promete 5, entrega 3)", () => {
    const md = `## 1. Primer paso
Desarrollo del primer paso.

## 2. Segundo paso
Desarrollo del segundo paso.

## 3. Tercer paso
Desarrollo del tercer paso.`;

    const res = analyzeSectionEnumeration(md, 5, "sequential");
    assert.equal(res.itemsCount, 3);
    assert.equal(res.fulfilledPromise, false);
    assert.ok(res.errors.some(e => e.includes("UNFULFILLED_LIST_PROMISE")));
  });

  await t.test("2.3 Detecta y rechaza números duplicados en encabezados (ej. dos veces '## 2.')", () => {
    const md = `## 1. Estrategia A
Desarrollo.

## 2. Estrategia B
Desarrollo.

## 2. Estrategia C
Desarrollo duplicado con número repetido.`;

    const res = analyzeSectionEnumeration(md, 3, "collection");
    assert.equal(res.hasDuplicates, true);
    assert.ok(res.errors.some(e => e.includes("DUPLICATE_SECTION_NUMBERING")));
  });

  await t.test("2.4 Detecta y rechaza secciones vacías (encabezados sin contenido)", () => {
    const md = `## 1. Estrategia A
Desarrollo sustancial.

## 2. Estrategia B

## 3. Estrategia C
Desarrollo sustancial.`;

    const res = analyzeSectionEnumeration(md, 3, "collection");
    assert.equal(res.hasEmptySections, true);
    assert.ok(res.errors.some(e => e.includes("EMPTY_SECTION_HEADER")));
  });

  await t.test("2.5 Excluye de forma determinista secciones auxiliares (Introducción, Conclusiones, Preguntas frecuentes)", () => {
    const md = `## Introducción
Contexto del problema empresarial.

## 1. Estrategia A
Desarrollo sustancial.

## 2. Estrategia B
Desarrollo sustancial.

## Conclusiones
Resumen final.

## Preguntas frecuentes
Dudas resueltas.`;

    const res = analyzeSectionEnumeration(md, 2, "collection");
    assert.equal(res.itemsCount, 2);
    assert.equal(res.fulfilledPromise, true);
    assert.equal(res.errors.length, 0);
  });
});

test("V1-AG MEJORA 3, 4 & 5: SEO, AEO, Servicios y Conversión Comercial", async (t) => {
  await t.test("3.1 Los 5 servicios comerciales están reconocidos con rutas reales de producción", () => {
    const expected = ["diseno_web", "chatbots_ia", "automatizacion_resenas", "blog_automatizado", "contacto_estrategico"];
    for (const key of expected) {
      assert.ok(VALID_TARGET_SERVICES[key], `Falta servicio ${key}`);
      assert.ok(VALID_TARGET_SERVICES[key].url.startsWith("/"), `URL inválida para ${key}`);
    }
  });

  await t.test("3.2 Enriquecimiento de metadatos genera BLUF y meta-descripción limpia <= 155 caracteres", () => {
    const raw = {
      tag: "Chatbots",
      title: "Chatbots con IA para pymes",
      executiveSummary: "Atención continua 24/7 que cualifica prospectos y agenda citas automáticamente sin intervención manual constante.",
      targetService: "chatbots_ia",
      customMetaDesc: "Descubre cómo implementar un chatbot con IA que atiende clientes a cualquier hora y cualifica oportunidades reales."
    };
    const validated = validateEnrichedArticleData(raw, []);
    assert.equal(validated.isValid, true);
    assert.equal(validated.cleaned.targetService, "chatbots_ia");
    assert.ok(validated.cleaned.customMetaDesc.length <= 155);
    assert.ok(validated.cleaned.executiveSummary.length >= 30);
  });

  await t.test("3.3 Directivas editoriales inteligentes aportan marco epistémico y AEO/GEO sin inventar datos", () => {
    const instructions = buildEnhancedEditorialInstructions("5 lecciones operativas sobre chatbots con IA");
    assert.ok(instructions.includes("RIGOR EPISTÉMICO"));
    assert.ok(instructions.includes("ESTRUCTURA SEO, AEO Y GEO"));
    assert.ok(instructions.includes("BLUF"));
    assert.ok(instructions.includes("NO inventes estadísticas"));
  });
});

test("V1-AG MEJORA 2: Respeto a límites de longitud por tipo de artículo", async (t) => {
  await t.test("4.1 Tipo 2 (Consejos Pyme) tiene calibrado el rango 650-900 palabras", () => {
    const t2 = resolveArticleType(2);
    assert.equal(t2.minWords, 650);
    assert.equal(t2.maxWords, 900);
    assert.equal(t2.allowedInBlogBot, true);
  });

  await t.test("4.2 Tipo 1 (Novedades Tech) tiene calibrado el rango 400-700 palabras", () => {
    const t1 = resolveArticleType(1);
    assert.equal(t1.minWords, 400);
    assert.equal(t1.maxWords, 700);
    assert.equal(t1.allowedInBlogBot, true);
  });

  await t.test("4.3 Tipo 3 (SEO Especializado) tiene calibrado el rango 1000-1500 palabras", () => {
    const t3 = resolveArticleType(3);
    assert.equal(t3.minWords, 1000);
    assert.equal(t3.maxWords, 1500);
    assert.equal(t3.allowedInBlogBot, true);
  });
});
