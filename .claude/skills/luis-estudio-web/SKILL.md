---
name: luis-estudio-web
description: One skill bundling several INDEPENDENT capabilities for non-technical Hostinger users — never force-chained; each runs on its own when asked. (a) CONNECT a Hostinger account to Claude Code — install/register the connector, browser login, verify. (b) BUILD studio-grade static websites (HTML/CSS/vanilla JS, no build, no npm) with real wow factor. (c) GENERATE bespoke on-brand images with OpenAI gpt-image-2, or fetch free stock. (d) PUBLISH a site live to Hostinger via that connection. Ask to connect and it only connects; ask for a web without images and it only builds; ask to add images and it only does that; ask to publish and it only publishes. Use it to connect or manage Hostinger, create or edit any website (landing, portfolio, restaurant, agency, SaaS, shop, blog), generate images, or put a site online. Triggers include conectame Hostinger, crea una landing premium, analiza y caza esta web, genera imagenes para la web, publicala or subela, and their English equivalents.
---

# Estudio Web Luis Canedo — connect · build · imagine · publish, each on demand

This is **one home for several independent capabilities**. Think of it as a
studio with different rooms, not an assembly line. You can:

- 🔌 **Connect** a Hostinger account to Claude (so their hosting can be managed).
- 🎨 **Build** a studio-grade static website (HTML/CSS/vanilla JS, no build/npm).
- 🖼️ **Imagine** — generate bespoke, on-brand imagery with OpenAI (gpt-image-2).
- 🚀 **Publish** a finished site live to Hostinger or Cloudflare.
- (plus 🎯 design direction, ✏️ surgical edits, ✅ verify.)

The person pulls **whichever they need, when they need it**. Your job is to read
which capability the current message is asking for and serve **exactly that**.

---

## THE GOLDEN RULE: do only what was asked, then stop

This is the whole point of v3. **Do not chain capabilities.** Do not turn one
request into a full pipeline. Read the message, do that one thing, verify it,
and stop — even if "obvious next steps" exist.

Concretely, this is the experience the skill must deliver:

- User: *"conéctame Hostinger para subir mis webs"* → you **only** connect and
  verify. You do **not** then start building a site.
- Later, User: *"ahora hazme una web para X, sin imágenes de momento"* → you
  **only** build the site with placeholders. You do **not** fetch/generate
  images, and you do **not** deploy.
- Later, User: *"vale, rellénala con imágenes"* → you **only** produce images and
  drop them in. Nothing else.
- Later, User: *"publícala"* → you **ask where to publish** (Local, Hostinger, or Cloudflare), then publish there.

Never assume the next room. **Read the state from context** each time — is
Hostinger connected? does a project folder already exist? does it already have
images? — and serve just the current ask. At the very end of a build or when asked to publish, **always ask**: *"La web está lista. ¿Dónde quieres que la despliegue: en Servidor Local (para hacer pruebas), en Hostinger, o en Cloudflare?"* You **never start a deployment unprompted**.

If a request is genuinely ambiguous, ask **one** short question to pick the
capability — not a multi-question intake.

---

## Route the request → capability

| What they say / the situation | Capability | Primary ref |
|---|---|---|
| "conéctame Hostinger", "vincula mi hosting", "que Claude gestione mi web/VPS/dominios" | 🔌 **Connect** | `reference/12-hostinger-connect.md` |
| "crea una landing premium de $30.000 / diseña una web desde cero para [negocio]", no project exists | 🎨 **Build** | `02`, `06`, `01`, `03` + `intake-template.md` |
| A project exists and "cambia…/ añade…/ otro color / otra sección" | ✏️ **Surgical edit** | the existing files + invariants |
| "genera/haz imágenes", "mis fotos del proveedor son feas", "necesito una foto de portada a medida" | 🖼️ **Image genie** | `reference/11-ai-image-generation.md` |
| "publícala / súbela / ponla online", "sube los cambios" | 🚀 **Publish** | `13-hostinger-deploy.md` or `14-cloudflare-deploy.md` |
| "qué diseño le pondrías", "dame ideas" | 🎯 **Design direction** | `02`, `03`, `06` |
| "¿está lista?", "la subí y se ve rota/vieja" | ✅ **Verify / cache** | `08`, `07`, `10` |

