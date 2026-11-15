import test from "node:test";
import assert from "node:assert/strict";
import {
  countEditorialWords,
  checkDuplicateParagraphs,
  auditArticle,
  MIN_EDITORIAL_WORDS,
  MAX_EDITORIAL_WORDS
} from "../src/index.js";

// Helper para crear un texto con N palabras exactas
function generateWords(count, prefix = "palabra") {
  const words = [];
  for (let i = 1; i <= count; i++) {
    words.push(`${prefix}${i}`);
  }
  return words.join(" ");
}

test("FASE 6L: FORTALECIMIENTO DETERMINISTA DEL QUALITY GATE EDITORIAL", async (t) => {

  await t.test("1. Contador determinista de palabras: Reglas de inclusión y exclusión", () => {
    const article = {
      title: "Título de prueba no computable",
      excerpt: "Extracto para listados de 15 palabras no computable en cuerpo editorial",
      executiveSummary: "Resumen BLUF de 20 palabras que no forma parte del cuerpo principal de lectura",
      content: [
        { type: "h2", text: "Subtítulo de sección excluido del conteo de cuerpo" },
        { type: "p", text: "Párrafo uno con diez palabras para comprobar el cálculo real." }, // 10
        { type: "quote", text: "Cita destacada con ocho palabras válidas en cuerpo." }, // 8
        { type: "h2", text: "Segundo subtítulo también excluido" },
        { type: "p", text: "Párrafo dos con doce palabras adicionales útiles para verificar la suma precisa." } // 12
      ]
    };

    const stats = countEditorialWords(article);
    assert.equal(stats.bodyWords, 30, "Solo párrafos ('p') y citas ('quote') suman a bodyWords (10 + 8 + 12 = 30)");
    assert.equal(stats.paragraphCount, 3, "Debe registrar 3 bloques de lectura computables");
    assert.ok(stats.totalWords > stats.bodyWords, "totalWords incluye además los subtítulos h2");
  });

  await t.test("2. Calibración de límites: MIN_EDITORIAL_WORDS = 650 y MAX_EDITORIAL_WORDS = 900", () => {
    assert.equal(MIN_EDITORIAL_WORDS, 650);
    assert.equal(MAX_EDITORIAL_WORDS, 900);
  });

  await t.test("3. Rechazo de artículo deficiente de 310 palabras (caso Artículo #73)", async () => {
    // Simular el artículo #73 con 310 palabras en cuerpo
    const shortArticle = {
      title: "Cómo convertir visitas de sitio web en leads y ventas",
      executiveSummary: "Un sitio web debe estar diseñado para vender, no solo para informar.",
      content: [
        { type: "p", text: generateWords(60, "intro") },
        { type: "h2", text: "Sección 1" },
        { type: "p", text: generateWords(80, "secA") },
        { type: "h2", text: "Sección 2" },
        { type: "p", text: generateWords(90, "secB") },
        { type: "h2", text: "Sección 3" },
        { type: "p", text: generateWords(80, "cierre") }
      ]
    };

    const stats = countEditorialWords(shortArticle);
    assert.equal(stats.bodyWords, 310, "El borrador debe sumar exactamente 310 palabras de cuerpo");

    // Mock del LLM complaciente que califica con 90/100
    const mockEnv = {
      AI: {
        async run() {
          return {
            response: JSON.stringify({
              approved: true,
              metrics: {
                depth: { score: 95, evidence: "Aprobado por LLM benevolente" },
                originality: { score: 90 },
                nonObviousness: { score: 85 },
                nuance: { score: 85 },
                humanness: { score: 85 },
                specificity: { score: 85 }
              },
              reasons: []
            })
          };
        }
      }
    };

    const audit = await auditArticle(mockEnv, shortArticle, { uniqueThesis: "Tesis" });
    assert.equal(audit.approved, false, "El Quality Gate determinista debe anular la aprobación del LLM");
    assert.equal(audit.metrics.depth.score, 0, "Debe penalizar la métrica depth con score 0");
    assert.ok(audit.reasons.some(r => r.problem === "ArticleTooShort"), "Debe registrar motivo ArticleTooShort en reasons");
    assert.match(audit.reasons[0].evidence, /310 palabras/);
  });

  await t.test("4. Rechazo determinista por artículo excesivamente largo (>900 palabras)", async () => {
    const longArticle = {
      title: "Guía exhaustiva interminable",
      content: [
        { type: "p", text: generateWords(500, "bloqueA") },
        { type: "h2", text: "Parte Media" },
        { type: "p", text: generateWords(450, "bloqueB") } // Total 950 palabras
      ]
    };

    const mockEnv = {
      AI: {
        async run() {
          return {
            response: JSON.stringify({
              approved: true,
              metrics: {
                depth: { score: 90 },
                originality: { score: 90 },
                nonObviousness: { score: 85 },
                nuance: { score: 85 },
                humanness: { score: 85 },
                specificity: { score: 85 }
              },
              reasons: []
            })
          };
        }
      }
    };

    const audit = await auditArticle(mockEnv, longArticle, { uniqueThesis: "Tesis" });
    assert.equal(audit.approved, false);
    assert.ok(audit.reasons.some(r => r.problem === "ArticleTooLong"));
    assert.match(audit.reasons[0].evidence, /950 palabras/);
  });

  await t.test("5. Detección determinista de párrafos idénticos (caso de duplicación del Artículo #73)", () => {
    const repeatedText = "Un sitio web debe estar diseñado para vender, no solo para informar. La clave es encontrar el equilibrio entre la cantidad de información proporcionada y la efectividad en la generación de leads. Con una estrategia de marketing integral, puedes mejorar la conversión de visitas en leads y ventas.";
    
    // Simula exactamente el fallo del artículo 73: mismo texto en executiveSummary, bloque 2 y bloque 4
    const article = {
      executiveSummary: repeatedText,
      content: [
        { type: "h2", text: "Introducción" },
        { type: "p", text: "Texto legítimo y variado sobre clínicas dentales y llamadas fuera de horario comercial." },
        { type: "p", text: repeatedText }, // Duplicado 1
        { type: "h2", text: "Conclusión" },
        { type: "p", text: "Un sitio web debe estar diseñado para VENDER, no solo para informar! La clave es encontrar el equilibrio entre la cantidad de información proporcionada y la efectividad en la generación de leads. Con una estrategia de marketing integral, puedes mejorar la conversión de visitas en leads y ventas." } // Duplicado con mayúsculas y exclamación
      ]
    };

    const dupResult = checkDuplicateParagraphs(article);
    assert.equal(dupResult.hasDuplicate, true, "Debe detectar párrafos duplicados normalizando mayúsculas y puntuación");
    assert.ok(dupResult.duplicates.length >= 1);
    assert.equal(dupResult.duplicates[0].type, "exact_duplicate");
    assert.equal(dupResult.duplicates[0].similarity, 1.0);
  });

  await t.test("6. Detección de redundancia léxica sustancial (Jaccard >= 70%)", () => {
    // Párrafos con ligeras variaciones de palabras conectivas pero contenido 75% idéntico
    const pA = "Para una clínica dental o un taller mecánico independiente gestionar los cobros a tiempo asegura un flujo de caja predecible y reduce la morosidad mensual de forma sistemática y transparente sin dañar la relación con el cliente.";
    const pB = "En una clínica dental o un taller mecánico independiente gestionar los cobros a tiempo garantiza un flujo de caja predecible y reduce la morosidad mensual de manera sistemática y clara sin perjudicar la relación con el cliente.";

    const article = {
      content: [
        { type: "p", text: pA },
        { type: "h2", text: "Desarrollo" },
        { type: "p", text: pB }
      ]
    };

    const dupResult = checkDuplicateParagraphs(article);
    assert.equal(dupResult.hasDuplicate, true, "Debe detectar redundancia sustancial entre ambos párrafos");
    assert.ok(dupResult.duplicates.some(d => d.type === "high_redundancy" || d.type === "exact_duplicate"));
  });

  await t.test("7. Prevención de falsos positivos: Frases breves o terminología comercial común no disparan alerta", () => {
    const article = {
      executiveSummary: "Solución ágil para mejorar ventas en negocios tradicionales.",
      content: [
        { type: "p", text: "El servicio de Canedo Studio permite implementar chatbots con inteligencia artificial en pocos días hábiles." },
        { type: "h2", text: "Beneficio comercial" },
        { type: "p", text: "Los chatbots con inteligencia artificial resuelven dudas frecuentes en cualquier horario." },
        { type: "quote", text: "La inmediatez es la clave del servicio moderno." },
        { type: "p", text: "Solicita una llamada de diagnóstico con Canedo Studio para evaluar tu caso particular." }
      ]
    };

    const dupResult = checkDuplicateParagraphs(article);
    assert.equal(dupResult.hasDuplicate, false, "Frases breves o menciones al nombre de la agencia no deben generar falsos positivos");
  });

  await t.test("8. Calificación exitosa: Artículo de 714 palabras con estructura rica y párrafos diversos", async () => {
    const compliantArticle = {
      title: "Cobrar a tiempo en despachos y clínicas: el sistema sin fricción",
      tag: "Automatización",
      executiveSummary: "La morosidad en servicios se debe a fricciones en el pago. Un flujo automatizado con pasarela elimina la incomodidad.",
      content: [
        { type: "p", text: generateWords(90, "introA") },
        { type: "h2", text: "1. La fricción en la gestión manual" },
        { type: "p", text: generateWords(85, "tallerA") },
        { type: "p", text: generateWords(90, "clinicaB") },
        { type: "h2", text: "2. Protocolo de notificaciones neutrales" },
        { type: "p", text: generateWords(85, "neutralC") },
        { type: "p", text: generateWords(90, "adopcionD") },
        { type: "h2", text: "3. Trade-offs y pasarelas transparentes" },
        { type: "p", text: generateWords(85, "pasarelaE") },
        { type: "p", text: generateWords(95, "firmezaF") },
        { type: "h2", text: "4. Diagnóstico e implantación" },
        { type: "p", text: generateWords(94, "cierreG") } // Total = 90+85+90+85+90+85+95+94 = 714 palabras
      ]
    };

    const stats = countEditorialWords(compliantArticle);
    assert.equal(stats.bodyWords, 714);
    assert.ok(stats.bodyWords >= MIN_EDITORIAL_WORDS && stats.bodyWords <= MAX_EDITORIAL_WORDS);

    const mockEnv = {
      AI: {
        async run() {
          return {
            response: JSON.stringify({
              approved: true,
              metrics: {
                depth: { score: 85 },
                originality: { score: 88 },
                nonObviousness: { score: 82 },
                nuance: { score: 80 },
                humanness: { score: 85 },
                specificity: { score: 86 }
              },
              reasons: []
            })
          };
        }
      }
    };

    const audit = await auditArticle(mockEnv, compliantArticle, { uniqueThesis: "Tesis" });
    assert.equal(audit.approved, true, "Debe aprobar el artículo perfectamente conforme con las reglas deterministas");
    assert.equal(audit.reasons.length, 0);
  });

});
