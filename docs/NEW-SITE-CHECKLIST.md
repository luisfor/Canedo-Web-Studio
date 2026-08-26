# New Site Creation Checklist

Sigue estos pasos para crear y lanzar una web de cliente impecable:

1. [ ] **Crear proyecto:** Ejecuta `npm run new-site` en la raíz.
2. [ ] **Rellenar datos:** Contesta los prompts (Slug, Business Name, etc.).
3. [ ] **Verificar placeholders:** Entra a `cazas/<slug>` y comprueba que `index.html` y `styles.css` tienen los datos correctos.
4. [ ] **Imágenes:** Reemplaza los WebP de `assets/img/placeholders/` (manteniendo `hero-mobile`, `hero-desktop`, etc.).
5. [ ] **Fuentes:** Descarga las fuentes .woff2 necesarias en `assets/fonts/` (o quédate con system fallback).
6. [ ] **Testing local:** Ejecuta un live server y abre 390px, 768px y 1440px.
7. [ ] **Validar QA:** Ejecuta `npm run validate cazas/<slug>`. No deben haber errores.
8. [ ] **Desplegar:** Si usas Cloudflare Pages, configura el proyecto apuntando al directorio raíz del cliente (o configúralo con Wrangler).
