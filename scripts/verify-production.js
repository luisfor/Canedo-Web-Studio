const https = require('https');
const fs = require('fs');
const path = require('path');

const urlArg = process.argv[2];
const localDir = process.argv[3] ? path.join(__dirname, '../cazas', process.argv[3]) : null;

if (!urlArg) {
  console.error('Uso: node verify-production.js <URL> [slug_local]');
  process.exit(1);
}

const targetUrl = urlArg.startsWith('http') ? urlArg : `https://${urlArg}`;

console.log(`\n🔍 Verificando producción en: ${targetUrl}`);
console.log('NOTA: Este script es de SÓLO LECTURA y no modifica el servidor.\n');

function fetchContent(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data
        });
      });
    }).on('error', err => reject(err));
  });
}

async function verify() {
  try {
    const htmlRes = await fetchContent(targetUrl);
    
    if (htmlRes.status !== 200) {
      console.warn(`⚠️ Advertencia: El servidor devolvió status ${htmlRes.status}`);
    }

    console.log('✅ Conexión establecida.');

    // Check Cloudflare headers
    if (htmlRes.headers.server !== 'cloudflare') {
      console.warn('⚠️ Advertencia: El sitio no parece estar servido por Cloudflare.');
    } else {
      console.log('✅ Cloudflare detectado.');
    }

    // Comprobar cf-cache-status en assets (ej. styles.css)
    // Extraemos la ruta de styles.css del HTML
    const cssMatch = htmlRes.data.match(/<link[^>]*href=["']([^"']*styles\.css[^"']*)["'][^>]*>/);
    
    if (cssMatch && cssMatch[1]) {
      const cssUrl = new URL(cssMatch[1], targetUrl).href;
      const cssRes = await fetchContent(cssUrl);
      
      console.log(`\nVerificando CSS en: ${cssUrl}`);
      console.log(`Cache-Control: ${cssRes.headers['cache-control'] || 'No definido'}`);
      console.log(`CF-Cache-Status: ${cssRes.headers['cf-cache-status'] || 'No presente (¿Workers/Pages?)'}`);
      
      if (localDir && fs.existsSync(path.join(localDir, 'styles.css'))) {
        const localCss = fs.readFileSync(path.join(localDir, 'styles.css'), 'utf8');
        // Comparación simple de longitudes como heurística de cache viejo
        if (Math.abs(localCss.length - cssRes.data.length) > 500) { // Tolerar minificación
           console.warn(`⚠️ Advertencia: El CSS de producción (${cssRes.data.length} bytes) difiere significativamente del local (${localCss.length} bytes). Puede ser que la caché no se haya purgado.`);
        } else {
           console.log('✅ CSS de producción parece estar sincronizado (longitud similar).');
        }
      }
    }

    console.log('\n✅ Verificación pasiva terminada.');

  } catch (error) {
    console.error('❌ Error de red:', error.message);
  }
}

verify();
