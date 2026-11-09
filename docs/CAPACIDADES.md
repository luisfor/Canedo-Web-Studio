# Capacidades del kit

El catálogo de skills describe instrucciones disponibles, no certificaciones ni entornos preinstalados. Los generadores ejecutables tienen un alcance específico, descrito por separado.

## Descubrimiento y KIT-FIRST

La [interfaz de agentes](kit-first/README.md) publica versión/catálogos, inspecciona un destino sin ejecutarlo y exige evidencias vigentes antes de planificar/generar. Identifica declaraciones e inferencias de módulos, autenticación, APIs y persistencia para conservarlas. Su generación usa el motor y la escritura segura existentes. Un proyecto existente requiere evolución incremental y queda protegido contra regeneración completa. Las evidencias se validan por esquema y se contrastan con el estado actual; no certifican identidad del agente ni controlan operaciones fuera de la API. No se presenta CLI/JSON como integración MCP o compatibilidad universal.

## Motor de composición ejecutable

La [ampliación de generadores](composition/README.md) incorpora inventario funcional en Python, con SQLite o JSON-file, sin dependencias pip. La elección no impone Node a otros adaptadores, y se admiten validadores de artefactos no HTTP. Los [20 paquetes comerciales](commercial-packages/README.md) distinguen alcance parcial/planificado de disponibilidad; ningún canal se activa por registrarlo. Las pruebas Python nativas usan el runtime existente, sin instalaciones.

La [memoria y continuidad](continuity/README.md) adopta registros anteriores sin modificarlos y distingue generación de verificación. Las mejoras incrementales iniciales añaden capacidades a composiciones v1 Node/SQLite mediante planes revisables, hashes, copias locales y detección de operaciones parciales. Otros proyectos pueden registrarse, pero necesitan reconciliadores compatibles para modificar código. No se ejecutan migraciones o servicios al aplicar.

El [motor de composición](PROJECT-COMPOSITION.md) interpreta solicitudes en español sin IA de pago, consulta todos los proyectos/arquetipos de su registro, resuelve dependencias y señala conflictos. Genera código propio de productos, inventario, ventas, caja, compras, proveedores, CRM y puertos WhatsApp/chatbot según selección. Produce APIs, SQLite, migraciones, OpenAPI, eventos/interfaces, pruebas, documentación y Compose opcional. El monolito modular es la opción inicial; los servicios independientes requieren justificación. El [ejemplo reproducible](../examples/composition/README.md) verifica venta → stock → caja → CRM, con persistencia real y HTTP local.

Los generadores de negocio actuales son Node/SQLite v1, Python/inventario (SQLite/JSON) y Node business v2, ampliables mediante adaptadores locales revisados. Las solicitudes de tecnologías sin generador compatible se bloquean sin migrar el stack. Los contratos y puertos HTTP son neutrales respecto al lenguaje; no se da por conectada una aplicación externa por registrarla. AFPVentas/Vocero aportan referencias arquitectónicas, sin código copiado. WhatsApp e IA reales están deshabilitados; su integración se prueba con adaptadores simulados. Business v2 incluye una bandeja web mínima; no incluye impuestos, contabilidad completa ni proveedores de mensajería/IA activos.

El plan y la escritura no ejecutan comandos. `composition verify` y las pruebas son acciones explícitas: ejecutan el código generado solo con datos temporales y HTTP en localhost. La escritura segura rechaza destinos existentes. Consulta el [informe de resultados y limitaciones](reports/PROJECT-COMPOSITION.md).

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

`npm run kit:validate` verifica catálogo, frontmatter y referencias locales de skills. `npm run test:kit` comprueba el contrato del CLI. `doctor` informa OS, arquitectura, versiones de CLIs y gestores por presencia, sin instalar herramientas ni comprobar credenciales. Evalúa compatibilidad solo si se declara una regla explícita; no certifica conexiones a bases de datos, SDKs móviles, hardware ni cuentas cloud. Consulta [el alcance de la fase B](ENVIRONMENT-DOCTOR.md).

Las skills nuevas cubren decisiones y pasos de implementación. No hay plantillas ejecutables listas para todos los lenguajes. El starter web HTML/CSS/JS, los automatismos existentes y el nuevo generador Node/SQLite de composición conservan sus alcances y requisitos propios.

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

## Catálogo de herramientas — fase C

Además de las 14 skills y 24 perfiles, hay un [catálogo versionado independiente](TOOL-CATALOG.md) con 80 entradas: 22 diagnósticos y 58 referencias documentadas. Incluye fuentes, dependencias obligatorias/opcionales y reglas explícitas de versión para Node, Python y Go. No constituye un instalador ni añade generadores. Se consulta con `npm run kit:tools -- list` y se valida junto al catálogo existente.

## Planificador — fase D

`npm run kit:plan -- --tool go` combina catálogo y diagnóstico, ordena dependencias y detecta exclusiones, conflictos y restricciones. Distingue reutilización, inspección, revisión de instalaciones existentes y elección de despliegue de bases de datos. Permite seleccionar versión y gestor sin instalarlos. Guarda huellas verificables, sin atribuirles autorización o autenticidad. Véase [INSTALLATION-PLANNER.md](INSTALLATION-PLANNER.md). El plan D sigue sin ejecutar cambios; las recetas separadas de la fase E se describen a continuación.

## Comandos manuales — fase E

Cinco adaptadores: Homebrew, winget, apt, dnf y archivos oficiales. Ocho herramientas con recetas iniciales: Node, Go, Python, Git, Java, .NET, Terraform y Docker; npm incluido con Node. La cobertura manual mantiene 71 entradas sin receta. El kit no inventa comandos para ellas ni convierte frameworks en instalaciones globales.

