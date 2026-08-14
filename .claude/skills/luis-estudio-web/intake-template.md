# Intake — the few things worth asking (v2 is light on this)

v2 doesn't run an intake wizard. Most sessions need **zero or one** question:
you infer the brief and decide palette/fonts/layout/effects yourself. Only ask
what you genuinely can't infer, and ask it in **one** short message.

## First, route (don't ask yet)

Read the request against the routing table in `SKILL.md`. If it's a surgical
edit, an image ask, or a design-direction ask, you usually need **no** intake at
all — just do the thing. Reserve questions for a **full build** with a thin
brief.

## For a full build — ask at most these, once

Only the ones not already answered by their message:

1. **Brand name** — the name of the project (if not given).
2. **Images** — which source? Offer the three plainly:
   - "tengo fotos propias" → they drop them in `assets/photos/source/`.
   - "usa imágenes de stock" → free CC-licensed from Openverse (default if no
     answer).
   - "genera imágenes a medida con IA" → bespoke, ~2-3 € de créditos de OpenAI
     (route to capability ③ / `reference/11-ai-image-generation.md`).
3. **Main goal** — what should the visitor do? (reservar / suscribirse /
   contactar / comprar / leer). Infer from industry if obvious.
4. *(only if it matters)* Anything the site MUST include, or one page vs several
   (default: one page).

Template (Spanish — translate to the user's language):

> Para clavarlo necesito un par de cosas:
> 1. **Nombre** del proyecto.
> 2. **Imágenes**: ¿tienes fotos tuyas, tiro de banco de imágenes gratis, o te
>    genero unas a medida con IA (cuesta unos 2-3 € de créditos)?
> 3. **Objetivo** de la web (contactar, reservar, vender, suscribir…).
>
> Responde rápido — el diseño, colores y efectos los decido yo.

## Never ask

The skill decides these — asking is a mistake:
palette, fonts, layout, which effects, "do you want a custom cursor?", any tech
decision. (See the invariants in `SKILL.md`.)

## After they reply

Acknowledge in one line, then go quiet and build. If they left gaps: images →
Openverse stock; pages → one; CTA → infer from industry; anything else →
sensible default for the archetype. Tell them when it's ready — don't narrate
every step.
