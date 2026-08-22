---
name: luis-rediseño-premium
description: Caza una web de un negocio (URL) y la reconstruye con un diseño premium de agencia con el branding real del cliente, entregando web nueva + diagnóstico + propuesta comercial + zip listo para publicar. Usa esta skill siempre que el usuario diga "caza esta web", "cázame [URL]", pase la URL de un negocio para rediseñar, o pida analizar/rehacer la web de un cliente potencial.
---

# Rediseño Premium Luis Canedo

### FASE 0: EL BRIEFING (PREGUNTAR ANTES DE CREAR)
**REGLA ESTRICTA:** Cuando el usuario te pida crear o cazar una web, TIENES PROHIBIDO empezar a escribir código o generar archivos inmediatamente.
Primero, debes detenerte y hacerle una breve entrevista ("Briefing") en el chat para saber qué módulos avanzados quiere activar, partiendo de la base de que la web será sencilla (Opt-in). 

Mándale este mensaje exacto o similar:
> "¡Entendido! Antes de empezar a programar la web, ¿qué módulos adicionales te gustaría instalarle? (Por defecto haré una página sencilla premium). Dime si quieres incluir:
> 1. **Chat:** ¿Ninguno, Botón de WhatsApp, o Chatbot Inteligente de IA (Gemini)?
> 2. **Blog:** ¿Ninguno, o la estructura para el Blog Automatizado?
> 3. **Reseñas:** ¿Le instalo la página oculta del Embudo de Google Maps (`/calificanos`)?
> 4. **Idioma:** ¿En qué idioma escribo la página web y configuro el Chatbot (Ej. Español, Inglés, Francés)?
> 5. **Extras:** ¿Algún color específico o calculadora con IA?"

**ESPERA SU RESPUESTA.** Solo cuando el usuario te conteste qué opciones quiere, pasarás a la Fase 1 para generar el código.

Recibes la URL de la web de un negocio. Entregas, en `cazas/[dominio]/`:
`branding.json`, `diagnostico.md`, `index.html` (el diseño premium),
`web-lista.zip` (para publicar) y `propuesta.md` (para vender).
Trabaja SOLO con webs públicas de negocios. Si el usuario intenta pasarte código
privado o datos de clientes, recuérdale la regla de seguridad del kit y para.

**Dos reglas de supervivencia** (una caza es una sesión larga y puede cortarse):
- **Contexto ligero**: NO leas PDFs/PPTX/archivos pesados enteros — la
  información de cartas y menús casi siempre está también en los HTML. Si un
  archivo pesa, extrae solo lo que necesitas. Un contexto hinchado = cortes.
