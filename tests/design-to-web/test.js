const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TESTS = [
  { file: 'tests/design-to-web/simple-landing.png', project: 'test-png', expectSuccess: true },
  { file: 'tests/design-to-web/sample.pdf', project: 'test-pdf', expectSuccess: true },
  { file: 'tests/design-to-web/invalid.txt', project: 'test-invalid', expectSuccess: false },
  { file: 'tests/design-to-web/no-existe.png', project: 'test-missing', expectSuccess: false }
];

console.log("=== Corriendo Tests de Design-to-Web FASE 2 ===");

let passed = 0;

for (const t of TESTS) {
  console.log(`\n> Test: ${t.file}`);
  try {
    execSync(`npm run design-to-web:analyze -- ${t.file} ${t.project}`, { stdio: 'ignore' });
    if (t.expectSuccess) {
      console.log("  [PASS] Ejecución exitosa como se esperaba.");
      passed++;
    } else {
      console.log("  [FAIL] Se esperaba error pero terminó con éxito.");
    }
  } catch (e) {
    if (!t.expectSuccess) {
      console.log("  [PASS] Falló correctamente como se esperaba.");
      passed++;
    } else {
      console.log("  [FAIL] Error inesperado.");
    }
  }
}

console.log(`\nResultados: ${passed}/${TESTS.length} tests pasados.`);
if (passed !== TESTS.length) {
  process.exit(1);
}
