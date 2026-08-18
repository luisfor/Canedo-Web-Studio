/* Robot redactor del blog de Canedo Studio.
   7:00 AM y 5:00 PM todos los días (hora Colombia): escribe un artículo
   con IA, le genera portada con IA, lo guarda en KV y avisa por email.

   Sistema híbrido de temas (por orden de prioridad):
   1) Temas curados: los 210 de topics.js, sin repetir (duran ~3,5 meses).
   2) Edición de las 7:00 (12:00 UTC): se inspira en titulares REALES de
      marketing/negocios leídos de RSS y los convierte en tema práctico pyme.
   3) Resto: la IA propone temas nuevos siguiendo la carta editorial y
      cambiando de sector/perspectiva en cada intento.

   Anti-duplicados en tres capas:
   - Antes de gastar IA: descarta temas cuyo título/slug ya están publicados.
   - La IA recibe el historial de títulos generados y se le prohíbe repetir.
   - Guardia final: si el título generado ya existe, se aborta limpio. */

import { TOPICS } from "./topics.js";

const MODEL_TEXT = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const MODEL_IMG = "@cf/black-forest-labs/flux-1-schnell";
const MAX_POSTS = 30;
const MAX_HISTORY = 300;   // títulos generados recordados (anti-repetición)
const MAX_HEADLINES = 60;  // titulares RSS recordados

/* Carta editorial: quiénes somos, a quién le hablamos, qué vende el blog */
const EDITORIAL_CHARTER = `Canedo Studio es una agencia que vende a negocios y pymes hispanohablantes: chatbots con IA, diseño web premium, blogs autogestionados, embudos de reseñas y automatización de procesos. El blog "Insights" habla al DUEÑO del negocio, no al técnico: lenguaje claro, euros y horas, ejemplos de negocios cotidianos. Cada artículo debe poder enlazarse con naturalidad a uno de esos servicios.`;

/* Temas vetados: se filtran en titulares RSS y en propuestas de la IA */
const BANNED = [
  "política", "elecciones", "partido político", "religión", "criptomoneda",
  "bitcoin", "nft", "apuestas", "casino", "trading", "forex",
  "bolsa de valores", "famosos", "cotilleo", "guerra", "crimen",
];

/* Sectores desde los que la IA puede enfocar un tema nuevo */
const PERSPECTIVES = [
  "una clínica dental", "un restaurante", "un gimnasio", "una asesoría fiscal",
  "una peluquería", "un taller mecánico", "una inmobiliaria",
  "una academia de idiomas", "una clínica veterinaria", "un hotel rural",
  "una tienda de barrio", "un despacho de abogados", "un centro de estética",
  "una empresa de reformas", "una agencia de viajes", "una floristería",
  "una óptica", "una clínica de fisioterapia", "un consultor autónomo",
  "una tienda online local", "una cafetería", "un estudio de fotografía",
];

/* Fuentes de inspiración para la edición de las 7:00 (12:00 UTC) */
const RSS_FEEDS = [
  "https://feeds.feedburner.com/Puromarketing",
  "https://vilmanunez.com/feed/",
  "https://marketingdirecto.com/feed/",
];

const SYSTEM_PROMPT = `Eres el redactor jefe del blog "Insights" de Canedo Studio, una agencia de automatización con IA para empresas.
Estilo: español neutro, cercano y ejecutivo; tutea al lector; persuasivo pero honesto; frases claras, cero jerga técnica sin explicar.
REGLAS DURAS:
- NUNCA inventes cifras concretas, estadísticas, casos de clientes, testimonios ni empresas de ejemplo con nombre. Habla de tendencias generales y sentido común.
- No menciones a Canedo Studio en primera persona todo el rato; como mucho una mención natural al final.
- Extensión total: entre 650 y 900 palabras.
- Devuelves ÚNICAMENTE un JSON válido, sin markdown, sin comentarios, con esta forma exacta:
{"title":"...","tag":"...","excerpt":"...","content":[{"type":"p","text":"..."}]}
Donde "tag" es UNA de: Estrategia, Chatbots, Reseñas, Automatización, Diseño web.
"excerpt" máximo 150 caracteres, gancho para listados.
"content" es una lista de 8 a 14 bloques. type puede ser "p" (párrafo), "h2" (subtítulo) o "quote" (una sola cita potente por artículo como máximo).
Estructura recomendada: arranque con una verdad incómoda, desarrollo con 2-3 subtítulos, y cierre con una idea accionable. El último bloque puede sugerir con naturalidad que una llamada de diagnóstico aclara si encaja en el negocio del lector.`;

