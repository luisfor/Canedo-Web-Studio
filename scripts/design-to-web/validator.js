const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');

function main() {
  const specPath = process.argv[2];
  if (!specPath || !fs.existsSync(specPath)) {
    console.error("[Validator] Error: Ruta del spec no proporcionada o no existe.");
    process.exit(1);
  }

  console.log(`[Validator] Validando ${specPath}...`);
  
  const specData = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  const schemaPath = path.join(__dirname, 'design-spec.schema.json');
  const schemaData = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

  const ajv = new Ajv({ allErrors: true });
  const validate = ajv.compile(schemaData);
  const valid = validate(specData);

  const errors = [];
  const warnings = [];

  if (!valid) {
    validate.errors.forEach(err => {
      errors.push(`${err.instancePath} ${err.message}`);
    });
  }

  // Custom Warnings
  if (specData.metadata && specData.metadata.inferredMobile) {
    warnings.push("Mobile behavior inferred. Revisar durante QA.");
  }
  
  if (specData.assets) {
    specData.assets.forEach(asset => {
      if (asset.status === 'MISSING') {
        warnings.push(`Asset missing: ${asset.id}`);
      }
    });
  }

  if (specData.sections && specData.sections.length === 0) {
    errors.push("Sections array is empty.");
  }

  let status = 'PASS';
  if (warnings.length > 0) status = 'WARNING';
  if (errors.length > 0) status = 'ERROR';

  const report = {
    status,
    errors,
    warnings,
    timestamp: new Date().toISOString(),
    schemaVersion: schemaData.$schema || "1.0",
    analyzerVersion: specData.metadata?.analyzerVersion || "1.0"
  };

  const reportPath = path.join(path.dirname(specPath), 'validation-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`[Validator] Status: ${status}`);
  if (errors.length > 0) {
    console.error("[Validator] Errores Críticos:");
    errors.forEach(e => console.error(`  - ${e}`));
  }
  if (warnings.length > 0) {
    console.warn("[Validator] Warnings:");
    warnings.forEach(w => console.warn(`  - ${w}`));
  }
  
  console.log(`[Validator] Reporte guardado en ${reportPath}`);

  if (status === 'ERROR') {
    process.exit(1);
  }
}

main();
