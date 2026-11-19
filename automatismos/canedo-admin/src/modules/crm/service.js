// File: automatismos/canedo-admin/src/modules/crm/service.js
// Módulo de integración CRM comercial para Canedo Admin (@CanedoStudioAdminBot)
// Conexión atómica a D1 (CONTACT_DB). Compatible con Cloudflare Workers.

export const CRM_STATUS_MAP = {
  n: "nuevo",
  c: "contactado",
  q: "en_calificacion",
  p: "propuesta_enviada",
  g: "ganado",
  a: "archivado"
};

export const CRM_STATUS_REVERSE = {
  nuevo: "n",
  contactado: "c",
  en_calificacion: "q",
  propuesta_enviada: "p",
  ganado: "g",
  archivado: "a"
};

export const STATUS_LABELS = {
  nuevo: "🟢 Nuevo",
  contactado: "🔵 Contactado",
  en_calificacion: "🟡 En Calificación",
  propuesta_enviada: "🟣 Propuesta Enviada",
  ganado: "🏆 Ganado",
  archivado: "📦 Archivado"
};

export const PRIORITY_LABELS = {
  baja: "⚪ Baja",
  media: "🟡 Media",
  alta: "🟠 Alta",
  urgente: "🔴 Urgente"
};

export class AdminCrmService {
  constructor(db, { now = Date.now } = {}) {
    this.db = db;
    this.now = now;
  }

  stmt(sql, ...params) {
    return this.db.prepare(sql).bind(...params);
  }

  async listLeads({ status = null, limit = 5, offset = 0 } = {}) {
    let whereClause = "WHERE r.state = 'saved'";
    const params = [];

    if (status) {
      whereClause += " AND s.status = ?";
      params.push(status);
    }

    const countRow = await this.stmt(
      `SELECT COUNT(*) as total FROM contact_crm_status s JOIN contact_requests r ON r.id = s.request_id ${whereClause}`,
      ...params
    ).first();

    const total = countRow ? Number(countRow.total) : 0;

    const query = `
      SELECT
        s.lead_num,
        s.request_id,
        s.status,
        s.priority,
        s.estimated_value,
        s.currency,
        s.assigned_to,
        s.created_at,
        s.updated_at,
        r.payload_json,
        (SELECT COUNT(*) FROM contact_crm_notes n WHERE n.request_id = s.request_id) as notes_count,
        (SELECT COUNT(*) FROM contact_crm_reminders rm WHERE rm.request_id = s.request_id AND rm.state = 'pending') as pending_reminders_count
      FROM contact_crm_status s
      JOIN contact_requests r ON r.id = s.request_id
      ${whereClause}
      ORDER BY s.lead_num DESC
      LIMIT ? OFFSET ?
    `;

    const rows = await this.stmt(query, ...params, limit, offset).all();

    const items = (rows.results || []).map((row) => ({
      leadNum: row.lead_num,
      requestId: row.request_id,
      status: row.status,
      priority: row.priority,
      estimatedValue: row.estimated_value,
      currency: row.currency,
      assignedTo: row.assigned_to,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      notesCount: row.notes_count,
      pendingRemindersCount: row.pending_reminders_count,
      payload: JSON.parse(row.payload_json || "{}")
    }));

    return { total, items, limit, offset };
  }

  async getLead(identifier) {
    const isNum = Number.isInteger(identifier) || /^\d+$/.test(String(identifier));
    const query = `
      SELECT
        s.lead_num,
        s.request_id,
        s.status,
        s.priority,
        s.estimated_value,
        s.currency,
        s.assigned_to,
        s.created_at,
        s.updated_at,
        r.payload_json,
        r.expires_at,
        EXISTS(SELECT 1 FROM contact_retention_holds h WHERE h.request_id = s.request_id AND h.released_at IS NULL) as has_hold
      FROM contact_crm_status s
      JOIN contact_requests r ON r.id = s.request_id
      WHERE ${isNum ? "s.lead_num = ?" : "s.request_id = ?"} AND r.state = 'saved'
    `;

    const row = await this.stmt(query, identifier).first();
    if (!row) return null;

    const [notes, history, reminders] = await Promise.all([
      this.stmt(`SELECT * FROM contact_crm_notes WHERE request_id = ? ORDER BY created_at DESC LIMIT 5`, row.request_id).all(),
      this.stmt(`SELECT * FROM contact_crm_history WHERE request_id = ? ORDER BY created_at DESC LIMIT 5`, row.request_id).all(),
      this.stmt(`SELECT * FROM contact_crm_reminders WHERE request_id = ? AND state = 'pending' ORDER BY due_at ASC LIMIT 3`, row.request_id).all()
    ]);

    return {
      leadNum: row.lead_num,
      requestId: row.request_id,
      status: row.status,
      priority: row.priority,
      estimatedValue: row.estimated_value,
      currency: row.currency,
      assignedTo: row.assigned_to,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      expiresAt: row.expires_at,
      hasHold: Boolean(row.has_hold),
      payload: JSON.parse(row.payload_json || "{}"),
      notes: notes.results || [],
      history: history.results || [],
      reminders: reminders.results || []
    };
  }

