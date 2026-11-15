// File: automatismos/canedo-admin/src/telegram.js
// Cliente modular para Telegram Bot API con soporte para teclados interactivos, validación de entrega y fallback a texto plano

export async function sendTelegramMessage(token, chatId, text, options = {}) {
  if (!token || !chatId) return { ok: false, description: "Missing token or chatId" };
  if (token === "fake_token" || token.startsWith("mock_")) {
    return { ok: true, result: { message_id: 1234 } };
  }
  const payload = {
    chat_id: chatId,
    text: String(text || "").slice(0, 4000),
    parse_mode: options.parseMode !== undefined ? options.parseMode : "HTML",
    disable_web_page_preview: options.disablePreview !== false,
    reply_markup: options.replyMarkup || undefined
  };

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => null);
    if (res.ok && data && data.ok) {
      return data;
    }

    // Si falló por formato de entidades HTML (400 Bad Request: can't parse entities)
    // intentar fallback inmediato en texto plano sin parse_mode
    if (payload.parse_mode) {
      console.warn(`[TELEGRAM SEND WARN] Falló sendMessage con parse_mode=${payload.parse_mode} (${data?.description || res.status}). Reintentando texto plano.`);
      const plainPayload = { ...payload, parse_mode: undefined };
      const fallbackRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(plainPayload)
      });
      const fallbackData = await fallbackRes.json().catch(() => null);
      if (fallbackRes.ok && fallbackData && fallbackData.ok) {
        return fallbackData;
      }
      return fallbackData || { ok: false, status: fallbackRes.status, description: "Telegram sendMessage fallback failed" };
    }

    return data || { ok: false, status: res.status, description: "Telegram sendMessage failed" };
  } catch (netErr) {
    console.error("[TELEGRAM SEND ERROR] Excepción de red en sendMessage:", netErr.message);
    return { ok: false, error: netErr.message };
  }
}

export async function editTelegramMessage(token, chatId, messageId, text, options = {}) {
  if (!token || !chatId || !messageId) return { ok: false, description: "Missing parameters" };
  if (token === "fake_token" || token.startsWith("mock_")) {
    return { ok: true, result: { message_id: messageId } };
  }
  const payload = {
    chat_id: chatId,
    message_id: messageId,
    text: String(text || "").slice(0, 4000),
    parse_mode: options.parseMode !== undefined ? options.parseMode : "HTML",
    disable_web_page_preview: options.disablePreview !== false,
    reply_markup: options.replyMarkup || undefined
  };

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => null);
    if (res.ok && data && data.ok) {
      return data;
    }

    // Si la edición falla (400 Bad Request: message is not modified, can't parse entities, o mensaje borrado)
    // intentar como fallback enviar un mensaje nuevo para que el usuario nunca quede desinformado
    console.warn(`[TELEGRAM EDIT WARN] Falló editMessageText msgId=${messageId} (${data?.description || res.status}). Ejecutando fallback a sendMessage.`);
    const fallbackRes = await sendTelegramMessage(token, chatId, text, options);
    if (fallbackRes && fallbackRes.ok) {
      return fallbackRes;
    }

    return data || { ok: false, status: res.status, description: "Telegram editMessageText failed" };
  } catch (netErr) {
    console.error("[TELEGRAM EDIT ERROR] Excepción de red en editMessageText:", netErr.message);
    // Intentar fallback a sendTelegramMessage ante error de red
    return await sendTelegramMessage(token, chatId, text, options);
  }
}

export async function answerCallbackQuery(token, callbackQueryId, text = "", showAlert = false) {
  if (!token || !callbackQueryId) return null;
  const payload = {
    callback_query_id: callbackQueryId,
    text: text,
    show_alert: showAlert
  };

  const res = await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  try {
    return await res.json();
  } catch {
    return { ok: res.ok, status: res.status };
  }
}

export function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

