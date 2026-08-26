const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const componentsRegistry = require('./components/index');

function generateCSSVariables(designSystem) {
  let css = ':root {\\n';
  
  if (designSystem.colors) {
    for (const [key, value] of Object.entries(designSystem.colors)) {
      css += `  --color-${key}: ${value};\\n`;
    }
  }
  
  if (designSystem.typography) {
    if (designSystem.typography.headings) {
      css += `  --font-heading: "${designSystem.typography.headings.family}", sans-serif;\\n`;
    }
    if (designSystem.typography.body) {
      css += `  --font-body: "${designSystem.typography.body.family}", sans-serif;\\n`;
    }
  }
  
  if (designSystem.spacing) {
    for (const [key, value] of Object.entries(designSystem.spacing)) {
      css += `  --space-${key}: ${value};\\n`;
    }
  }
  
  css += '}\\n';
  return css;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error("Uso: npm run design-to-web:build -- <proyecto>");
    process.exit(1);
  }

  const projectName = args[0];
  const workspaceDir = path.join(process.cwd(), '.qa-workspace', projectName);
  const specPath = path.join(workspaceDir, 'design-spec.json');

  if (!fs.existsSync(specPath)) {
    console.error(`[Builder] Error: No se encontró design-spec.json en ${workspaceDir}`);
    process.exit(1);
  }

  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  
  const siteDir = path.join(workspaceDir, 'site');
  const starterDir = path.join(process.cwd(), 'starter-template');

  console.log(`[Builder] Limpiando y creando directorio temporal site/ ...`);
  if (fs.existsSync(siteDir)) {
    fs.rmSync(siteDir, { recursive: true, force: true });
  }
  
  // Recursively copy starter template to siteDir
  function copyRecursiveSync(src, dest) {
    const exists = fs.existsSync(src);
    const stats = exists && fs.statSync(src);
    const isDirectory = exists && stats.isDirectory();
    if (isDirectory) {
      fs.mkdirSync(dest, { recursive: true });
      fs.readdirSync(src).forEach(childItemName => {
        copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
      });
    } else {
      fs.copyFileSync(src, dest);
    }
  }
  
  copyRecursiveSync(starterDir, siteDir);

  const warnings = [];
  const unknownComponents = [];
  const missingAssets = [];
  let filesGenerated = 0;
  let componentsMapped = 0;

  console.log(`[Builder] Generando custom.css a partir de designSystem...`);
  const customCssContent = generateCSSVariables(spec.designSystem || {});
  const customCssPath = path.join(siteDir, 'custom.css');
  fs.writeFileSync(customCssPath, customCssContent);
  filesGenerated++;

  console.log(`[Builder] Analizando Assets...`);
  if (spec.assets) {
    spec.assets.forEach(asset => {
      if (asset.status === 'MISSING') {
        warnings.push(`Asset faltante (MISSING): ${asset.id}`);
        missingAssets.push(asset.id);
      }
      if (asset.status === 'RECREATE') {
        warnings.push(`Asset requiere recreación manual CSS/SVG: ${asset.id}`);
      }
    });
  }

  console.log(`[Builder] Generando HTML desde componentes...`);
  let bodyHtml = '';
  if (spec.sections) {
    spec.sections.forEach(section => {
      if (!componentsRegistry.isKnown(section.type)) {
        unknownComponents.push(section.type);
        warnings.push(`Componente desconocido: ${section.type}`);
      }
      bodyHtml += componentsRegistry.render(section) + '\\n';
      componentsMapped++;
      
      if (section.components) {
        componentsMapped += section.components.length;
      }
    });
  }

  const indexHtmlPath = path.join(siteDir, 'index.html');
  let indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  
  // Link custom.css
  if (!indexHtml.includes('custom.css')) {
    indexHtml = indexHtml.replace('</head>', '  <link rel="stylesheet" href="custom.css">\\n</head>');
  }
  
  // Inject body
  indexHtml = indexHtml.replace('<!-- INJECT_CONTENT -->', bodyHtml);
  fs.writeFileSync(indexHtmlPath, indexHtml);
  filesGenerated++;
  
  const report = {
    status: warnings.length > 0 ? 'WARNING' : 'PASS',
    filesGenerated,
    componentsMapped,
    unknownComponents,
    missingAssets,
    warnings,
    customCssSize: Buffer.byteLength(customCssContent, 'utf8'),
    timestamp: new Date().toISOString(),
    builderVersion: "1.0.0"
  };
  
  const reportPath = path.join(workspaceDir, 'build-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log(`[Builder] Build completado. Reporte en build-report.json`);
  if (warnings.length > 0) {
    console.warn(`[Builder] Se detectaron warnings durante el build:`);
    warnings.forEach(w => console.warn(`  - ${w}`));
  }

  console.log(`[Builder] Ejecutando validación oficial...`);
  try {
    execSync(`npm run validate ../.qa-workspace/${projectName}/site`, { stdio: 'inherit' });
  } catch (e) {
    console.error(`[Builder] Validación posterior al build reportó errores.`);
  }
}

main().catch(console.error);
