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

## Trabajo y privacidad

Respeta el stack y el alcance pedidos. Los proyectos de clientes van en `cazas/<slug>/` o en la ubicación indicada por el usuario. No publiques credenciales, datos personales, configuraciones de cuenta ni proyectos privados; no agregues archivos ignorados a la fuerza.

Antes de subir cambios revisa el diff y sus rutas; usa una lista explícita de archivos. Mantén los avisos y licencias de terceros.

## Verificación

Para cambios del catálogo/CLI: `npm run kit:validate` y `npm run test:kit`. Para webs y automatismos usa los comandos del componente modificado. No declares que se compiló o ejecutó una plataforma si solo se revisaron instrucciones.
