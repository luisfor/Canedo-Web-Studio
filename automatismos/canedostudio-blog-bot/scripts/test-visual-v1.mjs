// File: automatismos/canedostudio-blog-bot/scripts/test-visual-v1.mjs
/**
 * Script de Validación Visual Controlada para Portadas Semánticas (Fase V1-D)
 * Canedo Studio (canedostudio.com)
 * 
 * Reglas de Seguridad:
 * 1. Reutiliza directamente las funciones puras de 'src/semantic_cover.js'.
 * 2. Modo por defecto: DRY-RUN (no ejecuta inferencias ni consume Neurons).
 * 3. Ejecución real exige flag explícito: --execute-live-infer.
 * 4. Límites estrictos: Máximo 3 llamadas a Llama 8B y 3 a Flux-1 Schnell. 1 intento por caso, cero reintentos automáticos.
 * 5. Credenciales leídas exclusivamente de variables de entorno:
 *    - CF_AI_TEST_TOKEN
 *    - CF_AI_ACCOUNT_ID (por defecto la cuenta oficial 0daa1b56c3f935c706d8440b18914593)
 * 6. Cero acceso a D1, KV, endpoints de publicación o producción.
 * 7. Almacena resultados exclusivamente en 'tests/output/v1-visual/'.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  generateVisualBrief,
  buildFluxPrompt,
  buildDeterministicScene,
  MODEL_TEXT_VISUAL,
  MODEL_IMAGE_FLUX
} from "../src/semantic_cover.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directorio seguro de salida
export const OUTPUT_DIR = path.resolve(__dirname, "../tests/output/v1-visual");

// Casos de prueba oficiales autorizados
export const TEST_ARTICLES = [
  {
    id: "ia-pymes",
    filename: "ia-pymes-v1.jpg",
    title: "IA para pequeñas empresas: ¿dónde empezar?",
    summary: "Automatización práctica para pymes, atención al cliente, citas automáticas y reducción de tareas repetitivas sin complejidad técnica.",
    tag: "automatizacion"
  },
  {
    id: "reputacion-online",
    filename: "reputacion-online-v1.jpg",
    title: "Tu reputación online trabaja antes que tú",
    summary: "Gestión de reseñas, credibilidad empresarial, Google Maps y experiencia del cliente como primera impresión digital.",
    tag: "resenas"
  },
  {
    id: "contenido-multicanal",
    filename: "contenido-multicanal-v1.jpg",
    title: "Escribe una vez, aparece en todas partes",
    summary: "Reutilización de contenido editorial en blogs, redes sociales y canales digitales para maximizar el alcance sin duplicar el esfuerzo.",
    tag: "estrategia"
  }
];

/**
 * Validador de formato de imagen (JPEG magic bytes FF D8 FF).
 * 
 * @param {Uint8Array} bytes 
 * @returns {boolean}
 */
export function isValidJpeg(bytes) {
  if (!bytes || bytes.length < 100) return false;
  return bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF;
}

/**
 * Crea el adaptador de API REST compatible con el contrato ai.run(model, payload).
 * 
 * @param {object} config
 * @param {string} config.accountId
 * @param {string} config.token
 * @param {Function} [config.fetchFn]
 * @returns {object}
 */
export function createCloudflareAiAdapter({ accountId, token, fetchFn = globalThis.fetch }) {
  if (!accountId || !token) {
    throw new Error("AUTH_CONFIG_MISSING: Se requiere accountId y token de Workers AI");
  }

  return {
    async run(model, payload) {
      const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000); // 25s timeout máximo por inferencia

      let res;
      try {
        res = await fetchFn(url, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
            "User-Agent": "CanedoStudio-VisualValidator/1.0"
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
      } catch (err) {
        clearTimeout(timeout);
        if (err.name === "AbortError" || String(err).includes("abort")) {
          throw new Error(`TIMEOUT: Tiempo de espera agotado al consultar modelo ${model}`);
        }
        throw new Error(`NETWORK_ERROR: Fallo de conexión hacia Workers AI: ${err.message || String(err)}`);
      } finally {
        clearTimeout(timeout);
      }

      // Manejo específico de códigos de error de Cloudflare API
      if (!res.ok) {
        let errBody = "";
        try {
          const jsonErr = await res.json();
          errBody = JSON.stringify(jsonErr.errors || jsonErr.messages || jsonErr);
        } catch {
          errBody = await res.text();
        }

        if (res.status === 401) {
          throw new Error(`AUTH_UNAUTHORIZED (HTTP 401): Token inválido o expirado. ${errBody}`);
        }
        if (res.status === 403) {
          throw new Error(`AUTH_FORBIDDEN (HTTP 403): Permisos insuficientes en el token para Workers AI. ${errBody}`);
        }
        if (res.status === 429) {
          throw new Error(`RATE_LIMIT (HTTP 429): Cuota diaria de Neurons superada o límite de frecuencia alcanzado. ${errBody}`);
        }
        throw new Error(`HTTP_${res.status}: Error remoto de Cloudflare AI (${res.statusText}): ${errBody}`);
      }

      // Procesar respuestas según el tipo de modelo
      const contentType = (res.headers.get("content-type") || "").toLowerCase();

      // Flux suele responder image/jpeg directo, o JSON con base64
      if (contentType.includes("image/")) {
        return await res.arrayBuffer();
      }

      const data = await res.json();

      // Si la respuesta es JSON, verificar si contiene error lógico
      if (!data.success && data.errors && data.errors.length > 0) {
        throw new Error(`API_ERROR: ${JSON.stringify(data.errors)}`);
      }

      // Modelo de difusión que devuelve JSON con campo 'image' en base64
      if (data.result && data.result.image) {
        const bin = atob(data.result.image);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        return arr.buffer;
      }

      // Modelo de texto (Llama 8B)
      return data.result;
    }
  };
}

