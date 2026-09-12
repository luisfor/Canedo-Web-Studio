# CanedoStudio Sales Agent

Motor conversacional comercial con IA, diseñado exclusivamente para CanedoStudio.

## Arquitectura

- **Worker:** Cloudflare Worker (Punto de entrada: \`src/index.js\`)
- **Base de Datos:** Cloudflare D1 (\`canedostudio_sales_agent_db\`)
- **LLM:** Gemini (Principal: Flash Lite, Secundario: Flash)
- **Notificaciones:** Telegram Bot API
- **Canales:** Instagram Messaging API

## Flujo de Datos (Instagram)

1. **Meta Webhook:** Meta envía POST a \`/webhook/instagram\`.
2. **Validación:** Se valida firma X-Hub-Signature-256 (MOCK actual).
3. **Resilience:** Se responde HTTP 200 inmediatamente.
4. **Normalización:** Se abstraen los payloads crudos de Meta.
5. **Filtro (Cost Control):** Comentarios no comerciales ("🔥") o echos se ignoran (0 LLM calls). "Hola" activa Cheap Greeting (0 LLM calls).
6. **Agente (Engine):** Llama a Gemini. Actualiza CRM (temperatura, funnel).
7. **Handoff:** Si el funnel llega a \`READY_FOR_HUMAN\`, se alerta vía Telegram.
8. **Respuesta:** Se envía el mensaje de salida vía Instagram API (MOCK actual).

## Flujo CRM y Memoria

Toda conversación está aislada. La memoria usa los últimos N mensajes + un \`conversation_summary\` que el LLM autogenera para evitar desbordar el contexto, optimizando costos sin purgar el historial crudo de la D1.

## Variables de Entorno (wrangler.toml)

- \`TELEGRAM_ADMIN_CHAT_ID\` (Configurable directamente)

## Secretos Requeridos

Deberán cargarse mediante \`npx wrangler secret put <NOMBRE>\`:

- \`GEMINI_API_KEY\`
- \`TELEGRAM_SALES_BOT_TOKEN\`
- \`TEST_API_SECRET\`
- \`META_ACCESS_TOKEN\` (Pendiente)
- \`META_APP_SECRET\` (Pendiente)
- \`META_VERIFY_TOKEN\` (Pendiente)
- \`INSTAGRAM_ACCOUNT_ID\` (Pendiente)

## Pruebas Locales

El endpoint \`POST /test-sales-agent\` requiere el header:
\`Authorization: Bearer <TEST_API_SECRET>\`

Permite inyectar eventos mock al sistema sin depender de Meta.

## Estado para Producción

- **Pendiente:** Conectar el adaptador real en \`sendInstagramMessage\` (Graph API).
- **Pendiente:** Inyectar Secretos de Producción.
- **Pendiente:** Realizar el Deploy en CF Workers.
