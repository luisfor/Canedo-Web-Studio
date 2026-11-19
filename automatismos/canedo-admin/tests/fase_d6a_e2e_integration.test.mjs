// File: automatismos/canedo-admin/tests/fase_d6a_e2e_integration.test.mjs
// Prueba de integración E2E completa:
// Telegram -> YouTube Ingestion -> Context -> Angle -> Workers AI -> Quality Gate -> Draft D1 ->
// Approval Flow -> Production Publish D1/KV -> SSR Pages Renderer.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import worker from "../src/index.js";
import { approveDraftOnly, publishApprovedDraft } from "../src/modules/blog/service.js";

// Loader helper para importar Cloudflare Pages Functions que usan ESM
async function loadPagesFunction(relPath) {
  const absPath = path.resolve(relPath);
  const content = fs.readFileSync(absPath, "utf8");
  const transformed = content.replace(/from\s+['\"](\.\.?\/[^'\"]+)['\"]/g, (match, rel) => {
    const resolved = path.resolve(path.dirname(absPath), rel);
    return `from "file://${resolved}"`;
  });
  const dataUri = "data:text/javascript;base64," + Buffer.from(transformed).toString("base64");
  return import(dataUri);
}

const { onRequest } = await loadPagesFunction("cazas/canedostudio.com/functions/insights/[slug].js");

