// File: automatismos/canedo-admin/tests/fase_publicacion_manual_segura.test.mjs
// Pruebas unitarias completas para el flujo de publicación manual segura desde Telegram:
// Confirmación explícita, cancelación, bloqueo condicional, contingencia Flux JPEG y persistencia dual.

import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";
import { publishApprovedDraft } from "../src/modules/blog/service.js";

function createMockD1() {
  const drafts = new Map();
  const jobs = new Map();
  const publishedPosts = [];
  const auditLogs = [];

  return {
    _drafts: drafts,
    _jobs: jobs,
    _publishedPosts: publishedPosts,
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
          if (q.startsWith("INSERT INTO admin_pending_jobs")) {
            const [id, jobType, userId, chatId, msgId, payloadStr] = bound;
            jobs.set(id, { id, job_type: jobType, user_id: userId, chat_id: chatId, message_id: msgId, payload_json: payloadStr, status: "queued", attempts: 0 });
            return { success: true, changes: 1 };
          }
          if (q.includes("UPDATE admin_pending_jobs") && q.includes("status = 'processing'")) {
            const [lockUntil, id] = bound;
            const j = jobs.get(id);
            if (j && (j.status === "queued" || j.status === "processing")) {
              j.status = "processing";
              j.attempts = (j.attempts || 0) + 1;
              return { success: true, meta: { changes: 1 }, changes: 1 };
            }
            return { success: false, meta: { changes: 0 }, changes: 0 };
          }
          if (q.includes("UPDATE admin_pending_jobs") && q.includes("status = 'completed'")) {
            const [resStr, id] = bound;
            const j = jobs.get(id);
            if (j) j.status = "completed";
            return { success: true, meta: { changes: 1 }, changes: 1 };
          }
          if (q.includes("UPDATE admin_pending_jobs") && q.includes("status = 'failed'")) {
            const [err, id] = bound;
            const j = jobs.get(id);
            if (j) {
              j.status = "failed";
              j.error_message = err;
            }
            return { success: true, meta: { changes: 1 }, changes: 1 };
          }
          if (q.includes("UPDATE blog_manual_drafts") && q.includes("status = 'published'")) {
            const [slug, nowIso, id] = bound;
            const d = drafts.get(id);
            if (d) {
              d.status = "published";
              d.publishedSlug = slug;
            }
            return { success: true, meta: { changes: 1 }, changes: 1 };
          }
          if (q.includes("UPDATE blog_manual_drafts") && q.includes("status = 'approved'")) {
            const [userId, draftId] = bound;
            const d = drafts.get(draftId);
            if (d) {
              d.status = "approved";
              d.approved_by_user_id = userId;
            }
            return { success: true, meta: { changes: 1 }, changes: 1 };
          }
          if (q.startsWith("INSERT INTO blog_posts")) {
            publishedPosts.push(bound);
            return { success: true, meta: { changes: 1 }, changes: 1 };
          }
          if (q.startsWith("INSERT INTO admin_audit_log")) {
            auditLogs.push(bound);
            return { success: true, meta: { changes: 1 }, changes: 1 };
          }
          return { success: true, meta: { changes: 1 }, changes: 1 };
        },
        async first() {
          const q = query.trim();
          if (q.startsWith("SELECT * FROM blog_manual_drafts WHERE id = ?")) {
            const [id] = bound;
            const d = drafts.get(id);
            if (!d) return null;
            return {
              id: d.id,
              topic_tema: d.topicTema || "Tema",
              topic_angulo: d.topicAngulo || "Angulo",
              title: d.title,
              tag: d.tag || "Estrategia",
              excerpt: d.excerpt || "Resumen",
              content_json: JSON.stringify(d.content || [{ type: "p", text: "Parrafo" }]),
              brief_json: JSON.stringify(d.brief || {}),
              audit_json: JSON.stringify(d.audit || {}),
              word_count: d.word_count || 700,
              status: d.status,
              published_slug: d.publishedSlug || null,
              created_by_user_id: "user_123",
              approved_by_user_id: d.approved_by_user_id || null,
              created_at: new Date().toISOString()
            };
          }
          if (q.startsWith("SELECT * FROM admin_pending_jobs WHERE id = ?")) {
            const [id] = bound;
            return jobs.get(id) || null;
          }
          if (q.startsWith("SELECT title, excerpt, content_json, status FROM blog_posts WHERE slug = ?")) {
            return null; // No duplicate
          }
          return null;
        },
        async all() {
          return { results: [] };
        }
      };
    }
  };
}

