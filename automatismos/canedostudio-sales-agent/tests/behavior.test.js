/**
 * Behavior Tests - Pruebas locales de lógica
 */
export const testCases = [
  {
    description: 'CASO 1: "Hola, quiero una página para mi clínica."',
    expected: {
      intent: 'commercial',
      commercialResponse: true,
      discoverObjective: true,
      priceInvented: false,
      listAllServices: false
    }
  },
  {
    description: 'CASO 2: "¿Cuánto cuesta automatizar WhatsApp?"',
    expected: {
      intent: 'question',
      priceInvented: false,
      explainDependsOnScope: true,
      askUsefulQuestion: true
    }
  },
  {
    description: 'CASO 3: "Necesito responder clientes cuando estoy ocupado."',
    expected: {
      intent: 'commercial',
      funnel_stage: 'DISCOVERY',
      detectAutomation: true,
      identifyProblem: 'ocupado'
    }
  },
  {
    description: 'CASO 4: "Excelente publicación 🔥"',
    expected: {
      intent: 'non_commercial',
      startAggressiveSales: false
    }
  },
  {
    description: 'CASO 5: "Quiero contratar, ¿cómo empezamos?"',
    expected: {
      intent: 'closing',
      human_required: true,
      funnel_stage: 'READY_FOR_HUMAN'
    }
  },
  {
    description: 'CASO 6: "Hazme una receta de hamburguesa."',
    expected: {
      intent: 'non_commercial',
      funnel_stage: 'NOT_FIT',
      redirectsToCanedoStudio: true,
      generalChatbotBehavior: false
    }
  },
  {
    description: 'CASO 7: "Ya tengo página web."',
    expected: {
      intent: 'objection',
      discardLead: false,
      investigatesAutomation: true
    }
  }
];
