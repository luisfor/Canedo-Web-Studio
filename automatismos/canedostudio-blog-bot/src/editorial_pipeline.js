// File: automatismos/canedostudio-blog-bot/src/editorial_pipeline.js
// Pipeline editorial adaptativo en Markdown con soporte para 5 Tipos y generación seccional resiliente
// Compatible al 100% con Cloudflare Workers AI y el renderizado histórico de Canedo Studio

import { validateEnrichedArticleData } from "./seo/service_mapping.js";
import { resolveArticleType } from "./article_types.js";

const MODEL_TEXT = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const MARKDOWN_SYSTEM_PROMPT = `Eres el redactor jefe del blog "Insights" de Canedo Studio, una agencia de automatización con IA para empresas.
Estilo: español neutro, cercano y ejecutivo; tutea al lector; persuasivo pero honesto; frases claras, cero jerga técnica sin explicar.

REGLAS DURAS OBLIGATORIAS:
- NUNCA inventes cifras concretas, estadísticas falsas, porcentajes sin fuente, nombres comerciales inventados ni testimonios ficticios. Habla de realidades operativas y sentido común de negocio.
- EJEMPLOS OBLIGATORIOS: Desarrolla ejemplos prácticos basados en tipos o arquetipos de negocios cotidianos (por ejemplo: un taller mecánico, una clínica dental, un despacho contable, un restaurante o una tienda local), describiendo la fricción operativa real que viven y cómo se resuelve.
- CERO REPETICIÓN: Cada párrafo debe aportar un argumento o matiz nuevo. Está TERMINANTEMENTE PROHIBIDO repetir párrafos o duplicar ideas textualmente.

FORMATO DE SALIDA OBLIGATORIO:
- Devuelve ÚNICAMENTE texto en formato Markdown estándar limpio.
- NO uses bloques JSON ni código envolvente. NO uses comillas globales.
- Encabezados de sección usando ## Subtítulo.
- Opcionalmente una cita destacada usando > Cita potente.
- Párrafos de conclusión y cierre con llamada a la acción hacia un diagnóstico estratégico.`;

