# 🏛️ Canedo Web Studio v1 — para Claude Code

> ¿Primera vez? Abre **[`EMPIEZA-AQUI.md`](EMPIEZA-AQUI.md)**: Configura tus llaves gratuitas en 3 pasos y a trabajar.

Convierte Claude Code en tu agencia de desarrollo automatizada. **Canedo Web Studio es un kit público y de código abierto (open-source) que cualquiera puede usar y adaptar**. Te permite crear webs estáticas premium ($30,000 look) para negocios locales, gestionando todo el ciclo de vida: desde la prospección y rediseño, hasta la venta y el despliegue automático.

---

## 🌟 Todo lo que este Estudio es capaz de hacer por ti

Este kit no es solo un generador de código, es tu equipo completo de agencia (Programador, Diseñador y Vendedor). Aquí tienes el listado completo de sus súper-poderes:

### 1. 🎯 Cazar Webs (Auditoría y Rediseño)
Le pasas la URL de una web antigua de un negocio local y la IA se encarga de:
- Analizar a fondo todos los problemas de diseño y conversión actuales.
- Extraer el branding real del cliente (colores corporativos, logo, textos, menú de servicios).
- Reconstruir la web entera desde cero con un diseño premium moderno (HTML/CSS/JS).

### 2. 📝 Generación Automática de Propuestas de Venta
Junto con cada web que rediseña (o "caza"), el sistema te redacta automáticamente un **Informe y Propuesta Comercial**:
- Utiliza la `plantilla-propuesta.md` para crear un documento personalizado para el cliente.
- Te detalla qué fallaba en su web anterior y le argumenta por qué el nuevo diseño que le has hecho le generará más ventas. ¡Listo para enviar por correo y cobrar!

### 3. 🚀 Crear Webs desde Cero (Ideas o Redes Sociales)
No necesitas tener una URL antigua para trabajar. Puedes decirle:
- *"Crea una web para una peluquería desde cero"*.
- *"Analiza este perfil de TikTok/Instagram, deduce los servicios que ofrecen y créales una landing page"*.
La IA inventará la estructura, redactará el copywriting (los textos de venta) y la programará.

### 4. 🖼️ El Genio de las Imágenes
Olvídate de buscar fotos en Google. El estudio gestiona las imágenes por ti:
- **Gratis:** Busca y descarga automáticamente fotografías profesionales sin derechos de autor desde *Openverse*.
- **Premium (Opcional):** Si configuras OpenAI, puede generar imágenes completamente a medida con IA (DALL-E) que encajen perfectamente con el diseño de tu cliente.

### 5. ☁️ Despliegue Multi-Cloud Interactivo
No más complicaciones de servidores FTP. Al terminar la web, la IA te preguntará: *"¿Dónde quieres que la publique?"* y con tu respuesta hará todo el trabajo sucio:
- **Servidor Local:** Para que pruebes la web en tu navegador.
- **Hostinger:** Se conecta por debajo a tu panel de Hostinger y sube los archivos directamente a tu dominio.
- **Cloudflare Pages:** Usa Wrangler para subir la web a la infraestructura ultrarrápida de Cloudflare y te devuelve un enlace público (perfecto y gratuito para mostrarle el demo al cliente).


### 6. 🛠️ Aplicaciones Web Complejas (Full-Stack)
¿El cliente necesita un panel de usuarios, Login o Base de Datos (PostgreSQL, Node.js, Next.js)? 
El asistente también es capaz de programar aplicaciones complejas desde cero como un proyecto de software tradicional. 
*(Nota: El despliegue automático One-Click de este kit está optimizado para páginas web estáticas ultrarrápidas. Las aplicaciones Full-Stack con bases de datos requerirán un despliegue manual en plataformas como Vercel, Supabase o un VPS).*

---


### 7. 🤖 Componentes Nativos de IA (Gemini API)
El estudio puede programar Chatbots de atención al cliente y Calculadoras con Visión Artificial (ej. leer facturas de luz para paneles solares) conectados 100% gratis a la API de Google Gemini.

### 8. 📊 Auditoría SEO y Diagnóstico Digital
El asistente incluye un auditor especializado capaz de revisar el SEO técnico de cualquier URL o el estado de perfiles de redes sociales. Genera un reporte profesional (listo para entregar al cliente) con puntos fuertes, errores críticos y un plan de acción a ejecutar. Ideal para usar como herramienta de preventa o consultoría.

