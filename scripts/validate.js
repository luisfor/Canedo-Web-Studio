const fs = require('fs');
const path = require('path');

const targetDir = process.argv[2] ? path.join(__dirname, '../cazas', process.argv[2]) : path.join(__dirname, '../starter-template');

let hasErrors = false;
let hasWarnings = false;

function report(level, msg) {
  if (level === 'ERROR') {
    console.error(`❌ [ERROR] ${msg}`);
    hasErrors = true;
  } else if (level === 'WARNING') {
    console.warn(`⚠️  [WARNING] ${msg}`);
    hasWarnings = true;
  } else {
    console.log(`✅ [PASS] ${msg}`);
  }
}

console.log(`\n🔍 Validando: ${targetDir}\n`);

if (!fs.existsSync(targetDir)) {
  report('ERROR', `El directorio ${targetDir} no existe.`);
  process.exit(1);
}

// 1. Validar HTML
const htmlPath = path.join(targetDir, 'index.html');
if (fs.existsSync(htmlPath)) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  
  // H1 Check
  const h1Matches = html.match(/<h1\b[^>]*>(.*?)<\/h1>/gi);
  if (!h1Matches) {
    report('ERROR', 'No se encontró ninguna etiqueta <h1>.');
  } else if (h1Matches.length > 1) {
    report('ERROR', `Se encontraron ${h1Matches.length} etiquetas <h1>. Solo debe haber 1.`);
  } else {
    report('PASS', 'Existe exactamente 1 etiqueta <h1>.');
  }

  // Google Fonts Check
  if (html.includes('fonts.googleapis.com')) {
    report('ERROR', 'Se detectaron Google Fonts externos (fonts.googleapis.com). Usa fuentes locales.');
  } else {
    report('PASS', 'No hay Google Fonts externos en el HTML.');
  }

  // ScrollTrigger Check
  if (html.includes('ScrollTrigger.min.js')) {
    report('ERROR', 'Se detectó referencia a ScrollTrigger.min.js en el HTML. Prohibido por defecto.');
  } else {
    report('PASS', 'No hay referencias a ScrollTrigger en el HTML.');
  }

  // Alt attribute in imgs
  const imgMatches = html.match(/<img\b[^>]*>/gi) || [];
  let missingAlt = 0;
  imgMatches.forEach(img => {
    if (!img.includes('alt=')) missingAlt++;
  });
  if (missingAlt > 0) {
    report('ERROR', `${missingAlt} imágenes no tienen atributo alt.`);
  } else {
    report('PASS', 'Todas las imágenes tienen atributo alt.');
  }

} else {
  report('ERROR', 'Falta index.html');
}

// 2. Validar CSS
const cssPath = path.join(targetDir, 'styles.css');
if (fs.existsSync(cssPath)) {
  const css = fs.readFileSync(cssPath, 'utf8');
  if (css.includes('opacity: 0') && css.includes('.hero-title')) {
    report('WARNING', 'El hero-title parece tener opacity: 0 en el CSS. Esto daña el LCP.');
  } else {
    report('PASS', 'No se detectó ocultación obvia del LCP en CSS.');
  }
}

// 3. Validar JS
const jsPath = path.join(targetDir, 'main.js');
if (fs.existsSync(jsPath)) {
  const js = fs.readFileSync(jsPath, 'utf8');
  if (js.includes('console.log')) {
    report('WARNING', 'Se encontraron console.log en main.js.');
  }
}

// 4. Validar configs Cloudflare
const tomlPath = path.join(targetDir, 'wrangler.toml');
if (!fs.existsSync(tomlPath)) {
  report('WARNING', 'Falta wrangler.toml para Cloudflare Pages.');
}

console.log('\n--- RESULTADO FINAL ---');
if (hasErrors) {
  console.error('\n❌ ERROR: La validación falló debido a errores críticos.');
  process.exit(1);
} else if (hasWarnings) {
  console.warn('\n⚠️ WARNING: La validación pasó con advertencias.');
  process.exit(0);
} else {
  console.log('\n✅ PASS: Todas las validaciones fueron superadas exitosamente.');
  process.exit(0);
}