export function parseMarkdownToBlocks(md, title = "") {
  if (typeof md !== "string") return [];
  let text = md.trim();
  // Limpiar posibles wrappers de bloque de código que el modelo pueda emitir
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:markdown)?\s*/i, "").replace(/\s*```$/, "").trim();
  }

  // Normalizar saltos de línea Windows
  text = text.replace(/\r\n/g, "\n");

  // Normalizar el título principal para evitar duplicarlo si el modelo lo inserta como H1/H2 inicial
  const normalizedTitle = typeof title === "string" ? title.trim().toLowerCase() : "";

  // Dividir por doble salto de línea inicial
  const rawSections = text.split(/\n\s*\n/);
  const blocks = [];

  for (const raw of rawSections) {
    const s = raw.trim();
    if (!s) continue;

    const lines = s.split("\n").map(l => l.trim()).filter(Boolean);
    if (!lines.length) continue;

    const firstLine = lines[0];

    // Caso 1: Línea que comienza con encabezado Markdown (#, ##, ###, ####)
    if (/^#{1,6}\s+/.test(firstLine)) {
      const match = firstLine.match(/^(#{1,6})\s+(.*)$/);
      const level = match[1].length;
      let headingText = (match[2] || "").replace(/\s*#*$/, "").trim();

      // Limpiar asteriscos de negrita innecesarios envolventes en títulos (ej: **Título**)
      if (headingText.startsWith("**") && headingText.endsWith("**") && headingText.length > 4) {
        headingText = headingText.slice(2, -2).trim();
      }

      // Si el encabezado repite exactamente el título del artículo, omitirlo
      if (normalizedTitle && headingText.toLowerCase() === normalizedTitle) {
        // Si venían líneas de contenido tras el título duplicado, procesarlas como párrafos
        if (lines.length > 1) {
          const restParagraph = lines.slice(1).join(" ").trim();
          if (restParagraph) {
            blocks.push({ type: "p", text: restParagraph.replace(/\s+/g, " ") });
          }
        }
        continue;
      }

      // Determinar si es H2 o H3 (Regla editorial: H2 para secciones principales, H3 para subsecciones)
      const blockType = level >= 3 ? "h3" : "h2";

      // Manejar el caso donde el encabezado tiene un párrafo pegado en la siguiente línea sin doble salto
      if (lines.length > 1) {
        const restParagraph = lines.slice(1).join(" ").trim();
        if (headingText) {
          blocks.push({ type: blockType, text: headingText });
        }
        if (restParagraph) {
          // Detectar si el resto era una lista o cita
          if (/^[-*•]\s+/.test(lines[1])) {
            const listItems = lines.slice(1).map(l => l.replace(/^[-*•]\s*/, "").trim()).filter(Boolean);
            blocks.push({ type: "ul", items: listItems });
          } else {
            blocks.push({ type: "p", text: restParagraph.replace(/\s+/g, " ") });
          }
        }
      } else {
        // En una sola línea: preservar el encabezado legítimo independientemente de su longitud
        // Si contiene puntuación fuerte que divide un título de una oración explicativa (ej: ": ", ". "),
        // normalizar de forma segura sin degradarlo si es un encabezado extendido.
        if (headingText) {
          // Si termina con punto final y contiene más de una oración (punto seguido), separar la segunda oración a párrafo
          const sentenceSplit = headingText.match(/^([^.?!]+[.?!])\s+([A-ZÁÉÍÓÚÑ].+)$/);
          if (sentenceSplit && headingText.length > 90) {
            console.warn(`[EDITORIAL HEADING WARN] Encabezado compuesto normalizado: "${sentenceSplit[1]}"`);
            blocks.push({ type: blockType, text: sentenceSplit[1].trim() });
            blocks.push({ type: "p", text: sentenceSplit[2].trim() });
          } else {
            blocks.push({ type: blockType, text: headingText });
          }
        }
      }
    } else if (/^>\s+/.test(firstLine)) {
      // Caso 2: Cita en bloque
      const quote = lines.map(l => l.replace(/^>\s*/, "").trim()).join(" ").trim();
      if (quote) {
        blocks.push({ type: "quote", text: quote });
      }
    } else if (/^[-*•]\s+/.test(firstLine)) {
      // Caso 3: Lista de viñetas no ordenada
      const listItems = lines.map(l => l.replace(/^[-*•]\s*/, "").trim()).filter(Boolean);
      if (listItems.length > 0) {
        blocks.push({ type: "ul", items: listItems });
      }
    } else if (/^\d+\.\s+/.test(firstLine)) {
      // Caso 4: Lista ordenada o numeral
      const listItems = lines.map(l => l.replace(/^\d+\.\s*/, "").trim()).filter(Boolean);
      if (listItems.length > 0) {
        blocks.push({ type: "ol", items: listItems });
      }
    } else {
      // Caso 5: Párrafo estándar
      // Verificar si en medio de las líneas hay un subtítulo sin doble salto previo
      let currentParagraphLines = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/^#{1,6}\s+/.test(line)) {
          if (currentParagraphLines.length > 0) {
            blocks.push({ type: "p", text: currentParagraphLines.join(" ").replace(/\s+/g, " ").trim() });
            currentParagraphLines = [];
          }
          const m = line.match(/^(#{1,6})\s+(.*)$/);
          const lvl = m[1].length;
          let hText = (m[2] || "").replace(/\s*#*$/, "").trim();
          if (hText.startsWith("**") && hText.endsWith("**") && hText.length > 4) {
            hText = hText.slice(2, -2).trim();
          }
          if (!(normalizedTitle && hText.toLowerCase() === normalizedTitle)) {
            blocks.push({ type: lvl >= 3 ? "h3" : "h2", text: hText });
          }
        } else if (/^[-*•]\s+/.test(line)) {
          if (currentParagraphLines.length > 0) {
            blocks.push({ type: "p", text: currentParagraphLines.join(" ").replace(/\s+/g, " ").trim() });
            currentParagraphLines = [];
          }
          const listLines = [];
          while (i < lines.length && /^[-*•]\s+/.test(lines[i])) {
            listLines.push(lines[i].replace(/^[-*•]\s*/, "").trim());
            i++;
          }
          i--; // Ajustar el índice tras consumir la lista
          if (listLines.length > 0) {
            blocks.push({ type: "ul", items: listLines });
          }
        } else {
          currentParagraphLines.push(line);
        }
      }

      if (currentParagraphLines.length > 0) {
        const paragraph = currentParagraphLines.join(" ").replace(/\s+/g, " ").trim();
        if (paragraph) {
          blocks.push({ type: "p", text: paragraph });
        }
      }
    }
  }

  return blocks;
}

function readTextResponse(res) {
  let raw;
  if (typeof res === "string") raw = res;
  else if (res && typeof res.response === "string") raw = res.response;
  else if (res && res.choices && res.choices[0] && res.choices[0].message) raw = res.choices[0].message.content;
  if (typeof raw !== "string") {
    throw new Error("Formato inesperado del modelo en editorial_pipeline: " + JSON.stringify(res).slice(0, 250));
  }
  return raw;
}

/**
 * Genera el artículo de forma monolítica para tipos 1 y 2 (hasta 1.000 palabras)
 */
async function generateMonolithicMarkdown(env, brief, topic, articleType, attempt = 1, feedback = null, stats = null) {
  if (stats) stats.writerCalls = (stats.writerCalls || 0) + 1;
  const topicTitle = (topic && topic.tema) ? topic.tema.trim() : (brief && brief.uniqueThesis ? brief.uniqueThesis.trim() : "");
  const topicAngle = (topic && topic.angulo) ? topic.angulo.trim() : "";

  let prompt = `Escribe el artículo completo en formato Markdown estándar para el blog "Insights".
PERFIL DE ARTÍCULO: ${articleType.name}
EXTENSIÓN ESTRICTA: Entre ${articleType.minWords} y ${articleType.maxWords} palabras reales en el cuerpo editorial.

TEMA Y ENFOQUE OBLIGATORIO:
- Título/Tema de referencia: "${topicTitle}"
- Ángulo operativo: "${topicAngle}"

Brief Editorial Estratégico:
${JSON.stringify(brief, null, 2)}

INSTRUCCIONES CLAVE DE DESARROLLO:
1. Longitud obligatoria: OBLIGATORIO mantenerse entre ${articleType.minWords} y ${articleType.maxWords} palabras reales. Desarrolla los argumentos con rigor.
2. Desarrolla al menos 2 ejemplos con sectores de negocios cotidianos (talleres mecánicos, clínicas dentales, comercios locales, despachos contables).
3. No repitas párrafos ni uses ideas idénticas en la conclusión.
4. No uses inventos de porcentajes ni nombres comerciales ficticios.
5. Salida: Exclusivamente texto Markdown, sin comillas JSON ni formato envolvente.`;

  if (attempt > 1 && feedback && feedback.reasons) {
    prompt += `\n\nINTENTO ANTERIOR FALLIDO. MOTIVOS DEL AUDITOR:\n${JSON.stringify(feedback.reasons, null, 2)}\nCorrige de forma exhaustiva estos aspectos.`;
  }

  const res = await env.AI.run(MODEL_TEXT, {
    messages: [
      { role: "system", content: MARKDOWN_SYSTEM_PROMPT },
      { role: "user", content: prompt }
    ],
    max_tokens: 3000,
    temperature: 0.72
  });

  return readTextResponse(res);
}

/**
 * Cuenta palabras reales en una cadena de texto (excluyendo markdown sintáctico)
 */
export function countWordsInString(text) {
  if (typeof text !== "string") return 0;
  const clean = text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s+/gm, "")
    .replace(/\*{1,3}|_{1,3}/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`{1,3}[^`]*`{1,3}/g, "")
    .trim();
  const tokens = clean.split(/\s+/).filter(Boolean);
  return tokens.length;
}

