// File: automatismos/canedostudio-blog-bot/tests/bot_schedules_and_fallbacks.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import worker, { publish } from "../src/index.js";

function createMockD1(options = {}) {
  const db = new DatabaseSync(":memory:");
  const d1Sql = readFileSync("cazas/canedostudio.com/migrations/blog/0001_create_blog_posts.sql", "utf8");
  const seedSql = readFileSync("cazas/canedostudio.com/migrations/blog/0002_seed_72_posts.sql", "utf8");
  db.exec(d1Sql);
  db.exec(seedSql);

  return {
    prepare(sql) {
      return {
        _sql: sql,
        _params: [],
        bind(...params) {
          this._params = params;
          return this;
        },
        async first() {
          const stmt = db.prepare(this._sql);
          return stmt.get(...this._params) || null;
        },
        async all() {
          const stmt = db.prepare(this._sql);
          return { results: stmt.all(...this._params) || [] };
        },
        async run() {
          const stmt = db.prepare(this._sql);
          const info = stmt.run(...this._params);
          return { success: true, meta: { changes: info.changes } };
        }
      };
    },
    _rawDb: db
  };
}

function createMockKV(initialPosts = []) {
  const store = new Map();
  store.set("posts", JSON.stringify({ posts: initialPosts }));
  store.set("state", JSON.stringify({ usedTopics: [], generatedHistory: [] }));

  return {
    async get(key, opts) {
      const val = store.get(key);
      if (!val) return null;
      if (opts && opts.type === "arrayBuffer") {
        return val instanceof ArrayBuffer ? val : new TextEncoder().encode(val).buffer;
      }
      return typeof val === "string" ? val : JSON.stringify(val);
    },
    async put(key, val) {
      store.set(key, val);
    },
    async delete(key) {
      store.delete(key);
    },
    _store: store
  };
}