function createMockE2EEnvironment() {
  const kvStore = new Map();
  const dbDrafts = new Map();
  const dbPosts = new Map();
  const dbJobs = new Map();
  const auditLogs = [];

  const env = {
    ALLOWED_ADMIN_IDS: "12345",
    BOT_TOKEN_SECRETO: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
    ADMIN_PUBLISH_ENABLED: "true",
    APP_ENV: "production",
    SITE_URL: "https://canedostudio.com",
    AI: {
      run: async (model, params) => {
        const paragraph = "En el ecosistema tecnológico contemporáneo, optimizar procesos manuales mediante inteligencia artificial es una ventaja decisiva para empresas locales. La agencia Canedo Studio implementa soluciones escalables que resuelven cuellos de botella con seguridad y rigor arquitectónico. ";
        const p4 = paragraph.repeat(4);
        return {
          response: `## 1. Contexto y Oportunidades del Negocio\n${p4}\n\n## 2. Metodología de Implementación\nEn esta guía el canal Canedo Tech explica la integración paso a paso de los componentes serverless.\n${p4}\n\n## 3. Conclusión y Plan de Acción\n${p4}`
        };
      }
    },
    ADMIN_KV: {
      get: async (k) => kvStore.get(k) || null,
      put: async (k, v, opts) => kvStore.set(k, v),
      delete: async (k) => kvStore.delete(k),
      _store: kvStore
    },
    BLOG_POSTS: {
      get: async (k) => kvStore.get(k) || null,
      put: async (k, v) => kvStore.set(k, v),
      delete: async (k) => kvStore.delete(k)
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
                  for (const p of dbPosts.values()) {
                    if (JSON.stringify(p).includes(params[0])) return p;
                  }
                  return null;
                }
                if (sql.includes("SELECT * FROM blog_manual_drafts WHERE id = ?")) {
                  return dbDrafts.get(params[0]) || null;
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
                if (sql.includes("UPDATE blog_manual_drafts")) {
                  const draftId = params[1] || params[params.length - 1];
                  const existing = dbDrafts.get(draftId) || {};
                  if (sql.includes("status = 'approved'")) {
                    existing.status = "approved";
                  } else if (sql.includes("status = 'published'")) {
                    existing.status = "published";
                  } else if (sql.includes("status = ?")) {
                    existing.status = params[0];
                  }
                  dbDrafts.set(draftId, existing);
                  return { success: true, changes: 1 };
                }
                if (sql.includes("INSERT INTO admin_pending_jobs")) {
                  const [id, jobType, userId, chatId, messageId, payloadStr] = params;
                  dbJobs.set(id, { id, jobType, userId, chatId, messageId, payload: JSON.parse(payloadStr), status: "queued", attempts: 1 });
                  return { success: true, changes: 1 };
                }
                if (sql.includes("UPDATE admin_pending_jobs")) {
                  const jId = params[params.length - 1];
                  const existing = dbJobs.get(jId) || { id: jId, attempts: 1 };
                  existing.status = "processing";
                  existing.attempts = (existing.attempts || 0) + 1;
                  dbJobs.set(jId, existing);
                  return { success: true, changes: 1 };
                }
                if (sql.includes("INSERT INTO blog_posts")) {
                  // [slug, title, tag, date, readingTime, cover, excerpt, content, status]
                  const [slug, title, tag, date, readingTime, cover, excerpt, content, status] = params;
                  const postObj = {
                    id: dbPosts.size + 1,
                    slug, title, tag, date,
                    reading_time: readingTime,
                    cover, excerpt,
                    content: typeof content === "string" ? JSON.parse(content) : content,
                    content_json: typeof content === "string" ? content : JSON.stringify(content),
                    status: status || "published"
                  };
                  dbPosts.set(slug, postObj);
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

test("FASE D6A: Validación E2E Integral: YouTube Ingestion -> AI Editorial -> D1/KV Publish -> Pages SSR", async (t) => {
  const globalFetch = globalThis.fetch;

  t.afterEach(() => {
    globalThis.fetch = globalFetch;
  });

  await t.test("Recorrido Completo: Recepción YouTube -> Aprobación -> Publicación -> SSR seguro", async () => {
    const env = createMockE2EEnvironment();

    // 1. Iniciar conversación enviando URL de YouTube
    const update1 = {
      update_id: 2001,
      message: {
        message_id: 101,
        from: { id: 12345, username: "luis" },
        chat: { id: 12345 },
        text: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
      }
    };

    globalThis.fetch = async (url, options) => {
      if (url.includes("youtube.com/oembed")) {
        return new Response(JSON.stringify({
          title: "Automatización de Negocios con Agentes IA",
          author_name: "Canedo Tech",
          author_url: "https://www.youtube.com/@CanedoTech",
          thumbnail_url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      return new Response(JSON.stringify({ ok: true, result: { message_id: 102 } }));
    };

    const res1 = await worker.handleTelegramUpdate(update1, env, {}, "127.0.0.1");
    assert.equal(res1.ok, true);
    assert.equal(res1.route, "yt_video_detected_direct");
    assert.equal(res1.videoId, "dQw4w9WgXcQ");

    // 2. Administrador aporta notas/transcripción sustantiva
    const update2 = {
      update_id: 2002,
      message: {
        message_id: 103,
        from: { id: 12345, username: "luis" },
        chat: { id: 12345 },
        text: "En este video se presenta la arquitectura para digitalizar agendamiento y cotizaciones en pymes locales."
      }
    };

    const res2 = await worker.handleTelegramUpdate(update2, env, {}, "127.0.0.1");
    assert.equal(res2.ok, true);
    assert.equal(res2.route, "yt_angle_selection");

    // 3. Administrador selecciona el ángulo comercial
    const update3 = {
      update_id: 2003,
      callback_query: {
        id: "cq_2003",
        from: { id: 12345, username: "luis" },
        message: { message_id: 104, chat: { id: 12345 } },
        data: "blog:yt:angle:comercial:dQw4w9WgXcQ"
      }
    };

    const res3 = await worker.handleTelegramUpdate(update3, env, {}, "127.0.0.1");
    assert.equal(res3.ok, true);
    assert.equal(res3.route, "blog_yt_generation_dispatched");

    // Comprobar que se creó el borrador en D1
    assert.equal(env.BLOG_DB._drafts.size, 1);
    const draft = Array.from(env.BLOG_DB._drafts.values())[0];
    assert.equal(draft.status, "draft");
    assert.equal(draft.topic_angulo, "comercial");
    assert.ok(draft.content_json.includes("youtube_embed"));
    assert.ok(draft.content_json.includes("dQw4w9WgXcQ"));
    assert.ok(draft.brief_json.includes("Canedo Tech"));

    // 4. Aprobación del borrador mediante el flujo editorial oficial
    const approvedDraft = await approveDraftOnly(env, draft.id, "12345");
    assert.equal(approvedDraft.status, "approved");

    // 5. Publicación formal del borrador aprobado (persistencia dual D1 y KV)
    // Simular generador Flux AI de portada para la publicación
    globalThis.fetch = async (url) => {
      return new Response(JSON.stringify({ ok: true, result: { message_id: 105 } }));
    };

    const publishResult = await publishApprovedDraft(env, draft.id, "12345");
    assert.ok(publishResult.slug);
    assert.ok(publishResult.post);

    // Comprobar que D1 blog_posts y KV 'posts' contienen el bloque youtube_embed intacto
    const publishedPost = env.BLOG_DB._posts.get(publishResult.slug);
    assert.ok(publishedPost);
    assert.equal(publishedPost.status, "published");

    // En D1 V2 el contenido reside en publishedPost.content.blocks (objeto enriquecido) o publishedPost.content (array)
    const blocksArray = Array.isArray(publishedPost.content)
      ? publishedPost.content
      : (publishedPost.content?.blocks || []);

    const ytBlockD1 = blocksArray.find(b => b.type === "youtube_embed");
    assert.ok(ytBlockD1);
    assert.equal(ytBlockD1.videoId, "dQw4w9WgXcQ");

    const kvManifestRaw = await env.BLOG_POSTS.get("posts");
    assert.ok(kvManifestRaw);
    assert.ok(kvManifestRaw.includes(publishResult.slug));

    // 6. Validación de Renderizado SSR en Cloudflare Pages (/insights/[slug])
    const ssrContext = {
      request: new Request(`https://canedostudio.com/insights/${publishResult.slug}`, {
        headers: { "Accept": "text/html" }
      }),
      env: {
        BLOG_DB: env.BLOG_DB,
        BLOG_POSTS: env.BLOG_POSTS
      },
      params: { slug: publishResult.slug },
      waitUntil: () => {},
      next: async () => new Response("Not Found", { status: 404 })
    };

    const ssrResponse = await onRequest(ssrContext);
    assert.equal(ssrResponse.status, 200);
    const html = await ssrResponse.text();

    // Verificaciones de renderizado seguro
    assert.ok(html.includes('class="video-responsive-16-9"'));
    assert.ok(html.includes('src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"'));
    assert.ok(html.includes('loading="lazy"'));
    assert.ok(html.includes('referrerpolicy="strict-origin-when-cross-origin"'));
    assert.ok(html.includes('allowfullscreen'));
    assert.ok(html.includes('Canedo Tech'));
    assert.ok(html.includes('rel="noopener noreferrer nofollow"'));

    // Verificación de Schema.org JSON-LD VideoObject
    assert.ok(html.includes('"@type": "VideoObject"'));
    assert.ok(html.includes('"embedUrl": "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"'));
    assert.ok(html.includes('"thumbnailUrl": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"'));
    assert.ok(html.includes('"@type": "BlogPosting"'));
  });
});
