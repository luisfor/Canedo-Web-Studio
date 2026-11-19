// File: automatismos/canedo-admin/tests/fase_v1_visual_script.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  runVisualValidation,
  createCloudflareAiAdapter,
  isValidJpeg
} from "../../canedostudio-blog-bot/scripts/test-visual-v1.mjs";

test("▶ FASE V1-D: Validación del Script Visual y Adaptador REST Offline", async (t) => {

  await t.test("1. Ejecución predeterminada sin flags corre en modo DRY-RUN sin tocar red", async () => {
    let fetchCalled = false;
    const res = await runVisualValidation({
      args: [],
      fetchFn: async () => { fetchCalled = true; }
    });

    assert.equal(res.ok, true);
    assert.equal(res.mode, "dry-run");
    assert.equal(res.results.length, 3);
    assert.equal(fetchCalled, false);
  });

  await t.test("2. Ausencia de credenciales en modo LIVE falla limpiamente", async () => {
    const res = await runVisualValidation({
      args: ["--execute-live-infer"],
      env: { CF_AI_TEST_TOKEN: "" }
    });

    assert.equal(res.ok, false);
    assert.match(res.error, /AUTH_TOKEN_MISSING/);
  });

  await t.test("3. Verificación de token sin inferencias (--verify-token-only)", async () => {
    const mockFetch = async (url) => {
      assert.equal(url, "https://api.cloudflare.com/client/v4/user/tokens/verify");
      return {
        ok: true,
        json: async () => ({ success: true, result: { id: "test", status: "active" } })
      };
    };

    const res = await runVisualValidation({
      args: ["--verify-token-only"],
      env: { CF_AI_TEST_TOKEN: "valid-dummy-token" },
      fetchFn: mockFetch
    });

    assert.equal(res.ok, true);
    assert.equal(res.mode, "verify-token");
    assert.equal(res.data.status, "active");
  });

  await t.test("4. Error HTTP 401 (Token inválido o expirado) lanza AUTH_UNAUTHORIZED", async () => {
    const mockFetch = async () => ({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: async () => ({ errors: [{ code: 10000, message: "Authentication error" }] })
    });

    const adapter = createCloudflareAiAdapter({
      accountId: "dummy",
      token: "dummy",
      fetchFn: mockFetch
    });

    await assert.rejects(
      async () => await adapter.run("@cf/meta/llama-3.1-8b-instruct", {}),
      /AUTH_UNAUTHORIZED \(HTTP 401\)/
    );
  });

  await t.test("5. Error HTTP 403 (Permisos insuficientes) lanza AUTH_FORBIDDEN", async () => {
    const mockFetch = async () => ({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      json: async () => ({ errors: [{ message: "Missing scope" }] })
    });

    const adapter = createCloudflareAiAdapter({
      accountId: "dummy",
      token: "dummy",
      fetchFn: mockFetch
    });

    await assert.rejects(
      async () => await adapter.run("@cf/meta/llama-3.1-8b-instruct", {}),
      /AUTH_FORBIDDEN \(HTTP 403\)/
    );
  });

  await t.test("6. Error HTTP 429 (Cuota de Neurons agotada) lanza RATE_LIMIT", async () => {
    const mockFetch = async () => ({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
      json: async () => ({ errors: [{ message: "Daily free limit exceeded" }] })
    });

    const adapter = createCloudflareAiAdapter({
      accountId: "dummy",
      token: "dummy",
      fetchFn: mockFetch
    });

    await assert.rejects(
      async () => await adapter.run("@cf/meta/llama-3.1-8b-instruct", {}),
      /RATE_LIMIT \(HTTP 429\)/
    );
  });

  await t.test("7. Error HTTP 500 remoto de Cloudflare AI", async () => {
    const mockFetch = async () => ({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => "GPU cluster unavailable"
    });

    const adapter = createCloudflareAiAdapter({
      accountId: "dummy",
      token: "dummy",
      fetchFn: mockFetch
    });

    await assert.rejects(
      async () => await adapter.run("@cf/black-forest-labs/flux-1-schnell", {}),
      /HTTP_500: Error remoto/
    );
  });

  await t.test("8. Respuesta JSON válida de Llama 8B devuelve resultado limpio", async () => {
    const mockFetch = async () => ({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        success: true,
        result: { response: "A professional executive in a bright contemporary office" }
      })
    });

    const adapter = createCloudflareAiAdapter({
      accountId: "dummy",
      token: "dummy",
      fetchFn: mockFetch
    });

    const res = await adapter.run("@cf/meta/llama-3.1-8b-instruct", {});
    assert.match(res.response, /bright contemporary office/);
  });

  await t.test("9. Respuesta binaria válida de Flux (image/jpeg) se reconoce y valida con magic bytes", async () => {
    // Buffer JPEG válido de prueba (FF D8 FF E0 ...)
    const validJpegBytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, ...new Array(150).fill(0xAA)]);
    assert.equal(isValidJpeg(validJpegBytes), true);

    const mockFetch = async () => ({
      ok: true,
      headers: new Headers({ "content-type": "image/jpeg" }),
      arrayBuffer: async () => validJpegBytes.buffer
    });

    const adapter = createCloudflareAiAdapter({
      accountId: "dummy",
      token: "dummy",
      fetchFn: mockFetch
    });

    const resBuffer = await adapter.run("@cf/black-forest-labs/flux-1-schnell", {});
    assert.ok(resBuffer instanceof ArrayBuffer);
    assert.equal(isValidJpeg(new Uint8Array(resBuffer)), true);
  });

  await t.test("10. Respuesta de Flux como JSON con base64 se decodifica adecuadamente", async () => {
    const validBase64 = Buffer.from(new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, ...new Array(120).fill(0x55)])).toString("base64");
    const mockFetch = async () => ({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        success: true,
        result: { image: validBase64 }
      })
    });

    const adapter = createCloudflareAiAdapter({
      accountId: "dummy",
      token: "dummy",
      fetchFn: mockFetch
    });

    const decodedBuf = await adapter.run("@cf/black-forest-labs/flux-1-schnell", {});
    assert.equal(isValidJpeg(new Uint8Array(decodedBuf)), true);
  });

  await t.test("11. Imagen inválida o corrupta es rechazada por isValidJpeg()", () => {
    const corruptBytes = new Uint8Array([0x00, 0x11, 0x22, 0x33, 0x44]);
    assert.equal(isValidJpeg(corruptBytes), false);
    assert.equal(isValidJpeg(null), false);
    assert.equal(isValidJpeg(new Uint8Array(50)), false);
  });

  await t.test("12. Timeout controlado interrumpe la conexión", async () => {
    const immediateAbortFetch = async (url, init) => {
      const err = new Error("The operation was aborted");
      err.name = "AbortError";
      throw err;
    };

    const adapter = createCloudflareAiAdapter({
      accountId: "dummy",
      token: "dummy",
      fetchFn: immediateAbortFetch
    });

    await assert.rejects(
      async () => await adapter.run("@cf/meta/llama-3.1-8b-instruct", {}),
      /TIMEOUT/
    );
  });

  await t.test("13. Simulación de ejecución controlada (Exactamente 3 Llama y 3 Flux, 0 reintentos)", async () => {
    let llamaCalls = 0;
    let fluxCalls = 0;

    const validJpegBytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, ...new Array(200).fill(0xAA)]);

    const mockFetch = async (url) => {
      if (url.includes("@cf/meta/llama-3.1-8b-instruct") || url.includes("@cf/meta/llama-3.3-70b-instruct-fp8-fast")) {
        llamaCalls++;
        return {
          ok: true,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({ success: true, result: { response: "Realistic business office scene" } })
        };
      }
      if (url.includes("@cf/black-forest-labs/flux-1-schnell")) {
        fluxCalls++;
        return {
          ok: true,
          headers: new Headers({ "content-type": "image/jpeg" }),
          arrayBuffer: async () => validJpegBytes.buffer
        };
      }
      return { ok: false, status: 404 };
    };

    const tempTestOutDir = path.resolve("/tmp/canedo-visual-test-" + Date.now());

    const res = await runVisualValidation({
      args: ["--execute-live-infer"],
      env: { CF_AI_TEST_TOKEN: "mock-token", CF_AI_ACCOUNT_ID: "mock-acc" },
      fetchFn: mockFetch,
      outputDir: tempTestOutDir
    });

    assert.equal(res.ok, true);
    assert.equal(llamaCalls, 3);
    assert.equal(fluxCalls, 3);
    assert.equal(res.results.length, 3);
    assert.equal(res.results.every(r => r.status === "SUCCESS"), true);

    // Limpieza de directorio temporal
    fs.rmSync(tempTestOutDir, { recursive: true, force: true });
  });

  await t.test("14. Preservación y protección contra exposición de secretos en mensajes", () => {
    try {
      createCloudflareAiAdapter({ accountId: "", token: "" });
      assert.fail("Debió fallar");
    } catch (e) {
      assert.match(e.message, /AUTH_CONFIG_MISSING/);
      // Confirmar que no expone valores
      assert.equal(e.message.includes("undefined"), false);
    }
  });
});
