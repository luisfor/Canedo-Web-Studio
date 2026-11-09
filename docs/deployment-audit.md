# AUDITORÍA LOCAL VS. PRODUCCIÓN Y PREPARACIÓN FASE 3B — CANEDO STUDIO

**Fecha:** 2 de Noviembre de 2026  
**Proyecto:** Canedo Studio exclusivamente (`cazas/canedostudio.com`).  
**Estado:** Preparación técnica de credenciales y DNS. Solo lectura y análisis local. Sin modificaciones remotas, sin creación de credenciales y producción intacta.

---

## 1. RESUMEN EJECUTIVO — FASE 3B

### Veredicto: **ARQUITECTURA DE TELEGRAM Y RESEND PREPARADA PARA STAGING**

1. **Estado de Telegram:**  
   - Actualmente **no existe** un bot exclusivo llamado `Canedo Contacto` en el entorno de Canedo Studio.
   - Las variables locales `CONTACT_TELEGRAM_BOT_TOKEN` y `CONTACT_TELEGRAM_CHAT_ID` están deliberadamente vacías.
   - Se definió el procedimiento estricto para darlo de alta en `@BotFather` y extraer el `chat_id` privado sin exponer tokens.

2. **Estado de Resend:**  
   - Las variables locales de envío están vacías. No se reutilizarán claves de `Canedo One`.
   - Se estableció el procedimiento para crear una API key dedicada con alcance exclusivo a Canedo Studio.

3. **Configuración DNS para `send.canedostudio.com`:**  
   - Las consultas DNS over HTTPS confirmaron que `send.canedostudio.com` **no existe actualmente** (NXDOMAIN).
   - Los registros MX actuales en el ápice (`canedostudio.com`) apuntan a Cloudflare Email Routing (`route1/2/3.mx.cloudflare.net`), con SPF `include:_spf.mx.cloudflare.net`.
   - Configurar los registros DKIM/SPF/MX de Resend **únicamente en el subdominio `send.canedostudio.com`** garantiza cero impacto en la recepción de correos dirigidos a `contacto@canedostudio.com`.

4. **Blindaje de Registros Dry-Run Existentes:**  
   - Se comprobó mediante consulta SQL en D1 staging que las 10 notificaciones dry-run previas tienen `state='accepted'`, `attempts=1` y `retryable=0`.
   - La consulta canónica de reintentos (`dueIds`) devuelve **0 registros elegibles**. Ninguna notificación de prueba anterior será despachada a Telegram o Resend.

---

## 2. CONFIGURACIÓN DNS PROPUESTA PARA `send.canedostudio.com`

> [!IMPORTANT]
> Estos registros se aplicarán **únicamente sobre el subdominio `send`**, sin alterar los registros del dominio principal `canedostudio.com`.

| Tipo | Nombre del Registro | Valor / Destino | Propósito |
|---|---|---|---|
| **TXT** | `send.canedostudio.com` | `"v=spf1 include:amazonses.com ~all"` (provisto por Resend) | Autorización SPF para servidores de Resend |
| **TXT / CNAME** | `resend._domainkey.send.canedostudio.com` | `p=MIGf...` (clave pública DKIM provista por Resend) | Firma criptográfica DKIM |
| **MX** | `send.canedostudio.com` | `feedback-smtp.resend.com` (Prioridad 10) | Gestión de rebotes (bounces) de Resend |

*Los registros MX del dominio principal (`route1/2/3.mx.cloudflare.net`) y su SPF se mantienen 100% inalterados.*

---

## 3. PROCEDIMIENTO SEGURO PARA EL BOT "CANEDO CONTACTO"

1. **Creación en BotFather:**
   - Abrir `@BotFather` en Telegram.
   - Enviar `/newbot`.
   - Nombre: `Canedo Contacto`.
   - Usuario: `canedo_contacto_bot` (o similar único).
   - Guardar el token en un gestor seguro de contraseñas.
