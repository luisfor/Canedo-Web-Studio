/**
 * CRM Layer for CanedoStudio Sales Agent
 * Utiliza Cloudflare D1
 */

// Función utilitaria para generar IDs (se puede reemplazar por crypto.randomUUID si el runtime lo soporta)
const generateId = () => crypto.randomUUID();

export async function getOrCreateLead(db, { platform_user_id, channel, name }) {
  const existingLead = await db.prepare(
    "SELECT * FROM leads WHERE platform_user_id = ? AND channel = ?"
  ).bind(platform_user_id, channel).first();

  if (existingLead) {
    return existingLead;
  }

  const lead_id = generateId();
  await db.prepare(
    "INSERT INTO leads (lead_id, platform_user_id, channel, name, funnel_stage, lead_temperature) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(lead_id, platform_user_id, channel, name || null, 'NEW', 'COLD').run();

  return await getLeadByPlatformUser(db, platform_user_id, channel);
}

export async function getLeadByPlatformUser(db, platform_user_id, channel) {
  return await db.prepare(
    "SELECT * FROM leads WHERE platform_user_id = ? AND channel = ?"
  ).bind(platform_user_id, channel).first();
}

export async function updateLeadState(db, lead_id, updates) {
  const keys = Object.keys(updates);
  const values = Object.values(updates);
  const setString = keys.map(k => `${k} = ?`).join(', ');
  
  await db.prepare(
    `UPDATE leads SET ${setString}, updated_at = CURRENT_TIMESTAMP WHERE lead_id = ?`
  ).bind(...values, lead_id).run();
}

export async function createConversation(db, lead_id, channel) {
  const conversation_id = generateId();
  await db.prepare(
    "INSERT INTO conversations (conversation_id, lead_id, channel) VALUES (?, ?, ?)"
  ).bind(conversation_id, lead_id, channel).run();
  
  return conversation_id;
}

export async function getActiveConversation(db, lead_id) {
  return await db.prepare(
    "SELECT * FROM conversations WHERE lead_id = ? AND status = 'OPEN' ORDER BY started_at DESC LIMIT 1"
  ).bind(lead_id).first();
}

export async function saveInboundMessage(db, { conversation_id, lead_id, content, message_type, provider_message_id }) {
  const message_id = generateId();
  await db.prepare(
    "INSERT INTO messages (message_id, conversation_id, lead_id, direction, role, content, message_type, provider_message_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(message_id, conversation_id, lead_id, 'INBOUND', 'USER', content, message_type, provider_message_id).run();

  // Actualizar timestamps
  await db.prepare("UPDATE conversations SET last_message_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE conversation_id = ?").bind(conversation_id).run();
  await db.prepare("UPDATE leads SET last_message_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE lead_id = ?").bind(lead_id).run();

  return message_id;
}

export async function saveOutboundMessage(db, { conversation_id, lead_id, content, message_type, provider_message_id = null }) {
  const message_id = generateId();
  await db.prepare(
    "INSERT INTO messages (message_id, conversation_id, lead_id, direction, role, content, message_type, provider_message_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(message_id, conversation_id, lead_id, 'OUTBOUND', 'ASSISTANT', content, message_type, provider_message_id).run();

  await db.prepare("UPDATE conversations SET last_message_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE conversation_id = ?").bind(conversation_id).run();
  await db.prepare("UPDATE leads SET last_message_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE lead_id = ?").bind(lead_id).run();

  return message_id;
}

export async function getRecentMessages(db, conversation_id, limit = 10) {
  const { results } = await db.prepare(
    "SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?"
  ).bind(conversation_id, limit).all();
  
  // Como están en orden descendente por el límite, los revertimos para que sean cronológicos al alimentar al LLM
  return results.reverse();
}

export async function updateConversationSummary(db, lead_id, new_summary) {
  await db.prepare(
    "UPDATE leads SET conversation_summary = ?, updated_at = CURRENT_TIMESTAMP WHERE lead_id = ?"
  ).bind(new_summary, lead_id).run();
}

export async function markHumanRequired(db, lead_id) {
  await db.prepare(
    "UPDATE leads SET human_required = 1, funnel_stage = 'READY_FOR_HUMAN', updated_at = CURRENT_TIMESTAMP WHERE lead_id = ?"
  ).bind(lead_id).run();
}

export async function isEventProcessed(db, provider_event_id, channel) {
  const event = await db.prepare(
    "SELECT status FROM processed_events WHERE provider_event_id = ? AND channel = ?"
  ).bind(provider_event_id, channel).first();
  return event !== null;
}

export async function registerEvent(db, { provider_event_id, channel, event_type }) {
  const event_id = generateId();
  await db.prepare(
    "INSERT INTO processed_events (event_id, channel, provider_event_id, event_type, status) VALUES (?, ?, ?, ?, ?)"
  ).bind(event_id, channel, provider_event_id, event_type, 'RECEIVED').run();
  return event_id;
}

export async function updateEventStatus(db, provider_event_id, channel, status, error_message = null) {
  await db.prepare(
    "UPDATE processed_events SET status = ?, processed_at = CURRENT_TIMESTAMP, error_message = ? WHERE provider_event_id = ? AND channel = ?"
  ).bind(status, error_message, provider_event_id, channel).run();
}

export async function updateHandoffStatus(db, lead_id, status) {
  if (status === 'NOTIFIED') {
    await db.prepare(
      "UPDATE leads SET handoff_status = ?, handoff_notified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE lead_id = ?"
    ).bind(status, lead_id).run();
  } else {
    await db.prepare(
      "UPDATE leads SET handoff_status = ?, updated_at = CURRENT_TIMESTAMP WHERE lead_id = ?"
    ).bind(status, lead_id).run();
  }
}

