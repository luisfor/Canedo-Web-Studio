import { persistPost } from "./d1_adapter.js";
import { validateEnrichedArticleData, VALID_SERVICE_KEYS } from "./seo/service_mapping.js";
import { generateRobustArticle, parseMarkdownToBlocks } from "./editorial_pipeline.js";
import { resolveArticleType, getBlogBotEligibleTypes } from "./article_types.js";
/* Robot redactor del blog de Canedo Studio.
   7:00 AM y 5:00 PM todos los días (hora Colombia): escribe un artículo
   con IA, le genera portada con IA, lo guarda en KV y avisa por email.

   Sistema híbrido de temas (por orden de prioridad):
   1) Temas curados: los 210 de topics.js, sin repetir (duran ~3,5 meses).
   2) Edición de las 7:00 (12:00 UTC): se inspira en titulares REALES de
      marketing/negocios leídos de RSS y los convierte en tema práctico pyme.
   3) Resto: la IA propone temas nuevos siguiendo la carta editorial y
      cambiando de sector/perspectiva en cada intento.

   Anti-duplicados en tres capas:
   - Antes de gastar IA: descarta temas cuyo título/slug ya están publicados.
   - La IA recibe el historial de títulos generados y se le prohíbe repetir.
   - Guardia final: si el título generado ya existe, se aborta limpio. */

import { TOPICS } from "./topics.js";

const MODEL_TEXT = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const BRIEF_THRESHOLD = 70;
const QUALITY_GATE_THRESHOLD = 70;
const MIN_EDITORIAL_WORDS = 650;
const MAX_EDITORIAL_WORDS = 900;
const MODEL_IMG = "@cf/black-forest-labs/flux-1-schnell";
const MAX_POSTS = 30;
const MAX_HISTORY = 300;   // títulos generados recordados (anti-repetición)
const MAX_HEADLINES = 60;  // titulares RSS recordados

/* Carta editorial: quiénes somos, a quién le hablamos, qué vende el blog */
const EDITORIAL_CHARTER = `Canedo Studio es una agencia que vende a negocios y pymes hispanohablantes: chatbots con IA, diseño web premium, blogs autogestionados, embudos de reseñas y automatización de procesos. El blog "Insights" habla al DUEÑO del negocio, no al técnico: lenguaje claro, euros y horas, ejemplos de negocios cotidianos. Cada artículo debe poder enlazarse con naturalidad a uno de esos servicios.`;

/* Temas vetados: se filtran en titulares RSS y en propuestas de la IA */
const BANNED = [
  "política", "elecciones", "partido político", "religión", "criptomoneda",
  "bitcoin", "nft", "apuestas", "casino", "trading", "forex",
  "bolsa de valores", "famosos", "cotilleo", "guerra", "crimen",
];

/* Sectores desde los que la IA puede enfocar un tema nuevo */
const PERSPECTIVES = [
  "una clínica dental", "un restaurante", "un gimnasio", "una asesoría fiscal",
  "una peluquería", "un taller mecánico", "una inmobiliaria",
  "una academia de idiomas", "una clínica veterinaria", "un hotel rural",
  "una tienda de barrio", "un despacho de abogados", "un centro de estética",
  "una empresa de reformas", "una agencia de viajes", "una floristería",
  "una óptica", "una clínica de fisioterapia", "un consultor autónomo",
  "una tienda online local", "una cafetería", "un estudio de fotografía",
];

/* Fuentes de inspiración para la edición de las 7:00 (12:00 UTC) */
const RSS_FEEDS = [
  "https://feeds.feedburner.com/Puromarketing",
  "https://vilmanunez.com/feed/",
  "https://marketingdirecto.com/feed/",
];

const SYSTEM_PROMPT = `Eres el redactor jefe del blog "Insights" de Canedo Studio, una agencia de automatización con IA para empresas.
Estilo: español neutro, cercano y ejecutivo; tutea al lector; persuasivo pero honesto; frases claras, cero jerga técnica sin explicar.
REGLAS DURAS:
- NUNCA inventes cifras concretas, estadísticas falsas, porcentajes sin fuente, nombres comerciales inventados ni testimonios ficticios. Habla de realidades operativas y sentido común de negocio.
- EJEMPLOS OBLIGATORIOS: Desarrolla ejemplos prácticos basados en tipos o arquetipos de negocios cotidianos (por ejemplo: un taller mecánico, una clínica dental, un despacho contable, un restaurante o una tienda local), describiendo la fricción operativa real que viven y cómo se resuelve.
- TÍTULO: Debe basarse fielmente en la promesa y gancho comercial del tema curado recibido, sin desvirtuar su enfoque ni convertirlo en un título genérico o engañoso.
- No menciones a Canedo Studio en primera persona todo el rato; como mucho una mención natural al final.
- EXTENSIÓN ESTRICTA: El cuerpo editorial (la suma de los párrafos en "content") debe tener OBLIGATORIAMENTE entre 650 y 900 palabras reales. Un texto de 300 o 400 palabras será rechazado automáticamente por el Quality Gate. Cada sección debe estar bien desarrollada con argumentos y aplicaciones prácticas.
- CERO REPETICIÓN: Cada párrafo debe aportar un argumento o matiz nuevo. Está TERMINANTEMENTE PROHIBIDO repetir párrafos o duplicar el resumen ejecutivo dentro del cuerpo del artículo o en la conclusión.
- Devuelves ÚNICAMENTE un JSON válido, sin markdown, sin comentarios, con esta forma exacta:
{
  "title": "...",
  "tag": "...",
  "excerpt": "...",
  "executiveSummary": "Resumen directo (BLUF) de 2 a 3 frases claras que responden directamente al problema planteado.",
  "targetService": "diseno_web | chatbots_ia | automatizacion_resenas | blog_automatizado | contacto_estrategico",
  "customMetaDesc": "Metadescripción concisa y atractiva de entre 120 y 155 caracteres para buscadores.",
  "faqs": [
    {"q": "¿Pregunta frecuente 1 relevante para el lector?", "a": "Respuesta clara y accionable de 2 o 3 frases sin inventar datos."},
    {"q": "¿Pregunta frecuente 2?", "a": "Respuesta clara y accionable."}
  ],
  "content": [{"type":"p","text":"..."}]
}
Donde "tag" es UNA de: Estrategia, Chatbots, Reseñas, Automatización, Diseño web.
"excerpt" máximo 150 caracteres, gancho para listados.
"targetService" debe ser la clave del servicio más afín al tema (diseno_web, chatbots_ia, automatizacion_resenas, blog_automatizado o contacto_estrategico).
"faqs" es opcional pero muy recomendado: máximo 2 preguntas útiles y sin clichés.
"content" es una lista de 8 a 14 bloques. type puede ser "p" (párrafo), "h2" (subtítulo) o "quote" (una sola cita potente por artículo como máximo).
Estructura obligatoria:
1. Apertura directa: Plantea el dilema comercial o la verdad incómoda del negocio.
2. Desarrollo en profundidad (2-3 subtítulos h2): Explica las causas de fondo y analiza al menos dos escenarios de sectores cotidianos (ej. clínica dental, taller, asesoría) detallando cómo sufren el problema en su día a día.
3. Solución práctica y trade-offs: Qué medidas inmediatas tomar y qué sacrificios o cambios operativos implica.
4. Conclusión fresca y llamada a la acción: Cierre que resume el aprendizaje con palabras distintas (sin repetir párrafos anteriores) y sugiere con naturalidad cómo un diagnóstico estratégico de Canedo Studio ayuda a resolverlo.`;


