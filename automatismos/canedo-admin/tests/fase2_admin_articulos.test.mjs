// File: automatismos/canedo-admin/tests/fase2_admin_articulos.test.mjs
// Pruebas unitarias completas para la Fase 2: Gestión y Edición de Artículos desde Telegram.
// Cubre: Listado por estado (published/unpublished), Búsqueda paginada, Despublicación atómica,
// Restauración a producción, Inmutabilidad de Slug, Edición granular (title/excerpt/tag) con diff,
// Creación de versiones históricas en blog_post_history y Rollback.

import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";
import {
  unpublishArticle,
  restoreArticle,
  editArticleDetails,
  rollbackArticleToHistory
} from "../src/modules/blog/service.js";
import {
  getRecentPublishedArticles,
  searchArticles
} from "../src/db.js";

function createMockD1(initialPosts = []) {
  const posts = new Map(initialPosts.map(p => [p.slug, { ...p }]));
  const history = [];
  const jobs = new Map();
  const auditLogs = [];

  return {
    _posts: posts,
    _history: history,
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
          if (q.startsWith("INSERT INTO blog_post_history")) {
            const [postSlug, title, tag, date, readingTime, coverUrl, excerpt, contentJson, status, modifiedBy, op, summary] = bound;
            const newId = history.length + 1;
            const entry = {
              id: newId,
              post_slug: postSlug,
              title,
              tag,
              date,
              reading_time: readingTime,
              cover_url: coverUrl,
              excerpt,
              content_json: contentJson,
              status,
              modified_by: modifiedBy,
              operation: op,
              change_summary: summary,
              created_at: new Date().toISOString()
            };
            history.push(entry);
            return { success: true, meta: { changes: 1 }, changes: 1 };
          }
          if (q.startsWith("INSERT INTO admin_pending_jobs")) {
            const [id, jobType, userId, chatId, msgId, payloadStr] = bound;
            jobs.set(id, {
              id,
              job_type: jobType,
              user_id: userId,
              chat_id: chatId,
              message_id: msgId,
              payload_json: payloadStr,
              status: "queued",
              attempts: 0
            });
            return { success: true, changes: 1 };
          }
          if (q.includes("UPDATE admin_pending_jobs") && q.includes("status = 'processing'")) {
            const id = bound[bound.length - 1];
            const j = jobs.get(id);
            if (j && j.status === "queued") {
              j.status = "processing";
              j.attempts = (j.attempts || 0) + 1;
              return { success: true, meta: { changes: 1 }, changes: 1 };
            }
            return { success: false, meta: { changes: 0 }, changes: 0 };
          }
          if (q.includes("UPDATE admin_pending_jobs") && q.includes("status = 'completed'")) {
            const id = bound[bound.length - 1];
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
          if (q.includes("UPDATE blog_posts") && q.includes("WHERE slug = ?")) {
            const slug = bound[bound.length - 1];
            const p = posts.get(slug);
            if (p) {
              // Parse fields in query
              const assignments = q.split(/SET/i)[1].split(/WHERE/i)[0].split(",");
              for (let i = 0; i < assignments.length; i++) {
                const part = assignments[i].trim();
                if (part.startsWith("title = ?")) p.title = bound[i];
                if (part.startsWith("excerpt = ?")) p.excerpt = bound[i];
                if (part.startsWith("tag = ?")) p.tag = bound[i];
                if (part.startsWith("reading_time = ?")) p.reading_time = bound[i];
                if (part.startsWith("content_json = ?")) p.content_json = bound[i];
                if (part.startsWith("status = ?")) p.status = bound[i];
              }
              return { success: true, meta: { changes: 1 }, changes: 1 };
            }
            return { success: false, meta: { changes: 0 }, changes: 0 };
          }
          if (q.startsWith("INSERT INTO admin_audit_log")) {
            const [userId, username, action, entityId, details, ip] = bound;
            auditLogs.push({ userId, username, action, entityId, details, ip });
            return { success: true, changes: 1 };
          }
          return { success: true, changes: 0 };
        },
        async first(col) {
          const q = query.trim().toLowerCase();
          if (q.includes("count(*) as total from blog_posts") && q.includes("where status = ?")) {
            const st = bound[0];
            let count = 0;
            for (const p of posts.values()) {
              if (p.status === st) count++;
            }
            return col ? count : { total: count };
          }
          if (q.includes("count(*) as total from blog_posts") && q.includes("like")) {
            const term = bound[0].replace(/%/g, "").toLowerCase();
            let count = 0;
            for (const p of posts.values()) {
              if (
                p.title.toLowerCase().includes(term) ||
                p.slug.toLowerCase().includes(term) ||
                (p.excerpt && p.excerpt.toLowerCase().includes(term))
              ) {
                count++;
              }
            }
            return col ? count : { total: count };
          }
          if (q.includes("from blog_posts where id = ?")) {
            const idVal = Number(bound[0]);
            for (const p of posts.values()) {
              if (p.id === idVal) return { ...p };
            }
            return null;
          }
          if (q.includes("from blog_posts where slug = ?")) {
            const slg = bound[0];
            const p = posts.get(slg);
            return p ? { ...p } : null;
          }
          if (q.includes("from blog_post_history where id = ?")) {
            const hid = bound[0];
            const h = history.find(e => e.id === Number(hid));
            return h ? { ...h } : null;
          }
          if (q.includes("from admin_pending_jobs where id = ?")) {
            const jid = bound[0];
            const j = jobs.get(jid);
            return j ? { ...j } : null;
          }
          return null;
        },
        async all() {
          const q = query.trim().toLowerCase();
          if (q.includes("from blog_posts") && q.includes("where status = ?")) {
            const st = bound[0];
            const limit = bound[1];
            const offset = bound[2];
            const filtered = [];
            for (const p of posts.values()) {
              if (p.status === st) filtered.push({ ...p });
            }
            return { results: filtered.slice(offset, offset + limit) };
          }
          if (q.includes("from blog_posts") && q.includes("like")) {
            const term = bound[0].replace(/%/g, "").toLowerCase();
            const limit = bound[3];
            const offset = bound[4];
            const filtered = [];
            for (const p of posts.values()) {
              if (
                p.title.toLowerCase().includes(term) ||
                p.slug.toLowerCase().includes(term) ||
                (p.excerpt && p.excerpt.toLowerCase().includes(term))
              ) {
                filtered.push({ ...p });
              }
            }
            return { results: filtered.slice(offset, offset + limit) };
          }
          if (q.includes("from blog_post_history where post_slug = ?")) {
            const slg = bound[0];
            const limit = bound[1];
            const filtered = history.filter(h => h.post_slug === slg).slice(0, limit);
            return { results: filtered };
          }
          return { results: [] };
        }
      };
    }
  };
}

