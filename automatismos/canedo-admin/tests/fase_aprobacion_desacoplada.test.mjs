// File: automatismos/canedo-admin/tests/fase_aprobacion_desacoplada.test.mjs
// Pruebas unitarias para la separación entre "Aprobar Borrador" y "Publicar Artículo"

import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";
import { approveDraftOnly, publishApprovedDraft } from "../src/modules/blog/service.js";

function createMockD1() {
  const drafts = new Map();
  const jobs = new Map();
  const auditLogs = [];

  return {
    _drafts: drafts,
    _jobs: jobs,
    _auditLogs: auditLogs,
    prepare(query) {
      let bound = [];
      return {
        bind(...args) {
          bound = args;
          return this;
        },
        async run() {
          const q = query.trim();
          if (q.startsWith("INSERT INTO admin_telegram_updates")) {
            return { success: true, changes: 1 };
          }
          if (q.includes("UPDATE blog_manual_drafts") && q.includes("status = 'approved'")) {
            const [userId, draftId] = bound;
            const d = drafts.get(draftId);
            if (d && (d.status === "draft" || d.status === "approved")) {
              d.status = "approved";
              d.approved_by_user_id = userId;
              d.approvedByUserId = userId;
              d.updated_at = new Date().toISOString();
              return { success: true, changes: 1 };
            }
            return { success: false, changes: 0 };
          }
          if (q.startsWith("INSERT INTO admin_audit_log")) {
            auditLogs.push(bound);
            return { success: true, changes: 1 };
          }
          return { success: true, changes: 1 };
        },
        async first() {
          const q = query.trim();
          if (q.startsWith("SELECT * FROM blog_manual_drafts WHERE id = ?")) {
            const [id] = bound;
            const d = drafts.get(id);
            if (!d) return null;
            return {
              id: d.id,
              topic_tema: d.topicTema || d.topic_tema,
              topic_angulo: d.topicAngulo || d.topic_angulo,
              title: d.title,
              tag: d.tag,
              excerpt: d.excerpt,
              content_json: JSON.stringify(d.content || []),
              brief_json: JSON.stringify(d.brief || {}),
              audit_json: JSON.stringify(d.audit || {}),
              word_count: d.word_count,
              status: d.status,
              created_by_user_id: d.created_by_user_id || "user_123",
              approved_by_user_id: d.approved_by_user_id || null,
              created_at: d.created_at || new Date().toISOString()
            };
          }
          if (q.startsWith("SELECT * FROM admin_pending_jobs WHERE id = ?")) {
            const [id] = bound;
            return jobs.get(id) || null;
          }
          return null;
        }
      };
    }
  };
}

test("1. Aprobación Desacoplada: approveDraftOnly cambia el estado a 'approved' sin requerir ADMIN_PUBLISH_ENABLED=true", async () => {
  const db = createMockD1();
  const draftId = "draft_test_approve_1";
  db._drafts.set(draftId, {
    id: draftId,
    title: "Artículo de Automatización",
    status: "draft",
    word_count: 750,
    topicTema: "IA",
    tag: "Estrategia"
  });

  const env = {
    BLOG_DB: db,
    ADMIN_PUBLISH_ENABLED: "false" // Publicación bloqueada en backend
  };

  const approved = await approveDraftOnly(env, draftId, "user_123");
  assert.equal(approved.status, "approved");
  assert.equal(approved.approvedByUserId, "user_123");
});

test("2. Bloqueo de Publicación: publishApprovedDraft arroja error estricto si ADMIN_PUBLISH_ENABLED=false", async () => {
  const db = createMockD1();
  const draftId = "draft_test_pub_blocked";
  db._drafts.set(draftId, {
    id: draftId,
    title: "Artículo de Prueba",
    status: "approved",
    word_count: 800
  });

  const env = {
    BLOG_DB: db,
    ADMIN_PUBLISH_ENABLED: "false"
  };

  await assert.rejects(
    async () => publishApprovedDraft(env, draftId, "user_123"),
    /ADMIN_PUBLISH_DISABLED/
  );
});

