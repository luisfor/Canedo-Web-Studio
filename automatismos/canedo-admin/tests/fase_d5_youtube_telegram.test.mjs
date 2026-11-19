// File: automatismos/canedo-admin/tests/fase_d5_youtube_telegram.test.mjs
// Suite de pruebas automatizadas para Fase D5: Integración de YouTube con Telegram y Flujo Editorial

import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

function createMockEnv({ allowedIds = "12345,67890", adminPublishEnabled = "false" } = {}) {
  const kvStore = new Map();
  const dbDrafts = new Map();
  const dbPosts = new Map();
  const dbJobs = new Map();
  const auditLogs = [];

  const env = {
    ALLOWED_ADMIN_IDS: allowedIds,
    BOT_TOKEN_SECRETO: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
    WEBHOOK_SECRET_TOKEN: "mock_webhook_secret",
    ADMIN_PUBLISH_ENABLED: adminPublishEnabled,
    AI: {
      run: async (model, params) => {
        const paragraph = "En el panorama actual de desarrollo tecnológico y automatización para empresas, la adopción de flujos estructurados marca una diferencia competitiva indiscutible. La agencia Canedo Studio examina con rigor cómo las soluciones modernas eliminan cuellos de botella mediante arquitecturas serverless, bases de datos perimetrales y modelos de inteligencia artificial aplicados. ";
        const p4 = paragraph.repeat(4); // ~280 palabras
        return {
          response: `## 1. Introducción al Caso y Contexto Empresarial\n${p4}\n\n## 2. Metodología y Buenas Prácticas de Ingeniería\nEn este video el canal Canedo Tech expone de forma magistral las ventajas operativas.\n${p4}\n\n## 3. Conclusiones y Próximos Pasos para su Negocio\n${p4}`
        };
      }
    },
    ADMIN_KV: {
      get: async (k) => kvStore.get(k) || null,
      put: async (k, v, opts) => kvStore.set(k, v),
      delete: async (k) => kvStore.delete(k),
      _store: kvStore
    },
    BLOG_DB: {
      _drafts: dbDrafts,
      _posts: dbPosts,
      _jobs: dbJobs,
      _logs: auditLogs,
      prepare: (sql) => {
        return {
          bind: (...params) => {
            return {
              first: async () => {
                if (sql.includes("SELECT * FROM telegram_processed_updates")) return null;
                if (sql.includes("SELECT * FROM blog_posts WHERE slug = ?")) {
                  return dbPosts.get(params[0]) || null;
                }
                if (sql.includes("SELECT id, slug, title, date, status FROM blog_posts")) {
                  // Duplicate check
                  for (const p of dbPosts.values()) {
                    if (JSON.stringify(p).includes(params[0])) return p;
                  }
                  return null;
                }
                if (sql.includes("SELECT id, title, status, created_at FROM blog_manual_drafts")) {
                  // Duplicate draft check
                  for (const d of dbDrafts.values()) {
                    if (JSON.stringify(d).includes(params[0])) return d;
                  }
                  return null;
                }
                if (sql.includes("SELECT * FROM blog_manual_drafts WHERE id = ?")) {
                  return dbDrafts.get(params[0]) || null;
                }
                if (sql.includes("SELECT count(*) as total FROM blog_manual_drafts")) {
                  return { total: dbDrafts.size };
                }
                if (sql.includes("SELECT * FROM admin_pending_jobs WHERE id = ?")) {
                  const job = dbJobs.get(params[0]);
                  if (!job) return null;
                  return {
                    id: job.id,
                    job_type: job.jobType,
                    user_id: job.userId,
                    chat_id: job.chatId,
                    message_id: job.messageId,
                    payload_json: JSON.stringify(job.payload),
                    attempts: job.attempts,
                    status: job.status
                  };
                }
                if (sql.includes("SELECT * FROM admin_pending_jobs")) {
                  for (const job of dbJobs.values()) {
                    if (job.status === "queued" || job.status === "processing") {
                      return {
                        id: job.id,
                        job_type: job.jobType,
                        user_id: job.userId,
                        chat_id: job.chatId,
                        message_id: job.messageId,
                        payload_json: JSON.stringify(job.payload),
                        attempts: job.attempts,
                        status: job.status
                      };
                    }
                  }
                  return null;
                }
                if (sql.includes("SELECT * FROM admin_jobs WHERE id = ?")) {
                  return dbJobs.get(params[0]) || null;
                }
                return null;
              },
              all: async () => {
                if (sql.includes("SELECT * FROM blog_manual_drafts")) {
                  return { results: Array.from(dbDrafts.values()) };
                }
                return { results: [] };
              },
              run: async () => {
                if (sql.includes("INSERT INTO telegram_processed_updates")) {
                  return { success: true };
                }
                if (sql.includes("INSERT INTO blog_manual_drafts")) {
                  const [id, topic_tema, topic_angulo, title, tag, excerpt, content_json, brief_json, audit_json, word_count, status, created_by_user_id] = params;
                  const draftObj = {
                    id, topic_tema, topic_angulo, title, tag, excerpt,
                    content_json, brief_json, audit_json, word_count, status,
                    created_by_user_id,
                    created_at: new Date().toISOString()
                  };
                  dbDrafts.set(id, draftObj);
                  return { success: true, changes: 1 };
                }
                if (sql.includes("UPDATE blog_manual_drafts SET")) {
                  const draftId = params[params.length - 1];
                  const existing = dbDrafts.get(draftId) || {};
                  dbDrafts.set(draftId, { ...existing, status: params[0] });
                  return { success: true, changes: 1 };
                }
                if (sql.includes("INSERT INTO admin_pending_jobs")) {
                  const [id, jobType, userId, chatId, messageId, payloadStr] = params;
                  dbJobs.set(id, { id, jobType, userId, chatId, messageId, payload: JSON.parse(payloadStr), status: "queued", attempts: 1 });
                  return { success: true, changes: 1 };
                }
                if (sql.includes("UPDATE admin_pending_jobs")) {
                  if (sql.includes("SET status = 'completed'")) {
                    const jId = params[params.length - 2];
                    const existing = dbJobs.get(jId) || {};
                    existing.status = "completed";
                    dbJobs.set(jId, existing);
                    return { success: true, changes: 1 };
                  }
                  const jId = params[params.length - 1];
                  const existing = dbJobs.get(jId) || { id: jId, attempts: 1 };
                  existing.status = "processing";
                  existing.attempts = (existing.attempts || 0) + 1;
                  dbJobs.set(jId, existing);
                  return { success: true, changes: 1 };
                }
                if (sql.includes("INSERT INTO admin_audit_log")) {
                  auditLogs.push(params);
                  return { success: true };
                }
                return { success: true, changes: 1 };
              }
            };
          }
        };
      }
    }
  };

  return env;
}

