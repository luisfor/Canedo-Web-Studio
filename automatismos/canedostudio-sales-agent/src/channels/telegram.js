/**
 * Telegram Channel - Handoff Administrativo (Isolado)
 */

export async function sendHandoffNotification(env, summaryObj) {
  const token = env.TELEGRAM_SALES_BOT_TOKEN;
  const chatId = env.TELEGRAM_ADMIN_CHAT_ID;

  if (!token || !chatId) {
    throw new Error('Telegram credentials missing (TELEGRAM_SALES_BOT_TOKEN / TELEGRAM_ADMIN_CHAT_ID)');
  }

  const text = `🔥 LEAD LISTO PARA ATENCIÓN

Nombre:
${summaryObj.PROSPECTO}

Negocio:
${summaryObj.NEGOCIO}

Tipo de negocio:
${summaryObj.NEGOCIO}

Canal:
Instagram

Necesidad:
${summaryObj.NECESIDAD}

Problema:
${summaryObj.PROBLEMA}

Resultado buscado:
${summaryObj.RESULTADO || 'No informado'}

Servicio de interés:
${summaryObj.SOLUCION_POSIBLE}

Urgencia:
${summaryObj.URGENCIA}

Temperatura:
${summaryObj.TEMPERATURA}

Estado:
${summaryObj.ESTADO}

Resumen:
${summaryObj.RESUMEN_CONVERSACION}

Siguiente acción:
${summaryObj.SIGUIENTE_ACCION}
`;

  if (token === 'FAIL_ME') {
    throw new Error('Simulated Telegram Network Failure');
  }

  // Llamada real a la API de Telegram
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: text
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Telegram API Error: ${response.status} - ${errorBody}`);
  }

  return { success: true, message: 'Notified via Telegram' };
}
