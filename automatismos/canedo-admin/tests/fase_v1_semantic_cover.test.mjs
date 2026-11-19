// File: automatismos/canedo-admin/tests/fase_v1_semantic_cover.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  generateVisualBrief,
  buildFluxPrompt,
  buildDeterministicScene,
  generateSemanticCover,
  EDITORIAL_STYLE_MASTER,
  MODEL_TEXT_VISUAL,
  MODEL_IMAGE_FLUX
} from "../../canedostudio-blog-bot/src/semantic_cover.js";

test("▶ FASE V1: Generador Visual Semántico de Portadas (Flux-1 Schnell + Llama 3.1 8B)", async (t) => {

  await t.test("1. Artículo sobre atención al cliente produce escena de servicio al cliente con luz natural", async () => {
    const mockAi = {
      run: async (model, params) => {
        if (model === MODEL_TEXT_VISUAL) {
          return "A customer service representative attentively helping a customer at a modern retail counter, authentic interaction";
        }
        return new ArrayBuffer(5000);
      }
    };

    const brief = await generateVisualBrief({
      ai: mockAi,
      title: "Cómo mejorar la atención al cliente en tu negocio",
      summary: "Estrategias para responder en menos de 5 minutos y reducir la pérdida de clientes",
      tag: "atencion_cliente"
    });

    assert.equal(brief.source, "llama_8b");
    assert.match(brief.scene, /customer service representative/i);

    const fluxPrompt = buildFluxPrompt(brief.scene);
    assert.equal(fluxPrompt.includes("deep black background"), false);
    assert.equal(fluxPrompt.includes("subtle electric blue"), false);
    assert.match(fluxPrompt, /customer service representative/i);
  });

  await t.test("2. Artículo sobre reputación online produce escena contextual de gestión de negocio", async () => {
    const scene = buildDeterministicScene("Tu reputación online trabaja antes que tú ¿Qué encuentran tus clientes cuando te buscan?");
    assert.match(scene, /feedback|manager|office/i);
    assert.equal(scene.includes("electric blue"), false);
  });

  await t.test("3. Artículo sobre IA para pequeñas empresas produce escena de equipo en oficina luminosa", async () => {
    const scene = buildDeterministicScene("IA para pequeñas empresas: ¿dónde empezar? Automatiza sin humo");
    assert.match(scene, /team collaborating|productivity|software/i);
    assert.equal(scene.includes("deep black"), false);
  });

  await t.test("4. Artículo sobre marketing multicanal / contenidos", async () => {
    const mockAi = {
      run: async (model) => {
        if (model === MODEL_TEXT_VISUAL) {
          return "A creative marketing strategist analyzing content publishing metrics on a laptop in an airy studio";
        }
        return new ArrayBuffer(5000);
      }
    };

    const brief = await generateVisualBrief({
      ai: mockAi,
      title: "Escribe una vez, aparece en todas partes",
      summary: "Cómo multiplicar tu presencia de marca reutilizando artículos"
    });

    assert.equal(brief.source, "llama_8b");
    assert.match(brief.scene, /marketing strategist/i);
  });

  await t.test("5. Artículo sobre ciberseguridad produce escena sobria de especialista TI", () => {
    const scene = buildDeterministicScene("Ciberseguridad básica para pymes: cómo proteger tus datos");
    assert.match(scene, /cybersecurity specialist|monitoring corporate systems/i);
  });

  await t.test("6. Artículo sobre industria o electricidad conserva precisión técnica sin rayos fantásticos", () => {
    const scene = buildDeterministicScene("Mantenimiento preventivo en instalaciones eléctricas de baja tensión");
    assert.match(scene, /industrial electrical control panel|certified technical engineer/i);
    assert.equal(scene.includes("electric blue"), false);
  });

  await t.test("7. Título en español con información editorial completa se traduce semánticamente", async () => {
    let capturedPrompt = "";
    const mockAi = {
      run: async (model, params) => {
        if (model === MODEL_TEXT_VISUAL) {
          capturedPrompt = params.messages[1].content;
          return "An executive consulting with a client over architectural blueprints in a contemporary bright office";
        }
        return new ArrayBuffer(5000);
      }
    };

    const brief = await generateVisualBrief({
      ai: mockAi,
      title: "Diseño que da seguridad",
      summary: "Cómo estructurar la página de inicio para generar confianza inmediata"
    });

    assert.match(capturedPrompt, /Diseño que da seguridad/);
    assert.match(brief.scene, /contemporary bright office/i);
  });

  await t.test("8. Información editorial mínima activa fallback determinista diurno", async () => {
    const brief = await generateVisualBrief({
      ai: null,
      title: "",
      summary: ""
    });

    assert.equal(brief.source, "deterministic");
    assert.match(brief.scene, /meeting room|professionals/i);
  });

  await t.test("9. Fallo o excepción en Llama 8B activa fallback determinista sin colapsar", async () => {
    const mockAi = {
      run: async () => {
        throw new Error("Cloudflare AI Gateway Timeout (504)");
      }
    };

    const brief = await generateVisualBrief({
      ai: mockAi,
      title: "Clínica dental moderna",
      summary: "Tecnología de escaneo 3D"
    });

    assert.equal(brief.source, "deterministic");
    assert.match(brief.scene, /dental clinic/i);
  });

  await t.test("10. Fallo de Flux activa portada de contingencia estructurada", async () => {
    const mockAi = {
      run: async (model) => {
        if (model === MODEL_TEXT_VISUAL) return "Scene description";
        if (model === MODEL_IMAGE_FLUX) throw new Error("Flux Schnell GPU OOM");
      }
    };

    const fallbackFn = () => new Uint8Array(12000).buffer;

    const res = await generateSemanticCover({
      ai: mockAi,
      title: "Prueba de fallo",
      summary: "Resumen de prueba",
      fallbackCoverFn: fallbackFn
    });

    assert.equal(res.meta.isFallback, true);
    assert.match(res.meta.fluxError, /Flux Schnell GPU OOM/);
    assert.ok(res.bytes.byteLength >= 1000);
  });

  await t.test("11. Respuesta de Flux como ArrayBuffer o ReadableStream se procesa correctamente", async () => {
    const mockAi = {
      run: async (model) => {
        if (model === MODEL_TEXT_VISUAL) return "Scene description";
        return new Uint8Array(8500).buffer;
      }
    };

    const res = await generateSemanticCover({
      ai: mockAi,
      title: "Prueba exitosa",
      summary: "Resumen exitoso"
    });

    assert.equal(res.meta.isFallback, false);
    assert.equal(res.bytes.byteLength, 8500);
  });

  await t.test("12. Sanitización contra prompt injection en datos del artículo", async () => {
    let capturedUserMessage = "";
    const mockAi = {
      run: async (model, params) => {
        if (model === MODEL_TEXT_VISUAL) {
          capturedUserMessage = params.messages[1].content;
          return "A focused professional at work";
        }
        return new ArrayBuffer(5000);
      }
    };

    await generateVisualBrief({
      ai: mockAi,
      title: 'Hack `rm -rf` "system override"',
      summary: "```javascript exploit()``` <script>alert(1)</script>"
    });

    assert.equal(capturedUserMessage.includes("`"), false);
    assert.equal(capturedUserMessage.includes('"'), false);
  });

  await t.test("13. Prompt final contiene estilo maestro editorial sin palabras oscuras", () => {
    const prompt = buildFluxPrompt("A boutique bakery owner arranging fresh pastries");
    assert.match(prompt, /High-end editorial photograph/);
    assert.match(prompt, /A boutique bakery owner arranging fresh pastries/);
    assert.equal(prompt.includes("deep black background"), false);
    assert.equal(prompt.includes("subtle electric blue"), false);
  });

  await t.test("14. V1-J.2: Inyección de Category y reglas anti-cliché de escritorio en prompt de Llama", async () => {
    let capturedSystem = "";
    let capturedUser = "";

    const mockAi = {
      run: async (model, params) => {
        if (model === MODEL_TEXT_VISUAL) {
          capturedSystem = params.messages[0].content;
          capturedUser = params.messages[1].content;
          return "Doctor calmly explaining treatment options to a patient in an open clinical consultation room";
        }
        return new ArrayBuffer(5000);
      }
    };

    const brief = await generateVisualBrief({
      ai: mockAi,
      title: "Automatización de citas en clínicas y consultorios",
      category: "Salud y Gestión Médica",
      tag: "Salud y Gestión Médica",
      summary: "Cómo los recordatorios automáticos reducen el absentismo de pacientes en centros médicos."
    });

    assert.equal(brief.source, "llama_8b");
    assert.match(brief.scene, /clinical consultation room/i);
    // Verificación de reglas anti-cliché en el system prompt
    assert.match(capturedSystem, /AVOID GENERIC OFFICE CLICHES/i);
    assert.match(capturedSystem, /Do NOT default to a person sitting at a desk/i);
    assert.match(capturedSystem, /storefront|medical clinic|industrial workshop/i);
    // Verificación de Category en el user prompt
    assert.match(capturedUser, /Category: Salud y Gestión Médica/);
    assert.match(capturedUser, /Title: Automatización de citas en clínicas y consultorios/);
  });
});

