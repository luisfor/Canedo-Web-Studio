const { execSync } = require('child_process');

console.log("=== Corriendo Tests de Design-to-Web FASE 4 (QA) ===");

// Usamos el proyecto generado en la Fase 3 (test-png) que tiene el site/ compilado.
const PROJECT = 'test-png';

try {
  console.log(`\n> Ejecutando QA Visual para proyecto: ${PROJECT}`);
  execSync(`npm run design-to-web:qa -- ${PROJECT}`, { stdio: 'inherit' });
  console.log("  [PASS] QA exitoso.");
} catch (e) {
  console.error("  [FAIL] Error en QA.");
  process.exit(1);
}
