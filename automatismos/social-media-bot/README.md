# Bot de Redes Sociales - Canedo Studio

Este directorio contiene el código fuente del Bot Automatizado B2B para Canedo Studio. Se ejecuta en **Cloudflare Workers** y utiliza múltiples modelos de IA para generar publicaciones (ideas, copys e imágenes) de forma autónoma.

## Arquitectura y Modelos (Actualizado: Septiembre 2026)
* **Generación de Textos y Quality Gate:** `openai/gpt-4o-mini` (vía OpenRouter). Elegido por su excelente seguimiento de reglas complejas anti-clichés y formateo estricto de JSON.
* **Generación de Imágenes:** `google/gemini-3.1-flash-image` (vía OpenRouter). Utilizado para crear creativos publicitarios con diseño premium B2B y texto integrado legíble.
* **Fallback de Emergencia:** Si OpenRouter falla, el sistema intenta usar la API directa de OpenAI (`gpt-4o-mini`).
* **Base de Datos:** Cloudflare D1 (`social-media-history`) para rastrear el historial de publicaciones, evitar copias y gestionar la idempotencia.
* **Almacenamiento Visual:** Cloudflare R2 (`canedo-content`).
* **Integración y Aprobación:** Telegram (vía ID de Grupo).

## Características Principales
1. **Quality Gates Múltiples:** 
   - *Determinista:* Bloquea frases genéricas y valida uso de marca ("Canedo Studio").
   - *Evaluación de IA:* Evalúa el "Hook Strength", "Humanización", "Especificidad" y otros factores antes de aprobar un texto.
   - *Test de 5 Segundos (Visual):* Evalúa la imagen generada para garantizar que el servicio y beneficio sean claros al instante.
2. **Generación con Imagen Propia:** Si el usuario sube una imagen por Telegram, el bot usa Gemini Vision para analizarla y escribe un copy en contexto, utilizando la imagen original sin alterarla (si así se desea).
3. **Formateo Avanzado:** Garantiza párrafos legibles y separados con saltos de línea dobles (`\n\n`) adecuados para Instagram, LinkedIn y Facebook.

## Despliegue
Para subir cambios a producción, ejecutar:
```bash
npm run deploy
```
