import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";
import {
  generateManualDraft,
  modifyDraftWithInstructions,
  regenerateDraft,
  publishApprovedDraft,
  discardDraft
} from "../src/modules/blog/service.js";

// Mock en memoria de D1
function createMockD1() {
  const tables = {
    blog_manual_drafts: [],
    blog_posts: [
      { id: 73, slug: "post-73", title: "Artículo 73", tag: "Estrategia", date: "2026-11-12", created_at: "2026-11-12 12:00:00" },
      { id: 72, slug: "post-72", title: "Artículo 72", tag: "Chatbots", date: "2026-11-11", created_at: "2026-11-11 22:00:00" }
    ],
    admin_audit_log: [],
    admin_pending_jobs: [],
    admin_telegram_updates: []
  };

  return {
    tables,
    prepare(query) {
      const statement = {
        bind(...args) {
          return {
            async first() {
              if (query.includes("FROM blog_posts WHERE slug = ?")) {
                const slugArg = args[0];
                const found = tables.blog_posts.find(p => p.slug === slugArg);
                if (!found) return null;
                return {
                  title: found.title,
                  excerpt: found.excerpt || "",
                  content_json: found.content_json || "[]",
                  status: found.status || "published"
                };
              }
              if (query.includes("FROM blog_posts")) {
                return { total: tables.blog_posts.length };
              }
              if (query.includes("FROM admin_pending_jobs WHERE id = ?")) {
                const job = tables.admin_pending_jobs.find(j => j.id === args[0]);
                if (!job) return null;
                return {
                  id: job.id,
                  job_type: job.job_type,
                  status: job.status,
                  user_id: job.user_id,
                  chat_id: job.chat_id,
                  message_id: job.message_id,
                  payload_json: job.payload_json,
                  attempts: job.attempts,
                  locked_until: job.locked_until
                };
              }
              if (query.includes("FROM admin_pending_jobs")) {
                const maxAgeSec = typeof args[0] === "number" ? args[0] : 3600;
                const nowMs = Date.now();
                const job = tables.admin_pending_jobs.find(j => {
                  const jobCreatedMs = new Date(j.created_at || nowMs).getTime();
                  const ageSec = (nowMs - jobCreatedMs) / 1000;
                  const isRecent = ageSec <= maxAgeSec;
                  const isLocked = j.status === "processing" && j.locked_until && new Date(j.locked_until).getTime() > nowMs;
                  const canClaim = j.status === "queued" || (j.status === "processing" && !isLocked);
                  return canClaim && j.attempts < 3 && isRecent;
                });
                if (!job) return null;
                return {
                  id: job.id,
                  job_type: job.job_type,
                  status: job.status,
                  user_id: job.user_id,
                  chat_id: job.chat_id,
                  message_id: job.message_id,
                  payload_json: job.payload_json,
                  attempts: job.attempts,
                  locked_until: job.locked_until
                };
              }
              if (query.includes("FROM blog_manual_drafts WHERE id = ?")) {
                const draft = tables.blog_manual_drafts.find(d => d.id === args[0]);
                if (!draft) return null;
                return {
                  id: draft.id,
                  topic_tema: draft.topicTema || draft.topic_tema,
                  topic_angulo: draft.topicAngulo || draft.topic_angulo,
                  title: draft.title,
                  tag: draft.tag,
                  excerpt: draft.excerpt,
                  content_json: typeof draft.content === "string" ? draft.content : JSON.stringify(draft.content || []),
                  brief_json: typeof draft.brief === "string" ? draft.brief : JSON.stringify(draft.brief || {}),
                  audit_json: typeof draft.audit === "string" ? draft.audit : JSON.stringify(draft.audit || {}),
                  word_count: draft.wordCount || draft.word_count || 0,
                  status: draft.status,
                  created_by_user_id: draft.userId || draft.created_by_user_id,
                  approved_by_user_id: draft.approvedByUserId || draft.approved_by_user_id,
                  published_slug: draft.publishedSlug || draft.published_slug,
                  published_at: draft.publishedAt || draft.published_at,
                  created_at: draft.createdAt || draft.created_at || new Date().toISOString()
                };
              }
              return null;
            },
            async all() {
              if (query.includes("FROM blog_posts")) {
                const limit = args[0] || 5;
                const offset = args[1] || 0;
                return { results: tables.blog_posts.slice(offset, offset + limit) };
              }
              return { results: [] };
            },
            async run() {
              if (query.includes("INSERT INTO admin_telegram_updates")) {
                const updId = args[0];
                if (tables.admin_telegram_updates.includes(updId)) {
                  const err = new Error("UNIQUE constraint failed: admin_telegram_updates.update_id");
                  throw err;
                }
                tables.admin_telegram_updates.push(updId);
                return { meta: { changes: 1 } };
              }
              if (query.includes("INSERT INTO admin_pending_jobs")) {
                tables.admin_pending_jobs.push({
                  id: args[0],
                  job_type: args[1],
                  status: "queued",
                  user_id: args[2],
                  chat_id: args[3],
                  message_id: args[4],
                  payload_json: args[5],
                  attempts: 0,
                  locked_until: null
                });
                return { meta: { changes: 1 } };
              }
              if (query.includes("admin_pending_jobs") && query.includes("status = 'completed'")) {
                const resJson = args[0];
                const jobId = args[1];
                const expectedAttempts = args[2];
                const job = tables.admin_pending_jobs.find(j => j.id === jobId);
                if (job) {
                  job.status = "completed";
                  job.result_json = resJson;
                  job.locked_until = null;
                  return { meta: { changes: 1 } };
                }
                return { meta: { changes: 0 } };
              }
              if (query.includes("admin_pending_jobs") && query.includes("status = CASE")) {
                const errMsg = args[0];
                const jobId = args[1];
                const expectedAttempts = args[2];
                const job = tables.admin_pending_jobs.find(j => j.id === jobId);
                if (job) {
                  job.status = job.attempts >= 3 ? "failed" : "queued";
                  job.error_message = errMsg;
                  job.locked_until = null;
                  return { meta: { changes: 1 } };
                }
                return { meta: { changes: 0 } };
              }
              if (query.includes("admin_pending_jobs") && query.includes("SET status = 'processing'")) {
                const lockUntil = args[0];
                const jobId = args[1];
                const nowIso = args[2];
                const job = tables.admin_pending_jobs.find(j => j.id === jobId);
                if (job) {
                  job.status = "processing";
                  job.attempts = (job.attempts || 0) + 1;
                  job.locked_until = lockUntil;
                  return { meta: { changes: 1 } };
                }
                return { meta: { changes: 0 } };
              }
              if (query.includes("admin_pending_jobs") && query.includes("locked_until = ?")) {
                // renewJobLock
                const lockUntil = args[0];
                const jobId = args[1];
                const expectedAttempts = args[2];
                const job = tables.admin_pending_jobs.find(j => j.id === jobId);
                if (job && (expectedAttempts === undefined || job.attempts === expectedAttempts)) {
                  job.locked_until = lockUntil;
                  return { meta: { changes: 1 } };
                }
                return { meta: { changes: 0 } };
              }
              if (query.includes("INSERT INTO blog_manual_drafts")) {
                tables.blog_manual_drafts.push({
                  id: args[0],
                  topicTema: args[1],
                  topicAngulo: args[2],
                  title: args[3],
                  tag: args[4],
                  excerpt: args[5],
                  content: JSON.parse(args[6]),
                  brief: JSON.parse(args[7]),
                  audit: JSON.parse(args[8]),
                  wordCount: args[9],
                  status: args[10],
                  userId: args[11]
                });
                return { meta: { changes: 1 } };
              }
              if (query.includes("SET status = 'approved'")) {
                const draft = tables.blog_manual_drafts.find(d => d.id === args[1] && d.status === "draft");
                if (draft) {
                  draft.status = "approved";
                  draft.approvedByUserId = args[0];
                  return { meta: { changes: 1 } };
                }
                return { meta: { changes: 0 } };
              }
              if (query.includes("SET status = 'published'")) {
                const draft = tables.blog_manual_drafts.find(d => d.id === args[2]);
                if (draft) {
                  draft.status = "published";
                  draft.publishedSlug = args[0];
                  draft.publishedAt = args[1];
                  tables.blog_posts.unshift({
                    id: tables.blog_posts.length + 1,
                    slug: args[0],
                    title: draft.title,
                    tag: draft.tag,
                    date: args[1].slice(0, 10),
                    created_at: args[1]
                  });
                  return { meta: { changes: 1 } };
                }
                return { meta: { changes: 0 } };
              }
              if (query.includes("SET status = 'discarded'")) {
                const draft = tables.blog_manual_drafts.find(d => d.id === args[1] && (d.status === "draft" || d.status === "approved"));
                if (draft) {
                  draft.status = "discarded";
                  draft.approvedByUserId = args[0];
                  return { meta: { changes: 1 } };
                }
                return { meta: { changes: 0 } };
              }
              if (query.includes("UPDATE blog_manual_drafts SET")) {
                const draftId = args[args.length - 1];
                const draft = tables.blog_manual_drafts.find(d => d.id === draftId);
                if (draft) {
                  const fieldsPart = query.match(/SET (.*) WHERE/)?.[1] || "";
                  const assignments = fieldsPart.split(",").map(f => f.trim()).filter(f => f.includes("="));
                  let argIdx = 0;
                  assignments.forEach((assign) => {
                    const [col] = assign.split("=").map(s => s.trim());
                    if (assign.includes("?")) {
                      const val = args[argIdx++];
                      if (col === "title") draft.title = val;
                      if (col === "excerpt") draft.excerpt = val;
                      if (col === "tag") draft.tag = val;
                      if (col === "content_json") draft.content = JSON.parse(val);
                      if (col === "brief_json") draft.brief = JSON.parse(val);
                      if (col === "audit_json") draft.audit = JSON.parse(val);
                      if (col === "word_count") draft.word_count = val;
                      if (col === "status") draft.status = val;
                    }
                  });
                  return { meta: { changes: 1 } };
                }
                return { meta: { changes: 0 } };
              }
              if (query.includes("INSERT INTO admin_audit_log")) {
                tables.admin_audit_log.push({
                  userId: args[0],
                  username: args[1],
                  action: args[2],
                  entityId: args[3],
                  details: args[4],
                  ip: args[5]
                });
                return { meta: { changes: 1 } };
              }
              return { meta: { changes: 0 } };
            }
          };
        },
        async first() {
          if (query.includes("FROM blog_posts")) {
            return { total: tables.blog_posts.length };
          }
          if (query.includes("FROM admin_pending_jobs")) {
            const job = tables.admin_pending_jobs.find(j => j.status === "queued" || j.status === "processing");
            if (!job) return null;
            return {
              id: job.id,
              job_type: job.job_type,
              status: job.status,
              user_id: job.user_id,
              chat_id: job.chat_id,
              message_id: job.message_id,
              payload_json: job.payload_json,
              attempts: job.attempts,
              locked_until: job.locked_until
            };
          }
          return null;
        }
      };
      return statement;
    }
  };
}

