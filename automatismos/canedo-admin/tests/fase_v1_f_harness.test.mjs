// File: automatismos/canedo-admin/tests/fase_v1_f_harness.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import harnessWorker from "../../canedostudio-blog-bot/tests/harness/worker.js";
import {
  generateVisualBrief,
  buildFluxPrompt,
  buildDeterministicScene,
  EDITORIAL_STYLE_MASTER,
  MODEL_TEXT_VISUAL,
  MODEL_IMAGE_FLUX
} from "../../canedostudio-blog-bot/src/semantic_cover.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test("▶ FASE V1-F: Arnés Local Aislado y Protección de Inferencias", async (t) => {

  await t.test("1. Reutilización e importación directa de semantic_cover.js sin duplicar código", () => {
    assert.equal(typeof generateVisualBrief, "function");
    assert.equal(typeof buildFluxPrompt, "function");
    assert.equal(typeof buildDeterministicScene, "function");
    assert.equal(typeof EDITORIAL_STYLE_MASTER, "string");
    assert.equal(MODEL_TEXT_VISUAL, "@cf/meta/llama-3.3-70b-instruct-fp8-fast");
    assert.equal(MODEL_IMAGE_FLUX, "@cf/black-forest-labs/flux-1-schnell");
  });

  await t.test("2. Aislamiento de configuración: wrangler.test.toml solo tiene binding AI", () => {
    const tomlPath = path.resolve(__dirname, "../../canedostudio-blog-bot/tests/harness/wrangler.test.toml");
    const tomlContent = fs.readFileSync(tomlPath, "utf-8");

    assert.match(tomlContent, /name\s*=\s*"canedo-visual-harness"/);
    assert.match(tomlContent, /\[ai\]/);
    assert.match(tomlContent, /binding\s*=\s*"AI"/);

    // Comprobar ausencia absoluta de bases de datos y almacenamiento
    assert.equal(tomlContent.includes("d1_databases"), false);
    assert.equal(tomlContent.includes("kv_namespaces"), false);
    assert.equal(tomlContent.includes("r2_buckets"), false);
    assert.equal(tomlContent.includes("routes"), false);
    assert.equal(tomlContent.includes("triggers"), false);
  });

  await t.test("3. Endpoint /diagnose responde 200 y detecta ausencia de almacenamiento sin llamar a AI.run()", async () => {
    let aiRunCalled = false;
    const mockEnv = {
      AI: {
        run: async () => { aiRunCalled = true; }
      }
    };

    const req = new Request("http://127.0.0.1:8787/diagnose");
    const res = await harnessWorker.fetch(req, mockEnv);

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(
      body.status === "READY_LOCAL_HARNESS" || body.status === "LOCKED_AFTER_TEST",
      "El status debe indicar arnés preparado o bloqueado post-test"
    );
    assert.equal(body.hasAiBinding, true);
    assert.equal(body.hasStorageBindings, false);
    assert.equal(body.inferencesLocked, true);
    assert.equal(aiRunCalled, false); // Cero llamadas a AI
  });

  await t.test("4. Endpoint /preview-prompt genera prompts de prueba con cero llamadas a IA", async () => {
    let aiRunCalled = false;
    const mockEnv = {
      AI: {
        run: async () => { aiRunCalled = true; }
      }
    };

    const req = new Request("http://127.0.0.1:8787/preview-prompt?case=ia-pymes");
    const res = await harnessWorker.fetch(req, mockEnv);

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.caseId, "ia-pymes");
    assert.match(body.deterministicScene, /team collaborating|productivity|software/i);
    assert.equal(body.inferencesExecuted, false);
    assert.equal(aiRunCalled, false);
  });

  await t.test("5. Bloqueo estricto de inferencias en Fase V1-F: /generate retorna 403 Forbidden", async () => {
    let aiRunCalled = false;
    const mockEnv = {
      AI: {
        run: async () => { aiRunCalled = true; }
      }
    };

    const req = new Request("http://127.0.0.1:8787/generate", { method: "POST" });
    const res = await harnessWorker.fetch(req, mockEnv);

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error, "INFERENCES_BLOCKED_IN_V1_F");
    assert.equal(aiRunCalled, false);
  });

  await t.test("6. Rutas inexistentes retornan 404 seguro en JSON", async () => {
    const req = new Request("http://127.0.0.1:8787/unauthorized-path");
    const res = await harnessWorker.fetch(req, {});
    assert.equal(res.status, 404);
  });
});