const TOPIC_PROMPT = `Eres el estratega de contenidos del blog "Insights" de Canedo Studio.
Respondes ÚNICAMENTE con JSON válido, sin markdown ni comentarios, con esta forma exacta:
{"tema":"...","angulo":"...","img":"..."}
- "tema": título tentativo del artículo (30-90 caracteres). Claro y con beneficio, sin clickbait vacío.
- "angulo": el enfoque concreto en una frase (qué se lleva el lector).
- "img": descripción EN INGLÉS de una escena fotográfica para la portada (40-300 caracteres): estilo editorial oscuro y cinematográfico, detalles ricos, iluminación dorada o azul eléctrico, SIN texto ni letras en la imagen.`;

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "articulo";
}

function extractJson(raw) {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("La IA no devolvió JSON");
  return JSON.parse(raw.slice(start, end + 1));
}

function sniffImage(bytes) {
  const b = new Uint8Array(bytes.slice(0, 4));
  if (b[0] === 0xff && b[1] === 0xd8) return { ext: "jpg", mime: "image/jpeg" };
  if (b[0] === 0x89 && b[1] === 0x50) return { ext: "png", mime: "image/png" };
  return { ext: "jpg", mime: "image/jpeg" };
}

/* Normaliza un título para comparar duplicados (ignora tildes,
   mayúsculas y signos de puntuación) */
function normTitle(s) {
  return s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function hasBanned(text) {
  const low = text.toLowerCase();
  return BANNED.some((b) => low.indexOf(b) !== -1);
}

/* Lee la respuesta del modelo de texto (formato OpenAI o string plano) */
function readTextResponse(res) {
  let raw;
  if (typeof res === "string") raw = res;
  else if (res && typeof res.response === "string") raw = res.response;
  else if (res && res.choices && res.choices[0] && res.choices[0].message) raw = res.choices[0].message.content;
  if (typeof raw !== "string") {
    throw new Error("Formato inesperado del modelo: " + JSON.stringify(res).slice(0, 250));
  }
  return raw;
}

async function generateArticle(topic) {
  const userPrompt = `Escribe el artículo del blog con este tema y enfoque.
Tema: ${topic.tema}
Enfoque: ${topic.angulo}
Recuerda: SOLO el JSON, sin nada más.`;
  const res = await this.AI.run(MODEL_TEXT, {
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    max_tokens: 2800,
    temperature: 0.72,
  });
  const data = extractJson(readTextResponse(res));

  if (!data.title || typeof data.title !== "string") throw new Error("JSON sin título");
  const allowed = new Set(["p", "h2", "quote"]);
  const content = (Array.isArray(data.content) ? data.content : [])
    .filter((b) => b && typeof b.text === "string" && b.text.trim().length > 0)
    .map((b) => ({ type: allowed.has(b.type) ? b.type : "p", text: b.text.trim() }));
  if (content.length < 5) throw new Error("Artículo demasiado corto");
  const tags = new Set(["Estrategia", "Chatbots", "Reseñas", "Automatización", "Diseño web"]);

  return {
    title: data.title.trim().slice(0, 120),
    tag: tags.has(data.tag) ? data.tag : "Estrategia",
    excerpt: (data.excerpt || content[0].text).trim().slice(0, 160),
    content,
  };
}

async function generateCover(topic) {
  const prompt =
    "Premium editorial photograph for a business blog, dark luxurious style, deep black background, " +
    "subtle electric blue and warm gold accent lighting, cinematic, high detail, rich composition with " +
    "multiple visual elements and clear depth, atmospheric light, photographic realism. " +
    "AVOID: minimalism, abstract shapes, a single floating object on emptiness, text, words, letters. " +
    "Scene: " + (topic.img || topic.tema);
  const result = await this.AI.run(MODEL_IMG, { prompt });
  let bytes;
  if (result && typeof result.getReader === "function") {
    bytes = await new Response(result).arrayBuffer();
  } else if (result && result.image) {
    const bin = atob(result.image);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    bytes = arr.buffer;
  } else {
    throw new Error("La IA no devolvió imagen");
  }
  if (bytes.byteLength < 10000) throw new Error("Imagen generada sospechosamente pequeña");
  return bytes;
}

/* ---------- Capa 2: inspiración RSS (edición de las 7:00) ---------- */

/* Lee los titulares de los feeds. Sin DOMParser en Workers: regex + CDATA */
async function fetchHeadlines() {
  const titles = [];
  for (const url of RSS_FEEDS) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(5000),
        headers: { "User-Agent": "Mozilla/5.0 (compatible; CanedoStudioBlogBot/1.0)" },
      });
      if (!res.ok) continue;
      const xml = await res.text();
      const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
      for (const item of items.slice(0, 12)) {
        const m = item.match(/<title>([\s\S]*?)<\/title>/);
        if (!m) continue;
        let t = m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim();
        t = t.replace(/&amp;/g, "&").replace(/&#\d+;|&[a-z]+;/g, " ").replace(/\s+/g, " ").trim();
        if (t.length >= 20 && t.length <= 180 && !hasBanned(t)) titles.push(t);
      }
    } catch (e) {
      console.log("Feed falló:", url, e.message);
    }
  }
  return titles;
}

