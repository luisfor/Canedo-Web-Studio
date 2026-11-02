# Canedo Web Studio — kit de desarrollo asistido por IA

Kit reutilizable para crear y rediseñar webs, desarrollar aplicaciones y preparar automatizaciones con un asistente de programación. Incluye skills, plantillas HTML/CSS/JS, scripts de validación y ejemplos de Cloudflare Workers.

**[Instalación](INSTALACION.md) · [Primeros pasos](EMPIEZA-AQUI.md) · [Capacidades y límites](docs/CAPACIDADES.md) · [REA, Clone Wars y AppFlowy](docs/REFERENCIAS-PRODUCTO.md)**

## Descargar y empezar

```bash
git clone https://github.com/luisfor/Canedo-Web-Studio.git
cd Canedo-Web-Studio
npm ci
npm run kit:catalog
npm run kit:validate
```

Abre la carpeta en tu asistente. Codex descubre las skills de `.agents/skills/`; Claude Code dispone de las skills originales de `.claude/skills/` y del enrutamiento de `CLAUDE.md`. Para instalar las skills nuevas como skills nativas de otro agente, usa las opciones de [INSTALACION.md](INSTALACION.md).

El kit aporta instrucciones y herramientas de desarrollo: **no instala automáticamente SDKs, bases de datos, brokers, AppFlowy ni el servidor MCP de REA**. Cada proyecto requiere sus dependencias y pruebas. No se promete que todas las plataformas estén verificadas por instalar una skill.

## Qué puede ayudarte a construir

| Área | Recursos incluidos |
|---|---|
| Webs de negocios | Rediseño, branding, landing pages, propuestas comerciales y plantilla estática |
| Frontend | Skill para React, Vue y Angular: componentes, formularios, rutas, estado y APIs |
| Backend | Skill para Java, C#/.NET y Python: APIs, persistencia, trabajos y autenticación |
| Móvil | Skill para Android Java/Kotlin, React Native y Flutter; guía para componentes Rust de AppFlowy |
| Sistemas y hardware | Skill para C, C++, Arduino, memoria, protocolos y validación de firmware |
| Datos | Skill para SQL, SQL Server, SQLite, PostgreSQL, MySQL y Oracle |
| Arquitectura y CRM | Modelado, permisos, organizaciones, pipeline comercial, auditoría y contratos |
| Workspace | Procedimientos para documentos por bloques, wikis, tablas, kanban, offline y colaboración |
| DevOps | Skill de CI/CD, contenedores, observabilidad, Terraform y Pulumi |
| Trading cuantitativo | Investigación, backtesting, costes, simulación y controles de riesgo; sin promesas de rentabilidad |
| Referencias | Evaluación de proyectos de Clone Wars y de AppFlowy; ruta para complementarlos con REA |
| Ingeniería inversa | Skill original REA con siete referencias y licencia MIT; herramientas externas opcionales |
| IA y diseño | Generación/búsqueda de imágenes según proveedor y pipeline Design-to-Web; integración de chatbots con backend privado |
| Publicación | Guías para Cloudflare Pages/Workers y Hostinger; infraestructura full-stack y móvil separada |
| Marketing | Skills de SEO, blog automático y reseñas; ejemplos de bots sociales y agente comercial |

Son **14 skills en `.agents/skills/` y 24 perfiles de herramientas**. Los perfiles son rutas de trabajo y detección de CLIs; no son 24 aplicaciones ya implementadas. El catálogo en `config/kit-capabilities.json` identifica sus nombres y requisitos.

## Cómo se complementan los repositorios

- **REA:** mejor para investigar paquetes, binarios y comportamiento en ejecución que no esté explicado por fuentes completas.
- **Clone Wars:** mejor como índice para encontrar ejemplos y alternativas con código; hay demos educativas y proyectos más completos. Revisa cada candidato.
- **AppFlowy:** mejor referencia de los tres para documentos, tablas y colaboración; es una aplicación Flutter/Rust con licencia AGPLv3, no un plugin REA.