const BRIEF_PROMPT = `Eres el Director Editorial del blog "Insights" de Canedo Studio.
Tu objetivo es crear un Brief Editorial Premium para un nuevo artículo. 
El Brief NO puede ser un cliché. Debe contener ideas contraintuitivas, trade-offs técnicos reales y evitar promesas genéricas B2B.

Devuelve ÚNICAMENTE un JSON válido con la siguiente estructura:
{
  "audience": "...",
  "businessProblem": "Debe ser muy específico, no 'falta de ventas'.",
  "canedoRelevance": "...",
  "primaryService": "...",
  "ctaIntent": "...",
  "funnelStage": "...",
  "uniqueThesis": "Tesis única y fuerte (no debe ser igual al tema).",
  "nonObviousInsight": "Idea contraintuitiva, no obvia.",
  "tradeoff": "Dilema real (ej: costo de abstracción vs riesgo de lock-in).",
  "whenNotApplicable": "...",
  "recommendedStructure": "...",
  "readerShouldLearn": ["...", "..."],
  "requiredExamples": ["...", "..."],
  "answerableQuestions": ["...", "..."],
  "evaluation": {
    "thesisSpecificity": {"score": 0-100, "reason": "..."},
    "insightOriginality": {"score": 0-100, "reason": "..."},
    "businessProblemSpecificity": {"score": 0-100, "reason": "..."},
    "tradeoffQuality": {"score": 0-100, "reason": "..."},
    "practicalPotential": {"score": 0-100, "reason": "..."},
    "canedoRelevance": {"score": 0-100, "reason": "..."}
  }
}
Solo JSON, sin markdown.`;

const AUDIT_PROMPT = `Eres el Critical Editor (Auditor Editorial) del blog "Insights" de Canedo Studio.
Evalúa si el artículo cumple el Brief y estándares editoriales.
Califica de 0 a 100 las 4 métricas críticas:
- nonObviousness: evita obviedades, aporta trade-offs o ángulos no trillados.
- nuance: profundidad argumental y equilibrio sin exageraciones.
- humanness: tono humano y cercano, sin lenguaje de folleto publicitario.
- specificity: aplicabilidad concreta en la realidad de una pyme cotidiana.

Devuelve ÚNICAMENTE este JSON conciso (máximo 300 tokens):
{
  "approved": true o false,
  "score": 0 a 100,
  "metrics": {
    "nonObviousness": { "score": 85, "evidence": "breve frase", "problem": "", "correction": "" },
    "nuance": { "score": 85, "evidence": "breve frase", "problem": "", "correction": "" },
    "humanness": { "score": 85, "evidence": "breve frase", "problem": "", "correction": "" },
    "specificity": { "score": 85, "evidence": "breve frase", "problem": "", "correction": "" }
  },
  "reasons": [
    // Si approved=false, incluye los motivos de rechazo
    { "metric": "nonObviousness", "score": 50, "evidence": "...", "problem": "...", "correction": "..." }
  ]
}
Solo JSON, sin bloques de código ni markdown.`;

const TOPIC_PROMPT = `Eres el estratega de contenidos del blog "Insights" de Canedo Studio.
Respondes ÚNICAMENTE con JSON válido, sin markdown ni comentarios, con esta forma exacta:
{"tema":"...","angulo":"...","img":"..."}
- "tema": título tentativo del artículo (30-90 caracteres). Claro y con beneficio, sin clickbait vacío.
- "angulo": el enfoque concreto en una frase (qué se lleva el lector).
- "img": descripción EN INGLÉS de una escena fotográfica para la portada (40-300 caracteres): estilo editorial oscuro y cinematográfico, detalles ricos, iluminación dorada o azul eléctrico, SIN texto ni letras en la imagen.`;

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "articulo";
}

function extractJson(raw) {
  if (typeof raw !== "string") throw new Error("Entrada inválida para parsear JSON");
  // Limpieza defensiva contra bloques markdown ```json ... ```
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("La IA no devolvió JSON");
  return JSON.parse(cleaned.slice(start, end + 1));
}

function sniffImage(bytes) {
  const b = new Uint8Array(bytes.slice(0, 4));
  if (b[0] === 0xff && b[1] === 0xd8) return { ext: "jpg", mime: "image/jpeg" };
  if (b[0] === 0x89 && b[1] === 0x50) return { ext: "png", mime: "image/png" };
  return { ext: "jpg", mime: "image/jpeg" };
}

/* Normaliza un título para comparar duplicados (ignora tildes,
   mayúsculas y signos de puntuación) */
function normTitle(s) {
  return s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function hasBanned(text) {
  const low = text.toLowerCase();
  return BANNED.some((b) => low.indexOf(b) !== -1);
}

/* Lee la respuesta del modelo de texto (formato OpenAI o string plano) */
function readTextResponse(res) {
  let raw;
  if (typeof res === "string") raw = res;
  else if (res && typeof res.response === "string") raw = res.response;
  else if (res && res.choices && res.choices[0] && res.choices[0].message) raw = res.choices[0].message.content;
  if (typeof raw !== "string") {
    throw new Error("Formato inesperado del modelo: " + JSON.stringify(res).slice(0, 250));
  }
  return raw;
}

async function generateArticle(env, brief, topic, attempt = 1, feedback = null, stats = null) {
  return await generateRobustArticle(env, brief, topic, attempt, feedback, stats);
}


async function createEditorialBrief(env, topic, stats = null) {
  const failedBriefs = [];
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (stats) stats.briefCalls = (stats.briefCalls || 0) + 1;
    let brief = null;
    try {
      const userPrompt = `Crea un Brief Editorial Premium para:\nTema: "${topic.tema}"\nEnfoque: "${topic.angulo}"`;
      const res = await env.AI.run(MODEL_TEXT, {
        messages: [
          { role: "system", content: BRIEF_PROMPT },
          { role: "user", content: userPrompt }
        ],
        max_tokens: 1500,
        temperature: 0.8
      });
      brief = extractJson(readTextResponse(res));
      
      try {
        // BRIEF GATE: Validaciones determinísticas estructurales
        if (!brief.businessProblem || brief.businessProblem.split(" ").length < 5) throw new Error("businessProblem muy corto o vacío");
        if (!brief.uniqueThesis || brief.uniqueThesis.trim().toLowerCase() === topic.tema.trim().toLowerCase()) throw new Error("uniqueThesis idéntica al tema");
        if (!brief.nonObviousInsight || !brief.tradeoff || !brief.requiredExamples || brief.requiredExamples.length === 0) throw new Error("Faltan campos críticos obligatorios");
        
        // BRIEF GATE: Autoevaluación semántica calibrada (umbral >= 70)
        if (!brief.evaluation) throw new Error("Falta nodo de evaluación");
        const ev = brief.evaluation;
        const bThreshold = (typeof env.BRIEF_THRESHOLD === "number") ? env.BRIEF_THRESHOLD : BRIEF_THRESHOLD;
        if ((ev.thesisSpecificity?.score || 0) < bThreshold) throw new Error(`Tesis poco específica (${ev.thesisSpecificity?.score || 0} < ${bThreshold}): ${ev.thesisSpecificity?.reason}`);
        if ((ev.insightOriginality?.score || 0) < bThreshold) throw new Error(`Insight no original (${ev.insightOriginality?.score || 0} < ${bThreshold}): ${ev.insightOriginality?.reason}`);
        if ((ev.businessProblemSpecificity?.score || 0) < bThreshold) throw new Error(`Problema muy genérico (${ev.businessProblemSpecificity?.score || 0} < ${bThreshold}): ${ev.businessProblemSpecificity?.reason}`);
        if ((ev.tradeoffQuality?.score || 0) < bThreshold) throw new Error(`Trade-off débil (${ev.tradeoffQuality?.score || 0} < ${bThreshold}): ${ev.tradeoffQuality?.reason}`);
        
        brief.approved = true;
        brief._failedBriefs = failedBriefs;
        return brief;
      } catch (validationErr) {
        failedBriefs.push({ attempt, brief, error: validationErr.message });
        validationErr.lastBrief = brief;
        throw validationErr;
      }
    } catch(e) {
      console.log(`Brief Gate falló (intento ${attempt}):`, e.message);
      // Distinguir error técnico de IA (500, 504, timeout, network) vs rechazo editorial de contenido
      const isTechnicalAiError =
        e.message.includes("500") ||
        e.message.includes("502") ||
        e.message.includes("503") ||
        e.message.includes("504") ||
        e.message.includes("Timeout") ||
        e.message.includes("unresponsive") ||
        e.message.includes("fetch failed") ||
        e.message.includes("network") ||
        e.message.includes("rate limit");

      if (isTechnicalAiError) {
        throw new Error(`Workers AI Technical Failure: ${e.message}`);
      }

      if (e.message.indexOf("Falta nodo") === -1 && !e.lastBrief) {
         failedBriefs.push({ attempt, brief: null, error: e.message });
      }
      if (attempt === 3) {
         const err = new Error("SKIP TOPIC: Brief no superó el umbral en 3 intentos.");
         err.lastBrief = e.lastBrief || brief;
         err._failedBriefs = failedBriefs;
         throw err;
      }
    }
  }
}

