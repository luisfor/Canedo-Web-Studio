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
  getJobEvents
} from "./db.js";
import {
  generateManualDraft,
  modifyDraftWithInstructions,
  regenerateDraft,
  publishApprovedDraft,
  discardDraft
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
    `• <b>Artículos en catálogo:</b> 73 (D1 activo)\n` +
    `• <b>Última publicación:</b> <code>${lastPublished} UTC</code>\n` +
    `• <b>Quality Gate:</b> Fase 6L (650–900 palabras reales, cero repetición)\n` +
    `• <b>Próximo cron:</b> 17:00 COL (22:00 UTC)\n\n` +
    `Elige una acción:`;

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: "✍️ Crear Artículo con IA", callback_data: "blog:create_prompt" },
        { text: "📂 Ver Mis Borradores", callback_data: "blog:drafts:0" }
      ],
      [
        { text: "📚 Consultar Artículos Existentes", callback_data: "blog:list:0" }
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

    await answerCallbackQuery(token, cq.id);

    // Navegación: Menú principal
    if (data === "menu:main") {
      const menu = renderMainMenu();
      await editTelegramMessage(token, chatId, msgId, menu.text, { replyMarkup: menu.replyMarkup });
      return { ok: true, route: "main_menu" };
    }

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

      // Mostrar popup interactivo inmediato sin recargar la pantalla
      await answerCallbackQuery(token, cq.id, statusSummary, true);
      return { ok: true, route: "job_status_checked", targetJobId, status: job.status, stage: job.current_stage };
    }

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

    // Blog: Listar artículos paginados
    if (data.startsWith("blog:list:")) {
      const offset = parseInt(data.replace("blog:list:", "") || "0", 10);
      const res = await getRecentPublishedArticles(env.BLOG_DB, 5, offset);
      let text = `<b>📄 ARTÍCULOS PUBLICADOS (Total: ${res.total})</b>\n\n`;
      res.posts.forEach((p, i) => {
        text += `<b>${offset + i + 1}.</b> ${escapeHtml(p.title)}\n`;
        text += `   🏷️ <i>${p.tag}</i> · 📅 ${p.date}\n`;
        text += `   🔗 https://canedostudio.com/post.html?slug=${p.slug}\n\n`;
      });

      const navButtons = [];
      if (offset >= 5) {
        navButtons.push({ text: "⬅️ Anteriores", callback_data: `blog:list:${offset - 5}` });
      }
      if (offset + 5 < res.total) {
        navButtons.push({ text: "Siguientes ➡️", callback_data: `blog:list:${offset + 5}` });
      }

      const inline_keyboard = [];
      if (navButtons.length > 0) inline_keyboard.push(navButtons);
      inline_keyboard.push([{ text: "🔙 Volver a Blog", callback_data: "menu:blog" }]);

      await editTelegramMessage(token, chatId, msgId, text, { replyMarkup: { inline_keyboard } });
      return { ok: true, route: "blog_list", offset };
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

      const inline_keyboard = [
        [
          { text: "📖 Leer Completo", callback_data: `draft:read_full:${draft.id}` },
          { text: "✏️ Modificar con IA", callback_data: `draft:modify_prompt:${draft.id}` }
        ],
        [
          { text: "🔄 Regenerar", callback_data: `draft:regen_confirm:${draft.id}` },
          { text: "🗑️ Descartar", callback_data: `draft:discard_confirm:${draft.id}` }
        ],
        [
          { text: "🔙 Volver a Borradores", callback_data: "blog:drafts:0" }
        ]
      ];

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

    // Blog: Aprobación de borrador
    if (data.startsWith("draft:approve:")) {
      const draftId = data.replace("draft:approve:", "");
      await editTelegramMessage(token, chatId, msgId, `<b>⏳ Publicando artículo aprobado...</b>\nGenerando portada con Flux y persistiendo en D1 y KV...`);

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

          const successText = `<b>🎉 ¡ARTÍCULO PUBLICADO CON ÉXITO!</b>\n\n` +
            `• <b>Título:</b> ${escapeHtml(post.title)}\n` +
            `• <b>Categoría:</b> ${post.tag}\n` +
            `• <b>Slug:</b> <code>${slug}</code>\n` +
            `• <b>Lectura:</b> ${post.readingTime}\n\n` +
            `🔗 <a href="https://canedostudio.com/post.html?slug=${slug}">Ver artículo en producción</a>`;
          const replyMarkup = {
            inline_keyboard: [[{ text: "🔙 Volver a Blog", callback_data: "menu:blog" }]]
          };
          await editTelegramMessage(token, chatId, msgId, successText, { replyMarkup });
          if (env.BLOG_DB) {
            await markJobCompleted(env.BLOG_DB, jobId, { slug, title: post.title });
          }
        } catch (err) {
          await editTelegramMessage(token, chatId, msgId, `<b>❌ Error al publicar:</b> ${escapeHtml(err.message)}`, {
            replyMarkup: { inline_keyboard: [[{ text: "🔙 Volver a Blog", callback_data: "menu:blog" }]] }
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

          const previewText = `<b>📋 BORRADOR EDITORIAL GENERADO CON ÉXITO</b>\n\n` +
            `• <b>Título:</b> ${escapeHtml(draft.title)}\n` +
            `• <b>Categoría:</b> ${draft.tag}\n` +
            `• <b>Extensión real:</b> ${draft.wordCount} palabras\n` +
            `• <b>Quality Gate:</b> Aprobado ✅\n\n` +
            `<b>Resumen BLUF:</b>\n<i>${escapeHtml(draft.excerpt)}</i>\n\n` +
            `¿Deseas autorizar su publicación en producción?`;

          const replyMarkup = {
            inline_keyboard: [
              [
                { text: "🚀 Aprobar y Publicar", callback_data: `draft:approve:${draft.id}` },
                { text: "🗑️ Descartar", callback_data: `draft:discard:${draft.id}` }
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

          const previewText = `<b>📋 BORRADOR EDITORIAL GENERADO (RECUPERADO CON ÉXITO)</b>\n\n` +
            `• <b>Título:</b> ${escapeHtml(draft.title)}\n` +
            `• <b>Categoría:</b> ${draft.tag}\n` +
            `• <b>Extensión real:</b> ${draft.wordCount} palabras\n` +
            `• <b>Quality Gate:</b> Aprobado ✅\n\n` +
            `<b>Resumen BLUF:</b>\n<i>${escapeHtml(draft.excerpt)}</i>\n\n` +
            `¿Deseas autorizar su publicación en producción?`;

          const replyMarkup = {
            inline_keyboard: [
              [
                { text: "🚀 Aprobar y Publicar", callback_data: `draft:approve:${draft.id}` },
                { text: "🗑️ Descartar", callback_data: `draft:discard:${draft.id}` }
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

          const successText = `<b>🎉 ¡ARTÍCULO PUBLICADO CON ÉXITO (RECUPERADO)!</b>\n\n` +
            `• <b>Título:</b> ${escapeHtml(post.title)}\n` +
            `• <b>Slug:</b> <code>${slug}</code>\n\n` +
            `🔗 <a href="https://canedostudio.com/post.html?slug=${slug}">Ver artículo en producción</a>`;
          const replyMarkup = {
            inline_keyboard: [[{ text: "🔙 Volver a Blog", callback_data: "menu:blog" }]]
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

