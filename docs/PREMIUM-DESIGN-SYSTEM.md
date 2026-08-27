# 💎 Premium Design System & AI Prompts (Dínamo Engine)

Este documento define el **Estándar Visual Premium** para el Starter Kit. Estas directrices han sido extraídas de referencias de diseño de altísimo nivel (estilo Awwwards / estudios premium) y dictan cómo la Inteligencia Artificial debe estructurar y estilizar las webs que construye, garantizando que el diseño sea espectacular sin arruinar el PageSpeed (Core Web Vitals).

Cada vez que el Kit construya una web nueva (vía `new-site` o `design-to-web`), la IA debe acatar estas reglas para no caer en el "diseño genérico tipo Bootstrap".

---

## 1. Reglas Maestras de Estética (El Vocabulario Premium)

Para que el diseño se sienta costoso, editorial y contemporáneo, prohíbe los estilos predecibles:

*   **Evitar el "Síndrome de la Tarjeta" (No Cards):** En lugar de usar las clásicas "3 tarjetas blancas flotantes con sombra", usa layouts editoriales, filas de listas (ledgers), líneas finas divisoras (1px) y mucho espacio negativo.
*   **Tipografía de Contraste:** Combina una fuente Sans-serif técnica o geométrica (ej. *Instrument Sans, Space Grotesk, Manrope*) para la interfaz, con una fuente Serif en cursiva (ej. *Newsreader itálica, Instrument Serif*) utilizada **solo en palabras clave** dentro de titulares gigantes para dar un toque humano y literario.
*   **Paletas Minerales y Ácidas:** No uses rojo puro, azul puro ni fondos 100% blancos/negros. Usa "Tinta" (`#171714`, `#101113`), "Blanco Mineral/Marfil" (`#F1F0E8`, `#ECEEF0`), y acentos vibrantes como "Lima Ácido" (`#C8FF45`), "Coral" (`#FF5B45`) o "Azul Eléctrico" (`#315EFF`).
*   **Fundidos Localizados, no Overlays:** Cuando pongas texto sobre un video/imagen, no oscurezcas toda la pantalla (overlay negro al 50%). Utiliza un `linear-gradient` sutil y localizado solo detrás del bloque de texto, permitiendo que el resto del arte respire.

## 2. Reglas Maestras de Animación y Rendimiento

El Kit tiene prohibido el uso de librerías de animación pesadas como GSAP, Framer Motion o Three.js para mantener la carga en 0 milisegundos.

*   **Motor de Render Nativo:** Si necesitas partículas, geometría o elementos interactivos complejos, constrúyelos nativamente usando `Canvas 2D`, `CSS 3D`, o trazados `SVG` interactivos (ej. animando `stroke-dashoffset`).
*   **Videos Limpios:** Si usas videos de fondo (MP4 en loop), el movimiento debe vivir *dentro* del video. No le apliques filtros CSS de blur, escalas o transformaciones que destrocen los FPS del navegador.
*   **Rendimiento Estricto (Observers):** Toda animación Canvas o Video debe pausarse cuando el usuario hace scroll hacia abajo usando `IntersectionObserver`. Las animaciones interactivas basadas en ratón no deben repintar el layout (`transform` / `opacity` solamente).
*   **Accesibilidad Innegociable:** Respeta siempre `@media (prefers-reduced-motion: reduce)`. Si el usuario tiene esto activo, los Canvas se vuelven estáticos o se muestran los *posters* de los videos, y los elementos entran sin transiciones de posición.

---

## 3. Catálogo de Arquetipos (Themes)

Cuando vayas a crear un cliente nuevo, puedes pedirle a la IA que aplique uno de estos arquetipos conceptuales. La IA usará este conocimiento como base:

*   **[NEXO] Infraestructura / SaaS Técnico:**
    *   *Concepto:* Terminal científica convertida en pieza editorial.
    *   *Estética:* Fondo oscuro (`#06070A`), texto `#F4F5F1`, azul eléctrico `#315EFF`. Fuente *Space Grotesk*. Arte basado en mallas de puntos (Canvas 2D) o portales geométricos sutiles.
*   **[MATERIA] Biotecnología / Salud Avanzada:**
    *   *Concepto:* Mezcla de publicación científica y materia viva.
    *   *Estética:* Fondo casi negro, blanco cálido y acento verde ácido (`#BDF33F`). *Manrope* + *Newsreader itálica*. Animaciones de membranas orgánicas interactivas y suaves.
*   **[ÓRBITA] Sistemas Adaptativos / Consultoría Estratégica:**
    *   *Concepto:* Precisión, elegancia y simetría.
    *   *Estética:* Papel/Marfil (`#F2F0EA`), tinta (`#171714`) y coral (`#FF5B45`). Arte con SVG de órbitas elípticas finas (transformaciones CSS ligeras). Fichas de datos incrustadas en esquinas sin bordes toscos.
*   **[PRISMA] Agencias Creativas / Iluminación / Arte:**
    *   *Concepto:* Portada cultural contemporánea.
    *   *Estética:* Negro absoluto, blanco mineral y lima (`#F0FF36`). Halos prismáticos o vacíos centrales usando blend-modes (`screen/lighter`) nativos.
*   **[LUCENT JOURNEY] Movilidad / Productos de Alto Lujo (Físicos):**
    *   *Concepto:* Interfaz mínima 100% enfocada en dejar que el medio audiovisual (video full-bleed) cuente la historia.
    *   *Estética:* Tinta, papel y divisores de 1px. Todo el contenido está anclado en zonas específicas y el texto se revela con un *fade* localizado elegante (`translateY(18px) + opacity`).
*   **[RAÍZ] Estética Botánica / Energía / Wellness:**
    *   *Concepto:* Naturaleza sofisticada.
    *   *Estética:* Verde bosque (`#164A35`), menta (`#E6F1DB`), marfil (`#F4F0E8`) y amarillo solar. *DM Sans* + *Newsreader*. Presentación del producto flotando con CSS 3D suave sobre paisajes geométricos planos.
*   **[VANTAGE] Modelos de Precios Premium (Pricing):**
    *   *Concepto:* Un "ledger" o libro mayor de filas claras y comparables.
    *   *Estética:* Eliminar las clásicas columnas/cartas de precios. Usar filas horizontales a pantalla completa, cambiando a negro la activa, usando una fuente monoespaciada (ej. *IBM Plex Mono*) para etiquetas técnicas.

*(Este conocimiento ha sido infundido en el agente IA del proyecto para elevar automáticamente la calidad del código generado desde cero o desde una referencia).*
