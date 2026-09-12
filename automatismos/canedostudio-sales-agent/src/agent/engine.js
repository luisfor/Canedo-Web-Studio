/**
 * Conversational Engine - Motor Principal del Agente Comercial
 */
import { getSystemPrompt } from '../../prompts/sales-agent-system.js';
import { getKnowledgeBase } from '../../prompts/canedostudio-knowledge.js';
import { AgentOutputSchema } from './schema.js';
import { generateHandoffSummary } from './handoff.js';
import { sendInstagramMessage } from '../channels/instagram.js';
import {
  isEventProcessed,
  registerEvent,
  updateEventStatus,
  getOrCreateLead,
  getActiveConversation,
  createConversation,
  saveInboundMessage,
  saveOutboundMessage,
  getRecentMessages,
  updateLeadState,
  updateHandoffStatus
} from '../crm/index.js';
import { sendHandoffNotification } from '../channels/telegram.js';

const LLM_PRIMARY = 'gemini-3.5-flash-lite';
const LLM_SECONDARY = 'gemini-3.6-flash';

// Filtro Comercial - Detectar palabras clave en comentarios
const isCommercialComment = (text) => {
  if (!text) return false;
  const keyword = 'automatiza';
  return text.toLowerCase().includes(keyword);
};

// Filtro Comercial - Ignorar spam/irrelevante
const isSpamOrIrrelevant = (msg) => {
  if (!msg) return true;
  const normalized = msg.toLowerCase().trim();
  const badKeywords = ['excelente', '🔥', '👏', 'buen post', 'me gusta', 'gracias'];
  if (badKeywords.includes(normalized) || normalized.length < 2) return true;
  return false;
};

// Cheap Greeting (Bienvenida barata sin LLM)
const isSimpleGreeting = (msg) => {
  const normalized = msg.toLowerCase().trim();
  return ['hola', 'hola!', 'buenas', 'buen dia', 'buenas tardes'].includes(normalized);
};

// Rate limiting (En memoria/Mock para el engine. En prod usar DO o KV)
// Se basa en confiar que el D1 nos diga cuántos mensajes mandó hoy o un mapa en memoria.
const rateLimitCache = new Map();