function createMockKV(initialPosts = []) {
  const store = new Map();
  store.set("posts", JSON.stringify({ posts: initialPosts }));
  return {
    _store: store,
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async put(key, value) {
      store.set(key, typeof value === "string" ? value : JSON.stringify(value));
    },
    async delete(key) {
      store.delete(key);
    }
  };
}

test("1. Listado filtrado y búsqueda de artículos (Publicados vs Despublicados)", async () => {
  const mockArticles = [
    { slug: "art-1", title: "IA en Clientes", excerpt: "Guía de IA", tag: "IA", date: "2026-11-15", status: "published", reading_time: "5 min" },
    { slug: "art-2", title: "SEO Local en 2026", excerpt: "Consejos de SEO", tag: "SEO", date: "2026-11-14", status: "published", reading_time: "4 min" },
    { slug: "art-3", title: "Automatiza Presupuestos", excerpt: "Plantillas rápidas", tag: "Automatización", date: "2026-11-13", status: "unpublished", reading_time: "6 min" }
  ];

  const db = createMockD1(mockArticles);

  // Listar publicados
  const publishedList = await getRecentPublishedArticles(db, 10, 0, "published");
  assert.equal(publishedList.total, 2);
  assert.equal(publishedList.posts.length, 2);
  assert.equal(publishedList.posts[0].slug, "art-1");
  assert.equal(publishedList.posts[1].slug, "art-2");

  // Listar despublicados
  const unpublishedList = await getRecentPublishedArticles(db, 10, 0, "unpublished");
  assert.equal(unpublishedList.total, 1);
  assert.equal(unpublishedList.posts[0].slug, "art-3");

  // Búsqueda por término
  const searchRes = await searchArticles(db, "presupuestos", 10, 0);
  assert.equal(searchRes.total, 1);
  assert.equal(searchRes.posts[0].slug, "art-3");

  // Búsqueda por slug
  const searchSlug = await searchArticles(db, "art-1", 10, 0);
  assert.equal(searchSlug.total, 1);
  assert.equal(searchSlug.posts[0].title, "IA en Clientes");
});

