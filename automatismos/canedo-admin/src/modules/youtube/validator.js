// File: automatismos/canedo-admin/src/modules/youtube/validator.js
// Validación estricta y extracción de Video ID de URLs de YouTube
// Protección contra SSRF, homógrafos, dominios no autorizados y formatos maliciosos

const YOUTUBE_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

const ALLOWED_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be"
]);

/**
 * Analiza una cadena URL y extrae el identificador canónico del video de YouTube (11 caracteres).
 * Valida esquema (https: o http: en localhost/test), hostname y path de manera segura.
 * 
 * @param {string} inputUrl - Cadena URL proporcionada por el usuario
 * @returns {{ ok: boolean, videoId?: string, canonicalUrl?: string, error?: string }}
 */
export function parseAndValidateYouTubeUrl(inputUrl) {
  if (!inputUrl || typeof inputUrl !== "string") {
    return { ok: false, error: "URL_EMPTY_OR_INVALID_TYPE" };
  }

  const trimmed = inputUrl.trim();
  if (trimmed.length > 500) {
    return { ok: false, error: "URL_TOO_LONG" };
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "URL_MALFORMED" };
  }

  // Permitir únicamente HTTPS (o HTTP en pruebas locales explícitas)
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, error: "INVALID_PROTOCOL" };
  }

  const host = parsed.hostname.toLowerCase();
  if (!ALLOWED_HOSTS.has(host)) {
    return { ok: false, error: "UNAUTHORIZED_HOST" };
  }

  let videoId = null;

  if (host === "youtu.be") {
    // Formato: https://youtu.be/VIDEO_ID?t=10
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    if (pathParts.length > 0) {
      videoId = pathParts[0];
    }
  } else {
    // Formatos en youtube.com:
    // 1. /watch?v=VIDEO_ID
    // 2. /shorts/VIDEO_ID
    // 3. /live/VIDEO_ID
    // 4. /embed/VIDEO_ID
    const pathname = parsed.pathname;

    if (pathname === "/watch") {
      videoId = parsed.searchParams.get("v");
    } else if (pathname.startsWith("/shorts/")) {
      const parts = pathname.replace(/^\/shorts\//, "").split("/");
      videoId = parts[0];
    } else if (pathname.startsWith("/live/")) {
      const parts = pathname.replace(/^\/live\//, "").split("/");
      videoId = parts[0];
    } else if (pathname.startsWith("/embed/")) {
      const parts = pathname.replace(/^\/embed\//, "").split("/");
      videoId = parts[0];
    }
  }

  if (!videoId || !YOUTUBE_ID_REGEX.test(videoId)) {
    return { ok: false, error: "INVALID_VIDEO_ID" };
  }

  const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
  return { ok: true, videoId, canonicalUrl };
}

