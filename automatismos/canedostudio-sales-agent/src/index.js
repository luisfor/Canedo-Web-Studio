/**
 * Entry Point - CanedoStudio Sales Agent
 */
import { processIncomingMessage } from './agent/engine.js';
import { verifyWebhook, validateSignature, normalizeEvent } from './channels/instagram.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. Webhook de Instagram (Meta)
    if (url.pathname === '/webhook/instagram') {
      
      if (request.method === 'GET') {
        // Verificación de Meta
        return verifyWebhook(request, env);
      }

      if (request.method === 'POST') {
        const rawBody = await request.text();
        
        // --- DEBUG LOGGING ---
        console.log("=== INCOMING WEBHOOK ===");
        console.log("Headers:", Object.fromEntries(request.headers.entries()));
        console.log("Body:", rawBody);
        // ---------------------

        // Validación de firma de Meta
        const isValid = await validateSignature(request, env, rawBody);
        if (!isValid) {
          console.error("Signature Validation Failed!");
          return new Response('Invalid Signature', { status: 401 });
        }

        // Webhook Resilience: Responder HTTP 200 inmediatamente a Meta
        // para evitar retries, luego procesar asíncronamente con ctx.waitUntil
        const payload = JSON.parse(rawBody);
        const entries = payload.entry || [];
        
        ctx.waitUntil((async () => {
          for (const entry of entries) {
            const normalizedEvents = normalizeEvent(entry);
            for (const event of normalizedEvents) {
              try {
                await processIncomingMessage(env.DB, env, event);
              } catch (e) {
                console.error("Error procesando evento en async:", e);
                // El error se captura para no matar el worker, la DB debería registrar el FAILED si fue interno
              }
            }
          }
        })());

        return new Response('EVENT_RECEIVED', { status: 200 });
      }
      
      return new Response('Method Not Allowed', { status: 405 });
    }

    // 2. Endpoint Seguro para Pruebas Internas
    if (url.pathname === '/test-sales-agent') {
      if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405 });
      }

      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] !== env.TEST_API_SECRET) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
      }

      try {
        const payload = await request.json();
        // Para tests internos sí esperamos sincrónicamente el resultado
        const result = await processIncomingMessage(env.DB, env, payload);
        return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
      }
    }

    return new Response('Not Found', { status: 404 });
  }
};