### 9. ✍️ Blog Autogestionado (el robot redactor) — PROBADO EN PRODUCCIÓN
Un robot que **escribe y publica artículos solo** en el blog de la web: texto con IA, portada generada con IA, 2 publicaciones al día. Coste: **0 €/mes** (capas gratuitas de Cloudflare). Funciona en canedostudio.com desde agosto 2026.
- **Sistema híbrido de temas:** 210 temas curados únicos → inspiración en prensa real de marketing (RSS, edición de la mañana) → temas propuestos por IA. Anti-duplicados en 3 capas: nunca repite un artículo.
- **Sin servidores ni n8n:** un Cloudflare Worker + KV lo hace todo.
- Receta completa para clonarlo a cualquier cliente en `automatismos/README.md`; robot de referencia en `automatismos/canedostudio-blog-bot/`.
- Se vende dentro del mantenimiento de 99 €/mes.

### 10. ⭐ Sistema de Reseñas (slider + embudo) — PROBADO EN PRODUCCIÓN
Las dos piezas de la reputación online, listas para copiar en cualquier web:
- **Slider de testimonios estilo Google:** carrusel con autoplay (se pausa al interactuar), flechas que no tapan las tarjetas y puntos de posición. Patrón completo en `componente-resenas.md`, con la tabla de los 5 errores típicos ya resueltos.
- **Embudo de calificación** (`plantilla-calificanos.html`): página oculta sin menú. **4-5 estrellas** → abre Google directo a escribir la reseña en pestaña nueva. **1-3 estrellas** → formulario de queja privado que llega al email del dueño (FormSubmit, sin cuentas ni claves). Las quejas se resuelven en privado y Google solo recibe clientes felices. Solo hay que rellenar 3 huecos: nombre del negocio, email del dueño y enlace de reseña de Google.

## 🗂️ Qué hay en tu Estudio

| Pieza | Qué es |
|---|---|
| `EMPIEZA-AQUI.md` | Los 3 pasos para dejarlo funcionando a coste $0. |
| `.claude/skills/luis-rediseño-premium/` | El motor especializado en "Cazar", rediseñar URLs e informes. |
| `.claude/skills/luis-estudio-web/` | El motor para crear desde cero, generar imágenes y gestionar los despliegues. |
| `automatismos/README.md` | La receta del blog autogestionado (robot redactor con IA, 0 €/mes). |
| `automatismos/canedostudio-blog-bot/` | El robot de referencia, funcionando en producción. |
| `componente-resenas.md` | El patrón del slider de reseñas estilo Google + el embudo de calificación. |
| `plantilla-calificanos.html` | La página del embudo de reseñas lista para copiar a cualquier cliente. |
| `.env` (Oculto) | Donde guardas de forma segura tus API Keys (OpenRouter). No se sube a GitHub. |
| `plantilla-propuesta.md` | La propuesta comercial que se rellena sola para venderle la web al cliente. |

## 💻 Cómo usar el Asistente en tu día a día

### 1. Activar la IA gratuita (OpenRouter)
Abre la terminal en esta carpeta. Para que Claude Code use tu conexión gratuita, ejecuta siempre este comando antes de arrancar:
```bash
export ANTHROPIC_API_KEY=$OPENROUTER_API_KEY
export ANTHROPIC_BASE_URL="https://openrouter.ai/api/v1"
```

### 2. Llamar al Asistente
Escribe el comando oficial para despertar a la IA:
```bash
claude
```

### 3. ¡Dale órdenes! (Ejemplos Reales)
* **Para Cazar y generar Propuesta:**
  > *"Analiza y caza esta web: http://www.ejemplo-taller-antiguo.com. Extrae toda su información, reconstrúyela desde cero para que tenga un aspecto premium de 30.000 dólares y redáctame la propuesta de venta para presentarle al cliente."*

* **Para Crear desde Cero:**
  > *"Crea una landing page para una clínica dental. Diseño limpio, usa fotos gratis."*


* **Para Modificar una web ya terminada:**
  > *"Añade un mapa de Google con la dirección X al final de la página."*
  > *"Cambia el color principal a un azul más oscuro."*

* **Para Desplegar:**
  > *"Está perfecta, publícala."*
  *(La IA te preguntará si en Local, Hostinger o Cloudflare).*

---
*Desarrollado para la agencia Canedo Web Studio.*

---

## 🚀 El Modelo de Negocio (Agencia de Automatización con IA)

Este kit no es solo para hacer webs, es el motor principal para crear un **SaaS (Software as a Service)** o una **Agencia de Automatización (AIAA)** escalable a miles de clientes con un mínimo esfuerzo.

### ¿Cómo Implementar el Sistema Paso a Paso?

Para alcanzar facturaciones de +$10,000/mes de forma pasiva, debes combinar este Kit Cazador con la automatización. Aquí tienes la hoja de ruta:

#### Paso 1: Generación de la Web Base (Con este Kit)
1. Usa el comando para **Cazar una web** o **Crearla desde cero**.
2. En la *Fase de Briefing*, dile a la IA que active:
   - **El Blog Automatizado (JSON):** Para poder inyectar artículos remotamente.
   - **El Chatbot de IA:** (Requerirá que pegues la API Key gratuita de Google Gemini).
   - **El Embudo de Reseñas:** (La página `/calificanos` para filtrar las quejas privadas y mandar a Google Maps las reseñas de 5 estrellas).
