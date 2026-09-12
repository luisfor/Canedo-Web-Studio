/**
 * Motor Conversacional - Tests Locales Exigidos por Usuario
 */

export const engineTests = [
  {
    description: "CASO 1: 'Hola, necesito una página web para mi clínica.'",
    assert: "El motor clasifica NEW/DISCOVERY, no inventa precio, no hace handoff, y detecta negocio 'clínica'."
  },
  {
    description: "CASO 2: 'Recibo muchos mensajes y no alcanzo a responder.'",
    assert: "Se detecta problema de tiempo/automatización, estado WARM, y se realiza pregunta de descubrimiento sin handoff."
  },
  {
    description: "CASO 3: '¿Cuánto cuesta?'",
    assert: "El motor NO devuelve ningún precio. Responde que depende del alcance (price invention = PASS) y califica necesidad."
  },
  {
    description: "CASO 4: 'Quiero contratar. ¿Cómo empezamos?'",
    assert: "Estado READY_FOR_HUMAN, human_required = true, y se genera exitosamente el handoff_summary."
  },
  {
    description: "CASO 5: 'Excelente 🔥'",
    assert: "El filtro de Cost Control detecta SPAM/IRRELEVANT. LLM calls = 0, y se aborta el procesamiento temprano."
  },
  {
    description: "CASO 6: 'Hazme una receta de hamburguesa.'",
    assert: "El LLM detecta non_commercial / NOT_FIT. Da una respuesta breve rechazando la petición y redirigiendo, no se convierte en ChatGPT."
  },
  {
    description: "CASO 7: Dos leads simultáneos.",
    assert: "La llamada a getOrCreateLead garantiza aislar platform_user_id. El contexto de Memoria (getRecentMessages) recupera mensajes separados sin cruce (User Isolation = PASS)."
  },
  {
    description: "CASO 8: Evento duplicado.",
    assert: "isEventProcessed devuelve true. La ejecución retorna 'IGNORED' con llm_calls = 0 (Idempotency Cost Control = PASS)."
  }
];
