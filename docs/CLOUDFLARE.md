# Configuración de Cloudflare

## Configuraciones Peligrosas (NO ACTIVAR POR DEFECTO)
- **Email Address Obfuscation (Scrape Shield):** Retrasa el parser de HTML (`email-decode.min.js`) y bloquea renderizado de elementos visuales (LCP). Solo activar si la web sufre ataques de spam severos.
- **HSTS Preload / includeSubDomains:** Es irreversible por meses. Solo activar si todos los subdominios de por vida usarán SSL válido.
- **Rocket Loader:** Interfiere fuertemente con GSAP e IntersectionObserver.

## Reglas de Caché
- `_headers` maneja el caché estático en Edge.
- Assets versionados (`main.js?v=X`) y fuentes deben tener caché largo (1 año).
- `/index.html` debe tener `must-revalidate` para evitar mostrar sitios desactualizados (o apoyarse plenamente en el despliegue automático de CF Pages).