2. **Creación de Canal / Grupo Privado y Extracción de Chat ID:**
   - Crear un grupo o canal privado exclusivo (ej. "Canedo Studio - Notificaciones").
   - Invitar al nuevo bot como administrador.
   - Enviar un mensaje de prueba al grupo (ej. `/start`).
   - Consultar de forma privada:
     ```bash
     curl -s "https://api.telegram.org/bot<TOKEN>/getUpdates" | jq '.result[].message.chat.id'
     ```
   - El resultado será un identificador numérico negativo (ej. `-1001234567890`).
3. **Validación:**
   - Confirmar que el `chat_id` corresponde exclusivamente a ese canal privado antes de provisionarlo en Cloudflare Pages.

---

## 4. PROCEDIMIENTO SEGURO PARA LA API KEY DEDICADA DE RESEND

1. **Acceso:** Iniciar sesión en el panel oficial de `resend.com` en la cuenta corporativa de Canedo Studio.
2. **Dominio:** Añadir el dominio `send.canedostudio.com`.
3. **Generación de Clave:**
   - Ir a **API Keys** -> **Create API Key**.
   - Nombre: `canedo-contact-staging-key` (o `canedo-contact-prod-key`).
   - Permisos: **Sending access** (restringida únicamente a envíos).
   - Dominio: Seleccionar específicamente `send.canedostudio.com`.
4. **Provisionamiento:** Guardar el valor `re_...` directamente en el gestor de secretos.

---

## 5. COMPATIBILIDAD DEL ADAPTADOR Y CONTROL DE DUPLICADOS

- **Idempotencia de Resend:** `resendAdapter` envía la cabecera `Idempotency-Key: contact-email-<requestId>`. La ventana de reintentos en D1 está acotada a 23 horas (`RETRY_WINDOW = 23 * 3600000`), garantizando que cualquier reintento use exactamente la misma clave antes de que expire en Resend (24 horas).
- **Manejo de Errores 429 / 5xx:**
  - Errores 429 (Rate limit) o 409 (concurrente): Se marcan `rejected` con `retryable=1` y respetan la cabecera `Retry-After`.
  - Errores 5xx: Pasan a `unknown` y son reintentados de forma segura mediante el Worker de mantenimiento.
- **Protección contra duplicados en Telegram:**
  - Si una petición a Telegram sufre un timeout o desconexión incierta (`unknown`), el store **no la reintenta automáticamente**, previniendo que el propietario reciba mensajes duplicados.

---

## 6. PLAN DE ACTIVACIÓN CONTROLADA EN STAGING (FASE 3C)

1. Provisionar en Cloudflare Pages `cs-contact-staging` las 7 variables:
   - `CONTACT_FORM_ENABLED = "true"`
   - `CONTACT_DRY_RUN = "false"`
   - `CONTACT_RATE_LIMIT_SECRET = "<clave HMAC>"`
   - `CONTACT_TELEGRAM_BOT_TOKEN`, `CONTACT_TELEGRAM_CHAT_ID`
   - `CONTACT_EMAIL_PROVIDER_API_KEY`, `CONTACT_EMAIL_FROM`, `CONTACT_EMAIL_TO`
2. Desplegar el paquete y ejecutar la matriz de pruebas independientes (Telegram OK / Email fallando, Email OK / Telegram fallando, ambos OK).
3. Confirmar llegada de alertas reales al canal privado y a la bandeja de correo.
4. Restaurar `CONTACT_FORM_ENABLED="false"`.

---

## 7. ACCIONES QUE REQUIEREN AUTORIZACIÓN EXPLÍCITA

1. **Creación del Bot en Telegram:** Requiere que el usuario cree el bot o autorice el uso de sus credenciales.
2. **Alta de Registros DNS en Cloudflare:** Requiere autorización para insertar los 3 registros TXT/MX/CNAME del subdominio `send.canedostudio.com`.
3. **Carga de variables y despliegue en Staging:** Requiere autorización para actualizar las variables de entorno remotas en `cs-contact-staging`.

---

## 8. REGISTRO DE VALIDACIÓN Y PRIMERA PRUEBA REAL — FASE 3C

**Fecha:** 2 de Noviembre de 2026  
**Entorno de Ejecución:** Local  
**Objetivo:** Validación de identidad y primera prueba técnica real de notificación por Telegram.

