// File: automatismos/canedo-admin/src/modules/research/web_extractor.js
/**
 * Módulo de Extracción Web Resiliente y Seguro para Canedo Studio (Fase E1)
 * Diseñado para entornos Cloudflare Workers y Node.js.
 * 
 * Capacidades:
 * 1. Validación estricta anti-SSRF y filtrado conservador de URLs HTTPS.
 * 2. Descarga controlada de streams (timeouts, límites de bytes, tipos MIME).
 * 3. Parser semántico que prioriza etiquetas de contenido (<article>, <main>, <p>, <h1>-<h3>)
 *    y elimina scripts, estilos, formularios, navs y footers.
 * 4. Extracción de metadatos (OpenGraph, Schema.org, canonical, autor, fecha).
 * 5. Sanitización contra prompt injection y formato estructurado no ejecutable.
 */

// Prefijos y rangos reservados/privados conocidos (IPv4 e IPv6)
const PRIVATE_IP_PATTERNS = [
  /^127\./,                         // Loopback IPv4
  /^10\./,                          // RFC1918 clase A
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // RFC1918 clase B
  /^192\.168\./,                    // RFC1918 clase C
  /^169\.254\./,                    // Link-local / AWS & Cloudflare Metadata
  /^0\./,                           // Red actual
  /^224\./,                         // Multicast
  /^240\./,                         // Reservado clase E
  /^::1$/,                          // Loopback IPv6
  /^fc00:/i,                        // Unique Local Address IPv6
  /^fd[0-9a-f]{2}:/i,               // Unique Local Address IPv6
  /^fe80:/i                         // Link-local IPv6
];

// Nombres de host prohibidos
const FORBIDDEN_HOSTNAMES = [
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "169.254.169.254",
  "metadata",
  "internal"
];

// Opciones predeterminadas
export const DEFAULT_EXTRACTOR_OPTIONS = {
  maxRedirects: 3,
  timeoutMs: 7000,
  maxBytesDownload: 1024 * 512, // 512 KB máx de respuesta bruta
  maxTextLength: 15000,        // 15 KB máx de texto limpio extraído
  userAgent: "Mozilla/5.0 (compatible; CanedoStudioResearchBot/1.0; +https://canedostudio.com)"
};

/**
 * Valida minuciosamente una URL contra ataques SSRF, protocolos no permitidos,
 * credenciales incrustadas e IPs privadas.
 * 
 * @param {string} rawUrl - URL a inspeccionar
 * @returns {{ valid: boolean, url?: URL, error?: string }}
 */
export function validateUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") {
    return { valid: false, error: "URL no proporcionada o de tipo no válido" };
  }

  let parsed;
  try {
    parsed = new URL(rawUrl.trim());
  } catch (e) {
    return { valid: false, error: "Formato de URL inválido" };
  }

  // 1. Exclusivamente HTTPS
  if (parsed.protocol !== "https:") {
    return { valid: false, error: "Protocolo no seguro. Solo se admite HTTPS" };
  }

  // 2. Rechazar credenciales incrustadas (user:password@host)
  if (parsed.username || parsed.password) {
    return { valid: false, error: "URLs con credenciales incrustadas están prohibidas" };
  }

  const hostname = parsed.hostname.toLowerCase();

  // 3. Bloqueo de nombres de host locales o de metadatos
  if (FORBIDDEN_HOSTNAMES.includes(hostname) || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    return { valid: false, error: `Acceso denegado a host reservado o local: ${hostname}` };
  }

  // 4. Bloqueo de representaciones IP privadas (IPv4 e IPv6)
  const isIpv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);
  const isIpv6 = /^\[?[0-9a-f:]+\]?$/i.test(hostname) && hostname.includes(":");

  if (isIpv4 || isIpv6) {
    const rawIp = hostname.replace(/^\[|\]$/g, "");
    for (const pattern of PRIVATE_IP_PATTERNS) {
      if (pattern.test(rawIp)) {
        return { valid: false, error: `Acceso denegado a dirección IP privada o reservada: ${hostname}` };
      }
    }
  }

  // 5. Bloqueo de representaciones numéricas no estándar (hexadecimal u octal)
  if (/^0x[0-9a-f]+$/i.test(hostname) || /^\d+$/.test(hostname)) {
    return { valid: false, error: "Representaciones numéricas alternativas de IP están prohibidas" };
  }

  return { valid: true, url: parsed };
}

/**
 * Sanitiza texto proveniente de fuentes web para neutralizar intentos de prompt injection.
 * 
 * @param {string} text - Texto en bruto
 * @param {number} maxLength - Longitud máxima permitida
 * @returns {string} Texto neutralizado
 */