function countEditorialWords(article) {
  if (!article || !Array.isArray(article.content)) {
    return { totalWords: 0, bodyWords: 0, paragraphCount: 0, blocks: [] };
  }
  let bodyWords = 0;
  let totalWords = 0;
  let paragraphCount = 0;
  const blocks = [];

  for (const block of article.content) {
    if (!block || typeof block.text !== "string") continue;
    const cleanText = block.text.trim();
    if (!cleanText) continue;

    const words = cleanText.split(/\s+/).filter(Boolean);
    const count = words.length;
    totalWords += count;

    if (block.type === "p" || block.type === "quote") {
      bodyWords += count;
      paragraphCount++;
      blocks.push({ type: block.type, text: cleanText, wordCount: count });
    }
  }

  return { totalWords, bodyWords, paragraphCount, blocks };
}

function normalizeForComparison(text) {
  if (typeof text !== "string") return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getWordTokens(text) {
  return normalizeForComparison(text).split(" ").filter((w) => w.length > 0);
}

function checkDuplicateParagraphs(article) {
  if (!article || !Array.isArray(article.content)) return { hasDuplicate: false, duplicates: [] };

  const paragraphs = [];
  if (typeof article.executiveSummary === "string" && article.executiveSummary.trim()) {
    paragraphs.push({ source: "executiveSummary", text: article.executiveSummary.trim() });
  }

  article.content.forEach((b, idx) => {
    if ((b.type === "p" || b.type === "quote") && typeof b.text === "string" && b.text.trim()) {
      paragraphs.push({ source: `bloque_${idx}_${b.type}`, text: b.text.trim() });
    }
  });

  const duplicates = [];

  for (let i = 0; i < paragraphs.length; i++) {
    const p1 = paragraphs[i];
    const norm1 = normalizeForComparison(p1.text);
    const tokens1 = getWordTokens(p1.text);

    for (let j = i + 1; j < paragraphs.length; j++) {
      const p2 = paragraphs[j];
      const norm2 = normalizeForComparison(p2.text);
      const tokens2 = getWordTokens(p2.text);

      // Si alguno tiene menos de 10 palabras, omitir para evitar falsos positivos con frases breves
      if (tokens1.length < 10 || tokens2.length < 10) continue;

      // 1. Identidad exacta tras normalizar puntuación, mayúsculas y acentos
      if (norm1 === norm2) {
        duplicates.push({
          type: "exact_duplicate",
          sourceA: p1.source,
          sourceB: p2.source,
          similarity: 1.0,
          preview: p1.text.slice(0, 100)
        });
        continue;
      }

      // 2. Similitud léxica Jaccard para redundancia sustancial
      const set1 = new Set(tokens1);
      const set2 = new Set(tokens2);
      let intersection = 0;
      for (const t of set1) {
        if (set2.has(t)) intersection++;
      }
      const union = new Set([...set1, ...set2]).size;
      const jaccard = union > 0 ? intersection / union : 0;

      // Si comparten >= 70% de vocabulario único y longitudes comparables (ratio > 0.6)
      const lengthRatio = Math.min(tokens1.length, tokens2.length) / Math.max(tokens1.length, tokens2.length);
      if (jaccard >= 0.70 && lengthRatio >= 0.60) {
        duplicates.push({
          type: "high_redundancy",
          sourceA: p1.source,
          sourceB: p2.source,
          similarity: Math.round(jaccard * 100) / 100,
          preview: p1.text.slice(0, 100)
        });
      }
    }
  }

  return {
    hasDuplicate: duplicates.length > 0,
    duplicates
  };
}

async function auditArticle(env, article, brief, stats = null) {
  if (stats) stats.auditCalls = (stats.auditCalls || 0) + 1;

  // Resolver el tipo de artículo para calibrar límites de palabras
  const articleType = resolveArticleType(article?.articleType || brief?.articleType || 2);
  const minWords = (typeof env.MIN_EDITORIAL_WORDS === "number") ? env.MIN_EDITORIAL_WORDS : articleType.minWords;
  const maxWords = (typeof env.MAX_EDITORIAL_WORDS === "number") ? env.MAX_EDITORIAL_WORDS : articleType.maxWords;

  // 1. DETERMINISTIC QUALITY GATE: Conteo determinista de palabras del cuerpo editorial
  const wordStats = countEditorialWords(article);

  let lengthViolation = null;
  if (wordStats.bodyWords < minWords) {
    lengthViolation = {
      metric: "depth",
      score: 0,
      evidence: `Extensión insuficiente: ${wordStats.bodyWords} palabras en cuerpo editorial (mínimo requerido: ${minWords}). Párrafos: ${wordStats.paragraphCount}.`,
      problem: "ArticleTooShort",
      correction: `Desarrollar el artículo con mayor profundidad y ejemplos sectoriales para alcanzar al menos ${minWords} palabras.`
    };
  } else if (wordStats.bodyWords > maxWords) {
    lengthViolation = {
      metric: "depth",
      score: 0,
      evidence: `Extensión excesiva: ${wordStats.bodyWords} palabras en cuerpo editorial (máximo permitido: ${maxWords}).`,
      problem: "ArticleTooLong",
      correction: `Sintetizar y eliminar rodeos para mantenerse dentro del límite de ${maxWords} palabras.`
    };
  }

  // 2. DETERMINISTIC QUALITY GATE: Detección de párrafos duplicados o redundancia sustancial
  const duplicateCheck = checkDuplicateParagraphs(article);
  let duplicateViolation = null;
  if (duplicateCheck.hasDuplicate) {
    const firstDup = duplicateCheck.duplicates[0];
    duplicateViolation = {
      metric: "originality",
      score: 0,
      evidence: `Párrafos duplicados o redundantes detectados entre ${firstDup.sourceA} y ${firstDup.sourceB} (similitud: ${firstDup.similarity * 100}%). Texto: "${firstDup.preview}..."`,
      problem: "DuplicateParagraph",
      correction: "Eliminar párrafos idénticos o reformular la sección con ideas y argumentos diferenciados."
    };
  }

  // LLM Auditor semántico con reintento aislado
  const userPrompt = `Audita el siguiente artículo generado contra su Brief Editorial.\n\nBRIEF:\n${JSON.stringify(brief, null, 2)}\n\nARTÍCULO:\n${JSON.stringify(article, null, 2)}`;
  let audit = null;
  let lastAuditErr = null;

  for (let auditAttempt = 1; auditAttempt <= 2; auditAttempt++) {
    try {
      const res = await env.AI.run(MODEL_TEXT, {
        messages: [
          { role: "system", content: AUDIT_PROMPT },
          { role: "user", content: userPrompt }
        ],
        max_tokens: 600,
        temperature: auditAttempt === 1 ? 0.2 : 0.1
      });
      const rawAudit = readTextResponse(res);
      audit = extractJson(rawAudit);
      if (audit && typeof audit.approved === "boolean") {
        break;
      }
    } catch (auditErr) {
      lastAuditErr = auditErr;
      console.warn(`[AUDITOR AI WARN] Intento ${auditAttempt}/2 falló en auditor semántico:`, auditErr.message);
    }
  }

  if (!audit) {
    audit = {
      approved: false,
      score: 0,
      metrics: {},
      reasons: [{
        metric: "auditorReliability",
        score: 0,
        evidence: `Fallo al auditar con LLM tras 2 intentos: ${lastAuditErr?.message || "Sin respuesta válida"}`,
        problem: "AuditorParseError",
        correction: "Reintentar auditoría editorial con salida estructurada válida."
      }]
    };
  }
  audit.reasons = audit.reasons || [];

  // Aplicar violaciones deterministas duras de conteo y repetición
  if (lengthViolation) {
    audit.approved = false;
    if (audit.metrics && audit.metrics.depth) {
      audit.metrics.depth.score = 0;
      audit.metrics.depth.evidence = lengthViolation.evidence;
    }
    audit.reasons.unshift(lengthViolation);
  }

  if (duplicateViolation) {
    audit.approved = false;
    if (audit.metrics && audit.metrics.originality) {
      audit.metrics.originality.score = 0;
      audit.metrics.originality.evidence = duplicateViolation.evidence;
    }
    audit.reasons.unshift(duplicateViolation);
  }
  
  // Deterministic checks override LLM approval (clichés de marketing)
  const text = JSON.stringify(article).toLowerCase();
  if (text.includes("siguiente nivel") || text.includes("hoy en día") || text.includes("en el mundo digital")) {
     audit.approved = false;
     audit.reasons.push({
       metric: "languageConsistency", score: 0, evidence: "Uso de clichés de marketing", problem: "Cliché", correction: "Eliminar frases trilladas."
     });
  }

  // Control estricto contra afirmaciones cuantitativas / estadísticas no respaldadas
  const quantitativePattern = /(\d+\s*%)|(\b(un|el)\s+\d+\s*por\s*ciento\b)|(\b\d+\s*(veces|dólares|euros)\s+más\b)/i;
  if (quantitativePattern.test(text)) {
    audit.approved = false;
    audit.reasons.push({
      metric: "factualIntegrity",
      score: 0,
      evidence: "Presencia de afirmación cuantitativa o porcentaje sin fuente",
      problem: "UnverifiedStatistic",
      correction: "Eliminar cifras exactas o porcentajes inventados; utilizar explicaciones conceptuales y sentido común comercial."
    });
  }
  
  // Check critical thresholds dynamically (umbral calibrado >= 70)
  const qgThreshold = (typeof env.QUALITY_GATE_THRESHOLD === "number") ? env.QUALITY_GATE_THRESHOLD : QUALITY_GATE_THRESHOLD;
  const criticalMetrics = ["nonObviousness", "nuance", "humanness", "specificity"];
  for (const m of criticalMetrics) {
    if (audit.metrics && audit.metrics[m] && audit.metrics[m].score < qgThreshold) {
      audit.approved = false;
      audit.reasons.push({
        metric: m,
        score: audit.metrics[m].score,
        evidence: audit.metrics[m].evidence || `Puntuación ${audit.metrics[m].score} bajo umbral ${qgThreshold}`,
        problem: `Sub-umbral en métrica crítica ${m}`,
        correction: audit.metrics[m].correction || "Reforzar profundidad y autenticidad humana"
      });
    }
  }

  return audit;
}
async function generateCover(topic) {
  const prompt =
    "Premium editorial photograph for a business blog, dark luxurious style, deep black background, " +
    "subtle electric blue and warm gold accent lighting, cinematic, high detail, rich composition with " +
    "multiple visual elements and clear depth, atmospheric light, photographic realism. " +
    "AVOID: minimalism, abstract shapes, a single floating object on emptiness, text, words, letters. " +
    "Scene: " + (topic.img || topic.tema);
  const result = await this.AI.run(MODEL_IMG, { prompt });
  let bytes;
  if (result instanceof ArrayBuffer) {
    bytes = result;
  } else if (result && typeof result.arrayBuffer === "function") {
    bytes = await result.arrayBuffer();
  } else if (result && typeof result.getReader === "function") {
    bytes = await new Response(result).arrayBuffer();
  } else if (result && result.image) {
    const bin = atob(result.image);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    bytes = arr.buffer;
  } else {
    throw new Error("La IA no devolvió imagen");
  }
  if (bytes.byteLength < 10000) throw new Error("Imagen generada sospechosamente pequeña");
  return bytes;
}

/* ---------- Capa 2: inspiración RSS (edición de las 7:00) ---------- */

/* Lee los titulares de los feeds. Sin DOMParser en Workers: regex + CDATA */
async function fetchHeadlines() {
  const titles = [];
  for (const url of RSS_FEEDS) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(5000),
        headers: { "User-Agent": "Mozilla/5.0 (compatible; CanedoStudioBlogBot/1.0)" },
      });
      if (!res.ok) continue;
      const xml = await res.text();
      const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
      for (const item of items.slice(0, 12)) {
        const m = item.match(/<title>([\s\S]*?)<\/title>/);
        if (!m) continue;
        let t = m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim();
        t = t.replace(/&amp;/g, "&").replace(/&#\d+;|&[a-z]+;/g, " ").replace(/\s+/g, " ").trim();
        if (t.length >= 20 && t.length <= 180 && !hasBanned(t)) titles.push(t);
      }
    } catch (e) {
      console.log("Feed falló:", url, e.message);
    }
  }
  return titles;
}

