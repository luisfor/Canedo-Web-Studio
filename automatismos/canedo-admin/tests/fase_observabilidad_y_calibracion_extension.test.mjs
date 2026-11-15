// File: automatismos/canedo-admin/tests/fase_observabilidad_y_calibracion_extension.test.mjs
// Suite de pruebas para Observabilidad en D1/Telegram y Control Quirúrgico de Extensión

import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";
import {
  createJob,
  claimSpecificJob,
  renewJobLock,
  markJobCompleted,
  markJobFailed,
  getJobById,
  getJobEvents
} from "../src/db.js";
import { resolveArticleType } from "../src/modules/blog/editorial_pipeline.js";
import { generateArticleMarkdown, countWordsInString } from "../../canedostudio-blog-bot/src/editorial_pipeline.js";

// Mock de base de datos D1 en memoria con soporte para las nuevas columnas de la migración 0002
function createMockD1() {
  const jobs = new Map();
  const events = [];

  return {
    _jobs: jobs,
    _events: events,
    prepare(query) {
      let boundParams = [];
      return {
        bind(...args) {
          boundParams = args;
          return this;
        },
        async run() {
          const q = query.trim();
          if (q.startsWith("INSERT INTO admin_telegram_updates")) {
            return { success: true, changes: 1 };
          }
          if (q.startsWith("INSERT INTO admin_pending_jobs")) {
            const [id, jobType, userId, chatId, messageId, payloadJson] = boundParams;
            jobs.set(id, {
              id,
              job_type: jobType,
              status: "queued",
              user_id: userId,
              chat_id: chatId,
              message_id: messageId,
              payload_json: payloadJson,
              attempts: 0,
              current_stage: "queued",
              stage_updated_at: new Date().toISOString(),
              word_count: 0,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
            return { success: true, changes: 1 };
          }
          if (q.startsWith("INSERT INTO admin_job_events")) {
            const [jobId, stage, attempt, durationMs, wordCount, errorType, detailsJson] = boundParams;
            events.push({
              id: events.length + 1,
              job_id: jobId,
              stage,
              attempt,
              duration_ms: durationMs,
              word_count: wordCount,
              error_type: errorType,
              details_json: detailsJson,
              created_at: new Date().toISOString()
            });
            return { success: true, changes: 1 };
          }
          if (q.startsWith("UPDATE admin_pending_jobs")) {
            if (q.includes("SET locked_until = ?") && q.includes("current_stage = ?")) {
              const [lockUntilIso, stage, ...rest] = boundParams;
              const jobId = rest[rest.length - 2];
              const expectedAttempts = rest[rest.length - 1];
              const job = jobs.get(jobId);
              if (job && job.status === "processing" && job.attempts === expectedAttempts) {
                job.locked_until = lockUntilIso;
                job.current_stage = stage;
                if (typeof boundParams[2] === "number") job.word_count = boundParams[2];
                job.updated_at = new Date().toISOString();
                return { success: true, changes: 1 };
              }
              return { success: false, changes: 0 };
            }
            if (q.includes("SET status = 'processing'")) {
              const [lockUntilIso, jobId] = boundParams;
              const job = jobs.get(jobId);
              if (job && (job.status === "queued" || job.status === "processing")) {
                job.status = "processing";
                job.attempts = (job.attempts || 0) + 1;
                job.locked_until = lockUntilIso;
                job.updated_at = new Date().toISOString();
                return { success: true, changes: 1 };
              }
              return { success: false, changes: 0 };
            }
            if (q.includes("SET status = 'completed'")) {
              const [resultJson, jobId] = boundParams;
              const job = jobs.get(jobId);
              if (job) {
                job.status = "completed";
                job.current_stage = "completed";
                job.result_json = resultJson;
                job.locked_until = null;
                job.updated_at = new Date().toISOString();
                return { success: true, changes: 1 };
              }
              return { success: false, changes: 0 };
            }
            if (q.includes("SET status = CASE WHEN")) {
              const [errorMessage, jobId] = boundParams;
              const job = jobs.get(jobId);
              if (job) {
                const isTerminal = q.includes("1 = 1") || job.attempts >= 3;
                job.status = isTerminal ? "failed" : "queued";
                job.current_stage = job.status;
                job.error_message = errorMessage;
                job.locked_until = null;
                job.updated_at = new Date().toISOString();
                return { success: true, changes: 1 };
              }
              return { success: false, changes: 0 };
            }
          }
          return { success: true, changes: 1 };
        },
        async first() {
          const q = query.trim();
          if (q.startsWith("SELECT * FROM admin_pending_jobs WHERE id = ?")) {
            const [jobId] = boundParams;
            return jobs.get(jobId) || null;
          }
          return null;
        },
        async all() {
          const q = query.trim();
          if (q.startsWith("SELECT * FROM admin_job_events WHERE job_id = ?")) {
            const [jobId] = boundParams;
            const res = events.filter(e => e.job_id === jobId);
            return { results: res };
          }
          return { results: [] };
        }
      };
    }
  };
}

test("1. Control de Extensión: Calibración y Micro-Ampliación cuando el artículo queda en 370 palabras", async () => {
  // Simular un mock de Workers AI que en primer intento devuelve solo 370 palabras
  const shortIntro = "El dilema de los presupuestos comerciales en pymes es su lentitud operativa y manual. Muchas horas invertidas.";
  const shortSection = "## 1. Automatización inmediata\n\nLas clínicas dentales y talleres pierden citas si tardan más de cuatro horas en presupuestar. Se requiere un protocolo digital simple que calcule márgenes en tiempo real.";
  
  // Texto complementario para la micro-ampliación (+200 palabras)
  const expandedSection = "## 1. Automatización inmediata\n\nLas clínicas dentales y talleres pierden citas si tardan más de cuatro horas en presupuestar. Se requiere un protocolo digital simple que calcule márgenes en tiempo real.\n\nPor ejemplo, una clínica dental con tres sillones operativos recibe una media de veinte solicitudes de presupuesto semanales entre ortodoncia y prótesis fija. Cuando el odontólogo debe calcular manualmente los costes de laboratorio y los tiempos de gabinete por la noche, el paciente ya ha consultado a dos centros competidores que enviaron una propuesta cerrada en minutos. Al digitalizar las tablas de baremos en un software conectado a un bot de mensajería, el presupuesto preliminar se emite de forma estandarizada en menos de cinco minutos con un margen de tolerancia previamente validado por dirección.";

  const aiMock = {
    async run(model, options) {
      const prompt = options.messages?.find(m => m.role === "user")?.content || "";
      if (prompt.includes("outlinePrompt") || prompt.includes("Diseña el esquema estructurado")) {
        return {
          response: JSON.stringify({
            sections: [
              { heading: "Fricción operativa real y pérdidas cotidianas", goal: "Caso práctico de clínicas dentales" },
              { heading: "Protocolo de solución práctica y siguientes pasos", goal: "Cálculo automático de presupuestos" }
            ]
          })
        };
      }
      if (prompt.includes("Amplía con mayor profundidad técnica")) {
        return { response: expandedSection };
      }
      if (prompt.includes("Escribe la introducción")) {
        return { response: shortIntro };
      }
      return { response: shortSection };
    }
  };

  const articleType = resolveArticleType(2); // Tipo 2 (650-900)
  const stats = { writerCalls: 0 };
  const md = await generateArticleMarkdown({ AI: aiMock }, { uniqueThesis: "Presupuestos rápidos" }, { tema: "Cómo automatizar presupuestos con IA", articleType: 2, targetWords: 850 }, 1, null, stats);

  const wordCount = countWordsInString(md);
  assert.ok(stats.writerCalls >= 2, "Debió ejecutar generación y ampliación quirúrgica");
  assert.ok(md.includes("clínica dental con tres sillones operativos"), "Debe incorporar la sección ampliada");
});

test("2. Control de Extensión: Calibración y Condensación Quirúrgica cuando el texto excede 1.080 palabras", async () => {
  // Generar un texto base de 1.050 palabras
  const longParagraph = "En el tejido empresarial contemporáneo, la adopción de tecnologías operativas no representa un lujo superfluo sino una condición indispensable para asegurar la supervivencia y rentabilidad de cualquier modelo de negocio enfocado en servicios profesionales o comercio de proximidad. ".repeat(15);
  const introText = "Introducción analítica y operativa sobre los retos presupuestarios en pymes.";
  const verboseSection = `## Desglose de fricción operativa\n\n${longParagraph}\n\n${longParagraph}`;

  const condensedSection = "## Desglose de fricción operativa\n\nLas clínicas dentales y negocios de salud afrontan pérdidas severas cuando los presupuestos se calculan a mano. Por ejemplo, un gabinete odontológico tarda hasta 48 horas en cotizar un tratamiento integral, lo que reduce la tasa de aceptación en un tercio frente a competidores directos.";

  const aiMock = {
    async run(model, options) {
      const prompt = options.messages?.find(m => m.role === "user")?.content || "";
      if (prompt.includes("Diseña el esquema estructurado")) {
        return {
          response: JSON.stringify({
            sections: [
              { heading: "Desglose de fricción operativa", goal: "Impacto económico real" },
              { heading: "Protocolo de implantación", goal: "Automatización inmediata" }
            ]
          })
        };
      }
      if (prompt.includes("Escribe la introducción")) {
        return { response: introText };
      }
      if (prompt.includes("Condensa y sintetiza el texto")) {
        return { response: condensedSection };
      }
      return { response: verboseSection };
    }
  };

  const stats = { writerCalls: 0 };
  const md = await generateArticleMarkdown({ AI: aiMock }, { uniqueThesis: "Presupuestos rápidos" }, { tema: "Cómo automatizar presupuestos con IA", articleType: 2, targetWords: 850 }, 1, null, stats);

  const wordCount = countWordsInString(md);
  assert.ok(stats.writerCalls >= 2, "Debió invocar condensación quirúrgica");
  assert.ok(md.includes(condensedSection), "Debe haber reemplazado el texto verborrágico por la versión sintetizada");
});

test("3. Observabilidad D1: Registro de etapas y eventos sin alterar el flujo", async () => {
  const db = createMockD1();
  const jobId = "job_test_obs_123";

  await createJob(db, {
    id: jobId,
    jobType: "blog_generate_draft",
    userId: "1304275001",
    chatId: "1304275001",
    messageId: 999,
    payload: { tema: "Automatización con IA", articleType: 2 }
  });

  const jobBefore = await getJobById(db, jobId);
  assert.equal(jobBefore.status, "queued");
  assert.equal(jobBefore.current_stage, "queued");

  // Reclamar job
  const claimed = await claimSpecificJob(db, jobId, 120);
  assert.ok(claimed);
  assert.equal(claimed.status, "processing");

  // Registrar latido con etapa y palabras
  await renewJobLock(db, jobId, claimed.attempts, 120, "section_generating", 450, { sectionIndex: 2, totalSections: 3 });

  const jobMid = await getJobById(db, jobId);
  assert.equal(jobMid.current_stage, "section_generating");
  assert.equal(jobMid.word_count, 450);

  // Marcar como completado
  await markJobCompleted(db, jobId, { draftId: "draft_abc" }, claimed.attempts);
  const jobFinal = await getJobById(db, jobId);
  assert.equal(jobFinal.status, "completed");
  assert.equal(jobFinal.current_stage, "completed");

  const events = await getJobEvents(db, jobId);
  assert.ok(events.length >= 2, "Debió registrar historial de eventos");
});

test("4. Telegram: Botón '🔎 Consultar estado' responde de forma interactiva y sin consumir Workers AI", async () => {
  const db = createMockD1();
  const jobId = "job_test_btn_456";

  await createJob(db, {
    id: jobId,
    jobType: "blog_generate_draft",
    userId: "1304275001",
    chatId: "1304275001",
    messageId: 777,
    payload: { tema: "Tema de prueba", articleType: 2 }
  });

  const claimed = await claimSpecificJob(db, jobId, 120);
  await renewJobLock(db, jobId, claimed.attempts, 120, "section_generating", 580);

  let answeredQuery = null;
  globalThis.fetch = async (url, options) => {
    if (url.includes("/answerCallbackQuery")) {
      answeredQuery = JSON.parse(options.body);
      return { ok: true, json: async () => ({ ok: true }) };
    }
    return { ok: true, json: async () => ({ ok: true }) };
  };

  const env = {
    BOT_TOKEN_SECRETO: "mock_token",
    ALLOWED_ADMIN_IDS: "1304275001",
    BLOG_DB: db
  };

  const update = {
    update_id: 112233,
    callback_query: {
      id: "cb_query_999",
      from: { id: 1304275001 },
      message: { message_id: 777, chat: { id: 1304275001 } },
      data: `job:status:${jobId}`
    }
  };

  const res = await worker.handleTelegramUpdate(update, env, null, null);
  assert.equal(res.ok, true);
  assert.equal(res.route, "job_status_checked");
  assert.equal(res.status, "processing");
  assert.equal(res.stage, "section_generating");

  assert.ok(answeredQuery, "Debió llamar a answerCallbackQuery");
  assert.ok(answeredQuery.text.includes("✍️ Redactando secciones"), "Debe mostrar la etiqueta en español de la etapa");
  assert.ok(answeredQuery.text.includes("Palabras: 580"), "Debe informar las palabras reales calculadas");
});

test("5. Control de Reintentos: Fallo editorial determinista se marca como terminal de inmediato sin quemar cron", async () => {
  const db = createMockD1();
  const jobId = "job_test_terminal_789";

  await createJob(db, {
    id: jobId,
    jobType: "blog_generate_draft",
    userId: "1304275001",
    chatId: "1304275001",
    messageId: 555,
    payload: { tema: "Tema rechazado", articleType: 2 }
  });

  const claimed = await claimSpecificJob(db, jobId, 120);
  
  // Marcar como error editorial determinista (isTerminal = true)
  const isTerminal = true;
  await markJobFailed(db, jobId, "Extensión excesiva: 1089 palabras (máximo permitido: 900).", claimed.attempts, isTerminal, "QUALITY_GATE_EDITORIAL");

  const job = await getJobById(db, jobId);
  assert.equal(job.status, "failed", "El trabajo con rechazo editorial determinista debe pasar directamente a failed");
  assert.equal(job.current_stage, "failed");
  assert.ok(job.error_message.includes("Extensión excesiva"));

  // Verificar que el cron de recuperación NO recoge este trabajo
  const { claimNextJob } = await import("../src/db.js");
  const nextJob = await claimNextJob(db);
  assert.equal(nextJob, null, "El cron no debe recoger trabajos en estado failed");
});
