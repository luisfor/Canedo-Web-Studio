// File: automatismos/canedo-admin/tests/fase_d2_youtube_ingestion.test.mjs
// Suite de pruebas unitarias para la Fase D2: Ingesta segura de YouTube

import test from "node:test";
import assert from "node:assert/strict";
import { parseAndValidateYouTubeUrl } from "../src/modules/youtube/validator.js";
import { fetchYouTubeMetadata } from "../src/modules/youtube/client.js";
import { YouTubeIngestionService } from "../src/modules/youtube/service.js";

// Mock para simular fetch y evitar llamadas reales a la red
function createMockFetch(responses = {}) {
  return async (url, options = {}) => {
    const urlStr = String(url);
    if (responses[urlStr]) {
      const resp = responses[urlStr];
      if (resp.timeout) {
        const error = new Error("The operation was aborted");
        error.name = "AbortError";
        throw error;
      }
      return {
        ok: resp.ok !== false,
        status: resp.status || 200,
        headers: new Map(Object.entries(resp.headers || { "content-type": "application/json" })),
        text: async () => typeof resp.body === "string" ? resp.body : JSON.stringify(resp.body || {})
      };
    }
    // Respuesta 404 por defecto
    return {
      ok: false,
      status: 404,
      headers: new Map([["content-type", "application/json"]]),
      text: async () => JSON.stringify({ error: "Not found" })
    };
  };
}

// Mock mínimo para D1
function createMockDb(initialRows = {}) {
  return {
    prepare: (sql) => ({
      bind: (...params) => ({
        first: async () => {
          if (sql.includes("FROM blog_posts")) {
            return initialRows.blog_posts || null;
          }
          if (sql.includes("FROM blog_manual_drafts")) {
            return initialRows.blog_manual_drafts || null;
          }
          return null;
        }
      })
    })
  };
}