Capabilities **can** compose when the user asks for a lot at once ("conéctame y
publícame esta web con imágenes a medida" → 🔌 → 🖼️ → 🚀). That's fine — but you
compose because *they asked for the whole thing*, never by reflex.

---

## The capabilities

Each is self-contained. Read its ref before acting; skip the rest.

### 🔌 Connect Hostinger
Install/upgrade Node (24+), install the connector (`npm install -g hostinger-api-mcp`),
trigger the **browser login** (`hostinger-hosting-mcp --login` — the person's one
click), and **verify with a real read-only call** before claiming success. **What
"connected" means depends on the runtime:** in the Claude Code CLI you also
`claude mcp add --scope user` to surface tools in a future session; **in the
Desktop app there is usually no `claude` CLI** (`claude: NOT_FOUND` is normal) and
that step doesn't apply — installed + logged-in is enough, and you publish by
driving the connector over stdio (🚀). Don't chase a missing CLI. Full method +
the exact-name gotchas + a copy-paste verify snippet in
`reference/12-hostinger-connect.md`. Env check: `scripts/diagnostico.ps1`
(Windows) / `scripts/diagnostico.sh` (Mac). **Independent:** if they only asked to
connect, stop after verifying.

### 🎨 Build a website
Infer the brief; ask at most the few things you can't infer, once
(`intake-template.md`). Pick **one** archetype (`reference/02-archetypes.md`),
honor the diversity rules (`06`), generate `index.html` / `styles.css` /
`main.js` / `lib/manifest.js` per `reference/01-stack-and-conventions.md` and the
invariants below, copy `templates/htaccess.template` → `.htaccess`, verify, and
preview. **If they said "without images", use placeholders and don't touch the
image genie or deploy.**

### 🖼️ Image genie (AI or stock or their photos)
Three sources — user photos, Openverse stock (free, CC), or **AI-generated**
(OpenAI gpt-image-2, bespoke, ~few $). Pick by context;
`reference/05-image-and-asset-pipeline.md` for the pipeline and
`reference/11-ai-image-generation.md` for the full AI method (photographic
script, anchor images, **banner contract**, chained series, masks). All sources
end as WebP in `assets/img/`. AI is opt-in and costs money — **offer, explain the
cost, get a yes**. Can run standalone ("genérame una foto de portada") or inside
a build.

### 🚀 Publish (Hostinger or Cloudflare)
Put a finished site live. Ask the user where to publish: **Local**, **Hostinger**, or **Cloudflare**.
- For **Hostinger**: use the 🔌 connection via stdio script. Read `reference/13-hostinger-deploy.md`.
- For **Cloudflare**: use the `wrangler` CLI. Read `reference/14-cloudflare-deploy.md`.

### 🎯 Design direction / ✏️ Surgical edit / ✅ Verify
As on-demand as the rest: an art-direction opinion (`02`/`03`/`06`), the smallest
change to an existing site in its own style, or a pre-launch pass
(`08` + the 3-machine test in `07`). Never the whole funnel unless asked.

---

## Always-on invariants (they hold in every capability)

**Communication (all capabilities — connect, build, imagine, publish):**
- **Idioma: responde SIEMPRE al usuario en castellano** mientras esta skill esté
  activa (aunque estas notas internas estén en inglés y aunque él escriba en otro
  idioma), salvo que él pida explícitamente otro idioma.
- **Registro: cero tecnicismos.** El usuario es **no técnico** y no debe sentirse
  abrumado. Nunca digas "MCP", "CLI", "stdio", "npm", "API", "OAuth", "token",
  "deploy", "asset", "repositorio", ni le muestres comandos, rutas, nombres de
  herramientas o errores en crudo. Traduce todo: "el conector de Hostinger",
  "preparar tu ordenador", "publicar tu web", "los archivos del diseño". Si algo
  falla por dentro, para él es "estoy afinando un detalle, un momento" — nunca un
  volcado de error.
- Todos los comandos los ejecutas **tú**; lo único que el usuario hace con sus
  manos es **un clic de inicio de sesión** en el navegador (solo en 🔌 Conectar).
- Anuncia antes de cada paso visible, celebra los hitos (✅) y **verifica antes de
  afirmar** que algo funciona.
- Estas notas de referencia son técnicas **a propósito, porque las lees tú (el
  LLM)** — son tu guía interna, no un guion para leerle al usuario.

**Web quality (build / images / publish), full detail in `reference/04-critical-gotchas.md`:**
1. No `<script type="module">` with relative imports — classic `<script defer>` +
   IIFE + `window.__BRAND__`.
2. `.htaccess` in every root + `?v=YYYYMMDD` on every asset ref (bump per deploy).
3. Native scroll by default (Lenis opt-in only).
4. Reduced-motion gates only *intrusive* effects — never tilt/hover/fade/mesh
   (Windows ships it ON; you'd hand them a dead site).
5. All images WebP, never mixed formats.
6. Hardcode content in HTML; JS only enriches (must read with JS off).
7. `safe()` around every `init*`; IntersectionObserver threshold ≤ 0.05 + safety
   timeout; splash double safety net.
8. Content first, animation second. 9. Robustness > spectacle. 10. One archetype,
   never two. 11. Verify before claiming.

If an invariant and a flourish conflict, the invariant wins.

---

## Environment (handle once, silently, when a capability needs it)

- 🔌 **Connect** needs **Node.js 24+** (the Hostinger connector requires it) — so
  if Hostinger is in play at all, target Node 24+. Check with
  `scripts/diagnostico.*`.
- 🖼️ **Image genie (AI)** needs **Node 18+** and an OpenAI key the user provides
  (Node 24 satisfies this too).
- 🎨 **Build** helper scripts run on Python *or* Bash; everything degrades
  gracefully (`reference/09-environment-detection.md`).

Install what's missing yourself where you can; only ask the user to install
something if every automatic path failed.

---

## Files index

```
SKILL.md                                ← this file — the multi-capability router
intake-template.md                      ← the few questions worth asking (build)
recommended-settings.json               ← optional zero-prompt pre-authorization
evals/evals.json                        ← capability-routing evals
reference/
  01-stack-and-conventions.md           ← file structure, IIFE, script order
  02-archetypes.md                      ← 10 archetypes (pick ONE)
  03-effects-catalog.md                 ← 40+ copy-paste effects
  04-critical-gotchas.md                ← the web invariants, in full
  05-image-and-asset-pipeline.md        ← photos: user / Openverse / AI / WebP
  06-diversity-guardrails.md            ← never clone; rotate archetypes
  07-windows-troubleshooting.md         ← reduced-motion + the 3-machine test
  08-pre-deploy-checklist.md            ← the verify pass
  09-environment-detection.md           ← Node/Python/curl detection
  10-deployment-and-cache.md            ← cache-busting + .htaccess strategy
  11-ai-image-generation.md             ← 🖼️ OpenAI gpt-image-2 image genie
  12-hostinger-connect.md               ← 🔌 connect the Hostinger account
  13-hostinger-deploy.md                ← 🚀 publish a static site to Hostinger
  14-cloudflare-deploy.md               ← 🚀 publish a static site to Cloudflare
templates/
  htaccess.template                     ← copy as `.htaccess` to every root
scripts/
  diagnostico.ps1 / .sh                 ← 🔌 environment check for the connection
  download_libs.py / .sh                ← GSAP/ScrollTrigger to lib/
  openverse_fetch.py / .sh              ← free stock images (CC-licensed)
  webp_convert.py                       ← any image → optimized WebP
  verify_project.py                     ← post-generation sanity check
  generar-foto.mjs                      ← 🖼️ OpenAI gpt-image-2 generator
  recortar-banner.ps1 / .sh             ← 🖼️ crop to exact banner ratio
```

---

## Zero-prompt mode

If the user wants the skill to run without approving each command, have them
merge `recommended-settings.json` into their `~/.claude/settings.json` once. It
pre-authorizes only this skill's own scripts, the Hostinger connection commands,
and a few safe helpers. Nothing destructive.

---

## Final note

One studio, several doors. Read which door the person walked through, do that
well, verify it, and stop. When they say *"conéctame Hostinger"* you hand them a
working connection; when they say *"hazme la web"* you hand them a site; when
they say *"ponle imágenes"* you hand them imagery; when they say *"publícala"*
you hand them a live URL — each on its own, each finished, never forced together.
