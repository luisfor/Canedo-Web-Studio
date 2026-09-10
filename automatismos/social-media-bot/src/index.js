/**
 * Bot de Redes Sociales con IA - Canedo Studio
 * Sistema Editorial Automatizado B2B
 */



async function signUrl(urlPath, expires, secret) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false, ["sign"]
  );
  const dataToSign = `${urlPath}?expires=${expires}`;
  const signatureBuffer = await crypto.subtle.sign("HMAC", keyMaterial, encoder.encode(dataToSign));
  const signatureArray = Array.from(new Uint8Array(signatureBuffer));
  const signatureHex = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `${dataToSign}&sig=${signatureHex}`;
}

async function verifyUrl(urlObj, secret) {
  const expires = urlObj.searchParams.get("expires");
  const sig = urlObj.searchParams.get("sig");
  if (!expires || !sig) return false;
  if (Date.now() > parseInt(expires, 10)) return false;
  
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false, ["verify"]
  );
  const dataToSign = `${urlObj.pathname}?expires=${expires}`;
  const signatureBytes = new Uint8Array(sig.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
  return await crypto.subtle.verify("HMAC", keyMaterial, signatureBytes, encoder.encode(dataToSign));
}



const SYSTEM_PROMPT_FINGERPRINT = `Eres el Director Creativo de Canedo Studio (NO Canedo Web Studio).
Genera una IDEA ÚNICA para un post de redes sociales dirigido a dueños de negocios locales.

OBJETIVO COMERCIAL:
Sigue el embudo: Valor -> Interés -> Confianza -> canedostudio.com -> Lead. No hagas un anuncio puro.

TEMAS PERMITIDOS:
Diseño web, SEO, automatización, agentes IA, chatbots, CRM, automatización comercial, Google Business Profile, reputación digital, infraestructura web.

SISTEMA VISUAL CANEDO STUDIO (MUY IMPORTANTE):
Determina un concepto visual directamente relacionado con el TEMA REAL del post.
EVITAR Y PROHIBIDO: "Stock-photo look", dashboards tecnológicos genéricos, gráficas complejas, documentos, hojas, interfaces con texto.
NO CONCEPTUALIZAR NINGÚN ELEMENTO QUE REQUIERA TEXTO (como un menú, un documento o un dashboard con datos).
USA: personas en situaciones de negocio, teléfonos limpios sin interfaces, iconos reconocibles, checkmarks, calendarios sin texto, símbolos de mensajes, fotografías comerciales realistas.
ESTILO: Premium, limpio, moderno, B2B, hiper-específico al problema resuelto.

SCROLL STOP (IMPACTO VISUAL):
Mejora el primer impacto visual mediante:
- conflicto visual evidente o emoción humana
- contraste antes/después o situación reconocible
- composición con un foco dominante
NO lo consigas añadiendo texto, llenando la imagen de elementos o colores estridentes. Debe existir una razón visual clara para detenerse.

AUDIENCIA Y CLARIDAD DEL SERVICIO:
No usar textos artificiales como "Para emprendedores". La audiencia debe comunicarse visualmente (ej: dueño gestionando un local).
No usar conceptos abstractos como "Optimiza tu embudo". Usa beneficios concretos como "Responde clientes automáticamente".

CONTENT INTENT Y CTA:
Define la intención: AWARENESS, EDUCATION, CONSIDERATION, o CONVERSION.
AWARENESS: priorizar curiosidad. (Ej CTA: "Síguenos para más ideas")
EDUCATION: priorizar aprendizaje. (Ej CTA: "Guarda esta idea")
CONSIDERATION: priorizar problema+solución. (Ej CTA: "Descubre cómo automatizarlo")
CONVERSION: priorizar servicio+beneficio. (Ej CTA: "Automatiza tu negocio con CanedoStudio")
Usa un ÚNICO 'primary_cta' en toda la pieza según esta intención.

Si el usuario proporciona una "Idea Semilla", EVALÚALA. Si incluye "REHACER", NO repitas el hook, ángulo o concepto visual anterior. Si no tiene relación con marketing/negocios, recházala.

Si la rechazas: { "isRelevant": false, "reason": "..." }

Si la aceptas, devuelve ESTE JSON STRICTO:
{
  "generation_id": "Un ID alfanumérico único para esta generación (ej. gen_abc123)",
  "platform": "Elegir entre: INSTAGRAM, FACEBOOK, LINKEDIN",
  "content_intent": "AWARENESS, EDUCATION, CONSIDERATION o CONVERSION",
  "topicFingerprint": "Tema central específico",
  "primaryKeyword": "Keyword SEO natural",
  "problemFingerprint": "Problema específico y reconocible",
  "solutionFingerprint": "Nuestra solución o insight",
  "benefitFingerprint": "El beneficio real",
  "visualFingerprint": "A premium, modern B2B advertisement image for Canedo Studio showing a digital automation concept. Clean, highly professional, no generic robots. Hyper-realistic. [Añadir descripción del concepto visual].",
  "image_headline": "Titular de 3 a 8 palabras, concreto y comprensible. Se renderizará en la imagen.",
  "image_supporting_text": "Texto secundario breve para apoyar el titular. Se renderizará en la imagen.",
  "primary_cta": "CTA principal acorde al content_intent",
  "image_cta": "El mismo primary_cta",
  "image_brand": "CanedoStudio",
  "optional_ui_labels": "Opcional: 1 a 3 etiquetas cortas para UI (Ej: 'Mensajes, Citas'). NADA MÁS.",
  "image_layout_type": "Instrucción de layout para la IA (ej. Texto centrado, colores oscuros, branding inferior).",
  "semanticFingerprint": "Resumen conceptual",
  "servicePromoted": "Servicio exacto",
  "hook": "Un gancho específico y natural que no sea cliché",
  "cta": "Llamado a la acción para el caption",
  "isRelevant": true
}`;

const SYSTEM_PROMPT_COPY = `Eres un experto Copywriter B2B. Tu cliente es Canedo Studio (NUNCA Canedo Web Studio).

REGLAS ABSOLUTAS:
1. MARCA: Únicamente "Canedo Studio". Hashtag: #CanedoStudio. 
2. PROHIBIDO CLICHÉS: No uses "lleva tu negocio al siguiente nivel", "despliegue inteligente", "revoluciona tu empresa", "presencia en línea fuerte", u otras frases corporativas robóticas.
3. HUMANIZACIÓN: Varía estructuras, usa lenguaje natural y fácil de entender. Tono B2B profesional y comercial, pero sin sonar vendedor o artificial. Sin relleno.
4. NO INVENTAR ESTADÍSTICAS: Prohibido incluir porcentajes, estudios, rankings o datos cuantitativos si no tienes una fuente real verificable. No inventar clientes ni premios.
5. NO REPETIR: Cada párrafo aporta información nueva.
6. SEO NATURAL: Integra la keyword principal orgánicamente. SIN KEYWORD STUFFING.

ESTILO POR RED (SEGÚN PLATAFORMA INDICADA):
- INSTAGRAM: Visual, fácil de escanear, párrafos cortos, CTA sencillo, 3-6 hashtags precisos (no genéricos).
- FACEBOOK: Conversacional, problema reconocible, utilidad, CTA natural, ligeramente más explicativo.
- LINKEDIN: B2B, profesional, técnico si aplica, basado en insight, pocos emojis, invitar a pensar.

ESTRUCTURA CONCEPTUAL:
Gancho (Hook) -> Problema -> Valor -> Solución/Insight -> CTA.

Escribe el texto FINAL de la publicación. No incluyas notas adicionales.`;

const SYSTEM_PROMPT_QUALITY_GATE = `Eres un auditor estricto de calidad de Canedo Studio.
Evalúa la NUEVA publicación (Idea + Copy) contra el historial para evitar clones, y evalúa su calidad técnica.

Devuelve UNICAMENTE un JSON con:
{
  "similarityScore": 0-100, // 100 es un clon exacto del historial
  "BRAND_ACCURACY": 0-100, // 100 si usa Canedo Studio, 0 si falla (ej. Canedo Web Studio)
  "HOOK_STRENGTH": 0-100,
  "USEFULNESS": 0-100,
  "HUMANNESS": 0-100,
  "SPECIFICITY": 0-100,
  "PLATFORM_FIT": 0-100,
  "VISUAL_RELEVANCE": 0-100,
  "COMMERCIAL_RELEVANCE": 0-100,
  "SEO_RELEVANCE": 0-100,
  "CTA_QUALITY": 0-100,
  "REPETITION_RISK": 0-100, // Riesgo de ser redundante internamente
  "GENERIC_AI_RISK": 0-100,
  "SPAM_RISK": 0-100
}`;