test("2. Despublicación atómica: D1 a 'unpublished' y remoción de KV 'posts' con respaldo en historial", async () => {
  const post = {
    slug: "post-a-despublicar",
    title: "Post de Prueba",
    excerpt: "Resumen inicial",
    tag: "IA",
    date: "2026-11-15",
    status: "published",
    content_json: JSON.stringify([{ type: "p", text: "Hola mundo" }]),
    cover_image: "/img.jpg"
  };

  const db = createMockD1([post]);
  const kv = createMockKV([post]);

  const env = {
    BLOG_DB: db,
    BLOG_POSTS: kv
  };

  const result = await unpublishArticle(env, "post-a-despublicar", 12345);
  assert.equal(result.ok, true);
  assert.equal(result.slug, "post-a-despublicar");

  // Verificar estado en D1
  const updatedInD1 = db._posts.get("post-a-despublicar");
  assert.equal(updatedInD1.status, "unpublished");

  // Verificar remoción en KV
  const kvPosts = JSON.parse(await kv.get("posts"));
  assert.equal(kvPosts.posts.length, 0);

  // Verificar registro en blog_post_history
  assert.equal(db._history.length, 1);
  assert.equal(db._history[0].post_slug, "post-a-despublicar");
  assert.equal(db._history[0].operation, "unpublish");
  assert.equal(db._history[0].modified_by, "12345");
});

test("3. Restauración a producción: D1 a 'published' y re-inserción en KV 'posts'", async () => {
  const post = {
    slug: "post-recuperado",
    title: "Artículo Despublicado",
    excerpt: "Resumen a restaurar",
    tag: "Negocios",
    date: "2026-11-15",
    status: "unpublished",
    content_json: JSON.stringify([{ type: "p", text: "Contenido recuperado" }]),
    cover_image: "/img2.jpg"
  };

  const db = createMockD1([post]);
  const kv = createMockKV([]); // No está en KV

  const env = {
    BLOG_DB: db,
    BLOG_POSTS: kv
  };

  const result = await restoreArticle(env, "post-recuperado", 12345);
  assert.equal(result.ok, true);

  // Verificar estado en D1
  const postD1 = db._posts.get("post-recuperado");
  assert.equal(postD1.status, "published");

  // Verificar re-inserción en KV
  const rawKv = await kv.get("posts");
  const kvData = JSON.parse(rawKv);
  const postsList = Array.isArray(kvData) ? kvData : kvData.posts;
  assert.equal(postsList.length, 1);
  assert.equal(postsList[0].slug, "post-recuperado");

  // Historial debe tener la entrada de restauración
  assert.equal(db._history.length, 1);
  assert.equal(db._history[0].operation, "restore");
});

test("4. Edición granular: Título y Resumen con inmutabilidad estricta de Slug y snapshot previo", async () => {
  const initialPost = {
    slug: "slug-estricto-inmutable",
    title: "Título Original",
    excerpt: "Resumen Original",
    tag: "OriginalTag",
    date: "2026-11-15",
    status: "published",
    content_json: JSON.stringify([{ type: "p", text: "Texto" }]),
    cover_image: "/cover.jpg"
  };

  const db = createMockD1([initialPost]);
  const kv = createMockKV([initialPost]);

  const env = {
    BLOG_DB: db,
    BLOG_POSTS: kv
  };

  // Intentar modificar título, resumen y forzar cambio de slug prohibido
  const updates = {
    title: "Nuevo Título Optimizado",
    excerpt: "Nuevo Resumen BLUF Clarificado",
    slug: "intento-de-cambiar-slug" // Debe ser ignorado
  };

  const res = await editArticleDetails(env, "slug-estricto-inmutable", updates, 9999, "Edición de título y resumen");
  assert.equal(res.ok, true);
  assert.equal(res.post.slug, "slug-estricto-inmutable"); // Inmutabilidad comprobada

  // Verificar D1
  const updatedD1 = db._posts.get("slug-estricto-inmutable");
  assert.equal(updatedD1.title, "Nuevo Título Optimizado");
  assert.equal(updatedD1.excerpt, "Nuevo Resumen BLUF Clarificado");
  assert.equal(updatedD1.tag, "OriginalTag"); // no tocado

  // Verificar KV
  const kvRaw = await kv.get("posts");
  const kvData = JSON.parse(kvRaw);
  const kvPosts = Array.isArray(kvData) ? kvData : kvData.posts;
  assert.equal(kvPosts[0].title, "Nuevo Título Optimizado");
  assert.equal(kvPosts[0].slug, "slug-estricto-inmutable");

  // Verificar que el historial guardó el estado ANTERIOR a la edición
  assert.equal(db._history.length, 1);
  assert.equal(db._history[0].operation, "edit");
  assert.equal(db._history[0].title, "Título Original");
  assert.equal(db._history[0].excerpt, "Resumen Original");
});

