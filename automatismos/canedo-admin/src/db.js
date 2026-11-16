// File: automatismos/canedo-admin/src/db.js
// Adaptador D1 para administración, auditoría, jobs y persistencia de borradores

export async function recordTelegramUpdate(db, updateId) {
  if (!db || !updateId) return true; // Si no hay DB, permite pasar
  try {
    const query = `INSERT INTO admin_telegram_updates (update_id) VALUES (?)`;
    const res = await db.prepare(query).bind(Number(updateId)).run();
    return Boolean(res && (res.meta?.changes > 0 || res.changes > 0 || res.success));
  } catch (err) {
    // Si la restricción UNIQUE / PRIMARY KEY falla por duplicado, retornamos false
    if (err.message && (err.message.includes("UNIQUE") || err.message.includes("PRIMARY") || err.message.includes("constraint"))) {
      return false;
    }
    throw err;
  }
}

export async function createJob(db, { id, jobType, userId, chatId, messageId, payload }) {
  // Manejo retrocompatible si la tabla aún no tiene current_stage o si ya fue migrada
  const query = `
    INSERT INTO admin_pending_jobs (
      id, job_type, status, user_id, chat_id, message_id, payload_json, attempts, current_stage
    ) VALUES (?, ?, 'queued', ?, ?, ?, ?, 0, 'queued')
  `;
  try {
    await db.prepare(query).bind(
      id,
      jobType,
      String(userId),
      String(chatId),
      messageId || null,
      JSON.stringify(payload || {})
    ).run();
  } catch (err) {
    if (err.message && err.message.includes("no such column: current_stage")) {
      const fallbackQuery = `
        INSERT INTO admin_pending_jobs (
          id, job_type, status, user_id, chat_id, message_id, payload_json, attempts
        ) VALUES (?, ?, 'queued', ?, ?, ?, ?, 0)
      `;
      await db.prepare(fallbackQuery).bind(
        id,
        jobType,
        String(userId),
        String(chatId),
        messageId || null,
        JSON.stringify(payload || {})
      ).run();
    } else {
      throw err;
    }
  }

  // Registrar evento inicial de recepción/encolamiento si existe la tabla admin_job_events
  await recordJobEvent(db, {
    jobId: id,
    stage: "queued",
    attempt: 0,
    details: { jobType, userId }
  }).catch(() => null);
}

export async function claimSpecificJob(db, jobId, lockDurationSeconds = 120, workerId = null) {
  if (!db || !jobId) return null;
  const now = new Date();
  const lockUntilIso = new Date(now.getTime() + lockDurationSeconds * 1000).toISOString();
  const effectiveWorkerId = workerId || "w_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 6);

  // Inyectar o actualizar locked_by (almacenado dentro de attempts/metadata de procesamiento)
  const updateQuery = `
    UPDATE admin_pending_jobs
    SET status = 'processing', attempts = attempts + 1, locked_until = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND (status = 'queued' OR (status = 'processing' AND (locked_until IS NULL OR unixepoch(locked_until) < unixepoch('now')))) AND attempts < 3
  `;
  const result = await db.prepare(updateQuery).bind(lockUntilIso, jobId).run();
  if (result && (result.meta?.changes > 0 || result.changes > 0 || result.success)) {
    const selectQuery = `SELECT * FROM admin_pending_jobs WHERE id = ?`;
    const row = await db.prepare(selectQuery).bind(jobId).first();
    if (!row) return null;
    return {
      id: row.id,
      jobType: row.job_type,
      status: "processing",
      userId: row.user_id,
      chatId: row.chat_id,
      messageId: row.message_id,
      payload: row.payload_json ? JSON.parse(row.payload_json) : {},
      attempts: row.attempts,
      expectedAttempts: row.attempts,
      workerId: effectiveWorkerId
    };
  }
  return null;
}