function normalizeAIResponse(aiResponse) {
  if (aiResponse === null || aiResponse === undefined) {
    throw new Error("AI_EMPTY_RESPONSE: Response is null or undefined");
  }

  if (typeof aiResponse === 'object') {
    if (aiResponse.success === false && Array.isArray(aiResponse.errors)) {
      const errStr = aiResponse.errors.map(e => e.message || JSON.stringify(e)).join(", ");
      if (errStr.toLowerCase().includes("quota") || errStr.toLowerCase().includes("limit") || errStr.toLowerCase().includes("rate")) {
         throw new Error("AI_RATE_LIMIT/QUOTA_ERROR: " + errStr);
      }
      throw new Error("AI_PROVIDER_ERROR: " + errStr);
    }
    if (aiResponse.error || aiResponse.errors) {
       throw new Error("AI_PROVIDER_ERROR: " + JSON.stringify(aiResponse.error || aiResponse.errors));
    }
  }

  let raw = "";

  if (typeof aiResponse === 'string') {
    raw = aiResponse;
  } else if (typeof aiResponse === 'object') {
    if (typeof aiResponse.response === 'string') {
      raw = aiResponse.response;
    } else if (typeof aiResponse.response === 'object' && aiResponse.response !== null) {
      raw = JSON.stringify(aiResponse.response);
    } else if (aiResponse.result && typeof aiResponse.result.response === 'string') {
      raw = aiResponse.result.response;
    } else if (aiResponse.choices && Array.isArray(aiResponse.choices) && aiResponse.choices[0]?.message?.content) {
      raw = aiResponse.choices[0].message.content;
    } else if (Object.keys(aiResponse).length > 0) {
      throw new Error("AI_INVALID_RESPONSE: Estructura desconocida " + JSON.stringify(aiResponse).slice(0, 100));
    }
  }

  if (typeof raw !== 'string') {
    throw new Error("AI_INVALID_RESPONSE: No se pudo extraer texto.");
  }

  raw = raw.trim();
  if (raw.length === 0) {
    throw new Error("AI_EMPTY_RESPONSE: El texto extraído está vacío.");
  }

  return raw;
}

function parseJSONSafely(raw) {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AI_PARSE_ERROR: No se encontró JSON válido en la respuesta.");
  }
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch (e) {
    throw new Error("AI_PARSE_ERROR: JSON malformado - " + e.message);
  }
}

async function withRetry(operationName, operation, maxRetries = 3, delayMs = 1500) {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await operation();
    } catch (e) {
      attempt++;
      console.warn(`[Reintento ${attempt}/${maxRetries}] ${operationName} falló: ${e.message}`);
      if (attempt >= maxRetries) throw e;
      await new Promise(res => setTimeout(res, delayMs));
    }
  }
}

async function runOpenAITextFallback(env, messages, contextName) {
  if (!env.OPENAI_API_KEY) {
    throw new Error(`[TEXT_AI] OPENAI_API_KEY no está configurada para fallback (${contextName})`);
  }
  
  console.log(`[TEXT_AI] FALLBACK a OpenAI activado para: ${contextName}`);
  
  const payload = {
    model: "gpt-4o-mini",
    messages: messages.map(m => ({
      role: m.role,
      content: m.content
    }))
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Respuesta de OpenAI vacía o formato desconocido.");
  
  console.log(`[TEXT_AI] PROVIDER: OpenAI Fallback - PASS (${contextName})`);
  return normalizeAIResponse(content);
}

async function runTextAI(env, messages, contextName = "Text") {
  if (!env.GEMINI_API_KEY) {
    throw new Error(`[TEXT_AI] GEMINI_API_KEY no está configurada (${contextName})`);
  }

  const systemMsg = messages.find(m => m.role === "system");
  const userMsgs = messages.filter(m => m.role !== "system").map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }]
  }));

  const payload = {
    contents: userMsgs,
    generationConfig: {
      responseMimeType: "application/json",
    }
  };

  if (systemMsg) {
    payload.systemInstruction = { parts: [{ text: systemMsg.content }] };
  }

  try {
    const res = await withRetry(`Gemini Primary (${contextName})`, async () => {
      let url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${env.GEMINI_API_KEY}`;
      // Allow forced failure for testing
      if (env.FORCE_GEMINI_FAIL === "true") {
         url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=FAKE_KEY`;
      }
      return await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error.message);

    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) throw new Error("Respuesta de Gemini vacía o formato desconocido.");

    console.log(`[TEXT_AI] PROVIDER: Gemini Primary - PASS (${contextName})`);
    return normalizeAIResponse(content);
  } catch (error) {
    console.warn(`[TEXT_AI] Gemini Primary falló (${contextName}): ${error.message}. Intentando Gemini Fallback...`);
    try {
      const fallbackRes = await withRetry(`Gemini Fallback (${contextName})`, async () => {
        let url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${env.GEMINI_API_KEY}`;
        if (env.FORCE_GEMINI_FAIL === "true") {
           url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=FAKE_KEY`;
        }
        return await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      });

      const fallbackData = await fallbackRes.json();
      if (fallbackData.error) throw new Error(fallbackData.error.message);

      const fallbackContent = fallbackData.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!fallbackContent) throw new Error("Respuesta de Gemini Fallback vacía o formato desconocido.");

      console.log(`[TEXT_AI] PROVIDER: Gemini Fallback - PASS (${contextName})`);
      return normalizeAIResponse(fallbackContent);
    } catch (fallbackGeminiError) {
      console.warn(`[TEXT_AI] Gemini Fallback también falló (${contextName}): ${fallbackGeminiError.message}. Intentando fallback OpenAI...`);
      try {
        return await runOpenAITextFallback(env, messages, contextName);
      } catch (fallbackOpenAIError) {
        console.error(`[TEXT_AI] OpenAI Fallback también falló (${contextName}): ${fallbackOpenAIError.message}`);
        throw new Error(`Todos los proveedores de texto fallaron (Gemini Primary, Gemini Fallback, OpenAI). Último error: ${fallbackOpenAIError.message}`);
      }
    }
  }
}

async function getHistory(env) {
  try {
    const { results } = await env.DB.prepare("SELECT * FROM publications ORDER BY date DESC LIMIT 20").all();
    return results || [];
  } catch (e) {
    console.error("Error leyendo D1:", e);
    return [];
  }
}

async function evaluateQualityGate(env, idea, caption, history) {
  const prompt = `HISTORIAL RECIENTE (para evaluar similitud):
${JSON.stringify(history.map(h => ({ hook: h.hook, topic: h.topicFingerprint })))}

NUEVA PROPUESTA:
Plataforma: ${idea.platform}
Texto: ${caption}
Visual: ${idea.visualFingerprint}
`;

  const raw = await runTextAI(env, [
    { role: "system", content: SYSTEM_PROMPT_QUALITY_GATE },
    { role: "user", content: prompt }
  ], "QualityGate");
  return parseJSONSafely(raw);
}

