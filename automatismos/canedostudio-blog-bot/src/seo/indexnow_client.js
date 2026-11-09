/**
 * Cliente Oficial IndexNow para Canedo Studio
 * Protocolo abierto de indexación instantánea para Bing, Yandex y motores compatibles.
 * Especificación: https://www.indexnow.org/documentation
 */

export const INDEXNOW_HOST = "canedostudio.com";
export const INDEXNOW_KEY = "480467a2484636e441e4bd42011e7011";
export const INDEXNOW_KEY_LOCATION = `https://${INDEXNOW_HOST}/${INDEXNOW_KEY}.txt`;
export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

/**
 * Valida si una URL pertenece al dominio canónico autorizado y usa HTTPS.
 */
export function isValidIndexNowUrl(urlStr, expectedHost = INDEXNOW_HOST) {
  try {
    const parsed = new URL(urlStr);
    return parsed.protocol === "https:" && (parsed.hostname === expectedHost || parsed.hostname === `www.${expectedHost}`);
  } catch (e) {
    return false;
  }
}

/**
 * Construye la URL canónica de un artículo a partir de su slug.
 */
export function buildArticleCanonicalUrl(slug, host = INDEXNOW_HOST) {
  if (!slug || typeof slug !== "string") return null;
  const cleanSlug = slug.trim().replace(/^\/+|\/+$/g, "");
  if (!cleanSlug) return null;
  return `https://${host}/insights/${encodeURIComponent(cleanSlug)}`;
}

/**
 * Normaliza y valida una lista de URLs a notificar, deduplicando y filtrando.
 */
export function prepareUrlList(urls, expectedHost = INDEXNOW_HOST) {
  if (!urls) return [];
  const list = Array.isArray(urls) ? urls : [urls];
  const seen = new Set();
  const validUrls = [];

  for (const u of list) {
    if (typeof u !== "string") continue;
    const trimmed = u.trim();
    if (isValidIndexNowUrl(trimmed, expectedHost) && !seen.has(trimmed)) {
      seen.add(trimmed);
      validUrls.push(trimmed);
    }
  }

  return validUrls;
}

/**
 * Construye el payload oficial de IndexNow.
 */
export function buildIndexNowPayload({
  host = INDEXNOW_HOST,
  key = INDEXNOW_KEY,
  keyLocation = INDEXNOW_KEY_LOCATION,
  urlList = []
}) {
  return {
    host,
    key,
    keyLocation,
    urlList
  };
}

/**
 * Comprueba la disponibilidad pública real de una URL antes de notificarla a IndexNow.
 * Verifica:
 * - Código HTTP 200 OK.
 * - Ausencia de cabecera 'x-robots-tag' o meta con noindex.
 * - Canonical autorreferencial coincidente.
 * Tiene un timeout estricto de seguridad para no demorar la ejecución.
 */
export async function checkUrlPublicAvailability(urlStr, options = {}) {
  const {
    fetchFn = globalThis.fetch,
    timeoutMs = 4000,
    expectedHost = INDEXNOW_HOST
  } = options;

  if (!isValidIndexNowUrl(urlStr, expectedHost)) {
    return { available: false, reason: "invalid_url_host" };
  }

  try {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

    const res = await fetchFn(urlStr, {
      method: "GET",
      headers: {
        "User-Agent": "CanedoStudio-AvailabilityCheck/1.0",
        "Accept": "text/html"
      },
      signal: controller ? controller.signal : undefined
    });

    if (timer) clearTimeout(timer);

    if (res.status !== 200) {
      return { available: false, status: res.status, reason: `http_${res.status}` };
    }

    // Comprobar cabecera X-Robots-Tag
    const xRobots = res.headers && typeof res.headers.get === "function" ? res.headers.get("x-robots-tag") : null;
    if (xRobots && /noindex/i.test(xRobots)) {
      return { available: false, status: 200, reason: "header_noindex" };
    }

    // Inspeccionar HTML devuelto
    const html = await res.text();
    if (/content=["'][^"']*noindex[^"']*["']/i.test(html)) {
      return { available: false, status: 200, reason: "meta_noindex" };
    }

    // Verificar canonical básico si está presente
    const canonicalMatch = html.match(/<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
    if (canonicalMatch && canonicalMatch[1]) {
      const canonicalVal = canonicalMatch[1].trim();
      const parsedUrl = new URL(urlStr);
      const parsedCanonical = new URL(canonicalVal);
      if (parsedUrl.pathname !== parsedCanonical.pathname) {
        return { available: false, status: 200, reason: "canonical_mismatch", canonical: canonicalVal };
      }
    }

    return { available: true, status: 200 };
  } catch (err) {
    return {
      available: false,
      reason: err.name === "AbortError" ? "timeout" : "network_error",
      error: err.message
    };
  }
}

/**
 * Envía la notificación IndexNow con reintentos controlados y tolerancia a fallos.
 * Cumple con no lanzar excepciones que interrumpan el proceso principal.
 */
export async function notifyIndexNow(urls, options = {}) {
  const {
    host = INDEXNOW_HOST,
    key = INDEXNOW_KEY,
    keyLocation = INDEXNOW_KEY_LOCATION,
    endpoint = INDEXNOW_ENDPOINT,
    maxRetries = 2,
    retryDelayMs = 250,
    fetchFn = globalThis.fetch,
    logger = console
  } = options;

  const validUrls = prepareUrlList(urls, host);

  if (validUrls.length === 0) {
    return {
      success: false,
      skipped: true,
      reason: "no_valid_urls",
      submittedCount: 0
    };
  }

  const payload = buildIndexNowPayload({ host, key, keyLocation, urlList: validUrls });
  const bodyJson = JSON.stringify(payload);

  let lastStatus = null;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const response = await fetchFn(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "User-Agent": "CanedoStudio-IndexNow/1.0"
        },
        body: bodyJson
      });

      lastStatus = response.status;

      // 200 OK o 202 Accepted indican recepción correcta según especificación IndexNow
      if (response.status === 200 || response.status === 202) {
        return {
          success: true,
          status: response.status,
          attempt,
          submittedCount: validUrls.length,
          urls: validUrls
        };
      }

      // Códigos 400 (Bad Request), 403 (Invalid Key), 422 (Unprocessable) no deben reintentarse
      if (response.status === 400 || response.status === 403 || response.status === 422) {
        logger.warn(`IndexNow rechazó la solicitud con HTTP ${response.status} (sin reintento).`);
        return {
          success: false,
          status: response.status,
          fatal: true,
          submittedCount: 0,
          reason: `http_${response.status}`
        };
      }

      // Para errores 429 (Rate Limit) o 5xx (Server Error), reintentar si quedan intentos
      if (attempt <= maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempt));
      }
    } catch (err) {
      lastError = err.message;
      if (attempt <= maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempt));
      }
    }
  }

  logger.warn(`IndexNow falló tras ${maxRetries + 1} intentos. Último estado: ${lastStatus}, error: ${lastError}`);

  return {
    success: false,
    status: lastStatus,
    error: lastError,
    submittedCount: 0,
    urls: validUrls
  };
}