export async function renewJobLock(db, jobId, expectedAttempts, additionalSeconds = 120, stage = null, wordCount = null, details = null) {
  if (!db || !jobId) return false;
  const lockUntilIso = new Date(Date.now() + additionalSeconds * 1000).toISOString();
  
  let query = `
    UPDATE admin_pending_jobs
    SET locked_until = ?, updated_at = CURRENT_TIMESTAMP
  `;
  const params = [lockUntilIso];

  if (stage) {
    query += `, current_stage = ?, stage_updated_at = CURRENT_TIMESTAMP`;
    params.push(stage);
  }
  if (typeof wordCount === "number") {
    query += `, word_count = ?`;
    params.push(wordCount);
  }
  if (details) {
    query += `, stage_details_json = ?`;
    params.push(typeof details === "string" ? details : JSON.stringify(details));
  }

  query += ` WHERE id = ? AND status = 'processing' AND attempts = ?`;
  params.push(jobId, expectedAttempts);

  try {
    const result = await db.prepare(query).bind(...params).run();
    if (stage) {
      await recordJobEvent(db, {
        jobId,
        stage,
        attempt: expectedAttempts,
        wordCount,
        details
      }).catch(() => null);
    }
    return Boolean(result && (result.meta?.changes > 0 || result.changes > 0 || result.success));
  } catch (err) {
    // Si falla por columna inexistente (entorno sin migración 0002 aplicada), fallback seguro a query estándar
    if (err.message && (err.message.includes("no such column: current_stage") || err.message.includes("no such column: stage_updated_at"))) {
      const basicQuery = `
        UPDATE admin_pending_jobs
        SET locked_until = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'processing' AND attempts = ?
      `;
      const basicRes = await db.prepare(basicQuery).bind(lockUntilIso, jobId, expectedAttempts).run();
      return Boolean(basicRes && (basicRes.meta?.changes > 0 || basicRes.changes > 0 || basicRes.success));
    }
    throw err;
  }
}