test("FASE D2: Ingesta Segura de YouTube en Canedo Studio", async (t) => {
  await t.test("1. Validador: Acepta URLs estándar, cortas, shorts y live válidas", () => {
    const validCases = [
      { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", expectedId: "dQw4w9WgXcQ" },
      { url: "https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s", expectedId: "dQw4w9WgXcQ" },
      { url: "https://m.youtube.com/watch?v=dQw4w9WgXcQ", expectedId: "dQw4w9WgXcQ" },
      { url: "https://youtu.be/dQw4w9WgXcQ", expectedId: "dQw4w9WgXcQ" },
      { url: "https://youtu.be/dQw4w9WgXcQ?si=abcdef12345", expectedId: "dQw4w9WgXcQ" },
      { url: "https://www.youtube.com/shorts/dQw4w9WgXcQ", expectedId: "dQw4w9WgXcQ" },
      { url: "https://youtube.com/live/dQw4w9WgXcQ", expectedId: "dQw4w9WgXcQ" },
      { url: "https://www.youtube.com/embed/dQw4w9WgXcQ", expectedId: "dQw4w9WgXcQ" }
    ];

    for (const { url, expectedId } of validCases) {
      const res = parseAndValidateYouTubeUrl(url);
      assert.equal(res.ok, true, `Debe validar correctamente: ${url}`);
      assert.equal(res.videoId, expectedId);
      assert.equal(res.canonicalUrl, `https://www.youtube.com/watch?v=${expectedId}`);
    }
  });

  await t.test("2. Validador: Rechaza entradas fraudulentas, dominios maliciosos y homógrafos", () => {
    const invalidCases = [
      { url: "", expectedError: "URL_EMPTY_OR_INVALID_TYPE" },
      { url: "not-a-url", expectedError: "URL_MALFORMED" },
      { url: "ftp://www.youtube.com/watch?v=dQw4w9WgXcQ", expectedError: "INVALID_PROTOCOL" },
      { url: "javascript:alert(1)", expectedError: "INVALID_PROTOCOL" },
      { url: "https://youtube.com.attacker.com/watch?v=dQw4w9WgXcQ", expectedError: "UNAUTHORIZED_HOST" },
      { url: "https://fakeyoutube.com/watch?v=dQw4w9WgXcQ", expectedError: "UNAUTHORIZED_HOST" },
      { url: "https://youtu.be.scam.net/dQw4w9WgXcQ", expectedError: "UNAUTHORIZED_HOST" },
      { url: "https://www.youtube.com/watch?v=short", expectedError: "INVALID_VIDEO_ID" }, // Menos de 11 chars
      { url: "https://www.youtube.com/watch?v=tooLongVideoId123", expectedError: "INVALID_VIDEO_ID" }, // Más de 11 chars
      { url: "https://www.youtube.com/watch?v=invalid@char", expectedError: "INVALID_VIDEO_ID" },
      { url: "https://youtu.be/", expectedError: "INVALID_VIDEO_ID" },
      { url: "https://www.youtube.com/about", expectedError: "INVALID_VIDEO_ID" }
    ];

    for (const { url, expectedError } of invalidCases) {
      const res = parseAndValidateYouTubeUrl(url);
      assert.equal(res.ok, false, `Debe rechazar: ${url}`);
      assert.equal(res.error, expectedError);
    }
  });

  await t.test("3. Cliente oEmbed: Extrae metadatos válidos con timeout y límite de tamaño", async () => {
    const mockUrl = "https://www.youtube.com/oembed?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ&format=json";
    const mockFetch = createMockFetch({
      [mockUrl]: {
        ok: true,
        status: 200,
        headers: { "content-type": "application/json" },
        body: {
          title: "Cómo Automatizar tu Negocio con IA en 2026",
          author_name: "Canedo Studio",
          author_url: "https://www.youtube.com/@CanedoStudio",
          thumbnail_url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
          thumbnail_width: 480,
          thumbnailHeight: 360,
          type: "video"
        }
      }
    });

    const res = await fetchYouTubeMetadata("https://youtu.be/dQw4w9WgXcQ", { fetchImpl: mockFetch });
    assert.equal(res.ok, true);
    assert.equal(res.data.videoId, "dQw4w9WgXcQ");
    assert.equal(res.data.title, "Cómo Automatizar tu Negocio con IA en 2026");
    assert.equal(res.data.authorName, "Canedo Studio");
    assert.equal(res.data.isEmbeddable, true);
  });

  await t.test("4. Cliente oEmbed: Manejo adecuado de video privado, eliminado o no incrustable", async () => {
    const mock404Url = "https://www.youtube.com/oembed?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3Dprivatevid1&format=json";
    const mock401Url = "https://www.youtube.com/oembed?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3Dnoembedvid1&format=json";

    const mockFetch = createMockFetch({
      [mock404Url]: { ok: false, status: 404 },
      [mock401Url]: { ok: false, status: 401 }
    });

    const res404 = await fetchYouTubeMetadata("https://youtu.be/privatevid1", { fetchImpl: mockFetch });
    assert.equal(res404.ok, false);
    assert.equal(res404.error, "VIDEO_NOT_FOUND_OR_PRIVATE");
    assert.equal(res404.status, 404);

    const res401 = await fetchYouTubeMetadata("https://youtu.be/noembedvid1", { fetchImpl: mockFetch });
    assert.equal(res401.ok, false);
    assert.equal(res401.error, "EMBED_NOT_ALLOWED_OR_RESTRICTED");
    assert.equal(res401.status, 401);
  });

  await t.test("5. Cliente oEmbed: Manejo de timeout y respuestas que exceden límite de tamaño", async () => {
    const timeoutUrl = "https://www.youtube.com/oembed?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3Dtimeoutvid1&format=json";
    const largeUrl = "https://www.youtube.com/oembed?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3Dlargebody11&format=json";

    const mockFetch = createMockFetch({
      [timeoutUrl]: { timeout: true },
      [largeUrl]: {
        ok: true,
        headers: { "content-type": "application/json" },
        body: "a".repeat(60 * 1024) // 60 KB > 50 KB límite
      }
    });

    const resTimeout = await fetchYouTubeMetadata("https://youtu.be/timeoutvid1", { fetchImpl: mockFetch });
    assert.equal(resTimeout.ok, false);
    assert.equal(resTimeout.error, "TIMEOUT");

    const resLarge = await fetchYouTubeMetadata("https://youtu.be/largebody11", { fetchImpl: mockFetch });
    assert.equal(resLarge.ok, false);
    assert.equal(resLarge.error, "RESPONSE_TOO_LARGE");
  });

  await t.test("6. Servicio de Ingesta: Control de duplicados en D1 (blog_posts y borradores)", async () => {
    const videoId = "duplicate11";
    const mockDb = createMockDb({
      blog_posts: {
        id: 76,
        slug: "articulo-sobre-ia-y-video",
        title: "Artículo Existente",
        date: "2026-11-10",
        status: "published"
      }
    });

    const service = new YouTubeIngestionService(mockDb);
    const check = await service.checkDuplicateVideo(videoId);
    assert.equal(check.isDuplicate, true);
    assert.equal(check.publishedPost.slug, "articulo-sobre-ia-y-video");
  });

  await t.test("7. Servicio de Ingesta: Prepara payload unificado con transcripción opcional y notas", async () => {
    const mockUrl = "https://www.youtube.com/oembed?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3Dsamplevid11&format=json";
    const mockFetch = createMockFetch({
      [mockUrl]: {
        ok: true,
        headers: { "content-type": "application/json" },
        body: {
          title: "Cómo crear agentes IA autónomos",
          author_name: "Canedo Tech",
          author_url: "https://www.youtube.com/@CanedoTech",
          thumbnail_url: "https://i.ytimg.com/vi/samplevid11/hqdefault.jpg"
        }
      }
    });

    const mockDb = createMockDb(); // Sin duplicados
    const service = new YouTubeIngestionService(mockDb, { fetchImpl: mockFetch });

    const transcriptInput = "En este video explicamos la arquitectura de agentes inteligentes...";
    const notesInput = "Enfatizar en el caso de uso para ecommerce local.";

    const res = await service.ingestVideoSource("https://youtu.be/samplevid11", {
      transcript: transcriptInput,
      notes: notesInput
    });

    assert.equal(res.ok, true);
    const payload = res.payload;
    assert.equal(payload.sourceType, "youtube");
    assert.equal(payload.videoId, "samplevid11");
    assert.equal(payload.title, "Cómo crear agentes IA autónomos");
    assert.equal(payload.authorName, "Canedo Tech");
    assert.equal(payload.hasTranscript, true);
    assert.equal(payload.transcript, transcriptInput);
    assert.equal(payload.notes, notesInput);
    assert.equal(payload.duplicateInfo.isDuplicate, false);
  });
});