- **Escribe cada entregable EN CUANTO lo tengas** (no acumules trabajo en
  memoria). Si la sesión se corta, lo escrito queda — y al reanudar ("continúa
  la caza donde la dejaste") retomas por el primer archivo que falte.

## Fase 1 · Reconocimiento

1. Descarga la web: `curl -sL -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36" [URL]`
   (guarda el HTML en `cazas/[dominio]/original/`). Si la respuesta es un 403,
   una página de challenge o pesa menos de 2 KB, la web está bloqueando la
   descarga: usa el navegador (Playwright/Chrome) para obtener el HTML
   renderizado. Si no hay navegador disponible: prueba con WebFetch; si tampoco,
   ofrece instalar Chromium (`npx playwright install chromium`) y, si el
   usuario prefiere no instalarlo, proponle cazar otra web.
   **Caza de práctica**: si el usuario pide cazar "la web de ejemplo", no
   descargues nada — copia `ejemplos/web-de-practica/` a
   `cazas/web-de-practica/original/` y sigue las fases normales desde ahí.
2. Si hay navegador disponible (Playwright/Chrome), haz captura completa de la
   página en escritorio Y en móvil (375px) y guárdalas. Analiza las capturas con
   visión: jerarquía, primer pantallazo, dónde se pierde el ojo.
3. Extrae el branding REAL y guárdalo en `branding.json`:
   - **Logo**: busca en el HTML (`<img>` del header, `og:image`, favicon de mayor
     resolución, `apple-touch-icon`). Descárgalo a `original/logo.*`.
   - **Colores**: los que el negocio usa de verdad (CSS del sitio, color del logo,
     botones). Elige: primario, secundario, fondo, texto. En hex.
   - **Tipografías**: las que cargan (Google Fonts del HTML) o las más parecidas.
   - **Copy y datos — EXHAUSTIVO**: nombre, claim, teléfono, WhatsApp, dirección,
     horario completo, redes. Y TODO el contenido que la web tenga: carta/menús
     con sus precios reales, lista completa de servicios/especialidades, historia
     del negocio (fechas, generaciones, origen), eventos/celebraciones que
     ofrecen, reseñas literales de clientes, premios o menciones. La película
     final debe poder contar el negocio ENTERO — si extraes poco, quedará corta.
     Recorre también las páginas interiores (carta, historia, contacto…), no
     solo la portada. Textuales — no inventes NADA.
4. Formato de `branding.json`:

```json
{
  "negocio": "", "claim": "", "logo": "assets/logo.png",
  "colores": { "primario": "#", "secundario": "#", "fondo": "#", "texto": "#" },
  "tipografias": { "titulos": "", "texto": "" },
  "contacto": { "tel": "", "whatsapp": "", "direccion": "", "horario": "" },
  "servicios": [], "pruebas_sociales": [],
  "carta": [ { "nombre": "", "precio": "" } ],
  "menu_del_dia": { "precio": "", "incluye": "" },
  "historia": "", "eventos": [], "premios": [], "resenas": []
}
```

Todo lo extraído en el punto 3 tiene su campo: la Fase 3 construye la película
SOLO desde este JSON — lo que no esté aquí no existirá en la web nueva.

## Fase 2 · Diagnóstico (`diagnostico.md`)

Exactamente 5 problemas CONCRETOS y observables de su web actual, cada uno con:
qué está mal → por qué le cuesta clientes → cómo lo resuelve la nueva. Nada de
vaguedades ("mejorar el diseño" NO; "el teléfono no aparece hasta el tercer scroll
y en móvil no es clicable" SÍ).

## Fase 3 · Reconstrucción (`index.html`)

Una landing de UNA página, autocontenida (CSS y JS inline o en archivos separados), responsive, con el branding extraído. 
Copia el logo y las fotos que uses de `original/` a una carpeta `assets/` junto al `index.html`, y referéncialas SIEMPRE como `assets/...`.

**IMPORTANTE: NO uses el "motion-kit" ni el túnel 3D.** Genera tú mismo todo el HTML, CSS y JS necesario.

Instrucciones exactas para el diseño:
- **Diseño Premium de Agencia**: Dale un diseño de agencia de altísimo nivel, nada de plantillas genéricas. Quiero que parezca una web de $30.000, no una plantilla. Usa efectos modernos, animaciones suaves al hacer scroll (puedes usar CSS y JavaScript estándar, o IntersectionObserver) y composiciones increíbles.
- **Estructura**:
  1. Un **Hero potente** con el claim y una foto a sangre.
  2. Sección de **Historia/Filosofía** del negocio.
  3. **Catálogo/Servicios** mostrando sus productos estrella o cartas con los precios REALES extraídos.
  4. **Prueba social**: Reseñas literales de clientes extraídas.
  5. **Contacto**: Dirección, horario completo y llamadas a la acción gigantes (Teléfono/WhatsApp).
- **Dirección de arte**: Tipografías grandes y elegantes (usa las fuentes de Google extraídas o busca similares). Usa EXCLUSIVAMENTE los colores reales del negocio extraídos en `branding.json`.
- **Reglas de la experiencia**: Scroll nativo (sin secuestrar), legibilidad absoluta (textos sobre fotos deben tener oscurecimiento detrás) y diseño 100% responsive (mobile-first o fluid typography).
- Cero lorem ipsum, reescribe el copy real para que suene mucho más profesional y convincente.

Reglas duras: cero lorem ipsum (reescribe el copy real, mejorado); cero datos
inventados; el teléfono/WhatsApp SIEMPRE clicable y visible en el primer pantallazo;
sin fechas; máximo 2 tipografías; los colores del CLIENTE, no los tuyos.
**Control de calidad antes de entregar (obligatorio — la web solo se entrega
cuando pasa TODO):**

- **Móvil (375px)**: sin scroll horizontal, textos legibles, la película fluida.
  Si hay navegador, captura a 375px y revísala con visión; si no, audita el CSS:
  media queries presentes, tamaños con `clamp()`, imágenes con `max-width:100%`,
  nada de anchos fijos en px que desborden.
- **Conversión**: el teléfono/WhatsApp clicable (`tel:`/`wa.me`) visible en el
  primer pantallazo (barra fija) Y en el footer estático.
- **Imágenes**: ninguna rota, todas con ruta relativa `assets/...`.
- **Legibilidad**: todo texto sobre foto lleva scrim oscuro o `text-shadow` fuerte.
- **Técnica**: `<meta name="viewport">` presente, `<title>` con el nombre del
  negocio, `data-mk-shots` y `--mk-nshots` coinciden con el número real de zshots.

Si algo falla, corrígelo y vuelve a comprobar antes de seguir.

Al terminar, sírvela en local desde la carpeta de la caza y dile al usuario la
URL (http://localhost:8777). El comando depende del sistema — si `/setup` dejó
anotada la herramienta en `.claude/setup-completado.json`, usa esa; si no,
prueba en orden y usa el primero que exista: `python3 -m http.server 8777`
(Mac/Linux) → `py -3 -m http.server 8777` → `python -m http.server 8777`
(Windows; evita `python3` en Windows: suele ser un falso acceso a la tienda de
Microsoft).

## Fase 4 · Empaquetado (`web-lista.zip`)

Antes de empaquetar, comprueba que ninguna imagen está rota abriendo el
`index.html` servido en local: todas las rutas deben ser relativas (`assets/...`).

Crea un zip con TODO lo que la web necesita para publicarse — `index.html`, cualquier archivo `.css` o `.js` que hayas creado, y la carpeta `assets/` (logo y fotos usadas). NO
incluyas `original/` ni los `.md`. Usa el comando de empaquetado EXACTO anotado
en `.claude/setup-completado.json` (lo dejó `/setup` ya probado); si no existe
el marcador, decide tú sin preguntar al usuario:

- Mac/Linux: `zip -r cazas/[dominio]/web-lista.zip ...` ejecutado desde la
  carpeta de la caza, o mejor en un solo comando desde la raíz del kit:
  `tar -a -cf cazas/[dominio]/web-lista.zip -C cazas/[dominio] index.html assets` (añade los .css y .js si los creaste)
  (el tar de Mac es bsdtar y crea ZIP de verdad con `-a`).
- Windows: usa la ruta completa
  `/c/Windows/System32/tar.exe -a -cf cazas/[dominio]/web-lista.zip -C cazas/[dominio] index.html assets` (añadiendo .css y .js si existen).
  CUIDADO: el `tar` a secas de Git Bash es GNU tar y crea en silencio un
  archivo que NO es un zip — no lo uses.
- Alternativa portable: `[python elegido] -m zipfile -c web-lista.zip index.html assets/` (añadiendo .css y .js)
  desde la carpeta de la caza.

Evita encadenar `cd ... && comando` (los permisos pre-aprobados del kit no
cubren los comandos encadenados): usa `-C` o rutas relativas desde donde estés.

**Verifica el zip antes de darlo por bueno**: sus dos primeros bytes deben ser
`PK` (compruébalo con `[python elegido] -m zipfile -t cazas/[dominio]/web-lista.zip`,
que debe decir "Done testing"). Si no pasa, reempaqueta con la alternativa
portable.

Este zip es lo que el usuario arrastra a Netlify Drop (preview gratis) o sube al
Administrador de archivos de Hostinger (publicación final) — el paso a paso está
en `despliegue.md` del kit. Menciónaselo al entregar.

## Fase 5 · Propuesta (`propuesta_comercial.html`)

**REGLA ESTRICTA:** Queda PROHIBIDO generar la propuesta en formato `.md`. Debes generar un archivo llamado `propuesta_comercial.html`.
Este archivo debe ser un documento ejecutivo diseñado para ser impreso en PDF.
- Usa CSS en línea para forzar el tamaño de hoja: `@page { size: A4; margin: 20mm; } body { font-family: sans-serif; color: #333; line-height: 1.6; max-width: 210mm; margin: auto; }`
- Diseña una cabecera elegante (con espacio para logo).
- Incluye los 5 puntos del diagnóstico, 3 mejoras estrella de la nueva web, y una tabla de precios clara ($30,000 USD o según el plan).
- Tono cercano y directo, sin jerga técnica — la lee el dueño del negocio. Firma con `[TU NOMBRE]` y `[TU CONTACTO]`.
- Al finalizar todo el proceso, dile al usuario: *"Tu propuesta está en `propuesta_comercial.html`. Hazle doble clic, presiona `Ctrl+P` (o Cmd+P) en tu navegador y elige Guardar como PDF para enviársela al cliente."*

## Al entregar

Resume en 5 líneas: qué encontraste, qué construiste, dónde está cada archivo,
cuánto ha costado la caza aproximadamente (unos pocos euros de uso de API o una
fracción del uso del plan — recuérdale que ese coste ínfimo respalda un
servicio que se cobra desde 800 €) y el siguiente paso (enseñárselo al cliente).


### 👑 Reglas de Oro de Diseño y Ventas (High-Ticket)
**Aplica siempre estas reglas en TODAS las webs y bots que construyas:**
1. **Diseño (Cero Texto Justificado):** NUNCA uses `text-align: justify` en webs, blogs o landing pages. Los textos justificados rompen la legibilidad en móviles creando "ríos blancos". Usa SIEMPRE alineación a la izquierda (`text-align: left`).
2. **Personalidad del Chatbot (Guardarraíles):** El bot debe comportarse estrictamente como un asesor de ventas de la agencia. Debe negarse educadamente a responder preguntas que no tengan relación con los servicios, el negocio o el contacto de la empresa.
3. **Captación (Cualificar, no cotizar en automático):** El chatbot NO debe dar presupuestos cerrados automáticamente a cualquiera. Su función es cualificar al cliente (saber qué necesita y su presupuesto) y luego dirigirlo a un botón para **agendar una llamada de diagnóstico** (vía WhatsApp o Calendly).


### 🛠️ Arquitectura Serverless (Sin n8n)
**Cuando construyas los Ecosistemas de Ventas (Blog y Reseñas), implementa SIEMPRE esta arquitectura 100% nativa de Cloudflare y Frontend:**

1. **La Fábrica de Artículos (Blog Cloudflare Workers):**
   - Configura el Blog usando el Ecosistema Serverless de Cloudflare.
   - **El Despertador:** Configura un Cron Trigger en Cloudflare (ej. lunes y jueves a las 8:00).
   - **El Robot Redactor:** Escribe un Cloudflare Worker en JavaScript que llame a `env.AI.run`. Usa **Llama** para redactar el artículo (regla: prohibido inventar cifras/testimonios, tono ejecutivo, 650-900 palabras) y **Flux** para generar la imagen de portada (regla: prohibido estilo minimalista/abstracto). 
   - **El Archivador (KV):** Guarda el JSON resultante y la imagen en un espacio de Cloudflare KV, y conecta la web del cliente para que lea desde allí (`/data/posts.json` y `/media/`).
   - Define un array de **24 temas únicos** del sector del cliente para que el Worker itere sin repetir.
   - Crea un "botón mágico" (URL secreta) para disparar el Worker manualmente para demos.

2. **El Embudo de Reseñas Post-Servicio (Frontend JavaScript):**
   - Crea una landing page oculta (ej. `/calificanos`) que el cliente enviará a sus usuarios por WhatsApp/Correo tras el servicio.
   - La página debe mostrar **5 estrellas** interactivas.
   - **Lógica JavaScript estricta:** 
     - Si el usuario selecciona **1, 2 o 3 estrellas**: Oculta la opción de ir a Google. Muestra un formulario de texto ("¿Qué podemos mejorar?") e intégralo directamente con **Formspree** para que la queja llegue al correo del dueño silenciosamente.
     - Si el usuario selecciona **4 o 5 estrellas**: Redirige automáticamente la pestaña al enlace oficial de **Google Maps** del negocio para que dejen la reseña pública.
