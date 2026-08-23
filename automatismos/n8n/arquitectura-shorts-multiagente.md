# Flujo de Trabajo: Generador Automático de Shorts (Multi-Agente)

Esta es la arquitectura de n8n para automatizar la creación de videos cortos (Shorts/Reels) usando IA (Gemini, Veo3) basándose en la regla de separar las tareas en **agentes especialistas pequeños**.

## 💡 Arquitectura

En lugar de usar un solo prompt enorme, conectamos nodos de n8n de forma secuencial. Cada "Agente" es un nodo de IA independiente optimizado para una tarea específica:

1. **Trigger / Entrada**: Recibe el artículo base (vía Webhook, Google Sheets, RSS, o Airtable).
2. **El Analizador (Information Extractor / Basic LLM Chain)**:
   - Lee el texto crudo.
   - Extrae la información y devuelve **únicamente** el JSON estructurado con la disección del contenido.
3. **El Guionista (Basic LLM Chain o AI Agent)**:
   - Recibe el JSON del Analizador.
   - Redacta el guion exacto (hooks, cuerpo y CTA) asegurando la retención del espectador.
4. **El Director de Video (Basic LLM Chain)**:
   - Recibe el guion.
   - Genera los "Prompts para Veo3" (ángulos de cámara, estilo visual, transiciones) y marca los tiempos precisos (duración de escenas).
5. **El Especialista SEO (Basic LLM Chain o AI Agent con Herramientas)**:
   - Toma todo el contexto y genera el Título del video, la Descripción optimizada, Etiquetas y define la URL de destino.
6. **Salida / Integración**: Envía todo el paquete listo a Google Drive, Notion, o directo a la herramienta de renderizado.

---

## 🛠️ Detalles del Primer Nodo: "El Analizador"

Dado que la regla de n8n es "usar la herramienta más ligera que cumpla el trabajo", para forzar una salida estrictamente en JSON sin explicaciones extras, se usa una cadena de LLM básica conectada a un Analizador Estructurado (Structured Output Parser).

### Esquema JSON (Output Parser)
El parser obliga a la IA (ej: Gemini) a devolver exactamente esta estructura:

```json
{
  "tema": "string",
  "categoria": "string",
  "audiencia": "string",
  "nivel_de_conocimiento": "string (ej: Principiante, Intermedio, Experto)",
  "problema_principal": "string",
  "dolores": ["string"],
  "beneficios": ["string"],
  "objetivo_de_video": "string",
  "emocion": "string",
  "tono": "string",
  "cta": "string",
  "palabras_clave": ["string"],
  "hashtags": ["string"],
  "tipo_de_video": "string",
  "duracion_en_segundos": "number",
  "estilo_visual": "string",
  "url_de_destino": "string"
}
```

**Nota sobre Auto-Fixing**: n8n permite activar la opción `autoFix: true` en el Output Parser. Si la IA comete un error de sintaxis en el JSON (como una coma de más), n8n usará automáticamente un modelo reparador para corregir el JSON en milisegundos sin romper el flujo.

---

## 🚀 Fase 2: Generación, Almacenamiento y Publicación

El objetivo final de esta arquitectura no es solo el guion, sino obtener un archivo de video MP4 y distribuirlo automáticamente en redes sociales manteniendo los datos del artículo original.

### Flujo de la Fase 2

1. **Control de Duplicados (Preventivo)**: Un sistema (Data Store o Sheets) ubicado *al inicio* del flujo (después del RSS) detiene la ejecución si el artículo ya fue procesado, ahorrando tokens y peticiones a la API de video.
2. **Empaquetado de Datos (Nodo Set)**: Recopila todas las variables valiosas (Guion, Prompt visual, Título SEO, URL del RSS) en un solo JSON estructurado para facilitar la interconexión con APIs externas.
3. **Generación con Google Veo (API Oficial)**:
   - Envía el prompt visual generado por el "Director de Video".
   - Al ser un proceso asíncrono, se implementa un **Wait Loop** (Ciclo de Espera) con reintentos controlados que consulta el `operation_id` hasta que el video esté finalizado, evitando ciclos infinitos.
4. **Descarga y Nomenclatura**: El binario del video MP4 es descargado conservando metadatos. Se nombra sistemáticamente: `canedo-studio-{slug-articulo}-{fecha}.mp4`.
5. **Google Drive**: Almacena el MP4 en una estructura de carpetas jerárquica (Año/Mes) junto con un registro del `video_id`, URL y metadatos.
6. **Publicación Multi-Plataforma**: 
   - **YouTube Shorts (API Oficial)**: Sube el video usando el título, descripción y hashtags del Especialista SEO.
   - **Futuras integraciones**: Arquitectura preparada para Meta Graph API (Reels) y TikTok API, sin usar intermediarios (como Make o Zapier).
7. **Registro Final y Manejo de Errores**:
   - Registro absoluto del éxito (URLs publicadas).
   - Manejo de excepciones: Si la subida a YouTube falla, el flujo *no* vuelve a generar el video con Veo, sino que reintenta la subida del MP4 que ya está en Drive.