function deterministicChecks(caption, platform) {
  // Brand identity
  const upper = caption.toUpperCase();
  const brandFailures = ["CANEDO WEB STUDIO", "CANEDOSTUDIO WEB", "CANEDO DIGITAL STUDIO", "CANEDO WEB", "CANEDO AGENCY"];
  for (const bf of brandFailures) {
    if (upper.includes(bf)) return { pass: false, reason: `Incluye marca prohibida: ${bf}` };
  }
  if (upper.includes("#CANEDOWEBSTUDIO")) return { pass: false, reason: "Incluye hashtag prohibido #CanedoWebStudio" };
  
  // Generic phrases
  const generics = ["AL SIGUIENTE NIVEL", "PRESENCIA EN LÍNEA FUERTE", "NUESTRO EQUIPO DE EXPERTOS", "DESPLIEGUE INTELIGENTE"];
  for (const gf of generics) {
    if (upper.includes(gf)) return { pass: false, reason: `Frase genérica detectada: ${gf}` };
  }

  // Unverified statistics
  if (caption.match(/\d+%/)) {
    return { pass: false, reason: "Uso de porcentajes o estadísticas cuantitativas sin fuente verificable." };
  }
  if (upper.includes("SEGÚN UN ESTUDIO") || upper.includes("LA MAYORÍA DE LOS ESTUDIOS")) {
    return { pass: false, reason: "Mención de estudios genéricos." };
  }

  // Length limits
  if (caption.trim().length === 0) return { pass: false, reason: "Texto vacío" };
  if (platform === "INSTAGRAM" && caption.length > 2200) return { pass: false, reason: "Caption excede límite de Instagram" };

  // Hashtags count (aprox)
  const hashCount = (caption.match(/#/g) || []).length;
  if (hashCount > 8) return { pass: false, reason: `Demasiados hashtags (${hashCount}), máximo 6-8` };

  return { pass: true };
}

async function generateAndValidateIdeaAndCopy(env, history, userSeed = null, hasPhoto = false) {
  let isUniqueAndQuality = false;
  let finalFingerprint = null;
  let finalCaption = null;
  let attempts = 0;
  let lastError = "";

  while (!isUniqueAndQuality && attempts < 3) {
    attempts++;
    
    let promptText = "Genera un nuevo concepto para un post de redes sociales.";
    if (userSeed) {
      promptText = `Contexto o instrucción del usuario: "${userSeed}". Genera el JSON considerando esto.`;
    }

    const raw = await runTextAI(env, [
      { role: "system", content: SYSTEM_PROMPT_FINGERPRINT },
      { role: "user", content: promptText }
    ], "Idea");
    let idea = parseJSONSafely(raw);
    
    if (idea.isRelevant === false) {
      return { success: false, error: idea.reason };
    }
    
    const platform = idea.platform || "INSTAGRAM";

    // GENERAR CAPTION
    const captionPrompt = `FINGERPRINT:
Plataforma: ${platform}
Gancho: ${idea.hook}
Problema: ${idea.problemFingerprint}
Solución: ${idea.solutionFingerprint}
Servicio: ${idea.servicePromoted}
CTA: ${idea.cta}
Keyword: ${idea.primaryKeyword}
`;
    const captionText = await runTextAI(env, [
      { role: "system", content: SYSTEM_PROMPT_COPY },
      { role: "user", content: captionPrompt }
    ], "Caption");

    // VALIDACION DETERMINISTA
    const detCheck = deterministicChecks(captionText, platform);
    if (!detCheck.pass) {
      lastError = `Fallo determinista: ${detCheck.reason}`;
      continue;
    }

    // QUALITY GATE
    let scores;
    try {
      scores = await evaluateQualityGate(env, idea, captionText, history);
    } catch(e) {
      lastError = `Error evaluando calidad: ${e.message}`;
      continue;
    }

    if (
      scores.BRAND_ACCURACY === 100 &&
      scores.HOOK_STRENGTH >= 80 &&
      scores.USEFULNESS >= 80 &&
      scores.HUMANNESS >= 80 &&
      scores.SPECIFICITY >= 80 &&
      scores.PLATFORM_FIT >= 85 &&
      scores.VISUAL_RELEVANCE >= 85 &&
      scores.COMMERCIAL_RELEVANCE >= 65 &&
      scores.SEO_RELEVANCE >= 75 &&
      scores.CTA_QUALITY >= 75 &&
      scores.REPETITION_RISK <= 25 &&
      scores.GENERIC_AI_RISK <= 25 &&
      scores.SPAM_RISK <= 20 &&
      scores.similarityScore < 65
    ) {
      isUniqueAndQuality = true;
      finalFingerprint = idea;
      finalCaption = captionText;
    } else {
      lastError = `Quality Gate no superado (Similarity: ${scores.similarityScore}, Brand: ${scores.BRAND_ACCURACY}, Spam: ${scores.SPAM_RISK}, Generic: ${scores.GENERIC_AI_RISK})`;
    }
  }

  if (isUniqueAndQuality) {
    return { success: true, fingerprint: finalFingerprint, caption: finalCaption };
  } else {
    return { success: false, error: lastError || "No superó el Quality Gate tras 3 intentos." };
  }
}

async function generateImage(env, fingerprint, requestCtx) {
  console.log("Generando imagen premium con Nano Banana 2 (Gemini 3.1 Flash Image)...");
  if (!env.OPENROUTER_API_KEY) {
    throw new Error("[IMAGE_AI] OPENROUTER_API_KEY no está configurada");
  }
  
  if (!requestCtx || !requestCtx.requestId) {
    throw new Error("generateImage requiere un requestCtx válido con requestId para idempotencia.");
  }

  const genCostCheck = await env.DB.prepare(`SELECT status, r2_key FROM generation_cost_log WHERE request_id = ?`).bind(requestCtx.requestId).first();
  if (genCostCheck) {
    if (genCostCheck.status === 'SUCCESS' && genCostCheck.r2_key) {
      console.log(`[IDEMPOTENCY] Reusing existing successful generation for request ${requestCtx.requestId}`);
      return { r2Key: genCostCheck.r2_key };
    }
    if (genCostCheck.status === 'PROCESSING') {
      throw new Error(`Ya hay una generación en progreso para la solicitud ${requestCtx.requestId}`);
    }
    if (genCostCheck.status === 'FAILED' && genCostCheck.estimated_cost > 0) {
       throw new Error(`Generación previa falló después de intentar contactar la API de pago. No se reintentará automáticamente.`);
    }
  }

  const generationId = "gen_" + crypto.randomUUID();
  const now = Date.now();

  await env.DB.prepare(`
    INSERT INTO generation_cost_log (generation_id, request_id, state_id, source, model, reason, status, created_at, estimated_cost, actual_cost)
    VALUES (?, ?, ?, ?, ?, ?, 'PROCESSING', ?, 0, 0)
    ON CONFLICT(request_id) DO UPDATE SET status = 'PROCESSING', created_at = ?
  `).bind(generationId, requestCtx.requestId, requestCtx.stateId || "", requestCtx.source, "nano-banana-2", requestCtx.reason, now, now).run();

  const prompt = `Formato vertical 4:5, estilo premium, B2B, alto contraste, moderno, hiper-realista.
Concepto Visual: ${fingerprint.visualFingerprint}
Instrucciones de Layout: ${fingerprint.image_layout_type || "Texto centrado, oscuro, branding inferior"}

VISIBLE TEXT:
${fingerprint.image_headline}
${fingerprint.image_supporting_text}
${fingerprint.image_cta}
${fingerprint.image_brand || "CanedoStudio"}
${fingerprint.optional_ui_labels || ""}

REGLA CRÍTICA:
The ONLY visible written language anywhere in the image must be the exact approved visible text supplied above.
Do not render metadata labels.
Do not render placeholder text.
Do not render simulated text.
Do not render pseudo-writing.
Do not render decorative lines that resemble written paragraphs.
Do not add letters, numbers, signs, UI labels or words anywhere else.
If an object would normally contain text, simplify that object so it contains no text.
El texto permitido debe ser perfectamente legible y seguir un esquema de colores azul eléctrico, blanco y oscuro.`;

  let finalImageUrl = null;
  let finalCost = 0;
  let providerRequestId = null;
  let apiError = null;

  try {
    const res = await withRetry("Nano Banana 2 (OpenRouter)", async () => {
      return await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST", headers: { "Authorization": `Bearer ${env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3.1-flash-image",
          messages: [{ role: "user", content: prompt }]
        })
      });
    });
    
    providerRequestId = res.headers.get("x-request-id") || null;
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    
    if (data.usage && typeof data.usage.cost === 'number') {
      finalCost = data.usage.cost;
    } else {
      finalCost = 0.04;
    }

    let imageUrl = null;
    const message = data.choices && data.choices[0] && data.choices[0].message;
    
    if (message) {
      if (message.content) {
        const urlMatch = message.content.match(/\((https:\/\/[^\)]+)\)/) || message.content.match(/(https:\/\/[^\s]+)/);
        if (urlMatch) imageUrl = urlMatch[1];
      }
      if (!imageUrl && message.images && message.images.length > 0) {
        if (message.images[0].image_url && message.images[0].image_url.url) {
          imageUrl = message.images[0].image_url.url;
        }
      }
    }
    
    if (!imageUrl) throw new Error("OpenRouter no devolvió una imagen válida: " + JSON.stringify(data));
    finalImageUrl = imageUrl;
  } catch (err) {
     apiError = err;
  }
  
  const status = apiError ? 'FAILED' : 'SUCCESS';
  
  await env.DB.prepare(`
    UPDATE generation_cost_log 
    SET status = ?, estimated_cost = ?, actual_cost = ?, provider_request_id = ?
    WHERE generation_id = ?
  `).bind(status, 0.05, finalCost, providerRequestId || "", generationId).run();

  if (apiError) throw apiError;
  if (!finalImageUrl) throw new Error("OpenRouter no devolvió una imagen válida.");

  let buffer;
  let contentType = "image/jpeg";
  let base64 = "";

  if (finalImageUrl.startsWith("data:")) {
    const mimeMatch = finalImageUrl.match(/^data:([^;]+);/);
    if (mimeMatch) contentType = mimeMatch[1];
    const base64Str = finalImageUrl.split(",")[1];
    base64 = base64Str;
    const binaryString = atob(base64Str);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    buffer = bytes.buffer;
  } else {
    const imageRes = await fetch(finalImageUrl);
    contentType = imageRes.headers.get("content-type") || "image/jpeg";
    buffer = await imageRes.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    base64 = btoa(binary);
  }
  
  let ext = ".jpg";
  if (contentType.includes("png")) ext = ".png";
  if (contentType.includes("webp")) ext = ".webp";
  
  return { buffer, ext, contentType, base64, generationId };
}

