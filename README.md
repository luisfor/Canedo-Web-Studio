# 🏛️ Canedo Web Studio v1 — para Claude Code

> ¿Primera vez? Abre **[`EMPIEZA-AQUI.md`](EMPIEZA-AQUI.md)**: Configura tus llaves gratuitas en 3 pasos y a trabajar.

Convierte Claude Code en tu agencia de desarrollo automatizada. **Canedo Web Studio** te permite crear webs estáticas premium ($30,000 look) para negocios locales de tres formas distintas:

1. **Cazar Webs (Rediseño)**: Le pasas una URL antigua, extrae el branding real (colores, fotos, textos) y la reconstruye con un diseño premium.
2. **Crear desde Cero (Ideas)**: Le pasas una idea o negocio y crea toda la estructura, copy y diseño.
3. **Analizar Redes (Innovación)**: Le pasas el perfil de Instagram/TikTok de un cliente, deduce sus servicios y crea una landing profesional.

## 🚀 Capacidades del Estudio

El entorno integra múltiples inteligencias que trabajan juntas pero se pueden ejecutar por separado:

- 🎨 **Construcción Inteligente**: Genera HTML/CSS/JS estático. Sin frameworks pesados (`node_modules`), puro rendimiento.
- 🖼️ **Genio de Imágenes**: Usa la IA para crear fotografías a medida o extrae imágenes profesionales 100% gratuitas de Openverse.
- 🚀 **Despliegue Multi-Cloud Interactivo**: Al terminar la web, la IA te preguntará dónde subirla: **Servidor Local** (pruebas), **Hostinger** (panel de cliente), o **Cloudflare Pages** (ultrarrápido y gratuito).

## 🗂️ Qué hay en tu Estudio

| Pieza | Qué es |
|---|---|
| `EMPIEZA-AQUI.md` | Los 3 pasos para dejarlo funcionando a coste $0. |
| `.claude/skills/luis-rediseño-premium/` | El motor especializado en "Cazar" y rediseñar URLs existentes. |
| `.claude/skills/luis-estudio-web/` | El motor para crear desde cero, generar imágenes y gestionar los despliegues. |
| `.env` (Oculto) | Donde guardas de forma segura tus API Keys (OpenRouter, OpenAI). No se sube a GitHub. |
| `ejemplos/web-de-practica/` | La web de un restaurante ficticio, para hacer pruebas seguras. |
| `plantilla-propuesta.md` | La propuesta comercial que se rellena sola para venderle la web al cliente final. |

## 🛠️ Tecnologías y Reglas de Oro

- **No-Build-Step**: Cero configuraciones de webpack o vite. Listo para abrir y desplegar.
- **GSAP & ScrollTrigger**: Animaciones fluidas preconfiguradas.
- **Modelos de IA**: Configurado para poder trabajar con la capa gratuita de OpenRouter, minimizando tus costes de agencia al máximo.

---
*Desarrollado para la agencia Canedo Web Studio.*

## 💻 Cómo usar el Asistente en tu día a día

### 1. Activar la IA gratuita (OpenRouter)
Abre la terminal en esta carpeta. Para que Claude Code use tu conexión de OpenRouter (sin coste), ejecuta siempre este comando antes de arrancar (esto lee la clave de tu archivo `.env`):
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
Una vez que el asistente esté escuchando, puedes pedirle cualquiera de las 3 opciones de la agencia:

* **Para Cazar (Rediseñar):**
  > *"Quiero que analices y caces esta página: https://pizzeria-vieja.com. Extrae toda su información, logo y colores, y reconstrúyela con calidad de agencia."*

* **Para Crear desde Cero:**
  > *"Crea una landing page para una clínica dental. Hazla desde cero con un diseño limpio. Usa fotos libres de derechos de odontólogos."*

* **Para Analizar Redes Sociales:**
  > *"Analiza el perfil de TikTok @tiktoker. Deduzce qué servicios ofrece y créale una web promocional espectacular."*

### 4. Desplegar
Cuando termine de programar, o cuando la web te guste, dile:
> *"Está perfecta, publícala."*

El asistente se detendrá y te preguntará: *"¿Dónde quieres que la despliegue: Servidor Local, Hostinger, o Cloudflare?"*. Responde la opción que prefieras y la IA hará todo el trabajo de conexión.