function createStandardMockAI({ failFlux = false, failQG = false, failLlama = false } = {}) {
  const sampleArticleContent = [
    { type: "p", text: "El comportamiento de búsqueda de los consumidores y directivos ha experimentado una transformación profunda durante los últimos años en el entorno digital. Un número creciente de dueños de negocios, profesionales autónomos y particulares investigan proveedores durante la noche, cuando concluye su propia jornada laboral y pueden evaluar alternativas con serenidad. Si un sitio web corporativo carece de mecanismos de respuesta interactiva, estas visitas nocturnas consumen información y abandonan la página sin dejar rastro de contacto comercial, diluyendo la inversión publicitaria efectuada y reduciendo las oportunidades de venta efectiva para la empresa." },
    { type: "h2", text: "La oportunidad desaprovechada en horarios no laborales" },
    { type: "p", text: "Pensemos en el caso habitual de un taller mecánico de chapa y pintura o una clínica de estética avanzada con tratamientos programados. Un conductor que sufre una avería menor al regresar a casa o un usuario que busca un procedimiento específico navega habitualmente a altas horas de la noche con una alta intención de compra. Si el canal digital solo ofrece un formulario estático que promete respuesta en veinticuatro horas, la probabilidad de abandono se dispara hacia competidores con atención inmediata y canales directos que resuelven dudas en tiempo real." },
    { type: "p", text: "Una situación idéntica se presenta en academias de formación profesional o agencias de servicios inmobiliarios urbanos. Los usuarios buscan respuestas a dudas operativas inmediatas: precios de matrícula, disponibilidad horaria o requisitos de financiación para formalizar reservas. Ante el silencio del canal corporativo, la urgencia de contratación decae rápidamente y el interés se diluye por completo antes del amanecer, impidiendo consolidar oportunidades que estaban perfectamente maduras para cerrar y que requerían únicamente orientación básica." },
    { type: "h2", text: "Atención cualificada sin saturación de personal" },
    { type: "p", text: "La incorporación de un agente conversacional inteligente permite cubrir esta ventana horaria sin necesidad de contratar personal en turnos de guardia ni sobrecargar al equipo existente con tareas fuera de convenio. El sistema interactúa de manera educada y precisa, respondiendo preguntas frecuentes a partir de una base de conocimiento rigurosamente delimitada y filtrando la idoneidad del cliente antes de transferirlo al departamento comercial correspondiente para su posterior seguimiento." },
    { type: "p", text: "La clave de este modelo radica en la honestidad de la interacción conversacional. El asistente no finge ser un humano ni promete soluciones imposibles; se presenta como un facilitador que recopila las especificaciones del encargo y agenda una llamada directa con el especialista a primera hora del día laborable siguiente, transmitiendo rigor organizativo y seriedad profesional en cada una de sus intervenciones." },
    { type: "h2", text: "Fricción técnica reducida y conexión con el flujo de ventas" },
    { type: "p", text: "Para que este sistema funcione con máxima rentabilidad comercial, debe enlazarse de forma transparente con el calendario corporativo y las herramientas de gestión del negocio. Cuando el prospecto introduce sus datos básicos, la cita queda reservada automáticamente, confirmando la reunión tanto por mensajería instantánea como por correo electrónico con acuse de recibo y recordatorio previo para evitar inasistencias imprevistas." },
    { type: "p", text: "Esta inmediatez genera una percepción de solvencia técnica excepcional ante el mercado. El cliente se retira a descansar sabiendo que su problema está debidamente encaminado, mientras que el equipo comercial encuentra su agenda organizada con reuniones ya cualificadas al comenzar la jornada, eliminando la prospección en frío y optimizando el tiempo útil de venta de manera sistemática y predecible." },
    { type: "h2", text: "Diseño de salvaguardas y límites operativos" },
    { type: "p", text: "Un asistente conversacional eficiente debe contar con reglas de derivación estrictas para no comprometer presupuestos complejos sin supervisión. Cuando un usuario plantea un escenario atípico o un requerimiento técnico que excede las directrices preestablecidas, el sistema registra el mensaje de forma íntegra y notifica de inmediato al responsable técnico, garantizando que ninguna respuesta errónea comprometa la credibilidad de la firma." },
    { type: "p", text: "De igual manera, la integración con bases de datos internas permite ofrecer respuestas contextualizadas sobre el estado de expedientes o pedidos en curso. Este autoservicio informativo reduce drásticamente las llamadas rutinarias al conmutador central y permite a los operarios concentrarse en tareas estratégicas de alto impacto para la rentabilidad de la compañía." },
    { type: "h2", text: "Cómo dar el paso hacia la automatización nocturna" },
    { type: "p", text: "Implementar un asistente conversacional de alta fidelidad no exige desarrollos monumentales ni meses de pruebas complejas que retrasen la operación habitual. Mediante un diagnóstico de procesos con Canedo Studio, cualquier empresa puede cartografiar las dudas más frecuentes de sus clientes e integrar un canal automatizado calibrado para convertir visitas silenciosas en oportunidades de venta recurrentes y predecibles." },
    { type: "p", text: "Al ordenar la captación nocturna con protocolos claros y respetuosos, el negocio protege su reputación, multiplica las conversiones efectivas y consolida un canal de ingresos continuo sin incrementar los costes de estructura ni desgastar a su equipo de profesionales en tareas rutinarias evitables." }
  ];

  return {
    async run(model, options) {
      if (failLlama && (model.includes("llama") || model.includes("instruct"))) {
        throw new Error("Workers AI Technical Failure: 500 Model Overloaded");
      }

      if (model.includes("llama") || model.includes("instruct")) {
        const messages = options.messages || [];
        const system = messages[0]?.content || "";

        // Brief
        if (system.includes("Director Editorial")) {
          return {
            response: JSON.stringify({
              audience: "Pymes y despachos comerciales",
              businessProblem: "Pérdida continua de oportunidades de venta por falta de seguimiento ágil",
              uniqueThesis: "La velocidad de contacto en la primera hora define la tasa de cierre comercial",
              nonObviousInsight: "Automatizar el primer paso no deshumaniza sino que ahorra tiempo al consultor para cerrar",
              tradeoff: "Invertir en flujos estructurados versus delegar respuestas improvisadas a personal junior",
              requiredExamples: ["Caso de inmobiliaria urbana", "Caso de correduría de seguros"],
              evaluation: {
                thesisSpecificity: { score: 85 },
                insightOriginality: { score: 80 },
                businessProblemSpecificity: { score: 85 },
                tradeoffQuality: { score: 80 }
              }
            })
          };
        }

        // Quality Gate Auditor
        if (system.includes("Critical Editor")) {
          if (failQG) {
            return {
              response: JSON.stringify({
                approved: false,
                score: 55,
                metrics: { originality: { score: 50 } },
                reasons: [{ metric: "originality", problem: "Baja originalidad", evidence: "Texto genérico" }]
              })
            };
          }
          return {
            response: JSON.stringify({
              approved: true,
              score: 85,
              metrics: {
                originality: { score: 85 },
                nuance: { score: 80 },
                humanness: { score: 85 },
                specificity: { score: 85 },
                nonObviousness: { score: 80 }
              },
              reasons: []
            })
          };
        }

        // Redactor o Esquema
        return {
          response: JSON.stringify({
            title: "Respuesta inmediata: la ventaja invisible del comercio actual",
            tag: "Automatización",
            excerpt: "Por qué contestar en los primeros diez minutos cambia las reglas del juego.",
            executiveSummary: "El tiempo de respuesta es el factor determinante para retener prospectos cualificados sin saturar al equipo.",
            targetService: "chatbots_ia",
            customMetaDesc: "Descubre cómo una respuesta automática cualificada duplica las conversiones en pymes.",
            faqs: [{ q: "¿Sustituye a mi equipo de ventas?", a: "No, filtra y entrega prospectos listos para conversar." }],
            content: sampleArticleContent
          })
        };
      }

      if (model.includes("flux")) {
        if (failFlux) {
          throw new Error("Flux Schnell 504 Gateway Timeout");
        }
        const b = new Uint8Array(12000);
        b[0] = 0xff; b[1] = 0xd8; b[2] = 0xff;
        return b.buffer;
      }

      return {};
    }
  };
}

