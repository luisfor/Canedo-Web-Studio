# Canedo Studio — Blog Bot Automático (`canedostudio-blog-bot`)

Worker de Cloudflare Workers encargado de la generación, control de calidad y publicación automática programada de artículos editoriales para el blog «Insights» de Canedo Studio (`canedostudio.com`).

---

## 1. Arquitectura y Ejecución

- **Entorno de Ejecución:** Cloudflare Workers (ES Modules).
- **Modelo de IA Editorial:** `@cf/meta/llama-3.3-70b-instruct-fp8-fast` (Workers AI).
- **Modelo de Generación de Portadas:** `@cf/black-forest-labs/flux-1-schnell` (Workers AI) con respaldo fotográfico estructurado de contingencia.
- **Horarios Programados (Cron Triggers):** `0 12,22 * * *`
  - **7:00 a. m. Col (12:00 UTC):** Edición matutina inspirada en titulares reales de negocio/marketing (RSS) o catálogo curado.
  - **5:00 p. m. Col (22:00 UTC):** Edición vespertina orientada a consejos prácticos para pymes y automatización de procesos.
- **Persistencia Dual Canónica:**
  - **KV (`BLOG_POSTS`):** Caché rápida de posts para renderizado web.
  - **D1 (`BLOG_DB`):** Base de datos relacional canónica (`blog_posts`).

---

## 2. Estándar Editorial Inteligente (Fase V1-AG)

El Blog Bot incorpora el Estándar Editorial Inteligente de Canedo Studio para garantizar artículos útiles, profundos y de alta credibilidad empresarial:

1. **Cumplimiento Estricto de Promesas en Títulos:**
   - Detección determinista de números y sustantivos de lista (`7 estrategias`, `5 herramientas`, `10 errores`, etc.).
   - Exclusión de años (`2026`, `2027`), monedas y porcentajes.
   - Sincronización del esquema de generación (`generateArticleOutline`) para exigir a la IA exactamente la cantidad de secciones prometida.
   - Quality Gate determinista que bloquea artículos con listas incompletas, secciones vacías o numeraciones duplicadas/discontinuas.
   - Exclusión automática de encabezados auxiliares (`Introducción`, `Conclusiones`, `Preguntas frecuentes`) del conteo de ítems de lista.
2. **Profundidad, Casos Reales y Rigor Epistémico:**
   - Diferenciación analítica entre hechos documentados, predicciones tecnológicas y recomendaciones operativas.
   - Prohibición de cifras inventadas, estadísticas sin fuente y testimonios falsos.
   - Ejemplos sectoriales concretos obligatorios (talleres automotrices, clínicas dentales, asesorías, comercio local).
   - Calibración de longitud según los perfiles de `article_types.js` (Tipo 2 Consejos Pyme: 650–900 palabras).
3. **SEO, AEO, GEO y Conversión Comercial:**
   - Resumen ejecutivo directo (BLUF: Bottom Line Up Front).
   - Metadescripciones optimizadas a un máximo de 155 caracteres con corte limpio de palabras.
   - Llamados a la acción (CTA) contextuales integrados con naturalidad hacia los 5 servicios reales de Canedo Studio:
     - `/servicios/diseno-web` (Diseño Web Premium)
     - `/servicios/chatbots-ia` (Chatbots con IA)
     - `/servicios/automatizacion-resenas` (Embudos de Reseñas)
     - `/servicios/blog-automatizado` (Blogs Autogestionados)
     - `/contacto` (Diagnóstico Digital)
4. **Resiliencia, Observabilidad y Control de Costos:**
   - Límite estricto de 3 intentos de generación y 2 intentos de auditoría por ejecución.
   - Descarte limpio (`EditorialSkipError`) si no se supera el Quality Gate en los intentos permitidos, evitando bucles infinitos y consumo innecesario de tokens.
   - 0 llamadas extra a Workers AI durante las comprobaciones deterministas del Quality Gate.

---

## 3. Pruebas Automatizadas

La suite offline del Blog Bot se ejecuta con el test runner nativo de Node.js:

```bash
node --test automatismos/canedostudio-blog-bot/tests/*.test.mjs
```

### Cobertura de Pruebas:
- `bot_v1ag_editorial_standard.test.mjs`: Validación de promesas de listas, exclusión de metasecciones, AEO/BLUF, servicios comerciales y calibración de longitud.
- `bot_editorial_quality_gate.test.mjs`: Quality Gate Fase 6L (límites de palabras 650–900w y filtros léxicos).
- `bot_editorial_antirepeticion.test.mjs`: Detección determinista de oraciones y párrafos duplicados.
- `bot_schedules_and_fallbacks.test.mjs`: Ejecución programada en cron (12:00 y 22:00 UTC) y resiliencia de portadas Flux Schnell.
- `bot_resilience_and_qg.test.mjs`: Descarte defensivo ante fallos consecutivos y persistencia dual D1/KV.
