# 🏛️ Canedo Web Studio v1 — para Claude Code

> ¿Primera vez? Abre **[`EMPIEZA-AQUI.md`](EMPIEZA-AQUI.md)**: Configura tus llaves gratuitas en 3 pasos y a trabajar.

Convierte Claude Code en tu agencia de desarrollo automatizada. **Canedo Web Studio** te permite crear webs estáticas premium ($30,000 look) para negocios locales, gestionando todo el ciclo de vida: desde la prospección y rediseño, hasta la venta y el despliegue automático.

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

## 🗂️ Qué hay en tu Estudio

| Pieza | Qué es |
|---|---|
| `EMPIEZA-AQUI.md` | Los 3 pasos para dejarlo funcionando a coste $0. |
| `.claude/skills/luis-rediseño-premium/` | El motor especializado en "Cazar", rediseñar URLs e informes. |
| `.claude/skills/luis-estudio-web/` | El motor para crear desde cero, generar imágenes y gestionar los despliegues. |
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
  > *"Analiza y caza esta web: https://cardiologamariajose.com/. Extrae toda su información, reconstrúyela desde cero para que tenga un aspecto premium de 30.000 dólares y redáctame la propuesta de venta para presentarle al cliente."*

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