async function verifyVisualQualityGate(env, base64Image, mimeType, fingerprint) {
    if (env.FORCE_QUALITY_GATE_FAIL === "true") {
        return { is_approved: false, reason: "Forced fail via env flag", business_understanding: 5, service_clarity: 5, target_audience_clarity: 5, benefit_clarity: 5, cta_clarity: 5, scroll_stop: 5, visual_hierarchy: 5, mobile_readability: 5, commercial_relevance: 5, overall_score: 5, five_second_pass: false, brand_correct: true, no_gibberish: true, no_fake_stats: true };
    }
    console.log("[QUALITY_GATE_VISUAL] Verificando calidad de la imagen con Gemini...");
    if (!env.GEMINI_API_KEY) {
        console.warn("[QUALITY_GATE_VISUAL] No GEMINI_API_KEY, saltando auditoría visual.");
        return { is_approved: true };
    }

    const prompt = `Eres un auditor visual de calidad MUY ESTRICTO para CanedoStudio.
Analiza la siguiente imagen para validar que cumpla el "5-Second Test".

CRITERIOS DEL 5-SECOND TEST:
Una persona que NO conozca CanedoStudio debe poder entender en MÁXIMO 5 SEGUNDOS:
1. QUÉ ofrecemos (service_clarity).
2. PARA QUIÉN es (target_audience_clarity). Evalúa esto considerando el CONTEXTO (escena, problema, servicio). Si una persona administrando un negocio puede reconocerse a sí misma en la situación, es un 9 o 10. NO es obligatorio que existan palabras literales como "Para PyMEs".
3. QUÉ problema resolvemos o qué beneficio conseguimos (benefit_clarity).
4. QUÉ acción queremos que realice (cta_clarity).
5. Comprensión global del negocio (business_understanding).

OTROS CRITERIOS:
- scroll_stop: ¿Llama la atención en el feed? Evalúa el impacto (emoción, contraste, foco dominante).
- visual_hierarchy: ¿La jerarquía visual es correcta y guía el ojo?
- mobile_readability: ¿Se puede leer fácilmente en una pantalla pequeña?
- commercial_relevance: ¿Se ve como una empresa premium B2B?
- overall_score: Puntuación global de calidad (0-10).

IMPORTANTE:
- La prioridad es VISUAL CLARO + HEADLINE + UNA FRASE DE APOYO + CTA.
- Si para entender la creatividad hay que leer párrafos, interpretar diagramas técnicos abstractos o conocer previamente a CanedoStudio, debes penalizar fuertemente.
- Verifica también que la marca "CanedoStudio" aparezca escrita y sin faltas de ortografía grotescas, que no haya texto absurdo (gibberish), y que no haya estadísticas o datos inventados.

PREGUNTA MANDATORIA (five_second_pass):
"Si esta imagen apareciera sola en el feed de una persona que nunca ha oído hablar de CanedoStudio, ¿entendería en 5 segundos qué ofrece la empresa, para quién es y por qué podría serle útil?"
Si la respuesta es NO, el valor de five_second_pass DEBE ser false.

REGLAS DE APROBACIÓN (ADAPTATIVO SEGÚN INTENT):
El "content_intent" de esta imagen es: ${fingerprint.content_intent || 'CONVERSION'}.
Si CUALQUIERA de estas condiciones se cumple, is_approved DEBE ser false:
- business_understanding < 9
- service_clarity < 9
- benefit_clarity < 9
- mobile_readability < 9
- commercial_relevance < 9
- five_second_pass es false
- Si el intent es CONSIDERATION o CONVERSION y scroll_stop < 9
- Si el intent es CONVERSION y cta_clarity < 9
(Para AWARENESS/EDUCATION, el CTA puede ser menos comercial pero claro para su objetivo).
Gibberish is CRITICAL FAIL.

Devuelve UNICAMENTE un JSON estricto con el siguiente formato (las puntuaciones deben ser números del 0 al 10):
{
  "target_audience_method": "EXPLICIT o CONTEXTUAL",
  "business_understanding": 0-10,
  "service_clarity": 0-10,
  "target_audience_clarity": 0-10,
  "benefit_clarity": 0-10,
  "cta_clarity": 0-10,
  "scroll_stop": 0-10,
  "visual_hierarchy": 0-10,
  "mobile_readability": 0-10,
  "commercial_relevance": 0-10,
  "overall_score": 0-10,
  "five_second_pass": true/false,
  "brand_correct": true/false,
  "no_gibberish": true/false,
  "no_fake_stats": true/false,
  "is_approved": true/false,
  "reason": "Motivo detallado de por qué aprueba o reprueba la imagen"
}`;

    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${env.GEMINI_API_KEY}`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: prompt },
                        { inline_data: { mime_type: mimeType, data: base64Image } }
                    ]
                }]
            })
        });
        
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        
        let content = data.candidates[0].content.parts[0].text;
        content = content.replace(/^```json/im, '').replace(/```$/im, '').trim();
        const parsed = JSON.parse(content);
        
        console.log(`[QUALITY_GATE_VISUAL] Resultado: ${JSON.stringify(parsed)}`);
        
        // Hard enforcement of user's rules even if the LLM incorrectly flags is_approved: true
        if (
            parsed.business_understanding < 9 ||
            parsed.service_clarity < 9 ||
            parsed.benefit_clarity < 9 ||
            parsed.five_second_pass === false
        ) {
            parsed.is_approved = false;
        }

        return parsed;
    } catch (e) {
        console.error(`[QUALITY_GATE_VISUAL] Error al verificar imagen: ${e.message}`);
        return { is_approved: false, reason: "Error en validación de API" };
    }
}

async function generateVideoOpenRouter(env, prompt, seedRaw) {
  const res = await withRetry("Video (OpenRouter)", async () => {
    return await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST", headers: { "Authorization": `Bearer ${env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "bytedance/seedance-2.0-mini",
        messages: [{ role: "user", content: `Genera un video basado en esta idea: ${prompt}. Requerimientos: ${seedRaw}` }]
      })
    });
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  const content = data.choices[0].message.content;
  const urlMatch = content.match(/((https:\/\/[^\)]+\.mp4))/i) || content.match(/(https:\/\/[^\s]+\.mp4)/i);
  if (!urlMatch) throw new Error("OpenRouter no devolvió una URL válida de video MP4: " + content);
  const videoRes = await fetch(urlMatch[1]);
  return await videoRes.arrayBuffer();
}

async function sendToTelegram(env, finalPost, mediaBytes, mediaType = "photo", seedRaw = "", r2Key = null) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  
  let cleanCaption = finalPost.Texto;
  
  if (typeof cleanCaption === 'object' && cleanCaption !== null) {
    let parsed = cleanCaption;
    if (Array.isArray(parsed) && parsed.length > 0) parsed = parsed[0];
    cleanCaption = parsed.texto || parsed.content || parsed.post_content || parsed.caption || JSON.stringify(cleanCaption);
  } else if (typeof cleanCaption === 'string') {
    cleanCaption = cleanCaption.replace(/^```json/im, '').replace(/```$/im, '').trim();
    try {
      let parsed = JSON.parse(cleanCaption);
      if (Array.isArray(parsed) && parsed.length > 0) {
        parsed = parsed[0];
      }
      if (parsed.texto) cleanCaption = parsed.texto;
      else if (parsed.content) cleanCaption = parsed.content;
      else if (parsed.post_content) cleanCaption = parsed.post_content;
      else if (parsed.caption) cleanCaption = parsed.caption;
    } catch(e) {}
  }
  
  if (typeof cleanCaption === 'string') {
    cleanCaption = cleanCaption.replace(/\\n/g, '\n');
  }


  let url;
  let formData = new FormData();
  formData.append("chat_id", env.TELEGRAM_CHAT_ID);

  if (mediaBytes) {
    if (mediaType === "video") {
      url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendVideo`;
      formData.append("caption", cleanCaption);
      const blob = new Blob([mediaBytes], { type: "video/mp4" });
      formData.append("video", blob, "video.mp4");
    } else {
      url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendPhoto`;
      formData.append("caption", cleanCaption);
      const blob = new Blob([mediaBytes], { type: "image/jpeg" });
      formData.append("photo", blob, "cover.jpg");
    }
  } else {
    url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
    formData.append("text", "📸 *(Post con contenido)*\n\n" + cleanCaption);
    formData.append("parse_mode", "Markdown");
  }

  const rawPlatformValue = finalPost.ADN?.platform || finalPost.Plataforma || "instagram";
  const remakePayload = {
    hook: finalPost.ADN?.hook || "",
    visualFingerprint: finalPost.ADN?.visualFingerprint || "",
    angle: finalPost.ADN?.angle || "",
    topic: finalPost.ADN?.topicFingerprint || "",
    service: finalPost.ADN?.servicePromoted || "",
    platform: normalizePlatform(rawPlatformValue),
    r2Key: r2Key,
    caption: cleanCaption
  };
  const remakeId = crypto.randomUUID();
  const now = Date.now();
  const expiresAt = now + 7 * 24 * 60 * 60 * 1000;
  
  await env.DB.prepare(`INSERT INTO remake_state (id, payload, created_at, expires_at) VALUES (?, ?, ?, ?)`)
    .bind(remakeId, JSON.stringify(remakePayload), now, expiresAt)
    .run();
  
  // Limpieza simple
  await env.DB.prepare(`DELETE FROM remake_state WHERE expires_at < ?`).bind(now).run();

  const replyMarkup = {
    inline_keyboard: [
      [{ text: "✅ Publicar", callback_data: `action_publish:${remakeId}` }],
      [{ text: "🔄 Rehacer", callback_data: `action_remake:${remakeId}` }],
      [{ text: "📝 Editar", callback_data: "action_edit" }],
      [{ text: "🔴 Cancelar", callback_data: "action_cancel" }]
    ]
  };
  formData.append("reply_markup", JSON.stringify(replyMarkup));
  await fetch(url, { method: "POST", body: formData });
}