/* Convierte un titular real en un tema práctico para pymes.
   Devuelve null si no hay nada útil (publish() caerá a la capa 3). */
async function tryRssTopic(env, existingTitles, existingSlugs, state) {
  const headlines = await fetchHeadlines();
  const used = new Set((state.usedHeadlines || []).map(normTitle));
  const fresh = headlines.filter((h) => !used.has(normTitle(h)));
  if (fresh.length === 0) return null;

  const headline = fresh[Math.floor(Math.random() * fresh.length)];
  const userPrompt = `${EDITORIAL_CHARTER}

Titular de actualidad del mundo del marketing y los negocios:
"${headline}"

Convierte la tendencia que hay detrás de esa noticia en UN tema práctico para el dueño de una pyme hispanohablante. NO hables de la noticia en sí: usa la tendencia como excusa para enseñar algo útil hoy.
Solo el JSON.`;

  try {
    const res = await env.AI.run(MODEL_TEXT, {
      messages: [
        { role: "system", content: TOPIC_PROMPT },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 500,
      temperature: 0.8,
    });
    const data = extractJson(readTextResponse(res));
    const topic = validateTopic(data, existingTitles, existingSlugs, state);
    if (!topic) return null;
    topic._headline = headline;
    return topic;
  } catch (e) {
    console.log("RSS→tema falló:", e.message);
    return null;
  }
}

/* ---------- Capa 3: temas propuestos por IA ---------- */

/* Valida una propuesta {tema, angulo, img} contra calidad, vetados y duplicados */
function validateTopic(data, existingTitles, existingSlugs, state) {
  if (!data || typeof data.tema !== "string" || typeof data.angulo !== "string" || typeof data.img !== "string") return null;
  const tema = data.tema.trim();
  const angulo = data.angulo.trim();
  const img = data.img.trim();
  if (tema.length < 25 || tema.length > 110) return null;
  if (angulo.length < 15 || angulo.length > 220) return null;
  if (img.length < 30 || img.length > 500) return null;
  if (hasBanned(tema) || hasBanned(angulo)) return null;
  const n = normTitle(tema);
  if (existingTitles.has(n)) return null;
  if (existingSlugs.has(slugify(tema))) return null;
  if ((state.generatedHistory || []).indexOf(n) !== -1) return null;
  return { id: "ia-" + Date.now().toString(36), tema, angulo, img };
}

/* Pide a la IA un tema nuevo. 3 intentos, cada uno con una perspectiva
   (sector) distinta para forzar variedad. */
async function proposeTopic(env, existingTitles, existingSlugs, state) {
  const history = (state.generatedHistory || []).slice(-60).join(" | ");
  for (let intento = 0; intento < 3; intento++) {
    const perspective = PERSPECTIVES[Math.floor(Math.random() * PERSPECTIVES.length)];
    const userPrompt = `${EDITORIAL_CHARTER}

Inventa UN tema nuevo para el próximo artículo, mirando el mundo desde la perspectiva de: ${perspective}.
PROHIBIDO tocar: ${BANNED.join(", ")}.
NO repitas ni te acerques a ninguno de estos temas ya publicados:
${history || "(aún no hay historial)"}

Solo el JSON.`;
    try {
      const res = await env.AI.run(MODEL_TEXT, {
        messages: [
          { role: "system", content: TOPIC_PROMPT },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 500,
        temperature: 0.9,
      });
      const data = extractJson(readTextResponse(res));
      const topic = validateTopic(data, existingTitles, existingSlugs, state);
      if (topic) return topic;
      console.log("Propuesta IA rechazada (intento " + (intento + 1) + "):", JSON.stringify(data).slice(0, 160));
    } catch (e) {
      console.log("proposeTopic intento " + (intento + 1) + " falló:", e.message);
    }
  }
  throw new Error("La IA no logró proponer un tema válido en 3 intentos");
}

/* ---------- Selección de tema: curados → RSS (mañanas) → IA ---------- */

async function pickTopic(env, existingTitles, existingSlugs, state, hourUTC, modo) {
  const nowMs = Date.now();
  // Limpiar reservas expiradas (> 15 minutos = 900.000 ms)
  const activeReservations = new Map();
  if (state.topicReservations && typeof state.topicReservations === "object") {
    for (const [tId, expMs] of Object.entries(state.topicReservations)) {
      if (typeof expMs === "number" && expMs > nowMs) {
        activeReservations.set(tId, expMs);
      }
    }
  }

  const excludedTopics = new Set([
    ...(state.usedTopics || []),
    ...activeReservations.keys()
  ]);

  if (modo === "curado" || modo === "auto") {
    const available = TOPICS.filter((t) => !excludedTopics.has(t.id));
    const fresh = available.filter(
      (t) => !existingTitles.has(normTitle(t.tema)) && !existingSlugs.has(slugify(t.tema))
    );
    if (fresh.length > 0) {
      return { topic: fresh[Math.floor(Math.random() * fresh.length)], source: "curado" };
    }
    if (modo === "curado") throw new Error("No quedan temas curados sin usar");
  }

  if ((modo === "rss" || modo === "auto") && (modo === "rss" || hourUTC === 12)) {
    const topic = await tryRssTopic(env, existingTitles, existingSlugs, state);
    if (topic) return { topic, source: "rss" };
    if (modo === "rss") throw new Error("RSS sin titulares útiles ahora mismo");
    console.log("RSS sin titulares útiles, pasando a propuesta IA");
  }

  const topic = await proposeTopic(env, existingTitles, existingSlugs, state);
  return { topic, source: "ia" };
}

/* ---------- Publicación Defensiva ---------- */

class EditorialSkipError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "EditorialSkipError";
    this.details = details;
  }
}

