# Canedo Web Studio

Habla en español salvo que el usuario pida otro idioma. Usa README.md y docs/CAPACIDADES.md para describir el estado real del kit. No anuncies un SDK instalado, un servicio conectado o una aplicación completa por disponer de una skill.

## Selección de skills

Las skills están en `.agents/skills/<nombre>/SKILL.md`. Lee solo las pertinentes:

| Petición | Skill |
|---|---|
| React, Vue, Angular | desarrollo-frontend |
| Java, C#/.NET, Python, APIs | desarrollo-backend |
| Android, React Native, Flutter, componentes de AppFlowy | desarrollo-movil |
| C, C++, Arduino | sistemas-embebidos |
| SQL Server, SQLite, PostgreSQL, MySQL, Oracle, SQL | bases-datos |
| CI/CD, Terraform, Pulumi, infraestructura | devops-iac |
| CRM, SaaS y arquitectura | arquitecto-fullstack |
| Backtesting, simulación, software de trading | trading-cuantitativo |
| Clones y alternativas con código fuente | referencias-producto |
| Documentos, wikis, kanban, colaboración y evaluación de AppFlowy | workspace-colaborativo |
| Binarios, paquetes y evidencia de ejecución | reverse-engineer-anything |
| Blog automático | robot-contenidos |
| SEO | seo-auditor |
| Testimonios y componentes de reseñas | slider-resenas |

REA se reserva para preguntas que requieren sus herramientas; las fuentes completas se analizan con herramientas normales. Clone Wars es un índice de referencias y AppFlowy es un producto externo. No descargues todos sus proyectos ni los ejecutes por instalar las skills.

## KIT-FIRST y continuidad

Antes de generar proyectos desde el kit: consulta su versión/catálogos, inspecciona el destino, identifica componentes existentes, evalúa reutilización y prepara un plan. Usa `kit:agent discover/plan/validate/create` o las herramientas MCP equivalentes; no omitas evidencias o conflictos para forzar generación. Conserva la CLI manual anterior. La API controla sus operaciones, no escrituras externas a ella.

No dupliques autenticación, API, persistencia o módulos detectados. Una declaración/inferencia no demuestra funcionamiento: verifica antes de reutilizar y no impongas otro stack. Para continuar, consulta `kit:memory status`; prepara mejoras con `devkit enhance` o `kit:memory enhance`. No regeneres un proyecto existente. Preserva personalizaciones; aplica únicamente el plan revisado con su ID exacto, y detente ante conflictos o reconciliación pendiente. No ejecutes migraciones, instalaciones, proveedores o Docker por generar archivos.

Mantén separados los estados generados/observados de las funciones verificadas y las conexiones reales. Lee [KIT-FIRST](docs/kit-first/README.md), [continuidad](docs/continuity/README.md) y [adaptadores de agentes](docs/integrations/agents.md) cuando corresponda. Si trabajas en el propio kit, reutiliza sus módulos y pruebas y conserva contratos anteriores antes de ampliarlos.

## Trabajo y privacidad

Respeta el stack y el alcance pedidos. Los proyectos de clientes van en `cazas/<slug>/` o en la ubicación indicada por el usuario. No publiques credenciales, datos personales, configuraciones de cuenta ni proyectos privados; no agregues archivos ignorados a la fuerza.

Antes de subir cambios revisa el diff y sus rutas; usa una lista explícita de archivos. Mantén los avisos y licencias de terceros.

## Verificación

Para cambios del catálogo/CLI: `npm run kit:validate` y `npm run test:kit`. Para webs y automatismos usa los comandos del componente modificado. No declares que se compiló o ejecutó una plataforma si solo se revisaron instrucciones.