export async function recordJobEvent(db, { jobId, stage, attempt = 1, durationMs = null, wordCount = null, errorType = null, details = null }) {
  if (!db || !jobId || !stage) return;
  try {
    const query = `
      INSERT INTO admin_job_events (
        job_id, stage, attempt, duration_ms, word_count, error_type, details_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    await db.prepare(query).bind(
      jobId,
      stage,
      attempt,
      durationMs || null,
      typeof wordCount === "number" ? wordCount : null,
      errorType || null,
      details ? (typeof details === "string" ? details : JSON.stringify(details)) : null
    ).run();
  } catch (err) {
    // Si la tabla no existe en producción aún, no bloquear el flujo
    if (!err.message?.includes("no such table: admin_job_events")) {
      console.warn("[JOB EVENT LOG WARN]", err.message);
    }
  }
}

export async function getJobById(db, jobId) {
  if (!db || !jobId) return null;
  const query = `SELECT * FROM admin_pending_jobs WHERE id = ?`;
  return await db.prepare(query).bind(jobId).first();
}

export async function getJobEvents(db, jobId, limit = 20) {
  if (!db || !jobId) return [];
  try {
    const query = `SELECT * FROM admin_job_events WHERE job_id = ? ORDER BY created_at DESC LIMIT ?`;
    const res = await db.prepare(query).bind(jobId, limit).all();
    return res?.results || [];
  } catch {
    return [];
  }
}

export async function claimNextJob(db, lockDurationSeconds = 120, maxJobAgeMinutes = 60) {
  if (!db) return null;
  const now = new Date();
  const lockUntilIso = new Date(now.getTime() + lockDurationSeconds * 1000).toISOString();
  const maxJobAgeSeconds = maxJobAgeMinutes * 60;

  // Buscar un trabajo pendiente o cuyo lock haya expirado (máximo 3 intentos y creado dentro de la ventana de validez)
  const selectQuery = `
    SELECT * FROM admin_pending_jobs
    WHERE (status = 'queued' OR (status = 'processing' AND (locked_until IS NULL OR unixepoch(locked_until) < unixepoch('now'))))
      AND attempts < 3
      AND unixepoch(created_at) >= (unixepoch('now') - ?)
    ORDER BY created_at ASC
    LIMIT 1
  `;
  const row = await db.prepare(selectQuery).bind(maxJobAgeSeconds).first();
  if (!row) return null;

  // Adquirir lock atómicamente
  const updateQuery = `
    UPDATE admin_pending_jobs
    SET status = 'processing', attempts = attempts + 1, locked_until = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND (status = 'queued' OR (status = 'processing' AND (locked_until IS NULL OR unixepoch(locked_until) < unixepoch('now'))))
  `;
  const result = await db.prepare(updateQuery).bind(lockUntilIso, row.id).run();
  if (result && (result.meta?.changes > 0 || result.changes > 0 || result.success)) {
    return {
      id: row.id,
      jobType: row.job_type,
      status: "processing",
      userId: row.user_id,
      chatId: row.chat_id,
      messageId: row.message_id,
      payload: row.payload_json ? JSON.parse(row.payload_json) : {},
      attempts: row.attempts + 1,
      expectedAttempts: row.attempts + 1
    };
  }
  return null;
}

export async function markJobCompleted(db, jobId, resultData = {}, expectedAttempts = null) {
  if (!db) return false;
  let query = `
    UPDATE admin_pending_jobs
    SET status = 'completed', current_stage = 'completed', stage_updated_at = CURRENT_TIMESTAMP, result_json = ?, locked_until = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND status = 'processing'
  `;
  const params = [JSON.stringify(resultData), jobId];
  if (expectedAttempts !== null && expectedAttempts !== undefined) {
    query += ` AND attempts = ?`;
    params.push(expectedAttempts);
  }
  try {
    const result = await db.prepare(query).bind(...params).run();
    await recordJobEvent(db, {
      jobId,
      stage: "completed",
      attempt: expectedAttempts || 1,
      details: resultData
    }).catch(() => null);
    return Boolean(result && (result.meta?.changes > 0 || result.changes > 0 || result.success));
  } catch (err) {
    if (err.message && err.message.includes("no such column: current_stage")) {
      let fallbackQuery = `
        UPDATE admin_pending_jobs
        SET status = 'completed', result_json = ?, locked_until = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'processing'
      `;
      const fallbackParams = [JSON.stringify(resultData), jobId];
      if (expectedAttempts !== null && expectedAttempts !== undefined) {
        fallbackQuery += ` AND attempts = ?`;
        fallbackParams.push(expectedAttempts);
      }
      const fallbackRes = await db.prepare(fallbackQuery).bind(...fallbackParams).run();
      return Boolean(fallbackRes && (fallbackRes.meta?.changes > 0 || fallbackRes.changes > 0 || fallbackRes.success));
    }
    throw err;
  }
}

export async function markJobFailed(db, jobId, errorMessage, expectedAttempts = null, isTerminal = false, errorType = "TECHNICAL") {
  if (!db) return false;
  // Si isTerminal es true o attempts >= 3, pasa a failed; si es recuperable y < 3, queda queued para el cron
  const terminalCondition = isTerminal ? "1 = 1" : "attempts >= 3";
  let query = `
    UPDATE admin_pending_jobs
    SET status = CASE WHEN ${terminalCondition} THEN 'failed' ELSE 'queued' END,
        current_stage = CASE WHEN ${terminalCondition} THEN 'failed' ELSE 'queued' END,
        stage_updated_at = CURRENT_TIMESTAMP,
        error_message = ?, locked_until = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND status = 'processing'
  `;
  const params = [String(errorMessage || "Error desconocido"), jobId];
  if (expectedAttempts !== null && expectedAttempts !== undefined) {
    query += ` AND attempts = ?`;
    params.push(expectedAttempts);
  }
  try {
    const result = await db.prepare(query).bind(...params).run();
    await recordJobEvent(db, {
      jobId,
      stage: isTerminal ? "failed" : "queued",
      attempt: expectedAttempts || 1,
      errorType,
      details: { errorMessage }
    }).catch(() => null);
    return Boolean(result && (result.meta?.changes > 0 || result.changes > 0 || result.success));
  } catch (err) {
    if (err.message && err.message.includes("no such column: current_stage")) {
      let fallbackQuery = `
        UPDATE admin_pending_jobs
        SET status = CASE WHEN ${terminalCondition} THEN 'failed' ELSE 'queued' END,
            error_message = ?, locked_until = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'processing'
      `;
      const fallbackParams = [String(errorMessage || "Error desconocido"), jobId];
      if (expectedAttempts !== null && expectedAttempts !== undefined) {
        fallbackQuery += ` AND attempts = ?`;
        fallbackParams.push(expectedAttempts);
      }
      const fallbackRes = await db.prepare(fallbackQuery).bind(...fallbackParams).run();
      return Boolean(fallbackRes && (fallbackRes.meta?.changes > 0 || fallbackRes.changes > 0 || fallbackRes.success));
    }
    throw err;
  }
}

export async function logAdminAction(db, { userId, username, action, entityId, details, ip }) {
  if (!db) return;
  try {
    const query = `
      INSERT INTO admin_audit_log (user_id, username, action, entity_id, details_json, ip_address)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    await db.prepare(query).bind(
      String(userId),
      username || null,
      String(action),
      entityId ? String(entityId) : null,
      details ? JSON.stringify(details) : null,
      ip || null
    ).run();
  } catch (err) {
    console.error("[AUDIT LOG ERROR]", err.message);
  }
}