### 8.1. Verificación de Identidad del Bot y Grupo (Fase 3C-2)
- **Bot ID:** `8752343257`
- **Username:** `@CanedoContactoBot` (`CanedoContacto`)
- **Chat ID:** `-5295421981`
- **Título del Grupo:** `"Alertas Canedo y Logs del Bot"`
- **Tipo de Chat:** `group`
- **Membresía:** `member` (verificado vía `getChatMember`)

### 8.2. Primera Prueba Real de Notificación (Fase 3C-3)
- **Método:** `POST https://api.telegram.org/bot<TOKEN>/sendMessage`
- **Destino:** `chat_id: -5295421981`
- **Estado HTTP:** `200 OK` (`ok: true`)
- **Identificador de Mensaje (`message_id`):** `2`
- **Timestamp de Entrega:** `1793634025`
- **Remitente Confirmado:** `CanedoContactoBot`
- **Reintentos:** 0 (envío único ejecutado exitosamente al primer intento).
- **Protección de Datos:** Cero datos personales; mensaje puramente técnico.
- **Entornos Remotos:** Producción (`canedostudio.com`) y Staging (`cs-contact-staging`) permanecen 100% inalterados e intactos.

---

## 9. AUDITORÍA PREVIA DE REGISTROS DNS PARA RESEND — FASE 3D-2A

**Fecha:** 2 de Noviembre de 2026  
**Subdominio Objetivo:** `send.canedostudio.com`  
**Estado:** Análisis técnico y validación previa de compatibilidad DNS. Cero modificaciones remotas.

### 9.1. Registros Actuales en Cloudflare (Ápice y Subdominio)
- **`canedostudio.com` MX:** `route1/2/3.mx.cloudflare.net` (Recepción de Cloudflare Email Routing para `contacto@canedostudio.com`).
- **`canedostudio.com` SPF (TXT):** `"v=spf1 include:_spf.mx.cloudflare.net ~all"`.
- **`_dmarc.canedostudio.com` (TXT):** `"v=DMARC1; p=none; rua=mailto:d0f3a736d83f465f9037b1ad1e61d657@dmarc-reports.cloudflare.net"`.
- **`send.canedostudio.com` (Cualquier tipo):** `NXDOMAIN` (Status 3: limpio, sin registros colisionantes ni registros A/AAAA/CNAME previos).

### 9.2. Análisis de Alineación SPF, DKIM y DMARC
- **DMARC Herencia:** La política `p=none` del ápice cubre subdominios salvo que se defina un tag `sp=`. Como `send.canedostudio.com` tendrá su propio SPF alineado y firma DKIM alineada provista por Resend, las notificaciones pasarán la validación DMARC de forma nativa sin caer en spam.
- **Aislamiento Total:** Al no tocar el ápice `canedostudio.com`, no hay riesgo alguno de interferir con la recepción de correos entrantes de Cloudflare Email Routing.

---

## 10. AJUSTE DE FASE 3D: VERIFICACIÓN DIRECTA DEL ÁPICE `canedostudio.com`

**Fecha:** 2 de Noviembre de 2026  
**Decisión:** Emisión y recepción con dirección corporativa unificada: `contacto@canedostudio.com`.  
**Dirección Remitente:** `Canedo Studio <contacto@canedostudio.com>`.  
**Dirección Destinatario:** `contacto@canedostudio.com`.

### 10.1. Matriz de Coexistencia DNS en el Ápice (`canedostudio.com`)
1. **Conflicto Crítico de SPF Evitado (RFC 7208 §3.2):**
   - **Prohibición:** NUNCA añadir un segundo registro TXT que comience por `v=spf1`. Dos registros SPF anulan la validación (resultado `PermError`).
   - **Solución Obligatoria:** Fusión en un único registro TXT existente:
     - *Actual:* `"v=spf1 include:_spf.mx.cloudflare.net ~all"`
     - *Propuesto con Resend:* `"v=spf1 include:_spf.mx.cloudflare.net include:amazonses.com ~all"` (o include específico provisto por Resend).