Esta comparación describe para qué usar cada uno; no existe un ganador para todas las tareas. El kit añade procedimientos propios de selección y construcción. No incluye una copia del catálogo de Clone Wars ni del código de AppFlowy. Consulta [fuentes y alcance](docs/REFERENCIAS-PRODUCTO.md).

## Comandos del kit

```bash
npm run kit:catalog
npm run kit:catalog -- --profile react --json
npm run kit:doctor -- --profile react
npm run kit:doctor -- --profile dotnet --strict
npm run kit:validate
npm run test:kit
```

`doctor` ejecuta comprobaciones de versión/ayuda de las CLIs del perfil. No descarga herramientas ni comprueba credenciales, servidores, SDKs, versiones compatibles o hardware. Sin `--strict`, los programas ausentes son informativos. Sin perfil revisa todas las CLIs del catálogo y puede tardar.

### Herramientas existentes para webs

```bash
npm run new-site
npm run validate -- mi-cliente
npm run verify-production -- https://example.com
npm run design-to-web:analyze -- tests/design-to-web/simple-landing.png mi-proyecto
```

Consulta el contrato exacto de los scripts en [Design-to-Web](docs/DESIGN-TO-WEB.md), [lista de entrega](docs/NEW-SITE-CHECKLIST.md) y [depuración](docs/DEBUGGING.md). La plantilla estática y su despliegue no sustituyen un servidor para Java, .NET o Python ni un build móvil.

## Ejemplos de peticiones

- «Crea una web para una clínica con sus datos reales y prepara una propuesta».
- «Construye un CRM en Vue, Java y PostgreSQL con aislamiento entre empresas».
- «Añade una API en C#/.NET con SQL Server al proyecto existente».
- «Compara referencias de Clone Wars para un marketplace en React».
- «Diseña un workspace con documentos y kanban tomando AppFlowy como referencia».
- «Implementa una app Android o React Native que funcione sin conexión».
- «Programa este sensor Arduino; indica qué necesitas saber de la placa».
- «Prepara Terraform o Pulumi para este entorno y muestra el plan».
- «Evalúa una estrategia en Python con datos históricos, costes y periodo fuera de muestra».

La skill de trading ayuda a desarrollar software y estudiar hipótesis. No instala un broker, no garantiza resultados y no envía órdenes reales por defecto.

## Automatismos y recursos existentes

- [Blog automático](automatismos/README.md): Worker, KV, generación de artículos/portadas y notificaciones opcionales; requiere recursos propios.
- [Bot social](automatismos/social-media-bot/README.md): código de generación de contenido y revisión con Telegram; configura proveedores y almacenamiento.
- [Agente comercial](automatismos/canedostudio-sales-agent/README.md): ejemplo con D1 y conversaciones; su README documenta adaptadores y pasos pendientes. No se considera producción lista por copiarlo.
- [Reseñas](componente-resenas.md): carrusel de testimonios y formulario de valoración; usa reseñas reales y verifica políticas vigentes del proveedor antes de publicar flujos de solicitud.
- [Propuesta](plantilla-propuesta.md), [plantilla de valoración](plantilla-calificanos.html), [despliegue](despliegue.md), [rendimiento](docs/PERFORMANCE.md), [diseño](docs/PREMIUM-DESIGN-SYSTEM.md), [datos estructurados](docs/STRUCTURED-DATA.md).

## Privacidad, costes y licencias

Usa tus propias cuentas y claves. Guarda secretos en variables privadas o un gestor de secretos, nunca en código que se entregue al navegador. `.env`, `secretos/`, configuraciones locales y trabajos en `cazas/` están excluidos; revisa Git antes de publicar.

Los precios y cuotas dependen del proveedor y cambian. El kit no garantiza coste cero, facturación ni resultados comerciales. Cada SDK/servicio requiere verificar requisitos actuales y la autorización del entorno de destino.

REA conserva su [licencia MIT](.agents/skills/reverse-engineer-anything/LICENSE). Otros componentes conservan sus avisos; [referencias y procedencia](docs/REFERENCIAS-PRODUCTO.md). No supongas que todos los proyectos enlazados por un catálogo comparten una licencia.