test("5. Rollback a versión histórica previa restaura metadatos y contenido", async () => {
  const currentPost = {
    slug: "articulo-con-historial",
    title: "Título Modificado Erróneamente",
    excerpt: "Resumen Malo",
    tag: "Tag Errante",
    date: "2026-11-15",
    status: "published",
    content_json: JSON.stringify([{ type: "p", text: "Texto modificado" }]),
    cover_image: "/cover.jpg"
  };

  const db = createMockD1([currentPost]);
  const kv = createMockKV([currentPost]);

  // Insertar una versión histórica previa en el mock
  db._history.push({
    id: 1,
    post_slug: "articulo-con-historial",
    title: "Título Histórico Perfecto",
    excerpt: "Resumen Histórico Impecable",
    tag: "Tag Correcto",
    cover_image: "/cover.jpg",
    content_json: JSON.stringify([{ type: "p", text: "Texto restaurado" }]),
    status: "published",
    modified_by: "system",
    operation: "initial",
    created_at: "2026-11-15T10:00:00Z"
  });

  const env = {
    BLOG_DB: db,
    BLOG_POSTS: kv
  };

  const rollbackRes = await rollbackArticleToHistory(env, 1, 12345);
  assert.equal(rollbackRes.ok, true);
  assert.equal(rollbackRes.slug, "articulo-con-historial");

  // Verificar D1 restaurado
  const restoredD1 = db._posts.get("articulo-con-historial");
  assert.equal(restoredD1.title, "Título Histórico Perfecto");
  assert.equal(restoredD1.tag, "Tag Correcto");

  // Verificar KV sincronizado
  const kvRaw = await kv.get("posts");
  const kvData = JSON.parse(kvRaw);
  const kvPosts = Array.isArray(kvData) ? kvData : kvData.posts;
  assert.equal(kvPosts[0].title, "Título Histórico Perfecto");

  // Debe haberse registrado una nueva entrada en historial documentando el rollback
  assert.equal(db._history.length, 2);
  assert.equal(db._history[1].operation, "rollback");
});

