// File: automatismos/canedostudio-blog-bot/tests/harness/worker.js
/**
 * Arnés de Pruebas Aislado para Generación Semántica de Portadas (Fase V1-F/G)
 * Canedo Studio (canedostudio.com)
 * 
 * Reglas de Seguridad y Aislamiento:
 * 1. Importa directamente las funciones puras de 'src/semantic_cover.js'.
 * 2. CERO acceso a D1, KV, R2 o CRM.
 * 3. En estado de reposo, las inferencias están BLOQUEADAS por defecto.
 */

import {
  generateSemanticCover,
  generateVisualBrief,
  buildFluxPrompt,
  buildDeterministicScene,
  EDITORIAL_STYLE_MASTER,
  MODEL_TEXT_VISUAL,
  MODEL_IMAGE_FLUX
} from "../../src/semantic_cover.js";

// Bloqueo permanente de inferencias tras la prueba V1-K
const INFERENCES_LOCKED = true;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. Endpoint de Diagnóstico Seguro
    if (url.pathname === "/diagnose" || url.pathname === "/") {
      const hasAiBinding = Boolean(env && env.AI && typeof env.AI.run === "function");
      const hasStorage = Boolean(env.BLOG_DB || env.BLOG_POSTS || env.ADMIN_KV || env.CONTACT_DB);

      return new Response(JSON.stringify({
        status: INFERENCES_LOCKED ? "LOCKED_AFTER_TEST" : "READY_LOCAL_HARNESS",
        phase: "V1-K_COMPLETED",
        workerName: "canedo-visual-harness",
        hasAiBinding,
        hasStorageBindings: hasStorage,
        inferencesLocked: INFERENCES_LOCKED,
        supportedModels: [MODEL_TEXT_VISUAL, MODEL_IMAGE_FLUX],
        message: "Prueba V1-K finalizada con éxito. Arnés bloqueado contra nuevas inferencias."
      }, null, 2), {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8" }
      });
    }

    // 2. Endpoint de Previsualización de Prompts (Seguro y offline, cero llamadas a IA)
    if (url.pathname === "/preview-prompt") {
      const caseId = url.searchParams.get("case") || "ia-pymes";
      let topic = {
        title: "IA para pequeñas empresas: ¿dónde empezar?",
        summary: "Estrategias prácticas de software y productividad para pymes locales.",
        target_audience: "PYMES y profesionales",
        category: "Tecnología"
      };

      if (caseId === "reputacion-online") {
        topic = {
          title: "Tu reputación online trabaja antes que tú",
          summary: "Cómo gestionar reseñas y valoraciones en Google Maps para fidelizar clientes.",
          category: "Reputación"
        };
      } else if (caseId === "contenido-multicanal") {
        topic = {
          title: "Escribe una vez, aparece en todas partes",
          summary: "Automatización de contenidos y flujos digitales de trabajo.",
          category: "Marketing"
        };
      }

      if (request.method === "POST") {
        try {
          const body = await request.json();
          if (body && body.title) topic = body;
        } catch (_) {}
      }

      const deterministicScene = buildDeterministicScene(topic.title + " " + (topic.summary || ""));
      const prompt = buildFluxPrompt(deterministicScene);

      return new Response(JSON.stringify({
        ok: true,
        caseId,
        topic,
        deterministicScene,
        prompt,
        masterStyle: EDITORIAL_STYLE_MASTER,
        inferencesExecuted: false,
        zeroAiCalls: true
      }, null, 2), {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8" }
      });
    }

    // 3. Rutas Bloqueadas
    if (url.pathname === "/generate" || url.pathname === "/pipeline-step-v1-j1" || url.pathname === "/pipeline-step-v1-j3" || url.pathname === "/generate-v1k") {
      return new Response(JSON.stringify({
        error: "INFERENCES_BLOCKED_IN_V1_F",
        message: "La prueba ha concluido y el arnés ha sido bloqueado nuevamente.",
        status: 403
      }, null, 2), { status: 403, headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "NOT_FOUND" }), { status: 404 });
  }
};