test("SUITE DE VERIFICACIÓN: HORARIOS PROGRAMADOS Y RESILIENCIA DE PORTADAS EN BLOG BOT", async (t) => {

  await t.test("1. Horario 7:00 a. m. Col (12:00 UTC): Ejecuta y publica con éxito", async () => {
    const mockD1 = createMockD1();
    const mockKv = createMockKV();
    const mockAi = createStandardMockAI();
    const env = { BLOG_DB: mockD1, BLOG_POSTS: mockKv, AI: mockAi };

    const result = await publish(env, 12, "curado");
    assert.equal(result.status, "published");
    assert.ok(result.post);
    assert.equal(typeof result.post.title, "string");
  });

  await t.test("2. Horario 5:00 p. m. Col (22:00 UTC): Ejecuta y publica con éxito", async () => {
    const mockD1 = createMockD1();
    const mockKv = createMockKV();
    const mockAi = createStandardMockAI();
    const env = { BLOG_DB: mockD1, BLOG_POSTS: mockKv, AI: mockAi };

    const result = await publish(env, 22, "curado");
    assert.equal(result.status, "published");
    assert.ok(result.post);
    assert.equal(typeof result.post.title, "string");
  });

  await t.test("3. Resiliencia de Portada: Si Flux Schnell falla, aplica portada de contingencia válida (JPEG con cabeceras correctas)", async () => {
    const mockD1 = createMockD1();
    const mockKv = createMockKV();
    const mockAi = createStandardMockAI({ failFlux: true }); // Simula fallo total de Flux
    const env = { BLOG_DB: mockD1, BLOG_POSTS: mockKv, AI: mockAi };

    const result = await publish(env, 22, "curado");
    assert.equal(result.status, "published", "La publicación no debe abortar si Flux falla");
    assert.ok(result.post.cover.startsWith("/media/covers/"));

    // Verificar que la portada guardada en KV tiene cabeceras JPEG válidas
    const coverKey = "img:covers/" + result.post.slug + ".jpg";
    const coverBytes = await mockKv.get(coverKey, { type: "arrayBuffer" });
    assert.ok(coverBytes, "La portada de contingencia debe existir en KV");
    const arr = new Uint8Array(coverBytes);
    assert.equal(arr[0], 0xff, "Byte 0 debe ser 0xFF (SOI)");
    assert.equal(arr[1], 0xd8, "Byte 1 debe ser 0xD8 (SOI)");
    assert.ok(arr.byteLength >= 1000, "Debe tener un tamaño seguro");
  });

  await t.test("4. Filtro Editorial Defensivo: Si el Quality Gate rechaza los 3 temas, retorna 'skipped' sin romper", async () => {
    const mockD1 = createMockD1();
    const mockKv = createMockKV();
    const mockAi = createStandardMockAI({ failQG: true }); // Rechazo editorial
    const env = { BLOG_DB: mockD1, BLOG_POSTS: mockKv, AI: mockAi };

    const result = await publish(env, 22, "curado");
    assert.equal(result.status, "skipped");
    assert.ok(result.reason.includes("sin superar el filtro editorial"));
  });

  await t.test("5. scheduled() handler clasifica logs y captura fallos sin lanzar excepción no controlada", async () => {
    const mockD1 = createMockD1();
    const mockKv = createMockKV();
    const mockAi = createStandardMockAI({ failLlama: true }); // Fallo técnico de IA
    const env = { BLOG_DB: mockD1, BLOG_POSTS: mockKv, AI: mockAi };

    let waitUntilCalled = false;
    const ctx = {
      waitUntil(promise) {
        waitUntilCalled = true;
        return promise;
      }
    };

    // scheduled no debe lanzar error
    await worker.scheduled({ scheduledTime: Date.UTC(2026, 10, 15, 22, 0, 0) }, env, ctx);
    assert.ok(waitUntilCalled);
  });
});
