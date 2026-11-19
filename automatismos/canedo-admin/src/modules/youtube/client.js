// File: automatismos/canedo-admin/src/modules/youtube/client.js
// Cliente seguro para consultar metadatos oficiales de YouTube vía oEmbed
// Protegido con timeout, tamaño máximo de respuesta y validación de tipos

import { parseAndValidateYouTubeUrl } from "./validator.js";

const DEFAULT_OEMBED_ENDPOINT = "https://www.youtube.com/oembed";
const DEFAULT_TIMEOUT_MS = 6000;
const MAX_RESPONSE_BYTES = 50 * 1024; // 50 KB máximo

/**
 * Consulta el endpoint oficial de YouTube oEmbed para un video validado.
 * 
 * @param {string} inputUrl - URL del video de YouTube
 * @param {object} options - Opciones de fetch inyectables para pruebas
 * @returns {Promise<{ ok: boolean, data?: object, error?: string, status?: number }>}
 */
export async function fetchYouTubeMetadata(inputUrl, { fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS, oembedBaseUrl = DEFAULT_OEMBED_ENDPOINT } = {}) {
  const validation = parseAndValidateYouTubeUrl(inputUrl);
  if (!validation.ok) {
    return { ok: false, error: validation.error };
  }

  const { videoId, canonicalUrl } = validation;
  const oembedUrl = new URL(oembedBaseUrl);
  oembedUrl.searchParams.set("url", canonicalUrl);
  oembedUrl.searchParams.set("format", "json");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchImpl(oembedUrl.toString(), {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "User-Agent": "CanedoStudioAdminBot/1.0 (+https://canedostudio.com)"
      },
      signal: controller.signal,
      redirect: "follow"
    });

    clearTimeout(timer);

    if (res.status === 404) {
      return { ok: false, error: "VIDEO_NOT_FOUND_OR_PRIVATE", status: 404 };
    }
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: "EMBED_NOT_ALLOWED_OR_RESTRICTED", status: res.status };
    }
    if (!res.ok) {
      return { ok: false, error: `OEMBED_HTTP_ERROR_${res.status}`, status: res.status };
    }

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json") && !contentType.includes("text/json")) {
      return { ok: false, error: "INVALID_CONTENT_TYPE" };
    }

    const rawText = await res.text();
    if (rawText.length > MAX_RESPONSE_BYTES) {
      return { ok: false, error: "RESPONSE_TOO_LARGE" };
    }

    let json;
    try {
      json = JSON.parse(rawText);
    } catch {
      return { ok: false, error: "INVALID_JSON_RESPONSE" };
    }

    if (!json.title || typeof json.title !== "string") {
      return { ok: false, error: "INCOMPLETE_METADATA_NO_TITLE" };
    }

    return {
      ok: true,
      data: {
        videoId,
        canonicalUrl,
        title: json.title.trim(),
        authorName: (json.author_name || "Desconocido").trim(),
        authorUrl: json.author_url ? String(json.author_url).trim() : null,
        thumbnailUrl: json.thumbnail_url ? String(json.thumbnail_url).trim() : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        thumbnailWidth: json.thumbnail_width || null,
        thumbnailHeight: json.thumbnail_height || null,
        providerName: json.provider_name || "YouTube",
        type: json.type || "video",
        isEmbeddable: true
      }
    };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      return { ok: false, error: "TIMEOUT" };
    }
    return { ok: false, error: `NETWORK_ERROR: ${err.message}` };
  }
}

