# Implementation Plan: Canedo Web Studio Starter Kit

## 1. Objetivo del starter-template
Crear un "molde de oro" independiente y reutilizable (`starter-template/`) que encapsule todas las mejores prácticas técnicas aprendidas en `canedostudio.com`. Servirá como base para inicializar nuevos proyectos estáticos de clientes, garantizando LCP bajo, cero deuda técnica, y un workflow estandarizado de despliegue.

## 2. Arquitectura propuesta
El repositorio se consolidará como un monorepo real. El código base y las reglas vivirán en `starter-template/` y `docs/`, mientras que los clientes finales residirán en `cazas/`. Las herramientas (Node.js) se centralizarán en `scripts/` y se ejecutarán vía `npm run`.

## 3. Árbol de carpetas
```text
/
├── starter-template/
│   ├── index.html
│   ├── styles.css
│   ├── main.js
│   ├── wrangler.toml
│   ├── _headers
│   ├── _redirects
│   ├── robots.txt
│   ├── sitemap.xml
│   ├── assets/
│   │   ├── fonts/
│   │   └── img/
│   │       └── placeholders/
│   └── data/
├── scripts/
│   ├── validate.js
│   ├── verify-production.js
│   └── new-site.js
├── docs/
│   ├── IMPLEMENTATION-PLAN.md
│   ├── PERFORMANCE.md
│   ├── NEW-SITE-CHECKLIST.md
│   ├── CLOUDFLARE.md
│   └── DEBUGGING.md
├── cazas/
│   ├── canedostudio.com/ (No tocar)
│   └── luiscanedo/ (No tocar)
├── package.json
└── README.md
```

## 4. Archivos a crear
- `starter-template/index.html` (Markup base con placeholders).
- `starter-template/styles.css` (Diseño base, variables CSS, clases media-picture).
- `starter-template/main.js` (Lógica vanilla del slider, menú e IntersectionObserver).
- Archivos de config (`wrangler.toml`, `_headers`, etc.).
- Scripts Node.js (`validate.js`, `verify-production.js`, `new-site.js`).
- 4 manuales en `docs/`.

## 5. Responsabilidad de cada archivo
- **HTML:** Estructura semántica accesible, H1 visible y links precargados.
- **CSS:** Layout principal sin scripts, variables de tema y responsive.
- **JS:** Comportamiento no crítico (lazy loading de componentes, carrusel, reveals).
- **Scripts:** Automatizar creación de sitios (`new-site`), asegurar calidad (`validate`) y garantizar que el caché del edge no rompa actualizaciones (`verify-production`).
- **Docs:** Preservar el conocimiento.

## 6. Buenas prácticas que incorpora
- LCP independiente de JavaScript (H1 en HTML/CSS plano).
- IntersectionObserver nativo para `.reveal`.
- Touch targets de mínimo 44x44px.
- Variables locales de `font-display: swap`.
- `<picture>` con WebP.
- `defer` en todos los scripts propios.
- Despliegue en Cloudflare Pages con caché agresivo estático.

## 7. Qué NO debe incorporar
- Textos o datos copiados de clientes.
- Cargas bloqueantes síncronas.
- Ocultación del Hero mediante `opacity: 0` o pre-LCP.
- Múltiples motores de scroll mezclados.
- `display: contents` inseguro en imágenes de carruseles.

## 8. Dependencias permitidas
- Ninguna obligatoria en frontend.
- Backend/Scripts: Node.js standard library (sin `node_modules` pesados si se puede evitar) o librerías ligeras para CLI.

## 9. Dependencias prohibidas por defecto
- **GSAP:** Opcional, solo si el diseño lo requiere explícitamente y nunca para revelar H1.
- **ScrollTrigger:** Terminantemente prohibido en el starter base.
- **Google Fonts (CDN):** Prohibido por defecto.
- **JQuery / Tailwind:** (salvo decisión de negocio).