3. Aloja la web estática gratis en **Cloudflare Pages**.

#### Paso 2: La Arquitectura 100% Serverless (Cero Servidores) y Cerebro Automatizador
¡Adiós a pagar servidores! El Kit está programado para usar exclusivamente la nube gratuita de Cloudflare.
1. **La Fábrica de Artículos (Workers + IA):** El robot de `automatismos/` (Cloudflare Worker, 0 €/mes) escribe y publica solo los artículos y guarda en Cloudflare KV, actualizando la web del cliente en automático sin usar herramientas externas.
2. **El Embudo de Reseñas (Frontend JS):** El Kit programa la lógica directamente en JavaScript. Si el cliente selecciona 4-5 estrellas, es redirigido a Google Maps; de 1-3 estrellas envía un formulario privado.
3. **Flujos extra con Make.com / n8n:** Aunque la base es serverless, puedes registrarte en **Make.com** o instalar **n8n** en un VPS de $5/mes para flujos complejos:
   - **Respuestas automáticas a quejas:** interceptar las reseñas de 2 estrellas y generar emails con OpenAI.
   - **Flujo de Ventas en Instagram:** n8n lee Mensajes Directos y envía el enlace de WhatsApp a clientes potenciales.

#### Paso 3: El "CMS Involuntario" (Actualización de Fotos y Blog)
1. Créale a tu cliente un canal privado de Telegram o un número de WhatsApp (conectado a n8n).
2. El cliente (ej. un mecánico) manda una foto y un audio rápido (*"Arreglé esta caja de cambios"*).
3. n8n recibe el mensaje:
   - Sube la **Foto** a tu cuenta maestra de **Cloudflare R2** (Servidor de medios ultra barato, sin costos ocultos).
   - Sube los **Videos pesados** automáticamente como "Ocultos" al canal de YouTube del cliente (Coste $0).
   - Transcribe el audio con IA (Whisper) y redacta un artículo SEO profesional.
   - Inyecta el texto y el enlace de la imagen en el archivo `posts.json` del repositorio de GitHub de la web.
   - Cloudflare Pages detecta el cambio en GitHub y actualiza la web al instante.

> 💡 **Resultado:** Tú cobras una suscripción mensual de $300 a $800 dólares por cliente, mientras el robot hace todo el mantenimiento, redacta el blog y filtra los mensajes de redes sociales.

---

## 🗣️ Ejemplos de Comandos (Prompts)

Para que el Kit entienda exactamente qué quieres hacer, aquí tienes las "órdenes maestras" (Prompts) que puedes usar copiándolas y pegándolas en tu terminal de VS Code:

### 1. Crear una web desde cero (Ideal para tu propia Agencia)
Si no tienes web ni redes sociales, dale toda la información tú mismo:
> *"Créame una web premium desde cero para mi agencia. Se llama **Canedo Web Studio**. Ofrecemos diseño de ecosistemas automatizados con IA. Nuestros servicios son: 1. Webs premium de $30k, 2. Chatbots de Inteligencia Artificial, 3. Blogs Autogestionados, y 4. Embudos de Reseñas de Google Maps. Quiero un diseño oscuro, elegante y muy tecnológico. El teléfono es +34 600 000 000 y el email contacto@canedostudio.com. Haz que los textos suenen persuasivos y lujosos."*

### 2. Cazar una web existente (El Rediseño)
Si el cliente ya tiene una web pero es fea y vieja, la IA entrará, leerá todos sus servicios y le montará una versión premium:
> *"Caza esta web: **http://www.ejemplo-taller-antiguo.com**. Extrae todos sus textos, especialidades, historia y horarios. Reconstruye la web desde cero con un diseño premium moderno orientado a la salud. Quiero que uses colores de confianza (azules/blancos) y que la estructura parezca de una clínica de alto nivel. Entrégame el ZIP y la propuesta en PDF."*

### 3. Crear web a partir de Redes Sociales (El Cliente de Instagram)
Si el cliente no tiene web, pero tiene un Instagram lleno de fotos y precios (ej. un mecánico, un pastelero):
> *"Créame una web premium para un negocio. No tienen web antigua, pero extrae toda la información de sus redes sociales aquí: **[Pega el link del Instagram]** y **[Link de su Facebook]**. Extrae de qué va su negocio, sus productos principales y su teléfono de contacto. Con toda esa información, génerame la web con colores corporativos que peguen con sus fotos y redacta una propuesta comercial para poder venderle la web."*

*(Recuerda: Tras cualquiera de estos comandos, el Kit entrará en la **Fase de Briefing** y te preguntará qué módulos extra quieres activar antes de empezar a programar).*
