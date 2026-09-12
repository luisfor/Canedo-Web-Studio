/**
 * Instagram Channel Adapter (Mock/Preparado)
 * Maneja la integración con Meta Graph API.
 */

// 1. Verificación de Webhook GET (Meta Hub Challenge)
export function verifyWebhook(request, env) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === env.META_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}

export async function validateSignature(request, env, rawBody) {
  const signatureHeader = request.headers.get('x-hub-signature-256');
  if (!signatureHeader || !env.META_APP_SECRET) {
    return false;
  }
  
  const signaturePrefix = 'sha256=';
  if (!signatureHeader.startsWith(signaturePrefix)) return false;
  const signature = signatureHeader.slice(signaturePrefix.length);

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(env.META_APP_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(rawBody)
  );

  const hashHex = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return hashHex === signature;
}

// 3. Normalización de Eventos (Event Normalization)
export function normalizeEvent(metaEntry) {
  // Extraemos datos del payload de Meta
  // Esta función asume el formato estándar de Meta Webhooks (messaging o changes)
  
  const events = [];
  
  if (!metaEntry || !metaEntry.messaging) return events;

  for (const messaging of metaEntry.messaging) {
    // Detectar Echo (Mensajes enviados por nuestro propio bot)
    const is_echo = messaging.message && messaging.message.is_echo;
    
    // Detectar si es lectura/entrega (ignorar para lógica comercial)
    const is_delivery = !!messaging.delivery;
    const is_read = !!messaging.read;

    let event_type = 'UNKNOWN';
    let text = null;
    let comment_text = null;
    let post_id = null;
    
    if (messaging.message && !is_echo) {
      event_type = 'DM';
      text = messaging.message.text;
    } else if (messaging.postback) {
      event_type = 'POSTBACK';
      text = messaging.postback.payload;
    } else if (messaging.comment) {
      // Formato figurativo para comentarios, la API de Meta los manda en "changes" usualmente
      // pero normalizamos aquí conceptualmente.
      event_type = 'COMMENT';
      comment_text = messaging.comment.text;
      post_id = messaging.comment.post_id;
    }

    events.push({
      event_id: messaging.message?.mid || messaging.postback?.mid || `evt_${Date.now()}_${Math.random()}`,
      channel: 'INSTAGRAM',
      event_type,
      platform_user_id: messaging.sender.id,
      message_id: messaging.message?.mid,
      text: text,
      comment_text: comment_text,
      post_id: post_id,
      is_echo: !!is_echo,
      is_delivery,
      is_read,
      received_at: messaging.timestamp || Date.now()
    });
  }

  return events;
}

// 4. Adaptador de Envío
export async function sendInstagramMessage(env, recipientId, text) {
  if (!env.META_ACCESS_TOKEN || !env.INSTAGRAM_ACCOUNT_ID) {
    console.error('Missing Meta secrets for sending message.');
    return { success: false };
  }

  const url = `https://graph.facebook.com/v19.0/${env.INSTAGRAM_ACCOUNT_ID}/messages`;
  
  const payload = {
    recipient: { id: recipientId },
    message: { text: text }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.META_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const responseData = await response.json();

  if (!response.ok) {
    throw new Error(`Meta API Error: ${response.status} - ${JSON.stringify(responseData)}`);
  }

  return {
    success: true,
    provider_message_id: responseData.message_id
  };
}
