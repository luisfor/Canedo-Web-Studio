// File: automatismos/canedo-admin/src/modules/crm/ui.js
// Vistas, mensajes HTML y teclados interactivos para el CRM comercial en Telegram

import { escapeHtml } from "../../telegram.js";
import { STATUS_LABELS, PRIORITY_LABELS, CRM_STATUS_MAP, CRM_STATUS_REVERSE } from "./service.js";

export function renderCrmMenu(summary) {
  const text =
    `<b>👥 CANEDO STUDIO — CRM COMERCIAL</b>\n\n` +
    `Gestiona los prospectos capturados a través del formulario web de contacto.\n\n` +
    `📊 <b>Resumen del Embudo:</b>\n` +
    `• 🟢 Nuevos: <b>${summary.nuevo}</b>\n` +
    `• 🔵 Contactados: <b>${summary.contactado}</b>\n` +
    `• 🟡 En Calificación: <b>${summary.en_calificacion}</b>\n` +
    `• 🟣 Propuesta Enviada: <b>${summary.propuesta_enviada}</b>\n` +
    `• 🏆 Ganados: <b>${summary.ganado}</b>\n` +
    `• 📦 Archivados: <b>${summary.archivado}</b>\n` +
    `────────────────────\n` +
    `📈 <b>Total de Prospectos:</b> <b>${summary.total}</b>\n\n` +
    `<i>Selecciona una acción:</i>`;

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: "📋 Ver Todos los Leads", callback_data: "crm:list:0:all" },
        { text: "🟢 Solo Nuevos", callback_data: "crm:list:0:nuevo" }
      ],
      [
        { text: "🟡 En Seguimiento", callback_data: "crm:list:0:en_calificacion" },
        { text: "🟣 Propuestas", callback_data: "crm:list:0:propuesta_enviada" }
      ],
      [
        { text: `📦 Solo Archivados (${summary.archivado})`, callback_data: "crm:list:0:archivado" },
        { text: "📊 Pipeline Detallado", callback_data: "crm:pipeline" }
      ],
      [
        { text: "🔙 Volver al Menú Principal", callback_data: "menu:main" }
      ]
    ]
  };

  return { text, replyMarkup };
}

export function renderLeadsList({ total, items, limit, offset, statusFilter }) {
  const filterName = statusFilter === "all" ? "Todos los Prospectos" : STATUS_LABELS[statusFilter] || statusFilter;
  let text = `<b>📋 CRM — LISTADO DE PROSPECTOS</b>\n`;
  text += `Filtro: <b>${filterName}</b> | Total: <b>${total}</b>\n\n`;

  if (items.length === 0) {
    text += `<i>No hay prospectos registrados con este criterio.</i>`;
  } else {
    for (const item of items) {
      const p = item.payload;
      const dateStr = new Date(item.createdAt).toISOString().split("T")[0];
      const statusIcon = STATUS_LABELS[item.status] || item.status;
      const serv = p.servicio || (Array.isArray(p.servicios) ? p.servicios.join(", ") : "General");
      text += `<b>#${item.leadNum} — ${escapeHtml(p.nombre || "Sin Nombre")}</b>\n`;
      text += `🏢 <b>Empresa:</b> ${escapeHtml(p.empresa || "Particular")}\n`;
      text += `🎯 <b>Servicio:</b> ${escapeHtml(serv)}\n`;
      text += `📊 <b>Estado:</b> ${statusIcon} | 📅 ${dateStr}\n`;
      if (item.pendingRemindersCount > 0) {
        text += `⏰ <b>Recordatorios pendientes:</b> ${item.pendingRemindersCount}\n`;
      }
      text += `────────────────────\n`;
    }
  }

  const inline_keyboard = [];

  // Botones para ver detalle de cada lead
  for (const item of items) {
    const p = item.payload;
    const shortName = (p.nombre || "Lead").slice(0, 15);
    inline_keyboard.push([
      { text: `👤 Ver #${item.leadNum} (${shortName})`, callback_data: `crm:v:${item.leadNum}` }
    ]);
  }

  // Paginación
  const navRow = [];
  if (offset > 0) {
    const prevOffset = Math.max(0, offset - limit);
    navRow.push({ text: "⬅️ Anterior", callback_data: `crm:list:${prevOffset}:${statusFilter}` });
  }
  if (offset + limit < total) {
    const nextOffset = offset + limit;
    navRow.push({ text: "Siguiente ➡️", callback_data: `crm:list:${nextOffset}:${statusFilter}` });
  }
  if (navRow.length > 0) {
    inline_keyboard.push(navRow);
  }

  // Filtros rápidos
  inline_keyboard.push([
    { text: "🟢 Solo Nuevos", callback_data: "crm:list:0:nuevo" },
    { text: "📦 Archivados", callback_data: "crm:list:0:archivado" },
    { text: "📋 Ver Todos", callback_data: "crm:list:0:all" }
  ]);
  inline_keyboard.push([
    { text: "🔙 Volver al CRM", callback_data: "menu:crm" }
  ]);

  return { text, replyMarkup: { inline_keyboard } };
}