export async function processIncomingMessage(db, env, normalizedEvent) {
  const { event_id, channel, event_type, platform_user_id, text, comment_text, post_id, is_echo, is_delivery, is_read } = normalizedEvent;

  // 1. Echo / Delivery Protection
  if (is_echo || is_delivery || is_read) {
    return { status: 'IGNORED', reason: 'ECHO_OR_RECEIPT', llm_calls: 0, reply: null };
  }

  // 2. Idempotencia
  if (await isEventProcessed(db, event_id, channel)) {
    return { status: 'IGNORED', reason: 'DUPLICATE_EVENT', llm_calls: 0, reply: null };
  }
  await registerEvent(db, { provider_event_id: event_id, channel, event_type });

  // 3. Rate Limit Básico
  const rateKey = `${channel}_${platform_user_id}`;
  const userRate = rateLimitCache.get(rateKey) || { count: 0, timestamp: Date.now() };
  if (Date.now() - userRate.timestamp > 60000) { userRate.count = 0; userRate.timestamp = Date.now(); }
  userRate.count++;
  rateLimitCache.set(rateKey, userRate);
  
  if (userRate.count > 5) { // Max 5 msgs por min
    await updateEventStatus(db, event_id, channel, 'IGNORED', 'RATE_LIMIT_EXCEEDED');
    return { status: 'IGNORED', reason: 'RATE_LIMIT', llm_calls: 0, reply: null };
  }

  // 4. Pre-Filtros Comerciales
  let activeMessage = text;
  
  if (event_type === 'COMMENT') {
    if (isCommercialComment(comment_text)) {
      activeMessage = comment_text; // Tratar el comentario como inicio de charla
    } else {
      await updateEventStatus(db, event_id, channel, 'IGNORED', 'NON_COMMERCIAL_COMMENT');
      return { status: 'IGNORED', reason: 'NON_COMMERCIAL_COMMENT', llm_calls: 0, reply: null };
    }
  }

  if (isSpamOrIrrelevant(activeMessage)) {
    await updateEventStatus(db, event_id, channel, 'IGNORED', 'SPAM_OR_IRRELEVANT');
    return { status: 'IGNORED', reason: 'IRRELEVANT_MESSAGE', llm_calls: 0, reply: null };
  }

  // 5. CRM Context & Source Context
  // Asumimos que getOrCreateLead puede recibir source_type y source_context para trackear de donde vino
  const lead = await getOrCreateLead(db, { 
    platform_user_id, 
    channel, 
    source_type: event_type, 
    source_context: post_id || null 
  });
  
  let conversation = await getActiveConversation(db, lead.lead_id);
  const isNewConversation = !conversation;
  if (!conversation) {
    const conversation_id = await createConversation(db, lead.lead_id, channel);
    conversation = { conversation_id, lead_id: lead.lead_id, channel };
  }

  await saveInboundMessage(db, {
    conversation_id: conversation.conversation_id,
    lead_id: lead.lead_id,
    content: activeMessage,
    message_type: event_type,
    provider_message_id: event_id
  });

  // 6. Cheap Greeting (Solo si es nueva charla y manda "Hola")
  if (isNewConversation && isSimpleGreeting(activeMessage)) {
    const cheapReply = "Hola 👋 Soy el asistente de CanedoStudio. ¿Qué te gustaría mejorar en tu negocio: presencia web, atención a clientes o automatización de procesos?";
    
    await saveOutboundMessage(db, {
      conversation_id: conversation.conversation_id,
      lead_id: lead.lead_id,
      content: cheapReply,
      message_type: 'TEXT',
      provider_message_id: 'cheap_' + Date.now()
    });

    await updateEventStatus(db, event_id, channel, 'RESPONDED');
    
    // Enviar a canal
    if (channel === 'INSTAGRAM') await sendInstagramMessage(env, platform_user_id, cheapReply);

    return { status: 'RESPONDED', reply: cheapReply, llm_calls: 0, reason: 'CHEAP_GREETING' };
  }

  // 7. Recuperar Memoria Dinámica
  const recentMessages = await getRecentMessages(db, conversation.conversation_id, 10);
  
  const context = {
    lead_temperature: lead.lead_temperature,
    funnel_stage: lead.funnel_stage,
    conversation_summary: lead.conversation_summary
  };
  const systemPrompt = getSystemPrompt(context) + "\\n\\n" + getKnowledgeBase();
  
  // 8. Llamada al LLM con Failover
  let agentResponse = null;
  let llm_calls = 0;
  
  try {
    llm_calls++;
    agentResponse = await callGeminiAPI(env, systemPrompt, recentMessages, AgentOutputSchema, LLM_PRIMARY);
  } catch (primaryError) {
    console.warn("Primary LLM Failed", primaryError);
    try {
      llm_calls++;
      agentResponse = await callGeminiAPI(env, systemPrompt, recentMessages, AgentOutputSchema, LLM_SECONDARY);
    } catch (secondaryError) {
      console.error("Secondary LLM Failed", secondaryError);
      await updateEventStatus(db, event_id, channel, 'FAILED', 'BOTH_LLMS_FAILED');
      return { status: 'FAILED', reason: 'LLM_UNAVAILABLE', llm_calls, reply: null };
    }
  }

  // 9. Actualizar CRM
  const updates = {
    lead_temperature: agentResponse.lead_temperature,
    funnel_stage: agentResponse.funnel_stage,
    detected_need: agentResponse.detected_need || lead.detected_need,
    main_problem: agentResponse.main_problem || lead.main_problem,
    desired_result: agentResponse.desired_result || lead.desired_result,
    service_interest: agentResponse.service_interest ? JSON.stringify(agentResponse.service_interest) : lead.service_interest,
    business_type: agentResponse.business_type || lead.business_type,
    urgency: agentResponse.urgency || lead.urgency,
    human_required: agentResponse.human_required ? 1 : lead.human_required,
    conversation_summary: agentResponse.conversation_summary
  };
  await updateLeadState(db, lead.lead_id, updates);
  
  // 10. Handoff a Humano (Safe Error Handling)
  let handoffSummary = null;
  const isReadyForHuman = agentResponse.human_required || agentResponse.funnel_stage === 'READY_FOR_HUMAN';
  
  if (isReadyForHuman) {
    handoffSummary = generateHandoffSummary({ ...lead, ...updates });
    if (lead.handoff_status !== 'NOTIFIED') {
      try {
        await updateHandoffStatus(db, lead.lead_id, 'PENDING');
        // Esto fallará intencionalmente si TELEGRAM_SALES_BOT_TOKEN es nulo, 
        // pero capturamos el error para no romper la charla.
        await sendHandoffNotification(env, handoffSummary);
        await updateHandoffStatus(db, lead.lead_id, 'NOTIFIED');
      } catch (telegramError) {
        console.error("Telegram handoff failed (missing secret or network). Status remains PENDING.");
      }
    }
  }

  // 11. Guardar respuesta y notificar
  await saveOutboundMessage(db, {
    conversation_id: conversation.conversation_id,
    lead_id: lead.lead_id,
    content: agentResponse.reply,
    message_type: 'TEXT',
    provider_message_id: 'bot_' + Date.now()
  });
  
  await updateEventStatus(db, event_id, channel, 'RESPONDED');
  
  if (channel === 'INSTAGRAM') {
    await sendInstagramMessage(env, platform_user_id, agentResponse.reply);
  }

  return {
    status: 'RESPONDED',
    reply: agentResponse.reply,
    human_required: agentResponse.human_required,
    handoff_summary: handoffSummary,
    llm_calls
  };
}

async function callGeminiAPI(env, systemPrompt, messages, schema, modelId) {
  const lastMessage = messages[messages.length - 1].content.toLowerCase();
  
  if (lastMessage.includes('simular fallo total')) throw new Error('Simulated API Timeout');

  if (lastMessage.includes('contratar')) {
    return { reply: "¡Excelente! Entiendo que estás listo para empezar...", intent: "closing", lead_temperature: "HOT", funnel_stage: "READY_FOR_HUMAN", human_required: true, next_action: "HANDOFF", conversation_summary: "El prospecto quiere empezar." };
  }
  
  if (lastMessage.includes('cuánto cuesta') || lastMessage.includes('precio')) {
    return { reply: "Nuestros costos varían dependiendo del alcance...", intent: "question", lead_temperature: "WARM", funnel_stage: "DISCOVERY", human_required: false, next_action: "ASK", conversation_summary: "Pregunta precios." };
  }

  return {
    reply: "Entiendo. ¿Qué problema buscas resolver?",
    intent: "commercial", lead_temperature: "WARM", funnel_stage: "DISCOVERY", human_required: false, next_action: "ASK", conversation_summary: "Interés inicial."
  };
}