## 10. Estrategia de imágenes
Arquitectura basada en `<picture>` con `media="(max-width: 768px)"` para evitar ambigüedades de DPR en móviles retina. Placeholders ligeros en formato WebP con dimensiones predefinidas. Fetchpriority alto exclusivo para Hero. Lazy load para el resto.

## 11. Estrategia de fuentes
`@font-face` apuntando a archivos `woff2` descargados localmente en `assets/fonts/`. Fallback inmediato al sistema operativo con `font-display: swap`. Preload opcional solo si es crítico.

## 12. Estrategia de SEO
`index.html` vendrá con placeholders tipo `{{DOMAIN}}` y `{{DESCRIPTION}}` para inyectar automáticamente meta descripciones, title tag, og:image, canonical, JSON-LD base, y se generará `robots.txt` y `sitemap.xml` genérico.

## 13. Estrategia de accesibilidad
Estructura de headings estricta (H1 -> H2 -> H3, sin saltos). Botones semánticos (`<button>` vs `<a>`), atributos `aria-label`, foco de teclado visible, y respeto a `prefers-reduced-motion` en todo CSS/JS.

## 14. Estrategia de performance
Core Web Vitals optimizados por diseño: Cero reflows forzados en el boot, LCP en < 1.5s, no dependencias render-blocking.

## 15. Estrategia Cloudflare
Archivo `wrangler.toml` pre-configurado para Pages. Documentación clara sobre qué funciones habilitar (Auto Minify) y cuáles desactivar (Email Address Obfuscation si rompe LCP).

## 16. Estrategia de cache
Archivo `_headers` definirá `Cache-Control: public, max-age=31536000, immutable` para `/assets/` y `Cache-Control: public, max-age=0, must-revalidate` para `/index.html`.

## 17. Estrategia de formularios
Base HTML sólida, idealmente conectada a endpoints externos simples sin requerir backend propio. Prevención de envíos múltiples nativa.

## 18. Estrategia de slider
Un único motor de slider vanilla. Variables de estado limpias (`currentIndex`), funciones `goTo(index)` y `apply()`. Soporte para swipe/touch, resize dinámico, y validación de índice máximo según cuántas cards son visibles (`maxIndex = total - visibles`).

## 19. Estrategia de animaciones
`.reveal` gestionado por `IntersectionObserver` genérico. Las animaciones aplicarán clases activas que CSS transicionará (`transform, opacity`). Si GSAP se integra después, documentar que debe limpiar propiedades correctamente (`clearProps`).

## 20. Estrategia de debug
No dejar `console.log` en producción. Añadir soporte para `?debug=1` en URL que active logs detallados y bordes rojos visuales en componentes críticos.

## 21. Estrategia de validación
Script Node `npm run validate` que parsee archivos locales para detectar problemas de SEO, imágenes sin alt, y referencias muertas (ej. GSAP) antes del commit.

## 22. Estrategia de new-site
Script CLI `npm run new-site` que solicitará datos (Business Name, Slug, Colors). Clonará el contenido de `starter-template/` a `cazas/<slug>` y reemplazará las cadenas `{{PLACEHOLDER}}`. Si el directorio ya existe, abortará para proteger datos.

## 23. Riesgos
- **Sobrescribir clientes:** Mitigado bloqueando `new-site` si la carpeta destino existe.
- **Sobrecargar el kit:** Mantener Vanilla JS estricto para evitar una curva de aprendizaje compleja.

## 24. Plan de pruebas
Ejecutar `npm run new-site`, crear un cliente de prueba, someterlo a `npm run validate`, previsualización en distintos viewports y testeo manual exhaustivo de carrusel/animaciones y performance base en Lighthouse.

## 25. Orden de implementación
1. Crear carpetas `docs/`, `scripts/` y `starter-template/`.
2. Escribir los 4 manuales base en `docs/`.
3. Construir `starter-template/` y sus subcarpetas (HTML, CSS, JS, config).
4. Desarrollar `new-site.js` para automatizar clonado.
5. Programar los validadores (`validate.js` y `verify-production.js`).
6. Actualizar `README.md` con las nuevas rutas y comandos.
7. Test final, commit y entrega.
