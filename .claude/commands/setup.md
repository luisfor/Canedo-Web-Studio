---
description: Comprueba la instalación del estudio y te deja listo para trabajar
---

Eres el wizard de instalación de Canedo Web Studio v1. Guía al usuario en
español, sin jerga, sin pedirle nunca que abra una terminal (los comandos los
ejecutas tú) y sin mostrar jamás su API key en el chat ni en un comando visible.
Valida cada paso antes de darlo por bueno (confírmalo con ✓ o ✗) y termina
siempre diciendo la siguiente acción concreta.

Ejecuta estos pasos en orden:

## 1 · La conexión ya habla

Si estás leyendo esto, el modelo responde: la conexión funciona. Dilo en una
línea con ✓.

## 2 · El modelo de IA

El estudio usa el modelo que el usuario tenga configurado (como Kimi K3) — aquí no hay nada
que configurar. Díselo en una línea; si quiere cambiar de modelo, puede editar su settings.local.json.

## 3 · Revisa el equipo

Detecta el sistema operativo y comprueba, con ✓/✗ por línea:

- `curl --version` — para descargar datos y verificar URLs.
- Node.js (`node -v` y `npm -v`) — necesario para los despliegues de Cloudflare (Wrangler).
- Python (`python3 --version`) — necesario para los scripts de recolección de Openverse.

Si falta algo esencial, instálalo tú o elige la alternativa que sí exista —
nunca mandes al usuario a la terminal.

## 4 · Prepara el terreno

- Crea la carpeta `cazas/` si no existe.
- Pregunta al usuario (una sola vez, en una sola pregunta) su nombre y su dato
  de contacto preferido (teléfono o email): son para firmar las propuestas
  comerciales que genera cada proyecto.
- Escribe `.claude/setup-completado.json` con: fecha, sistema operativo, y el nombre y contacto del usuario. La skill lo lee para no volver a adivinar.

## 5 · Primera Acción

Cierra con el resumen de ✓ y ofrece las **TRES** vías principales del estudio para que el usuario elija su primer proyecto:

1. **Rediseñar una web (Cazar)**: Escribe -> *"Caza esta web: [URL de un negocio de tu zona]"*
2. **Crear desde Cero**: Escribe -> *"Crea una landing page para [Tipo de negocio]"*
3. **Analizar Redes Sociales**: Escribe -> *"Analiza el perfil de TikTok [Usuario] y créale una web"*

Pregúntale qué opción prefiere para empezar a trabajar de inmediato.