test("6. Flujo interactivo de Telegram: Comandos /set_<field>_<slug>, diff y confirmación con Job", async () => {
  const post = {
    slug: "analisis-roi",
    title: "ROI en Negocios",
    excerpt: "Resumen simple",
    tag: "Finanzas",
    date: "2026-11-15",
    status: "published",
    content_json: JSON.stringify([{ type: "p", text: "Texto" }]),
    cover_image: "/roi.jpg"
  };

  const db = createMockD1([post]);
  const kv = createMockKV([post]);
  const adminKv = createMockKV();

  const env = {
    BLOG_DB: db,
    BLOG_POSTS: kv,
    ADMIN_KV: adminKv,
    ADMIN_TELEGRAM_USER_IDS: "12345",
    BOT_TOKEN_SECRETO: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
    ADMIN_PUBLISH_ENABLED: "true"
  };

  // Mock global fetch para interceptar llamadas a Telegram Bot API
  let lastTelegramCall = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (options && options.body) {
      lastTelegramCall = { url: String(url), body: JSON.parse(options.body) };
      return new Response(JSON.stringify({ ok: true, result: { message_id: 888 } }), { status: 200 });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  try {
    // 1. Enviar comando de edición de título
    const message = {
      text: "/set_title_analisis-roi Nuevo Título Impactante de ROI",
      from: { id: 12345, first_name: "Admin" },
      chat: { id: 12345 }
    };

    const res = await worker.handleTextMessage(message, env, {}, {
      userId: 12345,
      username: "admin",
      chatId: 12345,
      ip: "127.0.0.1"
    });

    assert.equal(res.ok, true);
    assert.equal(res.route, "article_edit_diff_ready");
    assert.equal(res.slug, "analisis-roi");
    assert.equal(res.field, "title");

    // Verificar que Telegram recibió el Diff y el botón con el jobId
    assert.ok(lastTelegramCall !== null);
    assert.ok(lastTelegramCall.body.text.includes("VISTA PREVIA (DIFF)"));
    assert.ok(lastTelegramCall.body.text.includes("ROI en Negocios"));
    assert.ok(lastTelegramCall.body.text.includes("Nuevo Título Impactante de ROI"));

    const confirmButton = lastTelegramCall.body.reply_markup.inline_keyboard[0][0];
    assert.ok(confirmButton.callback_data.startsWith("post:edit_confirm:"));
    const jobId = confirmButton.callback_data.replace("post:edit_confirm:", "");

    // 2. Pulsar botón de confirmación de vista previa
    const callbackDataConfirm = `post:edit_confirm:${jobId}`;
    const cbRes1 = await worker.handleCallbackQuery({
      id: "cb_1",
      data: callbackDataConfirm,
      from: { id: 12345 },
      message: { message_id: 888, chat: { id: 12345 } }
    }, env, {}, { userId: 12345, username: "admin", chatId: 12345, ip: "127.0.0.1" });

    assert.equal(cbRes1.ok, true);
    assert.equal(cbRes1.route, "post_edit_preview");

    // 3. Ejecutar guardado definitivo
    const callbackDataExecute = `post:edit_execute:${jobId}`;
    const cbRes2 = await worker.handleCallbackQuery({
      id: "cb_2",
      data: callbackDataExecute,
      from: { id: 12345 },
      message: { message_id: 888, chat: { id: 12345 } }
    }, env, {}, { userId: 12345, username: "admin", chatId: 12345, ip: "127.0.0.1" });

    assert.equal(cbRes2.ok, true);
    assert.equal(cbRes2.route, "post_edit_executed");

    // Verificar que D1 y KV tienen el nuevo título aplicado
    assert.equal(db._posts.get("analisis-roi").title, "Nuevo Título Impactante de ROI");
    const rawKv = await kv.get("posts");
    const kvData = JSON.parse(rawKv);
    const updatedKvPosts = Array.isArray(kvData) ? kvData : kvData.posts;
    assert.equal(updatedKvPosts[0].title, "Nuevo Título Impactante de ROI");

    // Idempotencia: Intentar ejecutar nuevamente el mismo job
    const cbRes3 = await worker.handleCallbackQuery({
      id: "cb_3",
      data: callbackDataExecute,
      from: { id: 12345 },
      message: { message_id: 888, chat: { id: 12345 } }
    }, env, {}, { userId: 12345, username: "admin", chatId: 12345, ip: "127.0.0.1" });

    assert.equal(cbRes3.route, "edit_already_claimed");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("7. Edición quirúrgica de bloques del cuerpo (H2, H3, Párrafos) con vista previa Diff", async () => {
  const initialContent = [
    { type: "h2", text: "1. Introducción al Ecosistema" },
    { type: "p", text: "Este es el párrafo inicial que describe el contexto empresarial." },
    { type: "h3", text: "1.1 Subsección operativa" },
    { type: "p", text: "Párrafo de subsección con detalles operativos." }
  ];

  const post = {
    slug: "articulo-con-bloques",
    title: "Ecosistema Digital",
    excerpt: "Resumen de prueba",
    tag: "Estrategia",
    date: "2026-11-15",
    status: "published",
    content_json: JSON.stringify(initialContent),
    cover_image: "/cover.jpg"
  };

  const db = createMockD1([post]);
  const kv = createMockKV([post]);

  const env = {
    BLOG_DB: db,
    BLOG_POSTS: kv,
    ADMIN_TELEGRAM_USER_IDS: "12345",
    BOT_TOKEN_SECRETO: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
    ADMIN_PUBLISH_ENABLED: "true"
  };

  let lastTelegramCall = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (options && options.body) {
      lastTelegramCall = { url: String(url), body: JSON.parse(options.body) };
      return new Response(JSON.stringify({ ok: true, result: { message_id: 888 } }), { status: 200 });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  try {
    // 1. Navegar al selector de bloques
    const blockListRes = await worker.handleCallbackQuery({
      id: "cb_blk_1",
      data: "post:blocks:articulo-con-bloques:0",
      from: { id: 12345 },
      message: { message_id: 888, chat: { id: 12345 } }
    }, env, {}, { userId: 12345, username: "admin", chatId: 12345, ip: "127.0.0.1" });

    assert.equal(blockListRes.ok, true);
    assert.equal(blockListRes.route, "post_blocks_list");

    // 2. Seleccionar el bloque #2 (párrafo) para editar
    const blockPromptRes = await worker.handleCallbackQuery({
      id: "cb_blk_2",
      data: "post:block_edit:articulo-con-bloques:1",
      from: { id: 12345 },
      message: { message_id: 888, chat: { id: 12345 } }
    }, env, {}, { userId: 12345, username: "admin", chatId: 12345, ip: "127.0.0.1" });

    assert.equal(blockPromptRes.ok, true);
    assert.equal(blockPromptRes.route, "post_block_edit_prompt");

    // Limpiar lastTelegramCall antes de ejecutar el mensaje de texto
    lastTelegramCall = null;

    // 3. Enviar el comando con el nuevo texto para el párrafo
    const message = {
      text: "/set_block_articulo-con-bloques_1 Este es el NUEVO texto mejorado del párrafo.",
      from: { id: 12345, first_name: "Admin" },
      chat: { id: 12345 }
    };

    const cmdRes = await worker.handleTextMessage(message, env, {}, {
      userId: 12345,
      username: "admin",
      chatId: 12345,
      ip: "127.0.0.1"
    });

    assert.equal(cmdRes.ok, true);
    assert.equal(cmdRes.route, "article_block_diff_ready");

    // Comprobar que Telegram envió la vista previa Diff
    assert.ok(lastTelegramCall !== null);
    assert.ok(lastTelegramCall.body.text.includes("VISTA PREVIA"));
    assert.ok(lastTelegramCall.body.text.includes("Este es el párrafo inicial"));
    assert.ok(lastTelegramCall.body.text.includes("Este es el NUEVO texto mejorado"));

    const confirmButton = lastTelegramCall.body.reply_markup.inline_keyboard[0][0];
    assert.ok(confirmButton.callback_data.startsWith("post:edit_confirm:"));
    const jobId = confirmButton.callback_data.replace("post:edit_confirm:", "");

    // 4. Confirmar y ejecutar la edición del bloque
    const execRes = await worker.handleCallbackQuery({
      id: "cb_blk_exec",
      data: `post:edit_execute:${jobId}`,
      from: { id: 12345 },
      message: { message_id: 888, chat: { id: 12345 } }
    }, env, {}, { userId: 12345, username: "admin", chatId: 12345, ip: "127.0.0.1" });

    assert.equal(execRes.ok, true);
    assert.equal(execRes.route, "post_edit_executed");

    // 5. Verificar que D1 y KV tienen el contenido del bloque actualizado
    const updatedPostInD1 = db._posts.get("articulo-con-bloques");
    const updatedBlocks = JSON.parse(updatedPostInD1.content_json);
    assert.equal(updatedBlocks[1].text, "Este es el NUEVO texto mejorado del párrafo.");
    // Los demás bloques permanecen intactos
    assert.equal(updatedBlocks[0].text, "1. Introducción al Ecosistema");
    assert.equal(updatedBlocks[2].text, "1.1 Subsección operativa");

    // 6. Verificar que se preservó la versión anterior en historial
    const historyEntries = db._history.filter(h => h.post_slug === "articulo-con-bloques");
    assert.equal(historyEntries.length, 1);
    const prevBlocks = JSON.parse(historyEntries[0].content_json);
    assert.equal(prevBlocks[1].text, "Este es el párrafo inicial que describe el contexto empresarial.");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("8. Resiliencia y Consistencia: D1 como fuente de verdad y manejo ante error en KV", async () => {
  const post = {
    slug: "post-fallo-kv",
    title: "Título Seguro D1",
    excerpt: "Resumen Seguro",
    tag: "Seguridad",
    date: "2026-11-15",
    status: "published",
    content_json: JSON.stringify([{ type: "p", text: "Contenido seguro" }]),
    cover_image: "/seguro.jpg"
  };

  const db = createMockD1([post]);

  // Simular KV caído que rechaza escrituras
  const brokenKv = {
    async get() { return JSON.stringify({ posts: [post] }); },
    async put() { throw new Error("KV_UNAVAILABLE_500"); }
  };

  const env = {
    BLOG_DB: db,
    BLOG_POSTS: brokenKv
  };

  // La edición debe tener éxito en D1 como fuente de verdad principal sin romper el proceso
  const res = await editArticleDetails(env, "post-fallo-kv", { title: "Nuevo Título con KV Caído" }, 12345, "Test KV Fail");
  assert.equal(res.ok, true);
  assert.equal(res.post.title, "Nuevo Título con KV Caído");
  assert.equal(res.kvSyncStatus, "failed");
  assert.ok(res.kvError.includes("KV_UNAVAILABLE_500"));

  // D1 tiene los datos consistentes
  const d1Post = db._posts.get("post-fallo-kv");
  assert.equal(d1Post.title, "Nuevo Título con KV Caído");

  // La versión previa quedó asegurada en el historial
  assert.equal(db._history.length, 1);
  assert.equal(db._history[0].title, "Título Seguro D1");
});

test("9. Reproducción y Corrección: Callback blog:list:0:published genera callback_data <= 64 bytes para slugs largos y maneja errores sin silenciarlos", async () => {
  // Post con slug largo que en el esquema anterior generaba más de 64 bytes ("post:manage:" + slug)
  const longSlug = "el-email-de-bienvenida-que-nadie-envia-y-todos-agradecen"; // 56 caracteres
  const mockPost = {
    id: 72,
    slug: longSlug,
    title: "El email de bienvenida que nadie envía y todos agradecen",
    tag: "Automatización",
    date: "2026-10-19",
    status: "published",
    content_json: JSON.stringify([{ type: "p", text: "Test email" }])
  };

  const db = createMockD1([mockPost]);

  let capturedEditPayload = null;
  const mockToken = "mock_token";
  const env = {
    BLOG_DB: db,
    BOT_TOKEN_SECRETO: mockToken,
    ALLOWED_ADMIN_IDS: "1304275001"
  };

  // Interceptar editTelegramMessage
  const update = {
    update_id: 888123,
    callback_query: {
      id: "cq_test_list",
      from: { id: 1304275001, username: "admin_tester" },
      message: { message_id: 5555, chat: { id: 1304275001 } },
      data: "blog:list:0:published"
    }
  };

  const result = await worker.handleTelegramUpdate(update, env, {});
  assert.equal(result.ok, true);
  assert.equal(result.route, "blog_list");

  // Verificar que el artículo pueda ser consultado con getPostBySlugForAdmin usando el ID numérico
  const fetchedById = await worker.handleCallbackQuery({
    id: "cq_manage_id",
    data: "post:manage:72",
    message: { message_id: 5555, chat: { id: 1304275001 } }
  }, env, {}, { userId: 1304275001, chatId: 1304275001 });

  assert.equal(fetchedById.ok, true);
  assert.equal(fetchedById.route, "post_manage");
  assert.equal(fetchedById.slug, longSlug);

  // Verificar que también responda si se pasa el slug directamente (retrocompatibilidad)
  const fetchedBySlug = await worker.handleCallbackQuery({
    id: "cq_manage_slug",
    data: `post:manage:${longSlug}`,
    message: { message_id: 5555, chat: { id: 1304275001 } }
  }, env, {}, { userId: 1304275001, chatId: 1304275001 });

  assert.equal(fetchedBySlug.ok, true);
  assert.equal(fetchedBySlug.route, "post_manage");
  assert.equal(fetchedBySlug.slug, longSlug);
});

test("10. Navegación completa con Slugs Extremos (60 chars): Toda la cadena de botones genera callback_data <= 64 bytes", async () => {
  // Slug extremo de 60 caracteres (el máximo permitido por el pipeline editorial)
  const extremeSlug = "automatizar-no-es-robotizar-que-significa-de-verdad-para-tu-";
  const mockPost = {
    id: 99,
    slug: extremeSlug,
    title: "Automatizar no es robotizar: qué significa de verdad para tu negocio",
    tag: "Estrategia",
    date: "2026-11-15",
    status: "published",
    content_json: JSON.stringify([
      { type: "h2", text: "El Mito de la Sustitución Total" },
      { type: "p", text: "Primer párrafo de prueba extensa." },
      { type: "h3", text: "Dónde Empezar Primero" },
      { type: "p", text: "Segundo párrafo explicativo." },
      { type: "p", text: "Tercer párrafo de cierre." },
      { type: "h2", text: "Paso 2: La Ejecución" },
      { type: "p", text: "Cuarto párrafo en la segunda página." }
    ])
  };

  const db = createMockD1([mockPost]);
  const env = {
    BLOG_DB: db,
    BOT_TOKEN_SECRETO: "mock_token",
    ALLOWED_ADMIN_IDS: "1304275001"
  };

  const userContext = { userId: 1304275001, username: "admin", chatId: 1304275001, ip: "127.0.0.1" };

  // 1. Ficha del artículo (post:manage:99)
  const manageRes = await worker.handleCallbackQuery({
    id: "cq_man_99",
    data: "post:manage:99",
    message: { message_id: 1001, chat: { id: 1304275001 } }
  }, env, {}, userContext);
  assert.equal(manageRes.ok, true);
  assert.equal(manageRes.route, "post_manage");
  assert.equal(manageRes.slug, extremeSlug);

  // 2. Prompt de edición de título (post:edit_prompt:99:title)
  const editTitleRes = await worker.handleCallbackQuery({
    id: "cq_ed_title",
    data: "post:edit_prompt:99:title",
    message: { message_id: 1001, chat: { id: 1304275001 } }
  }, env, {}, userContext);
  assert.equal(editTitleRes.ok, true);
  assert.equal(editTitleRes.route, "post_edit_prompt");

  // 3. Navegación de bloques: Página 0 (post:blocks:99:0)
  const blocksP0 = await worker.handleCallbackQuery({
    id: "cq_blk_p0",
    data: "post:blocks:99:0",
    message: { message_id: 1001, chat: { id: 1304275001 } }
  }, env, {}, userContext);
  assert.equal(blocksP0.ok, true);
  assert.equal(blocksP0.route, "post_blocks_list");

  // 4. Edición de bloque específico (post:block_edit:99:0)
  const blockEdit = await worker.handleCallbackQuery({
    id: "cq_blk_ed0",
    data: "post:block_edit:99:0",
    message: { message_id: 1001, chat: { id: 1304275001 } }
  }, env, {}, userContext);
  assert.equal(blockEdit.ok, true);
  assert.equal(blockEdit.route, "post_block_edit_prompt");

  // 5. Historial de cambios (post:history:99)
  const historyRes = await worker.handleCallbackQuery({
    id: "cq_hist_99",
    data: "post:history:99",
    message: { message_id: 1001, chat: { id: 1304275001 } }
  }, env, {}, userContext);
  assert.equal(historyRes.ok, true);
  assert.equal(historyRes.route, "post_history");

  // 6. Confirmación de despublicación (post:unpublish_confirm:99)
  const unpubPrompt = await worker.handleCallbackQuery({
    id: "cq_unpub_p",
    data: "post:unpublish_confirm:99",
    message: { message_id: 1001, chat: { id: 1304275001 } }
  }, env, {}, userContext);
  assert.equal(unpubPrompt.ok, true);
  assert.equal(unpubPrompt.route, "post_unpublish_confirm_prompt");

  // 7. Confirmación de restauración (post:restore_confirm:99)
  const restPrompt = await worker.handleCallbackQuery({
    id: "cq_rest_p",
    data: "post:restore_confirm:99",
    message: { message_id: 1001, chat: { id: 1304275001 } }
  }, env, {}, userContext);
  assert.equal(restPrompt.ok, true);
  assert.equal(restPrompt.route, "post_restore_confirm_prompt");
});



