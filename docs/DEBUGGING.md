# Estrategia de Debugging

## Sliders Rotos o Invisibles
- Revisa el CSS base (`styles.css`). El `slider-track` debe tener display `flex` o similar y un `transform` manejado por JavaScript.
- Comprueba que las imágenes dentro del slider NO tienen `display: contents`, ya que rompe la medición de dimensiones en JS y WebKit.

## Fallo en LCP (Element Render Delay alto)
- Si hay un script de Cloudflare o externo (`email-decode`) cargado síncronamente antes del DOM.
- Si se usa GSAP con una clase `opacity: 0` forzada desde CSS que JS tarda en eliminar.

## Validar Sincronización Local/Producción
Usa el comando readonly:
`npm run verify-production <url> <local-slug>`
Si lanza advertencias de tamaños distintos, puede que CF Pages no haya purgado la caché o haya un Worker/Cache API reteniendo el asset.
