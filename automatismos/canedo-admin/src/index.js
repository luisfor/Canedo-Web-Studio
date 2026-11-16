// File: automatismos/canedo-admin/src/index.js
// Worker central de administración "Canedo Admin Unificado" para Telegram

import { sendTelegramMessage, editTelegramMessage, answerCallbackQuery, escapeHtml } from "./telegram.js";
import {
  logAdminAction,
  getRecentPublishedArticles,
  getDraftById,
  listDraftsByUser,
  recordTelegramUpdate,
  createJob,
  claimSpecificJob,
  renewJobLock,
  claimNextJob,
  markJobCompleted,
  markJobFailed,
  getJobById,
  getJobEvents,
  searchArticles,
  getPostBySlugForAdmin,
  getPostHistory,
  getPostHistoryById
} from "./db.js";
import {
  generateManualDraft,
  modifyDraftWithInstructions,
  regenerateDraft,
  approveDraftOnly,
  publishApprovedDraft,
  discardDraft,
  unpublishArticle,
  restoreArticle,
  editArticleDetails,
  rollbackArticleToHistory
} from "./modules/blog/service.js";

function isAuthorizedUser(userId, env) {
  if (!userId) return false;
  const rawList = env.ALLOWED_ADMIN_IDS || "";
  const allowed = rawList.split(",").map((s) => s.trim()).filter(Boolean);
  return allowed.includes(String(userId));
}

function renderMainMenu() {
  const text = `<b>🏛️ CANEDO STUDIO — PANEL UNIFICADO</b>\n\nBienvenido al centro de administración. Selecciona un módulo de gestión:`;
  const replyMarkup = {
    inline_keyboard: [
      [
        { text: "📝 1. Blog y Artículos", callback_data: "menu:blog" },
        { text: "📱 2. Redes Sociales", callback_data: "menu:social" }
      ],
      [
        { text: "👥 3. Contactos y CRM", callback_data: "menu:crm" },
        { text: "🎯 4. Prospector IA", callback_data: "menu:prospector" }
      ],
      [
        { text: "🤖 5. Chatbots IA", callback_data: "menu:chatbots" },
        { text: "💼 6. Servicios y Precios", callback_data: "menu:servicios" }
      ],
      [
        { text: "📊 7. Monitor y Alertas", callback_data: "menu:monitor" },
        { text: "⚙️ 8. Configuración", callback_data: "menu:config" }
      ]
    ]
  };
  return { text, replyMarkup };
}