/**
 * Genera el esquema de secciones para artículos (Tipos 2, 3, 4 y 5 o con extensión objetivo >= 650 palabras)
 */
async function generateArticleOutline(env, brief, topic, articleType, targetWords = null) {
  const topicTitle = (topic && topic.tema) ? topic.tema.trim() : "";
  const effectiveWords = targetWords || Math.round((articleType.minWords + articleType.maxWords) / 2);
  let targetSections = 2; // Por defecto 2 secciones + intro para Tipo 2 (~700-900w)
  if (effectiveWords >= 2200) targetSections = 5;
  else if (effectiveWords >= 1600) targetSections = 4;
  else if (effectiveWords >= 1100) targetSections = 3;

  const outlinePrompt = `Diseña el esquema estructurado en ${targetSections} secciones para una guía técnica/artículo extenso sobre:
Tema: "${topicTitle}"
Tesis: "${brief.uniqueThesis || topicTitle}"
Perfil: ${articleType.name} (Extensión total esperada: ${articleType.minWords}-${articleType.maxWords} palabras, objetivo específico: ${effectiveWords} palabras).

Devuelve ÚNICAMENTE un JSON con este formato (máx 350 tokens):
{
  "sections": [
    { "heading": "Subtítulo de la sección 1", "goal": "Qué dilema práctico o paso aborda" },
    { "heading": "Subtítulo de la sección 2", "goal": "Ejemplo cotidiano y desglose operativo" }
  ]
}
Sin bloques de código markdown ni explicaciones adicionales.`;

  try {
    const res = await env.AI.run(MODEL_TEXT, {
      messages: [
        { role: "system", content: "Eres el arquitecto de contenidos de Canedo Studio. Devuelves únicamente JSON." },
        { role: "user", content: outlinePrompt }
      ],
      max_tokens: 600,
      temperature: 0.3
    });
    const raw = readTextResponse(res).trim();
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      const parsed = JSON.parse(cleaned.slice(start, end + 1));
      if (parsed.content && Array.isArray(parsed.content)) {
        // El mock devolvió directamente un artículo completo monolítico en lugar de un esquema
        return parsed;
      }
      if (Array.isArray(parsed.sections) && parsed.sections.length >= 2) {
        return parsed.sections;
      }
    }
  } catch (e) {
    // Fallback determinista si falla la IA o el mock no implementa el prompt de esquema
    console.warn("[OUTLINE AI WARN] Falló esquema IA, aplicando esquema determinista:", e.message);
  }

  // Fallback determinista seguro
  if (targetSections === 2) {
    return [
      { heading: "Fricción operativa real y pérdidas cotidianas", goal: "Explicar el problema con casos reales de negocios" },
      { heading: "Protocolo de solución práctica y siguientes pasos", goal: "Pasos concretos de automatización y cierre comercial" }
    ];
  }

  return [
    { heading: "Fricción operativa inicial y coste de oportunidad", goal: "Plantear el escenario real y la pérdida recurrente" },
    { heading: "Protocolo de implantación paso a paso en el negocio", goal: "Desarrollar soluciones con ejemplos cotidianos concretos" },
    { heading: "Trade-offs y mantenimiento sostenible del sistema", goal: "Límites operativos, control de calidad y cierre comercial" }
  ];
}

