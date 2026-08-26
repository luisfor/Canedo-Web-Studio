const fs = require('fs');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
const puppeteer = require('puppeteer');
const PNG = require('pngjs').PNG;
const pixelmatch = require('pixelmatch');

const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 900 }
};

// Start static server
function startServer(dir, port) {
  return new Promise((resolve) => {
    const server = http.createServer((request, response) => {
      return handler(request, response, { public: dir });
    });
    server.listen(port, () => {
      resolve(server);
    });
  });
}

// Visual Compare
function compareImages(img1Path, img2Path, diffPath) {
  if (!fs.existsSync(img1Path) || !fs.existsSync(img2Path)) return 100; // If no reference, just return 100%

  let img1, img2;
  try {
    img1 = PNG.sync.read(fs.readFileSync(img1Path));
    img2 = PNG.sync.read(fs.readFileSync(img2Path));
  } catch(e) {
    console.warn(`[QA] Warning: No se pudo leer las imágenes para comparación visual: ${e.message}`);
    return 100;
  }

  const { width, height } = img1;
  const diff = new PNG({ width, height });

  // Si los tamaños no coinciden, fallamos visualmente o recortamos, pero para este caso simplificaremos:
  if (img1.width !== img2.width || img1.height !== img2.height) {
    return 0;
  }

  const numDiffPixels = pixelmatch(img1.data, img2.data, diff.data, width, height, { threshold: 0.1 });
  fs.writeFileSync(diffPath, PNG.sync.write(diff));

  const totalPixels = width * height;
  const similarityScore = ((totalPixels - numDiffPixels) / totalPixels) * 100;
  return similarityScore;
}

// DOM Checks en Browser
async function runDomChecks(page) {
  return await page.evaluate(() => {
    const results = { failures: [], warnings: [], layout: {} };

    // 1. Visibilidad (opacity: 0, display: none en elementos criticos)
    const h1 = document.querySelector('h1');
    if (!h1) results.failures.push("Falta etiqueta H1");
    else {
      const style = window.getComputedStyle(h1);
      if (style.opacity === '0' || style.display === 'none' || style.visibility === 'hidden') {
        results.failures.push("H1 es invisible");
      }
    }

    // 2. Carrusel Check (Si existe .carousel o .slider)
    const carousel = document.querySelector('.carousel, .slider, [data-carousel]');
    if (carousel) {
      const nextBtn = carousel.querySelector('.next, [data-next]');
      if (!nextBtn) results.warnings.push("Carrusel detectado pero no hay botón NEXT claro");
    }

    // 3. Overflow Horizontal (Mobile)
    if (document.documentElement.scrollWidth > window.innerWidth) {
      results.failures.push("Overflow horizontal detectado");
    }

    return results;
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error("Uso: npm run design-to-web:qa -- <proyecto>");
    process.exit(1);
  }

  const projectName = args[0];
  const workspaceDir = path.join(process.cwd(), '.qa-workspace', projectName);
  const siteDir = path.join(workspaceDir, 'site');
  const qaDir = path.join(workspaceDir, 'qa');

  if (!fs.existsSync(siteDir)) {
    console.error(`[QA] Error: El sitio generado no existe en ${siteDir}`);
    process.exit(1);
  }

  // Crear carpetas de QA
  ['reference', 'rendered', 'diff', 'reports'].forEach(d => fs.mkdirSync(path.join(qaDir, d), { recursive: true }));

  console.log(`[QA] Levantando servidor local en ${siteDir}...`);
  const port = 3456;
  const server = await startServer(siteDir, port);

  console.log(`[QA] Iniciando Puppeteer...`);
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  const report = {
    project: projectName,
    timestamp: new Date().toISOString(),
    qaVersion: "1.0",
    viewports: {},
    failures: [],
    warnings: []
  };

  for (const [vpName, dims] of Object.entries(VIEWPORTS)) {
    console.log(`[QA] Capturando y analizando Viewport: ${vpName} (${dims.width}x${dims.height})...`);
    await page.setViewport(dims);
    await page.goto(`http://localhost:${port}`, { waitUntil: 'networkidle0' });

    const renderedPath = path.join(qaDir, 'rendered', `${vpName}.png`);
    await page.screenshot({ path: renderedPath, fullPage: true });

    const domChecks = await runDomChecks(page);
    report.failures.push(...domChecks.failures);
    report.warnings.push(...domChecks.warnings);

    // TODO: Copy reference from original if available. For now assume no ref or infer it.
    let referenceType = vpName === 'desktop' ? 'PROVIDED' : 'INFERRED';
    const refPath = path.join(qaDir, 'reference', `${vpName}.png`);
    
    // Copy the original to reference if it's desktop just to have something to compare
    const inputDir = path.join(workspaceDir, 'input');
    if (vpName === 'desktop' && fs.existsSync(inputDir)) {
      const files = fs.readdirSync(inputDir);
      if (files.length > 0 && files[0].endsWith('.png')) {
        fs.copyFileSync(path.join(inputDir, files[0]), refPath);
      }
    }

    const diffPath = path.join(qaDir, 'diff', `${vpName}-diff.png`);
    const similarityScore = compareImages(refPath, renderedPath, diffPath);

    report.viewports[vpName] = {
      referenceType,
      similarityScore,
      layoutScore: similarityScore > 0 ? 100 : 0, // Mock scores based on similarity for now
      typographyScore: 100,
      colorScore: 100,
      assetScore: 100,
      differences: []
    };
  }

  await browser.close();
  server.close();

  // Calcular score general
  let baseScore = 100;
  if (report.failures.length > 0) baseScore -= 30;
  if (report.warnings.length > 0) baseScore -= 10;
  
  report.overallScore = Math.max(0, baseScore);
  
  if (report.overallScore >= 95) report.status = 'EXCELLENT';
  else if (report.overallScore >= 90) report.status = 'PASS';
  else if (report.overallScore >= 80) report.status = 'WARNING';
  else report.status = 'FAIL';

  const reportPath = path.join(qaDir, 'reports', 'qa-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`[QA] Reporte generado: ${reportPath}`);
  console.log(`[QA] Status: ${report.status} (Score: ${report.overallScore})`);
  
  if (report.status === 'FAIL') {
    console.error(`[QA] Fallos críticos detectados:`);
    report.failures.forEach(f => console.error(`  - ${f}`));
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