export async function saveDraft(db, draft) {
  const query = `
    INSERT INTO blog_manual_drafts (
      id, topic_tema, topic_angulo, title, tag, excerpt,
      content_json, brief_json, audit_json, word_count,
      status, created_by_user_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  await db.prepare(query).bind(
    draft.id,
    draft.topicTema,
    draft.topicAngulo,
    draft.title,
    draft.tag,
    draft.excerpt,
    JSON.stringify(draft.content),
    JSON.stringify(draft.brief),
    JSON.stringify(draft.audit),
    draft.wordCount,
    draft.status || "draft",
    String(draft.userId)
  ).run();
  return draft;
}

export async function getDraftById(db, draftId) {
  const query = `SELECT * FROM blog_manual_drafts WHERE id = ?`;
  const row = await db.prepare(query).bind(draftId).first();
  if (!row) return null;
  return {
    id: row.id,
    topicTema: row.topic_tema,
    topicAngulo: row.topic_angulo,
    title: row.title,
    tag: row.tag,
    excerpt: row.excerpt,
    content: row.content_json ? JSON.parse(row.content_json) : [],
    brief: row.brief_json ? JSON.parse(row.brief_json) : {},
    audit: row.audit_json ? JSON.parse(row.audit_json) : {},
    wordCount: row.word_count,
    status: row.status,
    createdByUserId: row.created_by_user_id,
    approvedByUserId: row.approved_by_user_id,
    publishedSlug: row.published_slug,
    publishedAt: row.published_at,
    createdAt: row.created_at
  };
}

export async function listDraftsByUser(db, userId, limit = 5, offset = 0) {
  if (!db) return { drafts: [], total: 0 };
  const query = `
    SELECT id, topic_tema, topic_angulo, title, tag, word_count, status, created_at, updated_at
    FROM blog_manual_drafts
    WHERE created_by_user_id = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `;
  const { results } = await db.prepare(query).bind(String(userId), limit, offset).all();
  const countRow = await db.prepare(`SELECT count(*) as total FROM blog_manual_drafts WHERE created_by_user_id = ?`).bind(String(userId)).first();
  return {
    drafts: results || [],
    total: countRow?.total || 0,
    limit,
    offset
  };
}

export async function updateDraft(db, draftId, updates = {}) {
  if (!db) return false;
  const fields = [];
  const values = [];

  if (updates.title !== undefined) { fields.push("title = ?"); values.push(updates.title); }
  if (updates.excerpt !== undefined) { fields.push("excerpt = ?"); values.push(updates.excerpt); }
  if (updates.tag !== undefined) { fields.push("tag = ?"); values.push(updates.tag); }
  if (updates.content_json !== undefined) { fields.push("content_json = ?"); values.push(JSON.stringify(updates.content_json)); }
  if (updates.brief_json !== undefined) { fields.push("brief_json = ?"); values.push(JSON.stringify(updates.brief_json)); }
  if (updates.audit_json !== undefined) { fields.push("audit_json = ?"); values.push(JSON.stringify(updates.audit_json)); }
  if (updates.word_count !== undefined) { fields.push("word_count = ?"); values.push(Number(updates.word_count)); }
  if (updates.status !== undefined) { fields.push("status = ?"); values.push(updates.status); }

  if (fields.length === 0) return true;

  fields.push("updated_at = CURRENT_TIMESTAMP");
  values.push(draftId);

  const query = `UPDATE blog_manual_drafts SET ${fields.join(", ")} WHERE id = ?`;
  const result = await db.prepare(query).bind(...values).run();
  return Boolean(result && (result.meta?.changes > 0 || result.changes > 0 || result.success));
}

export async function markDraftApproved(db, draftId, userId) {
  const query = `
    UPDATE blog_manual_drafts
    SET status = 'approved', approved_by_user_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND status = 'draft'
  `;
  const result = await db.prepare(query).bind(String(userId), draftId).run();
  return Boolean(result && (result.meta?.changes > 0 || result.changes > 0 || result.success));
}

export async function markDraftPublished(db, draftId, slug) {
  const nowIso = new Date().toISOString();
  const query = `
    UPDATE blog_manual_drafts
    SET status = 'published', published_slug = ?, published_at = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;
  await db.prepare(query).bind(slug, nowIso, draftId).run();
}