/**
 * Función principal orquestadora.
 * 
 * @param {object} [options]
 * @param {string[]} [options.args] Argumentos de línea de comandos
 * @param {object} [options.env] Variables de entorno inyectables
 * @param {Function} [options.fetchFn] Cliente fetch inyectable para pruebas
 * @param {string} [options.outputDir] Directorio de salida configurable
 * @returns {Promise<{ ok: boolean, mode: string, results: Array, message: string }>}
 */
export async function runVisualValidation(options = {}) {
  const args = options.args || process.argv.slice(2);
  const env = options.env || process.env;
  const fetchFn = options.fetchFn || globalThis.fetch;
  const outDir = options.outputDir || OUTPUT_DIR;

  const isLiveExecution = args.includes("--execute-live-infer");
  const isVerifyOnly = args.includes("--verify-token-only");

  console.log("=====================================================");
  console.log(" CANEDO STUDIO — VALIDACIÓN VISUAL DE PORTADAS V1");
  console.log("=====================================================");

  // 1. MODO DRY-RUN (PREDETERMINADO Y SEGURO)
  if (!isLiveExecution && !isVerifyOnly) {
    console.log("Modo activo: DRY-RUN (Seguro - Cero inferencias, cero Neurons)");
    console.log("Artículos de prueba preparados: 3");
    console.log("Directorio previsto de salida:", outDir);
    console.log("\nDetalle de casos y prompts de referencia:");

    const dryRunCases = TEST_ARTICLES.map((art, idx) => {
      const deterministicScene = buildDeterministicScene(`${art.title} ${art.summary}`, art.title);
      const referenceFluxPrompt = buildFluxPrompt(deterministicScene);
      console.log(`\n[Caso ${idx + 1}] ${art.title}`);
      console.log(`- Archivo previsto: ${art.filename}`);
      console.log(`- Escena de referencia: "${deterministicScene}"`);
      console.log(`- Prompt Flux de referencia:\n  "${referenceFluxPrompt}"`);
      return {
        id: art.id,
        filename: art.filename,
        referenceScene: deterministicScene,
        referencePrompt: referenceFluxPrompt
      };
    });

    console.log("\n-----------------------------------------------------");
    console.log("Para verificar la validez del token sin inferencias: --verify-token-only");
    console.log("Para ejecutar la prueba real (máx 3 Llama + 3 Flux): --execute-live-infer");
    console.log("-----------------------------------------------------");

    return {
      ok: true,
      mode: "dry-run",
      results: dryRunCases,
      message: "Dry-run completado con éxito. Cero llamadas remotas ejecutadas."
    };
  }

  // 2. VERIFICACIÓN DE CREDENCIALES
  const token = env.CF_AI_TEST_TOKEN;
  const accountId = env.CF_AI_ACCOUNT_ID || "0daa1b56c3f935c706d8440b18914593";

  if (!token) {
    const err = "AUTH_TOKEN_MISSING: La variable de entorno CF_AI_TEST_TOKEN no está configurada.";
    console.error(`❌ Error: ${err}`);
    return { ok: false, error: err };
  }

  // 3. MODO VERIFICAR TOKEN ÚNICAMENTE (Cero inferencias)
  if (isVerifyOnly) {
    console.log("Verificando credencial de autenticación contra /user/tokens/verify...");
    try {
      const verifyRes = await fetchFn("https://api.cloudflare.com/client/v4/user/tokens/verify", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await verifyRes.json();
      if (verifyRes.ok && data.success) {
        console.log("✔ Token verificado con éxito: Activo y reconocido por Cloudflare.");
        return { ok: true, mode: "verify-token", data: { status: "active" } };
      }
      const err = `Token no válido: ${JSON.stringify(data.errors || data.messages)}`;
      console.error(`❌ ${err}`);
      return { ok: false, error: err };
    } catch (e) {
      console.error(`❌ Error de red al verificar token: ${e.message}`);
      return { ok: false, error: e.message };
    }
  }

  // 4. MODO LIVE EXECUTION (Control estricto de cuota: exactamente 3 Llama y 3 Flux)
  console.log("Modo activo: LIVE INFERENCE (Autorizado expresamente)");
  console.log(`Límite estricto: Exactamente ${TEST_ARTICLES.length} llamadas a Llama 8B y ${TEST_ARTICLES.length} a Flux-1 Schnell.`);

  fs.mkdirSync(outDir, { recursive: true });

  const aiAdapter = createCloudflareAiAdapter({ accountId, token, fetchFn });
  const results = [];
  let llamaCallsCount = 0;
  let fluxCallsCount = 0;

  for (let i = 0; i < TEST_ARTICLES.length; i++) {
    const art = TEST_ARTICLES[i];
    const targetFilePath = path.join(outDir, art.filename);

    console.log(`\n[${i + 1}/${TEST_ARTICLES.length}] Procesando caso: '${art.title}'`);

    // Evitar sobreescritura accidental si el archivo ya existe
    if (fs.existsSync(targetFilePath) && fs.statSync(targetFilePath).size > 1000) {
      console.warn(`⚠️ Archivo de destino ya existe (${art.filename}). Omitiendo para preservar imagen.`);
      results.push({ id: art.id, skipped: true, reason: "FILE_EXISTS" });
      continue;
    }

    // A. Brief Visual con Llama 3.1 8B (Límite estricto de 1 intento)
    llamaCallsCount++;
    if (llamaCallsCount > TEST_ARTICLES.length) {
      throw new Error(`SAFETY_LIMIT_BREACH: Límite de llamadas a Llama superado (${llamaCallsCount})`);
    }

    let visualScene = "";
    let briefSource = "llama_8b";

    try {
      const briefRes = await generateVisualBrief({
        ai: aiAdapter,
        title: art.title,
        summary: art.summary,
        tag: art.tag
      });
      visualScene = briefRes.scene;
      briefSource = briefRes.source;
      console.log(`  ✔ Brief visual (${briefSource}): "${visualScene}"`);
    } catch (briefErr) {
      console.warn(`  ⚠️ Falló Llama 8B (${briefErr.message}). Aplicando fallback determinista.`);
      visualScene = buildDeterministicScene(`${art.title} ${art.summary}`, art.title);
      briefSource = "deterministic";
    }

    // B. Ensamblar Prompt de Flux
    const fluxPrompt = buildFluxPrompt(visualScene);

    // C. Inferencia en Flux-1 Schnell (Límite estricto de 1 intento)
    fluxCallsCount++;
    if (fluxCallsCount > TEST_ARTICLES.length) {
      throw new Error(`SAFETY_LIMIT_BREACH: Límite de llamadas a Flux superado (${fluxCallsCount})`);
    }

    let imgBuffer = null;
    let fluxError = null;

    try {
      const startTime = Date.now();
      const rawImg = await aiAdapter.run(MODEL_IMAGE_FLUX, { prompt: fluxPrompt });
      const duration = Date.now() - startTime;

      if (rawImg instanceof ArrayBuffer) {
        imgBuffer = Buffer.from(rawImg);
      } else if (Buffer.isBuffer(rawImg)) {
        imgBuffer = rawImg;
      } else {
        throw new Error("Formato de respuesta de Flux no reconocido como binario.");
      }

      // Validar integridad de imagen JPEG (magic bytes)
      if (!isValidJpeg(imgBuffer)) {
        throw new Error("RESPUESTA_INVALIDA: Los bytes recibidos no corresponden a un JPEG válido.");
      }

      // Guardar imagen en disco de forma segura
      fs.writeFileSync(targetFilePath, imgBuffer);
      console.log(`  ✔ Portada guardada: ${art.filename} (${imgBuffer.length} bytes, ${duration}ms)`);

      results.push({
        id: art.id,
        filename: art.filename,
        path: targetFilePath,
        sizeBytes: imgBuffer.length,
        visualScene,
        fluxPrompt,
        briefSource,
        durationMs: duration,
        status: "SUCCESS"
      });

    } catch (fErr) {
      fluxError = fErr.message || String(fErr);
      console.error(`  ❌ Error al generar imagen en Flux: ${fluxError}`);
      results.push({
        id: art.id,
        filename: art.filename,
        error: fluxError,
        status: "FAILED"
      });
    }
  }

  console.log("\n=====================================================");
  console.log(` Resumen de Ejecución: Llama Calls: ${llamaCallsCount}, Flux Calls: ${fluxCallsCount}`);
  console.log("=====================================================");

  return {
    ok: results.every(r => r.status === "SUCCESS" || r.skipped),
    mode: "live-execution",
    callsCount: { llama: llamaCallsCount, flux: fluxCallsCount },
    results
  };
}

// Ejecutar si se invoca directamente desde CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runVisualValidation().catch(e => {
    console.error("Fallo crítico en script:", e);
    process.exit(1);
  });
}