// Mock de KV
function createMockKV() {
  const store = new Map();
  return {
    store,
    async get(key) {
      return store.get(key) || null;
    },
    async put(key, val) {
      store.set(key, typeof val === "string" ? val : JSON.stringify(val));
    },
    async delete(key) {
      store.delete(key);
    }
  };
}

// Helper para generar texto largo con N palabras
function generateLongText(wordCount) {
  const words = [];
  for (let i = 1; i <= wordCount; i++) words.push(`palabra${i}`);
  return words.join(" ");
}

test("FASE 7B: SUITE COMPLETA DE CANEDO ADMIN UNIFICADO", async (t) => {

  await t.test("1. Seguridad: Rechazo de webhook sin token secreto válido (HTTP 401)", async () => {
    const env = {
      WEBHOOK_SECRET_TOKEN: "secreto-super-seguro",
      ALLOWED_ADMIN_IDS: "123456"
    };

    const req = new Request("https://admin.canedostudio.com/telegram-webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Telegram-Bot-Api-Secret-Token": "secreto-incorrecto" },
      body: JSON.stringify({ update_id: 1 })
    });

    const res = await worker.fetch(req, env);
    assert.equal(res.status, 401, "Debe rechazar con 401 token secreto inválido");
  });

  await t.test("2. Seguridad: Rechazo de usuarios no autorizados (fuera de lista blanca)", async () => {
    const env = {
      WEBHOOK_SECRET_TOKEN: "secreto-valido",
      ALLOWED_ADMIN_IDS: "999999", // Admin permitido
      ADMIN_KV: createMockKV()
    };

    const req = new Request("https://admin.canedostudio.com/telegram-webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Telegram-Bot-Api-Secret-Token": "secreto-valido" },
      body: JSON.stringify({
        update_id: 101,
        message: {
          from: { id: 111111, username: "intruso" }, // No autorizado
          chat: { id: 111111 },
          text: "/menu"
        }
      })
    });

    const res = await worker.fetch(req, env);
    const data = await res.json();
    assert.equal(data.ok, false);
    assert.equal(data.error, "Unauthorized user");
  });

  await t.test("3. Idempotencia: Los reintentos del mismo update_id se ignoran limpiamente", async () => {
    const mockKv = createMockKV();
    const env = {
      ALLOWED_ADMIN_IDS: "123456",
      ADMIN_KV: mockKv
    };

    const update = {
      update_id: 55555,
      message: {
        from: { id: 123456, username: "admin" },
        chat: { id: 123456 },
        text: "/menu"
      }
    };

    // Primera ejecución
    const res1 = await worker.handleTelegramUpdate(update, env);
    assert.equal(res1.ok, true);

    // Segunda ejecución (reintento con mismo update_id)
    const res2 = await worker.handleTelegramUpdate(update, env);
    assert.equal(res2.ok, true);
    assert.equal(res2.skipped, "duplicate_update", "Debe omitir la ejecución duplicada");
  });

  await t.test("4. Navegación: Menú principal de 8 módulos y navegación a Blog", async () => {
    const env = {
      ALLOWED_ADMIN_IDS: "123456",
      ADMIN_KV: createMockKV()
    };

    // 1. Comando /menu
    const resMenu = await worker.handleTelegramUpdate({
      update_id: 1,
      message: { from: { id: 123456 }, chat: { id: 123456 }, text: "/menu" }
    }, env);
    assert.equal(resMenu.route, "main_menu");

    // 2. Callback a Módulo Blog
    const resBlog = await worker.handleTelegramUpdate({
      update_id: 2,
      callback_query: {
        id: "cq_1",
        from: { id: 123456 },
        message: { message_id: 10, chat: { id: 123456 } },
        data: "menu:blog"
      }
    }, env);
    assert.equal(resBlog.route, "blog_menu");

    // 3. Callback a Módulo en construcción (ej: CRM)
    const resCrm = await worker.handleTelegramUpdate({
      update_id: 3,
      callback_query: {
        id: "cq_2",
        from: { id: 123456 },
        message: { message_id: 10, chat: { id: 123456 } },
        data: "menu:crm"
      }
    }, env);
    assert.equal(resCrm.route, "module_stub");
    assert.equal(resCrm.module, "CRM");
  });

  await t.test("5. Consulta D1: Listado paginado de artículos en el módulo de Blog", async () => {
    const mockDb = createMockD1();
    const env = {
      ALLOWED_ADMIN_IDS: "123456",
      BLOG_DB: mockDb,
      ADMIN_KV: createMockKV()
    };

    const res = await worker.handleTelegramUpdate({
      update_id: 4,
      callback_query: {
        id: "cq_3",
        from: { id: 123456 },
        message: { message_id: 10, chat: { id: 123456 } },
        data: "blog:list:0"
      }
    }, env);

    assert.equal(res.ok, true);
    assert.equal(res.route, "blog_list");
    assert.equal(res.offset, 0);
  });

  await t.test("6. Flujo Editorial Manual: Generación de borrador con Quality Gate Fase 6L", async () => {
    const mockDb = createMockD1();
    const mockKv = createMockKV();

    // Mock de Workers AI
    const mockAI = {
      async run(model, opts) {
        const messages = opts.messages || [];
        const sys = messages[0]?.content || "";

        if (sys.includes("Director Editorial")) {
          return {
            response: JSON.stringify({
              businessProblem: "Pérdida de clientes por falta de seguimiento comercial",
              uniqueThesis: "El seguimiento sistemático en 24 horas triplica cierres",
              nonObviousInsight: "No se trata de insistir sino de resolver dudas operativas",
              tradeoff: "Automatizar el primer paso sin perder empatía humana",
              requiredExamples: ["Clínica dental", "Taller mecánico"],
              evaluation: {
                thesisSpecificity: { score: 80 },
                insightOriginality: { score: 80 },
                businessProblemSpecificity: { score: 80 },
                tradeoffQuality: { score: 80 }
              }
            })
          };
        }

        if (sys.includes("Critical Editor")) {
          return {
            response: JSON.stringify({
              approved: true,
              metrics: {
                depth: { score: 85 },
                originality: { score: 85 },
                nonObviousness: { score: 80 },
                nuance: { score: 80 },
                humanness: { score: 85 },
                specificity: { score: 85 }
              },
              reasons: []
            })
          };
        }

        // Redactor (genera 663 palabras en 11 párrafos diferenciados para cumplir 650-900 sin duplicación)
        return {
          response: JSON.stringify({
            title: "El seguimiento comercial que no parece insistente",
            tag: "Estrategia",
            excerpt: "Cómo acompañar al cliente tras la cotización sin incomodar.",
            content: [
              { type: "p", text: "En cualquier modelo de servicios profesionales la gestión de los presupuestos enviados representa una fase de máxima incertidumbre operativa para pequeñas y medianas empresas. Cuando un cliente solicita información detallada sobre un proyecto y desaparece temporalmente, los directores comerciales dudan entre reiterar la llamada de inmediato o guardar un prudente silencio. Esta falta de criterio homogéneo deteriora la tasa de cierre y transmite una imagen desordenada que perjudica la rentabilidad del negocio a final de mes y diluye los esfuerzos del equipo directivo." },
              { type: "h2", text: "Fricción en el contacto cotidiano y desgaste comercial" },
              { type: "p", text: "Consideremos el caso habitual de una clínica dental independiente o un taller mecánico especializado en chapa y pintura. En ambos entornos los responsables técnicos ofrecen diagnósticos rigurosos y elaboran presupuestos transparentes, pero descuidan la formalización del siguiente paso con el usuario. Cuando la recepcionista se ve obligada a contactar días después sin un motivo claro, la llamada suele percibirse como un intento forzado de venta que incomoda al interlocutor y reduce las probabilidades de contratación efectiva." },
              { type: "p", text: "Una problemática equivalente se presenta en asesorías contables, despachos de reformas o agencias de diseño web corporativo. La demora en la respuesta raras veces obedece a desinterés real por parte del prospecto; en la mayoría de los casos el cliente se encuentra resolviendo urgencias internas y agradece que el proveedor le facilite resúmenes ejecutivos, comparativas claras o alternativas de financiación para agilizar su toma de decisiones sin sentirse acosado ni presionado por el equipo comercial." },
              { type: "h2", text: "Solución mediante protocolos estructurados y respetuosos" },
              { type: "p", text: "La implementación de flujos de seguimiento automatizados resuelve este desajuste al aportar neutralidad y consistencia en cada punto de contacto. Un sistema bien calibrado envía recordatorios discretos con información útil, evitando frases de presión artificial y enfocándose en resolver dudas operativas sobre plazos de entrega, métodos de pago o garantías del servicio prestado a lo largo del proceso." },
              { type: "p", text: "Al apoyarse en mensajes claros y espaciados responsablemente a lo largo de varios días, el cliente comprende que el aviso forma parte de la metodología habitual del despacho. Esta percepción de orden transmite solvencia técnica y elimina por completo la tensión emocional asociada a la insistencia comercial improvisada que tantos clientes rechazan en el día a día." },
              { type: "h2", text: "Trade-offs y límites operativos indispensables" },
              { type: "p", text: "El diseño de esta estrategia exige calibrar con exactitud los puntos de salida hacia la atención humana personalizada. Cuando un usuario responde con requerimientos específicos o plantea objeciones complejas sobre el presupuesto, la automatización debe ceder el turno al consultor senior para profundizar en la negociación sin trabas técnicas ni respuestas genéricas pregrabadas." },
              { type: "p", text: "Asimismo, ordenar estos puntos de contacto permite al equipo directivo medir con precisión qué propuestas tienen posibilidades reales de cierre y cuáles deben archivarse temporalmente. Esta visibilidad depura el embudo comercial y concentra los recursos en prospectos con alta intención de contratación, optimizando las horas del personal comercial y reduciendo el coste por captación." },
              { type: "h2", text: "Diseño de un calendario equilibrado de contactos" },
              { type: "p", text: "Establecer tres momentos de contacto estructurados resulta más que suficiente para reactivar cotizaciones dormidas: un acuse de recibo con resumen ejecutivo a las veinticuatro horas, una consulta sobre posibles dudas técnicas a los cuatro días y un cierre cordial a los diez días indicando la vigencia de la tarifa propuesta en el presupuesto formal." },
              { type: "p", text: "Este esquema brinda tranquilidad al comprador al tiempo que establece un marco temporal respetuoso pero definido. Al percibir que los precios y plazos cuentan con un respaldo organizativo sólido, el cliente prioriza la contratación antes de que expire la disponibilidad del proveedor y facilita la gestión de turnos." },
              { type: "h2", text: "Hacia un crecimiento comercial ordenado y sostenible" },
              { type: "p", text: "Transformar el seguimiento de cotizaciones en un proceso predecible es una de las decisiones más rentables para cualquier empresa de servicios. A través de un diagnóstico operativo con Canedo Studio, los responsables de negocio pueden cartografiar sus puntos de fuga y activar flujos automatizados que cuidan la relación con el cliente e incrementan los ingresos recurrentes de forma continua y escalable." },
              { type: "p", text: "Al profesionalizar la comunicación posventa y el seguimiento de propuestas, la firma consolida un canal de ventas predecible, dignifica el tiempo de su equipo y asegura que cada oportunidad comercial reciba la atención debida sin agobios ni descuidos administrativos evitables en la rutina diaria." }
            ]
          })
        };
      }
    };

    const env = {
      ALLOWED_ADMIN_IDS: "123456",
      ADMIN_PUBLISH_ENABLED: "true",
      BLOG_DB: mockDb,
      ADMIN_KV: mockKv,
      AI: mockAI
    };

    const draft = await generateManualDraft(env, {
      tema: "El seguimiento comercial que no parece insistente",
      angulo: "el seguimiento aporta valor, no presión",
      userId: "123456"
    });

    assert.ok(draft.id.startsWith("draft_"));
    assert.equal(draft.status, "draft");
    assert.equal(draft.wordCount, 663, "El borrador debe tener 663 palabras en cuerpo editorial");
    assert.ok(draft.wordCount >= 650 && draft.wordCount <= 900);
    assert.equal(mockDb.tables.blog_manual_drafts.length, 1);
  });

  await t.test("7. Human-in-the-Loop: Aprobación y publicación formal en D1 y KV", async () => {
    const mockDb = createMockD1();
    const mockKv = createMockKV();

    // Crear un borrador preexistente
    const draftId = "draft_test_123";
    mockDb.tables.blog_manual_drafts.push({
      id: draftId,
      topicTema: "Tema aprobado",
      topicAngulo: "Ángulo aprobado",
      title: "Artículo aprobado manualmente por Telegram",
      tag: "Estrategia",
      excerpt: "Resumen del artículo aprobado.",
      content: [{ type: "p", text: generateLongText(700) }],
      brief: { uniqueThesis: "Tesis aprobada" },
      audit: { approved: true },
      wordCount: 700,
      status: "draft",
      userId: "123456"
    });

    const env = {
      ALLOWED_ADMIN_IDS: "123456",
      ADMIN_PUBLISH_ENABLED: "true",
      BLOG_DB: mockDb,
      ADMIN_KV: mockKv,
      AI: {
        async run() {
          const b = new Uint8Array(12000);
          b[0] = 0xff; b[1] = 0xd8;
          return b.buffer;
        }
      }
    };

    // Publicar borrador aprobado
    const res = await publishApprovedDraft(env, draftId, "123456");
    assert.ok(res.slug);
    assert.equal(res.post.title, "Artículo aprobado manualmente por Telegram");

    // Comprobar actualización en D1
    const updatedDraft = mockDb.tables.blog_manual_drafts.find(d => d.id === draftId);
    assert.equal(updatedDraft.status, "published");
    assert.equal(updatedDraft.publishedSlug, res.slug);

    // Comprobar que sumó a la tabla de artículos blog_posts
    assert.equal(mockDb.tables.blog_posts[0].slug, res.slug);
  });

  await t.test("8. Control de concurrencia y prevención de doble aprobación", async () => {
    const mockDb = createMockD1();
    const env = {
      ADMIN_PUBLISH_ENABLED: "true",
      BLOG_DB: mockDb
    };

    const draftId = "draft_ya_publicado";
    mockDb.tables.blog_manual_drafts.push({
      id: draftId,
      status: "published" // Ya publicado
    });

    await assert.rejects(
      async () => await publishApprovedDraft(env, draftId, "123456"),
      /ya fue publicado previamente/,
      "Debe rechazar intentos de republicar un borrador ya procesado"
    );
  });

  await t.test("9. Descarte de borrador por el administrador", async () => {
    const mockDb = createMockD1();
    const env = {
      ADMIN_PUBLISH_ENABLED: "true",
      BLOG_DB: mockDb
    };

    const draftId = "draft_a_descartar";
    mockDb.tables.blog_manual_drafts.push({
      id: draftId,
      status: "draft"
    });

    const discarded = await discardDraft(env, draftId, "123456");
    assert.equal(discarded, true);
    const draft = mockDb.tables.blog_manual_drafts.find(d => d.id === draftId);
    assert.equal(draft.status, "discarded");
  });

  await t.test("10. Confiabilidad: Respuesta rápida inmediata del webhook con encolamiento asíncrono", async () => {
    const mockDb = createMockD1();
    const mockKv = createMockKV();
    const env = {
      ALLOWED_ADMIN_IDS: "123456",
      ADMIN_PUBLISH_ENABLED: "true",
      BLOG_DB: mockDb,
      ADMIN_KV: mockKv,
      BOT_TOKEN_SECRETO: "fake_token",
      AI: {
        async run() {
          return { response: "{}" };
        }
      }
    };

    // Poner al usuario en estado de ingresar tema
    await mockKv.put("user_state:123456", JSON.stringify({ action: "awaiting_blog_topic" }));

    let waitUntilPromise = null;
    const ctx = {
      waitUntil(p) { waitUntilPromise = p; }
    };

    const startTime = Date.now();
    const res = await worker.handleTelegramUpdate({
      update_id: 101,
      message: {
        from: { id: 123456, username: "admin" },
        chat: { id: 123456 },
        text: "La velocidad de respuesta es el nuevo comercial de guardia"
      }
    }, env, ctx);

    const elapsed = Date.now() - startTime;
    assert.ok(elapsed < 200, `El webhook debe responder de inmediato (<200ms), tardó ${elapsed}ms`);
    assert.equal(res.ok, true);
    assert.equal(res.route, "draft_job_queued");
    assert.ok(res.jobId.startsWith("job_"));

    // Verificar que el job se persistió en D1 (inicialmente 'queued' y reclamado a 'processing' de forma atómica e inmediata)
    assert.equal(mockDb.tables.admin_pending_jobs.length, 1);
    assert.equal(mockDb.tables.admin_pending_jobs[0].id, res.jobId);
    assert.ok(mockDb.tables.admin_pending_jobs[0].status === "queued" || mockDb.tables.admin_pending_jobs[0].status === "processing");

    // Esperar la finalización de la promesa en segundo plano si existe para evitar carreras
    if (waitUntilPromise) {
      await waitUntilPromise.catch(() => {});
    }
  });

  await t.test("11. Confiabilidad: Deduplicación atómica en D1 contra ráfagas de update_id", async () => {
    const mockDb = createMockD1();
    const env = {
      ALLOWED_ADMIN_IDS: "123456",
      BLOG_DB: mockDb,
      ADMIN_KV: createMockKV()
    };

    // Primer intento
    const res1 = await worker.handleTelegramUpdate({
      update_id: 888,
      message: {
        from: { id: 123456 },
        chat: { id: 123456 },
        text: "/menu"
      }
    }, env);
    assert.equal(res1.ok, true);
    assert.equal(res1.route, "main_menu");

    // Reintento idéntico de Telegram (simulación de duplicado)
    const res2 = await worker.handleTelegramUpdate({
      update_id: 888,
      message: {
        from: { id: 123456 },
        chat: { id: 123456 },
        text: "/menu"
      }
    }, env);
    assert.equal(res2.ok, true);
    assert.equal(res2.skipped, "duplicate_update");
    assert.equal(res2.engine, "d1");
  });

  await t.test("12. Confiabilidad: Recuperación de trabajos asíncronos interrumpidos (/api/jobs/recover)", async () => {
    const mockDb = createMockD1();
    const mockKv = createMockKV();
    const env = {
      ALLOWED_ADMIN_IDS: "123456",
      WEBHOOK_SECRET_TOKEN: "secret123",
      RECOVER_JOBS_SECRET: "recover_secret_xyz",
      BOT_TOKEN_SECRETO: "fake_token",
      BLOG_DB: mockDb,
      ADMIN_KV: mockKv,
      AI: {
        async run(model, opts) {
          const sysMsg = opts?.messages?.find(m => m.role === "system")?.content || "";
          if (sysMsg.includes("Director Editorial") || sysMsg.includes("businessProblem")) {
            return {
              response: JSON.stringify({
                audience: "Directores de clínicas",
                businessProblem: "Cancelaciones de pacientes a última hora que dejan sillones vacíos en la consulta",
                canedoRelevance: "Diseño de flujos automatizados de mensajería para confirmación de citas",
                primaryService: "automatizacion_resenas",
                ctaIntent: "Agendar diagnóstico",
                funnelStage: "Consideración",
                uniqueThesis: "La lista de espera reactiva por WhatsApp recupera horas clínicas sin saturar la recepción",
                nonObviousInsight: "Los pacientes cancelan por vergüenza, no por falta de necesidad asistencial",
                tradeoff: "Mayor ocupación clínica inmediata frente a flexibilidad horaria del doctor",
                whenNotApplicable: "Urgencias hospitalarias de alta complejidad",
                recommendedStructure: "Problema, Solución y Casos",
                readerShouldLearn: ["Impacto", "Automatización"],
                requiredExamples: ["Clínica dental", "Centro médico"],
                answerableQuestions: ["¿Cómo se llena el hueco?", "¿Cuánto tarda?"],
                evaluation: {
                  thesisSpecificity: { score: 90, reason: "Tesis muy concreta" },
                  insightOriginality: { score: 88, reason: "Idea no obvia" },
                  businessProblemSpecificity: { score: 92, reason: "Problema bien acotado" },
                  tradeoffQuality: { score: 85, reason: "Tradeoff real" },
                  practicalPotential: { score: 89, reason: "Altamente accionable" },
                  canedoRelevance: { score: 87, reason: "Alineado con el servicio" }
                }
              })
            };
          }
          if (sysMsg.includes("Critical Editor") || sysMsg.includes("Audit")) {
            return {
              response: JSON.stringify({
                approved: true,
                score: 88,
                rubric: { depth: 9, actionable: 9, examples: 9 },
                reasons: []
              })
            };
          }
          if (model.includes("llama")) {
            return {
              response: JSON.stringify({
                title: "Optimización de agenda para clínicas dentales",
                tag: "Automatización",
                excerpt: "Estrategias de comunicación y confirmación inmediata para reducir huecos asistenciales en centros odontológicos modernos.",
                executiveSummary: "Estrategias de comunicación y confirmación inmediata para reducir huecos asistenciales en centros odontológicos modernos.",
                content: [
                  { type: "p", text: "En cualquier clínica dental la cancelación imprevista de citas médicas genera desajustes graves en la facturación mensual y distorsiona la operativa del centro. Cuando un paciente avisa con escasa antelación, los profesionales sanitarios pierden horas de sillón y los auxiliares colapsan llamando a pacientes de listas de espera tradicionales. Este proceso manual consume tiempo, genera desgaste en el equipo asistencial y transmite una sensación de urgencia desordenada a los usuarios." },
                  { type: "h2", text: "El impacto de cancelaciones en la rentabilidad médica" },
                  { type: "p", text: "Consideremos el caso habitual de una clínica odontológica familiar con tres gabinetes activos en una capital de provincia. Cuando dos pacientes cancelan sus intervenciones de implantes en la misma mañana, el coste fijo de instrumental esterilizado y personal permanece inalterado, reduciendo drásticamente el margen operativo de esa jornada sin posibilidad real de recuperación inmediata si no existe un sistema estructurado de sustitución." },
                  { type: "p", text: "Una problemática similar se reproduce en consultas de fisioterapia o centros de estética avanzada con agendas saturadas. La demora en avisar impide que otros usuarios aprovechen el turno libre. La recepción se ve obligada a realizar decenas de llamadas telefónicas sin éxito mientras atiende a los pacientes presenciales en el mostrador, provocando errores en las fichas, esperas innecesarias en la sala y retrasos acumulados en las consultas." },
                  { type: "h2", text: "Automatización de avisos y listas de espera dinámicas" },
                  { type: "p", text: "La activación de un protocolo dinámico de citas por mensajería instantánea resuelve este cuello de botella con absoluta discreción y agilidad técnica. Al registrarse una baja en el cuadrante, el sistema notifica de forma escalonada a pacientes en lista de espera para ese especialista, permitiéndoles confirmar el turno disponible con un solo clic sin necesidad de intercambiar múltiples llamadas ni esperar confirmaciones manuales complejas." },
                  { type: "p", text: "Al apoyarse en respuestas automáticas verificadas y canalizadas directamente hacia la agenda central, el hueco en la agenda se cubre en cuestión de minutos. El paciente agradece el adelanto inesperado de su cita y el equipo médico mantiene su ritmo asistencial sin tiempos muertos en el gabinete, mejorando sensiblemente el clima laboral de la consulta y optimizando el rendimiento de cada jornada laboral." },
                  { type: "h2", text: "Casos prácticos en clínicas y centros de salud" },
                  { type: "p", text: "Los centros sanitarios que aplican esta sistemática logran reasignar hasta un ochenta por ciento de las cancelaciones imprevistas sin sobrecargar a su personal de recepción. Esta mejora no solo protege la cuenta de resultados y amortiza la inversión en equipamiento tecnológico, sino que reduce los tiempos de espera globales para tratamientos complejos y eleva la satisfacción general de los usuarios que demandaban atención temprana." },
                  { type: "p", text: "Asimismo, ordenar las listas de espera permite a los directores médicos dimensionar con objetividad las necesidades de contratación de facultativos auxiliares o higienistas según la demanda real del servicio a lo largo de las distintas semanas del año en curso, evitando picos de sobrecarga asistencial y garantizando una atención personalizada de máxima calidad." },
                  { type: "h2", text: "Trazabilidad digital y optimización asistencial" },
                  { type: "p", text: "Por otra parte, la trazabilidad digital de estas respuestas genera información de enorme utilidad para la toma de decisiones clínicas y operativas en la empresa. La dirección puede identificar qué tratamientos registran mayor índice de absentismo y ajustar los recordatorios previos con márgenes horarios específicos según la complejidad asistencial y el perfil de los pacientes citados." },
                  { type: "h2", text: "Conclusión y próximos pasos para la dirección médica" },
                  { type: "p", text: "Profesionalizar la gestión de agendas no requiere software hospitalario complejo ni inversiones desproporcionadas en infraestructura informática. Mediante un diagnóstico específico con Canedo Studio, los responsables de clínicas pueden implementar flujos de recuperación de turnos que devuelven la tranquilidad a la recepción e incrementan la rentabilidad del negocio desde el primer mes de implantación operativa." },
                  { type: "p", text: "Al sustituir las llamadas precipitadas por notificaciones estructuradas y respetuosas, el centro consolida una reputación de eficiencia y puntualidad en su entorno geográfico, facilitando que los profesionales sanitarios se concentren exclusivamente en ofrecer la mejor atención clínica a sus pacientes en cada tratamiento médico realizado." },
                  { type: "p", text: "En conclusión, dotar a la clínica de procesos automatizados de reemplazo permite convertir una fuga imprevista de ingresos en una oportunidad de fidelización activa del paciente. Al comprobar que la clínica gestiona su tiempo con seriedad y le brinda soluciones inmediatas cuando se abre una plaza, el usuario valora el estándar de servicio y recomienda el centro con convicción entre su entorno cercano." }
                ]
              })
            };
          }
          const b = new Uint8Array(12000);
          b[0] = 0xff; b[1] = 0xd8;
          return b.buffer;
        }
      }
    };

    // Insertar un trabajo interrumpido/pendiente en D1
    mockDb.tables.admin_pending_jobs.push({
      id: "job_interrupted_1",
      job_type: "blog_generate_draft",
      status: "queued",
      user_id: "123456",
      chat_id: "123456",
      message_id: 99,
      payload_json: JSON.stringify({ tema: "Optimización de agenda para clínicas dentales", ip: "127.0.0.1", username: "admin" }),
      attempts: 0,
      locked_until: null
    });

    const recoverReq = new Request("https://admin.canedo.studio/api/jobs/recover", {
      method: "POST",
      headers: {
        "X-Recover-Jobs-Secret": "recover_secret_xyz"
      }
    });

    const res = await worker.fetch(recoverReq, env);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, "ok");
    assert.equal(body.recovered.processed, 1);

    // Comprobar que el trabajo pasó a 'completed' y se generó el borrador en D1
    const job = mockDb.tables.admin_pending_jobs.find(j => j.id === "job_interrupted_1");
    assert.equal(job.status, "completed");
    assert.equal(mockDb.tables.blog_manual_drafts.length, 1);
    assert.equal(mockDb.tables.blog_manual_drafts[0].status, "draft");
  });

  await t.test("13. Confiabilidad: Slug e identificadores estables protegen contra reintentos de publicación", async () => {
    const mockDb = createMockD1();
    const mockKv = createMockKV();
    const env = {
      ALLOWED_ADMIN_IDS: "123456",
      ADMIN_PUBLISH_ENABLED: "true",
      BLOG_DB: mockDb,
      ADMIN_KV: mockKv,
      AI: {
        async run() {
          const b = new Uint8Array(12000);
          b[0] = 0xff; b[1] = 0xd8;
          return b.buffer;
        }
      }
    };

    const draftId = "draft_estable_1";
    mockDb.tables.blog_manual_drafts.push({
      id: draftId,
      topicTema: "Tema estable",
      topicAngulo: "Ángulo",
      title: "Publicación Estable Anti Reintentos",
      tag: "Estrategia",
      excerpt: "Resumen estable.",
      content: [{ type: "p", text: generateLongText(700) }],
      brief: { uniqueThesis: "Tesis" },
      audit: { approved: true },
      wordCount: 700,
      status: "draft",
      userId: "123456"
    });

    // Publicación inicial
    const res1 = await publishApprovedDraft(env, draftId, "123456");
    assert.ok(res1.slug);

    // Si se reintenta el proceso sobre el borrador ya publicado
    await assert.rejects(
      async () => await publishApprovedDraft(env, draftId, "123456"),
      /ya fue publicado previamente/
    );

    // Verificar que solo existe exactamente 1 registro en blog_posts con ese slug
    const matching = mockDb.tables.blog_posts.filter(p => p.slug === res1.slug);
    assert.equal(matching.length, 1, "No debe duplicar entradas en blog_posts durante reintentos");
  });

  await t.test("14. Confiabilidad: Recuperación ante fallo de Flux AI usa portada fallback limpia", async () => {
    const mockDb = createMockD1();
    const mockKv = createMockKV();
    const env = {
      ADMIN_PUBLISH_ENABLED: "true",
      BLOG_DB: mockDb,
      ADMIN_KV: mockKv,
      AI: {
        async run() {
          throw new Error("Flux Schnell 504 Gateway Timeout simulation");
        }
      }
    };

    const draftId = "draft_fallback_flux";
    mockDb.tables.blog_manual_drafts.push({
      id: draftId,
      topicTema: "Tema fallback",
      topicAngulo: "Ángulo",
      title: "Artículo con Fallo de Flux AI Recuperado",
      tag: "Chatbots",
      excerpt: "Resumen.",
      content: [{ type: "p", text: generateLongText(700) }],
      brief: { uniqueThesis: "Tesis" },
      audit: { approved: true },
      wordCount: 700,
      status: "draft",
      userId: "123456"
    });

    // Debe completar la publicación empleando la portada fallback sin arrojar excepción
    const res = await publishApprovedDraft(env, draftId, "123456");
    assert.ok(res.slug);
    assert.ok(mockKv.store.has("img:covers/" + res.slug + ".jpg"));
  });

  await t.test("15. Seguridad Negativa: Bloqueo obligatorio cuando ADMIN_PUBLISH_ENABLED=false", async () => {
    const mockDb = createMockD1();
    const mockKv = createMockKV();
    const env = {
      ADMIN_PUBLISH_ENABLED: "false", // Publicación deshabilitada
      BLOG_DB: mockDb,
      ADMIN_KV: mockKv
    };

    const draftId = "draft_bloqueado";
    mockDb.tables.blog_manual_drafts.push({
      id: draftId,
      title: "Artículo que debe ser bloqueado",
      status: "approved"
    });

    // 1. Intento directo por servicio
    await assert.rejects(
      async () => await publishApprovedDraft(env, draftId, "123456"),
      /ADMIN_PUBLISH_DISABLED/,
      "Debe lanzar error ADMIN_PUBLISH_DISABLED si ADMIN_PUBLISH_ENABLED no es true"
    );

    // 2. Comprobar que NO se agregaron nuevos posts en blog_posts ni en KV
    assert.equal(mockDb.tables.blog_posts.length, 2, "No debe escribir nuevos posts en blog_posts");
    assert.equal(mockKv.store.size, 0, "No debe escribir ninguna portada en KV");

    // 3. Intento vía background / recoverInterruptedJobs
    mockDb.tables.admin_pending_jobs.push({
      id: "job_publish_bloqueado",
      job_type: "blog_publish_approved",
      status: "queued",
      user_id: "123456",
      chat_id: "123456",
      payload_json: JSON.stringify({ draftId }),
      attempts: 0
    });

    const result = await worker.recoverInterruptedJobs(env);
    const failedJob = mockDb.tables.admin_pending_jobs.find(j => j.id === "job_publish_bloqueado");
    assert.equal(failedJob.status, "failed", "El trabajo en cola debe marcarse como fallido");
    assert.match(failedJob.error_message, /ADMIN_PUBLISH_DISABLED/);
    assert.equal(mockDb.tables.blog_posts.length, 2, "Sigue sin escribir en blog_posts tras ejecución en cola");
  });

  await t.test("16. Seguridad Negativa: Protección y rechazo en /api/jobs/recover sin credencial administrativa", async () => {
    const env = {
      RECOVER_JOBS_SECRET: "clave-recuperacion-secreta-999"
    };

    // Petición sin cabecera
    const req1 = new Request("https://admin.canedostudio.com/api/jobs/recover", {
      method: "POST"
    });
    const res1 = await worker.fetch(req1, env);
    assert.equal(res1.status, 401);

    // Petición con cabecera incorrecta
    const req2 = new Request("https://admin.canedostudio.com/api/jobs/recover", {
      method: "POST",
      headers: { "X-Recover-Jobs-Secret": "clave-equivocada" }
    });
    const res2 = await worker.fetch(req2, env);
    assert.equal(res2.status, 401);

    // Endpoint completamente deshabilitado si no hay secreto configurado
    const req3 = new Request("https://admin.canedostudio.com/api/jobs/recover", {
      method: "POST"
    });
    const res3 = await worker.fetch(req3, {});
    assert.equal(res3.status, 403);
  });

  await t.test("17. Fase 8A: Listado, consulta paginada y lectura completa de borradores", async () => {
    const mockDb = createMockD1();
    const mockKv = createMockKV();
    const env = {
      ALLOWED_ADMIN_IDS: "123456",
      WEBHOOK_SECRET_TOKEN: "secret123",
      BOT_TOKEN_SECRETO: "fake_token",
      BLOG_DB: mockDb,
      ADMIN_KV: mockKv
    };

    // Crear 2 borradores de prueba para el usuario 123456
    mockDb.tables.blog_manual_drafts.push({
      id: "draft_test_list_1",
      topicTema: "Tema borrador 1",
      topicAngulo: "Ángulo 1",
      title: "Borrador de prueba 1 para listado",
      tag: "Estrategia",
      excerpt: "Resumen gancho borrador 1",
      content: [
        { type: "h2", text: "Sección 1" },
        { type: "p", text: generateLongText(350) },
        { type: "h2", text: "Sección 2" },
        { type: "p", text: generateLongText(350) }
      ],
      brief: { uniqueThesis: "Tesis 1" },
      audit: { approved: true },
      wordCount: 700,
      status: "draft",
      created_by_user_id: "123456",
      created_at: "2026-11-12 18:00:00"
    });

    // 1. Probar callback de listar borradores
    const reqList = new Request("https://admin.canedo.studio/telegram-webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "secret123"
      },
      body: JSON.stringify({
        update_id: 9001,
        callback_query: {
          id: "cq_drafts_1",
          from: { id: 123456, username: "admin" },
          message: { message_id: 10, chat: { id: 123456 } },
          data: "blog:drafts:0"
        }
      })
    });
    const resList = await worker.fetch(reqList, env);
    assert.equal(resList.status, 200);
    const bodyList = await resList.json();
    assert.equal(bodyList.route, "blog_drafts");

    // 2. Probar callback de ver detalle de borrador
    const reqView = new Request("https://admin.canedo.studio/telegram-webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "secret123"
      },
      body: JSON.stringify({
        update_id: 9002,
        callback_query: {
          id: "cq_view_1",
          from: { id: 123456, username: "admin" },
          message: { message_id: 11, chat: { id: 123456 } },
          data: "draft:view:draft_test_list_1"
        }
      })
    });
    const resView = await worker.fetch(reqView, env);
    assert.equal(resView.status, 200);
    const bodyView = await resView.json();
    assert.equal(bodyView.route, "draft_view");

    // 3. Probar lectura completa dividida en trozos
    const reqFull = new Request("https://admin.canedo.studio/telegram-webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "secret123"
      },
      body: JSON.stringify({
        update_id: 9003,
        callback_query: {
          id: "cq_full_1",
          from: { id: 123456, username: "admin" },
          message: { message_id: 12, chat: { id: 123456 } },
          data: "draft:read_full:draft_test_list_1"
        }
      })
    });
    const resFull = await worker.fetch(reqFull, env);
    assert.equal(resFull.status, 200);
    const bodyFull = await resFull.json();
    assert.equal(bodyFull.route, "draft_read_full");
    assert.ok(bodyFull.chunks >= 1);
  });

  await t.test("18. Fase 8A: Modificación interactiva de borrador con instrucciones y Quality Gate", async () => {
    const mockDb = createMockD1();
    const mockKv = createMockKV();

    const paragraphs = [
      "En cualquier modelo de servicios profesionales la gestión coordinada de presupuestos y agendas clínicas representa una fase de máxima incertidumbre operativa para centros médicos y pymes especializadas en atención privada con equipos multidisciplinares de trabajo continuo.",
      "Cuando un usuario solicita información detallada sobre un tratamiento odontológico complejo y desaparece temporalmente, los directores de consulta dudan entre reiterar la llamada de inmediato o guardar un prudente silencio institucional para no incomodar.",
      "Esta falta de criterio homogéneo deteriora la tasa de ocupación de los gabinetes y transmite una imagen desordenada que perjudica la rentabilidad del negocio a final de mes y diluye los esfuerzos del equipo directivo en captación comercial.",
      "Consideremos el caso habitual de una clínica dental de ortodoncia avanzada o un taller mecánico especializado en chapa y pintura de precisión en entornos urbanos consolidados donde la competencia es elevada.",
      "En ambos entornos los responsables técnicos ofrecen diagnósticos rigurosos y elaboran presupuestos transparentes, pero descuidan la formalización del siguiente paso operativo con el usuario que espera una respuesta clara y ordenada.",
      "Cuando la recepcionista se ve obligada a contactar días después sin un motivo claro, la llamada suele percibirse como un intento forzado de venta que incomoda al interlocutor y reduce las probabilidades de contratación efectiva en la consulta.",
      "Una problemática equivalente se presenta en asesorías contables, despachos de reformas o agencias de desarrollo web corporativo con equipos de consultoría personalizada que atienden a múltiples clientes a lo largo de la semana.",
      "La demora en la respuesta raras veces obedece a desinterés real por parte del paciente o prospecto; en la mayoría de los casos se encuentra resolviendo urgencias internas y agradece que el proveedor le facilite alternativas ágiles de contacto.",
      "La implementación de flujos de seguimiento automatizados resuelve este desajuste al aportar neutralidad y consistencia en cada punto de contacto mediante mensajes directos, respetuosos y transparentes que clarifican las opciones vigentes.",
      "Al apoyarse en mensajes claros y espaciados responsablemente a lo largo de varios días, el cliente comprende que el aviso forma parte de la metodología habitual del despacho y no de una improvisación apresurada.",
      "El diseño de esta estrategia exige calibrar con exactitud los puntos de salida hacia la atención humana personalizada cuando el usuario formula preguntas clínicas complejas o peticiones especiales de financiación a medida.",
      "Asimismo ordenar estos puntos de contacto permite al equipo directivo medir con precisión qué propuestas tienen posibilidades reales de cierre y cuáles deben archivarse temporalmente para optimizar los recursos del personal comercial.",
      "Establecer tres momentos de contacto estructurados resulta más que suficiente para reactivar cotizaciones dormidas: un acuse de recibo inicial, una consulta técnica a los cuatro días y un cierre cordial indicando la vigencia del presupuesto emitido.",
      "Este esquema brinda tranquilidad al comprador al tiempo que establece un marco temporal respetuoso pero definido para que los doctores y especialistas puedan organizar sus agendas con suficiente margen de maniobra.",
      "Transformar el seguimiento de cotizaciones en un proceso predecible es una de las decisiones más rentables para cualquier empresa de servicios que busque mejorar su eficiencia operativa sin incurrir en costes desmedidos de personal.",
      "A través de un diagnóstico operativo con Canedo Studio los responsables de negocio pueden cartografiar sus puntos de fuga y activar flujos automatizados que cuidan la relación con el cliente e incrementan los ingresos recurrentes.",
      "Al profesionalizar la comunicación posventa y el seguimiento de propuestas, la firma consolida un canal de ventas predecible, dignifica el tiempo de su equipo y asegura que cada oportunidad comercial reciba atención de primer nivel.",
      "La experiencia acumulada demuestra que los pacientes agradecen enormemente la puntualidad en los avisos preventivos y la claridad en los presupuestos antes de comprometerse con un tratamiento de larga duración.",
      "Por consiguiente la integración de estas herramientas no reemplaza la empatía clínica sino que potencia la capacidad del equipo médico para centrarse exclusivamente en la excelencia terapéutica.",
      "En última instancia, la combinación armónica de plataformas tecnológicas confiables y criterio humano consolida la reputación de la clínica en el largo plazo."
    ];
    const clinicalContent = [
      { type: "p", text: paragraphs[0] + " " + paragraphs[1] },
      { type: "h2", text: "Fricción en el contacto cotidiano y desgaste comercial" },
      { type: "p", text: paragraphs[2] + " " + paragraphs[3] },
      { type: "p", text: paragraphs[4] + " " + paragraphs[5] },
      { type: "h2", text: "Solución mediante protocolos estructurados y respetuosos" },
      { type: "p", text: paragraphs[6] + " " + paragraphs[7] },
      { type: "p", text: paragraphs[8] + " " + paragraphs[9] },
      { type: "h2", text: "Trade-offs y límites operativos indispensables" },
      { type: "p", text: paragraphs[10] + " " + paragraphs[11] },
      { type: "h2", text: "Diseño de un calendario equilibrado de contactos" },
      { type: "p", text: paragraphs[12] + " " + paragraphs[13] },
      { type: "h2", text: "Hacia un crecimiento comercial ordenado y sostenible" },
      { type: "p", text: paragraphs[14] + " " + paragraphs[15] },
      { type: "p", text: paragraphs[16] + " " + paragraphs[17] },
      { type: "p", text: paragraphs[18] + " " + paragraphs[19] }
    ];

    const env = {
      ALLOWED_ADMIN_IDS: "123456",
      WEBHOOK_SECRET_TOKEN: "secret123",
      BOT_TOKEN_SECRETO: "fake_token",
      BLOG_DB: mockDb,
      ADMIN_KV: mockKv,
      AI: {
        async run(model, opts) {
          const messages = opts?.messages || [];
          const sys = messages[0]?.content || "";

          if (sys.includes("Critical Editor") || sys.includes("Auditor de Calidad")) {
            return {
              response: JSON.stringify({
                approved: true,
                score: 85,
                metrics: {
                  depth: { score: 85 },
                  originality: { score: 85 },
                  nonObviousness: { score: 80 },
                  nuance: { score: 80 },
                  humanness: { score: 85 },
                  specificity: { score: 85 }
                },
                reasons: []
              })
            };
          }

          return {
            response: JSON.stringify({
              title: "Título Modificado con Enfoque Clínico",
              tag: "Estrategia",
              excerpt: "Resumen modificado para directores de clínicas.",
              content: clinicalContent
            })
          };
        }
      }
    };

    const draftId = "draft_mod_test";
    mockDb.tables.blog_manual_drafts.push({
      id: draftId,
      topicTema: "Gestión de citas",
      topicAngulo: "Ángulo original",
      title: "Título Original",
      tag: "Estrategia",
      excerpt: "Resumen original",
      content: [{ type: "p", text: generateLongText(700) }],
      brief: {
        businessProblem: "Pérdida de pacientes en clínicas dentales por falta de confirmación de citas",
        uniqueThesis: "Tesis original sin datos no respaldados",
        requiredExamples: ["Clínica dental"],
        targetService: "desarrollo-web"
      },
      audit: { approved: true },
      wordCount: 700,
      status: "draft",
      created_by_user_id: "123456"
    });

    // 1. Solicitar modificación (pone el KV en estado awaiting_draft_modification)
    const reqPrompt = new Request("https://admin.canedo.studio/telegram-webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "secret123"
      },
      body: JSON.stringify({
        update_id: 9004,
        callback_query: {
          id: "cq_mod_prompt",
          from: { id: 123456, username: "admin" },
          message: { message_id: 15, chat: { id: 123456 } },
          data: `draft:modify_prompt:${draftId}`
        }
      })
    });
    const resPrompt = await worker.fetch(reqPrompt, env);
    assert.equal(resPrompt.status, 200);

    const state = JSON.parse(await mockKv.get("user_state:123456"));
    assert.equal(state.action, "awaiting_draft_modification");
    assert.equal(state.draftId, draftId);

    // 2. Enviar mensaje de texto con instrucciones
    const reqText = new Request("https://admin.canedo.studio/telegram-webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "secret123"
      },
      body: JSON.stringify({
        update_id: 9005,
        message: {
          message_id: 16,
          from: { id: 123456, username: "admin" },
          chat: { id: 123456, type: "private" },
          text: "Agrega ejemplos de clínicas dentales y haz el tono más formal"
        }
      })
    });
    const resText = await worker.fetch(reqText, env);
    assert.equal(resText.status, 200);
    const bodyText = await resText.json();
    assert.equal(bodyText.route, "draft_modification_dispatched");

    // Verificar que el borrador fue actualizado en D1
    const updated = mockDb.tables.blog_manual_drafts.find(d => d.id === draftId);
    assert.equal(updated.title, "Título Modificado con Enfoque Clínico");
    assert.ok(updated.word_count >= 650);
  });

  await t.test("19. Fase 8A: Regeneración completa y confirmación de descarte", async () => {
    const mockDb = createMockD1();
    const mockKv = createMockKV();

    const paragraphs = [
      "En cualquier modelo de servicios profesionales la gestión coordinada de presupuestos y agendas clínicas representa una fase de máxima incertidumbre operativa para centros médicos y pymes especializadas en atención privada con equipos multidisciplinares de trabajo continuo.",
      "Cuando un usuario solicita información detallada sobre un tratamiento odontológico complejo y desaparece temporalmente, los directores de consulta dudan entre reiterar la llamada de inmediato o guardar un prudente silencio institucional para no incomodar.",
      "Esta falta de criterio homogéneo deteriora la tasa de ocupación de los gabinetes y transmite una imagen desordenada que perjudica la rentabilidad del negocio a final de mes y diluye los esfuerzos del equipo directivo en captación comercial.",
      "Consideremos el caso habitual de una clínica dental de ortodoncia avanzada o un taller mecánico especializado en chapa y pintura de precisión en entornos urbanos consolidados donde la competencia es elevada.",
      "En ambos entornos los responsables técnicos ofrecen diagnósticos rigurosos y elaboran presupuestos transparentes, pero descuidan la formalización del siguiente paso operativo con el usuario que espera una respuesta clara y ordenada.",
      "Cuando la recepcionista se ve obligada a contactar días después sin un motivo claro, la llamada suele percibirse como un intento forzado de venta que incomoda al interlocutor y reduce las probabilidades de contratación efectiva en la consulta.",
      "Una problemática equivalente se presenta en asesorías contables, despachos de reformas o agencias de desarrollo web corporativo con equipos de consultoría personalizada que atienden a múltiples clientes a lo largo de la semana.",
      "La demora en la respuesta raras veces obedece a desinterés real por parte del paciente o prospecto; en la mayoría de los casos se encuentra resolviendo urgencias internas y agradece que el proveedor le facilite alternativas ágiles de contacto.",
      "La implementación de flujos de seguimiento automatizados resuelve este desajuste al aportar neutralidad y consistencia en cada punto de contacto mediante mensajes directos, respetuosos y transparentes que clarifican las opciones vigentes.",
      "Al apoyarse en mensajes claros y espaciados responsablemente a lo largo de varios días, el cliente comprende que el aviso forma parte de la metodología habitual del despacho y no de una improvisación apresurada.",
      "El diseño de esta estrategia exige calibrar con exactitud los puntos de salida hacia la atención humana personalizada cuando el usuario formula preguntas clínicas complejas o peticiones especiales de financiación a medida.",
      "Asimismo ordenar estos puntos de contacto permite al equipo directivo medir con precisión qué propuestas tienen posibilidades reales de cierre y cuáles deben archivarse temporalmente para optimizar los recursos del personal comercial.",
      "Establecer tres momentos de contacto estructurados resulta más que suficiente para reactivar cotizaciones dormidas: un acuse de recibo inicial, una consulta técnica a los cuatro días y un cierre cordial indicando la vigencia del presupuesto emitido.",
      "Este esquema brinda tranquilidad al comprador al tiempo que establece un marco temporal respetuoso pero definido para que los doctores y especialistas puedan organizar sus agendas con suficiente margen de maniobra.",
      "Transformar el seguimiento de cotizaciones en un proceso predecible es una de las decisiones más rentables para cualquier empresa de servicios que busque mejorar su eficiencia operativa sin incurrir en costes desmedidos de personal.",
      "A través de un diagnóstico operativo con Canedo Studio los responsables de negocio pueden cartografiar sus puntos de fuga y activar flujos automatizados que cuidan la relación con el cliente e incrementan los ingresos recurrentes.",
      "Al profesionalizar la comunicación posventa y el seguimiento de propuestas, la firma consolida un canal de ventas predecible, dignifica el tiempo de su equipo y asegura que cada oportunidad comercial reciba atención de primer nivel.",
      "La experiencia acumulada demuestra que los pacientes agradecen enormemente la puntualidad en los avisos preventivos y la claridad en los presupuestos antes de comprometerse con un tratamiento de larga duración.",
      "Por consiguiente la integración de estas herramientas no reemplaza la empatía clínica sino que potencia la capacidad del equipo médico para centrarse exclusivamente en la excelencia terapéutica.",
      "En última instancia, la combinación armónica de plataformas tecnológicas confiables y criterio humano consolida la reputación de la clínica en el largo plazo."
    ];
    const regenContent = [
      { type: "p", text: paragraphs[0] + " " + paragraphs[1] },
      { type: "h2", text: "Fricción en el contacto cotidiano y desgaste comercial" },
      { type: "p", text: paragraphs[2] + " " + paragraphs[3] },
      { type: "p", text: paragraphs[4] + " " + paragraphs[5] },
      { type: "h2", text: "Solución mediante protocolos estructurados y respetuosos" },
      { type: "p", text: paragraphs[6] + " " + paragraphs[7] },
      { type: "p", text: paragraphs[8] + " " + paragraphs[9] },
      { type: "h2", text: "Trade-offs y límites operativos indispensables" },
      { type: "p", text: paragraphs[10] + " " + paragraphs[11] },
      { type: "h2", text: "Diseño de un calendario equilibrado de contactos" },
      { type: "p", text: paragraphs[12] + " " + paragraphs[13] },
      { type: "h2", text: "Hacia un crecimiento comercial ordenado y sostenible" },
      { type: "p", text: paragraphs[14] + " " + paragraphs[15] },
      { type: "p", text: paragraphs[16] + " " + paragraphs[17] },
      { type: "p", text: paragraphs[18] + " " + paragraphs[19] }
    ];

    const env = {
      ALLOWED_ADMIN_IDS: "123456",
      WEBHOOK_SECRET_TOKEN: "secret123",
      BOT_TOKEN_SECRETO: "fake_token",
      BLOG_DB: mockDb,
      ADMIN_KV: mockKv,
      AI: {
        async run(model, opts) {
          const messages = opts?.messages || [];
          const sys = messages[0]?.content || "";

          if (sys.includes("Director Editorial")) {
            return {
              response: JSON.stringify({
                businessProblem: "Pérdida de clientes por falta de seguimiento comercial",
                uniqueThesis: "El seguimiento sistemático en 24 horas triplica cierres",
                nonObviousInsight: "No se trata de insistir sino de resolver dudas operativas",
                tradeoff: "Automatizar el primer paso sin perder empatía humana",
                requiredExamples: ["Clínica dental", "Taller mecánico"],
                evaluation: {
                  thesisSpecificity: { score: 80 },
                  insightOriginality: { score: 80 },
                  businessProblemSpecificity: { score: 80 },
                  tradeoffQuality: { score: 80 }
                }
              })
            };
          }

          if (sys.includes("Critical Editor") || sys.includes("Auditor de Calidad")) {
            return {
              response: JSON.stringify({
                approved: true,
                score: 90,
                metrics: {
                  depth: { score: 85 },
                  originality: { score: 85 },
                  nonObviousness: { score: 80 },
                  nuance: { score: 80 },
                  humanness: { score: 85 },
                  specificity: { score: 85 }
                },
                reasons: []
              })
            };
          }

          return {
            response: JSON.stringify({
              title: "Artículo Totalmente Regenerado",
              tag: "Chatbots",
              excerpt: "Resumen nuevo tras regeneración integral del contenido.",
              content: regenContent
            })
          };
        }
      }
    };

    const draftId = "draft_regen_test";
    mockDb.tables.blog_manual_drafts.push({
      id: draftId,
      topicTema: "Automatización de mensajes",
      topicAngulo: "Ángulo base",
      title: "Artículo Anterior",
      tag: "Chatbots",
      excerpt: "Resumen anterior",
      content: [{ type: "p", text: generateLongText(700) }],
      brief: {
        businessProblem: "Pérdida de clientes por falta de seguimiento comercial",
        uniqueThesis: "El seguimiento sistemático en 24 horas triplica cierres",
        requiredExamples: ["Clínica dental", "Taller mecánico"],
        targetService: "chatbots-ia"
      },
      audit: { approved: true },
      wordCount: 700,
      status: "draft",
      created_by_user_id: "123456"
    });

    // 1. Confirmar regeneración vía callback
    const reqRegen = new Request("https://admin.canedo.studio/telegram-webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "secret123"
      },
      body: JSON.stringify({
        update_id: 9006,
        callback_query: {
          id: "cq_regen_exec",
          from: { id: 123456, username: "admin" },
          message: { message_id: 20, chat: { id: 123456 } },
          data: `draft:exec_regen:${draftId}`
        }
      })
    });
    const resRegen = await worker.fetch(reqRegen, env);
    assert.equal(resRegen.status, 200);
    const bodyRegen = await resRegen.json();
    assert.equal(bodyRegen.route, "draft_regen_dispatched");

    const regenerated = mockDb.tables.blog_manual_drafts.find(d => d.id === draftId);
    assert.equal(regenerated.title, "Artículo Totalmente Regenerado");

    // 2. Descarte con confirmación
    const reqDiscard = new Request("https://admin.canedo.studio/telegram-webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "secret123"
      },
      body: JSON.stringify({
        update_id: 9007,
        callback_query: {
          id: "cq_discard_exec",
          from: { id: 123456, username: "admin" },
          message: { message_id: 21, chat: { id: 123456 } },
          data: `draft:discard:${draftId}`
        }
      })
    });
    const resDiscard = await worker.fetch(reqDiscard, env);
    assert.equal(resDiscard.status, 200);

    const discarded = mockDb.tables.blog_manual_drafts.find(d => d.id === draftId);
    assert.equal(discarded.status, "discarded");
  });

  await t.test("20. Fase 8A.1: Scheduled Recovery automático y prevención de duplicados concurrentes", async () => {
    const mockDb = createMockD1();
    const mockKv = createMockKV();

    const paragraphs = [
      "En cualquier modelo de servicios profesionales la gestión coordinada de presupuestos y agendas clínicas representa una fase de máxima incertidumbre operativa para centros médicos y pymes especializadas en atención privada con equipos multidisciplinares de trabajo continuo.",
      "Cuando un usuario solicita información detallada sobre un tratamiento odontológico complejo y desaparece temporalmente, los directores de consulta dudan entre reiterar la llamada de inmediato o guardar un prudente silencio institucional para no incomodar.",
      "Esta falta de criterio homogéneo deteriora la tasa de ocupación de los gabinetes y transmite una imagen desordenada que perjudica la rentabilidad del negocio a final de mes y diluye los esfuerzos del equipo directivo en captación comercial.",
      "Consideremos el caso habitual de una clínica dental de ortodoncia avanzada o un taller mecánico especializado en chapa y pintura de precisión en entornos urbanos consolidados donde la competencia es elevada.",
      "En ambos entornos los responsables técnicos ofrecen diagnósticos rigurosos y elaboran presupuestos transparentes, pero descuidan la formalización del siguiente paso operativo con el usuario que espera una respuesta clara y ordenada.",
      "Cuando la recepcionista se ve obligada a contactar días después sin un motivo claro, la llamada suele percibirse como un intento forzado de venta que incomoda al interlocutor y reduce las probabilidades de contratación efectiva en la consulta.",
      "Una problemática equivalente se presenta en asesorías contables, despachos de reformas o agencias de desarrollo web corporativo con equipos de consultoría personalizada que atienden a múltiples clientes a lo largo de la semana.",
      "La demora en la respuesta raras veces obedece a desinterés real por parte del paciente o prospecto; en la mayoría de los casos se encuentra resolviendo urgencias internas y agradece que el proveedor le facilite alternativas ágiles de contacto.",
      "La implementación de flujos de seguimiento automatizados resuelve este desajuste al aportar neutralidad y consistencia en cada punto de contacto mediante mensajes directos, respetuosos y transparentes que clarifican las opciones vigentes.",
      "Al apoyarse en mensajes claros y espaciados responsablemente a lo largo de varios días, el cliente comprende que el aviso forma parte de la metodología habitual del despacho y no de una improvisación apresurada.",
      "El diseño de esta estrategia exige calibrar con exactitud los puntos de salida hacia la atención humana personalizada cuando el usuario formula preguntas clínicas complejas o peticiones especiales de financiación a medida.",
      "Asimismo ordenar estos puntos de contacto permite al equipo directivo medir con precisión qué propuestas tienen posibilidades reales de cierre y cuáles deben archivarse temporalmente para optimizar los recursos del personal comercial.",
      "Establecer tres momentos de contacto estructurados resulta más que suficiente para reactivar cotizaciones dormidas: un acuse de recibo inicial, una consulta técnica a los cuatro días y un cierre cordial indicando la vigencia del presupuesto emitido.",
      "Este esquema brinda tranquilidad al comprador al tiempo que establece un marco temporal respetuoso pero definido para que los doctores y especialistas puedan organizar sus agendas con suficiente margen de maniobra.",
      "Transformar el seguimiento de cotizaciones en un proceso predecible es una de las decisiones más rentables para cualquier empresa de servicios que busque mejorar su eficiencia operativa sin incurrir en costes desmedidos de personal.",
      "A través de un diagnóstico operativo con Canedo Studio los responsables de negocio pueden cartografiar sus puntos de fuga y activar flujos automatizados que cuidan la relación con el cliente e incrementan los ingresos recurrentes.",
      "Al profesionalizar la comunicación posventa y el seguimiento de propuestas, la firma consolida un canal de ventas predecible, dignifica el tiempo de su equipo y asegura que cada oportunidad comercial reciba atención de primer nivel.",
      "La experiencia acumulada demuestra que los pacientes agradecen enormemente la puntualidad en los avisos preventivos y la claridad en los presupuestos antes de comprometerse con un tratamiento de larga duración.",
      "Por consiguiente la integración de estas herramientas no reemplaza la empatía clínica sino que potencia la capacidad del equipo médico para centrarse exclusivamente en la excelencia terapéutica.",
      "En última instancia, la combinación armónica de plataformas tecnológicas confiables y criterio humano consolida la reputación de la clínica en el largo plazo."
    ];
    const content = [
      { type: "p", text: paragraphs[0] + " " + paragraphs[1] },
      { type: "h2", text: "Fricción en el contacto cotidiano y desgaste comercial" },
      { type: "p", text: paragraphs[2] + " " + paragraphs[3] },
      { type: "p", text: paragraphs[4] + " " + paragraphs[5] },
      { type: "h2", text: "Solución mediante protocolos estructurados y respetuosos" },
      { type: "p", text: paragraphs[6] + " " + paragraphs[7] },
      { type: "p", text: paragraphs[8] + " " + paragraphs[9] },
      { type: "h2", text: "Trade-offs y límites operativos indispensables" },
      { type: "p", text: paragraphs[10] + " " + paragraphs[11] },
      { type: "h2", text: "Diseño de un calendario equilibrado de contactos" },
      { type: "p", text: paragraphs[12] + " " + paragraphs[13] },
      { type: "h2", text: "Hacia un crecimiento comercial ordenado y sostenible" },
      { type: "p", text: paragraphs[14] + " " + paragraphs[15] },
      { type: "p", text: paragraphs[16] + " " + paragraphs[17] },
      { type: "p", text: paragraphs[18] + " " + paragraphs[19] }
    ];

    const env = {
      ALLOWED_ADMIN_IDS: "123456",
      BOT_TOKEN_SECRETO: "fake_token",
      BLOG_DB: mockDb,
      ADMIN_KV: mockKv,
      AI: {
        async run(model, opts) {
          const sys = opts?.messages?.[0]?.content || "";
          if (sys.includes("Director Editorial")) {
            return {
              response: JSON.stringify({
                businessProblem: "Pérdida de clientes por falta de seguimiento comercial",
                uniqueThesis: "El seguimiento sistemático en 24 horas triplica cierres",
                nonObviousInsight: "No se trata de insistir sino de resolver dudas operativas",
                tradeoff: "Automatizar el primer paso sin perder empatía humana",
                requiredExamples: ["Clínica dental", "Taller mecánico"],
                evaluation: {
                  thesisSpecificity: { score: 80 },
                  insightOriginality: { score: 80 },
                  businessProblemSpecificity: { score: 80 },
                  tradeoffQuality: { score: 80 }
                }
              })
            };
          }
          if (sys.includes("Critical Editor") || sys.includes("Auditor de Calidad")) {
            return {
              response: JSON.stringify({
                approved: true,
                score: 85,
                metrics: { depth: { score: 85 }, originality: { score: 85 }, nonObviousness: { score: 80 }, nuance: { score: 80 }, humanness: { score: 85 }, specificity: { score: 85 } },
                reasons: []
              })
            };
          }
          return {
            response: JSON.stringify({
              title: "Artículo Rescatado por Cron Scheduled",
              tag: "Estrategia",
              excerpt: "Resumen de artículo rescatado por scheduled event.",
              content
            })
          };
        }
      }
    };

    // 1. Simular un job interrumpido en 'queued'
    mockDb.tables.admin_pending_jobs.push({
      id: "job_stalled_cron",
      job_type: "blog_generate_draft",
      status: "queued",
      user_id: "123456",
      chat_id: "123456",
      message_id: 13,
      payload_json: JSON.stringify({ tema: "Evolución a socios estratégicos", ip: "127.0.0.1", username: "admin" }),
      attempts: 0,
      locked_until: null
    });

    // 2. Invocar el scheduled handler de canedo-admin
    await worker.scheduled({ scheduledTime: Date.now() }, env);

    // 3. Verificar que el trabajo fue reclamado y completado, y se creó el borrador en D1
    const job = mockDb.tables.admin_pending_jobs.find(j => j.id === "job_stalled_cron");
    assert.equal(job.status, "completed");
    const draft = mockDb.tables.blog_manual_drafts.find(d => d.title === "Artículo Rescatado por Cron Scheduled");
    assert.ok(draft);
    assert.equal(draft.status, "draft");
    assert.ok((draft.wordCount || draft.word_count) >= 650);

    // 4. Invocar scheduled de nuevo: no debe reprocesar ni duplicar borradores
    const draftsCountBefore = mockDb.tables.blog_manual_drafts.length;
    await worker.scheduled({ scheduledTime: Date.now() }, env);
    assert.equal(mockDb.tables.blog_manual_drafts.length, draftsCountBefore);
  });

  await t.test("21. Fase 8A.1: Límite estricto de 3 intentos y notificación de fallo definitivo a Telegram", async () => {
    const mockDb = createMockD1();
    const env = {
      ALLOWED_ADMIN_IDS: "123456",
      BOT_TOKEN_SECRETO: "fake_token",
      BLOG_DB: mockDb,
      ADMIN_KV: createMockKV(),
      AI: {
        async run() {
          throw new Error("Simulated Workers AI Unrecoverable Failure");
        }
      }
    };

    // Trabajo que ya tenía 2 intentos previos
    mockDb.tables.admin_pending_jobs.push({
      id: "job_fail_3",
      job_type: "blog_generate_draft",
      status: "queued",
      user_id: "123456",
      chat_id: "123456",
      message_id: 14,
      payload_json: JSON.stringify({ tema: "Tema imposible", ip: "127.0.0.1", username: "admin" }),
      attempts: 2,
      locked_until: null
    });

    await worker.scheduled({ scheduledTime: Date.now() }, env);

    const job = mockDb.tables.admin_pending_jobs.find(j => j.id === "job_fail_3");
    assert.equal(job.status, "failed");
    assert.equal(job.attempts, 3);
    assert.ok(job.error_message.includes("SKIP TOPIC") || job.error_message.includes("Simulated Workers AI"));
  });
});