export async function markDraftDiscarded(db, draftId, userId) {
  const query = `
    UPDATE blog_manual_drafts
    SET status = 'discarded', approved_by_user_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND status IN ('draft', 'approved')
  `;
  const result = await db.prepare(query).bind(String(userId), draftId).run();
  return Boolean(result && (result.meta?.changes > 0 || result.changes > 0 || result.success));
}

export async function getRecentPublishedArticles(db, limit = 5, offset = 0, status = "published") {
  const query = `
    SELECT id, slug, title, tag, date, status, created_at, updated_at
    FROM blog_posts
    WHERE status = ?
    ORDER BY id DESC
    LIMIT ? OFFSET ?
  `;
  const { results } = await db.prepare(query).bind(status, limit, offset).all();
  const countRow = await db.prepare(`SELECT count(*) as total FROM blog_posts WHERE status = ?`).bind(status).first();
  return {
    posts: results || [],
    total: countRow?.total || 0,
    limit,
    offset,
    status
  };
}

export async function searchArticles(db, searchTerm, limit = 5, offset = 0) {
  if (!db || !searchTerm) return { posts: [], total: 0, limit, offset };
  const pattern = `%${searchTerm.trim()}%`;
  const query = `
    SELECT id, slug, title, tag, date, status, created_at, updated_at
    FROM blog_posts
    WHERE title LIKE ? OR slug LIKE ? OR excerpt LIKE ?
    ORDER BY id DESC
    LIMIT ? OFFSET ?
  `;
  const { results } = await db.prepare(query).bind(pattern, pattern, pattern, limit, offset).all();
  const countRow = await db.prepare(`
    SELECT count(*) as total FROM blog_posts WHERE title LIKE ? OR slug LIKE ? OR excerpt LIKE ?
  `).bind(pattern, pattern, pattern).first();
  return {
    posts: results || [],
    total: countRow?.total || 0,
    limit,
    offset,
    searchTerm
  };
}

