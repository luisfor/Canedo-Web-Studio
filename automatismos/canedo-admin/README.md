# Canedo Admin — Panel de Operaciones y Gestión Editorial

Worker de Cloudflare para administración centralizada de Canedo Studio a través de Telegram (`@CanedoStudioAdminBot`).

## Capacidades Principales

1. **Gestión Editorial del Blog de Insights:**
   - Auditoría y consulta de artículos publicados en D1/KV.
   - Creación de borradores con IA bajo demanda.
   - 🎥 **Crear desde YouTube:** Ingesta de video, extracción oEmbed, generación editorial con Llama 3.3 70B y previsualización.
   - 🔗 **Crear desde Enlace Web (Fase V1-X/V1-Z):** Ingesta segura de artículos/noticias web HTTPS, extracción anti-SSRF, selección de enfoque (Informativo, Comercial Canedo, Técnico), auditoría Quality Gate determinista y persistencia idempotente en D1.
   - Flujo de aprobación humana: Teclado interactivo para aprobar, editar, regenerar o descartar borradores antes de sincronizar con KV/D1.

2. **Gestión Comercial y CRM (Fase 4):**
   - Panel de leads y prospectos integrados con el formulario web `/contacto.html`.
   - Consulta de pipeline, recordatorios y seguimiento de estados comerciales directamente desde Telegram.

3. **Operaciones y Resiliencia:**
   - Jobs en segundo plano desacoplados mediante `admin_jobs` en D1.
   - Recuperación automática de jobs interrumpidos (`recoverInterruptedJobs`) sin duplicación de borradores gracias a claves deterministas y `ON CONFLICT DO UPDATE`.
   - Control de sesiones conversacionales mediante Cloudflare KV con caducidad TTL.

## Arquitectura de «Crear desde YouTube»

```
Telegram Admin --> [🎥 Crear desde YouTube] (callback: blog:yt:prompt)
       |
       v
Solicitud de URL YouTube (KV state: awaiting_yt_url, TTL: 600s)
       |
       v
Recepción de URL y consulta oEmbed (`modules/youtube/service.js`):
  - Ingesta de metadatos (título, autor, canonicalUrl, embeddability)
  - Comprobación de duplicados en D1 (`blog_posts` y `blog_manual_drafts`)
  - Almacena en KV: `{ action: "awaiting_yt_context", sourcePayload }`
  - Muestra ficha del video y botón inline `[📝 Aportar Transcripción / Notas]`
       |
       v
Pulsación de [📝 Aportar Transcripción / Notas] (callback: blog:yt:confirm:<videoId>):
  - Validación sintáctica estricta de videoId (11 caracteres)
  - Preservación íntegra de `sourcePayload` verificado desde KV
  - Rechazo con reseteo seguro si el callback no coincide con el video en curso
       |
       v
Recepción de transcripción o notas clave (mínimo 50 caracteres):
  - Admite `sourcePayload.videoId` y normaliza sesiones históricas con `videoId` plano
  - Sanitización contra prompt injections
  - Almacena notas en KV y transiciona a `awaiting_yt_angle`
       |
       v
Selección de Enfoque Editorial:
  - [💡 Informativo] [💼 Comercial Canedo] [⚙️ Técnico]
       |
       v
Encolado asíncrono en D1 (`admin_jobs`, type: `blog_generate_youtube_draft`)
       |
       v
Generación con Workers AI (Llama 3.3 70B) + Quality Gate + Inserción de reproductor 16:9
       |
       v
Notificación y Teclado de Aprobación en Telegram al Administrador
```

## Arquitectura de «Crear desde Enlace Web»

```
Telegram Admin --> [🔗 Crear desde Enlace Web]
       |
       v
Solicitud de URL HTTPS (KV state: awaiting_web_url)
       |
       v
Extractor Web (`modules/research/web_extractor.js`):
  - Validación HTTPS estricta y filtros anti-SSRF (bloqueo IPv4/IPv6 privadas y metadatos cloud)
  - Límite de payload (512 KB) y timeout (7s)
  - Limpieza de scripts/estilos y extracción de metadatos OpenGraph/Schema.org
       |
       v
Detección de duplicados contra D1 (`blog_posts` y `blog_manual_drafts`)
       |
       v
Selección de Enfoque Editorial (KV state: awaiting_web_angle):
  - [Informativo] [Comercial Canedo] [Técnico]
       |
       v
Encolado asíncrono en D1 (`admin_jobs`, type: `blog_generate_web_draft`)
       |
       v
Generación con Workers AI (Llama 3.3 70B) + Quality Gate (`web_pipeline.js`)
       |
       v
Persistencia Idempotente en D1 (`blog_manual_drafts` con ON CONFLICT DO UPDATE)
       |
       v
Notificación y Teclado de Aprobación en Telegram al Administrador
```

## Modelos de Inteligencia Artificial (Workers AI)

El panel editorial de Canedo Admin utiliza la infraestructura de Cloudflare Workers AI con los siguientes modelos homologados:

- **Modelo Editorial Principal:** `@cf/meta/llama-3.3-70b-instruct-fp8-fast`
  - Utilizado tanto en **Crear desde YouTube** (`modules/youtube/editorial_pipeline.js`) como en **Crear desde Enlace Web** (`modules/blog/web_pipeline.js`).
  - Sustituye de manera definitiva a `@cf/meta/llama-3.1-8b-instruct` (retirado por Cloudflare con error `5028`).
  - Optimizado para redacción en español de alta calidad, respeto a guías de estilo, estructura en Markdown limpio e inyección de bloques interactivos.
- **Modelo de Portadas Fotográficas:** `@cf/black-forest-labs/flux-1-schnell`
  - Generación de portadas fotográficas editoriales de contingencia estructurada y estilizada para artículos aprobados manualmente.

## Quality Gate Determinista y Política de Aprobación Humana

- **Auditoría Local:** Las evaluaciones de calidad (`auditYouTubeArticle` y `auditWebArticle`) se ejecutan con lógica determinista local sin consumir llamadas de IA ni generar costos adicionales.
- **Sin Publicación Automática:** Toda generación produce exclusivamente un borrador (`status: "draft"`) en la base de datos D1 (`blog_manual_drafts`). La publicación en el sitio web exige la acción humana explícita del administrador mediante el botón `Aprobar Borrador` en Telegram.

## Pruebas Automatizadas

Para ejecutar las pruebas del módulo de forma offline:

```bash
node --test tests/*.test.mjs
```

Para verificar exclusivamente el pipeline web:

```bash
node --test tests/fase_v1x_web_pipeline.test.mjs
node --test tests/fase_e1_web_extractor.test.mjs
```

