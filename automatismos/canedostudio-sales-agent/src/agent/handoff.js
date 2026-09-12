export function generateHandoffSummary(lead) {
  return {
    PROSPECTO: lead.name || lead.platform_user_id,
    NEGOCIO: lead.business_type || lead.business_name || 'No especificado',
    NECESIDAD: lead.detected_need || 'No especificada',
    PROBLEMA: lead.main_problem || 'No especificado',
    SOLUCION_POSIBLE: lead.service_interest ? `Servicios evaluados: ${lead.service_interest}` : 'Pendiente evaluar',
    URGENCIA: lead.urgency || 'Desconocida',
    OBJECIONES: 'No registradas',
    TEMPERATURA: lead.lead_temperature || 'COLD',
    ESTADO: lead.funnel_stage || 'READY_FOR_HUMAN',
    SIGUIENTE_ACCION: 'Atención inmediata por operador humano',
    RESUMEN_CONVERSACION: lead.conversation_summary || 'Sin resumen previo'
  };
}