/* Convierte un titular real en un tema práctico para pymes.
   Devuelve null si no hay nada útil (publish() caerá a la capa 3). */
async function tryRssTopic(env, existingTitles, existingSlugs, state) {
  const headlines = await fetchHeadlines();
  const used = new Set((state.usedHeadlines || []).map(normTitle));
  const fresh = headlines.filter((h) => !used.has(normTitle(h)));
  if (fresh.length === 0) return null;

  const headline = fresh[Math.floor(Math.random() * fresh.length)];
  const userPrompt = `${EDITORIAL_CHARTER}

Titular de actualidad del mundo del marketing y los negocios:
"${headline}"

Convierte la tendencia que hay detrás de esa noticia en UN tema práctico para el dueño de una pyme hispanohablante. NO hables de la noticia en sí: usa la tendencia como excusa para enseñar algo útil hoy.
Solo el JSON.`;

  try {
    const res = await env.AI.run(MODEL_TEXT, {
      messages: [
        { role: "system", content: TOPIC_PROMPT },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 500,
      temperature: 0.8,
    });
    const data = extractJson(readTextResponse(res));
    const topic = validateTopic(data, existingTitles, existingSlugs, state);
    if (!topic) return null;
    topic._headline = headline;
    return topic;
  } catch (e) {
    console.log("RSS→tema falló:", e.message);
    return null;
  }
}

/* ---------- Capa 3: temas propuestos por IA ---------- */

/* Valida una propuesta {tema, angulo, img} contra calidad, vetados y duplicados */
function validateTopic(data, existingTitles, existingSlugs, state) {
  if (!data || typeof data.tema !== "string" || typeof data.angulo !== "string" || typeof data.img !== "string") return null;
  const tema = data.tema.trim();
  const angulo = data.angulo.trim();
  const img = data.img.trim();
  if (tema.length < 25 || tema.length > 110) return null;
  if (angulo.length < 15 || angulo.length > 220) return null;
  if (img.length < 30 || img.length > 500) return null;
  if (hasBanned(tema) || hasBanned(angulo)) return null;
  const n = normTitle(tema);
  if (existingTitles.has(n)) return null;
  if (existingSlugs.has(slugify(tema))) return null;
  if ((state.generatedHistory || []).indexOf(n) !== -1) return null;
  return { id: "ia-" + Date.now().toString(36), tema, angulo, img };
}

/* Pide a la IA un tema nuevo. 3 intentos, cada uno con una perspectiva
   (sector) distinta para forzar variedad. */
async function proposeTopic(env, existingTitles, existingSlugs, state) {
  const history = (state.generatedHistory || []).slice(-60).join(" | ");
  for (let intento = 0; intento < 3; intento++) {
    const perspective = PERSPECTIVES[Math.floor(Math.random() * PERSPECTIVES.length)];
    const userPrompt = `${EDITORIAL_CHARTER}

Inventa UN tema nuevo para el próximo artículo, mirando el mundo desde la perspectiva de: ${perspective}.
PROHIBIDO tocar: ${BANNED.join(", ")}.
NO repitas ni te acerques a ninguno de estos temas ya publicados:
${history || "(aún no hay historial)"}

Solo el JSON.`;
    try {
      const res = await env.AI.run(MODEL_TEXT, {
        messages: [
          { role: "system", content: TOPIC_PROMPT },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 500,
        temperature: 0.9,
      });
      const data = extractJson(readTextResponse(res));
      const topic = validateTopic(data, existingTitles, existingSlugs, state);
      if (topic) return topic;
      console.log("Propuesta IA rechazada (intento " + (intento + 1) + "):", JSON.stringify(data).slice(0, 160));
    } catch (e) {
      console.log("proposeTopic intento " + (intento + 1) + " falló:", e.message);
    }
  }
  throw new Error("La IA no logró proponer un tema válido en 3 intentos");
}

/* ---------- Selección de tema: curados → RSS (mañanas) → IA ---------- */

async function pickTopic(env, existingTitles, existingSlugs, state, hourUTC, modo) {
  if (modo === "curado" || modo === "auto") {
    const available = TOPICS.filter((t) => !(state.usedTopics || []).includes(t.id));
    const fresh = available.filter(
      (t) => !existingTitles.has(normTitle(t.tema)) && !existingSlugs.has(slugify(t.tema))
    );
    if (fresh.length > 0) {
      return { topic: fresh[Math.floor(Math.random() * fresh.length)], source: "curado" };
    }
    if (modo === "curado") throw new Error("No quedan temas curados sin usar");
  }

  if ((modo === "rss" || modo === "auto") && (modo === "rss" || hourUTC === 12)) {
    const topic = await tryRssTopic(env, existingTitles, existingSlugs, state);
    if (topic) return { topic, source: "rss" };
    if (modo === "rss") throw new Error("RSS sin titulares útiles ahora mismo");
    console.log("RSS sin titulares útiles, pasando a propuesta IA");
  }

  const topic = await proposeTopic(env, existingTitles, existingSlugs, state);
  return { topic, source: "ia" };
}

/* ---------- Publicación ---------- */

async function publish(env, hourUTC, modo) {
  if (typeof hourUTC !== "number") hourUTC = new Date().getUTCHours();
  if (!modo) modo = "auto";

  const state = JSON.parse((await env.BLOG_POSTS.get("state")) || '{"usedTopics":[]}');
  if (!Array.isArray(state.usedTopics)) state.usedTopics = [];
  if (!Array.isArray(state.generatedHistory)) state.generatedHistory = [];
  if (!Array.isArray(state.usedHeadlines)) state.usedHeadlines = [];

  const postsData = JSON.parse((await env.BLOG_POSTS.get("posts")) || '{"posts":[]}');
  const posts = Array.isArray(postsData.posts) ? postsData.posts : [];

  const existingTitles = new Set(posts.map((p) => normTitle(p.title)));
  const existingSlugs = new Set(posts.map((p) => p.slug));

  const { topic, source } = await pickTopic(env, existingTitles, existingSlugs, state, hourUTC, modo);

  const [article, imgBytes] = await Promise.all([
    generateArticle.call(env, topic),
    generateCover.call(env, topic),
  ]);

  let slug = slugify(article.title);
  if (existingSlugs.has(slug)) slug = slug + "-" + String(Date.now()).slice(-4);

  /* Guardia final: si el título que devolvió la IA ya existe, abortar
     limpiamente (la siguiente pasada del cron elegirá otro tema) */
  if (existingTitles.has(normTitle(article.title))) {
    throw new Error("dup-title: ya existe un artículo con ese título");
  }

  const kind = sniffImage(imgBytes);
  const coverKey = "img:covers/" + slug + "." + kind.ext;
  await env.BLOG_POSTS.put(coverKey, imgBytes);

  const words = article.content.map((b) => b.text).join(" ").split(/\s+/).length;
  const post = {
    slug,
    title: article.title,
    tag: article.tag,
    date: new Date().toISOString().slice(0, 10),
    readingTime: Math.max(3, Math.round(words / 200)) + " min",
    cover: "/media/covers/" + slug + "." + kind.ext,
    excerpt: article.excerpt,
    content: article.content,
  };

  posts.unshift(post);
  postsData.posts = posts.slice(0, MAX_POSTS);
  await env.BLOG_POSTS.put("posts", JSON.stringify(postsData));

  /* Memoria anti-repetición */
  if (source === "curado") state.usedTopics.push(topic.id);
  if (source === "rss" && topic._headline) {
    state.usedHeadlines.push(normTitle(topic._headline));
    state.usedHeadlines = state.usedHeadlines.slice(-MAX_HEADLINES);
  }
  state.generatedHistory.push(normTitle(article.title));
  state.generatedHistory = state.generatedHistory.slice(-MAX_HISTORY);
  state.lastRun = new Date().toISOString();
  state.lastSource = source;
  await env.BLOG_POSTS.put("state", JSON.stringify(state));

  return { post, source };
}

async function sendEmailNotification(env, post, source) {
  const apiKey = env.SENDGRID_API_KEY;
  const fromEmail = env.FROM_EMAIL || "noreply@canedostudio.com";
  const toEmail = env.TO_EMAIL || "lcanedo12@gmail.com";

  if (!apiKey) {
    console.log("SENDGRID_API_KEY no configurado, saltando notificación");
    return;
  }

  const sourceLabel = source === "curado" ? "tema curado de la lista"
    : source === "rss" ? "inspirado en titulares reales (RSS)"
    : "tema propuesto por IA";

  const articleUrl = "https://canedostudio.com/post.html?slug=" + post.slug;
  const subject = "📝 Nuevo artículo publicado en Canedo Studio: " + post.title;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1a1a1a;">📄 Nuevo artículo publicado</h2>
      <p style="font-size: 16px; line-height: 1.6;">Se ha publicado automáticamente un nuevo artículo en el blog de Canedo Studio.</p>

      <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #0d9488;">
        <h3 style="margin: 0 0 10px 0; color: #0d9488;">${post.title}</h3>
        <p style="margin: 0; color: #666; font-size: 14px;">📅 ${post.date} · 🏷️ ${post.tag} · ⏱️ ${post.readingTime} · 🧠 ${sourceLabel}</p>
      </div>

      <p style="font-size: 14px; color: #666; margin-bottom: 20px;">${post.excerpt}</p>

      <a href="${articleUrl}" style="display: inline-block; background: #0d9488; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">Leer artículo completo →</a>

      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
      <p style="font-size: 12px; color: #999;">Este email fue enviado automáticamente por el bot del blog de Canedo Studio.</p>
    </div>
  `;

  try {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: toEmail }], subject }],
        from: { email: fromEmail, name: "Canedo Studio Blog" },
        content: [{ type: "text/html", value: html }]
      })
    });

    if (res.ok) {
      console.log("✅ Email de notificación enviado a " + toEmail);
    } else {
      const err = await res.text();
      console.log("❌ Error enviando email:", res.status, err);
    }
  } catch (e) {
    console.log("❌ Excepción enviando email:", e.message);
  }
}

export default {
  async scheduled(event, env, ctx) {
    const hourUTC = new Date(event.scheduledTime || Date.now()).getUTCHours();
    ctx.waitUntil(
      publish(env, hourUTC, "auto").then(({ post, source }) => sendEmailNotification(env, post, source))
    );
  },
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/publicar-ahora") {
      if (!env.BOT_TOKEN || url.searchParams.get("token") !== env.BOT_TOKEN) {
        return new Response("No autorizado", { status: 401 });
      }
      const modo = url.searchParams.get("modo") || "auto"; // auto | curado | rss | ia
      try {
        const { post, source } = await publish(env, new Date().getUTCHours(), modo);
        return new Response("Publicado [" + source + "]: " + post.title + " (/post.html?slug=" + post.slug + ")", { status: 200 });
      } catch (e) {
        return new Response("Error al publicar: " + e.message, { status: 500 });
      }
    }
    if (url.pathname === "/feed-check") {
      if (!env.BOT_TOKEN || url.searchParams.get("token") !== env.BOT_TOKEN) {
        return new Response("No autorizado", { status: 401 });
      }
      const report = { feeds: [], totalTitulares: 0, muestra: [] };
      for (const feedUrl of RSS_FEEDS) {
        try {
          const res = await fetch(feedUrl, {
            signal: AbortSignal.timeout(8000),
            headers: { "User-Agent": "Mozilla/5.0 (compatible; CanedoStudioBlogBot/1.0)" },
          });
          if (!res.ok) { report.feeds.push({ url: feedUrl, estado: "HTTP " + res.status }); continue; }
          const xml = await res.text();
          const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
          let validos = 0;
          for (const item of items.slice(0, 12)) {
            const m = item.match(/<title>([\s\S]*?)<\/title>/);
            if (!m) continue;
            let t = m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim();
            t = t.replace(/&amp;/g, "&").replace(/&#\d+;|&[a-z]+;/g, " ").replace(/\s+/g, " ").trim();
            if (t.length >= 20 && t.length <= 180 && !hasBanned(t)) {
              validos++;
              if (report.muestra.length < 5) report.muestra.push(t);
            }
          }
          report.feeds.push({ url: feedUrl, estado: "ok", itemsLeidos: items.length, titularesValidos: validos });
          report.totalTitulares += validos;
        } catch (e) {
          report.feeds.push({ url: feedUrl, estado: "error: " + e.message });
        }
      }
      return new Response(JSON.stringify(report, null, 2), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.pathname === "/rss-debug") {
      if (!env.BOT_TOKEN || url.searchParams.get("token") !== env.BOT_TOKEN) {
        return new Response("No autorizado", { status: 401 });
      }
      try {
        const state = JSON.parse((await env.BLOG_POSTS.get("state")) || '{"usedTopics":[]}');
        const postsData = JSON.parse((await env.BLOG_POSTS.get("posts")) || '{"posts":[]}');
        const existingTitles = new Set((postsData.posts || []).map((p) => normTitle(p.title)));
        const existingSlugs = new Set((postsData.posts || []).map((p) => p.slug));
        const headlines = await fetchHeadlines();
        if (headlines.length === 0) return new Response("fetchHeadlines devolvió 0", { status: 200 });
        const headline = headlines[Math.floor(Math.random() * headlines.length)];
        const userPrompt = `${EDITORIAL_CHARTER}\n\nTitular de actualidad del mundo del marketing y los negocios:\n"${headline}"\n\nConvierte la tendencia que hay detrás de esa noticia en UN tema práctico para el dueño de una pyme hispanohablante. NO hables de la noticia en sí: usa la tendencia como excusa para enseñar algo útil hoy.\nSolo el JSON.`;
        const res = await env.AI.run(MODEL_TEXT, {
          messages: [{ role: "system", content: TOPIC_PROMPT }, { role: "user", content: userPrompt }],
          max_tokens: 500,
          temperature: 0.8,
        });
        const raw = readTextResponse(res);
        let data = null; let motivo = "";
        try { data = extractJson(raw); } catch (e) { motivo = "JSON: " + e.message; }
        const valido = data ? validateTopic(data, existingTitles, existingSlugs, state) : null;
        if (data && !valido) motivo = "validación rechazada";
        return new Response(JSON.stringify({ titularElegido: headline, respuestaCruda: raw.slice(0, 900), parseado: data, aceptado: !!valido, motivo }, null, 2), { status: 200 });
      } catch (e) {
        return new Response("Error debug: " + e.message, { status: 500 });
      }
    }
    if (url.pathname === "/repintar") {
      if (!env.BOT_TOKEN || url.searchParams.get("token") !== env.BOT_TOKEN) {
        return new Response("No autorizado", { status: 401 });
      }
      const slug = url.searchParams.get("slug");
      const escena = url.searchParams.get("escena");
      if (!slug || !escena) return new Response("Faltan slug o escena", { status: 400 });
      try {
        const postsData = JSON.parse((await env.BLOG_POSTS.get("posts")) || '{"posts":[]}');
        const post = (postsData.posts || []).find((p) => p.slug === slug);
        if (!post) return new Response("Artículo no encontrado", { status: 404 });
        const imgBytes = await generateCover.call(env, { img: escena });
        const kind = sniffImage(imgBytes);
        // Nombre nuevo cada vez: los navegadores cachean /media/ un año,
        // así que una portada repintada solo se ve al instante si cambia la URL.
        const newPath = "/media/covers/" + slug + "-" + Date.now().toString(36) + "." + kind.ext;
        await env.BLOG_POSTS.put("img:" + newPath.replace("/media/", ""), imgBytes);
        if (post.cover && post.cover.indexOf("/media/") === 0) {
          await env.BLOG_POSTS.delete("img:" + post.cover.replace("/media/", ""));
        }
        post.cover = newPath;
        await env.BLOG_POSTS.put("posts", JSON.stringify(postsData));
        return new Response("Portada repintada: " + newPath, { status: 200 });
      } catch (e) {
        return new Response("Error al repintar: " + e.message, { status: 500 });
      }
    }
    return new Response("Robot del blog de Canedo Studio: activo. Publica a diario 7:00 (edición con inspiración de prensa) y 17:00 (hora Colombia). Temas: 210 curados + IA ilimitada.", { status: 200 });
  },
};