async function updateProgress(env, chatId, messageId, text) {
  if (!messageId || !chatId) return;
  const msgIdInt = Number.parseInt(messageId, 10);
  if (!Number.isInteger(msgIdInt)) return;

  try {
    const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/editMessageText`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, message_id: msgIdInt, text: text })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.error(`[TELEGRAM_ERROR] Failed to update progress msg: ${res.status} - ${data.description || "Unknown"}`);
    }
  } catch (e) {
    console.error(`[TELEGRAM_ERROR] Network or fetch error updating progress: ${e.message}`);
  }
}

function safeStringify(obj, env) {
  let str = JSON.stringify(obj, null, 2) || "";
  if (env.META_ACCESS_TOKEN) str = str.split(env.META_ACCESS_TOKEN).join("[REDACTED_META_TOKEN]");
  if (env.TELEGRAM_BOT_TOKEN) str = str.split(env.TELEGRAM_BOT_TOKEN).join("[REDACTED_TG_TOKEN]");
  return str;
}

async function publishToMeta(env, caption, imageUrl, stateId, statePayload) {
  if (statePayload && statePayload.publish_status === "PUBLISHED") {
      console.log(`[INSTAGRAM_DIAGNOSTIC] Already published. Media ID: ${statePayload.instagram_media_id}`);
      return statePayload.instagram_media_id;
  }

  let creationId = statePayload ? statePayload.publish_creation_id : null;

  if (!creationId) {
      let safeImageUrl = imageUrl;
      if (env.TELEGRAM_BOT_TOKEN) safeImageUrl = safeImageUrl.split(env.TELEGRAM_BOT_TOKEN).join("[REDACTED_TG_TOKEN]");

      console.log(`[INSTAGRAM_DIAGNOSTIC] Starting publish. Target IG: ${env.INSTAGRAM_ACCOUNT_ID}, ImageUrl: ${safeImageUrl}`);

      const createContainerUrl = `https://graph.facebook.com/v19.0/${env.INSTAGRAM_ACCOUNT_ID}/media`;
      const containerBody = new URLSearchParams({ image_url: imageUrl, caption: caption, access_token: env.META_ACCESS_TOKEN });
      
      console.log("[INSTAGRAM_DIAGNOSTIC] Sending CONTAINER CREATE request...");
      const containerRes = await fetch(createContainerUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: containerBody.toString() });
      const containerData = await containerRes.json();
      
      console.log(`[INSTAGRAM_DIAGNOSTIC] CONTAINER CREATE HTTP Status: ${containerRes.status}`);
      console.log(`[INSTAGRAM_DIAGNOSTIC] CONTAINER CREATE Response: ${safeStringify(containerData, env)}`);
      
      if (containerData.error) {
         const e = containerData.error;
         console.error(`[INSTAGRAM_DIAGNOSTIC] META ERROR in Create: Code=${e.code}, Subcode=${e.error_subcode}, Type=${e.type}, Message="${e.message}", Trace=${e.fbtrace_id}`);
         throw new Error(e.message);
      }
      
      creationId = containerData.id;

      if (stateId && statePayload) {
          statePayload.publish_creation_id = creationId;
          statePayload.publish_status = "PUBLISHING";
          statePayload.publish_attempts = (statePayload.publish_attempts || 0) + 1;
          await env.DB.prepare(`UPDATE remake_state SET payload = ? WHERE id = ?`).bind(JSON.stringify(statePayload), stateId).run();
      }
  } else {
      console.log(`[INSTAGRAM_DIAGNOSTIC] Resuming publish for Creation ID: ${creationId}`);
      if (stateId && statePayload) {
          statePayload.publish_attempts = (statePayload.publish_attempts || 0) + 1;
          await env.DB.prepare(`UPDATE remake_state SET payload = ? WHERE id = ?`).bind(JSON.stringify(statePayload), stateId).run();
      }
  }
  
  // CONTAINER STATUS CHECK
  const statusUrl = `https://graph.facebook.com/v19.0/${creationId}?fields=status_code&access_token=${env.META_ACCESS_TOKEN}`;
  console.log(`[INSTAGRAM_DIAGNOSTIC] Sending CONTAINER STATUS request for ID ${creationId}...`);
  const statusRes = await fetch(statusUrl);
  const statusData = await statusRes.json();
  
  console.log(`[INSTAGRAM_DIAGNOSTIC] CONTAINER STATUS HTTP Status: ${statusRes.status}`);
  console.log(`[INSTAGRAM_DIAGNOSTIC] CONTAINER STATUS Response: ${safeStringify(statusData, env)}`);
  
  if (statusData.error) {
     const e = statusData.error;
     console.error(`[INSTAGRAM_DIAGNOSTIC] META ERROR in Status: Code=${e.code}, Subcode=${e.error_subcode}, Type=${e.type}, Message="${e.message}", Trace=${e.fbtrace_id}`);
  }

  // MEDIA PUBLISH
  const publishUrl = `https://graph.facebook.com/v19.0/${env.INSTAGRAM_ACCOUNT_ID}/media_publish`;
  const publishBody = new URLSearchParams({ creation_id: creationId, access_token: env.META_ACCESS_TOKEN });
  
  console.log(`[INSTAGRAM_DIAGNOSTIC] Sending MEDIA PUBLISH request for Creation ID ${creationId}...`);
  const publishRes = await fetch(publishUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: publishBody.toString() });
  const publishData = await publishRes.json();
  
  console.log(`[INSTAGRAM_DIAGNOSTIC] MEDIA PUBLISH HTTP Status: ${publishRes.status}`);
  console.log(`[INSTAGRAM_DIAGNOSTIC] MEDIA PUBLISH Response: ${safeStringify(publishData, env)}`);
  
  let finalMediaId = publishData.id;

  if (publishData.error) {
     const e = publishData.error;
     console.error(`[INSTAGRAM_DIAGNOSTIC] META ERROR in Publish: Code=${e.code}, Subcode=${e.error_subcode}, Type=${e.type}, Message="${e.message}", Trace=${e.fbtrace_id}`);
     
     if (e.message && (e.message.toLowerCase().includes("already published") || e.message.toLowerCase().includes("has been published"))) {
         console.log(`[INSTAGRAM_DIAGNOSTIC] Recovered from timeout! Meta says it's already published.`);
         finalMediaId = "RECOVERED_MEDIA_ID_" + creationId;
     } else {
         throw new Error(e.message);
     }
  }
  
  console.log(`[INSTAGRAM_DIAGNOSTIC] PUBLISH SUCCESS! Media ID: ${finalMediaId}`);

  if (stateId && statePayload) {
      statePayload.publish_status = "PUBLISHED";
      statePayload.instagram_media_id = finalMediaId;
      statePayload.published_at = Date.now();
      statePayload.last_publish_error = null;
      await env.DB.prepare(`UPDATE remake_state SET payload = ? WHERE id = ?`).bind(JSON.stringify(statePayload), stateId).run();
  }

  return finalMediaId;
}