export function renderLeadDetail(lead) {
  const p = lead.payload;
  const statusLabel = STATUS_LABELS[lead.status] || lead.status;
  const priorityLabel = PRIORITY_LABELS[lead.priority] || lead.priority;
  const dateStr = new Date(lead.createdAt).toLocaleString("es-CO", { timeZone: "America/Bogota" });

  let serviciosText = p.servicio || "No especificado";
  if (Array.isArray(p.servicios) && p.servicios.length > 0) {
    serviciosText = p.servicios.join(", ");
    if (p.servicio_otro) serviciosText += ` (${p.servicio_otro})`;
  }

  let text =
    `<b>👤 PROSPECTO COMERCIAL #${lead.leadNum}</b>\n\n` +
    `👤 <b>Contacto:</b> ${escapeHtml(p.nombre || "—")}\n` +
    `🏢 <b>Empresa:</b> ${escapeHtml(p.empresa || "—")}\n` +
    `📧 <b>Email:</b> <code>${escapeHtml(p.email || "—")}</code>\n` +
    `📱 <b>Teléfono:</b> <code>${escapeHtml(p.telefono || "—")}</code>\n` +
    `🎯 <b>Servicio:</b> ${escapeHtml(serviciosText)}\n` +
    `💰 <b>Presupuesto:</b> ${escapeHtml(p.presupuesto || "Por definir")}\n` +
    `📊 <b>Estado:</b> ${statusLabel}\n` +
    `⚡ <b>Prioridad:</b> ${priorityLabel}\n` +
    `📅 <b>Fecha:</b> ${dateStr}\n\n`;

  if (p.mensaje) {
    text += `💬 <b>Mensaje inicial:</b>\n<i>${escapeHtml(p.mensaje)}</i>\n\n`;
  }

  if (lead.reminders && lead.reminders.length > 0) {
    text += `⏰ <b>Próximas Acciones / Recordatorios:</b>\n`;
    for (const rem of lead.reminders) {
      const dueDate = new Date(rem.due_at).toLocaleDateString("es-CO", { timeZone: "America/Bogota" });
      text += `• [${dueDate}] ${escapeHtml(rem.reminder_text)}\n`;
    }
    text += `\n`;
  }

  if (lead.notes && lead.notes.length > 0) {
    text += `📝 <b>Últimas Notas:</b>\n`;
    for (const n of lead.notes.slice(0, 3)) {
      const nDate = new Date(n.created_at).toLocaleDateString("es-CO", { timeZone: "America/Bogota" });
      text += `• <i>(${nDate} - ${n.note_type}):</i> ${escapeHtml(n.content)}\n`;
    }
    text += `\n`;
  }

  const num = lead.leadNum;
  const isArchived = lead.status === "archivado";

  const replyMarkup = {
    inline_keyboard: []
  };

  if (isArchived) {
    // Si está archivado, ofrecer reactivación con confirmación
    replyMarkup.inline_keyboard.push([
      { text: "♻️ Reactivar Prospecto", callback_data: `crm:reactivate_ask:${num}` }
    ]);
  } else {
    // Botones de cambio de estado interactivo (usando códigos compactos < 64 bytes)
    replyMarkup.inline_keyboard.push([
      { text: "🔵 Contactado", callback_data: `crm:s:c:${num}` },
      { text: "🟡 Calificar", callback_data: `crm:s:q:${num}` },
      { text: "🟣 Propuesta", callback_data: `crm:s:p:${num}` }
    ]);
    replyMarkup.inline_keyboard.push([
      { text: "🏆 Ganado", callback_data: `crm:s:g:${num}` },
      { text: "📦 Archivar", callback_data: `crm:s:a:${num}` },
      { text: "🟢 Nuevo", callback_data: `crm:s:n:${num}` }
    ]);
  }

  // Acciones de notas y recordatorios
  replyMarkup.inline_keyboard.push([
    { text: "📝 Añadir Nota", callback_data: `crm:note_prompt:${num}` },
    { text: "⏰ Recordatorio", callback_data: `crm:rem_prompt:${num}` }
  ]);

  const backFilter = isArchived ? "archivado" : "all";
  replyMarkup.inline_keyboard.push([
    { text: "🔙 Volver a la Lista", callback_data: `crm:list:0:${backFilter}` }
  ]);

  return { text, replyMarkup };
}

