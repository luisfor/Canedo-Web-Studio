const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const starterDir = path.join(__dirname, '../starter-template');
const cazasDir = path.join(__dirname, '../cazas');

function askQuestion(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  console.log('🚀 Iniciando creación de nueva web...');
  
  const slug = await askQuestion('Slug del proyecto (ej. mi-cliente): ');
  
  if (!slug) {
    console.error('❌ El slug es obligatorio.');
    process.exit(1);
  }

  const targetDir = path.join(cazasDir, slug);

  if (fs.existsSync(targetDir)) {
    console.error(`❌ ERROR CRÍTICO: La carpeta cazas/${slug} ya existe. Abortando para no sobrescribir datos.`);
    process.exit(1);
  }

  const businessName = await askQuestion('Business Name: ');
  const domain = await askQuestion('Domain (ej. cliente.com): ');
  const email = await askQuestion('Email: ');
  const whatsapp = await askQuestion('WhatsApp (código país + num): ');
  const city = await askQuestion('City: ');
  const country = await askQuestion('Country: ');
  const primaryColor = await askQuestion('Primary Color (ej. #FF0000): ');
  const secondaryColor = await askQuestion('Secondary Color (ej. #00FF00): ');
  const headline = await askQuestion('Headline: ');
  const description = await askQuestion('Description: ');

  const replacements = {
    '{{BUSINESS_NAME}}': businessName || 'My Business',
    '{{DOMAIN}}': domain || 'example.com',
    '{{EMAIL}}': email || 'contacto@example.com',
    '{{WHATSAPP}}': whatsapp || '34600000000',
    '{{CITY}}': city || 'Madrid',
    '{{COUNTRY}}': country || 'España',
    '{{PRIMARY_COLOR}}': primaryColor || '#000000',
    '{{SECONDARY_COLOR}}': secondaryColor || '#333333',
    '{{HEADLINE}}': headline || 'Tu titular aquí',
    '{{DESCRIPTION}}': description || 'Tu descripción aquí',
    '{{SLUG}}': slug
  };

  // Crear directorio destino
  fs.mkdirSync(targetDir, { recursive: true });

  // Función recursiva para copiar y reemplazar
  function copyAndReplace(source, target) {
    if (fs.statSync(source).isDirectory()) {
      if (!fs.existsSync(target)) fs.mkdirSync(target);
      const files = fs.readdirSync(source);
      for (const file of files) {
        copyAndReplace(path.join(source, file), path.join(target, file));
      }
    } else {
      let content = fs.readFileSync(source, 'utf8');
      
      // Solo reemplazar en archivos de texto
      const ext = path.extname(source);
      if (['.html', '.css', '.js', '.txt', '.xml', '.toml', ''].includes(ext) || path.basename(source) === '_headers' || path.basename(source) === '_redirects') {
        for (const [key, value] of Object.entries(replacements)) {
          const regex = new RegExp(key.replace(/[{}]/g, '\\$&'), 'g');
          content = content.replace(regex, value);
        }
        fs.writeFileSync(target, content);
      } else {
        // Archivos binarios (imágenes, fuentes)
        fs.copyFileSync(source, target);
      }
    }
  }

  console.log(`\nCopiando starter-template a cazas/${slug}...`);
  copyAndReplace(starterDir, targetDir);

  console.log('✅ Proyecto creado exitosamente.');
  rl.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