test("3. Interfaz Telegram: 'draft:approve_only' responde con aprobación limpia y muestra botón publicar condicional", async () => {
  const db = createMockD1();
  const draftId = "draft_test_tg_action";
  db._drafts.set(draftId, {
    id: draftId,
    title: "Automatiza tu Pyme",
    tag: "Estrategia",
    status: "draft",
    word_count: 720,
    topicTema: "Pymes",
    excerpt: "Resumen BLUF de prueba"
  });

  let sentMessages = [];
  let answeredQueries = [];

  globalThis.fetch = async (url, options) => {
    const body = JSON.parse(options.body || "{}");
    if (url.includes("/answerCallbackQuery")) {
      answeredQueries.push(body);
      return { ok: true, json: async () => ({ ok: true }) };
    }
    if (url.includes("/editMessageText")) {
      sentMessages.push(body);
      return { ok: true, json: async () => ({ ok: true, result: { message_id: 100 } }) };
    }
    return { ok: true, json: async () => ({ ok: true }) };
  };

  const env = {
    BOT_TOKEN_SECRETO: "real_token_simulated_for_fetch",
    ALLOWED_ADMIN_IDS: "1304275001",
    BLOG_DB: db,
    ADMIN_PUBLISH_ENABLED: "false" // Publicación deshabilitada
  };

  const update = {
    update_id: 8881,
    callback_query: {
      id: "cb_app_1",
      from: { id: 1304275001 },
      message: { message_id: 200, chat: { id: 1304275001 } },
      data: `draft:approve_only:${draftId}`
    }
  };

  const res = await worker.handleTelegramUpdate(update, env, null, null);
  assert.equal(res.ok, true);
  assert.equal(res.route, "draft_approved_only");

  // Verificar que el mensaje editado informa que el borrador fue aprobado
  const lastMsg = sentMessages[sentMessages.length - 1];
  assert.ok(lastMsg.text.includes("BORRADOR APROBADO EXITOSAMENTE"));
  assert.ok(lastMsg.text.includes("ADMIN_PUBLISH_ENABLED=false"));

  // Verificar que NO muestra el botón "🚀 Publicar Artículo" porque ADMIN_PUBLISH_ENABLED=false
  const buttonsFlat = lastMsg.reply_markup.inline_keyboard.flat();
  const hasPublishBtn = buttonsFlat.some(b => b.text.includes("Publicar"));
  assert.equal(hasPublishBtn, false, "No debe incluir el botón de publicación si está deshabilitada");
});

test("4. Consulta de Estado en Telegram: Si el job ya terminó, actualiza el mensaje mostrando 'Aprobar Borrador'", async () => {
  const db = createMockD1();
  const jobId = "job_done_123";
  const draftId = "draft_done_456";

  db._drafts.set(draftId, {
    id: draftId,
    title: "Presupuestos Rápidos",
    tag: "Estrategia",
    status: "draft",
    word_count: 704,
    excerpt: "Resumen BLUF de presupuestos"
  });

  db._jobs.set(jobId, {
    id: jobId,
    job_type: "blog_generate_draft",
    status: "completed",
    current_stage: "completed",
    user_id: "1304275001",
    chat_id: "1304275001",
    message_id: 300,
    attempts: 2,
    word_count: 704,
    result_json: JSON.stringify({ draftId })
  });

  let editPayload = null;
  globalThis.fetch = async (url, options) => {
    const body = JSON.parse(options.body || "{}");
    if (url.includes("/editMessageText")) {
      editPayload = body;
    }
    return { ok: true, json: async () => ({ ok: true, result: { message_id: 300 } }) };
  };

  const env = {
    BOT_TOKEN_SECRETO: "real_token_simulated_for_fetch",
    ALLOWED_ADMIN_IDS: "1304275001",
    BLOG_DB: db,
    ADMIN_PUBLISH_ENABLED: "false"
  };

  const update = {
    update_id: 8882,
    callback_query: {
      id: "cb_status_done",
      from: { id: 1304275001 },
      message: { message_id: 300, chat: { id: 1304275001 } },
      data: `job:status:${jobId}`
    }
  };

  const res = await worker.handleTelegramUpdate(update, env, null, null);
  assert.equal(res.ok, true);
  assert.equal(res.route, "job_status_checked");

  // Confirmar que actualizó el mensaje en el chat con la ficha del borrador generado
  assert.ok(editPayload, "Debió editar el mensaje del chat");
  assert.ok(editPayload.text.includes("BORRADOR EDITORIAL GENERADO CON ÉXITO"));
  assert.ok(editPayload.text.includes("Presupuestos Rápidos"));
  assert.ok(editPayload.text.includes("704 palabras"));

  // Verificar presencia del botón "✅ Aprobar Borrador"
  const buttonsFlat = editPayload.reply_markup.inline_keyboard.flat();
  const hasApproveOnlyBtn = buttonsFlat.some(b => b.text.includes("Aprobar Borrador"));
  assert.equal(hasApproveOnlyBtn, true);
});