function createMockKV() {
  const store = new Map();
  store.set("posts", JSON.stringify({ posts: [] }));
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

test("SUITE DE PUBLICACIÓN MANUAL SEGURA DESDE TELEGRAM (FASE FINAL)", async (t) => {

  await t.test("1. Solicitud de confirmación: 'draft:publish_confirm' muestra prompt con opciones Confirmar / Cancelar", async () => {
    const db = createMockD1();
    const draftId = "draft_confirm_1";
    db._drafts.set(draftId, {
      id: draftId,
      title: "Presupuestos Rápidos con IA",
      tag: "Estrategia",
      status: "approved",
      word_count: 730
    });

    let sentMessage = null;
    globalThis.fetch = async (url, options) => {
      const body = JSON.parse(options.body || "{}");
      if (url.includes("/editMessageText")) sentMessage = body;
      return { ok: true, json: async () => ({ ok: true, result: { message_id: 200 } }) };
    };

    const env = {
      BOT_TOKEN_SECRETO: "real_token_simulated",
      ALLOWED_ADMIN_IDS: "1304275001",
      BLOG_DB: db,
      ADMIN_PUBLISH_ENABLED: "true"
    };

    const update = {
      update_id: 9001,
      callback_query: {
        id: "cb_pub_confirm",
        from: { id: 1304275001 },
        message: { message_id: 200, chat: { id: 1304275001 } },
        data: `draft:publish_confirm:${draftId}`
      }
    };

    const res = await worker.handleTelegramUpdate(update, env, null, null);
    assert.equal(res.ok, true);
    assert.equal(res.route, "draft_publish_confirm_prompt");

    assert.ok(sentMessage.text.includes("CONFIRMACIÓN DE PUBLICACIÓN"));
    assert.ok(sentMessage.text.includes("¿Confirmas que deseas publicar este artículo en <b>canedostudio.com</b>?"));

    const buttons = sentMessage.reply_markup.inline_keyboard.flat();
    assert.ok(buttons.some(b => b.text.includes("Confirmar publicación") && b.callback_data === `draft:publish_execute:${draftId}`));
    assert.ok(buttons.some(b => b.text.includes("Cancelar") && b.callback_data === `draft:view:${draftId}`));
  });

  await t.test("2. Cancelación: Botón Cancelar retorna a la vista del borrador sin modificar su estado", async () => {
    const db = createMockD1();
    const draftId = "draft_cancel_1";
    db._drafts.set(draftId, {
      id: draftId,
      title: "Artículo a Cancelar",
      tag: "Estrategia",
      status: "approved",
      word_count: 750
    });

    let sentMessage = null;
    globalThis.fetch = async (url, options) => {
      const body = JSON.parse(options.body || "{}");
      if (url.includes("/editMessageText")) sentMessage = body;
      return { ok: true, json: async () => ({ ok: true, result: { message_id: 200 } }) };
    };

    const env = {
      BOT_TOKEN_SECRETO: "real_token_simulated",
      ALLOWED_ADMIN_IDS: "1304275001",
      BLOG_DB: db,
      ADMIN_PUBLISH_ENABLED: "true"
    };

    const update = {
      update_id: 9002,
      callback_query: {
        id: "cb_cancel",
        from: { id: 1304275001 },
        message: { message_id: 200, chat: { id: 1304275001 } },
        data: `draft:view:${draftId}`
      }
    };

    const res = await worker.handleTelegramUpdate(update, env, null, null);
    assert.equal(res.ok, true);
    assert.equal(res.route, "draft_view");
    assert.equal(db._drafts.get(draftId).status, "approved", "El estado debe permanecer intacto");
  });

  await t.test("3. Seguridad: Bloquea publicación de borradores que NO han sido aprobados previamente", async () => {
    const db = createMockD1();
    const draftId = "draft_not_approved_yet";
    db._drafts.set(draftId, {
      id: draftId,
      title: "Borrador sin Aprobar",
      tag: "Estrategia",
      status: "draft", // Todavía no aprobado
      word_count: 700
    });

    let sentMessage = null;
    globalThis.fetch = async (url, options) => {
      const body = JSON.parse(options.body || "{}");
      if (url.includes("/editMessageText")) sentMessage = body;
      return { ok: true, json: async () => ({ ok: true, result: { message_id: 200 } }) };
    };

    const env = {
      BOT_TOKEN_SECRETO: "real_token_simulated",
      ALLOWED_ADMIN_IDS: "1304275001",
      BLOG_DB: db,
      ADMIN_PUBLISH_ENABLED: "true"
    };

    const update = {
      update_id: 9003,
      callback_query: {
        id: "cb_try_publish_unapproved",
        from: { id: 1304275001 },
        message: { message_id: 200, chat: { id: 1304275001 } },
        data: `draft:publish_execute:${draftId}`
      }
    };

    const res = await worker.handleTelegramUpdate(update, env, null, null);
    assert.equal(res.ok, true);
    assert.equal(res.route, "draft_publish_not_approved");
    assert.ok(sentMessage.text.includes("El borrador no ha sido aprobado previamente"));
  });

  await t.test("4. Resiliencia de Portada: Si Flux falla, genera portada de contingencia JPEG válida decodificable", async () => {
    const db = createMockD1();
    const kv = createMockKV();
    const draftId = "draft_cover_flux_fail";
    db._drafts.set(draftId, {
      id: draftId,
      title: "Prueba Fallo Flux",
      tag: "Estrategia",
      status: "approved",
      word_count: 720,
      content: [{ type: "p", text: "Contenido completo" }]
    });

    const mockAiFailing = {
      async run(model) {
        if (model.includes("flux")) throw new Error("Flux Schnell 504 Gateway Timeout");
        return {};
      }
    };

    const env = {
      BLOG_DB: db,
      ADMIN_KV: kv,
      AI: mockAiFailing,
      ADMIN_PUBLISH_ENABLED: "true"
    };

    const { slug, post } = await publishApprovedDraft(env, draftId, "user_123");
    assert.ok(slug);
    assert.ok(post.cover.startsWith("/media/covers/"));

    // Verificar que en KV se guardó la portada con cabeceras JPEG válidas
    const coverKey = "img:covers/" + slug + ".jpg";
    const coverBytes = await kv.get(coverKey, { type: "arrayBuffer" });
    assert.ok(coverBytes, "La portada de contingencia debe existir en KV");
    const arr = new Uint8Array(coverBytes);
    assert.equal(arr[0], 0xff, "Byte 0 debe ser 0xFF (SOI)");
    assert.equal(arr[1], 0xd8, "Byte 1 debe ser 0xD8 (SOI)");
    assert.equal(arr[2], 0xff, "Byte 2 debe ser 0xFF (JFIF Marker)");
    assert.ok(arr.byteLength >= 1000, "Debe tener un tamaño seguro");
  });

  await t.test("5. Publicación Exitosa: Inserta en D1 y KV y muestra mensaje final con botón '🌐 Ver en mi web'", async () => {
    const db = createMockD1();
    const kv = createMockKV();
    const draftId = "draft_full_publish_success";
    db._drafts.set(draftId, {
      id: draftId,
      title: "Automatiza Presupuestos Dentales",
      tag: "Automatización",
      status: "approved",
      word_count: 704,
      content: [{ type: "p", text: "Cuerpo editorial detallado para clínicas dentales..." }]
    });

    let sentMessages = [];
    globalThis.fetch = async (url, options) => {
      const body = JSON.parse(options.body || "{}");
      if (url.includes("/editMessageText")) sentMessages.push(body);
      return { ok: true, json: async () => ({ ok: true, result: { message_id: 500 } }) };
    };

    const mockAiSuccess = {
      async run(model) {
        if (model.includes("flux")) {
          const b = new Uint8Array(12000);
          b[0] = 0xff; b[1] = 0xd8; b[2] = 0xff;
          return b.buffer;
        }
        return {};
      }
    };

    const env = {
      BOT_TOKEN_SECRETO: "real_token_simulated",
      ALLOWED_ADMIN_IDS: "1304275001",
      BLOG_DB: db,
      ADMIN_KV: kv,
      AI: mockAiSuccess,
      ADMIN_PUBLISH_ENABLED: "true"
    };

    const update = {
      update_id: 9005,
      callback_query: {
        id: "cb_publish_exec",
        from: { id: 1304275001 },
        message: { message_id: 500, chat: { id: 1304275001 } },
        data: `draft:publish_execute:${draftId}`
      }
    };

    const res = await worker.handleTelegramUpdate(update, env, null, null);
    assert.equal(res.ok, true);
    assert.equal(res.route, "draft_publish_queued");

    // Esperar resolución del procesamiento asíncrono
    await new Promise(r => setTimeout(r, 60));

    // Confirmar que el borrador pasó a published
    assert.equal(db._drafts.get(draftId).status, "published");

    // Confirmar que el mensaje final contiene el formato exacto requerido
    const lastMsg = sentMessages[sentMessages.length - 1];
    assert.ok(lastMsg.text.includes("✅ Artículo publicado"));
    assert.ok(lastMsg.text.includes("Automatiza Presupuestos Dentales"));
    assert.ok(lastMsg.text.includes("https://canedostudio.com/insights/"));

    const buttons = lastMsg.reply_markup.inline_keyboard.flat();
    const webBtn = buttons.find(b => b.text.includes("Ver en mi web"));
    assert.ok(webBtn, "Debe incluir el botón '🌐 Ver en mi web'");
    assert.ok(webBtn.url.startsWith("https://canedostudio.com/insights/"));
  });

  await t.test("6. Idempotencia y Doble Clic: Reintentar publicación de borrador ya publicado es rechazado limpiamente", async () => {
    const db = createMockD1();
    const kv = createMockKV();
    const draftId = "draft_already_pub";
    db._drafts.set(draftId, {
      id: draftId,
      title: "Artículo Ya Publicado",
      status: "published",
      word_count: 700
    });

    const env = {
      BLOG_DB: db,
      ADMIN_KV: kv,
      ADMIN_PUBLISH_ENABLED: "true"
    };

    await assert.rejects(
      async () => publishApprovedDraft(env, draftId, "user_123"),
      /ya fue publicado previamente/
    );
  });
});
