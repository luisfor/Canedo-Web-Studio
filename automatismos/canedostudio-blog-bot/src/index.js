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

// ... (resto del código existente)

async function publish(env, hourUTC, modo) {
  // ... (código existente para guardar el post)

  // Envío de la notificación después de guardar
  await sendEmailNotification(env, post, 'Nuevo artículo publicado');

  return { post, source };
}
