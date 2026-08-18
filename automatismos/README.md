# Automatismos del kit — Blog autogestionado

Un robot que **escribe y publica artículos solo** en el blog de una web del
kit: texto con IA, portada generada con IA, aviso por email. Coste: **0 €/mes**
(capas gratuitas de Cloudflare). Se vende como parte del mantenimiento de
99 €/mes.

Implementación de referencia (funciona en producción desde 2026-08-16):
- Robot: `automatismos/canedostudio-blog-bot/`
- Funciones de la web: `cazas/canedostudio.com/functions/`

---

## Las 5 piezas

1. **Worker (el cerebro)** — `src/index.js` + `src/topics.js` + `wrangler.toml`.
   Se dispara solo por horario (cron) y publica.
2. **KV namespace (el archivador)** — guarda `posts` (JSON con los artículos),
   `state` (memoria anti-repetición) y `img:covers/<slug>.jpg` (portadas).
3. **Workers AI** — texto: `@cf/meta/llama-3.3-70b-instruct-fp8-fast`
   (OJO: responde en formato OpenAI `choices[0].message.content`; el código ya
   lo gestiona en `readTextResponse()`). Imagen: `@cf/black-forest-labs/flux-1-schnell` (JPEG).
4. **Pages Functions en la web del cliente** — `functions/data/posts.json.js`
   (lee KV y sirve los artículos) y `functions/media/[[path]].js` (sirve las
   portadas). Además, un `wrangler.toml` EN LA CARPETA DE LA WEB con el binding
   `BLOG_POSTS` al **mismo** namespace KV del robot.
5. **SendGrid (opcional)** — email de aviso a cada publicación
   (`SENDGRID_API_KEY`, `FROM_EMAIL`, `TO_EMAIL` como secretos/vars).

## Cómo clonarlo para un cliente nuevo

1. Copia la carpeta: `cp -r automatismos/canedostudio-blog-bot automatismos/[cliente]-blog-bot`.
2. En su `wrangler.toml`: cambia `name` y crea un KV nuevo:
   `npx wrangler kv namespace create BLOG_POSTS` → pega el id que devuelve.
3. Pon un token nuevo: `npx wrangler secret put BOT_TOKEN` (y guárdalo en
   `secretos/[cliente]-blog-boton-magico.txt`, NUNCA en el chat).
4. Adapta `src/topics.js` al sector del cliente (mínimo 100 temas; ver formato abajo).
5. Ajusta `SYSTEM_PROMPT` y `EDITORIAL_CHARTER` (nombre de la agencia/negocio, servicios).
6. Cron: Colombia UTC-5 sin DST. 7:00 y 17:00 = `0 12,22 * * *` (UTC). Si el
   cliente está en España (UTC+1/+2), recalcula; y decide qué hora es la
   "edición de la mañana" en `pickTopic()` (hoy: `hourUTC === 12`).
7. En la web del cliente: copia `functions/data/posts.json.js` y
   `functions/media/[[path]].js`, y crea su `wrangler.toml` con el binding KV
   al namespace nuevo. **Cada redespliegue de esa web debe incluir
   `functions/` + `wrangler.toml` o el blog vuelve a los artículos fijos.**
8. Despliega el robot (`npx wrangler deploy`) y prueba con
   `/publicar-ahora?token=…&modo=curado`.

## El sistema de temas (híbrido, montado 2026-08-17)

Prioridad en `pickTopic(env, existingTitles, existingSlugs, state, hourUTC, modo)`:

1. **Curados**: los de `topics.js` sin usar. Formato por tema:
   `{ id: "kebab-unico", tema: "título guía", angulo: "enfoque en una frase", img: "escena EN INGLÉS" }`.
   La escena `img` es SIEMPRE en inglés, fotográfica y rica (luz, ambiente,
   objetos); el prompt de portada lleva cláusula anti-minimalismo.
2. **RSS (solo la edición de la mañana)**: `tryRssTopic()` lee titulares reales
   de prensa de marketing y la IA los convierte en tema práctico para pymes.
3. **IA**: `proposeTopic()` inventa el tema siguiendo la `EDITORIAL_CHARTER`,
   con 2 niveles de reintento y una `PERSPECTIVES` distinta cada vez (sectores:
   clínica dental, restaurante, inmobiliaria…). Todo pasa por `validateTopic()`
   (longitudes, lista `BANNED` de vetados, duplicados).

**Anti-duplicados en 3 capas**: filtro pre-IA contra títulos/slugs ya
publicados → la IA recibe el historial (`state.generatedHistory`, 300 últimos)
→ guardia final `dup-title` que aborta limpio si el título generado ya existe.
`state` además guarda `usedTopics`, `usedHeadlines` (60), `lastRun`, `lastSource`.

## Feeds RSS verificados (marketing en español)

✅ Funcionan: `https://feeds.feedburner.com/Puromarketing`,
`https://vilmanunez.com/feed/`, `https://marketingdirecto.com/feed/`
❌ Rotos (301 a HTML / 403 / 404): puromarketing.com/rss.xml,
marketing4ecommerce.net/feed/, blog.hubspot.es/rss.xml.
Antes de añadir un feed nuevo, pruébalo con el endpoint `/feed-check`.

## Trampas conocidas

| Trampa | Solución |
|---|---|
| Error 4006 "daily free allocation of 10,000 neurons" | La IA gratis de Cloudflare son 10.000 neuronas/día (reset ~00:00 UTC). Las 2 publicaciones diarias caben; lo que la agota es probar a mano muchas veces. Esperar al día siguiente. |
| El blog vuelve a los artículos fijos tras un redespliegue | Faltó `functions/` o el `wrangler.toml` de la web en el deploy. Redesplegar incluyéndolos SIEMPRE. |
| Portada repintada que no se ve | `/media/` se cachea 1 año en navegadores: `/repintar` guarda SIEMPRE con timestamp en el nombre (URL nueva). Nunca sobrescribir la misma URL. |
| R2 sin activar | Las portadas van en KV (`img:covers/…`). NO migrar a R2 sin activarlo antes en el panel de Cloudflare. |
| RSS vacío desde el Worker | El feed está roto o bloquea bots. Diagnosticar con `/feed-check?token=…`. |
| Horarios que no cuadran | El cron es UTC. Colombia = UTC-5 sin horario de verano. |
| Sin DOMParser en Workers | Los RSS se leen con regex `<item>…<title>` y limpieza de CDATA/entidades (ya implementado). |

## Endpoints del robot (token en `secretos/`, nunca en el chat)

- `/publicar-ahora?token=…&modo=auto|curado|rss|ia` — publica al momento
  (default `auto`: curados → RSS si es de mañana → IA). Ideal para demos.
- `/repintar?slug=…&escena=…&token=…` — regenera la portada (nombre con timestamp).
- `/feed-check?token=…` — diagnóstico: cuántos titulares válidos da cada feed.
- `/rss-debug?token=…` — ejecuta la conversión titular→tema sin publicar.
