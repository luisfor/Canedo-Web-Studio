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

