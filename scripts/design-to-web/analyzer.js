const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const aiAdapter = require('./adapters');

const SUPPORTED_FORMATS = ['.png', '.jpg', '.jpeg', '.webp', '.pdf'];

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error("Uso: npm run design-to-web:analyze -- <archivo> <proyecto>");
    process.exit(1);
  }

  const inputFile = args[0];
  const projectName = args[1];

  if (!fs.existsSync(inputFile)) {
    console.error(`[Analyzer] Error: El archivo ${inputFile} no existe.`);
    process.exit(1);
  }

  const ext = path.extname(inputFile).toLowerCase();
  if (!SUPPORTED_FORMATS.includes(ext)) {
    console.error(`[Analyzer] Error: Formato no soportado (${ext}). Soportados: ${SUPPORTED_FORMATS.join(', ')}`);
    process.exit(1);
  }

  // Path de trabajo seguro
  const workspaceDir = path.join(process.cwd(), '.qa-workspace', projectName);
  const inputDir = path.join(workspaceDir, 'input');

  fs.mkdirSync(inputDir, { recursive: true });

  const destFile = path.join(inputDir, path.basename(inputFile));
  fs.copyFileSync(inputFile, destFile);

  console.log(`[Analyzer] Copiando archivo de referencia a ${destFile}`);

  const stat = fs.statSync(inputFile);
  const metadata = {
    originalFile: inputFile,
    fileType: ext.replace('.', ''),
    fileSize: stat.size
  };

  const promptPath = path.join(__dirname, 'analyzer-prompt.md');
  const prompt = fs.existsSync(promptPath) ? fs.readFileSync(promptPath, 'utf8') : '';

  console.log(`[Analyzer] Iniciando análisis con IA (Provider: ${process.env.DESIGN_AI_PROVIDER || 'mock'})...`);
  
  const rawSpec = await aiAdapter.analyzeDesign(destFile, prompt, metadata);

  const rawSpecPath = path.join(workspaceDir, 'design-spec.raw.json');
  fs.writeFileSync(rawSpecPath, JSON.stringify(rawSpec, null, 2));

  console.log(`[Analyzer] Normalizando spec...`);
  // Normalization simple
  const spec = JSON.parse(JSON.stringify(rawSpec)); // Deep clone
  if (!spec.metadata) spec.metadata = {};
  spec.metadata.inferredMobile = spec.metadata.inferredMobile || false;

  const specPath = path.join(workspaceDir, 'design-spec.json');
  fs.writeFileSync(specPath, JSON.stringify(spec, null, 2));
  console.log(`[Analyzer] Spec guardado en ${specPath}`);

  // Llamar al validator
  console.log(`[Analyzer] Ejecutando validación...`);
  try {
    execSync(`node scripts/design-to-web/validator.js "${specPath}"`, { stdio: 'inherit' });
  } catch (e) {
    console.error(`[Analyzer] Validación falló.`);
    process.exit(1);
  }
}

main().catch(console.error);