export async function getPostBySlugForAdmin(db, slug) {
  if (!db || !slug) return null;
  const query = `SELECT * FROM blog_posts WHERE slug = ? LIMIT 1`;
  const row = await db.prepare(query).bind(slug).first();
  if (!row) return null;
  return {
    ...row,
    content: typeof row.content_json === "string" ? JSON.parse(row.content_json) : row.content_json
  };
}

export async function recordPostHistory(db, post, userId, operation, changeSummary = null) {
  if (!db || !post) return false;
  try {
    const query = `
      INSERT INTO blog_post_history (
        post_slug, title, tag, date, reading_time, cover_url, excerpt, content_json, status, modified_by, operation, change_summary
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const res = await db.prepare(query).bind(
      post.slug,
      post.title,
      post.tag,
      post.date,
      post.reading_time || post.readingTime || null,
      post.cover_url || post.cover || null,
      post.excerpt,
      typeof post.content_json === "object" ? JSON.stringify(post.content_json) : (typeof post.content === "object" ? JSON.stringify(post.content) : String(post.content_json || post.content || "")),
      post.status || "published",
      String(userId),
      operation,
      changeSummary
    ).run();
    return Boolean(res && (res.meta?.changes > 0 || res.changes > 0 || res.success));
  } catch (err) {
    console.warn("[POST HISTORY WARN] No fue posible guardar el historial:", err.message);
    return false;
  }
}

export async function getPostHistory(db, slug, limit = 5) {
  if (!db || !slug) return [];
  try {
    const query = `
      SELECT id, post_slug, title, status, modified_by, operation, change_summary, created_at
      FROM blog_post_history
      WHERE post_slug = ?
      ORDER BY id DESC
      LIMIT ?
    `;
    const res = await db.prepare(query).bind(slug, limit).all();
    return res?.results || [];
  } catch {
    return [];
  }
}

export async function getPostHistoryById(db, historyId) {
  if (!db || !historyId) return null;
  try {
    const query = `SELECT * FROM blog_post_history WHERE id = ? LIMIT 1`;
    return await db.prepare(query).bind(Number(historyId)).first();
  } catch {
    return null;
  }
}

export async function setPostStatusInD1(db, slug, newStatus, expectedVersion = null) {
  if (!db || !slug) return false;
  let query = `UPDATE blog_posts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE slug = ?`;
  const params = [newStatus, slug];
  if (expectedVersion !== null && expectedVersion !== undefined) {
    query += ` AND updated_at = ?`;
    params.push(expectedVersion);
  }
  const res = await db.prepare(query).bind(...params).run();
  return Boolean(res && (res.meta?.changes > 0 || res.changes > 0 || res.success));
}

export async function updatePostInD1(db, slug, updates = {}, expectedVersion = null) {
  if (!db || !slug) return false;
  const fields = [];
  const values = [];

  if (updates.title !== undefined) { fields.push("title = ?"); values.push(updates.title); }
  if (updates.tag !== undefined) { fields.push("tag = ?"); values.push(updates.tag); }
  if (updates.excerpt !== undefined) { fields.push("excerpt = ?"); values.push(updates.excerpt); }
  if (updates.reading_time !== undefined) { fields.push("reading_time = ?"); values.push(updates.reading_time); }
  if (updates.content_json !== undefined) {
    fields.push("content_json = ?");
    values.push(typeof updates.content_json === "string" ? updates.content_json : JSON.stringify(updates.content_json));
  }
  if (updates.status !== undefined) { fields.push("status = ?"); values.push(updates.status); }

  if (fields.length === 0) return true;

  fields.push("updated_at = CURRENT_TIMESTAMP");
  values.push(slug);

  let query = `UPDATE blog_posts SET ${fields.join(", ")} WHERE slug = ?`;
  if (expectedVersion !== null && expectedVersion !== undefined) {
    query += ` AND updated_at = ?`;
    values.push(expectedVersion);
  }

  const result = await db.prepare(query).bind(...values).run();
  return Boolean(result && (result.meta?.changes > 0 || result.changes > 0 || result.success));
}