2. **Preservación Intacta de Registros MX:**
   - Resend solicita para el dominio un registro MX para rebotes.
   - **Regla Inquebrantable:** En el ápice `canedostudio.com` **NO SE DEBE AÑADIR UN REGISTRO MX DE RESEND**, ya que rompería Cloudflare Email Routing (`route1/2/3.mx.cloudflare.net`).
   - En dominios ápice, Resend delega los rebotes en un subdominio o valida el dominio únicamente mediante SPF y DKIM. Los MX de Cloudflare permanecen 100% intactos.
3. **Firma Criptográfica DKIM:**
   - Se añade el registro CNAME o TXT en el selector `resend._domainkey.canedostudio.com` sin conflicto con ningún registro existente.

---

## 11. REGISTRO DE DOMINIO PRINCIPAL EN RESEND — FASE 3D-2B

**Fecha:** 2 de Noviembre de 2026  
**Dominio Objetivo:** `canedostudio.com`  
**Estado:** Arquitectura de verificación oficial de Resend y plan de no-colisión con Cloudflare Email Routing.

### 11.1. Arquitectura Oficial de Resend para Dominios Ápice
Al registrar un dominio ápice (`canedostudio.com`), la arquitectura técnica de Resend opera de la siguiente manera:
1. **Firma y Autenticación (DKIM):**
   - Utiliza registros dedicados bajo el selector `resend._domainkey.canedostudio.com` (o claves DKIM específicas provistas en el panel). No colisiona con el ápice.
2. **Subdominio Técnico para MAIL FROM / Return-Path (Rebotes):**
   - Resend **no exige** registros MX en el ápice `canedostudio.com`. En su lugar, aísla el enrutamiento de rebotes (`bounces`) en un subdominio técnico (por ejemplo `bounces.canedostudio.com` o `resend.canedostudio.com`).
   - Por lo tanto, los registros MX del ápice (`route1/2/3.mx.cloudflare.net`) **quedan 100% protegidos y sin tocar**.
3. **Manejo de SPF en el Ápice:**
   - Para autorizar el envío directo desde `contacto@canedostudio.com`, se fusiona el mecanismo `include:amazonses.com` (o el indicado por Resend) en el único registro TXT SPF del ápice.

---

## 12. FASE 3E: CIERRE RÁPIDO DEL FORMULARIO EN MODO `TELEGRAM_ONLY`

**Fecha:** 2 de Noviembre de 2026  
**Canales:** Cloudflare D1 (Almacenamiento) + Telegram `@CanedoContactoBot` (Notificaciones).  
**Resend:** Aplazado (código conservado inactivo, sin llamadas ni dependencias obligatorias).

### 12.1. Arquitectura y Comportamiento del Modo `TELEGRAM_ONLY`
1. **Desacoplamiento Seguro de Resend:**
   - `server.mjs`: Se flexibilizó la condición de arranque para no exigir `email.configured`. Si Telegram está configurado, el endpoint acepta solicitudes sin requerir API Key de Resend.
   - `dispatchContact`: Despacha a Telegram inmediatamente y omite el canal `email` si no está configurado.
   - Si en el futuro se suministra una clave de Resend válida, el canal de correo se activará automáticamente sin cambios adicionales de código.
2. **Experiencia del Visitante (Fail-Safe):**
   - La persistencia atómica en D1 ocurre **antes** de cualquier intento de llamada a Telegram.
   - Si Telegram sufre un timeout o fallo temporal, el visitante recibe su confirmación HTTP 202 (`state: 'saved'`) con su identificador de referencia. El incidente queda registrado en la base de datos sin afectar al usuario ni enviar mensajes duplicados.
