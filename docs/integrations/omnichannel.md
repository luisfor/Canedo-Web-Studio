# CRM omnicanal: alcance local y conexiones

`node-business` se selecciona al pedir `omnicanal` o canales adicionales, agenda o roles. El motor preserva los generadores v1 y Python. Solo genera en carpeta nueva. No convierte bases v1 ni sustituye autenticación de proyectos existentes.

El backend tiene API con contratos, SQLite, credenciales por actor/empresa y roles admin/manager/agent/viewer. Contactos, conversaciones, asignaciones, handoff, mensajes, etapas/oportunidades, etiquetas/segmentos, conocimiento, respuestas rápidas, citas, reglas de etiquetado y auditoría persisten realmente. La venta sigue usando transacción comercio, caja/outbox e inbox CRM. Las citas usan segundos epoch y excluyen solapamientos por recurso/empresa. Recordatorios se guardan `pending-manual`, sin despachador ni envío automático. Las listas tienen tope de 1000; paginación/retención avanzadas pendientes.

La bandeja HTML usa el mismo backend y credenciales solo en memoria de pestaña. No es un panel de administración completo. Las pruebas verifican API/archivos, no una auditoría visual ni accesibilidad integral de navegador.

## Canales

| Canal | Implementación local | Conexión real |
|---|---|---|
| WhatsApp | Puerto separado, parsing de textos entrantes y HMAC/deduplicación con configuración explícita | No verificada; salida deshabilitada |
| Messenger | Puerto separado, parsing de mensajes/handshake, firma y tenant por cuenta | No verificada; salida deshabilitada |
| Instagram | Puerto separado, formato entrante compatible con webhook de mensajería Meta | No verificada; salida deshabilitada |
| TikTok | Puerto con estado bloqueado y pruebas negativas | Acceso/especificación Business Messaging no verificados |

`GET /crm/channels` nunca devuelve `liveVerified:true`. No se acepta una bandera del usuario para inventar verificación. Configurar una firma compartida comprueba autenticidad criptográfica, no permisos o aprobación de plataforma. Endpoints `/webhooks/{canal}` aceptan solo cuentas explícitamente ligadas a empresas existentes, texto acotado y eventos firmados; deduplican por empresa/canal/cuenta/evento. Un contacto entrante nace sin consentimiento; no se inventa su teléfono. La fecha original no se reemplaza con la recepción. No se reciben adjuntos ni se interpretan estados de entrega todavía.

La configuración privada se describe en `secrets/README.md` generado; no contiene valores de ejemplo utilizables ni credenciales. No se habilitan redes al generar o arrancar. El procesamiento entrante requiere `authorizeWebhooks:true`; tampoco habilita envíos.

## Revisión oficial necesaria antes de producción

La [colección oficial Messenger de Meta](https://www.postman.com/meta/messenger-platform-api/documentation/iyp204x/messenger-platform-api) documenta token de página, permiso `pages_messaging` y ventana estándar de respuesta de 24 horas; excepciones requieren permisos correspondientes. La [colección oficial Instagram](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api) distingue cuentas profesionales y modalidades de login. Los permisos concretos dependen de esa modalidad y deben verificarse en la aplicación aprobada. La [documentación oficial WhatsApp Cloud API](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api) es la referencia para cuentas, tokens, mensajes y permisos. Las páginas directas de developers.facebook.com devolvieron 429 durante esta revisión; no se certificó una versión de Graph ni el funcionamiento de una cuenta.

Antes de cualquier envío: verificar versión soportada, propietario y permisos del token, revisión de aplicación, negocio/cuenta, webhooks HTTPS públicos, consentimiento, ventanas y plantillas autorizadas, límites por cuenta, restricciones regionales, retención y tarifas vigentes. Los precios dependen del proveedor/mercado/uso; el kit no promete gratuidad ni contiene una tarifa fija. No se implementa un emisor hasta completar esas validaciones y pruebas autorizadas. No usar scraping ni sesiones personales.

Para TikTok, consultar el [acceso oficial Business Messaging](https://business-api.tiktok.com/portal/docs/business-messaging-api-get-started/v1.3); la documentación/acceso de esta sesión no permitió verificar un contrato ejecutable. No se inventaron endpoints ni permisos.

## Chatbot

Deshabilitado por defecto. Una aplicación confiable puede inyectar `chatbotPort.reply` con `authorizeChatbot:true`. La prueba usa `scope:simulated`, sin red/costo. Comprueba consentimiento, conversación/empresa y handoff; comparte conocimiento solo de la empresa. La reserva durable de idempotencia precede la llamada y no reintenta automáticamente ante fallo/resultado incierto. El proveedor debe completar timeout, cuotas y validación remota antes de producción.
