# Capacidades del kit

El catálogo describe instrucciones disponibles, no certificaciones ni entornos preinstalados. Los proyectos se implementan y validan según cada encargo.

## Skills disponibles

| Skill | Alcance |
|---|---|
| [arquitecto-fullstack](../.agents/skills/arquitecto-fullstack/SKILL.md) | Arquitecturas, SaaS y CRM |
| [referencias-producto](../.agents/skills/referencias-producto/SKILL.md) | Evaluación de Clone Wars y complemento de REA |
| [workspace-colaborativo](../.agents/skills/workspace-colaborativo/SKILL.md) | Documentos, wikis, kanban y evaluación de AppFlowy |
| [desarrollo-frontend](../.agents/skills/desarrollo-frontend/SKILL.md) | React, Vue y Angular |
| [desarrollo-backend](../.agents/skills/desarrollo-backend/SKILL.md) | Java, C#/.NET y Python |
| [desarrollo-movil](../.agents/skills/desarrollo-movil/SKILL.md) | Android, React Native y Flutter |
| [sistemas-embebidos](../.agents/skills/sistemas-embebidos/SKILL.md) | C, C++ y Arduino |
| [bases-datos](../.agents/skills/bases-datos/SKILL.md) | SQL y cinco motores relacionales |
| [devops-iac](../.agents/skills/devops-iac/SKILL.md) | DevOps, Terraform y Pulumi |
| [trading-cuantitativo](../.agents/skills/trading-cuantitativo/SKILL.md) | Backtesting, simulación y software de trading |
| [reverse-engineer-anything](../.agents/skills/reverse-engineer-anything/SKILL.md) | Investigación con REA; MCP externo |
| [robot-contenidos](../.agents/skills/robot-contenidos/SKILL.md) | Automatización de artículos |
| [seo-auditor](../.agents/skills/seo-auditor/SKILL.md) | Auditorías SEO |
| [slider-resenas](../.agents/skills/slider-resenas/SKILL.md) | Testimonios y componentes de reseñas |

## Perfiles de diagnóstico

| Perfil | Trabajo | CLIs que busca |
|---|---|---|
| `react` | React | node, npm |
| `vue` | Vue | node, npm |
| `angular` | Angular | node, npm |
| `java` | Java | java |
| `dotnet` | C# / .NET | dotnet |
| `python` | Python | python |
| `android` | Android (Java/Kotlin) | java, adb |
| `react-native` | React Native | node, npm, java, adb |
| `flutter` | Flutter / AppFlowy | flutter |
| `rust` | Rust (componentes de AppFlowy) | rust |
| `c` | C | c, cmake |
| `cpp` | C++ | cpp, cmake |
| `arduino` | Arduino | arduino |
| `sqlite` | SQLite | sqlite |
| `postgresql` | PostgreSQL | postgresql |
| `mysql` | MySQL | mysql |
| `sqlserver` | SQL Server | sqlserver |
| `oracle` | Oracle | oracle |
| `sql` | SQL general (seleccionar motor) | Elegir stack/motor primero |
| `terraform` | Terraform | terraform |
| `pulumi` | Pulumi | pulumi |
| `docker` | Docker / DevOps | docker |
| `trading` | Trading cuantitativo | python |
| `crm` | CRM y arquitectura | Elegir stack/motor primero |

## Alcance de la verificación

`npm run kit:validate` verifica catálogo, frontmatter y referencias locales de skills. `npm run test:kit` comprueba el contrato del CLI. `doctor` detecta CLIs mediante versión/ayuda sin instalar herramientas ni comprobar credenciales. No certifica compatibilidad de versiones, conexión a bases de datos, SDKs móviles, hardware ni cuentas cloud.

Las skills nuevas cubren decisiones y pasos de implementación. No hay plantillas ejecutables listas para todos los lenguajes. El starter ejecutable del kit sigue siendo HTML/CSS/JS y los automatismos existentes tienen sus propios requisitos.

## Fuentes de desarrollo

Consulta la documentación enlazada desde la skill de cada familia y verifica versiones antes de iniciar un proyecto. Las cuotas cloud, comandos de SDK y APIs de broker no se consideran fijos.

## Ejemplos combinados

- CRM: arquitecto-fullstack + desarrollo-frontend/backend + bases-datos.
- Workspace: workspace-colaborativo + arquitecto-fullstack; AppFlowy es opcional.
- Investigación de app: referencias-producto; añadir REA solo si el caso requiere su evidencia.
- Aplicación de trading: trading-cuantitativo + backend + datos; simulación antes de ejecución autorizada.
- Dispositivo: sistemas-embebidos; añadir backend/datos para telemetría si se solicita.

## Estado de integraciones

- REA: skill incluida; servidor MCP y motores requieren configuración aparte.
- Clone Wars: fuente de referencias, sin descarga masiva ni instalación.
- AppFlowy: workflow de evaluación y construcción, sin cuenta conectada, API verificada ni código importado.
- Brokers, Terraform/Pulumi cloud, SQL Server/Oracle y tiendas móviles: no conectados por instalar el kit.