export function sanitizeText(text, maxLength = DEFAULT_EXTRACTOR_OPTIONS.maxTextLength) {
  if (!text || typeof text !== "string") return "";
  let clean = text.trim();
  if (clean.length > maxLength) {
    clean = clean.slice(0, maxLength);
  }
  // Neutralizar delimitadores markdown y etiquetas pseudoinstructivas
  clean = clean.replace(/```/g, "'''");
  clean = clean.replace(/<\/?(?:system|instruction|prompt|assistant|human)[^>]*>/gi, "");
  // Normalizar saltos de línea repetidos
  clean = clean.replace(/\n{3,}/g, "\n\n");
  return clean;
}

/**
 * Extrae metadatos y contenido semántico del HTML.
 * Funciona de manera universal (con regex / parser semántico sin dependencias externas nativas)
 * compatible con Cloudflare Workers.
 * 
 * @param {string} html - Código HTML en bruto
 * @returns {object} Datos semánticos extraídos
 */
export function parseHtmlContent(html) {
  if (!html || typeof html !== "string") {
    return {
      title: "",
      description: "",
      author: "",
      publishedTime: null,
      canonicalUrl: "",
      siteName: "",
      headings: [],
      paragraphs: [],
      cleanText: ""
    };
  }

  // 1. Extraer Metadatos
  // Buscar <title> cerrado o abierto hasta el siguiente tag o fin de documento
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)(?:<\/title>|<|$)/i);
  let title = titleMatch ? titleMatch[1].trim() : "";
  title = title.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

  const metaOgTitle = html.match(/<meta\s+property=["']og:title["']\s+content=["']([\s\S]*?)["']/i) ||
                      html.match(/<meta\s+content=["']([\s\S]*?)["']\s+property=["']og:title["']/i);
  if (metaOgTitle && metaOgTitle[1]) {
    title = metaOgTitle[1].trim();
  }

  // Descripción
  const metaDesc = html.match(/<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']/i) ||
                   html.match(/<meta\s+content=["']([\s\S]*?)["']\s+name=["']description["']/i) ||
                   html.match(/<meta\s+property=["']og:description["']\s+content=["']([\s\S]*?)["']/i);
  const description = metaDesc ? metaDesc[1].trim() : "";

  // Autor
  const metaAuthor = html.match(/<meta\s+name=["']author["']\s+content=["']([\s\S]*?)["']/i) ||
                     html.match(/<meta\s+property=["']article:author["']\s+content=["']([\s\S]*?)["']/i);
  const author = metaAuthor ? metaAuthor[1].trim() : "";

  // Fecha de publicación
  const metaDate = html.match(/<meta\s+property=["']article:published_time["']\s+content=["']([\s\S]*?)["']/i) ||
                    html.match(/<meta\s+name=["']date["']\s+content=["']([\s\S]*?)["']/i) ||
                    html.match(/<time[^>]+datetime=["']([\s\S]*?)["']/i);
  const publishedTime = metaDate ? metaDate[1].trim() : null;

  // URL Canónica
  const metaCanonical = html.match(/<link\s+rel=["']canonical["']\s+href=["']([\s\S]*?)["']/i) ||
                        html.match(/<meta\s+property=["']og:url["']\s+content=["']([\s\S]*?)["']/i);
  const canonicalUrl = metaCanonical ? metaCanonical[1].trim() : "";

  // Nombre del sitio
  const metaSiteName = html.match(/<meta\s+property=["']og:site_name["']\s+content=["']([\s\S]*?)["']/i);
  const siteName = metaSiteName ? metaSiteName[1].trim() : "";

  // 2. Limpieza de Ruido (Scripts, Estilos, Formularios, Menús, SVG, Footers)
  let cleaned = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, "")
    .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, "")
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, "")
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, "")
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, "")
    .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, "");

  // 3. Aislar contenido principal si existe <article> o <main>
  const articleMatch = cleaned.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i) ||
                       cleaned.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  if (articleMatch && articleMatch[1].length > 200) {
    cleaned = articleMatch[1];
  }

  // 4. Extraer Encabezados (H1, H2, H3)
  const headings = [];
  const headingMatches = cleaned.matchAll(/<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi);
  for (const match of headingMatches) {
    const text = match[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (text.length > 3) {
      headings.push({ level: parseInt(match[1], 10), text });
    }
  }

  // 5. Extraer Párrafos significativos
  const paragraphs = [];
  const pMatches = cleaned.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi);
  const seenParagraphs = new Set();

  for (const match of pMatches) {
    let pText = match[1].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
    // Decodificar entidades comunes
    pText = pText.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    
    // Filtrar párrafos vacíos, repetidos o muy cortos (menores a 30 caracteres)
    if (pText.length >= 30 && !seenParagraphs.has(pText)) {
      seenParagraphs.add(pText);
      paragraphs.push(pText);
    }
  }

  // 6. Si no hubo etiquetas <p>, extraer texto plano residual
  let cleanText = "";
  if (paragraphs.length > 0) {
    cleanText = paragraphs.join("\n\n");
  } else {
    cleanText = cleaned.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  cleanText = sanitizeText(cleanText);

  return {
    title,
    description,
    author,
    publishedTime,
    canonicalUrl,
    siteName,
    headings,
    paragraphs,
    cleanText
  };
}

/**
 * Función principal para extraer contenido de una URL web pública con control
 * de redirecciones seguras, timeouts y límites de tamaño.
 * 
 * @param {string} targetUrl - URL a descargar
 * @param {object} [options] - Opciones de configuración
 * @param {Function} [fetchFn] - Inyección de fetch (útil para pruebas y entornos)
 * @returns {Promise<{ ok: boolean, data?: object, error?: string, warnings?: string[] }>}
 */
export async function extractWebContent(targetUrl, options = {}, fetchFn = globalThis.fetch) {
  const config = { ...DEFAULT_EXTRACTOR_OPTIONS, ...options };
  const warnings = [];

  // 1. Validar URL inicial
  const validation = validateUrl(targetUrl);
  if (!validation.valid) {
    return { ok: false, error: validation.error };
  }

  let currentUrl = validation.url.toString();
  let redirectsCount = 0;
  let response = null;

  // 2. Bucle de redirecciones con control manual y validación anti-SSRF
  while (redirectsCount <= config.maxRedirects) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      response = await fetchFn(currentUrl, {
        method: "GET",
        headers: {
          "User-Agent": config.userAgent,
          "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8"
        },
        redirect: "manual", // Inspección explícita de redirecciones
        signal: controller.signal
      });
    } catch (e) {
      clearTimeout(timeout);
      if (e.name === "AbortError" || String(e).includes("abort")) {
        return { ok: false, error: `Tiempo de espera agotado al consultar ${currentUrl} (límite: ${config.timeoutMs}ms)` };
      }
      return { ok: false, error: `Error de red al consultar ${currentUrl}: ${e.message || String(e)}` };
    } finally {
      clearTimeout(timeout);
    }

    // Comprobar redirecciones HTTP (301, 302, 303, 307, 308)
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) {
        return { ok: false, error: `Respuesta de redirección (${response.status}) sin cabecera Location` };
      }

      redirectsCount++;
      if (redirectsCount > config.maxRedirects) {
        return { ok: false, error: `Límite máximo de redirecciones superado (${config.maxRedirects})` };
      }

      let nextUrl;
      try {
        nextUrl = new URL(location, currentUrl).toString();
      } catch (e) {
        return { ok: false, error: `Cabecera Location con URL inválida: ${location}` };
      }

      // Validar estrictamente la URL de destino de la redirección
      const nextValidation = validateUrl(nextUrl);
      if (!nextValidation.valid) {
        return { ok: false, error: `Redirección bloqueada por seguridad hacia: ${nextUrl} (${nextValidation.error})` };
      }

      currentUrl = nextValidation.url.toString();
      continue;
    }

    break;
  }

  // 3. Validar código de respuesta HTTP
  if (!response.ok) {
    return { ok: false, error: `El servidor devolvió HTTP ${response.status} (${response.statusText || "Error"})` };
  }

  // 4. Validar Content-Type
  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
    return { ok: false, error: `Tipo de contenido no soportado: ${contentType || "Desconocido"}. Solo se admite HTML` };
  }

  // 5. Descarga con control estricto de bytes mediante Stream
  let html = "";
  try {
    if (response.body && typeof response.body.getReader === "function") {
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8", { fatal: false });
      let totalBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        totalBytes += value.length;
        if (totalBytes > config.maxBytesDownload) {
          await reader.cancel();
          return { ok: false, error: `El archivo supera el tamaño máximo de descarga (${config.maxBytesDownload} bytes)` };
        }

        html += decoder.decode(value, { stream: true });
      }
      html += decoder.decode();
    } else {
      // Fallback para entornos donde response.text() es estándar o en mocks
      const rawText = await response.text();
      if (rawText.length > config.maxBytesDownload) {
        return { ok: false, error: `El archivo supera el tamaño máximo permitido (${config.maxBytesDownload} bytes)` };
      }
      html = rawText;
    }
  } catch (e) {
    return { ok: false, error: `Error al leer el cuerpo de la respuesta: ${e.message || String(e)}` };
  }

  // 6. Extracción semántica
  const parsed = parseHtmlContent(html);

  if (!parsed.cleanText || parsed.cleanText.length < 50) {
    warnings.push("El documento contiene muy poco texto de contenido principal.");
  }

  return {
    ok: true,
    data: {
      originalUrl: targetUrl,
      finalUrl: currentUrl,
      redirectsCount,
      title: parsed.title,
      description: parsed.description,
      author: parsed.author,
      publishedTime: parsed.publishedTime,
      canonicalUrl: parsed.canonicalUrl || currentUrl,
      siteName: parsed.siteName,
      headings: parsed.headings,
      paragraphsCount: parsed.paragraphs.length,
      cleanText: parsed.cleanText,
      extractedAt: new Date().toISOString()
    },
    warnings
  };
}