function renderBlogMenu(stateData = null) {
  const lastPublished = stateData?.lastPublishedAt ? new Date(stateData.lastPublishedAt).toISOString().replace("T", " ").slice(0, 16) : "N/D";
  const text = `<b>📝 GESTIÓN EDITORIAL — BLOG DE INSIGHTS</b>\n\n` +
    `• <b>D1 Canónico:</b> Permanente e intacto\n` +
    `• <b>Última publicación:</b> <code>${lastPublished} UTC</code>\n` +
    `• <b>Quality Gate:</b> Fase 6L (650–900 palabras reales, cero repetición)\n` +
    `• <b>Próximo cron:</b> 17:00 COL (22:00 UTC)\n\n` +
    `Elige una acción:`;

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: "✍️ Crear Artículo con IA", callback_data: "blog:create_prompt" },
        { text: "📂 Mis Borradores", callback_data: "blog:drafts:0" }
      ],
      [
        { text: "📄 Publicados", callback_data: "blog:list:0:published" },
        { text: "📦 Despublicados", callback_data: "blog:list:0:unpublished" }
      ],
      [
        { text: "🔍 Buscar Artículo", callback_data: "blog:search_prompt" }
      ],
      [
        { text: "🔙 Volver al Menú Principal", callback_data: "menu:main" }
      ]
    ]
  };
  return { text, replyMarkup };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. Healthcheck básico
    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok", app: "canedo-admin", version: "1.0.0" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 1.1 Endpoint de recuperación / reintento de jobs interrumpidos
    if (url.pathname === "/api/jobs/recover") {
      if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
      
      // Requiere OBLIGATORIAMENTE RECOVER_JOBS_SECRET exclusivo. No se permite fallback a WEBHOOK_SECRET_TOKEN.
      const requiredSecret = env.RECOVER_JOBS_SECRET;
      if (!requiredSecret) {
        return new Response(JSON.stringify({ error: "Endpoint deshabilitado: RECOVER_JOBS_SECRET no configurado" }), {
          status: 403,
          headers: { "Content-Type": "application/json" }
        });
      }

      const secretHeader = request.headers.get("X-Recover-Jobs-Secret") || request.headers.get("Authorization");
      if (secretHeader !== requiredSecret && secretHeader !== `Bearer ${requiredSecret}`) {
        return new Response("Unauthorized", { status: 401 });
      }
      const recovered = await this.recoverInterruptedJobs(env);
      return new Response(JSON.stringify({ status: "ok", recovered }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 2. Webhook seguro de Telegram
    if (url.pathname === "/telegram-webhook") {
      if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
      }

      // Validar secreto de cabecera de Telegram si está configurado
      const secretHeader = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
      if (env.WEBHOOK_SECRET_TOKEN && secretHeader !== env.WEBHOOK_SECRET_TOKEN) {
        return new Response("Unauthorized webhook secret", { status: 401 });
      }

      let update;
      try {
        update = await request.json();
      } catch {
        return new Response("Invalid JSON payload", { status: 400 });
      }

      // Despachar el procesamiento del update
      const result = await this.handleTelegramUpdate(update, env, ctx, request);
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response("Not found", { status: 404 });
  },

  async handleTelegramUpdate(update, env, ctx, request = null) {
    if (!update) return { ok: false, error: "Empty update" };

    const updateId = update.update_id;

    // 1. Idempotencia en D1 (Restricción UNIQUE atómica anti-duplicados)
    if (env.BLOG_DB && updateId) {
      const isNew = await recordTelegramUpdate(env.BLOG_DB, updateId);
      if (!isNew) {
        return { ok: true, skipped: "duplicate_update", updateId, engine: "d1" };
      }
    }

    // 2. Idempotencia complementaria en KV (Fast edge cache)
    if (env.ADMIN_KV && updateId) {
      const seen = await env.ADMIN_KV.get(`tg:update:${updateId}`);
      if (seen && !env.BLOG_DB) {
        return { ok: true, skipped: "duplicate_update", updateId, engine: "kv" };
      }
      await env.ADMIN_KV.put(`tg:update:${updateId}`, "1", { expirationTtl: 300 });
    }

    // Determinar remitente (mensaje directo o callback query)
    const fromUser = update.message?.from || update.callback_query?.from;
    const userId = fromUser?.id;
    const username = fromUser?.username || "";
    const chatId = update.message?.chat?.id || update.callback_query?.message?.chat?.id;

    if (!isAuthorizedUser(userId, env)) {
      if (chatId && env.BOT_TOKEN_SECRETO) {
        await sendTelegramMessage(env.BOT_TOKEN_SECRETO, chatId, "⛔ Acceso denegado. Este bot es de uso exclusivo para administradores de Canedo Studio.");
      }
      return { ok: false, error: "Unauthorized user", userId };
    }

    const ip = request?.headers?.get("CF-Connecting-IP") || "local";

    // 1. Manejo de Callback Queries (Interacciones con botones inline)
    if (update.callback_query) {
      return await this.handleCallbackQuery(update.callback_query, env, ctx, { userId, username, chatId, ip });
    }

    // 2. Manejo de Mensajes de Texto
    if (update.message?.text) {
      return await this.handleTextMessage(update.message, env, ctx, { userId, username, chatId, ip });
    }

    return { ok: true, ignored: "unsupported_event" };
  },

  async handleCallbackQuery(cq, env, ctx, { userId, username, chatId, ip }) {
    const data = cq.data || "";
    const msgId = cq.message?.message_id;
    const token = env.BOT_TOKEN_SECRETO;

    // Blog: Consulta en tiempo real del estado de un Job (Solo lectura, CERO Workers AI)
    if (data.startsWith("job:status:")) {
      const targetJobId = data.replace("job:status:", "");
      if (!env.BLOG_DB) {
        await answerCallbackQuery(token, cq.id, "Base de datos no disponible", true);
        return { ok: false, error: "No DB" };
      }

      const job = await getJobById(env.BLOG_DB, targetJobId);
      if (!job) {
        await answerCallbackQuery(token, cq.id, "Trabajo no encontrado o expirado", true);
        return { ok: false, error: "Job not found" };
      }

      // Restricción de seguridad: Solo el usuario que inició el job puede consultarlo
      if (String(job.user_id) !== String(userId)) {
        await answerCallbackQuery(token, cq.id, "No autorizado para consultar este trabajo", true);
        return { ok: false, error: "Unauthorized" };
      }

      const stageLabels = {
        received: "📥 Solicitud recibida",
        queued: "⏳ En cola de espera",
        brief_generating: "🧠 Creando Brief Estratégico",
        brief_completed: "📋 Brief completado",
        section_generating: "✍️ Redactando secciones",
        section_completed: "📊 Secciones redactadas",
        expanding: "🔍 Ampliando sección quirúrgicamente",
        condensing: "✂️ Condensando sección quirúrgicamente",
        semantic_auditing: "🧐 Auditoría semántica con IA",
        quality_gate: "✅ Quality Gate superado",
        quality_gate_retry: "⚠️ Ajustando Quality Gate",
        draft_saving: "💾 Guardando borrador en base de datos",
        completed: "🎉 Borrador listo",
        failed: "❌ Falló el procesamiento"
      };

      const stageDisplay = stageLabels[job.current_stage] || job.current_stage || "Procesando";
      let statusSummary = `Estado: ${job.status.toUpperCase()}\nEtapa: ${stageDisplay}`;
      if (job.word_count > 0) {
        statusSummary += `\nPalabras: ${job.word_count}`;
      }
      statusSummary += `\nIntento: ${job.attempts}/3\nActualizado: ${job.updated_at || job.stage_updated_at || "Reciente"}`;

      if (job.status === "failed" && job.error_message) {
        statusSummary += `\n\nMotivo del fallo:\n${job.error_message.slice(0, 150)}`;
      }

      // Responder callback popup una sola vez
      await answerCallbackQuery(token, cq.id, statusSummary, true);

      // Si el trabajo ya está completado y tiene un draftId asociado, actualizar el mensaje en el chat con la ficha completa del borrador
      if (job.status === "completed" && job.result_json) {
        try {
          const resObj = JSON.parse(job.result_json);
          if (resObj?.draftId) {
            const draft = await getDraftById(env.BLOG_DB, resObj.draftId);
            if (draft) {
              const publishEnabled = String(env.ADMIN_PUBLISH_ENABLED).toLowerCase() === "true";
              const actionButtons = [];
              if (draft.status === "draft") {
                actionButtons.push({ text: "✅ Aprobar Borrador", callback_data: `draft:approve_only:${draft.id}` });
              }
              if (publishEnabled && draft.status === "approved") {
                actionButtons.push({ text: "🚀 Publicar Artículo", callback_data: `draft:publish_confirm:${draft.id}` });
              }
              actionButtons.push({ text: "🗑️ Descartar", callback_data: `draft:discard:${draft.id}` });

              const previewText = `<b>📋 BORRADOR EDITORIAL GENERADO CON ÉXITO</b>\n\n` +
                `• <b>Título:</b> ${escapeHtml(draft.title)}\n` +
                `• <b>Categoría:</b> ${draft.tag}\n` +
                `• <b>Extensión real:</b> ${draft.wordCount} palabras\n` +
                `• <b>Estado:</b> <code>${draft.status}</code>\n` +
                `• <b>Quality Gate:</b> Aprobado ✅\n\n` +
                `<b>Resumen BLUF:</b>\n<i>${escapeHtml(draft.excerpt)}</i>\n\n` +
                `<i>Estado de publicación: ${publishEnabled ? "🟢 Habilitada" : "🔒 Deshabilitada (ADMIN_PUBLISH_ENABLED=false)"}</i>`;

              const replyMarkup = {
                inline_keyboard: [
                  actionButtons,
                  [
                    { text: "📖 Leer Completo", callback_data: `draft:read_full:${draft.id}` },
                    { text: "✏️ Modificar", callback_data: `draft:modify_prompt:${draft.id}` }
                  ],
                  [{ text: "🔙 Volver al Menú", callback_data: "menu:blog" }]
                ]
              };
              await editTelegramMessage(token, chatId, msgId, previewText, { replyMarkup }).catch(() => null);
            }
          }
        } catch (_) {}
      }

      return { ok: true, route: "job_status_checked", targetJobId, status: job.status, stage: job.current_stage };
    }

    // Para el resto de callbacks, emitir answerCallbackQuery genérico para apagar el reloj
    await answerCallbackQuery(token, cq.id);

    // Navegación: Módulo Blog
    if (data === "menu:blog") {
      let stateData = null;
      if (env.ADMIN_KV) {
        try {
          stateData = JSON.parse(await env.ADMIN_KV.get("state") || "{}");
        } catch {}
      }
      const blogMenu = renderBlogMenu(stateData);
      await editTelegramMessage(token, chatId, msgId, blogMenu.text, { replyMarkup: blogMenu.replyMarkup });
      return { ok: true, route: "blog_menu" };
    }

    // Módulos en construcción (2 al 8)
    if (data.startsWith("menu:") && data !== "menu:main") {
      const modName = data.replace("menu:", "").toUpperCase();
      const text = `<b>🚧 MÓDULO EN CONSTRUCCIÓN: ${modName}</b>\n\nEste módulo se habilitará en las siguientes fases del plan unificado.`;
      const replyMarkup = {
        inline_keyboard: [[{ text: "🔙 Volver al Menú Principal", callback_data: "menu:main" }]]
      };
      await editTelegramMessage(token, chatId, msgId, text, { replyMarkup });
      return { ok: true, route: "module_stub", module: modName };
    }

    // Blog: Listar artículos paginados (publicados o despublicados)
    if (data.startsWith("blog:list:")) {
      try {
        const parts = data.replace("blog:list:", "").split(":");
        const offset = parseInt(parts[0] || "0", 10);
        const statusFilter = parts[1] || "published";

        const res = await getRecentPublishedArticles(env.BLOG_DB, 5, offset, statusFilter);
        const isPublished = statusFilter === "published";
        const headerTitle = isPublished ? "📄 ARTÍCULOS PUBLICADOS" : "📦 ARTÍCULOS DESPUBLICADOS";
        let text = `<b>${headerTitle} (Total: ${res.total})</b>\n\n`;

        if (res.posts.length === 0) {
          text += `<i>No hay artículos ${isPublished ? "publicados" : "despublicados"} registrados.</i>\n\n`;
        } else {
          res.posts.forEach((p, i) => {
            text += `<b>${offset + i + 1}.</b> ${escapeHtml(p.title)}\n`;
            text += `   🏷️ <i>${p.tag}</i> · 📅 ${p.date} · Estado: <code>${p.status}</code>\n`;
            text += `   🆔 Slug: <code>${p.slug}</code>\n`;
            if (isPublished) {
              text += `   🔗 https://canedostudio.com/insights/${p.slug}\n\n`;
            } else {
              text += `   <i>(No visible públicamente)</i>\n\n`;
            }
          });
        }

        const inline_keyboard = [];
        // Fila de acciones por artículo del listado (usa ID para cumplir límite estricto de 64 bytes de Telegram)
        res.posts.forEach((p, i) => {
          const itemNum = offset + i + 1;
          const shortTitle = p.title.length > 25 ? p.title.slice(0, 25) + "…" : p.title;
          const ref = p.id || p.slug;
          inline_keyboard.push([
            { text: `👁️ Ver #${itemNum} (${shortTitle})`, callback_data: `post:manage:${ref}` }
          ]);
        });

        const navButtons = [];
        if (offset >= 5) {
          navButtons.push({ text: "⬅️ Anteriores", callback_data: `blog:list:${offset - 5}:${statusFilter}` });
        }
        if (offset + 5 < res.total) {
          navButtons.push({ text: "Siguientes ➡️", callback_data: `blog:list:${offset + 5}:${statusFilter}` });
        }
        if (navButtons.length > 0) inline_keyboard.push(navButtons);

        inline_keyboard.push([
          { text: isPublished ? "📦 Ver Despublicados" : "📄 Ver Publicados", callback_data: isPublished ? "blog:list:0:unpublished" : "blog:list:0:published" },
          { text: "🔍 Buscar", callback_data: "blog:search_prompt" }
        ]);
        inline_keyboard.push([{ text: "🔙 Volver a Blog", callback_data: "menu:blog" }]);

        const sendRes = await editTelegramMessage(token, chatId, msgId, text, { replyMarkup: { inline_keyboard } });
        if (!sendRes?.ok) {
          console.error("[BLOG LIST ERROR] Falló editTelegramMessage al enviar listado:", sendRes);
          await sendTelegramMessage(token, chatId, `⚠️ Ocurrió un inconveniente al actualizar el listado de artículos (${escapeHtml(sendRes?.description || "Error desconocido")}).`);
        }
        return { ok: true, route: "blog_list", offset, status: statusFilter };
      } catch (err) {
        console.error("[BLOG LIST CRITICAL] Excepción al procesar listado de artículos:", err);
        await sendTelegramMessage(token, chatId, `❌ Error al consultar los artículos en la base de datos: <code>${escapeHtml(err.message)}</code>`, {
          replyMarkup: { inline_keyboard: [[{ text: "🔙 Volver al Menú Blog", callback_data: "menu:blog" }]] }
        });
        return { ok: false, error: err.message };
      }
    }

    // Blog: Prompt para buscar artículos
    if (data === "blog:search_prompt") {
      const text = `<b>🔍 BUSCAR ARTÍCULO EN EL BLOG</b>\n\n` +
        `Escribe el título, palabra clave o slug del artículo que deseas consultar o administrar:\n\n` +
        `<i>Envía un mensaje de texto con el término a buscar.</i>`;
      await editTelegramMessage(token, chatId, msgId, text, {
        replyMarkup: {
          inline_keyboard: [[{ text: "🔙 Cancelar y Volver", callback_data: "menu:blog" }]]
        }
      });
      return { ok: true, route: "blog_search_prompt" };
    }

    // Blog: Ficha de gestión de un artículo específico publicado o despublicado
    if (data.startsWith("post:manage:")) {
      const slugOrId = data.replace("post:manage:", "");
      const post = await getPostBySlugForAdmin(env.BLOG_DB, slugOrId);
      if (!post) {
        await editTelegramMessage(token, chatId, msgId, `❌ Artículo <code>${slugOrId}</code> no encontrado en D1.`, {
          replyMarkup: { inline_keyboard: [[{ text: "🔙 Volver", callback_data: "blog:list:0:published" }]] }
        });
        return { ok: true, route: "post_not_found" };
      }

      const slug = post.slug;
      const ref = post.id || post.slug;
      const isPub = post.status === "published";
      const manageText = `<b>🏛️ GESTIÓN DE ARTÍCULO</b>\n\n` +
        `• <b>Título:</b> ${escapeHtml(post.title)}\n` +
        `• <b>Categoría:</b> ${post.tag}\n` +
        `• <b>Fecha:</b> ${post.date} · <b>Lectura:</b> ${post.reading_time || "N/D"}\n` +
        `• <b>Estado actual:</b> <code>${post.status}</code> ${isPub ? "🟢" : "🔴"}\n` +
        `• <b>Slug (Inmutable):</b> <code>${post.slug}</code>\n\n` +
        `<b>Resumen BLUF:</b>\n<i>${escapeHtml(post.excerpt)}</i>\n\n` +
        (isPub ? `🔗 <b>Enlace público:</b>\nhttps://canedostudio.com/insights/${post.slug}\n\n` : `<i>⚠️ Este artículo está despublicado y responde 404 en la web.</i>\n\n`) +
        `Selecciona una acción:`;

      const inline_keyboard = [
        [
          { text: "✏️ Editar Título", callback_data: `post:edit_prompt:${ref}:title` },
          { text: "✏️ Editar Resumen", callback_data: `post:edit_prompt:${ref}:excerpt` }
        ],
        [
          { text: "🏷️ Cambiar Tag", callback_data: `post:edit_prompt:${ref}:tag` },
          { text: "🧱 Editar Cuerpo (Bloques)", callback_data: `post:blocks:${ref}:0` }
        ],
        [
          { text: "📜 Ver Historial", callback_data: `post:history:${ref}` }
        ]
      ];

      if (isPub) {
        inline_keyboard.push([
          { text: "🚫 Despublicar Artículo", callback_data: `post:unpublish_confirm:${ref}` }
        ]);
      } else {
        inline_keyboard.push([
          { text: "♻️ Restaurar en Producción", callback_data: `post:restore_confirm:${ref}` }
        ]);
      }

      inline_keyboard.push([
        { text: "🔙 Volver al Listado", callback_data: `blog:list:0:${post.status}` }
      ]);

      await editTelegramMessage(token, chatId, msgId, manageText, { replyMarkup: { inline_keyboard } });
      return { ok: true, route: "post_manage", slug, status: post.status };
    }

    // Blog: Confirmación de despublicación
    if (data.startsWith("post:unpublish_confirm:")) {
      const slugOrId = data.replace("post:unpublish_confirm:", "");
      const post = await getPostBySlugForAdmin(env.BLOG_DB, slugOrId);
      if (!post) {
        await editTelegramMessage(token, chatId, msgId, `❌ Artículo no encontrado.`);
        return { ok: false, error: "Artículo no encontrado" };
      }

      const slug = post.slug;
      const ref = post.id || post.slug;
      const confirmText = `<b>⚠️ CONFIRMAR DESPUBLICACIÓN</b>\n\n` +
        `¿Confirmas que deseas <b>despublicar</b> el siguiente artículo?\n\n` +
        `• <b>Título:</b> ${escapeHtml(post.title)}\n` +
        `• <b>Slug:</b> <code>${post.slug}</code>\n\n` +
        `<i>Efecto: El artículo dejará de ser visible de inmediato en la web pública (responderá 404), desaparecerá del sitemap y de los listados, pero se conservará de forma segura en D1 para restauración posterior.</i>`;

      const replyMarkup = {
        inline_keyboard: [
          [{ text: "🚫 Sí, Despublicar ahora", callback_data: `post:unpublish_execute:${ref}` }],
          [{ text: "❌ Cancelar", callback_data: `post:manage:${ref}` }]
        ]
      };
      await editTelegramMessage(token, chatId, msgId, confirmText, { replyMarkup });
      return { ok: true, route: "post_unpublish_confirm_prompt", slug };
    }

    // Blog: Ejecución de despublicación
    if (data.startsWith("post:unpublish_execute:")) {
      const slugOrId = data.replace("post:unpublish_execute:", "");
      const post = await getPostBySlugForAdmin(env.BLOG_DB, slugOrId);
      if (!post) {
        await editTelegramMessage(token, chatId, msgId, `❌ Artículo no encontrado.`);
        return { ok: false, error: "Artículo no encontrado" };
      }
      const slug = post.slug;
      const ref = post.id || post.slug;
      try {
        const res = await unpublishArticle(env, slug, userId);
        await logAdminAction(env.BLOG_DB, {
          userId,
          action: "post.unpublish",
          entityId: slug,
          details: res
        });

        const successText = `<b>✅ ARTÍCULO DESPUBLICADO CON ÉXITO</b>\n\n` +
          `• <b>Slug:</b> <code>${slug}</code>\n` +
          `• <b>Estado:</b> <code>unpublished</code>\n` +
          `• <b>D1 + KV:</b> Sincronizados y retirados de la vista pública.\n\n` +
          `Puedes restaurarlo en cualquier momento desde la sección de despublicados.`;

        const replyMarkup = {
          inline_keyboard: [
            [{ text: "📦 Ver Despublicados", callback_data: "blog:list:0:unpublished" }],
            [{ text: "🔙 Volver a Blog", callback_data: "menu:blog" }]
          ]
        };
        await editTelegramMessage(token, chatId, msgId, successText, { replyMarkup });
        return { ok: true, route: "post_unpublish_executed", slug };
      } catch (err) {
        await editTelegramMessage(token, chatId, msgId, `❌ <b>Error al despublicar:</b> ${escapeHtml(err.message)}`, {
          replyMarkup: { inline_keyboard: [[{ text: "🔙 Volver al Artículo", callback_data: `post:manage:${ref}` }]] }
        });
        return { ok: false, error: err.message };
      }
    }

    // Blog: Confirmación de restauración
    if (data.startsWith("post:restore_confirm:")) {
      const slugOrId = data.replace("post:restore_confirm:", "");
      const post = await getPostBySlugForAdmin(env.BLOG_DB, slugOrId);
      if (!post) {
        await editTelegramMessage(token, chatId, msgId, `❌ Artículo no encontrado.`);
        return { ok: false, error: "Artículo no encontrado" };
      }

      const slug = post.slug;
      const ref = post.id || post.slug;
      const confirmText = `<b>♻️ CONFIRMAR RESTAURACIÓN</b>\n\n` +
        `¿Deseas restaurar el siguiente artículo a producción en <b>canedostudio.com</b>?\n\n` +
        `• <b>Título:</b> ${escapeHtml(post.title)}\n` +
        `• <b>Slug:</b> <code>${post.slug}</code>\n\n` +
        `<i>Efecto: El artículo volverá a publicarse en D1 y KV con su misma URL e indexación previa.</i>`;

      const replyMarkup = {
        inline_keyboard: [
          [{ text: "♻️ Sí, Restaurar en Producción", callback_data: `post:restore_execute:${ref}` }],
          [{ text: "❌ Cancelar", callback_data: `post:manage:${ref}` }]
        ]
      };
      await editTelegramMessage(token, chatId, msgId, confirmText, { replyMarkup });
      return { ok: true, route: "post_restore_confirm_prompt", slug };
    }

    // Blog: Ejecución de restauración
    if (data.startsWith("post:restore_execute:")) {
      const slugOrId = data.replace("post:restore_execute:", "");
      const post = await getPostBySlugForAdmin(env.BLOG_DB, slugOrId);
      if (!post) {
        await editTelegramMessage(token, chatId, msgId, `❌ Artículo no encontrado.`);
        return { ok: false, error: "Artículo no encontrado" };
      }
      const slug = post.slug;
      const ref = post.id || post.slug;
      try {
        const res = await restoreArticle(env, slug, userId);
        await logAdminAction(env.BLOG_DB, {
          userId,
          action: "post.restore",
          entityId: slug,
          details: res
        });

        const successText = `<b>✅ ARTÍCULO RESTAURADO CON ÉXITO</b>\n\n` +
          `• <b>Slug:</b> <code>${slug}</code>\n` +
          `• <b>Estado:</b> <code>published</code> (D1 + KV sincronizados)\n\n` +
          `🔗 <b>Enlace público activo:</b>\nhttps://canedostudio.com/insights/${slug}`;

        const replyMarkup = {
          inline_keyboard: [
            [{ text: "🌐 Ver en mi web", url: `https://canedostudio.com/insights/${slug}` }],
            [{ text: "🏛️ Gestionar Artículo", callback_data: `post:manage:${ref}` }],
            [{ text: "🔙 Volver a Blog", callback_data: "menu:blog" }]
          ]
        };
        await editTelegramMessage(token, chatId, msgId, successText, { replyMarkup });
        return { ok: true, route: "post_restore_executed", slug };
      } catch (err) {
        await editTelegramMessage(token, chatId, msgId, `❌ <b>Error al restaurar:</b> ${escapeHtml(err.message)}`, {
          replyMarkup: { inline_keyboard: [[{ text: "🔙 Volver al Artículo", callback_data: `post:manage:${ref}` }]] }
        });
        return { ok: false, error: err.message };
      }
    }

    // Blog: Ver Historial de un artículo
    if (data.startsWith("post:history:")) {
      const slugOrId = data.replace("post:history:", "");
      const post = await getPostBySlugForAdmin(env.BLOG_DB, slugOrId);
      const slug = post?.slug || slugOrId;
      const ref = post?.id || slug;
      const history = await getPostHistory(env.BLOG_DB, slug, 5);
      let text = `<b>📜 HISTORIAL DE CAMBIOS — #${slug}</b>\n\n`;

      if (history.length === 0) {
        text += `<i>No hay versiones históricas registradas para este artículo todavía.</i>\n` +
          `Cada vez que edites o cambies su estado, se guardará una copia automática.`;
      } else {
        history.forEach((h, i) => {
          text += `<b>${i + 1}. Versión #${h.id}</b> · Op: <code>${h.operation}</code>\n`;
          text += `   📅 ${h.created_at} · Por: <code>${h.modified_by}</code>\n`;
          text += `   📝 Resumen: ${escapeHtml(h.change_summary || "Sin detalle")}\n\n`;
        });
      }

      const inline_keyboard = [];
      if (history.length > 0) {
        history.forEach(h => {
          inline_keyboard.push([
            { text: `↩️ Rollback a v#${h.id}`, callback_data: `post:rollback_confirm:${h.id}` }
          ]);
        });
      }
      inline_keyboard.push([{ text: "🔙 Volver al Artículo", callback_data: `post:manage:${ref}` }]);

      await editTelegramMessage(token, chatId, msgId, text, { replyMarkup: { inline_keyboard } });
      return { ok: true, route: "post_history", slug };
    }

    // Blog: Confirmación de Rollback
    if (data.startsWith("post:rollback_confirm:")) {
      const historyId = data.replace("post:rollback_confirm:", "");
      const historyEntry = await getPostHistoryById(env.BLOG_DB, historyId);
      if (!historyEntry) {
        await editTelegramMessage(token, chatId, msgId, `❌ Versión histórica no encontrada.`);
        return { ok: false, error: "Historial no encontrado" };
      }

      const post = await getPostBySlugForAdmin(env.BLOG_DB, historyEntry.post_slug);
      const ref = post?.id || historyEntry.post_slug;

      const confirmText = `<b>⚠️ CONFIRMAR ROLLBACK A VERSIÓN #${historyId}</b>\n\n` +
        `• <b>Artículo:</b> <code>${historyEntry.post_slug}</code>\n` +
        `• <b>Título histórico:</b> ${escapeHtml(historyEntry.title)}\n` +
        `• <b>Fecha de guardado:</b> ${historyEntry.created_at}\n\n` +
        `<i>¿Deseas restaurar esta versión exacta? Se creará una copia del estado actual antes de aplicar el rollback.</i>`;

      const replyMarkup = {
        inline_keyboard: [
          [{ text: "↩️ Sí, Aplicar Rollback", callback_data: `post:rollback_execute:${historyId}` }],
          [{ text: "❌ Cancelar", callback_data: `post:history:${ref}` }]
        ]
      };
      await editTelegramMessage(token, chatId, msgId, confirmText, { replyMarkup });
      return { ok: true, route: "post_rollback_confirm_prompt", historyId };
    }

    // Blog: Ejecución de Rollback
    if (data.startsWith("post:rollback_execute:")) {
      const historyId = data.replace("post:rollback_execute:", "");
      try {
        const res = await rollbackArticleToHistory(env, historyId, userId);
        const ref = res?.restoredPost?.id || res.slug;
        await logAdminAction(env.BLOG_DB, {
          userId,
          action: "post.rollback",
          entityId: res.slug,
          details: { historyId }
        });

        const successText = `<b>✅ ROLLBACK COMPLETADO CON ÉXITO</b>\n\n` +
          `• <b>Artículo:</b> <code>${res.slug}</code>\n` +
          `• <b>Versión restaurada:</b> #${historyId}\n` +
          `• <b>Estado actual:</b> <code>${res.restoredPost.status}</code> (D1 + KV sincronizados)`;

        const replyMarkup = {
          inline_keyboard: [
            [{ text: "🏛️ Ver Artículo", callback_data: `post:manage:${ref}` }],
            [{ text: "🔙 Volver a Blog", callback_data: "menu:blog" }]
          ]
        };
        await editTelegramMessage(token, chatId, msgId, successText, { replyMarkup });
        return { ok: true, route: "post_rollback_executed", historyId };
      } catch (err) {
        await editTelegramMessage(token, chatId, msgId, `❌ <b>Error en rollback:</b> ${escapeHtml(err.message)}`);
        return { ok: false, error: err.message };
      }
    }

    // Blog: Listar mis borradores
    if (data.startsWith("blog:drafts:")) {
      const offset = parseInt(data.replace("blog:drafts:", "") || "0", 10);
      const res = await listDraftsByUser(env.BLOG_DB, userId, 5, offset);
      let text = `<b>📂 MIS BORRADORES EDITORIALES (Total: ${res.total})</b>\n\n`;

      if (res.drafts.length === 0) {
        text += `<i>No tienes borradores registrados actualmente.</i>\n\nPuedes generar uno nuevo con el botón inferior:`;
      } else {
        res.drafts.forEach((d, i) => {
          const statusIcon = d.status === "draft" ? "📝" : d.status === "approved" ? "✅" : d.status === "published" ? "🚀" : "🗑️";
          text += `<b>${offset + i + 1}. ${statusIcon} ${escapeHtml(d.title)}</b>\n`;
          text += `   🏷️ <i>${d.tag}</i> · 📊 ${d.word_count || 0} palabras · Estado: <code>${d.status}</code>\n`;
          text += `   🆔 ID: <code>${d.id}</code>\n\n`;
        });
      }

      const inline_keyboard = [];
      // Botones de acción directa para los borradores en estado 'draft'
      const activeDrafts = res.drafts.filter(d => d.status === "draft");
      for (const d of activeDrafts) {
        inline_keyboard.push([
          { text: `👁️ Ver #${d.id.slice(-6)}`, callback_data: `draft:view:${d.id}` },
          { text: `✏️ Ajustar`, callback_data: `draft:modify_prompt:${d.id}` },
          { text: `🔄 Regenerar`, callback_data: `draft:regen_confirm:${d.id}` }
        ]);
      }

      const navButtons = [];
      if (offset >= 5) {
        navButtons.push({ text: "⬅️ Anteriores", callback_data: `blog:drafts:${offset - 5}` });
      }
      if (offset + 5 < res.total) {
        navButtons.push({ text: "Siguientes ➡️", callback_data: `blog:drafts:${offset + 5}` });
      }
      if (navButtons.length > 0) inline_keyboard.push(navButtons);

      inline_keyboard.push([
        { text: "✍️ Crear Nuevo Borrador", callback_data: "blog:create_prompt" },
        { text: "🔙 Volver a Blog", callback_data: "menu:blog" }
      ]);

      await editTelegramMessage(token, chatId, msgId, text, { replyMarkup: { inline_keyboard } });
      return { ok: true, route: "blog_drafts", offset };
    }

    // Blog: Ver detalle de borrador
    if (data.startsWith("draft:view:")) {
      const draftId = data.replace("draft:view:", "");
      const draft = await getDraftById(env.BLOG_DB, draftId);
      if (!draft) {
        await editTelegramMessage(token, chatId, msgId, `❌ Borrador <code>${draftId}</code> no encontrado.`, {
          replyMarkup: { inline_keyboard: [[{ text: "🔙 Volver a Borradores", callback_data: "blog:drafts:0" }]] }
        });
        return { ok: true, route: "draft_not_found" };
      }

      const previewText = `<b>📋 DETALLE DEL BORRADOR</b>\n\n` +
        `• <b>Título:</b> ${escapeHtml(draft.title)}\n` +
        `• <b>Categoría:</b> ${draft.tag}\n` +
        `• <b>Tema origen:</b> ${escapeHtml(draft.topicTema)}\n` +
        `• <b>Enfoque/Ángulo:</b> ${escapeHtml(draft.topicAngulo || "Estándar")}\n` +
        `• <b>Extensión:</b> ${draft.wordCount} palabras reales (650–900)\n` +
        `• <b>Estado:</b> <code>${draft.status}</code>\n\n` +
        `<b>Resumen BLUF:</b>\n<i>${escapeHtml(draft.excerpt)}</i>\n\n` +
        `Elige una acción para gestionar este artículo:`;

      const publishEnabled = String(env.ADMIN_PUBLISH_ENABLED).toLowerCase() === "true";
      const actionRow = [];
      if (draft.status === "draft") {
        actionRow.push({ text: "✅ Aprobar Borrador", callback_data: `draft:approve_only:${draft.id}` });
      }
      if (publishEnabled && draft.status === "approved") {
        actionRow.push({ text: "🚀 Publicar Artículo", callback_data: `draft:publish_confirm:${draft.id}` });
      }

      const inline_keyboard = [];
      if (actionRow.length > 0) inline_keyboard.push(actionRow);
      inline_keyboard.push([
        { text: "📖 Leer Completo", callback_data: `draft:read_full:${draft.id}` },
        { text: "✏️ Modificar con IA", callback_data: `draft:modify_prompt:${draft.id}` }
      ]);
      inline_keyboard.push([
        { text: "🔄 Regenerar", callback_data: `draft:regen_confirm:${draft.id}` },
        { text: "🗑️ Descartar", callback_data: `draft:discard_confirm:${draft.id}` }
      ]);
      inline_keyboard.push([
        { text: "🔙 Volver a Borradores", callback_data: "blog:drafts:0" }
      ]);

      await editTelegramMessage(token, chatId, msgId, previewText, { replyMarkup: { inline_keyboard } });
      return { ok: true, route: "draft_view", draftId };
    }

    // Blog: Leer artículo completo (paginado en trozos <= 3800 caracteres para no exceder límite Telegram de 4096)
    if (data.startsWith("draft:read_full:")) {
      const draftId = data.replace("draft:read_full:", "");
      const draft = await getDraftById(env.BLOG_DB, draftId);
      if (!draft) return { ok: true };

      // Renderizar texto plano del artículo
      let fullText = `<b>📖 ${escapeHtml(draft.title)}</b>\n<i>Categoría: ${draft.tag} · ${draft.wordCount} palabras</i>\n\n`;
      for (const block of draft.content) {
        if (block.type === "h2") fullText += `\n<b>━━━ ${escapeHtml(block.text)} ━━━</b>\n\n`;
        else if (block.type === "h3") fullText += `\n<i>▪️ ${escapeHtml(block.text)}</i>\n\n`;
        else if (block.type === "p") fullText += `${escapeHtml(block.text)}\n\n`;
        else if (block.type === "callout") fullText += `💡 <i>${escapeHtml(block.text)}</i>\n\n`;
      }

      // Dividir en trozos de máx 3500 caracteres
      const chunks = [];
      let current = "";
      const paragraphs = fullText.split("\n\n");
      for (const p of paragraphs) {
        if ((current + p).length > 3500) {
          if (current.trim()) chunks.push(current.trim());
          current = p + "\n\n";
        } else {
          current += p + "\n\n";
        }
      }
      if (current.trim()) chunks.push(current.trim());

      // Enviar trozos secuencialmente
      for (let i = 0; i < chunks.length; i++) {
        const header = chunks.length > 1 ? `<i>[Parte ${i + 1}/${chunks.length}]</i>\n\n` : "";
        const isLast = i === chunks.length - 1;
        const replyMarkup = isLast ? {
          inline_keyboard: [
            [
              { text: "✏️ Modificar", callback_data: `draft:modify_prompt:${draft.id}` },
              { text: "🔄 Regenerar", callback_data: `draft:regen_confirm:${draft.id}` }
            ],
            [{ text: "🔙 Volver al Borrador", callback_data: `draft:view:${draft.id}` }]
          ]
        } : undefined;

        await sendTelegramMessage(token, chatId, header + chunks[i], { replyMarkup });
      }

      return { ok: true, route: "draft_read_full", chunks: chunks.length };
    }

    // Blog: Prompt para solicitar modificaciones
    if (data.startsWith("draft:modify_prompt:")) {
      const draftId = data.replace("draft:modify_prompt:", "");
      if (env.ADMIN_KV) {
        await env.ADMIN_KV.put(`user_state:${userId}`, JSON.stringify({ action: "awaiting_draft_modification", draftId }), { expirationTtl: 600 });
      }
      const text = `<b>✏️ SOLICITAR MODIFICACIONES CON IA</b>\n\n` +
        `Escribe las instrucciones específicas de cambio para el borrador <code>${draftId}</code>.\n\n` +
        `<i>Ejemplo de instrucciones:</i>\n` +
        `• <i>"Haz el tono más persuasivo y agrega un ejemplo sobre clínicas odontológicas."</i>\n` +
        `• <i>"Enfócalo hacia directores de finanzas y simplifica la introducción."</i>\n\n` +
        `El sistema reescribirá el artículo respetando estrictamente el Quality Gate de 650–900 palabras.`;
      const replyMarkup = {
        inline_keyboard: [[{ text: "❌ Cancelar", callback_data: `draft:view:${draftId}` }]]
      };
      await editTelegramMessage(token, chatId, msgId, text, { replyMarkup });
      return { ok: true, route: "draft_modify_prompt", draftId };
    }

    // Blog: Confirmación de regeneración
    if (data.startsWith("draft:regen_confirm:")) {
      const draftId = data.replace("draft:regen_confirm:", "");
      const text = `<b>🔄 CONFIRMAR REGENERACIÓN</b>\n\n¿Deseas redactar desde cero una nueva versión de este artículo conservando el tema original?\n\nLa versión actual será reemplazada por una nueva que cumpla el Quality Gate.`;
      const replyMarkup = {
        inline_keyboard: [
          [
            { text: "✅ Sí, regenerar artículo", callback_data: `draft:exec_regen:${draftId}` },
            { text: "❌ Cancelar", callback_data: `draft:view:${draftId}` }
          ]
        ]
      };
      await editTelegramMessage(token, chatId, msgId, text, { replyMarkup });
      return { ok: true, route: "draft_regen_confirm", draftId };
    }

    // Blog: Ejecutar regeneración
    if (data.startsWith("draft:exec_regen:")) {
      const draftId = data.replace("draft:exec_regen:", "");
      await editTelegramMessage(token, chatId, msgId, `<b>⏳ Regenerando artículo completo con IA...</b>\n• Recreando brief editorial\n• Aplicando Quality Gate Fase 6L...`);

      const runRegen = async () => {
        try {
          const updated = await regenerateDraft(env, { draftId, userId });
          await logAdminAction(env.BLOG_DB, {
            userId,
            username,
            action: "BLOG_DRAFT_REGENERATE",
            entityId: draftId,
            details: { title: updated.title, words: updated.wordCount },
            ip
          });

          const successText = `<b>🔄 ARTÍCULO REGENERADO EXITOSAMENTE</b>\n\n` +
            `• <b>Título:</b> ${escapeHtml(updated.title)}\n` +
            `• <b>Categoría:</b> ${updated.tag}\n` +
            `• <b>Extensión real:</b> ${updated.wordCount} palabras\n` +
            `• <b>Quality Gate:</b> Aprobado ✅\n\n` +
            `<b>Resumen BLUF:</b>\n<i>${escapeHtml(updated.excerpt)}</i>`;

          const replyMarkup = {
            inline_keyboard: [
              [
                { text: "📖 Leer Completo", callback_data: `draft:read_full:${draftId}` },
                { text: "✏️ Modificar", callback_data: `draft:modify_prompt:${draftId}` }
              ],
              [
                { text: "🗑️ Descartar", callback_data: `draft:discard_confirm:${draftId}` },
                { text: "🔙 Menú Borradores", callback_data: "blog:drafts:0" }
              ]
            ]
          };
          await editTelegramMessage(token, chatId, msgId, successText, { replyMarkup });
        } catch (err) {
          await editTelegramMessage(token, chatId, msgId, `<b>❌ Error al regenerar:</b> ${escapeHtml(err.message)}`, {
            replyMarkup: { inline_keyboard: [[{ text: "🔙 Volver", callback_data: `draft:view:${draftId}` }]] }
          });
        }
      };

      if (ctx && typeof ctx.waitUntil === "function") {
        ctx.waitUntil(runRegen());
      } else {
        await runRegen();
      }

      return { ok: true, route: "draft_regen_dispatched", draftId };
    }

    // Blog: Confirmación de descarte
    if (data.startsWith("draft:discard_confirm:")) {
      const draftId = data.replace("draft:discard_confirm:", "");
      const text = `<b>🗑️ CONFIRMAR DESCARTE</b>\n\n¿Estás seguro de que deseas descartar el borrador <code>${draftId}</code>?\n\nEsta acción cambiará su estado a <code>discarded</code> y no podrá ser publicado.`;
      const replyMarkup = {
        inline_keyboard: [
          [
            { text: "🗑️ Sí, descartar borrador", callback_data: `draft:discard:${draftId}` },
            { text: "❌ Cancelar", callback_data: `draft:view:${draftId}` }
          ]
        ]
      };
      await editTelegramMessage(token, chatId, msgId, text, { replyMarkup });
      return { ok: true, route: "draft_discard_confirm", draftId };
    }

    // Blog: Selector de los 5 Tipos de Artículos
    if (data === "blog:create_prompt") {
      const text = `<b>✍️ CREACIÓN MANUAL — SELECCIÓN DE PERFIL EDITORIAL</b>\n\n` +
        `Elige el formato y extensión deseada para el nuevo artículo:\n\n` +
        `• <b>1. Novedades Tech:</b> 400–700 palabras (ágil, tendencias de IA)\n` +
        `• <b>2. Consejos Pyme:</b> 700–1.000 palabras (operativo, ventas locales)\n` +
        `• <b>3. SEO Especializado:</b> 1.000–1.500 palabras (profundidad, búsqueda)\n` +
        `• <b>4. Tutorial Práctico:</b> 1.500–2.500 palabras (paso a paso, guías)\n` +
        `• <b>5. Guía Técnica:</b> 2.000–3.000 palabras (monografía exhaustiva)`;

      const replyMarkup = {
        inline_keyboard: [
          [{ text: "📰 Tipo 1: Novedades (400-700w)", callback_data: "blog:type:1" }],
          [{ text: "💡 Tipo 2: Consejos Pyme (700-1000w)", callback_data: "blog:type:2" }],
          [{ text: "🔍 Tipo 3: SEO Estratégico (1000-1500w)", callback_data: "blog:type:3" }],
          [{ text: "📘 Tipo 4: Tutorial Práctico (1500-2500w)", callback_data: "blog:type:4" }],
          [{ text: "⚙️ Tipo 5: Guía Técnica (2000-3000w)", callback_data: "blog:type:5" }],
          [{ text: "🔙 Volver a Blog", callback_data: "menu:blog" }]
        ]
      };
      await editTelegramMessage(token, chatId, msgId, text, { replyMarkup });
      return { ok: true, route: "blog_type_select" };
    }

    // Blog: Capturar tipo seleccionado y pedir tema/instrucciones
    if (data.startsWith("blog:type:")) {
      const selectedTypeNum = parseInt(data.replace("blog:type:", ""), 10) || 2;
      if (env.ADMIN_KV) {
        await env.ADMIN_KV.put(`user_state:${userId}`, JSON.stringify({
          action: "awaiting_blog_topic",
          articleType: selectedTypeNum
        }), { expirationTtl: 600 });
      }

      const typeLabels = {
        1: "Tipo 1 (Novedades Tech · 400-700 palabras)",
        2: "Tipo 2 (Consejos Pyme · 700-1.000 palabras)",
        3: "Tipo 3 (SEO Especializado · 1.000-1.500 palabras)",
        4: "Tipo 4 (Tutorial Práctico · 1.500-2.500 palabras)",
        5: "Tipo 5 (Guía Técnica Exhaustiva · 2.000-3.000 palabras)"
      };

      const text = `<b>✍️ CREACIÓN: ${typeLabels[selectedTypeNum] || "Tipo " + selectedTypeNum}</b>\n\n` +
        `Envía el <b>tema o titular</b> para este artículo.\n\n` +
        `<i>Opcional:</i> Si deseas incluir instrucciones de enfoque o una extensión específica, sepáralo con una barra vertical <code>|</code>:\n` +
        `<code>Cómo automatizar presupuestos con IA | Enfocar en clínicas dentales y 850 palabras</code>\n\n` +
        `El sistema orquestará la redacción con Workers AI y aplicará la auditoría correspondiente.`;

      const replyMarkup = {
        inline_keyboard: [[{ text: "🔙 Cambiar Tipo", callback_data: "blog:create_prompt" }]]
      };
      await editTelegramMessage(token, chatId, msgId, text, { replyMarkup });
      return { ok: true, route: "blog_topic_prompt", articleType: selectedTypeNum };
    }

    // Blog: Aprobación exclusiva de borrador (Sin publicar, no requiere ADMIN_PUBLISH_ENABLED=true)
    if (data.startsWith("draft:approve_only:")) {
      const draftId = data.replace("draft:approve_only:", "");
      try {
        const approvedDraft = await approveDraftOnly(env, draftId, userId);
        await logAdminAction(env.BLOG_DB, {
          userId,
          username,
          action: "BLOG_DRAFT_APPROVE_ONLY",
          entityId: draftId,
          details: { title: approvedDraft.title, words: approvedDraft.wordCount },
          ip
        });

        const publishEnabled = String(env.ADMIN_PUBLISH_ENABLED).toLowerCase() === "true";
        const actionRow = [];
        if (publishEnabled) {
          actionRow.push({ text: "🚀 Publicar Artículo", callback_data: `draft:publish_confirm:${draftId}` });
        }
        actionRow.push({ text: "🗑️ Descartar", callback_data: `draft:discard_confirm:${draftId}` });

        const approvedText = `<b>✅ BORRADOR APROBADO EXITOSAMENTE</b>\n\n` +
          `• <b>Título:</b> ${escapeHtml(approvedDraft.title)}\n` +
          `• <b>Categoría:</b> ${approvedDraft.tag}\n` +
          `• <b>Extensión:</b> ${approvedDraft.wordCount} palabras\n` +
          `• <b>Estado:</b> <code>approved</code>\n\n` +
          `El borrador ha quedado formalmente aprobado en la base de datos D1.\n` +
          `<i>Publicación: ${publishEnabled ? "🟢 Habilitada" : "🔒 Deshabilitada en producción (ADMIN_PUBLISH_ENABLED=false)"}</i>`;

        const replyMarkup = {
          inline_keyboard: [
            actionRow,
            [
              { text: "📖 Leer Completo", callback_data: `draft:read_full:${draftId}` },
              { text: "🔙 Volver a Borradores", callback_data: "blog:drafts:0" }
            ]
          ]
        };

        await editTelegramMessage(token, chatId, msgId, approvedText, { replyMarkup });
        return { ok: true, route: "draft_approved_only", draftId };
      } catch (err) {
        await editTelegramMessage(token, chatId, msgId, `<b>❌ Error al aprobar:</b> ${escapeHtml(err.message)}`, {
          replyMarkup: { inline_keyboard: [[{ text: "🔙 Volver", callback_data: `draft:view:${draftId}` }]] }
        });
        return { ok: false, error: err.message };
      }
    }

    // Blog: Publicación de artículo (Requiere ADMIN_PUBLISH_ENABLED=true)
    // Blog: Navegación de bloques de contenido para edición granular
    if (data.startsWith("post:blocks:")) {
      const parts = data.replace("post:blocks:", "").split(":");
      const slugOrId = parts[0];
      const page = parseInt(parts[1] || "0", 10);
      const post = await getPostBySlugForAdmin(env.BLOG_DB, slugOrId);

      if (!post) {
        await editTelegramMessage(token, chatId, msgId, `❌ Artículo no encontrado.`);
        return { ok: false, error: "Artículo no encontrado" };
      }

      const slug = post.slug;
      const ref = post.id || post.slug;
      const content = Array.isArray(post.content) ? post.content : [];
      let blocksText = `<b>🧱 EDICIÓN DE CUERPO — #${slug}</b>\n` +
        `<i>Total de bloques: ${content.length}</i>\n\n` +
        `Selecciona el bloque (H2, H3 o párrafo) que deseas editar:\n\n`;

      const pageSize = 5;
      const startIndex = page * pageSize;
      const pagedBlocks = content.slice(startIndex, startIndex + pageSize);

      if (pagedBlocks.length === 0) {
        blocksText += `<i>No hay más bloques en este artículo.</i>`;
      } else {
        pagedBlocks.forEach((b, idx) => {
          const globalIdx = startIndex + idx;
          const typeBadge = b.type === "h2" ? "📌 H2" : b.type === "h3" ? "📍 H3" : b.type === "callout" ? "💡 Callout" : "📝 Párrafo";
          const snippet = (b.text || "").length > 80 ? (b.text || "").slice(0, 80) + "..." : (b.text || "");
          blocksText += `<b>${globalIdx + 1}. [${typeBadge}]</b>\n<i>${escapeHtml(snippet)}</i>\n\n`;
        });
      }

      const inline_keyboard = [];
      pagedBlocks.forEach((b, idx) => {
        const globalIdx = startIndex + idx;
        const typeBadge = b.type === "h2" ? "H2" : b.type === "h3" ? "H3" : "Párrafo";
        inline_keyboard.push([
          { text: `✏️ Editar Bloque #${globalIdx + 1} (${typeBadge})`, callback_data: `post:block_edit:${ref}:${globalIdx}` }
        ]);
      });

      const navRow = [];
      if (page > 0) {
        navRow.push({ text: "⬅️ Bloques Anteriores", callback_data: `post:blocks:${ref}:${page - 1}` });
      }
      if (startIndex + pageSize < content.length) {
        navRow.push({ text: "Siguientes Bloques ➡️", callback_data: `post:blocks:${ref}:${page + 1}` });
      }
      if (navRow.length > 0) inline_keyboard.push(navRow);

      inline_keyboard.push([{ text: "🔙 Volver al Artículo", callback_data: `post:manage:${ref}` }]);

      await editTelegramMessage(token, chatId, msgId, blocksText, { replyMarkup: { inline_keyboard } });
      return { ok: true, route: "post_blocks_list", slug, page };
    }

    // Blog: Prompt para editar un bloque específico de contenido
    if (data.startsWith("post:block_edit:")) {
      const parts = data.replace("post:block_edit:", "").split(":");
      const slugOrId = parts[0];
      const blockIndex = parseInt(parts[1], 10);
      const post = await getPostBySlugForAdmin(env.BLOG_DB, slugOrId);

      if (!post) {
        await editTelegramMessage(token, chatId, msgId, `❌ Artículo no encontrado.`);
        return { ok: false, error: "Artículo no encontrado" };
      }

      const slug = post.slug;
      const ref = post.id || post.slug;
      const content = Array.isArray(post.content) ? post.content : [];
      const targetBlock = content[blockIndex];
      if (!targetBlock) {
        await editTelegramMessage(token, chatId, msgId, `❌ Bloque #${blockIndex + 1} no encontrado.`);
        return { ok: false, error: "Bloque no encontrado" };
      }

      const typeBadge = targetBlock.type === "h2" ? "Encabezado H2" : targetBlock.type === "h3" ? "Subtítulo H3" : "Párrafo";
      const promptText = `<b>✏️ EDITAR BLOQUE #${blockIndex + 1} (${typeBadge})</b>\n\n` +
        `• <b>Artículo:</b> <code>${slug}</code>\n` +
        `• <b>Texto actual:</b>\n<i>${escapeHtml(targetBlock.text || "")}</i>\n\n` +
        `Para modificar este bloque, envía el siguiente comando:\n\n` +
        `<code>/set_block_${slug}_${blockIndex} [tu nuevo texto aquí]</code>\n\n` +
        `<i>Ejemplo:</i>\n<code>/set_block_${slug}_${blockIndex} ${escapeHtml(targetBlock.text || "")}</code>`;

      const replyMarkup = {
        inline_keyboard: [[{ text: "🔙 Volver a Bloques", callback_data: `post:blocks:${ref}:${Math.floor(blockIndex / 5)}` }]]
      };
      await editTelegramMessage(token, chatId, msgId, promptText, { replyMarkup });
      return { ok: true, route: "post_block_edit_prompt", slug, blockIndex };
    }

    // Blog: Solicitud de edición de campo específico (Título, Resumen, Tag)
    if (data.startsWith("post:edit_prompt:")) {
      const parts = data.replace("post:edit_prompt:", "").split(":");
      const slugOrId = parts[0];
      const field = parts[1];

      const post = await getPostBySlugForAdmin(env.BLOG_DB, slugOrId);
      if (!post) {
        await editTelegramMessage(token, chatId, msgId, `❌ Artículo no encontrado.`);
        return { ok: false, error: "Artículo no encontrado" };
      }

      const slug = post.slug;
      const ref = post.id || post.slug;
      const fieldNames = {
        title: "Título",
        excerpt: "Resumen BLUF",
        tag: "Categoría / Tag"
      };

      const currentValue = post[field] || "";
      const promptText = `<b>✏️ EDITAR ${fieldNames[field] || field.toUpperCase()}</b>\n\n` +
        `• <b>Artículo:</b> <code>${slug}</code>\n` +
        `• <b>Valor actual:</b>\n<i>${escapeHtml(currentValue)}</i>\n\n` +
        `Para modificar este campo, responde con el comando de edición:\n\n` +
        `<code>/set_${field}_${slug} [tu nuevo texto aquí]</code>\n\n` +
        `<i>Ejemplo:</i>\n<code>/set_${field}_${slug} ${escapeHtml(currentValue)}</code>`;

      const replyMarkup = {
        inline_keyboard: [[{ text: "🔙 Cancelar y Volver", callback_data: `post:manage:${ref}` }]]
      };
      await editTelegramMessage(token, chatId, msgId, promptText, { replyMarkup });
      return { ok: true, route: "post_edit_prompt", slug, field };
    }

    // Blog: Confirmación de edición de campo antes de aplicar
    if (data.startsWith("post:edit_confirm:")) {
      const parts = data.replace("post:edit_confirm:", "").split(":");
      const jobId = parts[0];

      const job = await getJobById(env.BLOG_DB, jobId);
      if (!job || !job.payload_json) {
        await editTelegramMessage(token, chatId, msgId, `❌ Propuesta de edición no encontrada o expirada.`);
        return { ok: false, error: "Job no encontrado" };
      }

      const payload = JSON.parse(job.payload_json);
      const { slug, field, newValue, oldValue } = payload;
      const post = await getPostBySlugForAdmin(env.BLOG_DB, slug);
      const ref = post?.id || slug;

      const previewText = `<b>👁️ VISTA PREVIA DE LOS CAMBIOS</b>\n\n` +
        `• <b>Artículo:</b> <code>${slug}</code>\n` +
        `• <b>Campo:</b> <code>${field}</code>\n\n` +
        `<b>Antes:</b>\n<s>${escapeHtml(oldValue)}</s>\n\n` +
        `<b>Después:</b>\n<b>${escapeHtml(newValue)}</b>\n\n` +
        `<i>¿Confirmas que deseas aplicar este cambio en D1 (y KV si está publicado)? Se creará un respaldo histórico automático.</i>`;

      const replyMarkup = {
        inline_keyboard: [
          [{ text: "💾 Sí, Guardar en Producción", callback_data: `post:edit_execute:${jobId}` }],
          [{ text: "❌ Cancelar", callback_data: `post:manage:${ref}` }]
        ]
      };
      await editTelegramMessage(token, chatId, msgId, previewText, { replyMarkup });
      return { ok: true, route: "post_edit_preview", jobId };
    }

    // Blog: Ejecución de edición de campo
    if (data.startsWith("post:edit_execute:")) {
      const jobId = data.replace("post:edit_execute:", "");
      const claimed = await claimSpecificJob(env.BLOG_DB, jobId, 60, "edit_worker");
      if (!claimed) {
        await editTelegramMessage(token, chatId, msgId, `⚠️ Esta edición ya fue procesada o se encuentra en curso.`);
        return { ok: true, route: "edit_already_claimed" };
      }

      const { slug, field, newValue, oldValue, blockIndex, updatedContent } = claimed.payload;
      const post = await getPostBySlugForAdmin(env.BLOG_DB, slug);
      const ref = post?.id || slug;
      try {
        let updates = {};
        let changeDesc = `Edición de ${field} desde Telegram`;
        if (field === "content_block") {
          updates = { content_json: updatedContent };
          changeDesc = `Edición de bloque #${blockIndex + 1} desde Telegram`;
        } else {
          updates = { [field]: newValue };
        }

        const res = await editArticleDetails(env, slug, updates, userId, changeDesc);
        await markJobCompleted(env.BLOG_DB, jobId, { success: true }, claimed.expectedAttempts);

        await logAdminAction(env.BLOG_DB, {
          userId,
          action: field === "content_block" ? `post.edit.block_${blockIndex}` : `post.edit.${field}`,
          entityId: slug,
          details: { field, blockIndex, oldValue, newValue }
        });

        const successText = `<b>✅ CAMBIO GUARDADO CON ÉXITO</b>\n\n` +
          `• <b>Artículo:</b> <code>${slug}</code>\n` +
          `• <b>Elemento modificado:</b> <code>${field === "content_block" ? `Bloque #${blockIndex + 1}` : field}</code>\n` +
          `• <b>Estado:</b> Versión previa respaldada en historial.\n\n` +
          `<b>Nuevo valor:</b>\n${escapeHtml(newValue)}`;

        const replyMarkup = {
          inline_keyboard: [
            [{ text: "🏛️ Gestionar Artículo", callback_data: `post:manage:${ref}` }],
            [{ text: "🧱 Ver Bloques", callback_data: `post:blocks:${ref}:${blockIndex !== undefined ? Math.floor(blockIndex / 5) : 0}` }],
            [{ text: "🔙 Volver a Blog", callback_data: "menu:blog" }]
          ]
        };
        await editTelegramMessage(token, chatId, msgId, successText, { replyMarkup });
        return { ok: true, route: "post_edit_executed", slug, field };
      } catch (err) {
        await markJobFailed(env.BLOG_DB, jobId, err.message, claimed.expectedAttempts);
        await editTelegramMessage(token, chatId, msgId, `❌ <b>Error al guardar:</b> ${escapeHtml(err.message)}`, {
          replyMarkup: { inline_keyboard: [[{ text: "🔙 Volver", callback_data: `post:manage:${ref}` }]] }
        });
        return { ok: false, error: err.message };
      }
    }
    if (data.startsWith("draft:publish_confirm:")) {
      const draftId = data.replace("draft:publish_confirm:", "");
      const publishEnabled = String(env.ADMIN_PUBLISH_ENABLED).toLowerCase() === "true";

      if (!publishEnabled) {
        const disabledText = `<b>🔒 PUBLICACIÓN DESHABILITADA</b>\n\n` +
          `La publicación en producción está protegida (<code>ADMIN_PUBLISH_ENABLED=false</code>).\n\n` +
          `El borrador se encuentra a salvo en D1 y puede ser aprobado formalmente con el botón <b>✅ Aprobar Borrador</b>.`;
        const replyMarkup = {
          inline_keyboard: [
            [{ text: "✅ Aprobar Borrador", callback_data: `draft:approve_only:${draftId}` }],
            [{ text: "🔙 Volver al Borrador", callback_data: `draft:view:${draftId}` }]
          ]
        };
        await editTelegramMessage(token, chatId, msgId, disabledText, { replyMarkup });
        return { ok: true, route: "draft_publish_blocked", draftId };
      }

      const draft = await getDraftById(env.BLOG_DB, draftId);
      if (!draft) {
        await editTelegramMessage(token, chatId, msgId, `❌ Borrador no encontrado.`);
        return { ok: false, error: "Borrador no encontrado" };
      }

      if (draft.status !== "approved") {
        await editTelegramMessage(token, chatId, msgId, `⚠️ <b>El borrador no ha sido aprobado previamente.</b>\nDebes aprobarlo antes de publicar.`, {
          replyMarkup: {
            inline_keyboard: [
              [{ text: "✅ Aprobar Borrador", callback_data: `draft:approve_only:${draftId}` }],
              [{ text: "🔙 Volver al Borrador", callback_data: `draft:view:${draftId}` }]
            ]
          }
        });
        return { ok: true, route: "draft_publish_not_approved", draftId };
      }

      const confirmText = `<b>⚠️ CONFIRMACIÓN DE PUBLICACIÓN</b>\n\n` +
        `¿Confirmas que deseas publicar este artículo en <b>canedostudio.com</b>?\n\n` +
        `• <b>Título:</b> ${escapeHtml(draft.title)}\n` +
        `• <b>Categoría:</b> ${draft.tag}\n` +
        `• <b>Extensión:</b> ${draft.wordCount} palabras\n\n` +
        `<i>Al confirmar, se generará la portada con IA, se insertará en D1 y KV y estará visible públicamente.</i>`;

      const replyMarkup = {
        inline_keyboard: [
          [{ text: "🚀 Confirmar publicación", callback_data: `draft:publish_execute:${draftId}` }],
          [{ text: "❌ Cancelar", callback_data: `draft:view:${draftId}` }]
        ]
      };
      await editTelegramMessage(token, chatId, msgId, confirmText, { replyMarkup });
      return { ok: true, route: "draft_publish_confirm_prompt", draftId };
    }

    // Blog: Publicación efectiva tras confirmación expresa
    if (data.startsWith("draft:publish_execute:") || data.startsWith("draft:publish_direct:") || data.startsWith("draft:approve:")) {
      const draftId = data.replace("draft:publish_execute:", "").replace("draft:publish_direct:", "").replace("draft:approve:", "");
      const publishEnabled = String(env.ADMIN_PUBLISH_ENABLED).toLowerCase() === "true";

      if (!publishEnabled) {
        const disabledText = `<b>🔒 PUBLICACIÓN DESHABILITADA</b>\n\n` +
          `La publicación en producción está protegida (<code>ADMIN_PUBLISH_ENABLED=false</code>).\n\n` +
          `El borrador se encuentra a salvo en D1 y puede ser aprobado formalmente con el botón <b>✅ Aprobar Borrador</b>.`;
        const replyMarkup = {
          inline_keyboard: [
            [{ text: "✅ Aprobar Borrador", callback_data: `draft:approve_only:${draftId}` }],
            [{ text: "🔙 Volver al Borrador", callback_data: `draft:view:${draftId}` }]
          ]
        };
        await editTelegramMessage(token, chatId, msgId, disabledText, { replyMarkup });
        return { ok: true, route: "draft_publish_blocked", draftId };
      }

      // Validar que el borrador esté en estado approved
      const draftCheck = await getDraftById(env.BLOG_DB, draftId);
      if (draftCheck && draftCheck.status !== "approved") {
        await editTelegramMessage(token, chatId, msgId, `⚠️ <b>El borrador no ha sido aprobado previamente.</b>\nDebes aprobarlo antes de publicar.`, {
          replyMarkup: {
            inline_keyboard: [
              [{ text: "✅ Aprobar Borrador", callback_data: `draft:approve_only:${draftId}` }],
              [{ text: "🔙 Volver al Borrador", callback_data: `draft:view:${draftId}` }]
            ]
          }
        });
        return { ok: true, route: "draft_publish_not_approved", draftId };
      }

      await editTelegramMessage(token, chatId, msgId, `<b>⏳ Publicando artículo en producción...</b>\nGenerando portada con Flux y persistiendo en D1 y KV...`);

      // 1. Crear Job persistente en D1
      const jobId = "job_pub_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
      if (env.BLOG_DB) {
        await createJob(env.BLOG_DB, {
          id: jobId,
          jobType: "blog_publish_approved",
          userId,
          chatId,
          messageId: msgId,
          payload: { draftId, ip, username }
        });
      }

      // 2. Procesador en background con reclamación atómica
      const runPublish = async () => {
        let claimed = null;
        if (env.BLOG_DB) {
          claimed = await claimSpecificJob(env.BLOG_DB, jobId, 180);
          if (!claimed) {
            console.log(`[PUBLISH JOB SKIP] Job ${jobId} ya fue reclamado`);
            return;
          }
        }

        try {
          const { slug, post } = await publishApprovedDraft(env, draftId, userId);
          await logAdminAction(env.BLOG_DB, {
            userId,
            username,
            action: "BLOG_DRAFT_APPROVE",
            entityId: draftId,
            details: { slug, title: post.title },
            ip
          });

          const successText = `<b>✅ Artículo publicado</b>\n\n` +
            `• <b>Título:</b> ${escapeHtml(post.title)}\n` +
            `• <b>Categoría:</b> ${post.tag}\n` +
            `• <b>Extensión real:</b> ${post.readingTime} (cuerpo completo)\n` +
            `• <b>Slug:</b> <code>${slug}</code>\n` +
            `• <b>Estado:</b> En producción (D1 + KV)\n\n` +
            `🔗 <b>Enlace público:</b>\nhttps://canedostudio.com/insights/${slug}`;

          const replyMarkup = {
            inline_keyboard: [
              [{ text: "🌐 Ver en mi web", url: `https://canedostudio.com/insights/${slug}` }],
              [{ text: "🔙 Volver a Blog", callback_data: "menu:blog" }]
            ]
          };
          await editTelegramMessage(token, chatId, msgId, successText, { replyMarkup });
          if (env.BLOG_DB) {
            await markJobCompleted(env.BLOG_DB, jobId, { slug, title: post.title });
          }
        } catch (err) {
          await editTelegramMessage(token, chatId, msgId, `<b>❌ Error al publicar:</b> ${escapeHtml(err.message)}`, {
            replyMarkup: { inline_keyboard: [[{ text: "🔙 Volver al Borrador", callback_data: `draft:view:${draftId}` }]] }
          });
          if (env.BLOG_DB) {
            await markJobFailed(env.BLOG_DB, jobId, err.message);
          }
        }
      };

      if (ctx && typeof ctx.waitUntil === "function") {
        ctx.waitUntil(runPublish());
      } else {
        runPublish().catch((e) => console.error("[ASYNC PUBLISH ERROR]", e.message));
      }

      return { ok: true, route: "draft_publish_queued", draftId, jobId };
    }

    // Blog: Descarte de borrador
    if (data.startsWith("draft:discard:")) {
      const draftId = data.replace("draft:discard:", "");
      await discardDraft(env, draftId, userId);
      await logAdminAction(env.BLOG_DB, {
        userId,
        username,
        action: "BLOG_DRAFT_DISCARD",
        entityId: draftId,
        details: { draftId },
        ip
      });
      await editTelegramMessage(token, chatId, msgId, `🗑️ El borrador <code>${draftId}</code> ha sido descartado.`, {
        replyMarkup: { inline_keyboard: [[{ text: "🔙 Volver a Blog", callback_data: "menu:blog" }]] }
      });
      return { ok: true, route: "draft_discarded", draftId };
    }

    // Blog: Confirmación de publicación curada directa
    if (data === "blog:confirm_curated") {
      const text = `<b>⚠️ CONFIRMACIÓN DE ACCIÓN SENSIBLE</b>\n\n¿Estás seguro de que deseas forzar la publicación inmediata de un tema curado?\n\nEsta acción consumirá el siguiente tema disponible y lo publicará directamente en producción.`;
      const replyMarkup = {
        inline_keyboard: [
          [
            { text: "✅ Sí, publicar de inmediato", callback_data: "blog:exec_curated" },
            { text: "❌ Cancelar", callback_data: "menu:blog" }
          ]
        ]
      };
      await editTelegramMessage(token, chatId, msgId, text, { replyMarkup });
      return { ok: true, route: "confirm_curated" };
    }

    return { ok: true, route: "unknown_callback", data };
  },

  async handleTextMessage(message, env, ctx, { userId, username, chatId, ip }) {
    const text = message.text.trim();
    const token = env.BOT_TOKEN_SECRETO;

    if (text === "/start" || text === "/menu") {
      const menu = renderMainMenu();
      await sendTelegramMessage(token, chatId, menu.text, { replyMarkup: menu.replyMarkup });
      return { ok: true, route: "main_menu" };
    }

    // Comprobar si el usuario estaba en estado de ingreso de tema
    let userState = null;
    if (env.ADMIN_KV) {
      const rawState = await env.ADMIN_KV.get(`user_state:${userId}`);
      if (rawState) userState = JSON.parse(rawState);
    }

    if (userState && userState.action === "awaiting_blog_topic") {
      // Limpiar estado
      if (env.ADMIN_KV) await env.ADMIN_KV.delete(`user_state:${userId}`);

      const articleTypeNum = userState.articleType || 2;
      let requestedTema = text;
      let additionalInstructions = "";
      let targetWords = null;

      // Parsear formato "Tema | Instrucciones / palabras" si el usuario usó separador
      if (text.includes("|")) {
        const parts = text.split("|");
        requestedTema = parts[0].trim();
        additionalInstructions = parts.slice(1).join("|").trim();
        const wordMatch = additionalInstructions.match(/(\d{3,4})\s*palabras?/i);
        if (wordMatch) {
          targetWords = parseInt(wordMatch[1], 10);
        }
      }

      const stageLabels = {
        received: "📥 Solicitud recibida",
        queued: "⏳ En cola de procesamiento",
        brief_generating: "🧠 Creando Brief Estratégico",
        brief_completed: "📋 Brief completado",
        section_generating: "✍️ Redactando contenido por secciones",
        section_completed: "📊 Secciones redactadas",
        expanding: "🔍 Ampliando sección quirúrgicamente",
        condensing: "✂️ Condensando sección quirúrgicamente",
        semantic_auditing: "🧐 Auditoría semántica con IA",
        quality_gate: "✅ Quality Gate superado",
        quality_gate_retry: "⚠️ Ajustando Quality Gate",
        draft_saving: "💾 Guardando borrador en base de datos",
        completed: "🎉 Borrador listo",
        failed: "❌ Falló el procesamiento"
      };

      const formatProgressText = (stage, wordCount = 0, extraInfo = "") => {
        const stageText = stageLabels[stage] || `⚙️ ${stage}`;
        let msg = `<b>⏳ Generando borrador editorial...</b>\n\n` +
          `• <b>Tema:</b> "${escapeHtml(requestedTema)}"\n` +
          `• <b>Perfil:</b> Tipo ${articleTypeNum} (Objetivo: ${targetWords || "Estándar"} palabras)\n` +
          `• <b>Estado:</b> ${stageText}\n`;
        if (wordCount > 0) {
          msg += `• <b>Conteo actual:</b> ${wordCount} palabras\n`;
        }
        if (extraInfo) {
          msg += `• <i>${escapeHtml(extraInfo)}</i>\n`;
        }
        msg += `\n<i>Puedes pulsar el botón inferior para consultar el estado en tiempo real.</i>`;
        return msg;
      };

      // 1. Crear Job asíncrono persistente en D1 primero para tener el jobId exacto
      const jobId = "job_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);

      const statusMarkup = {
        inline_keyboard: [
          [{ text: "🔎 Consultar estado", callback_data: `job:status:${jobId}` }],
          [{ text: "🔙 Volver a Blog", callback_data: "menu:blog" }]
        ]
      };

      const initialText = formatProgressText("queued", 0, "Inicializando Workers AI...");
      const sentMsg = await sendTelegramMessage(token, chatId, initialText, { replyMarkup: statusMarkup });
      const msgId = sentMsg?.result?.message_id;

      if (env.BLOG_DB) {
        await createJob(env.BLOG_DB, {
          id: jobId,
          jobType: "blog_generate_draft",
          userId,
          chatId,
          messageId: msgId,
          payload: {
            tema: requestedTema,
            articleType: articleTypeNum,
            additionalInstructions,
            targetWords,
            ip,
            username
          }
        });
      }

      // 2. Procesador en segundo plano con reclamación atómica y renovación de candado
      const runJob = async () => {
        let claimed = null;
        if (env.BLOG_DB) {
          claimed = await claimSpecificJob(env.BLOG_DB, jobId, 180);
          if (!claimed) {
            console.log(`[JOB SKIP] Job ${jobId} ya fue reclamado o está siendo procesado`);
            return;
          }
        }

        const expectedAttempts = claimed?.attempts || 1;
        let lastMsgEditTime = 0;

        const onHeartbeat = async (stage, wordCount = 0, details = null) => {
          if (env.BLOG_DB) {
            await renewJobLock(env.BLOG_DB, jobId, expectedAttempts, 180, stage, wordCount, details);
          }
          // Actualizar Telegram con throttle seguro (máximo una edición cada 4 segundos para evitar rate limit)
          const now = Date.now();
          if (msgId && (now - lastMsgEditTime > 4000 || stage === "draft_saving" || stage === "quality_gate")) {
            lastMsgEditTime = now;
            let extra = "";
            if (details?.sectionIndex) extra = `Sección ${details.sectionIndex} de ${details.totalSections}`;
            else if (details?.score) extra = `Puntuación: ${details.score}/100`;
            const textUpdate = formatProgressText(stage, wordCount, extra);
            await editTelegramMessage(token, chatId, msgId, textUpdate, { replyMarkup: statusMarkup }).catch(() => null);
          }
        };

        try {
          const draft = await generateManualDraft(env, {
            tema: requestedTema,
            userId,
            articleType: articleTypeNum,
            targetWords,
            additionalInstructions,
            onHeartbeat
          });
          await logAdminAction(env.BLOG_DB, {
            userId,
            username,
            action: "BLOG_DRAFT_REQUEST",
            entityId: draft.id,
            details: { tema: requestedTema, title: draft.title, words: draft.wordCount, articleType: articleTypeNum },
            ip
          });

          const publishEnabled = String(env.ADMIN_PUBLISH_ENABLED).toLowerCase() === "true";
          const actionRow = [];
          if (draft.status === "draft") {
            actionRow.push({ text: "✅ Aprobar Borrador", callback_data: `draft:approve_only:${draft.id}` });
          }
          if (publishEnabled && draft.status === "approved") {
            actionRow.push({ text: "🚀 Publicar Artículo", callback_data: `draft:publish_confirm:${draft.id}` });
          }
          actionRow.push({ text: "🗑️ Descartar", callback_data: `draft:discard:${draft.id}` });

          const previewText = `<b>📋 BORRADOR EDITORIAL GENERADO CON ÉXITO</b>\n\n` +
            `• <b>Título:</b> ${escapeHtml(draft.title)}\n` +
            `• <b>Categoría:</b> ${draft.tag}\n` +
            `• <b>Extensión real:</b> ${draft.wordCount} palabras\n` +
            `• <b>Quality Gate:</b> Aprobado ✅\n\n` +
            `<b>Resumen BLUF:</b>\n<i>${escapeHtml(draft.excerpt)}</i>\n\n` +
            `<i>Estado de publicación: ${publishEnabled ? "🟢 Habilitada" : "🔒 Deshabilitada (ADMIN_PUBLISH_ENABLED=false)"}</i>`;

          const replyMarkup = {
            inline_keyboard: [
              actionRow,
              [
                { text: "📖 Leer Completo", callback_data: `draft:read_full:${draft.id}` },
                { text: "✏️ Modificar", callback_data: `draft:modify_prompt:${draft.id}` }
              ],
              [
                { text: "🔙 Volver al Menú", callback_data: "menu:blog" }
              ]
            ]
          };

          if (msgId) {
            await editTelegramMessage(token, chatId, msgId, previewText, { replyMarkup });
          } else {
            await sendTelegramMessage(token, chatId, previewText, { replyMarkup });
          }

          if (env.BLOG_DB) {
            const completed = await markJobCompleted(env.BLOG_DB, jobId, { draftId: draft.id }, expectedAttempts);
            if (!completed) {
              console.warn(`[CONCURRENCY WARN] Job ${jobId} no pudo ser marcado como completed con attempts=${expectedAttempts}`);
            }
          }
        } catch (err) {
          const isDeterministicEditorialError =
            err.message.includes("Extensión insuficiente") ||
            err.message.includes("Extensión excesiva") ||
            err.message.includes("Párrafos duplicados") ||
            err.message.includes("Quality Gate");

          const errorText = `<b>❌ Falló la generación del borrador:</b>\n${escapeHtml(err.message)}\n\nPuedes intentar nuevamente con otro enfoque o volver al menú.`;
          const errorMarkup = {
            inline_keyboard: [
              [
                { text: "🔄 Reintentar Solicitud", callback_data: `blog:type:${articleTypeNum}` },
                { text: "🔙 Volver a Blog", callback_data: "menu:blog" }
              ]
            ]
          };
          if (msgId) {
            await editTelegramMessage(token, chatId, msgId, errorText, {
              replyMarkup: errorMarkup
            });
          } else {
            await sendTelegramMessage(token, chatId, errorText, { replyMarkup: errorMarkup });
          }
          if (env.BLOG_DB) {
            await markJobFailed(
              env.BLOG_DB,
              jobId,
              err.message,
              expectedAttempts,
              isDeterministicEditorialError,
              isDeterministicEditorialError ? "QUALITY_GATE_EDITORIAL" : "TECHNICAL"
            );
          }
        }
      };

      // Desacoplar la ejecución pesada para responder inmediatamente al webhook de Telegram (<500ms)
      if (ctx && typeof ctx.waitUntil === "function") {
        ctx.waitUntil(runJob());
      } else {
        // En entornos de testing o fallback, permitir ejecución asíncrona sin bloquear la respuesta
        runJob().catch((e) => console.error("[ASYNC JOB ERROR]", e.message));
      }

      return { ok: true, route: "draft_job_queued", jobId };
    }

    if (userState && userState.action === "awaiting_draft_modification") {
      const draftId = userState.draftId;
      if (env.ADMIN_KV) await env.ADMIN_KV.delete(`user_state:${userId}`);

      const sentMsg = await sendTelegramMessage(token, chatId, `<b>⏳ Aplicando modificaciones al borrador...</b>\n• ID: <code>${draftId}</code>\n• Instrucciones: "${escapeHtml(text)}"\n• Verificando Quality Gate Fase 6L...`);
      const msgId = sentMsg?.result?.message_id;

      const runMod = async () => {
        try {
          const updated = await modifyDraftWithInstructions(env, { draftId, instructions: text, userId });
          await logAdminAction(env.BLOG_DB, {
            userId,
            username,
            action: "BLOG_DRAFT_MODIFY",
            entityId: draftId,
            details: { instructions: text, title: updated.title, words: updated.wordCount },
            ip
          });

          const successText = `<b>✏️ BORRADOR MODIFICADO EXITOSAMENTE</b>\n\n` +
            `• <b>Título:</b> ${escapeHtml(updated.title)}\n` +
            `• <b>Categoría:</b> ${updated.tag}\n` +
            `• <b>Extensión real:</b> ${updated.wordCount} palabras\n` +
            `• <b>Quality Gate:</b> Aprobado ✅\n\n` +
            `<b>Resumen BLUF:</b>\n<i>${escapeHtml(updated.excerpt)}</i>`;

          const replyMarkup = {
            inline_keyboard: [
              [
                { text: "📖 Leer Completo", callback_data: `draft:read_full:${draftId}` },
                { text: "✏️ Más Cambios", callback_data: `draft:modify_prompt:${draftId}` }
              ],
              [
                { text: "🔄 Regenerar", callback_data: `draft:regen_confirm:${draftId}` },
                { text: "🗑️ Descartar", callback_data: `draft:discard_confirm:${draftId}` }
              ],
              [
                { text: "🔙 Menú Borradores", callback_data: "blog:drafts:0" }
              ]
            ]
          };

          if (msgId) {
            await editTelegramMessage(token, chatId, msgId, successText, { replyMarkup });
          } else {
            await sendTelegramMessage(token, chatId, successText, { replyMarkup });
          }
        } catch (err) {
          const errorText = `<b>❌ Falló la modificación del borrador:</b>\n${escapeHtml(err.message)}`;
          if (msgId) {
            await editTelegramMessage(token, chatId, msgId, errorText, {
              replyMarkup: { inline_keyboard: [[{ text: "🔙 Volver", callback_data: `draft:view:${draftId}` }]] }
            });
          } else {
            await sendTelegramMessage(token, chatId, errorText);
          }
        }
      };

      if (ctx && typeof ctx.waitUntil === "function") {
        ctx.waitUntil(runMod());
      } else {
        await runMod();
      }

      return { ok: true, route: "draft_modification_dispatched", draftId };
    }

    // Comprobar si el usuario estaba en estado de búsqueda de artículos
    if (userState && userState.action === "awaiting_article_search") {
      if (env.ADMIN_KV) await env.ADMIN_KV.delete(`user_state:${userId}`);
      const searchTerm = text.trim();
      const results = await searchArticles(env.BLOG_DB, searchTerm, 5, 0);

      let resultText = `<b>🔍 RESULTADOS DE BÚSQUEDA</b>\n` +
        `• <b>Término:</b> "${escapeHtml(searchTerm)}"\n` +
        `• <b>Coincidencias encontradas:</b> ${results.total}\n\n`;

      if (results.posts.length === 0) {
        resultText += `<i>No se encontraron artículos que coincidan con la búsqueda.</i>\nPrueba con otra palabra clave o slug.`;
      } else {
        results.posts.forEach((p, idx) => {
          const statusIcon = p.status === "published" ? "🟢" : "🔴";
          resultText += `<b>${idx + 1}. ${statusIcon} ${escapeHtml(p.title)}</b>\n`;
          resultText += `   🏷️ <i>${p.tag}</i> · 📅 ${p.date} · <code>${p.status}</code>\n`;
          resultText += `   🔗 <code>${p.slug}</code>\n\n`;
        });
      }

      const inline_keyboard = [];
      for (const p of results.posts) {
        const ref = p.id || p.slug;
        const shortTitle = p.title.length > 25 ? p.title.slice(0, 25) + "…" : p.title;
        inline_keyboard.push([
          { text: `🏛️ Ver #${p.id || ""} (${shortTitle})`, callback_data: `post:manage:${ref}` }
        ]);
      }
      inline_keyboard.push([
        { text: "🔍 Nueva Búsqueda", callback_data: "blog:search_prompt" },
        { text: "🔙 Volver a Blog", callback_data: "menu:blog" }
      ]);

      await sendTelegramMessage(token, chatId, resultText, { replyMarkup: { inline_keyboard } });
      return { ok: true, route: "article_search_results", term: searchTerm, total: results.total };
    }

    // Comprobación de comando directo /buscar <termino>
    if (text.startsWith("/buscar ")) {
      const searchTerm = text.replace("/buscar ", "").trim();
      const results = await searchArticles(env.BLOG_DB, searchTerm, 5, 0);

      let resultText = `<b>🔍 RESULTADOS DE BÚSQUEDA</b>\n` +
        `• <b>Término:</b> "${escapeHtml(searchTerm)}"\n` +
        `• <b>Coincidencias encontradas:</b> ${results.total}\n\n`;

      if (results.posts.length === 0) {
        resultText += `<i>No se encontraron artículos que coincidan con la búsqueda.</i>`;
      } else {
        results.posts.forEach((p, idx) => {
          const statusIcon = p.status === "published" ? "🟢" : "🔴";
          resultText += `<b>${idx + 1}. ${statusIcon} ${escapeHtml(p.title)}</b>\n`;
          resultText += `   🏷️ <i>${p.tag}</i> · 📅 ${p.date} · <code>${p.status}</code>\n`;
          resultText += `   🔗 <code>${p.slug}</code>\n\n`;
        });
      }

      const inline_keyboard = [];
      for (const p of results.posts) {
        const ref = p.id || p.slug;
        const shortTitle = p.title.length > 25 ? p.title.slice(0, 25) + "…" : p.title;
        inline_keyboard.push([
          { text: `🏛️ Ver #${p.id || ""} (${shortTitle})`, callback_data: `post:manage:${ref}` }
        ]);
      }
      inline_keyboard.push([
        { text: "🔍 Nueva Búsqueda", callback_data: "blog:search_prompt" },
        { text: "🔙 Volver a Blog", callback_data: "menu:blog" }
      ]);

      await sendTelegramMessage(token, chatId, resultText, { replyMarkup: { inline_keyboard } });
      return { ok: true, route: "article_search_results_cmd", term: searchTerm, total: results.total };
    }

    // Comprobación de comandos de edición de bloques: /set_block_<slug>_<index> <nuevo_texto>
    const blockCmdMatch = text.match(/^\/set_block_([a-zA-Z0-9_-]+)_(\d+)\s+([\s\S]+)$/);
    if (blockCmdMatch) {
      const slug = blockCmdMatch[1];
      const blockIndex = parseInt(blockCmdMatch[2], 10);
      const newBlockText = blockCmdMatch[3].trim();

      const post = await getPostBySlugForAdmin(env.BLOG_DB, slug);
      if (!post) {
        await sendTelegramMessage(token, chatId, `❌ Artículo con slug <code>${escapeHtml(slug)}</code> no encontrado.`);
        return { ok: false, error: "Artículo no encontrado" };
      }

      const content = Array.isArray(post.content) ? [...post.content] : [];
      if (!content[blockIndex]) {
        await sendTelegramMessage(token, chatId, `❌ Bloque #${blockIndex + 1} no existe en este artículo.`);
        return { ok: false, error: "Bloque no encontrado" };
      }

      const oldBlock = content[blockIndex];
      const oldValue = oldBlock.text || "";
      const updatedBlock = { ...oldBlock, text: newBlockText };
      const updatedContent = content.map((b, idx) => idx === blockIndex ? updatedBlock : b);

      const jobId = "edit_blk_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);

      if (env.BLOG_DB) {
        await createJob(env.BLOG_DB, {
          id: jobId,
          jobType: "blog_edit_field",
          userId,
          chatId,
          payload: {
            slug,
            field: "content_block",
            blockIndex,
            newValue: newBlockText,
            oldValue,
            updatedContent
          }
        });
      }

      const ref = post.id || slug;
      const typeBadge = oldBlock.type === "h2" ? "Encabezado H2" : oldBlock.type === "h3" ? "Subtítulo H3" : "Párrafo";
      const previewText = `<b>👁️ PROPUESTA DE CAMBIO — VISTA PREVIA (DIFF) BLOQUE #${blockIndex + 1} (${typeBadge})</b>\n\n` +
        `• <b>Artículo:</b> <code>${slug}</code>\n\n` +
        `<b>Antes:</b>\n<s>${escapeHtml(oldValue)}</s>\n\n` +
        `<b>Después:</b>\n<b>${escapeHtml(newBlockText)}</b>\n\n` +
        `<i>¿Deseas aplicar este cambio al cuerpo del artículo? Se creará un respaldo histórico automático.</i>`;

      const replyMarkup = {
        inline_keyboard: [
          [{ text: "💾 Sí, Guardar en Producción", callback_data: `post:edit_confirm:${jobId}` }],
          [{ text: "❌ Cancelar", callback_data: `post:blocks:${ref}:${Math.floor(blockIndex / 5)}` }]
        ]
      };

      await sendTelegramMessage(token, chatId, previewText, { replyMarkup });
      return { ok: true, route: "article_block_diff_ready", jobId, slug, blockIndex };
    }

    // Comprobación de comandos de edición: /set_<field>_<slug> <nuevo_valor>
    const editCmdMatch = text.match(/^\/set_(title|excerpt|tag)_([a-zA-Z0-9_-]+)\s+([\s\S]+)$/);
    if (editCmdMatch) {
      const field = editCmdMatch[1];
      const slug = editCmdMatch[2];
      const newValue = editCmdMatch[3].trim();

      const post = await getPostBySlugForAdmin(env.BLOG_DB, slug);
      if (!post) {
        await sendTelegramMessage(token, chatId, `❌ Artículo con slug <code>${escapeHtml(slug)}</code> no encontrado.`);
        return { ok: false, error: "Artículo no encontrado" };
      }

      const oldValue = post[field] || "";
      const jobId = "edit_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);

      if (env.BLOG_DB) {
        await createJob(env.BLOG_DB, {
          id: jobId,
          jobType: "blog_edit_field",
          userId,
          chatId,
          payload: {
            slug,
            field,
            newValue,
            oldValue
          }
        });
      }

      const ref = post.id || slug;
      const previewText = `<b>👁️ PROPUESTA DE CAMBIO — VISTA PREVIA (DIFF)</b>\n\n` +
        `• <b>Artículo:</b> <code>${slug}</code>\n` +
        `• <b>Campo:</b> <code>${field}</code>\n\n` +
        `<b>Antes:</b>\n<s>${escapeHtml(oldValue)}</s>\n\n` +
        `<b>Después:</b>\n<b>${escapeHtml(newValue)}</b>\n\n` +
        `<i>¿Deseas aplicar este cambio en D1 (y sincronizar KV si el artículo está publicado)? Se creará un respaldo histórico automático.</i>`;

      const replyMarkup = {
        inline_keyboard: [
          [{ text: "💾 Sí, Guardar en Producción", callback_data: `post:edit_confirm:${jobId}` }],
          [{ text: "❌ Cancelar", callback_data: `post:manage:${ref}` }]
        ]
      };

      await sendTelegramMessage(token, chatId, previewText, { replyMarkup });
      return { ok: true, route: "article_edit_diff_ready", jobId, slug, field };
    }

    // Mensaje libre no reconocido
    await sendTelegramMessage(token, chatId, `Usa /menu para acceder al panel principal de Canedo Studio.`);
    return { ok: true, route: "fallback_text" };
  },

  async recoverInterruptedJobs(env) {
    if (!env.BLOG_DB) return { processed: 0 };
    let processed = 0;
    const token = env.BOT_TOKEN_SECRETO;

    for (let i = 0; i < 5; i++) {
      // Filtrar jobs viejos (>60 minutos) para evitar ejecuciones no deseadas de solicitudes antiguas
      const maxAgeMinutes = Number(env.MAX_JOB_AGE_MINUTES) || 60;
      const job = await claimNextJob(env.BLOG_DB, 120, maxAgeMinutes);
      if (!job) break;

      const expectedAttempts = job.attempts;
      const onHeartbeat = async (stage, wordCount = 0, details = null) => {
        if (env.BLOG_DB) {
          await renewJobLock(env.BLOG_DB, job.id, expectedAttempts, 180, stage, wordCount, details);
        }
      };

      try {
        if (job.jobType === "blog_generate_draft") {
          const { tema, ip, username, articleType, targetWords, additionalInstructions } = job.payload;
          const draft = await generateManualDraft(env, {
            tema,
            userId: job.userId,
            articleType: articleType || 2,
            targetWords,
            additionalInstructions,
            onHeartbeat
          });
          await logAdminAction(env.BLOG_DB, {
            userId: job.userId,
            username,
            action: "BLOG_DRAFT_REQUEST_RETRY",
            entityId: draft.id,
            details: { tema, title: draft.title, attempts: job.attempts, articleType },
            ip
          });

          const publishEnabled = String(env.ADMIN_PUBLISH_ENABLED).toLowerCase() === "true";
          const actionRow = [];
          if (draft.status === "draft") {
            actionRow.push({ text: "✅ Aprobar Borrador", callback_data: `draft:approve_only:${draft.id}` });
          }
          if (publishEnabled && draft.status === "approved") {
            actionRow.push({ text: "🚀 Publicar Artículo", callback_data: `draft:publish_confirm:${draft.id}` });
          }
          actionRow.push({ text: "🗑️ Descartar", callback_data: `draft:discard:${draft.id}` });

          const previewText = `<b>📋 BORRADOR EDITORIAL GENERADO (RECUPERADO CON ÉXITO)</b>\n\n` +
            `• <b>Título:</b> ${escapeHtml(draft.title)}\n` +
            `• <b>Categoría:</b> ${draft.tag}\n` +
            `• <b>Extensión real:</b> ${draft.wordCount} palabras\n` +
            `• <b>Quality Gate:</b> Aprobado ✅\n\n` +
            `<b>Resumen BLUF:</b>\n<i>${escapeHtml(draft.excerpt)}</i>\n\n` +
            `<i>Estado de publicación: ${publishEnabled ? "🟢 Habilitada" : "🔒 Deshabilitada (ADMIN_PUBLISH_ENABLED=false)"}</i>`;

          const replyMarkup = {
            inline_keyboard: [
              actionRow,
              [
                { text: "📖 Leer Completo", callback_data: `draft:read_full:${draft.id}` },
                { text: "✏️ Modificar", callback_data: `draft:modify_prompt:${draft.id}` }
              ],
              [{ text: "🔙 Volver al Menú", callback_data: "menu:blog" }]
            ]
          };

          if (job.messageId) {
            await editTelegramMessage(token, job.chatId, job.messageId, previewText, { replyMarkup });
          } else {
            await sendTelegramMessage(token, job.chatId, previewText, { replyMarkup });
          }

          await markJobCompleted(env.BLOG_DB, job.id, { draftId: draft.id }, expectedAttempts);
          processed++;
        } else if (job.jobType === "blog_publish_approved") {
          const { draftId, ip, username } = job.payload;
          const { slug, post } = await publishApprovedDraft(env, draftId, job.userId);
          await logAdminAction(env.BLOG_DB, {
            userId: job.userId,
            username,
            action: "BLOG_DRAFT_APPROVE_RETRY",
            entityId: draftId,
            details: { slug, title: post.title, attempts: job.attempts },
            ip
          });

          const successText = `<b>✅ Artículo publicado</b>\n\n` +
            `• <b>Título:</b> ${escapeHtml(post.title)}\n` +
            `• <b>Categoría:</b> ${post.tag}\n` +
            `• <b>Extensión real:</b> ${post.readingTime} (cuerpo completo)\n` +
            `• <b>Slug:</b> <code>${slug}</code>\n` +
            `• <b>Estado:</b> En producción (D1 + KV)\n\n` +
            `🔗 <b>Enlace público:</b>\nhttps://canedostudio.com/insights/${slug}`;
          const replyMarkup = {
            inline_keyboard: [
              [{ text: "🌐 Ver en mi web", url: `https://canedostudio.com/insights/${slug}` }],
              [{ text: "🔙 Volver a Blog", callback_data: "menu:blog" }]
            ]
          };
          if (job.messageId) {
            await editTelegramMessage(token, job.chatId, job.messageId, successText, { replyMarkup });
          } else {
            await sendTelegramMessage(token, job.chatId, successText, { replyMarkup });
          }
          await markJobCompleted(env.BLOG_DB, job.id, { slug }, expectedAttempts);
          processed++;
        } else {
          await markJobFailed(env.BLOG_DB, job.id, "Tipo de job desconocido: " + job.jobType, expectedAttempts, true, "UNKNOWN_JOB");
        }
      } catch (err) {
        console.error(`[JOB RECOVERY ERROR] Job ${job.id} falló en intento ${job.attempts}:`, err.message);
        const isDeterministicEditorialError =
          err.message.includes("Extensión insuficiente") ||
          err.message.includes("Extensión excesiva") ||
          err.message.includes("Párrafos duplicados") ||
          err.message.includes("Quality Gate");

        // Si es un error editorial determinista o alcanza el intento 3, se marca como terminal para no quemar tokens
        const isTerminal = isDeterministicEditorialError || job.attempts >= 3;
        await markJobFailed(
          env.BLOG_DB,
          job.id,
          err.message,
          expectedAttempts,
          isTerminal,
          isDeterministicEditorialError ? "QUALITY_GATE_EDITORIAL" : "TECHNICAL"
        );
        
        // Si el job ha alcanzado un estado terminal, actualizar el mensaje en Telegram
        if (isTerminal && job.messageId) {
          const failureText = `<b>❌ Falló la generación del borrador tras ${job.attempts} intento(s):</b>\n${escapeHtml(err.message)}\n\nPuedes intentar nuevamente con otro enfoque o volver al menú.`;
          const replyMarkup = {
            inline_keyboard: [
              [
                { text: "🔄 Reintentar Solicitud", callback_data: `blog:type:${job.payload?.articleType || 2}` },
                { text: "🔙 Volver a Blog", callback_data: "menu:blog" }
              ]
            ]
          };
          await editTelegramMessage(token, job.chatId, job.messageId, failureText, { replyMarkup });
        }
      }
    }

    return { processed };
  },

  async scheduled(event, env, ctx) {
    // Scheduled trigger seguro: Procesar exclusivamente trabajos asíncronos pendientes de administración
    console.log(`[CANEDO-ADMIN SCHEDULED] Ejecutando recuperación programada de trabajos administrativos...`);
    if (ctx && typeof ctx.waitUntil === "function") {
      ctx.waitUntil(this.recoverInterruptedJobs(env));
    } else {
      await this.recoverInterruptedJobs(env);
    }
  }
};

