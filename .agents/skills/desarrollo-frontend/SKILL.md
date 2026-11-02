---
name: desarrollo-frontend
description: Crear, modificar o migrar interfaces con React, Vue o Angular; resolver componentes, formularios, rutas, estado, accesibilidad y conexiones con APIs.
---
# Frontend React, Vue y Angular
Lee manifiesto, lockfile, configuración y componentes existentes antes de elegir herramientas. Respeta el framework pedido; no conviertas Vue o Angular en Next.js. Elige SPA, SSR o generación estática según navegación, SEO, caché y despliegue.
Para un proyecto nuevo verifica requisitos actuales en la documentación oficial; usa un generador oficial con versión elegida y conserva el lockfile. No instales los tres frameworks.
## React
Componentes y hooks con dependencias correctas; evita efectos para derivar datos que ya están en props/estado. Distingue estado de servidor, formularios y estado local. Considera un framework cuando requieras renderizado en servidor; Vite es una opción para SPA, no un backend. No uses APIs de React Server Components sin un entorno que las soporte.
## Vue
Distingue refs, objetos reactivos y computed; evita perder reactividad al desestructurar. Sigue convenciones de Single File Components del proyecto, limpia watchers y suscripciones. Usa router y almacén compartido solo donde se necesitan; Nuxt y Vue SPA tienen despliegues diferentes.
## Angular
Respeta versión, componentes y estrategia de formularios del repositorio. Usa inyección de dependencias; modela señales/observables sin suscripciones huérfanas. Las guardas del router mejoran navegación pero no autorizan operaciones de backend.
## Entrega vertical
Implementa un flujo completo con carga, vacío, error, éxito y permisos. Mantén credenciales en servidor, valida en ambos extremos y no asumas que CORS autentica. Verifica teclado, etiquetas, foco, móvil y estados lentos. Ejecuta build, chequeo de tipos y una prueba del flujo relevante con las herramientas existentes.
Fuentes: [React](https://react.dev/learn/creating-a-react-app), [Vue](https://vuejs.org/guide/quick-start.html), [Angular](https://angular.dev/tools/cli/setup-local).