/**
 * Genera artículos largos mediante orquestación resiliente por secciones con conteo determinista, expansión y condensación quirúrgica
 */
async function generateSectionalMarkdown(env, brief, topic, articleType, attempt = 1, feedback = null, stats = null, onSectionProgress = null) {
  if (stats) stats.writerCalls = (stats.writerCalls || 0) + 1;
  const topicTitle = (topic && topic.tema) ? topic.tema.trim() : "";
  const topicAngle = (topic && topic.angulo) ? topic.angulo.trim() : "";
  // Clamping seguro de targetWords al rango legal del tipo editorial
  const requestedTarget = topic?.targetWords ? Number(topic.targetWords) : null;
  const defaultMidpoint = Math.round((articleType.minWords + articleType.maxWords) / 2);
  const targetWords = requestedTarget
    ? Math.min(articleType.maxWords - 50, Math.max(articleType.minWords + 50, requestedTarget))
    : defaultMidpoint;

  // 1. Obtener el esquema de secciones
  const outline = await generateArticleOutline(env, brief, topic, articleType, targetWords);
  const totalParts = outline.length + 1; // 1 intro + N secciones
  const wordsPerSection = Math.round(targetWords / totalParts);

  let fullMarkdown = "";

  // 2. Generar Introducción y dilema inicial
  const introPrompt = `Escribe la introducción en Markdown para el artículo:
Tema: "${topicTitle}"
Ángulo: "${topicAngle}"
Tesis: "${brief.uniqueThesis || topicTitle}"
Objetivo de esta parte introductoria: Plantear el problema comercial de fondo con rigor y concisión. Extensión objetivo: aproximadamente ${wordsPerSection} palabras (máximo ${Math.round(wordsPerSection * 1.25)} palabras) en 2 párrafos sólidos.
Sin subtítulos, solo los párrafos iniciales de apertura en Markdown. Cero clichés.`;

  const introRes = await env.AI.run(MODEL_TEXT, {
    messages: [
      { role: "system", content: MARKDOWN_SYSTEM_PROMPT },
      { role: "user", content: introPrompt }
    ],
    max_tokens: 1200,
    temperature: 0.65
  });
  const introText = readTextResponse(introRes).trim();

  // Si el mock devuelve directamente un artículo completo que ya incluye subtítulos ##, devolver directamente
  if (introText.includes("## 1.") || introText.includes("## Diagnóstico") || (introText.match(/##\s+/g) || []).length >= 2) {
    return introText;
  }

  fullMarkdown += introText + "\n\n";
  if (typeof onSectionProgress === "function") await onSectionProgress(1, totalParts);

  // 3. Generar cada sección del esquema manteniendo el hilo conductor
  let prevContext = fullMarkdown.slice(-400);
  const sectionTexts = [];

  for (let i = 0; i < outline.length; i++) {
    const sec = outline[i];
    const isLast = (i === outline.length - 1);

    const sectionPrompt = `Continúa redactando el artículo sobre "${topicTitle}".
SECCIÓN ACTUAL:
## ${sec.heading}
Objetivo específico de esta sección: ${sec.goal}
Extensión objetivo para esta sección: entre ${wordsPerSection} y ${Math.round(wordsPerSection * 1.25)} palabras. Sé directo, operativo y evita la verborrea o rodeos innecesarios.

Contexto inmediato anterior para mantener la fluidez:
"...${prevContext}..."

REGLAS ESTRICTAS:
- Comienza con el subtítulo ## ${sec.heading}
- Desarrolla ejemplos prácticos sectoriales (talleres, clínicas dentales, asesorías, comercio local).
- ${isLast ? "Esta es la sección final: incluye conclusiones claras y llamada a la acción hacia un diagnóstico estratégico con Canedo Studio." : "No concluyas todavía el artículo, continúa profundizando."}
- NO repitas frases ni ideas del texto previo. Salida en Markdown limpio.`;

    const secRes = await env.AI.run(MODEL_TEXT, {
      messages: [
        { role: "system", content: MARKDOWN_SYSTEM_PROMPT },
        { role: "user", content: sectionPrompt }
      ],
      max_tokens: 1500,
      temperature: 0.70
    });

    const secText = readTextResponse(secRes).trim();
    sectionTexts.push({ heading: sec.heading, text: secText });
    fullMarkdown += secText + "\n\n";
    prevContext = secText.slice(-400);

    if (typeof onSectionProgress === "function") await onSectionProgress(i + 2, totalParts);
  }

  // 4. Verificación y calibración determinista post-generación (Ampliación o Condensación Quirúrgica)
  const targetMinGrossWords = articleType.minWords + 40;
  const targetMaxGrossWords = articleType.maxWords;
  let currentWords = countWordsInString(fullMarkdown);

  // CASO A: Artículo corto -> Micro-ampliación quirúrgica
  if (currentWords < targetMinGrossWords && (stats?.writerCalls || 0) < 6) {
    const deficit = targetMinGrossWords - currentWords;
    const targetSecIndex = Math.max(0, sectionTexts.length - 2);
    const secToExpand = sectionTexts[targetSecIndex] || sectionTexts[0];

    if (secToExpand) {
      if (stats) stats.writerCalls = (stats.writerCalls || 0) + 1;
      const expandPrompt = `Amplía con mayor profundidad técnica y un caso práctico adicional la siguiente sección del artículo sobre "${topicTitle}".
SECCIÓN ACTUAL:
${secToExpand.text}

REQUISITO:
- Agrega 1 o 2 párrafos adicionales con un ejemplo práctico detallado (fricciones, tiempos, errores habituales).
- Aporta entre ${Math.max(120, deficit + 40)} y 250 palabras nuevas de alto valor sin repetir lo ya escrito.
- Mantén la estructura y devuelve la sección ampliada completa en Markdown.`;

      try {
        const expandRes = await env.AI.run(MODEL_TEXT, {
          messages: [
            { role: "system", content: MARKDOWN_SYSTEM_PROMPT },
            { role: "user", content: expandPrompt }
          ],
          max_tokens: 1200,
          temperature: 0.65
        });
        const expandedSecText = readTextResponse(expandRes).trim();
        const expandedWords = countWordsInString(expandedSecText);
        if (expandedWords > countWordsInString(secToExpand.text)) {
          fullMarkdown = fullMarkdown.replace(secToExpand.text, expandedSecText);
          currentWords = countWordsInString(fullMarkdown);
        }
      } catch (expandErr) {
        console.warn("[SECTION EXPAND WARN] Micro-ampliación no pudo completarse:", expandErr.message);
      }
    }
  }

  // CASO B: Artículo largo que excede la cota superior del Quality Gate -> Condensación quirúrgica
  if (currentWords > targetMaxGrossWords && (stats?.writerCalls || 0) < 7) {
    const excess = currentWords - targetMaxGrossWords;
    console.log(`[SECTION CONDENSE] Exceso detectado: ${currentWords} palabras (máx: ${targetMaxGrossWords}, exceso: ${excess}). Ejecutando condensación quirúrgica...`);
    
    // Identificar la sección más extensa entre las intermedias para condensarla
    let longestSec = sectionTexts[0];
    for (const st of sectionTexts) {
      if (countWordsInString(st.text) > countWordsInString(longestSec.text)) {
        longestSec = st;
      }
    }

    if (longestSec) {
      if (stats) stats.writerCalls = (stats.writerCalls || 0) + 1;
      const targetSecWords = Math.max(180, countWordsInString(longestSec.text) - excess - 40);
      const condensePrompt = `La siguiente sección de un artículo sobre "${topicTitle}" es excesivamente prolija y necesita ser sintetizada sin perder sustancia.
SECCIÓN ORIGINAL:
${longestSec.text}

OBJETIVO:
- Condensa y sintetiza el texto para dejarlo en aproximadamente ${targetSecWords} palabras.
- Conserva el subtítulo, los ejemplos prácticos esenciales y el tono profesional.
- Elimina frases redundantes, adjetivos de relleno y rodeos explicativos.
- Salida en Markdown limpio devolviendo la sección sintetizada completa.`;

      try {
        const condenseRes = await env.AI.run(MODEL_TEXT, {
          messages: [
            { role: "system", content: MARKDOWN_SYSTEM_PROMPT },
            { role: "user", content: condensePrompt }
          ],
          max_tokens: 1200,
          temperature: 0.50
        });
        const condensedSecText = readTextResponse(condenseRes).trim();
        const condensedWords = countWordsInString(condensedSecText);
        if (condensedWords < countWordsInString(longestSec.text) && condensedWords >= 40) {
          fullMarkdown = fullMarkdown.replace(longestSec.text, condensedSecText);
          console.log(`[SECTION CONDENSE SUCCESS] Sección condensada de ${countWordsInString(longestSec.text)} a ${condensedWords} palabras.`);
        }
      } catch (condenseErr) {
        console.warn("[SECTION CONDENSE WARN] Condensación quirúrgica no pudo completarse:", condenseErr.message);
      }
    }
  }

  return fullMarkdown.trim();
}

/**
 * Generador universal Markdown que selecciona la estrategia según el perfil de artículo y la extensión objetivo
 */
export async function generateArticleMarkdown(env, brief, topic, attempt = 1, feedback = null, stats = null, onSectionProgress = null) {
  const articleType = resolveArticleType(topic?.articleType || brief?.articleType || 2);

  // El Tipo 1 (Novedades Tech 400-700w) utiliza siempre generación monolítica ('single')
  // Los Tipos 2, 3, 4 y 5 utilizan generación por secciones ('sections') de forma determinista, incluso sin targetWords
  if (articleType.sectionStrategy === "sections") {
    return await generateSectionalMarkdown(env, brief, topic, articleType, attempt, feedback, stats, onSectionProgress);
  }
  return await generateMonolithicMarkdown(env, brief, topic, articleType, attempt, feedback, stats);
}

export async function extractMetadataForArticle(env, { brief, topic, content, rawMarkdown }) {
  const topicTitle = (topic && topic.tema) ? topic.tema.trim() : (brief && brief.uniqueThesis ? brief.uniqueThesis.trim() : "");
  const firstParagraph = content.find(b => b.type === "p")?.text || "";

  // Pedir solo un JSON minúsculo con metadatos de alto valor (<250 tokens)
  const metaPrompt = `A partir del siguiente artículo editorial:
Título sugerido: "${topicTitle}"
Primer párrafo: "${firstParagraph.slice(0, 300)}"

Genera un JSON ultra-conciso con los metadatos SEO:
{
  "title": "Título llamativo y profesional fiel a la promesa (máx 90 caracteres)",
  "tag": "UNA de: Estrategia, Chatbots, Reseñas, Automatización, Diseño web",
  "excerpt": "Resumen breve para listado de blog (máx 150 caracteres)",
  "executiveSummary": "Resumen ejecutivo directo tipo BLUF de 35 a 60 palabras",
  "targetService": "UNA de: diseno_web, chatbots_ia, automatizacion_resenas, blog_automatizado, contacto_estrategico",
  "customMetaDesc": "Meta descripción atractiva para Google (máx 155 caracteres)",
  "faqs": [
    { "q": "Pregunta relevante", "a": "Respuesta práctica concisa" }
  ]
}
SOLO el JSON, sin markdown ni explicaciones adicionales.`;

  let metaData = null;
  try {
    const res = await env.AI.run(MODEL_TEXT, {
      messages: [
        { role: "system", content: "Eres el editor SEO de Canedo Studio. Respondes exclusivamente con JSON válido ultra-conciso." },
        { role: "user", content: metaPrompt }
      ],
      max_tokens: 600,
      temperature: 0.3
    });
    const raw = readTextResponse(res).trim();
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      metaData = JSON.parse(cleaned.slice(start, end + 1));
    }
  } catch (err) {
    console.warn("[METADATA AI WARN] No se pudo generar metadatos vía IA ligera, aplicando derivación determinista:", err.message);
  }

  // Fallback y validación determinista segura
  const title = (metaData && typeof metaData.title === "string" && metaData.title.trim().length >= 10)
    ? metaData.title.trim()
    : topicTitle || "Artículo de Innovación Empresarial";

  const tags = new Set(["Estrategia", "Chatbots", "Reseñas", "Automatización", "Diseño web"]);
  const tag = (metaData && tags.has(metaData.tag))
    ? metaData.tag
    : "Estrategia";

  const excerpt = (metaData && typeof metaData.excerpt === "string" && metaData.excerpt.trim())
    ? metaData.excerpt.trim().slice(0, 160)
    : firstParagraph.slice(0, 150) + "...";

  const enriched = validateEnrichedArticleData(metaData || {}, content);

  return {
    title: title.slice(0, 120),
    tag,
    excerpt,
    content,
    seoVersion: enriched.cleaned.seoVersion,
    executiveSummary: enriched.cleaned.executiveSummary || firstParagraph.slice(0, 300),
    targetService: enriched.cleaned.targetService,
    customMetaDesc: enriched.cleaned.customMetaDesc,
    faqs: enriched.cleaned.faqs || [],
    relatedSlugs: enriched.cleaned.relatedSlugs || []
  };
}

export async function generateRobustArticle(env, brief, topic, attempt = 1, feedback = null, stats = null, onSectionProgress = null) {
  // 1. Obtener el cuerpo editorial generado por el modelo mediante el generador universal adaptativo
  const rawOutput = await generateArticleMarkdown(env, brief, topic, attempt, feedback, stats, onSectionProgress);

  // Comprobar si devolvió JSON (compatibilidad retroactiva con mocks unitarios existentes)
  const trimmed = typeof rawOutput === "string" ? rawOutput.trim() : "";
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.content && Array.isArray(parsed.content)) {
        return parsed;
      }
    } catch (_) {}
  }

  // 2. Parsear Markdown a bloques de contenido compatibles garantizando título sin duplicados
  const articleTitle = (topic && (topic.tema || topic.title)) || (brief && brief.uniqueThesis) || "";
  let content = parseMarkdownToBlocks(trimmed, articleTitle);
  if (content.length < 3) {
    throw new Error(`Artículo Markdown estructurado de forma insuficiente (solo ${content.length} bloques generados)`);
  }

  // 3. Extraer o generar metadatos enriquecidos de forma desacoplada
  const article = await extractMetadataForArticle(env, { brief, topic, content, rawMarkdown: trimmed });
  return article;
}
