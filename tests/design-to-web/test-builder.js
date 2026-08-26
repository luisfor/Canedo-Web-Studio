const { execSync } = require('child_process');

console.log("=== Corriendo Tests de Design-to-Web FASE 3 (Builder) ===");

// Usamos el proyecto generado en la Fase 2 (test-png) que tiene un design-spec.json válido.
const PROJECT = 'test-png';

try {
  console.log(`\n> Ejecutando Builder para proyecto: ${PROJECT}`);
  execSync(`npm run design-to-web:build -- ${PROJECT}`, { stdio: 'inherit' });
  console.log("  [PASS] Build exitoso.");
} catch (e) {
  console.error("  [FAIL] Error en el build.");
  process.exit(1);
}