async function saveToHistory(env, idea) {
  try {
    const id = crypto.randomUUID();
    const date = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO publications (id, date, topicFingerprint, problemFingerprint, solutionFingerprint, benefitFingerprint, visualFingerprint, semanticFingerprint, servicePromoted, hook, cta, content, network) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, date, idea.topicFingerprint || "", idea.problemFingerprint || "", idea.solutionFingerprint || "", idea.benefitFingerprint || "", idea.visualFingerprint || "", idea.semanticFingerprint || "", idea.servicePromoted || "", idea.hook || "", idea.cta || "", "Draft", idea.platform || "Instagram"
    ).run();
  } catch (e) {}
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if ((url.pathname === "/telegram-webhook" || url.pathname.startsWith("/webhook")) && request.method === "POST") {
      try {
        const update = await request.json();
        if (update.callback_query) {
          const { callback_query: cq } = update;
          const [action, stateId] = cq.data.split(":");
          const chatId = cq.message.chat.id;
          let responseText = "Procesando...";
          
          if (action === "action_publish") {
            console.log("[WEBHOOK_DIAGNOSTIC] action_publish triggered", JSON.stringify(cq, null, 2));
            try {
              let platform = "unknown";
              let rawPlatform = null;
              let statePayload = null;
              if (stateId) {
                const stateRow = await env.DB.prepare(`SELECT payload FROM remake_state WHERE id = ?`).bind(stateId).first();
                if (stateRow && stateRow.payload) {
                  statePayload = JSON.parse(stateRow.payload);
                  rawPlatform = statePayload.platform;
                  platform = normalizePlatform(statePayload.platform);
                }
              }

              if (statePayload && statePayload.publish_status === "PUBLISHED") {
                 await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ chat_id: chatId, text: "✅ Esta publicación ya fue publicada en Instagram." })
                 });
                 return new Response("OK");
              }

              if (statePayload && statePayload.publish_status === "PUBLISHING") {
                 await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ chat_id: chatId, text: "⏳ Esta publicación ya se estaba enviando. Verificando estado con Meta..." })
                 });
                 // We let it continue to call publishToMeta, which will resume with the creationId and check status!
              }

              if (platform === "facebook") {
                throw new Error("⚠️ Facebook todavía no está configurado.\n\nNo se realizó ninguna publicación.");
              } else if (platform === "linkedin") {
                throw new Error("⚠️ LinkedIn todavía no está configurado.\n\nNo se realizó ninguna publicación.");
              } else if (platform !== "instagram") {
                console.error(`[WEBHOOK_DIAGNOSTIC] Invalid platform in DB: raw='${rawPlatform}', normalized='${platform}'`);
                throw new Error(`⚠️ Plataforma no reconocida: ${platform}\n\nNo se realizó ninguna publicación.`);
              }

              await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/editMessageReplyMarkup`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: chatId, message_id: cq.message.message_id, reply_markup: { inline_keyboard: [] } })
              });

              const fallbackCaption = cq.message.caption || cq.message.text || "";
              let caption = statePayload ? (statePayload.caption ?? statePayload.post ?? statePayload.copy) : fallbackCaption;
              caption = normalizeCaption(caption);
              if (!caption || typeof caption !== 'string') {
                  caption = normalizeCaption(fallbackCaption);
              }

              let imageUrl = null;
              let r2Key = statePayload ? statePayload.r2Key : null;
              
              if (!r2Key) {
                  throw new Error("No se encontró r2Key en D1. La imagen no está en R2.");
              }
              
              if (!env.MEDIA_SIGNING_SECRET) {
                  throw new Error("Falta MEDIA_SIGNING_SECRET en variables de entorno.");
              }
              
              const expires = Date.now() + 60 * 60 * 1000; // 1 hour
              const signedUrlPath = await signUrl(`/media/${r2Key}`, expires, env.MEDIA_SIGNING_SECRET);
              imageUrl = `https://${new URL(request.url).hostname}${signedUrlPath}`;
              
              await publishToMeta(env, caption, imageUrl, stateId, statePayload);
              
              const objData = await env.BUCKET.get(r2Key);
              if (objData) {
                  await env.BUCKET.put(r2Key, objData.body, {
                      httpMetadata: objData.httpMetadata,
                      customMetadata: { ...objData.customMetadata, status: 'PUBLISHED', published_at: Date.now().toString() }
                  });
              }
              
              await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: chatId, text: "✅ Publicado correctamente en Instagram" })
              });
              responseText = "✅ ¡Post publicado!";
            } catch (err) {
              console.error("[WEBHOOK_DIAGNOSTIC] Error in action_publish:", err.message);
              
              if (stateId) {
                  const stateRow = await env.DB.prepare(`SELECT payload FROM remake_state WHERE id = ?`).bind(stateId).first();
                  if (stateRow && stateRow.payload) {
                      const sp = JSON.parse(stateRow.payload);
                      sp.last_publish_error = err.message;
                      await env.DB.prepare(`UPDATE remake_state SET payload = ? WHERE id = ?`).bind(JSON.stringify(sp), stateId).run();
                  }
              }

              let msgText = "";
              if (err.message.startsWith("⚠️")) {
                msgText = err.message;
                responseText = "⚠️ Cancelado";
              } else {
                let safeReason = "Error desconocido.";
                if (err.message.includes("Token") || err.message.includes("OAuth") || err.message.includes("validate access token")) {
                  safeReason = "Token expirado o inválido.";
                } else if (err.message.includes("Timeout") || err.message.includes("fetch")) {
                  safeReason = "Error de red al contactar la API de Meta.";
                } else if (err.message.includes("foto") || err.message.includes("archivo")) {
                  safeReason = "Error obteniendo la imagen desde Telegram.";
                } else {
                  safeReason = "Meta rechazó la publicación (Revisar logs en Cloudflare).";
                }
                msgText = `❌ No se pudo publicar en Instagram\n\nMotivo:\n${safeReason}\n\nLa publicación NO fue creada.`;
                responseText = "❌ Error al publicar.";
              }
              
              await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: chatId, text: msgText })
              }).catch(e => console.error("[TELEGRAM_ERROR] Failed to send publish error:", e.message));
            }
          }
          else if (action === "action_edit") {
            await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: chatId, text: `✏️ Responde a este mensaje con el NUEVO TEXTO para la publicación [ID:${cq.message.message_id}]`, reply_markup: { force_reply: true, selective: true } })
            });
            responseText = "✏️ Revisa el chat para editar.";
          }
          else if (action === "action_cancel") {
            await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/editMessageReplyMarkup`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: chatId, message_id: cq.message.message_id, reply_markup: { inline_keyboard: [] } })
            });
            await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: chatId, text: "🔴 Cancelado." })
            });
            if (stateId) {
                ctx.waitUntil((async () => {
                    const row = await env.DB.prepare(`SELECT payload FROM remake_state WHERE id = ?`).bind(stateId).first();
                    if (row && row.payload) {
                        const r2Key = JSON.parse(row.payload).r2Key;
                        if (r2Key) {
                           const oldObj = await env.BUCKET.get(r2Key);
                           if (oldObj) {
                               await env.BUCKET.put(r2Key, oldObj.body, {
                                   httpMetadata: oldObj.httpMetadata,
                                   customMetadata: { ...oldObj.customMetadata, status: 'CANCELLED' }
                               });
                           }
                        }
                    }
                })().catch(console.error));
            }
            responseText = "🔴 Cancelado.";
          }
          else if (action === "action_remake") {
            const remakeId = stateId || "";
            const now = Date.now();
            
            await env.DB.prepare(`DELETE FROM remake_state WHERE expires_at < ?`).bind(now).run();
            const { results } = await env.DB.prepare(`SELECT payload FROM remake_state WHERE id = ?`).bind(remakeId).all();
            
            if (results && results.length > 0) {
               const parsedPayload = JSON.parse(results[0].payload);
               if (parsedPayload.r2Key) {
                   ctx.waitUntil((async () => {
                       const oldObj = await env.BUCKET.get(parsedPayload.r2Key);
                       if (oldObj) {
                           await env.BUCKET.put(parsedPayload.r2Key, oldObj.body, {
                               httpMetadata: oldObj.httpMetadata,
                               customMetadata: { ...oldObj.customMetadata, status: 'REPLACED' }
                           });
                       }
                   })().catch(console.error));
               }
            }
            
            if (!results || results.length === 0) {
              responseText = "⚠️ Esta solicitud de rehacer expiró. Genera una nueva vista previa.";
              await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: chatId, text: responseText })
              });
              await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callback_query_id: cq.id, text: responseText }) });
              return new Response("OK");
            }
            
            const payload = JSON.parse(results[0].payload);
            const instruct = `REHACER LA PUBLICACIÓN.

No repitas el hook anterior:
"${payload.hook}"

No repitas el concepto visual anterior:
"${payload.visualFingerprint}"

Cambia sustancialmente:
- hook
- angle
- visual concept

Mantén:
- tema: ${payload.topic}
- servicio: ${payload.service}
- plataforma: ${payload.platform}`;

            responseText = "🔄 Regenerando...";
            const sendRes = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: chatId, text: "⏳ [1/4] Iniciando regeneración con REHACER (evitando ideas previas)..." })
            });
            const sendData = await sendRes.json();
            const progressMessageId = sendData.ok ? sendData.result.message_id : null;
            
            ctx.waitUntil(fetch(`${url.origin}/test-full-post?seed=${encodeURIComponent(instruct)}&progressMessageId=${progressMessageId}&requestId=remake_${stateId}_${now}&source=REMAKE&reason=USER_APPROVED_REMAKE&stateId=${stateId}`).catch(e => console.error(e)));
          }
          
          await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callback_query_id: cq.id, text: responseText }) });
        }
        
        if (update.message) {
          const message = update.message;
          const chatId = message.chat.id;
          if (chatId.toString() === env.TELEGRAM_CHAT_ID) {
            if (message.reply_to_message && message.reply_to_message.text && message.reply_to_message.text.includes("[ID:")) {
              const match = message.reply_to_message.text.match(/\[ID:(\d+)\]/);
              if (match) {
                 const originalMessageId = match[1];
                 const newCaption = message.text;
                 await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/editMessageCaption`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ 
                       chat_id: chatId, message_id: originalMessageId, caption: newCaption,
                       reply_markup: { inline_keyboard: [ [{ text: "✅ Publicar", callback_data: "action_publish" }], [{ text: "🔴 Cancelar", callback_data: "action_cancel" }] ] }
                    })
                 });
                 return new Response("OK", { status: 200 });
              }
            }
            let seed = message.text;
            let hasPhoto = false;
            let photoFileId = null;
            let wantsEnhancement = false;
            
            if (seed) {
              const sendRes = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: chatId, text: "⏳ [1/4] Analizando tu idea..." })
              });
              const sendData = await sendRes.json();
              const progressMessageId = sendData.ok ? sendData.result.message_id : null;
              ctx.waitUntil(fetch(`${url.origin}/test-full-post?seed=${encodeURIComponent(seed)}&chatId=${chatId}&progressMessageId=${progressMessageId}&requestId=tg_${message.message_id}&source=TELEGRAM_TEXT&reason=INITIAL_GENERATION`).catch(e => console.error(e)));
            }
          }
        }
        return new Response("OK", { status: 200 });
      } catch (e) { return new Response("Error", { status: 500 }); }
    }
    
    if (url.pathname.startsWith("/media/")) {
      const key = url.pathname.replace("/media/", "");
      if (!env.MEDIA_SIGNING_SECRET) return new Response("Falta secreto", { status: 500 });
      const isValid = await verifyUrl(url, env.MEDIA_SIGNING_SECRET);
      if (!isValid) return new Response("Forbidden o expirado", { status: 403 });
      
      const object = await env.BUCKET.get(key);
      if (!object) return new Response("No encontrado", { status: 404 });
      
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("etag", object.httpEtag);
      return new Response(object.body, { headers });
    }

    if (url.pathname === "/test-full-post") {
      const progressMessageId = url.searchParams.get("progressMessageId") || null;
      const chatId = url.searchParams.get("chatId") || env.TELEGRAM_CHAT_ID;
      const seed = url.searchParams.get("seed") || null;
      const hasPhoto = url.searchParams.get("hasPhoto") === "true";
      const photoFileId = url.searchParams.get("photoFileId") || null;
      const enhanceImage = url.searchParams.get("enhanceImage") === "true";
      
      env.FORCE_GEMINI_FAIL = url.searchParams.get("forceGeminiFail") === "true" ? "true" : "false";
      env.FORCE_QUALITY_GATE_FAIL = url.searchParams.get("forceQGFail") === "true" ? "true" : "false";
      
      const requestCtx = {
          requestId: url.searchParams.get("requestId") || "test_" + crypto.randomUUID(),
          source: url.searchParams.get("source") || "TEST",
          reason: url.searchParams.get("reason") || "INITIAL_GENERATION",
          stateId: url.searchParams.get("stateId") || ""
      };
      
      const result = await runFullPostGeneration(env, chatId, seed, hasPhoto, photoFileId, enhanceImage, progressMessageId, requestCtx);
      if (result.status === "Error") return new Response("Error: " + result.message, { status: 500 });
      return Response.json(result.finalPost);
    }
    return new Response("Bot Activo");
  },
  
  async scheduled(event, env, ctx) {
    try {
        const listed = await env.BUCKET.list({ include: ["customMetadata"] });
        const now = Date.now();
        const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
        const ONE_DAY = 1 * 24 * 60 * 60 * 1000;
        
        for (const obj of listed.objects) {
            const meta = obj.customMetadata || {};
            const status = meta.status;
            const creationDate = parseInt(meta.date || "0", 10);
            const publishedAt = parseInt(meta.published_at || "0", 10);
            
            let shouldDelete = false;
            
            if (status === 'PUBLISHED' && publishedAt > 0 && (now - publishedAt > SEVEN_DAYS)) {
                shouldDelete = true;
            } else if ((status === 'CANCELLED' || status === 'REPLACED') && (now - creationDate > ONE_DAY)) {
                shouldDelete = true;
            } else if (status === 'PENDING_APPROVAL' && (now - creationDate > SEVEN_DAYS)) {
                shouldDelete = true;
            }
            
            if (shouldDelete) {
                console.log(`[R2_CLEANUP] Eliminando objeto expirado: ${obj.key} (Status: ${status})`);
                await env.BUCKET.delete(obj.key);
            }
        }
    } catch (e) {
        console.error("[R2_CLEANUP] Error ejecutando limpieza: ", e);
    }

    const chatId = env.TELEGRAM_CHAT_ID;
    const seed = "Genera un post sobre diseño web, SEO o marketing automatizado para Canedo Studio. Selecciona aleatoriamente una de las 3 plataformas."; 
    try {
      const sendRes = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: "⏰ ¡Buenos días! Preparando publicación..." })
      });
      const data = await sendRes.json();
      const requestCtx = { requestId: "auto_" + Date.now(), source: "AUTO", reason: "INITIAL_GENERATION" };
      await runFullPostGeneration(env, chatId, seed, false, null, false, data.result ? data.result.message_id : null, requestCtx);
    } catch (e) {}
  }
};

