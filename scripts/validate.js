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

// Check placeholders remaining
function checkPlaceholders(filePath, content) {
  const matches = content.match(/\{\{.*?\}\}/g);
  if (matches) {
    report('WARNING', `Se encontraron placeholders sin reemplazar en ${path.basename(filePath)}: ${matches.join(', ')}`);
  }
}

// Check assets existence
function checkAsset(relPath, sourceFile) {
  const absPath = path.join(targetDir, relPath.split('?')[0]); // ignore query params like ?v=1.0
  if (!fs.existsSync(absPath)) {
    report('ERROR', `Falta el archivo referenciado: ${relPath} (en ${sourceFile})`);
  }
}

// Validate JSON-LD
function validateJsonLd(filePath, html) {
  const regex = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  let count = 0;
  while ((match = regex.exec(html)) !== null) {
    count++;
    const jsonStr = match[1];
    
    // Check for www (specifically in URLs)
    if (/https?:\/\/www\./i.test(jsonStr)) {
      report('WARNING', `El JSON-LD en ${path.basename(filePath)} contiene URLs con 'www'. Se prefiere dominio desnudo.`);
    }

    try {
      const data = JSON.parse(jsonStr);
      report('PASS', `JSON-LD válido en ${path.basename(filePath)} (Bloque ${count})`);
      
      // Duplicate ID Check
      if (data['@graph'] && Array.isArray(data['@graph'])) {
        const ids = new Set();
        let duplicate = false;
        for (const item of data['@graph']) {
          if (item['@id']) {
            if (ids.has(item['@id'])) {
              report('ERROR', `DUPLICATE @ID: ${item['@id']} en ${path.basename(filePath)}`);
              duplicate = true;
            }
            ids.add(item['@id']);
          }
        }
        if (!duplicate) report('PASS', `No hay @id duplicados en ${path.basename(filePath)}`);
      }

      // Simple checks
      const strData = JSON.stringify(data);
      if (strData.includes('{{') && strData.includes('}}')) {
        report('WARNING', `Placeholders sin reemplazar en el JSON-LD de ${path.basename(filePath)}`);
      }
      
      // Look for canonical vs mainEntity
      const canonicalMatch = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
      if (canonicalMatch) {
        const canonical = canonicalMatch[1];
        if (strData.includes('mainEntityOfPage') && !strData.includes(canonical)) {
           report('WARNING', `El canonical (${canonical}) no parece coincidir exactamente con mainEntityOfPage en ${path.basename(filePath)}`);
        }
      }

    } catch (e) {
      report('ERROR', `Error al parsear JSON-LD en ${path.basename(filePath)}: ${e.message}`);
    }
  }
}


// 1. Validar HTML (todos los archivos .html)
const files = fs.readdirSync(targetDir);
const htmlFiles = files.filter(f => f.endsWith('.html'));

if (htmlFiles.length === 0) {
  report('ERROR', 'No se encontraron archivos HTML en el directorio.');
}

htmlFiles.forEach(file => {
  const htmlPath = path.join(targetDir, file);
  let html = fs.readFileSync(htmlPath, 'utf8');
  
  validateJsonLd(htmlPath, html);

  html = html.replace(/<!--[\s\S]*?-->/g, ''); // strip HTML comments
  
  checkPlaceholders(htmlPath, html);
  
  // H1 Check
  const h1Matches = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi);
  if (!h1Matches) {
    report('ERROR', `No se encontró ninguna etiqueta <h1> en ${file}.`);
  } else if (h1Matches.length > 1) {
    report('ERROR', `Se encontraron ${h1Matches.length} etiquetas <h1> en ${file}. Solo debe haber 1.`);
  } else {
    report('PASS', `Existe exactamente 1 etiqueta <h1> en ${file}.`);
  }

  // Google Fonts Check
  if (html.includes('fonts.googleapis.com')) {
    report('ERROR', `Se detectaron Google Fonts externos en ${file}. Usa fuentes locales.`);
  } else {
    report('PASS', `No hay Google Fonts externos en ${file}.`);
  }

  // ScrollTrigger Check
  if (html.includes('ScrollTrigger.min.js')) {
    report('ERROR', `Se detectó referencia a ScrollTrigger.min.js en ${file}. Prohibido por defecto.`);
  } else {
    report('PASS', `No hay referencias a ScrollTrigger en ${file}.`);
  }

  // Check images
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let imgMatch;
  let missingAlt = 0;
  while ((imgMatch = imgRegex.exec(html)) !== null) {
    if (!imgMatch[0].includes('alt=')) missingAlt++;
    checkAsset(imgMatch[1], file);
  }
  
  const sourceRegex = /<source[^>]+srcset=["']([^"']+)["'][^>]*>/gi;
  let sourceMatch;
  while ((sourceMatch = sourceRegex.exec(html)) !== null) {
    checkAsset(sourceMatch[1], file);
  }

  if (missingAlt > 0) {
    report('ERROR', `${missingAlt} imágenes no tienen atributo alt en ${file}.`);
  } else {
    report('PASS', `Todas las imágenes tienen atributo alt en ${file}.`);
  }

  // Check external scripts/links
  const linkRegex = /<link[^>]+href=["']([^"']+)["'][^>]*>/gi;
  let linkMatch;
  while ((linkMatch = linkRegex.exec(html)) !== null) {
    if (!linkMatch[1].startsWith('http') && !linkMatch[1].startsWith('#')) {
      checkAsset(linkMatch[1], file);
    }
  }

  const scriptRegex = /<script[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let scriptMatch;
  while ((scriptMatch = scriptRegex.exec(html)) !== null) {
    if (!scriptMatch[1].startsWith('http')) {
      checkAsset(scriptMatch[1], file);
    }
  }
});

// 2. Validar CSS
const cssPath = path.join(targetDir, 'styles.css');
if (fs.existsSync(cssPath)) {
  let css = fs.readFileSync(cssPath, 'utf8');
  css = css.replace(/\/\*[\s\S]*?\*\//g, ''); // strip CSS comments
  checkPlaceholders(cssPath, css);

  // Check for @font-face url
  const fontRegex = /url\(['"]?([^)'"]+)['"]?\)/g;
  let fontMatch;
  while ((fontMatch = fontRegex.exec(css)) !== null) {
    if (!fontMatch[1].startsWith('http') && !fontMatch[1].startsWith('data:')) {
      checkAsset(fontMatch[1], 'styles.css');
    }
  }

  const heroTitleMatch = css.match(/\.hero-title\s*\{[^}]*opacity:\s*0[^}]*\}/);
  if (heroTitleMatch) {
    report('WARNING', 'El hero-title parece tener opacity: 0 en el CSS. Esto daña el LCP.');
  } else {
    report('PASS', 'No se detectó ocultación obvia del LCP en CSS.');
  }
}

// 3. Validar JS
const jsPath = path.join(targetDir, 'main.js');
if (fs.existsSync(jsPath)) {
  const js = fs.readFileSync(jsPath, 'utf8');
  checkPlaceholders(jsPath, js);
  if (js.includes('console.log')) {
    report('WARNING', 'Se encontraron console.log en main.js.');
  }
}

// Favicon
if (!fs.existsSync(path.join(targetDir, 'favicon.ico'))) {
  report('ERROR', 'Falta favicon.ico en el directorio raíz.');
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