`kit:install commands` genera propuestas estructuradas y comandos entrecomillados para POSIX/PowerShell, sin ejecutar gestores, consultar la red ni modificar configuración. Incluye versión objetivo, versión de paquete, fuentes, dependencias, permisos, espacio no estimado cuando falta evidencia, riesgos y verificación. La validación reconstruye la propuesta con recetas versionadas y detecta modificaciones.

El modo asistido está reservado, no habilitado. El CLI y el API público rechazan `apply`; los motores internos Go/Node/Terraform y sus pruebas sintéticas se conservan. `prepare` sigue consultando metadatos oficiales sin descargar SDK; `validate` conserva propuestas anteriores y admite planes manuales. [Uso y límites](COMMAND-INSTALLATION.md).

Docker incorpora comandos manuales para Desktop o Engine y comprobaciones independientes de CLI, servidor, Desktop, Compose y Buildx. No se ejecutan ni se inicia ningún contenedor, descarga imagen o elimina dato. Las fases F–I añaden diagnóstico operativo, configuración de versiones y plantillas/comandos de servicios descritos abajo. El host de pruebas es macOS ARM64; Windows/Linux siguen sin certificación nativa. [Informe de entrega](reports/PHASE-E-MANUAL.md).

## Entornos y operación — fases F–I

- F: `kit:docker doctor` separa cliente, servidor, Desktop y plugins; no inicia componentes. Consulta de servidor optativa con protección de contextos remotos. `kit:project` genera versiones/dependencias para seis stacks y crea solo carpetas nuevas.
- G: diez perfiles optativos; cinco motores de datos y cinco backends /health en Compose, con Dockerfile cuando corresponde, secretos externos, health checks, redes, persistencia y límites. Sin pulls/builds/up automáticos ni aplicación de negocio completa.
- H: comandos manuales para estado, inicio/parada, logs, build/pull explícitos y reparación por inspección. Eliminación exige confirmar el proyecto y, para volúmenes, la pérdida de datos. Export/restore/compare/update preservan configuración inicial y detectan drift, sin capturar secretos/datos/código modificado.
- I: verificador por host, flujos integrados y matriz CI de cuatro runners definida. Resultados reales locales en macOS ARM64; Docker ausente y plataformas restantes sin ejecución nativa en esta sesión.

Se conservan 14 skills, 24 perfiles de diagnóstico y 80 herramientas. Los diez perfiles de preparación son adicionales. Las 71 entradas sin receta manual no se presentan como implementadas por añadir estos módulos. No se habilita modo asistido. [Guía](WORKSPACE-OPERATIONS.md) e [informe F–I](reports/PHASES-F-I.md).

### Verificación I ampliada

`verify native` ejecuta pruebas explícitas en localhost con runtimes existentes y la plantilla optativa 1.1.0 de Node/Python/Java; la original sigue intacta. Hay evidencia real de HTTP y compilación Java en macOS ARM64, sin instalar SDKs. `docker schema` valida contra el esquema oficial fijado por commit; `verify compose` comprueba archivos con la CLI existente sin motor/containers. La suite suma 301 pruebas y el verificador 25 controles. Docker, builds de imágenes y plataformas externas siguen pendientes de ejecución real. [Informe y evidencia](reports/PHASE-I.md).

## Evolución KIT-FIRST y aplicaciones comerciales

[Arquitectura](architecture/README.md), [CRM omnicanal](integrations/omnichannel.md), [SaaS/combinaciones](monetization/README.md), [seguridad](security/README.md) y [tutorial integral](tutorials/tienda-saas.md). Hay 25 capacidades registradas, 3 adaptadores de negocio y 20 paquetes (14 parciales, 6 planificados). Los canales, IA, pagos y fiscalidad reales permanecen pendientes/deshabilitados; reconocer un requisito no certifica su integración. Los informes antiguos conservan sus conteos históricos. La evidencia actual se consolida en [etapa 8](reports/KIT-EVOLUTION-STAGE-8.md).

## Planificación universal: entrega inicial (histórica)

La terminal prepara planes técnicos consultivos para tipos de software generales sin exigir capacidades comerciales. A–H tienen pruebas específicas, sin generar aplicaciones. Reutiliza catálogo de herramientas e inspección; el descubrimiento técnico no carga compositor/paquetes comerciales. Reconocer un nombre no demuestra instalación o soporte ejecutable. En esa entrega inicial, la conexión a recursos estaba pendiente; el estado actual de las mejoras 1–3 está en el apartado siguiente. La exposición de estos planes en clientes/MCP continúa pendiente. [Guía](cli/universal-planning.md) · [Informe](reports/UNIVERSAL-PLANNING-STAGE-1.md).

## Mejoras universales 1–3: recursos conectados

El plan técnico ya consulta dependencias, reglas de versión y restricciones de sistema mediante el planificador existente; combina perfiles, preparadores y recetas manuales. `--diagnose` ejecuta únicamente diagnósticos de versión elegidos; sin esa opción no ejecuta procesos. `--report` usa una instantánea aportada y la validación no reconsulta el equipo. Las versiones exactas pueden producir configuración en memoria, sin escribirla. El núcleo técnico no carga ejemplos, generadores ni catálogos comerciales y usa huellas independientes de ellos. Los planes de generación completos conservan sus controles previos. [Guía](cli/universal-planning.md) · [Informe y límites](reports/UNIVERSAL-IMPROVEMENTS-1-3.md). Las referencias a conexiones pendientes en la etapa 1 describen su estado histórico, anterior a estas mejoras.