async function compositeImage(baseBuffer, visualHookText) {
  try {
    await initCompositor();
  } catch (e) {
    console.error(`[ERROR] Etapa: SATORI_INIT - ${e.message}`);
    throw e;
  }
  
  let base64Image;
  try {
    base64Image = Buffer.from(baseBuffer).toString('base64');
  } catch (e) {
    console.error(`[ERROR] Etapa: BASE64 - ${e.message}`);
    throw new Error(`Fallo convirtiendo a Base64: ${e.message}`);
  }
  
  const dataUri = `data:image/jpeg;base64,${base64Image}`;
  
  const html = {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        position: 'relative',
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px',
      },
      children: [
        {
          type: 'img',
          props: {
            src: dataUri,
            width: "1080",
            height: "1350",
            style: {
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }
          }
        },
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0) 35%, rgba(0,0,0,0) 65%, rgba(0,0,0,0.85) 100%)',
            }
          }
        },
        {
          type: 'h1',
          props: {
            style: {
              color: 'white',
              fontSize: 70,
              fontWeight: 700,
              fontFamily: 'Roboto',
              textAlign: 'center',
              textShadow: '0px 4px 16px rgba(0,0,0,1)',
              marginTop: 'auto',
              marginBottom: '60px',
              maxWidth: '90%',
              position: 'relative'
            },
            children: visualHookText
          }
        }
      ]
    }
  };

  try {
    const svg = await satori(html, {
      width: 1080,
      height: 1350,
      fonts: [
        {
          name: 'Roboto',
          data: fontRoboto,
          weight: 700,
          style: 'normal',
        },
      ],
    });

    const resvg = new Resvg(svg, {
      background: 'transparent',
    });
    return resvg.render().asPng().buffer;
  } catch (e) {
    console.error(`[ERROR] Etapa: SATORI/RESVG - ${e.message}`);
    throw e;
  }
}

