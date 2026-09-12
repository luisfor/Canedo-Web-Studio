/**
 * Esquema de Salida Estructurada (JSON Schema)
 */
export const AgentOutputSchema = {
  type: "object",
  properties: {
    reply: {
      type: "string",
      description: "El mensaje exacto a enviar al prospecto."
    },
    intent: {
      type: "string",
      enum: ["commercial", "question", "objection", "closing", "non_commercial", "spam"],
      description: "Intención del mensaje del usuario."
    },
    lead_temperature: {
      type: "string",
      enum: ["COLD", "WARM", "HOT", "QUALIFIED", "NOT_FIT", "SPAM"],
      description: "Temperatura actual del prospecto."
    },
    funnel_stage: {
      type: "string",
      enum: ["NEW", "DISCOVERY", "QUALIFIED", "SOLUTION_PROPOSED", "OBJECTION", "READY_FOR_HUMAN", "WON", "LOST", "NOT_FIT", "SPAM"],
      description: "Etapa del funnel en la que se encuentra."
    },
    detected_need: {
      type: ["string", "null"],
      description: "Necesidad detectada (null si no aplica)."
    },
    main_problem: {
      type: ["string", "null"],
      description: "Problema principal detectado (null si no aplica)."
    },
    desired_result: {
      type: ["string", "null"],
      description: "Resultado esperado por el cliente (null si no aplica)."
    },
    service_interest: {
      type: "array",
      items: { type: "string" },
      description: "Lista de servicios de interés."
    },
    business_type: {
      type: ["string", "null"],
      description: "Tipo de negocio (null si no aplica)."
    },
    urgency: {
      type: ["string", "null"],
      description: "Urgencia del cliente."
    },
    human_required: {
      type: "boolean",
      description: "True si se debe pasar a un operador humano."
    },
    next_action: {
      type: "string",
      enum: ["WAIT", "ASK", "CONTINUE", "HANDOFF", "STOP"],
      description: "Siguiente paso que debe tomar el sistema."
    },
    conversation_summary: {
      type: "string",
      description: "Resumen actualizado de la conversación."
    }
  },
  required: [
    "reply", 
    "intent", 
    "lead_temperature", 
    "funnel_stage", 
    "human_required",
    "next_action",
    "conversation_summary"
  ],
  additionalProperties: false
};
