require('dotenv').config();
const { execSync } = require('child_process');

console.log("=== Corriendo Tests de Design-to-Web FASE 4.5 (Gemini) ===");

if (!process.env.GEMINI_API_KEY) {
  console.log("SKIPPED — GEMINI_API_KEY NOT CONFIGURED");
  process.exit(0);
}

// Integration Test Real (opcional, solo si la key existe)
console.log("> GEMINI_API_KEY detectada. Ejecutando integration test...");

const PROJECT = 'test-gemini-integration';
const TEST_IMAGE = 'tests/design-to-web/simple-landing.png';

try {
  // Solo lanzaremos un analyze para ver si responde, NO build.
  execSync(`DESIGN_AI_PROVIDER=gemini npm run design-to-web:analyze -- ${TEST_IMAGE} ${PROJECT}`, { stdio: 'inherit' });
  console.log("  [PASS] Integración con Gemini exitosa.");
} catch (e) {
  console.error("  [FAIL] Error en integración con Gemini.");
  process.exit(1);
}