  async updateStatus({ identifier, newStatus, changedBy = "admin", reason = null }) {
    const lead = await this.getLead(identifier);
    if (!lead) throw new Error("LEAD_NOT_FOUND");

    if (lead.status === newStatus) return { unchanged: true, status: newStatus, lead };

    const now = this.now();
    const historyId = crypto.randomUUID();

    // Transición condicional atómica: solo actualiza e inserta historial si el estado en D1 coincide con el leído
    const results = await this.db.batch([
      this.stmt(
        `UPDATE contact_crm_status SET status = ?, updated_at = ? WHERE request_id = ? AND status = ?`,
        newStatus,
        now,
        lead.requestId,
        lead.status
      ),
      this.stmt(
        `INSERT INTO contact_crm_history (id, request_id, action, previous_value, new_value, changed_by, reason, created_at)
         SELECT ?, ?, 'status_change', ?, ?, ?, ?, ?
         WHERE (SELECT changes()) > 0`,
        historyId,
        lead.requestId,
        lead.status,
        newStatus,
        changedBy,
        reason,
        now
      )
    ]);

    const changes = results[0]?.meta?.changes ?? 0;
    if (changes === 0) {
      // Otra llamada concurrente ya cambió el estado; releer y retornar sin duplicar
      const current = await this.getLead(identifier);
      return { unchanged: true, status: current.status, lead: current, concurrent: true };
    }

    return {
      success: true,
      leadNum: lead.leadNum,
      requestId: lead.requestId,
      previousStatus: lead.status,
      newStatus,
      lead
    };
  }

  async addNote({ identifier, content, author = "admin", noteType = "seguimiento" }) {
    if (!content || typeof content !== "string" || content.trim().length === 0 || content.length > 3000) {
      throw new Error("INVALID_NOTE_CONTENT");
    }

    const lead = await this.getLead(identifier);
    if (!lead) throw new Error("LEAD_NOT_FOUND");

    const now = this.now();
    const noteId = crypto.randomUUID();
    const historyId = crypto.randomUUID();

    await this.db.batch([
      this.stmt(
        `INSERT INTO contact_crm_notes (id, request_id, author, note_type, content, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        noteId,
        lead.requestId,
        author,
        noteType,
        content.trim(),
        now
      ),
      this.stmt(
        `UPDATE contact_crm_status SET updated_at = ? WHERE request_id = ?`,
        now,
        lead.requestId
      ),
      this.stmt(
        `INSERT INTO contact_crm_history (id, request_id, action, previous_value, new_value, changed_by, reason, created_at)
         VALUES (?, ?, 'note_added', NULL, ?, ?, ?, ?)`,
        historyId,
        lead.requestId,
        noteType,
        author,
        content.slice(0, 100),
        now
      )
    ]);

    return { success: true, noteId, leadNum: lead.leadNum, requestId: lead.requestId };
  }

  async createReminder({ identifier, reminderText, dueAt, createdBy = "admin" }) {
    if (!reminderText || typeof reminderText !== "string" || reminderText.trim().length === 0 || reminderText.length > 500) {
      throw new Error("INVALID_REMINDER_TEXT");
    }
    if (!Number.isSafeInteger(dueAt) || dueAt <= this.now()) {
      throw new Error("INVALID_DUE_DATE");
    }

    const lead = await this.getLead(identifier);
    if (!lead) throw new Error("LEAD_NOT_FOUND");

    const now = this.now();
    const reminderId = crypto.randomUUID();
    const historyId = crypto.randomUUID();

    await this.db.batch([
      this.stmt(
        `INSERT INTO contact_crm_reminders (id, request_id, reminder_text, due_at, state, created_by, created_at)
         VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
        reminderId,
        lead.requestId,
        reminderText.trim(),
        dueAt,
        createdBy,
        now
      ),
      this.stmt(
        `INSERT INTO contact_crm_history (id, request_id, action, previous_value, new_value, changed_by, reason, created_at)
         VALUES (?, ?, 'reminder_created', NULL, ?, ?, ?, ?)`,
        historyId,
        lead.requestId,
        String(dueAt),
        createdBy,
        reminderText.slice(0, 100),
        now
      )
    ]);

    return { success: true, reminderId, leadNum: lead.leadNum, requestId: lead.requestId };
  }

