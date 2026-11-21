import test from "node:test";
import assert from "node:assert/strict";
import { extractMetadataForArticle } from "../src/editorial_pipeline.js";
import { validateEnrichedArticleData } from "../src/seo/service_mapping.js";
import { buildDeterministicScene, buildFluxPrompt } from "../src/semantic_cover.js";

test("POST V1-AG REGRESSION SUITE: Títulos, FAQs y Portadas Semánticas", async (suite) => {
  await suite.test("1. Conserva la intención y especificidad del título curado", async () => {
    const curadoTopic = {
      tema: "Tu primera venta que llegó sola: cómo se siente y cómo se repite",
      angulo: "documentar el primer cliente automático para multiplicarlo"
    };

    const mockContent = [
      { type: "p", text: "La primera venta que llega sola es un hito operativo crucial para el negocio." },
      { type: "h2", text: "1. Diagnóstico del patrón inicial" },
      { type: "p", text: "Analizar el canal por el que llegó el prospecto." }
    ];

    // Mock IA que intenta recortar el título a 'Venta sola'
    const mockEnv = {
      AI: {
        run: async () => ({
          response: JSON.stringify({
            title: "Venta sola",
            tag: "Estrategia",
            excerpt: "Resumen breve",
            executiveSummary: "Resumen BLUF de 35 a 60 palabras bien desarrollado.",
            targetService: "diseno_web",
            faqs: [{ q: "¿Cómo replicar la primera venta?", a: "Estructurando un embudo claro con seguimiento oportuno a los prospectos." }]
          })
        })
      }
    };

    const article = await extractMetadataForArticle(mockEnv, {
      topic: curadoTopic,
      content: mockContent,
      brief: { uniqueThesis: curadoTopic.tema }
    });

    assert.equal(
      article.title,
      "Tu primera venta que llegó sola: cómo se siente y cómo se repite",
      "Debe prevalecer el título curado completo en vez de resumirse a 'Venta sola'"
    );
  });

  await suite.test("2. FAQs: Rechaza respuestas superficiales o circulares (< 35 chars)", async () => {
    const badFaqData = {
      faqs: [
        { q: "¿Qué significa una venta sola?", a: "Una venta que llega sin esfuerzo" } // 32 caracteres (superficial)
      ]
    };

    const validatedBad = validateEnrichedArticleData(badFaqData);
    assert.equal(validatedBad.cleaned.faqs.length, 0, "No debe aceptar FAQ superficial de 32 caracteres");

    const goodFaqData = {
      faqs: [
        {
          q: "¿Qué significa una venta que llega sola en un negocio?",
          a: "Indica que tu propuesta de valor, posicionamiento local y arquitectura web resolvieron las dudas del cliente antes de contactarte."
        }
      ]
    };

    const validatedGood = validateEnrichedArticleData(goodFaqData);
    assert.equal(validatedGood.cleaned.faqs.length, 1, "Debe aceptar FAQ sustantiva");
  });

  await suite.test("3. Portadas: Prompt fotográfico diurno y editorial sin fondos negros", async () => {
    const scene = buildDeterministicScene("Tu primera venta que llegó sola cómo se siente y cómo se repite", "Venta digital");
    const fluxPrompt = buildFluxPrompt(scene);

    assert.ok(!fluxPrompt.includes("dark luxurious style"), "No debe forzar estilo oscuro de lujo");
    assert.ok(!fluxPrompt.includes("deep black background"), "No debe forzar fondo negro profundo");
    assert.ok(fluxPrompt.includes("natural architectural lighting"), "Debe exigir iluminación arquitectónica natural");
    assert.ok(fluxPrompt.includes("AVOID: darkness"), "Debe evitar oscuridad excesiva");
  });
});