export function renderReactivateConfirmation(lead) {
  const p = lead.payload;
  const num = lead.leadNum;
  const shortName = escapeHtml(p.nombre || "Sin Nombre");

  const text =
    `<b>♻️ CONFIRMAR REACTIVACIÓN DE PROSPECTO</b>\n\n` +
    `¿Deseas reactivar al prospecto <b>#${num} — ${shortName}</b>?\n\n` +
    `Al confirmar, el prospecto pasará de <b>📦 Archivado</b> a <b>🟢 Nuevo</b> y se registrará en la bitácora de auditoría.\n\n` +
    `<i>Todas las notas y recordatorios previos se preservarán intactos.</i>`;

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: "✅ Sí, Reactivar a Nuevo", callback_data: `crm:reactivate_do:${num}` }
      ],
      [
        { text: "❌ Cancelar", callback_data: `crm:v:${num}` }
      ]
    ]
  };

  return { text, replyMarkup };
}

export function renderPipelineView(summary) {
  let text =
    `<b>📊 RESUMEN DETALLADO DEL PIPELINE COMERCIAL</b>\n\n` +
    `• 🟢 <b>Nuevos:</b> ${summary.nuevo}\n` +
    `• 🔵 <b>Contactados:</b> ${summary.contactado}\n` +
    `• 🟡 <b>En Calificación:</b> ${summary.en_calificacion}\n` +
    `• 🟣 <b>Propuestas Enviadas:</b> ${summary.propuesta_enviada}\n` +
    `• 🏆 <b>Oportunidades Ganadas:</b> ${summary.ganado}\n` +
    `• 📦 <b>Archivados:</b> ${summary.archivado}\n` +
    `────────────────────\n` +
    `📈 <b>Total Registrados:</b> ${summary.total}\n\n`;

  if (summary.totalEstimatedValue > 0) {
    text += `💰 <b>Pipeline Estimado:</b> \$${summary.totalEstimatedValue.toLocaleString()} USD\n`;
    text += `💵 <b>Cerrado Ganado:</b> \$${summary.wonEstimatedValue.toLocaleString()} USD\n\n`;
  }

  text += `<i>Gestiona cada etapa seleccionando prospectos en el menú de listado.</i>`;

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: "📋 Ver Leads Activos", callback_data: "crm:list:0:all" },
        { text: "🟢 Nuevos Pendientes", callback_data: "crm:list:0:nuevo" }
      ],
      [
        { text: `📦 Solo Archivados (${summary.archivado})`, callback_data: "crm:list:0:archivado" },
        { text: "🔙 Volver al CRM", callback_data: "menu:crm" }
      ]
    ]
  };

  return { text, replyMarkup };
}

export function renderReminderNotification(rem) {
  const p = rem.payload;
  const shortName = escapeHtml(p.nombre || "Sin Nombre");
  const empresa = escapeHtml(p.empresa || "Particular");
  const dueStr = new Date(rem.dueAt).toLocaleDateString("es-CO", { timeZone: "America/Bogota" });

  const text =
    `<b>⏰ RECORDATORIO COMERCIAL VENCIDO</b>\n\n` +
    `👤 <b>Prospecto:</b> #${rem.leadNum} — ${shortName}\n` +
    `🏢 <b>Empresa:</b> ${empresa}\n` +
    `📱 <b>Teléfono:</b> <code>${escapeHtml(p.telefono || "—")}</code>\n` +
    `📧 <b>Email:</b> <code>${escapeHtml(p.email || "—")}</code>\n` +
    `📅 <b>Fecha programada:</b> ${dueStr}\n\n` +
    `🎯 <b>Acción Pendiente:</b>\n<i>${escapeHtml(rem.reminderText)}</i>`;

  // Callback data compacta < 64 bytes
  const replyMarkup = {
    inline_keyboard: [
      [
        { text: "✅ Marcar Hecho", callback_data: `crm:rem_done:${rem.id}` },
        { text: "⏰ +2 Días", callback_data: `crm:rem_postpone:${rem.id}:2` }
      ],
      [
        { text: "👤 Ver Prospecto", callback_data: `crm:v:${rem.leadNum}` },
        { text: "📝 Añadir Nota", callback_data: `crm:note_prompt:${rem.leadNum}` }
      ]
    ]
  };

  return { text, replyMarkup };
}