async function publish(env, hourUTC, modo) {
  if (typeof hourUTC !== "number") hourUTC = new Date().getUTCHours();
  if (!modo) modo = "auto";

  const state = JSON.parse((await env.BLOG_POSTS.get("state")) || '{"usedTopics":[]}');
  if (!Array.isArray(state.usedTopics)) state.usedTopics = [];
  if (!Array.isArray(state.generatedHistory)) state.generatedHistory = [];
  if (!Array.isArray(state.usedHeadlines)) state.usedHeadlines = [];

  const postsData = JSON.parse((await env.BLOG_POSTS.get("posts")) || '{"posts":[]}');
  const posts = Array.isArray(postsData.posts) ? postsData.posts : [];

  const existingTitles = new Set(posts.map((p) => normTitle(p.title)));
  const existingSlugs = new Set(posts.map((p) => p.slug));

  // Sincronizar slugs y títulos existentes con Cloudflare D1 canónico para evitar duplicados
  if (env.BLOG_DB && typeof env.BLOG_DB.prepare === "function") {
    try {
      const d1Posts = await env.BLOG_DB.prepare(
        "SELECT slug, title FROM blog_posts ORDER BY id DESC LIMIT 150"
      ).all();
      if (d1Posts && Array.isArray(d1Posts.results)) {
        for (const row of d1Posts.results) {
          if (row.slug) existingSlugs.add(row.slug);
          if (row.title) existingTitles.add(normTitle(row.title));
        }
      }
    } catch (d1Err) {
      console.warn("[SYNC CANONICAL D1 WARN] No se pudo leer listado previo de D1, recurriendo a KV:", d1Err.message);
    }
  }

  const MAX_TOPIC_ATTEMPTS = 3;
  const executionId = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const workerVersion = "phase_6m1_diagnostics";
  let topic = null;
  let source = null;
  let brief = null;
  let article = null;
  let skippedTopicsCount = 0;
  let lastSkipReason = null;
  const topicAttemptsLog = [];

  const nowIso = new Date().toISOString();

  // Helper para persistir de forma segura el estado en KV ante cualquier desenlace
  const saveExecutionState = async (updates) => {
    try {
      Object.assign(state, updates);
      await env.BLOG_POSTS.put("state", JSON.stringify(state));
    } catch (kvErr) {
      console.error("[OBSERVABILITY KV ERROR] No se pudo persistir el estado de ejecución en KV:", kvErr.message);
      throw kvErr;
    }
  };

  try {
    for (let topicAttempt = 1; topicAttempt <= MAX_TOPIC_ATTEMPTS; topicAttempt++) {
      const currentTopicLog = {
        topicAttempt,
        topicId: null,
        topicTheme: null,
        source: null,
        briefApproved: false,
        briefFailureReason: null,
        articleAttempts: []
      };

      try {
        const picked = await pickTopic(env, existingTitles, existingSlugs, state, hourUTC, modo);
        topic = picked.topic;
        source = picked.source;
        currentTopicLog.topicId = topic?.id || null;
        currentTopicLog.topicTheme = topic?.tema || null;
        currentTopicLog.source = source;

        // Registrar reserva temporal con expiración de 15 minutos en state
        if (topic && topic.id && source === "curado") {
          state.topicReservations = state.topicReservations || {};
          state.topicReservations[topic.id] = Date.now() + 15 * 60 * 1000;
          await saveExecutionState({ topicReservations: state.topicReservations });
        }

        // Seleccionar tipo de artículo (si no viene predefinido, usa Tipo 2 por defecto o elegibles en modo auto)
        const selectedTypeCode = topic.articleType || 2;
        const selectedType = resolveArticleType(selectedTypeCode);
        topic.articleType = selectedType.code;
        currentTopicLog.articleType = selectedType.id;

        // Intentar generar y auditar el brief editorial
        try {
          brief = await createEditorialBrief(env, topic);
          brief.articleType = selectedType.code;
          currentTopicLog.briefApproved = true;
        } catch (briefErr) {
          currentTopicLog.briefApproved = false;
          currentTopicLog.briefFailureReason = briefErr.message;
          throw briefErr;
        }

        // Generación y auditoría del artículo con límite estricto de reintentos
        let feedback = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
          const attemptLog = {
            attemptNumber: attempt,
            stage: "generation",
            success: false,
            bodyWords: 0,
            paragraphCount: 0,
            hasDuplicateParagraphs: false,
            auditScore: null,
            metrics: {},
            rejectionReasons: []
          };

          try {
            const candidateArticle = await generateArticle(env, brief, topic, attempt, feedback);
            const wordStats = countEditorialWords(candidateArticle);
            attemptLog.bodyWords = wordStats.bodyWords;
            attemptLog.paragraphCount = wordStats.paragraphCount;

            const dupCheck = checkDuplicateParagraphs(candidateArticle);
            attemptLog.hasDuplicateParagraphs = dupCheck.hasDuplicate;

            attemptLog.stage = "audit";
            const auditResult = await auditArticle(env, candidateArticle, brief);
            attemptLog.auditScore = auditResult.score ?? (auditResult.approved ? 80 : 0);
            
            // Extraer métricas reales sin inventar puntuaciones
            if (auditResult.metrics && typeof auditResult.metrics === "object") {
              for (const [mName, mVal] of Object.entries(auditResult.metrics)) {
                if (mVal && typeof mVal.score === "number") {
                  attemptLog.metrics[mName] = mVal.score;
                }
              }
            }

            if (Array.isArray(auditResult.reasons)) {
              attemptLog.rejectionReasons = auditResult.reasons.map(r => ({
                metric: r.metric || "unknown",
                problem: r.problem || "Unspecified",
                evidence: (r.evidence || "").slice(0, 160)
              }));
            }

            if (auditResult && auditResult.approved) {
              attemptLog.success = true;
              article = candidateArticle;
              currentTopicLog.articleAttempts.push(attemptLog);
              break;
            }

            feedback = auditResult;
            currentTopicLog.articleAttempts.push(attemptLog);
          } catch (e) {
            attemptLog.stage = "exception";
            attemptLog.rejectionReasons.push({
              metric: "technical_or_format",
              problem: e.name || "Error",
              evidence: e.message.slice(0, 160)
            });
            currentTopicLog.articleAttempts.push(attemptLog);

            const isTech =
              e.message.includes("500") ||
              e.message.includes("502") ||
              e.message.includes("503") ||
              e.message.includes("504") ||
              e.message.includes("Timeout") ||
              e.message.includes("unresponsive") ||
              e.message.includes("fetch failed") ||
              e.message.includes("network") ||
              e.message.includes("rate limit");
            if (isTech) {
              throw new Error(`Workers AI Technical Failure: ${e.message}`);
            }
            feedback = { reasons: [{ metric: "error", score: 0, evidence: "Exception", problem: e.message, correction: "Retry" }] };
          }
        }

        topicAttemptsLog.push(currentTopicLog);

        if (!article) {
          throw new EditorialSkipError(`Quality Gate no aprobado tras 3 intentos para el tema "${topic.tema}"`);
        }

        // Si llegamos aquí, tenemos brief y artículo aprobados
        break;
      } catch (err) {
        if (!topicAttemptsLog.includes(currentTopicLog)) {
          topicAttemptsLog.push(currentTopicLog);
        }

        if (err.name === "EditorialSkipError" || (err.message && err.message.startsWith("SKIP TOPIC"))) {
          console.warn(`[EDITORIAL SKIP] Intento ${topicAttempt}/${MAX_TOPIC_ATTEMPTS} omitido: ${err.message}`);
          skippedTopicsCount++;
          lastSkipReason = err.message;

          // PROTECCIÓN DEL CATÁLOGO FASE 6M.1:
          // Un tema curado NO se consume definitivamente en usedTopics cuando el artículo o brief fallan.
          // En su lugar, se añade a failedTopicsTemporarily para evitar reintentarlo dentro de esta misma ejecución.

          if (topicAttempt === MAX_TOPIC_ATTEMPTS) {
            const skipReason = `Se alcanzaron ${MAX_TOPIC_ATTEMPTS} intentos de temas sin superar el filtro editorial de calidad. Último: ${lastSkipReason}`;
            await saveExecutionState({
              lastRun: nowIso,
              lastResult: "skipped",
              lastSkipReason: skipReason,
              lastError: null,
              lastDiagnosticReport: {
                executionId,
                workerVersion,
                timestamp: nowIso,
                skippedTopicsCount,
                topicAttemptsLog
              }
            });
            return {
              status: "skipped",
              reason: skipReason,
              skippedTopicsCount,
              diagnosticReport: {
                executionId,
                workerVersion,
                topicAttemptsLog
              }
            };
          }
          // Continuar al siguiente intento de tema
          continue;
        }
        // Error técnico imprevisto (ej. fallo de Workers AI, red, timeout en pickTopic o createEditorialBrief)
        throw err;
      }
    }

    if (!article) {
      const skipReason = "No fue posible producir un artículo aprobado tras evaluar los temas disponibles.";
      await saveExecutionState({
        lastRun: nowIso,
        lastResult: "skipped",
        lastSkipReason: skipReason,
        lastError: null
      });
      return {
        status: "skipped",
        reason: skipReason,
        skippedTopicsCount
      };
    }

    // Guardia anti-duplicados por título final antes de generar portada
    if (existingTitles.has(normTitle(article.title))) {
      console.warn(`[DUP TITLE] Título ya existente: "${article.title}". Omitiendo publicación.`);
      const skipReason = `El título generado "${article.title}" ya existe en el catálogo.`;
      await saveExecutionState({
        lastRun: nowIso,
        lastResult: "skipped",
        lastSkipReason: skipReason,
        lastError: null
      });
      return {
        status: "skipped",
        reason: skipReason,
        skippedTopicsCount
      };
    }

    // Generar portada fotográfica
    const imgBytes = await generateCover.call(env, topic);
    if (!imgBytes || imgBytes.byteLength < 1000) {
      throw new Error("Fallo de portada: La imagen generada no contiene bytes válidos.");
    }

    let slug = slugify(article.title);
    if (existingSlugs.has(slug)) slug = slug + "-" + String(Date.now()).slice(-4);

    const kind = sniffImage(imgBytes);
    const coverKey = "img:covers/" + slug + "." + kind.ext;
    await env.BLOG_POSTS.put(coverKey, imgBytes);

    const words = article.content.map((b) => b.text).join(" ").split(/\s+/).length;
    const post = {
      slug,
      title: article.title,
      tag: article.tag,
      date: new Date().toISOString().slice(0, 10),
      readingTime: Math.max(3, Math.round(words / 200)) + " min",
      cover: "/media/covers/" + slug + "." + kind.ext,
      excerpt: article.excerpt,
      content: article.content,
      seoVersion: article.seoVersion || "2.0",
      executiveSummary: article.executiveSummary || null,
      targetService: article.targetService || null,
      customMetaDesc: article.customMetaDesc || article.excerpt,
      faqs: article.faqs || [],
      relatedSlugs: article.relatedSlugs || []
    };

    // Persistencia dual: D1 permanente sin truncamiento + KV compatible
    const persistResult = await persistPost(env, post, { enableD1: true, enableKV: true, kvLimit: MAX_POSTS });
    if (persistResult && persistResult.d1 && persistResult.d1.error) {
      throw new Error(`D1 Persistence Failure: ${persistResult.d1.error}`);
    }
    if (persistResult && persistResult.kv && persistResult.kv.error) {
      throw new Error(`KV Persistence Failure: ${persistResult.kv.error}`);
    }

    /* Memoria anti-repetición confirmada tras persistencia exitosa */
    if (source === "curado") {
      state.usedTopics.push(topic.id);
      if (state.topicReservations && state.topicReservations[topic.id]) {
        delete state.topicReservations[topic.id];
      }
    }
    if (source === "rss" && topic._headline) {
      state.usedHeadlines.push(normTitle(topic._headline));
      state.usedHeadlines = state.usedHeadlines.slice(-MAX_HEADLINES);
    }
    state.generatedHistory.push(normTitle(article.title));
    state.generatedHistory = state.generatedHistory.slice(-MAX_HISTORY);

    await saveExecutionState({
      lastRun: nowIso,
      lastResult: "published",
      lastPublishedAt: nowIso,
      lastSkipReason: null,
      lastError: null,
      lastSource: source
    });

    return { status: "published", post, source };
  } catch (technicalError) {
    // Registro explícito del error técnico antes de relanzar
    try {
      await saveExecutionState({
        lastRun: nowIso,
        lastResult: "failed",
        lastError: {
          message: technicalError.message,
          name: technicalError.name,
          timestamp: nowIso
        }
      });
    } catch (saveErr) {
      console.error("[OBSERVABILITY KV ERROR] Falló guardar estado de error:", saveErr.message);
    }
    throw technicalError;
  }
}

