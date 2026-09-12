/**
 * Tests locales de Integración (Instagram, Engine, Webhook Resilience)
 */

export const integrationTests = [
  {
    description: "A. comentario 'AUTOMATIZA' -> activar agente",
    assert: "El normalizer clasifica como COMMENT. isCommercialComment devuelve true. El evento avanza a llamar a Gemini."
  },
  {
    description: "B. comentario 'Excelente 🔥' -> IGNORE",
    assert: "isCommercialComment devuelve false. status=IGNORED, llm_calls=0. No llama a Gemini."
  },
  {
    description: "C. DM 'Hola' -> bienvenida sin LLM",
    assert: "isSimpleGreeting es true. activeConversation es false (nueva charla). Devuelve 'Hola 👋 Soy el asistente...' status=RESPONDED, llm_calls=0."
  },
  {
    description: "D. DM 'Quiero automatizar WhatsApp' -> agente comercial",
    assert: "No es simple greeting ni spam. Entra al proceso principal de LLM (llm_calls=1)."
  },
  {
    description: "E. evento duplicado -> no procesar dos veces",
    assert: "isEventProcessed detecta event_id repetido. status=IGNORED, reason=DUPLICATE_EVENT, llm_calls=0."
  },
  {
    description: "F. echo del propio bot -> IGNORE",
    assert: "normalizeEvent detecta is_echo=true. engine corta en paso 1 con status=IGNORED, reason=ECHO_OR_RECEIPT."
  },
  {
    description: "G. dos usuarios simultáneos -> conversaciones separadas",
    assert: "El identificador de platform_user_id aísla la carga de contexto desde getOrCreateLead."
  },
  {
    description: "H. handoff sin Telegram secret -> conversación no se rompe",
    assert: "El try/catch de sendHandoffNotification absorbe el error. El mensaje LLM se manda al usuario y status=RESPONDED. El lead.handoff_status queda en PENDING."
  },
  {
    description: "I. error simulado de Meta -> estado FAILED sin perder lead",
    assert: "Si Gemini devuelve un error capturado y no hay falla de infraestructura, el status de processed_events queda en FAILED y el lead original no se borra."
  },
  {
    description: "J. rate limit -> protección sin loops",
    assert: "A partir del sexto mensaje en el minuto, el rate limit bloquea y status=IGNORED, reason=RATE_LIMIT."
  }
];