async function runFullPostGeneration(env, chatId, seed, hasPhoto, photoFileId, enhanceImage, progressMessageId, requestCtx) {
  let requestStateId = "N/A";
  if (!requestCtx || !requestCtx.requestId) {
     requestCtx = { requestId: "req_" + crypto.randomUUID(), source: "AUTO", reason: "INITIAL_GENERATION" };
  }
  try {
    await updateProgress(env, chatId, progressMessageId, "⏳ [2/4] Generando textos persuasivos, validando marca y Quality Gate...");
    
    let history;
    try {
      history = await getHistory(env);
    } catch (e) {
      console.error(`[ERROR] Etapa: QUALITY_GATE (History) - ${e.message}`);
      throw e;
    }

    // Force strict 8 words instruction in prompt dynamically or trust the system prompt
    const enhancedSeed = seed + " IMPORTANTE: El visual_hook DEBE tener MÁXIMO 8 palabras, sin excepción.";
    
    let result;
    try {
      result = await generateAndValidateIdeaAndCopy(env, history, enhancedSeed, hasPhoto);
    } catch (e) {
      console.error(`[ERROR] Etapa: GEMINI - ${e.message}`);
      await updateProgress(env, chatId, progressMessageId, `⚠️ Generación de texto fallida: ${e.message}`);
      return { status: "Error", message: e.message };
    }
    
    if (!result.success) {
      console.error(`[ERROR] Etapa: QUALITY_GATE - ${result.error}`);
      await updateProgress(env, chatId, progressMessageId, `⚠️ Proceso abortado: ${result.error}`);
      return { status: "Error", message: result.error };
    }
    
    // Caption Validation & Normalization
    const cleanedCaption = normalizeCaption(result.caption);
    if (!cleanedCaption || cleanedCaption.length < 5) {
        const err = "El caption generado está vacío o es inválido.";
        console.error(`[ERROR] Etapa: CAPTION_VALIDATION - ${err}`);
        await updateProgress(env, chatId, progressMessageId, `⚠️ Proceso abortado: ${err}`);
        return { status: "Error", message: err };
    }
    result.caption = cleanedCaption;
    
    try {
      await saveToHistory(env, result.fingerprint);
    } catch (e) {
      console.error(`[ERROR] Etapa: DB_SAVE - ${e.message}`);
    }
    
    let finalPost = {
      Status: "Éxito",
      Plataforma: result.fingerprint.platform || "INSTAGRAM",
      Texto: result.caption,
      ADN: result.fingerprint
    };
    
    let mediaBytes = null;
    let mediaType = "photo";
    const wantsVideo = seed && seed.toLowerCase().includes("video");
    
    await updateProgress(env, chatId, progressMessageId, "⏳ [3/4] Procesando material visual (IA Generativa en proceso)...");

    let visualHook = result.fingerprint.visual_hook || "";
    let words = visualHook.trim().split(/\s+/);
    if (words.length > 8) {
      console.warn(`[WARNING] Etapa: VISUAL_HOOK - Hook excedió 8 palabras (${words.length}). Reduciendo de forma segura.`);
      visualHook = words.slice(0, 8).join(" ");
      // Add ellipsis just in case the meaning got cut, but normally 8 words is enough
    }
    
    let r2Key = null;
    let qualityResult = null;
    try {
      if (wantsVideo && env.OPENROUTER_API_KEY) {
        try {
          mediaBytes = await generateVideoOpenRouter(env, result.fingerprint.visualFingerprint, seed);
          mediaType = "video";
        } catch (error) {
          const imgGen = await generateImage(env, result.fingerprint, requestCtx);
          if (imgGen.r2Key) {
            r2Key = imgGen.r2Key;
            const existingObj = await env.BUCKET.get(r2Key);
            mediaBytes = await existingObj.arrayBuffer();
            qualityResult = { is_approved: true, reason: "Idempotency Reuse" };
          } else {
            mediaBytes = imgGen.buffer;
            mediaType = "photo";
          }
        }
      } else {
        const imgGen = await generateImage(env, result.fingerprint, requestCtx);
        
        if (imgGen.r2Key) {
            r2Key = imgGen.r2Key;
            const existingObj = await env.BUCKET.get(r2Key);
            mediaBytes = await existingObj.arrayBuffer();
            qualityResult = { is_approved: true, reason: "Idempotency Reuse" };
        } else {
            mediaBytes = imgGen.buffer;
            
            // Quality Gate Visual
            await updateProgress(env, chatId, progressMessageId, "⏳ [4/5] Ejecutando Quality Gate Visual (Gemini)...");
            qualityResult = await verifyVisualQualityGate(env, imgGen.base64, imgGen.contentType, result.fingerprint);
        // Fallback for tests if api fails
        if (qualityResult === true || qualityResult === false) {
           qualityResult = { is_approved: qualityResult, reason: "N/A" };
        }

            const genId = imgGen.generationId || crypto.randomUUID();
            r2Key = `img_${genId}${imgGen.ext}`;
            await env.BUCKET.put(r2Key, mediaBytes, {
               httpMetadata: { contentType: imgGen.contentType },
               customMetadata: { status: 'PENDING_APPROVAL', date: Date.now().toString(), model: 'nano-banana-2-native' }
            });
        }
      }
    } catch (e) {
      console.error(`[ERROR] Etapa: NANO_BANANA_2/R2 - ${e.message}`);
      throw new Error(`Error en Generación de Imagen o R2: ${e.message}`);
    }
    
    if (qualityResult && !qualityResult.is_approved) {
        const detail = `⚠️ Imagen rechazada por calidad visual
Motivo: ${qualityResult.reason || 'No superó métricas 5-Second Test'}
Business: ${qualityResult.business_understanding || 0}/10 | Service: ${qualityResult.service_clarity || 0}/10
Benefit: ${qualityResult.benefit_clarity || 0}/10 | CTA: ${qualityResult.cta_clarity || 0}/10
Overall: ${qualityResult.overall_score || 0}/10 | 5s-Pass: ${qualityResult.five_second_pass ? 'YES' : 'NO'}`;
        finalPost.Texto = detail + "\n\n" + finalPost.Texto;
    }
    
    // Attach to ADN so we can inspect it in curl response
    if (qualityResult) {
        finalPost.ADN.quality_metrics = qualityResult;
    }

    await updateProgress(env, chatId, progressMessageId, "✅ [5/5] ¡Enviando resultados!");
    
    try {
      await sendToTelegram(env, finalPost, mediaBytes, mediaType, seed, r2Key);
    } catch (e) {
      console.error(`[ERROR] Etapa: TELEGRAM - ${e.message}`);
      throw new Error(`Error enviando a Telegram: ${e.message}`);
    }
    
    return { status: "OK", finalPost };
  } catch (e) {
    let stage = "GEMINI / QUALITY GATE";
    if (e.message.includes("FLUX")) stage = "FLUX";
    else if (e.message.includes("compositor")) stage = "COMPOSITOR";
    else if (e.message.includes("Telegram")) stage = "TELEGRAM";
    
    let safeReason = "Error desconocido.";
    if (e.message.includes("API_KEY") || e.message.includes("Token")) safeReason = "Fallo de autenticación en servicio externo.";
    else if (e.message.includes("Timeout")) safeReason = "Tiempo de espera agotado al generar.";
    else safeReason = e.message.substring(0, 100); // Only first 100 chars to avoid spilling huge base64 or secrets
    
    let msg = `❌ No se pudo generar la publicación\nEtapa: ${stage}\nMotivo: ${safeReason}\n\nID: ${requestStateId}`;
    await updateProgress(env, chatId, progressMessageId, msg);
    return { status: "Error", message: e.message };
  }
}

function normalizePlatform(value) {
  if (!value) return "unknown";
  return String(value).trim().toLowerCase();
}

function normalizeCaption(rawCaption) {
  if (!rawCaption) return "";
  
  if (typeof rawCaption !== 'string') {
    if (rawCaption.post) return normalizeCaption(rawCaption.post);
    if (rawCaption.caption) return normalizeCaption(rawCaption.caption);
    if (rawCaption.copy) return normalizeCaption(rawCaption.copy);
    if (rawCaption.description) return normalizeCaption(rawCaption.description);
    if (rawCaption.Texto) return normalizeCaption(rawCaption.Texto);
    return "";
  }
  
  let text = rawCaption.trim();
  
  // Remove markdown json wrappers
  text = text.replace(/^```(json)?\s*/i, '').replace(/\s*```$/i, '');
  text = text.trim();
  
  // If it starts with { and ends with }, parse it
  if (text.startsWith('{') && text.endsWith('}')) {
      try {
          const parsed = JSON.parse(text);
          return normalizeCaption(parsed);
      } catch(e) {}
  }
  
  // Remove technical labels
  text = text.replace(/^Plataforma:\s*INSTAGRAM\n*/i, '');
  text = text.replace(/^Platform:\s*Instagram\n*/i, '');
  text = text.replace(/^(caption|post|description|copy|texto):\s*/i, '');
  
  text = text.trim();
  
  // Remove wrapping quotes
  if (text.startsWith('"') && text.endsWith('"') && text.length > 1) {
      text = text.substring(1, text.length - 1);
      text = text.replace(/\\n/g, '\n');
      text = text.replace(/\\"/g, '"');
  }
  
  return text.trim();
}