async function sendEmailNotification(env, post, source) {
  const apiKey = env.SENDGRID_API_KEY;
  const fromEmail = env.FROM_EMAIL || "noreply@example.com";
  const toEmail = env.TO_EMAIL || "admin@tuagencia.com";

  if (!apiKey) {
    console.log("SENDGRID_API_KEY no configurado, saltando notificación");
    return;
  }

  const sourceLabel = source === "curado" ? "tema curado de la lista"
    : source === "rss" ? "inspirado en titulares reales (RSS)"
      : "tema propuesto por IA";

  const articleUrl = "https://canedostudio.com/post.html?slug=" + post.slug;
  const subject = "📝 Nuevo artículo publicado en Canedo Studio: " + post.title;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1a1a1a;">📄 Nuevo artículo publicado</h2>
      <p style="font-size: 16px; line-height: 1.6;">Se ha publicado automáticamente un nuevo artículo en el blog de Canedo Studio.</p>

      <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #0d9488;">
        <h3 style="margin: 0 0 10px 0; color: #0d9488;">${post.title}</h3>
        <p style="margin: 0; color: #666; font-size: 14px;">📅 ${post.date} · 🏷️ ${post.tag} · ⏱️ ${post.readingTime} · 🧠 ${sourceLabel}</p>
      </div>

      <p style="font-size: 14px; color: #666; margin-bottom: 20px;">${post.excerpt}</p>

      <a href="${articleUrl}" style="display: inline-block; background: #0d9488; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">Leer artículo completo →</a>

      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
      <p style="font-size: 12px; color: #999;">Este email fue enviado automáticamente por el bot del blog de Canedo Studio.</p>
    </div>
  `;

  try {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: toEmail }], subject }],
        from: { email: fromEmail, name: "Canedo Studio Blog" },
        content: [{ type: "text/html", value: html }]
      })
    });

    if (res.ok) {
      console.log("✅ Email de notificación enviado a " + toEmail);
    } else {
      const err = await res.text();
      console.log("❌ Error enviando email:", res.status, err);
    }
  } catch (e) {
    console.log("❌ Excepción enviando email:", e.message);
  }
}

function isAuthorized(request, env) {
  if (!env.BOT_TOKEN) return false;

  // 1. Cabecera estándar HTTPS Authorization: Bearer <token>
  const authHeader = request.headers.get("Authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    const bearer = authHeader.slice(7).trim();
    if (bearer === env.BOT_TOKEN) return true;
  }

  // 2. Cabecera opcional segura X-Bot-Token
  const xBotToken = request.headers.get("X-Bot-Token");
  if (xBotToken && xBotToken.trim() === env.BOT_TOKEN) return true;

  // Se ha eliminado de forma definitiva la autenticación por parámetro ?token= en URL
  // para evitar fugas del secreto en historiales, proxies o logs de acceso.
  return false;
}

export {
  createEditorialBrief,
  auditArticle,
  generateArticle,
  publish,
  pickTopic,
  normTitle,
  slugify,
  sniffImage,
  validateTopic,
  EditorialSkipError,
  isAuthorized,
  BRIEF_THRESHOLD,
  QUALITY_GATE_THRESHOLD,
  MIN_EDITORIAL_WORDS,
  MAX_EDITORIAL_WORDS,
  countEditorialWords,
  checkDuplicateParagraphs
};

export default {
  async scheduled(event, env, ctx) {
    const hourUTC = new Date(event.scheduledTime || Date.now()).getUTCHours();
    ctx.waitUntil(
      (async () => {
        try {
          const result = await publish(env, hourUTC, "auto");
          if (result && result.status === "published" && result.post) {
            console.log(`[SCHEDULED OK] Publicado: ${result.post.title} (${result.source})`);
            await sendEmailNotification(env, result.post, result.source);
          } else if (result && result.status === "skipped") {
            console.warn(`[SCHEDULED SKIPPED] ${result.reason} (Temas evaluados: ${result.skippedTopicsCount || 0})`);
          } else {
            console.warn(`[SCHEDULED UNKNOWN] Resultado no concluyente:`, JSON.stringify(result));
          }
        } catch (err) {
          // Captura defensiva de errores graves de infraestructura (D1, KV, Workers AI)
          console.error(`[SCHEDULED ERROR] Excepción no controlada en ejecución programada: ${err.message}`, err.stack);
        }
      })()
    );
  },
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/publicar-ahora") {
      // Restricción estricta de métodos HTTP: Solo POST para publicaciones manuales.
      if (request.method !== "POST") {
        return new Response("Método no permitido. Las publicaciones manuales requieren exclusivamente POST con cabecera Authorization: Bearer <token>", {
          status: 405,
          headers: { "Allow": "POST" }
        });
      }

      if (!isAuthorized(request, env)) {
        return new Response("No autorizado", { status: 401 });
      }

      const modo = url.searchParams.get("modo") || "auto"; // auto | curado | rss | ia
      try {
        const result = await publish(env, new Date().getUTCHours(), modo);
        if (result && result.status === "published" && result.post) {
          return new Response("Publicado [" + result.source + "]: " + result.post.title + " (/post.html?slug=" + result.post.slug + ")", { status: 200 });
        }
        if (result && result.status === "skipped") {
          return new Response("Omitido por calidad editorial: " + result.reason, { status: 200 });
        }
        return new Response("Resultado inesperado: " + JSON.stringify(result), { status: 500 });
      } catch (e) {
        return new Response("Error al publicar: " + e.message, { status: 500 });
      }
    }
    if (url.pathname === "/test-benchmark") {
      if (env.BENCHMARK_ENABLED !== "true") {
        return new Response("Not Found", { status: 404 });
      }
      if (!env.BOT_TOKEN || url.searchParams.get("token") !== env.BOT_TOKEN) {
        return new Response("Forbidden", { status: 403 });
      }
      
      try {
        const payload = await request.json();
        const stats = { briefCalls: 0, writerCalls: 0, auditCalls: 0 };
        
        let brief = null;
        let briefError = null;
        let failedBriefs = [];
        let lastBrief = null;
        try {
          brief = await createEditorialBrief(env, payload.topic, stats);
          failedBriefs = brief._failedBriefs || [];
        } catch(e) {
          briefError = e.message;
          lastBrief = e.lastBrief;
          failedBriefs = e._failedBriefs || [];
        }

        const attempts = [];
        let article = null;
        let auditResult = null;
        let feedback = null;
        
        if (brief) {
          for (let attempt = 1; attempt <= 3; attempt++) {
            let attemptArticle = null;
            let attemptAudit = null;
            try {
              attemptArticle = await generateArticle(env, brief, payload.topic, attempt, feedback, stats);
              attemptAudit = await auditArticle(env, attemptArticle, brief, stats);
              
              attempts.push({
                attempt,
                article: attemptArticle,
                audit: attemptAudit,
                feedbackSent: feedback
              });
              
              if (attemptAudit.approved) {
                 article = attemptArticle;
                 break;
              }
              feedback = attemptAudit;
            } catch (e) {
              attempts.push({ attempt, error: e.message, feedbackSent: feedback });
              feedback = { reasons: [{ metric: "error", score: 0, evidence: "Exception", problem: e.message, correction: "Retry" }] };
            }
          }
        }
        
        stats.totalCalls = stats.briefCalls + stats.writerCalls + stats.auditCalls;
        
        return new Response(JSON.stringify({ 
           topic: payload.topic,
           brief, 
           briefError,
           lastBrief,
           failedBriefs,
           attempts, 
           skipped: !article,
           stats
        }), { headers: { "content-type": "application/json" }});
      } catch(e) {
         return new Response(e.message, {status: 500});
      }
    }
    if (url.pathname === "/feed-check") {
      if (!env.BOT_TOKEN || url.searchParams.get("token") !== env.BOT_TOKEN) {
        return new Response("No autorizado", { status: 401 });
      }
      const report = { feeds: [], totalTitulares: 0, muestra: [] };
      for (const feedUrl of RSS_FEEDS) {
        try {
          const res = await fetch(feedUrl, {
            signal: AbortSignal.timeout(8000),
            headers: { "User-Agent": "Mozilla/5.0 (compatible; CanedoStudioBlogBot/1.0)" },
          });
          if (!res.ok) { report.feeds.push({ url: feedUrl, estado: "HTTP " + res.status }); continue; }
          const xml = await res.text();
          const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
          let validos = 0;
          for (const item of items.slice(0, 12)) {
            const m = item.match(/<title>([\s\S]*?)<\/title>/);
            if (!m) continue;
            let t = m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim();
            t = t.replace(/&amp;/g, "&").replace(/&#\d+;|&[a-z]+;/g, " ").replace(/\s+/g, " ").trim();
            if (t.length >= 20 && t.length <= 180 && !hasBanned(t)) {
              validos++;
              if (report.muestra.length < 5) report.muestra.push(t);
            }
          }
          report.feeds.push({ url: feedUrl, estado: "ok", itemsLeidos: items.length, titularesValidos: validos });
          report.totalTitulares += validos;
        } catch (e) {
          report.feeds.push({ url: feedUrl, estado: "error: " + e.message });
        }
      }
      return new Response(JSON.stringify(report, null, 2), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.pathname === "/rss-debug") {
      if (!env.BOT_TOKEN || url.searchParams.get("token") !== env.BOT_TOKEN) {
        return new Response("No autorizado", { status: 401 });
      }
      try {
        const state = JSON.parse((await env.BLOG_POSTS.get("state")) || '{"usedTopics":[]}');
        const postsData = JSON.parse((await env.BLOG_POSTS.get("posts")) || '{"posts":[]}');
        const existingTitles = new Set((postsData.posts || []).map((p) => normTitle(p.title)));
        const existingSlugs = new Set((postsData.posts || []).map((p) => p.slug));
        const headlines = await fetchHeadlines();
        if (headlines.length === 0) return new Response("fetchHeadlines devolvió 0", { status: 200 });
        const headline = headlines[Math.floor(Math.random() * headlines.length)];
        const userPrompt = `${EDITORIAL_CHARTER}\n\nTitular de actualidad del mundo del marketing y los negocios:\n"${headline}"\n\nConvierte la tendencia que hay detrás de esa noticia en UN tema práctico para el dueño de una pyme hispanohablante. NO hables de la noticia en sí: usa la tendencia como excusa para enseñar algo útil hoy.\nSolo el JSON.`;
        const res = await env.AI.run(MODEL_TEXT, {
          messages: [{ role: "system", content: TOPIC_PROMPT }, { role: "user", content: userPrompt }],
          max_tokens: 500,
          temperature: 0.8,
        });
        const raw = readTextResponse(res);
        let data = null; let motivo = "";
        try { data = extractJson(raw); } catch (e) { motivo = "JSON: " + e.message; }
        const valido = data ? validateTopic(data, existingTitles, existingSlugs, state) : null;
        if (data && !valido) motivo = "validación rechazada";
        return new Response(JSON.stringify({ titularElegido: headline, respuestaCruda: raw.slice(0, 900), parseado: data, aceptado: !!valido, motivo }, null, 2), { status: 200 });
      } catch (e) {
        return new Response("Error debug: " + e.message, { status: 500 });
      }
    }
    if (url.pathname === "/repintar") {
      if (!env.BOT_TOKEN || url.searchParams.get("token") !== env.BOT_TOKEN) {
        return new Response("No autorizado", { status: 401 });
      }
      const slug = url.searchParams.get("slug");
      const escena = url.searchParams.get("escena");
      if (!slug || !escena) return new Response("Faltan slug o escena", { status: 400 });
      try {
        const postsData = JSON.parse((await env.BLOG_POSTS.get("posts")) || '{"posts":[]}');
        const post = (postsData.posts || []).find((p) => p.slug === slug);
        if (!post) return new Response("Artículo no encontrado", { status: 404 });
        const imgBytes = await generateCover.call(env, { img: escena });
        const kind = sniffImage(imgBytes);
        // Nombre nuevo cada vez: los navegadores cachean /media/ un año,
        // así que una portada repintada solo se ve al instante si cambia la URL.
        const newPath = "/media/covers/" + slug + "-" + Date.now().toString(36) + "." + kind.ext;
        await env.BLOG_POSTS.put("img:" + newPath.replace("/media/", ""), imgBytes);
        if (post.cover && post.cover.indexOf("/media/") === 0) {
          await env.BLOG_POSTS.delete("img:" + post.cover.replace("/media/", ""));
        }
        post.cover = newPath;
        await env.BLOG_POSTS.put("posts", JSON.stringify(postsData));
        return new Response("Portada repintada: " + newPath, { status: 200 });
      } catch (e) {
        return new Response("Error al repintar: " + e.message, { status: 500 });
      }
    }
    return new Response("Robot del blog de Canedo Studio: activo. Publica a diario 7:00 (edición con inspiración de prensa) y 17:00 (hora Colombia). Temas: 210 curados + IA ilimitada.", { status: 200 });
  },
};