3. **Validación y Suite de Pruebas:**
   - Se agregaron 2 pruebas automatizadas dedicadas a `TELEGRAM_ONLY` en [`server.test.mjs`](file:///Users/luis/Desktop/Canedo-Web-Studio-v1%20usandolo%20actualmente/cazas/canedostudio.com/tests/contact/server.test.mjs).
   - Total de pruebas en suite Contacto: **62 pruebas aprobadas (100% PASS)**.
   - Validación pasiva de producción contra `https://canedostudio.com`: intacta y operativa.

---

## 13. REGISTRO DE VALIDACIÓN END-TO-END EN STAGING — FASE 3F

**Fecha:** 2 de Noviembre de 2026  
**Proyecto:** `cs-contact-staging` (`b5e54336-9345-42b9-b5c4-b8a464f1855d`).  
**Base de Datos D1:** `cs-contact-staging` (`f22e2dcc-28f9-4abc-8970-4c1720f62471`).

### 13.1. Auditoría de Seguridad Previa al Despliegue
- **Token Telegram:** Sustituido y verificado (`@CanedoContactoBot`, `id: 8752343257`). Reside exclusivamente en `.dev.vars.contact-staging` (ignorado en Git). Cero secretos versionados.
- **Rate Limit Secret:** Generado nuevo secreto criptográfico HMAC de 64 caracteres hexadecimales (`crypto.randomBytes(32)`).
- **Aislamiento D1:** Se confirmó que `CONTACT_DB` apunta exclusivamente a la D1 de staging.

### 13.2. Despliegue y Prueba Real End-to-End
- **Despliegue de Prueba Activa:** `caec450f.cs-contact-staging.pages.dev` (`CONTACT_FORM_ENABLED="true"`, `CONTACT_DRY_RUN="false"`).
- **Identificador de Solicitud de Prueba:** `99db9781-50ce-4d82-bb37-ef8d694688d5`.
- **Respuesta HTTP:** `202 Accepted` (`state: 'saved'`).
- **Verificación en D1 Staging:**
  - Tabla `contact_requests`: 1 fila insertada (`state: 'saved'`).
  - Total solicitudes en base de datos: 6 (5 sintéticas Fase 2C + 1 real Fase 3F).
- **Verificación en Telegram:**
  - Alerta recibida con éxito en el grupo *"Alertas Canedo y Logs del Bot"* (`-5295421981`).
  - Tabla `contact_notifications`:
    - `telegram`: `state: 'accepted'`, `attempts: 1`, `code: 'PROVIDER_ACCEPTED'`, `provider_id: '3'`.
    - `email`: `state: 'pending'`, `attempts: 0` (cero llamadas o reintentos hacia Resend).

### 13.3. Restauración Inmediata de Seguridad
- **Despliegue de Restauración Inactivo:** `d2144775.cs-contact-staging.pages.dev` (`CONTACT_FORM_ENABLED="false"`).
- **Comprobación de Bloqueo:** Solicitudes posteriores retornan HTTP `503 Service Unavailable` (`state: 'not_saved'`).
- **Entorno de Producción:** `canedostudio.com` permanece 100% intacto, en deployment `3d99273d...`, retornando HTTP 405 en `/api/contact` y sirviendo el sitio principal.

---

## 14. PREPARACIÓN FINAL PARA PRODUCCIÓN (FASE 3G)

**Fecha:** 2 de Noviembre de 2026  
**Objetivo:** Análisis de seguridad del token, diagnóstico del outbox en D1, verificación de infraestructura y plan de activación/rollback.

### 14.1. Auditoría del Outbox D1 y Canal Email Pending
- **Causa Raíz Identificada:** La migración `0001_contact.sql` y `0002_retention_180_days.sql` definen un trigger SQL en la base de datos: `CREATE TRIGGER contact_request_created AFTER INSERT ON contact_requests BEGIN ... INSERT INTO contact_notifications(request_id, channel) SELECT NEW.id, 'email'...; END;`. Por diseño transaccional atómico de base de datos, el trigger siempre precrea ambas filas (`telegram` y `email`).
- **Comportamiento en `TELEGRAM_ONLY`:**
  - `server.mjs` despacha únicamente a los canales activos configurados (`telegram`).
  - El procesador de mantenimiento (`workers/contact-maintenance/index.mjs`) exige `adapters.email.configured` para procesar colas pendientes.
  - Al no haber credenciales de Resend, la fila `email` queda perpetuamente en estado inactivo `pending`, sin reintentos, sin cobros de cuota, sin ejecución de llamadas y sin impactar la experiencia del usuario.
- **Preparación de Migración 0003 para Producción:**
  - Para producción se puede aplicar una migración limpia que actualice el trigger `contact_request_created` para crear únicamente la fila `telegram` mientras el modo sea `TELEGRAM_ONLY`.

### 14.2. Estado del Token y Seguridad
- **Estado:** Se verificó que el token activo corresponde a `@CanedoContactoBot` (`id: 8752343257`).
- **Aislamiento:** Reside exclusivamente en `.dev.vars.contact-staging` (ignorado en Git). Cero secretos en Git.
- **Recomendación Pre-Producción:** Si el usuario desea rotar el token una última vez antes de producción, puede hacerlo mediante BotFather (`/revoke`) y proveer el nuevo valor únicamente al configurar los secretos de Cloudflare Pages en producción.

### 14.3. Infraestructura D1 de Producción
- Actualmente existen únicamente:
  - `f22e2dcc-28f9-4abc-8970-4c1720f62471` (`cs-contact-staging`)
  - `c3b0039f-0bb9-46a4-8abe-4c7ce3f1c3f0` (`canedostudio_sales_agent_db`)
  - `9a3e12c8-27e8-4fc8-b1b2-bd8d20d67941` (`social-media-history`)
- **Conclusión:** **No existe todavía una base D1 exclusiva de producción para Contacto.**
- **Acción requerida (pendiente de autorización):** Crear mediante Wrangler `canedostudio-contact-production` y aplicar las migraciones correspondientes antes de enlazar el binding `CONTACT_DB` en el proyecto `canedostudio`.

### 14.4. Plan de Rollback Inmediato
- En caso de anomalía tras la activación en producción, el rollback toma menos de 60 segundos:
  1. Configurar en Cloudflare Pages `canedostudio`: `CONTACT_FORM_ENABLED = "false"`.
  2. De inmediato, cualquier nueva petición HTTP a `/api/contact` retornará HTTP 503 (`not_saved`) y el frontend informará al visitante de las vías alternativas (WhatsApp / email corporativo).
  3. Los servicios existentes (KV `BLOG_POSTS`, artículos de Insights y `/api/nexus`) permanecerán 100% operativos.

---

## 15. PREPARACIÓN Y ACTIVACIÓN CONTROLADA DEL FORMULARIO EN PRODUCCIÓN (FASE 3H)

**Fecha:** 2 de Noviembre de 2026  
**Proyecto Objetivo:** `canedostudio` (`canedostudio.com`, `www.canedostudio.com`).  
**Estado:** Preparación técnica, implementación de migración 0003, validación de suites y requisitos de autorización.

### 15.1. Implementación de Migración `0003_telegram_only_trigger.sql`
- **Archivo:** [`cazas/canedostudio.com/migrations/contact/0003_telegram_only_trigger.sql`](file:///Users/luis/Desktop/Canedo-Web-Studio-v1%20usandolo%20actualmente/cazas/canedostudio.com/migrations/contact/0003_telegram_only_trigger.sql).
- **Acción:** Reemplaza el trigger `contact_request_created` para crear **exclusivamente la fila de canal `telegram`**.
- **Resultado:** Se elimina la generación de filas fantasma `email:pending`. Cero dependencias de Resend.
- **Pruebas:** Incorporada prueba de migración en [`tests/contact/d1.test.mjs`](file:///Users/luis/Desktop/Canedo-Web-Studio-v1%20usandolo%20actualmente/cazas/canedostudio.com/tests/contact/d1.test.mjs). **63 pruebas aprobadas (100% PASS)**.

### 15.2. Requisitos de Seguridad Previos a la Activación de Producción
1. **Confirmación Obligatoria de Rotación de Token:**
   - Se solicita al usuario confirmar si el token de `@CanedoContactoBot` fue revocado mediante `/revoke` en `@BotFather`.
   - **Regla estricta:** Un token que haya sido expuesto previamente jamás se provisionará en producción.
2. **Generación de Secretos Exclusivos de Producción:**
   - Se generará un nuevo `CONTACT_RATE_LIMIT_SECRET` criptográfico de 64 caracteres único para producción.
3. **Aislamiento D1 de Producción:**
   - Se creará una base D1 exclusiva `canedostudio-contact-production` (Wrangler).
   - Se aplicarán las migraciones 0001, 0002 y 0003.
   - `CONTACT_DB` en `canedostudio` apuntará únicamente a esa nueva base D1 (jamás a la de staging).

### 15.3. Protección del Ecosistema Productivo y Rollback
- **Bindings Productivos Preservados:**
  - KV `BLOG_POSTS` (`1a3b08427d144d51af218578387e09b5`).
  - Secreto `GEMINI_API_KEY` (Nexus AI).
  - Páginas estáticas, artículos de `/insights/*`, feed RSS y sitemap.
- **Rollback de Emergencia (< 60 segundos):**
  - Desactivar formulario vía variable remota: `CONTACT_FORM_ENABLED = "false"` (retorna 503 fail-closed inmediato).
  - En caso de requerir restauración de código, redesplegar el último deployment conocido estable de producción (`3d99273d-6548-47f7-b626-b9c1ec1c6838`).

---

## 16. ACTIVACIÓN DEFINITIVA EN PRODUCCIÓN (FASE 3I)

**Fecha:** 2 de Noviembre de 2026  
**Proyecto:** `canedostudio` (`canedostudio.com`, `www.canedostudio.com`).  
**Estado:** Formulario de Contacto ACTIVO y OPERATIVO con Cloudflare D1 y Telegram.

### 16.1. Infraestructura y Despliegue de Producción
- **Base de Datos D1 Creada:** `canedostudio-contact-production` (`8868bccb-0779-4c29-b996-633d6e954b9e`).
- **Migraciones Aplicadas con Éxito:**
  - `0001_contact.sql`: Tablas, cuotas, outbox y validaciones atómicas.
  - `0002_retention_180_days.sql`: Esquema de retención de 180 días e índices.
  - `0003_telegram_only_trigger.sql`: Trigger optimizado que genera únicamente el canal `telegram`.
- **Despliegue de Pages Publicado:** `8884ee5d.canedostudio.pages.dev` (Vinculado a dominios oficiales `canedostudio.com` y `www.canedostudio.com`).
- **Preservación Integral:**
  - Binding KV `BLOG_POSTS` (`1a3b08427d144d51af218578387e09b5`): 100% operativo (artículos, feed RSS, sitemap).
  - Asistente IA Nexus (`/api/nexus`): HTTP 200 operativo.
  - Estilos, fuentes, imágenes y navegación de todo el sitio: HTTP 200 operativos.

### 16.2. Verificación Real de la Solicitud Sintética en Producción
- **Identificador de Prueba (`requestId`):** `6f939cd9-a61f-4d02-9766-1bf2af099fc3`.
- **Respuesta del Servidor:** `HTTP 202 Accepted` (`state: 'saved'`).
- **Persistencia en D1 de Producción (`8868bccb...`):**
  - Registro insertado atómicamente en `contact_requests`: `state: 'saved'`, `created_at: 1793645403926`.
- **Notificación en Telegram:**
  - Registro en `contact_notifications`: `channel: 'telegram'`, `state: 'accepted'`, `code: 'PROVIDER_ACCEPTED'`, `provider_id: '4'`.
  - Alerta despachada y recibida en el grupo privado *"Alertas Canedo y Logs del Bot"* (`-5295421981`).
  - Filas de email creadas: **0** (confirmación estricta de la migración `0003`).

### 16.3. Tareas de Seguridad Pendientes
- **Rotación de Token:** El propietario autorizó el uso temporal del token existente. Queda agendada la rotación definitiva mediante BotFather (`/revoke`) en una ventana de mantenimiento posterior.

---

## 17. PUBLICACIÓN DE AJUSTES VISUALES EN PRODUCCIÓN (CONTACTO Y FOOTER)

**Fecha:** 2 de Noviembre de 2026  
**Proyecto:** `canedostudio` (`canedostudio.com`).  
**Nuevo Despliegue Publicado:** [`665eab66.canedostudio.pages.dev`](https://665eab66.canedostudio.pages.dev)  
**Despliegue Anterior Estable (Rollback):** [`8884ee5d.canedostudio.pages.dev`](https://8884ee5d.canedostudio.pages.dev)

### 17.1. Cambios Publicados
1. **Sección Final de Inicio (`index.html` y `home.html`):**
   - Texto actualizado: *"¿Tienes una idea para tu negocio? Cuéntanos qué necesitas y descubramos cómo podemos ayudarte."*
   - Añadido botón elegante con estilo glass a `/contacto` (*"Cuéntanos tu proyecto"*).
   - Preservado intacto el botón principal de WhatsApp y pie de respuesta.
2. **Retiro de Créditos en el Footer:**
   - Eliminada la línea de créditos de Unsplash de las 13 plantillas y del generador dinámico de artículos `functions/insights/[slug].js`.
   - Se verificó que la licencia gratuita de Unsplash no exige atribución obligatoria.
   - Preservados el copyright, política de privacidad y enlaces de redes sociales.

### 17.2. Verificaciones en Producción en Vivo (`canedostudio.com`)
- **Página de Inicio (`https://canedostudio.com/`):** Confirmada presencia del nuevo texto, botón a `/contacto`, botón de WhatsApp y eliminación de créditos en el footer.
- **Formulario de Contacto (`/contacto.html` y `/api/contact`):** HTTP 200 / 422 activo con D1 y Telegram operativos.
- **Blog Insights (`/blog`):** HTTP 200 operativo vía KV `BLOG_POSTS`.
- **Asistente IA Nexus (`/api/nexus`):** HTTP 200 operativo.

---

## 18. FASE 3K — VERIFICACIÓN, DIAGNÓSTICO DE DESPLIEGUE Y ESTABILIDAD

**Fecha:** 2 de Noviembre de 2026  
**Proyecto:** `canedostudio` (`canedostudio.com`, `www.canedostudio.com`).  
**Despliegue Productivo Estable Confirmado:** [`665eab66-4b44-4e6e-b00f-f7f74b41e4f0`](https://665eab66.canedostudio.pages.dev)  
**Estado:** PRODUCCIÓN 100% OPERATIVA. Formulario en modo `TELEGRAM_ONLY` validado, D1 persistente, Telegram activo, Blog y Nexus intactos.

### 18.1. Verificaciones Previas (Paso 1)
- **Suite de Contacto (68 pruebas automatizadas):** 68 passed (0 fail, 0 errors, 100% PASS).
- **Suite de Navegador (Puppeteer, 13 escenarios):** 13 passed (0 errors, 100% PASS).
- **Compilación de Build:** Aprobado sin errores.
- **Identificador de Despliegue Estable de Referencia:** `665eab66-4b44-4e6e-b00f-f7f74b41e4f0`.

### 18.2. Diagnóstico de Despliegue en Cloudflare Pages
- Al intentar publicar el nuevo bundle (`wrangler pages deploy . --project-name canedostudio`), Cloudflare Pages generó deployments (`846ed67f`, `4dc08959`, `f98c466e`) sin vincular los bindings D1 (`CONTACT_DB`) y variables de entorno del entorno de producción, debido a que el proyecto en la API de Pages no tiene el binding D1 reflejado en su archivo local `wrangler.toml` (que solo define `BLOG_POSTS`).
- Consecuentemente, el endpoint retornó `HTTP 503 ("El formulario aún no está disponible")` en los nuevos deployments.
- **Acción Inmediata de Protección (Paso 4):**
  - Se ejecutó el rollback de emergencia al despliegue estable verificado `665eab66-4b44-4e6e-b00f-f7f74b41e4f0`.
  - Se confirmó en vivo la restauración instantánea del dominio `canedostudio.com`.

### 18.3. Verificación Real Post-Rollback
- **Solicitud Sintética en Producción (`requestId`):** `11111111-2222-4333-8444-555555555555`.
- **Respuesta:** `HTTP 202 Accepted` (`state: 'saved'`).
- **Persistencia en D1 de Producción (`8868bccb-0779-4c29-b996-633d6e954b9e`):** Confirmado registro insertado en `contact_requests`.
- **Notificación en Telegram:** Confirmada notificación con `provider_id: 6`, `code: 'PROVIDER_ACCEPTED'` en `contact_notifications` hacia el grupo `-5295421981`.
- **Servicios Ecosistema:**
  - `https://canedostudio.com/`: HTTP 200.
  - `https://canedostudio.com/blog`: HTTP 200 (KV `BLOG_POSTS` intacto).
  - `https://canedostudio.com/api/nexus`: HTTP 200 (IA intacta).
  - `https://canedostudio.com/contacto`: HTTP 200.