  /**
   * Reclama de forma atómica y exclusiva los recordatorios vencidos pendientes de notificación.
   * Evita duplicación y colisiones concurrentes en Workers.
   */
  async claimDueReminders({ limit = 5, leaseMs = 60000 } = {}) {
    const now = this.now();
    const token = crypto.randomUUID();

    // 1. Marcar recordatorios vencidos como 'sending' con lease
    const updateRes = await this.stmt(`
      UPDATE contact_crm_reminders
      SET state = 'sending', lease_until = ?, attempt_token = ?, attempts = attempts + 1
      WHERE id IN (
        SELECT rm.id
        FROM contact_crm_reminders rm
        JOIN contact_requests r ON r.id = rm.request_id
        WHERE (rm.state = 'pending' OR (rm.state = 'sending' AND rm.lease_until < ?))
          AND rm.due_at <= ?
          AND rm.attempts < 3
          AND r.state = 'saved'
          AND r.expires_at > ?
        ORDER BY rm.due_at ASC
        LIMIT ?
      )
    `, now + leaseMs, token, now, now, now, limit).run();

    if (!updateRes.meta?.changes) return [];

    // 2. Obtener los recordatorios reservados con sus datos del prospecto
    const rows = await this.stmt(`
      SELECT
        rm.id,
        rm.request_id,
        rm.reminder_text,
        rm.due_at,
        rm.attempts,
        s.lead_num,
        s.status,
        s.priority,
        r.payload_json
      FROM contact_crm_reminders rm
      JOIN contact_crm_status s ON s.request_id = rm.request_id
      JOIN contact_requests r ON r.id = rm.request_id
      WHERE rm.attempt_token = ? AND rm.state = 'sending'
    `, token).all();

    return (rows.results || []).map(row => ({
      id: row.id,
      requestId: row.request_id,
      reminderText: row.reminder_text,
      dueAt: row.due_at,
      attempts: row.attempts,
      leadNum: row.lead_num,
      status: row.status,
      priority: row.priority,
      payload: JSON.parse(row.payload_json || "{}")
    }));
  }

  /**
   * Marca un recordatorio como 'notified' tras enviarlo con éxito por Telegram.
   */
  async markReminderNotified(reminderId) {
    await this.stmt(
      `UPDATE contact_crm_reminders SET state = 'notified', lease_until = NULL, attempt_token = NULL WHERE id = ?`,
      reminderId
    ).run();
  }

  /**
   * Libera el recordatorio en caso de fallo temporal de red para que se reintente en el siguiente ciclo.
   */
  async releaseReminderAfterFailure(reminderId) {
    await this.stmt(
      `UPDATE contact_crm_reminders SET state = 'pending', lease_until = NULL, attempt_token = NULL WHERE id = ?`,
      reminderId
    ).run();
  }

  /**
   * Marca un recordatorio como completado.
   */
  async completeReminder({ reminderId, completedBy = "admin" }) {
    const reminder = await this.stmt(`SELECT * FROM contact_crm_reminders WHERE id = ?`, reminderId).first();
    if (!reminder) throw new Error("REMINDER_NOT_FOUND");

    const now = this.now();
    const historyId = crypto.randomUUID();

    await this.db.batch([
      this.stmt(
        `UPDATE contact_crm_reminders SET state = 'completed', completed_at = ?, lease_until = NULL, attempt_token = NULL WHERE id = ?`,
        now, reminderId
      ),
      this.stmt(
        `INSERT INTO contact_crm_history (id, request_id, action, previous_value, new_value, changed_by, created_at)
         VALUES (?, ?, 'reminder_completed', 'pending', 'completed', ?, ?)`,
        historyId, reminder.request_id, completedBy, now
      )
    ]);

    return { success: true, reminderId, requestId: reminder.request_id };
  }

  /**
   * Reprograma un recordatorio para una nueva fecha.
   */
  async rescheduleReminder({ reminderId, newDueAt, updatedBy = "admin" }) {
    if (!Number.isSafeInteger(newDueAt) || newDueAt <= this.now()) {
      throw new Error("INVALID_DUE_DATE");
    }
    const reminder = await this.stmt(`SELECT * FROM contact_crm_reminders WHERE id = ?`, reminderId).first();
    if (!reminder) throw new Error("REMINDER_NOT_FOUND");

    const now = this.now();
    const historyId = crypto.randomUUID();

    await this.db.batch([
      this.stmt(
        `UPDATE contact_crm_reminders SET due_at = ?, state = 'pending', lease_until = NULL, attempt_token = NULL, attempts = 0 WHERE id = ?`,
        newDueAt, reminderId
      ),
      this.stmt(
        `INSERT INTO contact_crm_history (id, request_id, action, previous_value, new_value, changed_by, created_at)
         VALUES (?, ?, 'reminder_created', ?, ?, ?, ?)`,
        historyId, reminder.request_id, String(reminder.due_at), String(newDueAt), updatedBy, now
      )
    ]);

    return { success: true, reminderId, requestId: reminder.request_id, newDueAt };
  }

  async getPipelineSummary() {
    const counts = await this.stmt(`
      SELECT status, COUNT(*) as count, SUM(estimated_value) as total_val
      FROM contact_crm_status s
      JOIN contact_requests r ON r.id = s.request_id
      WHERE r.state = 'saved'
      GROUP BY status
    `).all();

    const summary = {
      nuevo: 0,
      contactado: 0,
      en_calificacion: 0,
      propuesta_enviada: 0,
      ganado: 0,
      archivado: 0,
      total: 0,
      totalEstimatedValue: 0,
      wonEstimatedValue: 0
    };

    for (const row of counts.results || []) {
      if (summary[row.status] !== undefined) {
        summary[row.status] = Number(row.count);
        summary.total += Number(row.count);
        const val = Number(row.total_val || 0);
        summary.totalEstimatedValue += val;
        if (row.status === "ganado") {
          summary.wonEstimatedValue += val;
        }
      }
    }

    return summary;
  }
}

