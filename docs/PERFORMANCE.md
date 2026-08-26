# Performance Standards

## 1. LCP (Largest Contentful Paint)
- El LCP casi siempre será el `<h1 class="hero-title">` o la imagen hero.
- **Regla de Oro:** NUNCA uses `opacity: 0` o `display: none` en el LCP mientras esperas a JavaScript o GSAP.
- El HTML y CSS deben renderizar el elemento clave de inmediato.

## 2. Imágenes
- Usar `<picture>` para servir imágenes cortadas según DPR y viewport.
- Hero Image: `fetchpriority="high"`, `loading="eager"`.
- Demás imágenes: `loading="lazy"`, `decoding="async"`.

## 3. JavaScript
- Todo script de lógica (como `main.js`) debe ir con `defer` para no bloquear el parser.
- Prohibido usar `ScrollTrigger.min.js` a menos que sea 100% necesario. Para animar elementos on-scroll (`.reveal`), usar `IntersectionObserver` que es nativo.

## 4. CSS
- Carga crítica local. Evitar dependencias de red como `@import` hacia Google Fonts.