function createTelegramRequest(payload, secret = "mock_webhook_secret") {
  return new Request("https://admin.canedostudio.com/telegram-webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Telegram-Bot-Api-Secret-Token": secret
    },
    body: JSON.stringify(payload)
  });
}

test("FASE D5: Integración de YouTube con Telegram y Flujo Editorial", async (t) => {
  const globalFetch = globalThis.fetch;

  t.afterEach(() => {
    globalThis.fetch = globalFetch;
  });

  await t.test("1. Menú Blog: Ofrece el botón '🎥 Crear desde YouTube'", async () => {
    const env = createMockEnv();
    const req = createTelegramRequest({
      update_id: 1001,
      callback_query: {
        id: "cb_1",
        from: { id: 12345, username: "luiscanedo" },
        message: { message_id: 10, chat: { id: 12345 } },
        data: "menu:blog"
      }
    });

    globalThis.fetch = async (url, options) => {
      if (url.includes("editMessageText")) {
        const body = JSON.parse(options.body);
        assert.ok(body.reply_markup.inline_keyboard.some(row => row.some(btn => btn.callback_data === "blog:yt:prompt")));
        return new Response(JSON.stringify({ ok: true, result: { message_id: 10 } }));
      }
      return new Response(JSON.stringify({ ok: true }));
    };

    const res = await worker.fetch(req, env);
    assert.equal(res.status, 200);
  });

  await t.test("2. Selección de 'blog:yt:prompt' establece estado awaiting_yt_url y solicita URL", async () => {
    const env = createMockEnv();
    const req = createTelegramRequest({
      update_id: 1002,
      callback_query: {
        id: "cb_2",
        from: { id: 12345, username: "luiscanedo" },
        message: { message_id: 10, chat: { id: 12345 } },
        data: "blog:yt:prompt"
      }
    });

    let messageSent = false;
    globalThis.fetch = async (url, options) => {
      if (url.includes("editMessageText")) {
        const body = JSON.parse(options.body);
        assert.ok(body.text.includes("CREAR ARTÍCULO DESDE YOUTUBE"));
        assert.ok(body.text.includes("enlace oficial del video"));
        messageSent = true;
        return new Response(JSON.stringify({ ok: true, result: { message_id: 10 } }));
      }
      return new Response(JSON.stringify({ ok: true }));
    };

    const res = await worker.fetch(req, env);
    assert.equal(res.status, 200);
    assert.ok(messageSent);

    const kvState = JSON.parse(await env.ADMIN_KV.get("user_state:12345"));
    assert.equal(kvState.action, "awaiting_yt_url");
  });

  await t.test("3. Recepción de URL válida: Ingesta metadatos oficiales y solicita contexto", async () => {
    const env = createMockEnv();
    await env.ADMIN_KV.put("user_state:12345", JSON.stringify({ action: "awaiting_yt_url" }));

    const req = createTelegramRequest({
      update_id: 1003,
      message: {
        message_id: 11,
        from: { id: 12345, username: "luiscanedo" },
        chat: { id: 12345 },
        text: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
      }
    });

    globalThis.fetch = async (url, options) => {
      if (url.includes("youtube.com/oembed")) {
        return new Response(JSON.stringify({
          title: "Video Tutorial de Automatización",
          author_name: "Canedo Tech",
          author_url: "https://www.youtube.com/@CanedoTech",
          thumbnail_url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (url.includes("sendMessage")) {
        const body = JSON.parse(options.body);
        assert.ok(body.text.includes("VIDEO IDENTIFICADO CON ÉXITO"));
        assert.ok(body.text.includes("Video Tutorial de Automatización"));
        assert.ok(body.text.includes("Canedo Tech"));
        assert.ok(body.text.includes("dQw4w9WgXcQ"));
        assert.ok(body.reply_markup.inline_keyboard.some(row => row.some(b => b.callback_data.includes("blog:yt:confirm:dQw4w9WgXcQ"))));
        return new Response(JSON.stringify({ ok: true, result: { message_id: 12 } }));
      }
      return new Response(JSON.stringify({ ok: true }));
    };

    const res = await worker.fetch(req, env);
    assert.equal(res.status, 200);

    const kvState = JSON.parse(await env.ADMIN_KV.get("user_state:12345"));
    assert.equal(kvState.action, "awaiting_yt_context");
    assert.equal(kvState.sourcePayload.videoId, "dQw4w9WgXcQ");
  });

  await t.test("4. Detección directa de URL de YouTube sin pasar previamente por el menú", async () => {
    const env = createMockEnv(); // No hay estado previo en KV

    const req = createTelegramRequest({
      update_id: 1004,
      message: {
        message_id: 13,
        from: { id: 12345, username: "luiscanedo" },
        chat: { id: 12345 },
        text: "Mira este video interesante https://youtu.be/dQw4w9WgXcQ para el blog"
      }
    });

    let detected = false;
    globalThis.fetch = async (url, options) => {
      if (url.includes("youtube.com/oembed")) {
        return new Response(JSON.stringify({
          title: "Video Tutorial Directo",
          author_name: "Canedo Tech",
          author_url: "https://www.youtube.com/@CanedoTech",
          thumbnail_url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (url.includes("sendMessage")) {
        const body = JSON.parse(options.body);
        assert.ok(body.text.includes("DETECCIÓN DE VIDEO DE YOUTUBE"));
        assert.ok(body.text.includes("Video Tutorial Directo"));
        detected = true;
        return new Response(JSON.stringify({ ok: true, result: { message_id: 14 } }));
      }
      return new Response(JSON.stringify({ ok: true }));
    };

    const res = await worker.fetch(req, env);
    assert.equal(res.status, 200);
    assert.ok(detected);

    const kvState = JSON.parse(await env.ADMIN_KV.get("user_state:12345"));
    assert.equal(kvState.action, "awaiting_yt_context");
    assert.equal(kvState.sourcePayload.videoId, "dQw4w9WgXcQ");
  });

  await t.test("5. Aporte de contexto: Exige mínimo 50 caracteres y ofrece opciones de enfoque editorial", async () => {
    const env = createMockEnv();
    const sourcePayload = {
      sourceType: "youtube",
      videoId: "dQw4w9WgXcQ",
      title: "Video Tutorial Directo",
      authorName: "Canedo Tech",
      canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    };

    await env.ADMIN_KV.put("user_state:12345", JSON.stringify({
      action: "awaiting_yt_context",
      sourcePayload
    }));

    // Intento con texto corto (< 50 caracteres)
    const reqShort = createTelegramRequest({
      update_id: 1005,
      message: {
        message_id: 15,
        from: { id: 12345, username: "luiscanedo" },
        chat: { id: 12345 },
        text: "Muy corto"
      }
    });

    let warningShown = false;
    globalThis.fetch = async (url, options) => {
      if (url.includes("sendMessage")) {
        const body = JSON.parse(options.body);
        if (body.text.includes("Contexto insuficiente")) {
          warningShown = true;
        }
        return new Response(JSON.stringify({ ok: true, result: { message_id: 16 } }));
      }
      return new Response(JSON.stringify({ ok: true }));
    };

    await worker.fetch(reqShort, env);
    assert.ok(warningShown);

    // Intento válido (>= 50 caracteres)
    const validNotes = "En este video se explica detalladamente la arquitectura de agentes inteligentes y su conexión con CRM para pequeñas empresas.";
    const reqValid = createTelegramRequest({
      update_id: 1006,
      message: {
        message_id: 17,
        from: { id: 12345, username: "luiscanedo" },
        chat: { id: 12345 },
        text: validNotes
      }
    });

    let angleMenuShown = false;
    globalThis.fetch = async (url, options) => {
      if (url.includes("sendMessage")) {
        const body = JSON.parse(options.body);
        if (body.text.includes("SELECCIÓN DE ENFOQUE EDITORIAL")) {
          assert.ok(body.reply_markup.inline_keyboard.some(row => row.some(b => b.callback_data.includes("blog:yt:angle:informativo"))));
          assert.ok(body.reply_markup.inline_keyboard.some(row => row.some(b => b.callback_data.includes("blog:yt:angle:comercial"))));
          assert.ok(body.reply_markup.inline_keyboard.some(row => row.some(b => b.callback_data.includes("blog:yt:angle:tecnico"))));
          angleMenuShown = true;
        }
        return new Response(JSON.stringify({ ok: true, result: { message_id: 18 } }));
      }
      return new Response(JSON.stringify({ ok: true }));
    };

    await worker.fetch(reqValid, env);
    assert.ok(angleMenuShown);

    const kvState = JSON.parse(await env.ADMIN_KV.get("user_state:12345"));
    assert.equal(kvState.action, "awaiting_yt_angle");
    assert.equal(kvState.sourcePayload.notes, validNotes);
  });

  await t.test("6. Selección de enfoque: Dispara generación con IA y crea borrador en D1", async () => {
    const env = createMockEnv();
    const sourcePayload = {
      sourceType: "youtube",
      videoId: "dQw4w9WgXcQ",
      title: "Video Tutorial de Automatización",
      authorName: "Canedo Tech",
      canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      notes: "En este video se explica detalladamente la arquitectura de agentes inteligentes y su conexión con CRM para pequeñas empresas.",
      transcript: "En este video se explica detalladamente la arquitectura de agentes inteligentes y su conexión con CRM para pequeñas empresas."
    };

    await env.ADMIN_KV.put("user_state:12345", JSON.stringify({
      action: "awaiting_yt_angle",
      sourcePayload
    }));

    const req = createTelegramRequest({
      update_id: 1007,
      callback_query: {
        id: "cb_3",
        from: { id: 12345, username: "luiscanedo" },
        message: { message_id: 20, chat: { id: 12345 } },
        data: "blog:yt:angle:comercial:dQw4w9WgXcQ"
      }
    });

    let draftGeneratedText = "";
    globalThis.fetch = async (url, options) => {
      if (url.includes("editMessageText")) {
        const body = JSON.parse(options.body);
        if (body.text.includes("BORRADOR DESDE YOUTUBE GENERADO CON ÉXITO")) {
          draftGeneratedText = body.text;
          assert.ok(body.reply_markup.inline_keyboard.some(row => row.some(b => b.callback_data.startsWith("draft:approve_only:"))));
          assert.ok(body.reply_markup.inline_keyboard.some(row => row.some(b => b.callback_data.startsWith("draft:read_full:"))));
          assert.ok(body.reply_markup.inline_keyboard.some(row => row.some(b => b.callback_data.startsWith("draft:regen_confirm:"))));
        }
        return new Response(JSON.stringify({ ok: true, result: { message_id: 20 } }));
      }
      return new Response(JSON.stringify({ ok: true }));
    };

    const res = await worker.fetch(req, env);
    assert.equal(res.status, 200);
    assert.ok(draftGeneratedText.includes("BORRADOR DESDE YOUTUBE GENERADO CON ÉXITO"));
    assert.ok(draftGeneratedText.includes("Canedo Tech"));

    // Comprobar que el borrador fue persistido en la base de datos D1
    assert.equal(env.BLOG_DB._drafts.size, 1);
    const draftInDb = Array.from(env.BLOG_DB._drafts.values())[0];
    assert.equal(draftInDb.status, "draft");
    assert.ok(draftInDb.content_json.includes("youtube_embed"));
  });

  await t.test("7. Seguridad y Autorización: Usuario no autorizado no puede ejecutar callbacks de YouTube", async () => {
    const env = createMockEnv({ allowedIds: "12345" });
    const req = createTelegramRequest({
      update_id: 1008,
      callback_query: {
        id: "cb_unauth",
        from: { id: 99999, username: "intruso" },
        message: { message_id: 25, chat: { id: 99999 } },
        data: "blog:yt:prompt"
      }
    });

    let accessDeniedMsg = false;
    globalThis.fetch = async (url, options) => {
      if (url.includes("sendMessage")) {
        const body = JSON.parse(options.body);
        if (body.text.includes("Acceso denegado")) {
          accessDeniedMsg = true;
        }
        return new Response(JSON.stringify({ ok: true }));
      }
      return new Response(JSON.stringify({ ok: true }));
    };

    const res = await worker.fetch(req, env);
    assert.equal(res.status, 200);
    assert.ok(accessDeniedMsg);
  });

  await t.test("8. Expiración de sesión: Callback con sesión inexistente en KV informa amablemente", async () => {
    const env = createMockEnv(); // KV vacío
    const req = createTelegramRequest({
      update_id: 1009,
      callback_query: {
        id: "cb_expired",
        from: { id: 12345, username: "luiscanedo" },
        message: { message_id: 26, chat: { id: 12345 } },
        data: "blog:yt:angle:informativo:dQw4w9WgXcQ"
      }
    });

    let expiredMsg = false;
    globalThis.fetch = async (url, options) => {
      if (url.includes("editMessageText")) {
        const body = JSON.parse(options.body);
        assert.ok(body.text.includes("sesión ha expirado"));
        expiredMsg = true;
        return new Response(JSON.stringify({ ok: true, result: { message_id: 26 } }));
      }
      return new Response(JSON.stringify({ ok: true }));
    };

    const res = await worker.fetch(req, env);
    assert.equal(res.status, 200);
    assert.ok(expiredMsg);
  });

  await t.test("9. Recuperación de jobs interrumpidos: Procesa jobType blog_generate_youtube_draft", async () => {
    const env = createMockEnv();
    const sourcePayload = {
      sourceType: "youtube",
      videoId: "dQw4w9WgXcQ",
      title: "Video Recuperado",
      authorName: "Canedo Tech",
      canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      notes: "Notas para recuperación de job interrumpido con contexto amplio.",
      transcript: "Transcripción autorizada para recuperación de job interrumpido con contexto amplio."
    };

    // Crear job pendiente en la mock DB
    env.BLOG_DB._jobs.set("job_yt_interrupted", {
      id: "job_yt_interrupted",
      jobType: "blog_generate_youtube_draft",
      userId: "12345",
      chatId: 12345,
      messageId: 30,
      payload: {
        sourcePayload,
        angle: "informativo",
        ip: "127.0.0.1",
        username: "luiscanedo"
      },
      status: "queued",
      attempts: 1
    });

    globalThis.fetch = async (url, options) => {
      return new Response(JSON.stringify({ ok: true, result: { message_id: 30 } }));
    };

    const initialDraftCount = env.BLOG_DB._drafts.size;
    // Simular llamada a endpoint de recuperación
    const recResult = await worker.recoverInterruptedJobs(env);
    assert.ok(recResult.processed >= 1);
    assert.equal(env.BLOG_DB._drafts.size, initialDraftCount + 1);
  });
});
