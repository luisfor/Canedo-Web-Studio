# Canedo Devkit

Asistente técnico local para desarrolladores y agentes compatibles con CLI/JSON o MCP. Flujo: **solicitud → análisis del kit → preparación revisable → desarrollo por el agente → validación → mejora**.

Esta es una **distribución preparada, todavía no publicada**. Repositorio previsto: `luisfor/canedo-devkit`; no se creó durante esta preparación ni se comprobó su disponibilidad en GitHub. El código original usa [ISC](LICENSE), con `Copyright (c) 2026 CanedoStudio`, conforme a la autorización del propietario y la [revisión documental de alcance](LICENSE-PROPOSAL.md). Los componentes de terceros conservan [sus avisos y licencias](THIRD-PARTY-NOTICES.md). `private: true` se conserva para evitar publicación npm accidental; no impide la licencia ISC ni autoriza publicar esta copia.

## Qué hace y qué no hace

Reutiliza catálogos, reglas de dependencias/versiones, diagnósticos, perfiles de preparación, recetas manuales, inspección, planificación universal, memoria y validación estática. Funciona localmente sin llamadas obligatorias a modelos. CLI, API CommonJS y MCP comparten controles KIT-FIRST.

No instala herramientas automáticamente, no ejecuta planes arbitrarios, no inicia Docker por generar configuraciones y no certifica una aplicación de producción. Los generadores existentes son ejemplos acotados, no generadores para todos los lenguajes. Los canales externos permanecen deshabilitados. Un plan construido no significa entorno instalado ni compilación verificada.

## Requisitos

- Node.js **24 o posterior**, npm y acceso de lectura/escritura a tus propios proyectos cuando decidas generar metadatos o archivos.
- Git solo si obtienes/actualizas el código mediante Git. También puedes usar una copia ZIP cuando exista una release aprobada.
- Python 3 para pruebas del adaptador Python y validación AST solicitada; otros SDK, Docker y gestores solo si usas esas capacidades. Su ausencia se informa, no se instala.
- Cuenta propia del agente elegido para usar ese cliente. El núcleo no requiere claves de proveedores, navegador ni servicio de IA pago.

macOS ARM64 tiene pruebas locales. Windows/Linux poseen escenarios simulados; la instalación nativa de esta distribución no se declara comprobada.

## Instalación y configuración

Todavía no hay URL de release aprobada. No uses el remoto histórico como si contuviera esta distribución. Cuando recibas la carpeta autorizada o su ZIP, entra en ella:

```sh
cd /ruta/canedo-devkit
npm ci --ignore-scripts
npm run kit:catalog
npm run kit:validate
```

**Instalación limpia: PENDIENTE DE VERIFICACIÓN**, por decisión del propietario; no es un fallo observado del kit. El comando anterior es una instrucción para el usuario y no se ejecutó durante la preparación. Solo instala AJV y cuatro dependencias transitivas del lockfile. No se incluyen Puppeteer ni herramientas de diseño ajenas al núcleo. No requiere `.env`. No copies configuraciones privadas de otro equipo.

Guarda tus proyectos fuera de la carpeta del kit. Usa rutas absolutas propias en la configuración local del cliente; los ejemplos contienen rutas genéricas y no se activan automáticamente. No sustituyas archivos completos de configuración: incorpora solo el bloque revisado y respalda lo existente.

## Uso desde terminal

```sh
node scripts/devkit.js plan "Crear una API con Python y FastAPI" --json
node scripts/devkit.js plan "Crear una aplicación web con React y PostgreSQL" --json
node scripts/devkit.js plan "Crear una API con Python y FastAPI" --project /ruta/proyecto --diagnose --json
npm run kit:tools -- list
npm run kit:tools -- dependencies govulncheck --json
npm run kit:doctor -- --tool python --json
npm run kit:profiles -- list
npm run kit:packages -- list --json
```

Sin `--diagnose` no se consultan procesos de versiones para el plan; con esa opción se piden explícitamente consultas locales acotadas. `--version python=X.Y.Z` permite fijar una versión exacta elegida por el usuario, no un valor `latest`. `create` no acepta un plan técnico consultivo como permiso de generación. Véase [planificación universal](docs/cli/universal-planning.md).

## API CommonJS

Con las dependencias instaladas bajo autorización, adapta las rutas antes de usar:

```js
const { controller } = require('/ruta/canedo-devkit');
const api = controller({ root: '/ruta/proyectos-propios' });
const contexto = api.call('kit_context', { project: '/ruta/proyectos-propios/mi-proyecto' });
const plan = api.call('kit_technical_plan', {
  project: '/ruta/proyectos-propios/mi-proyecto',
  contextId: contexto.contextId,
  text: 'Crear una API con Python y FastAPI'
});
```

La raíz debe existir; el proyecto debe estar dentro del ámbito. Son operaciones consultivas de la misma sesión del controlador, sin generar aplicaciones. Una inspección incompleta se informa y no debe forzarse. La API está implementada y cubierta por pruebas locales; este ejemplo de rutas genéricas no se ha ejecutado como instalación limpia.

## Integración MCP con Codex

Ejemplo de registro **manual y optativo** una vez revisadas las rutas:

```sh
codex mcp add canedo_devkit -- node /ruta/canedo-devkit/scripts/agents/mcp-server.js --root /ruta/proyectos-propios --compact --max-context-bytes 8192
codex mcp get canedo_devkit
```

La raíz debe existir; restringe el acceso a esa carpeta. Usa ruta absoluta de Node si el cliente no comparte el PATH de tu terminal. No añadas `--allow-generate` para el piloto. Consulta el [ejemplo TOML](examples/agents/codex-config.example.toml).

En una sesión nueva del cliente, consulta `/mcp` cuando esté disponible y pide una llamada real a `kit_context`; después usa `kit_technical_plan` con el `contextId` devuelto y el mismo proyecto. `codex mcp list` demuestra registro, **no conexión funcional**. Si no aparecen herramientas, revisa el error del cliente y su configuración efectiva; no vuelvas a registrar ni repares bases de datos por suposición.

## Gemini, Claude y otros agentes

[Guía y ejemplos de clientes](docs/integrations/clients.md). Se incluyen un bloque `mcpServers` para Gemini CLI, un comando de registro para Claude Code y campos STDIO genéricos. Debes usar las opciones y aprobaciones de tu versión del cliente.

| Interfaz | Verificación real disponible |
|---|---|
| CLI/JSON y API del kit | Pruebas locales automatizadas |
| MCP STDIO | Cliente de protocolo local, negociación y listado de herramientas probados |
| Codex Desktop / CLI | Conexión de extremo a extremo no verificada; registro no equivale a uso por el agente |
| Gemini CLI / Claude Code | Configuración propuesta basada en documentación oficial; cliente real sin verificar |
| Archivos AGENTS.md, CLAUDE.md, GEMINI.md | Instrucciones; no prueban conexión ni imponen controles fuera del kit |

No se instala ni inicia ninguno de esos agentes al usar el kit.

## Herramientas y lenguajes

Esta selección conserva **11 skills, 24 perfiles heredados y 80 herramientas catalogadas**; una entrada documentada no significa diagnóstico, preparador, generador o compilador disponible. Se excluyen tres skills de marketing específicas de la distribución original, sin modificar el núcleo de planificación.

Reconoce web/frontend, APIs/backend, móvil, escritorio, videojuegos, IoT, IA, automatización, datos, infraestructura y software empresarial. React/Vue/Angular, Go, Java, .NET/C#, Python, Android/React Native, C/C++/Arduino, SQL y Terraform/Pulumi aparecen con niveles diferentes. Unity u otra herramienta no registrada deben dar una limitación, no soporte inventado. [Catálogo](docs/TOOL-CATALOG.md) · [capacidades](docs/CAPACIDADES.md).

Los generadores existentes Node/SQLite, business y Python/inventario son ejemplos propios del kit, independientes del planificador universal. Otros stacks pueden producir planes sin generar aplicaciones. [Arquitectura](docs/architecture/README.md) · [composición](docs/composition/README.md) · [paquetes parciales](docs/commercial-packages/README.md) · [ejemplo de pruebas](docs/tutorials/tienda-saas.md). No se incluyen aplicaciones de clientes ni automatismos de marca.

## Diagnósticos y preparación de entornos

```sh
npm run kit:plan -- --tool python --json
npm run kit:install -- modes --json
npm run kit:install -- coverage
npm run kit:project -- plan --stack python --version 3.14.4 --json
npm run kit:docker -- doctor --json
```

La versión mostrada es un ejemplo explícito, no recomendación vigente. Los planes de entorno son revisables; no instalan SDKs ni dependencias. Las recetas contemplan Homebrew, winget, apt, dnf y mecanismos oficiales cuando hay receta. Docker distingue CLI, Engine, Desktop, Compose y Buildx; tener CLI no acredita un motor operativo. No borres volúmenes o datos sin autorización. [Operaciones](docs/WORKSPACE-OPERATIONS.md).

## KIT-FIRST y continuidad

Antes de generar código: descubrir capacidades → inspeccionar destino → reconocer stack/dependencias → evaluar reutilización → planificar → validar evidencia actual. El kit rechaza destinos/planes incompatibles o modificados y evita sobrescrituras. Sus controles solo cubren sus interfaces, no las escrituras realizadas directamente por un agente.

[Controles KIT-FIRST](docs/kit-first/README.md) · [memoria y personalizaciones](docs/continuity/README.md). Los checkpoints estáticos no certifican comportamiento ni builds; la reconciliación de mejoras tiene alcance acotado y exige revisión.

## Caché y recursos

```sh
npm run kit:efficiency -- context --project /ruta/proyecto
npm run kit:efficiency -- context --project /ruta/proyecto --cache disk
npm run kit:efficiency -- cache-inspect --project /ruta/proyecto
npm run kit:efficiency -- cache-clear --project /ruta/proyecto
npm run kit:efficiency -- validate --project /ruta/proyecto
npm run kit:efficiency -- benchmark
```

Caché en memoria por defecto; disco optativo en `.devkit-cache`. Solo señales derivadas, sin contenido fuente ni secretos. La invalidación verifica contenido aun con fechas restauradas. Las comprobaciones de seguridad se mantienen completas. MCP ofrece resúmenes, filtros, límites y páginas; la evidencia completa se consulta bajo demanda. El presupuesto del kit no controla el contexto interno del agente. Tokens medidos, estimados y desconocidos se distinguen; no se inventan porcentajes de ahorro. [Guía detallada](docs/cli/resource-efficiency.md).

## Seguridad

Vulnerabilidades: **contacto@canedostudio.com**, de forma privada y sin detalles sensibles en Issues públicos. No se prometen plazos de respuesta ni se afirma que GitHub Private Vulnerability Reporting esté activo. No incluyas `.env`, credenciales, clientes, bases, logs, cachés o rutas personales en publicaciones. No ejecutes código de repositorios externos sin revisión. Solo tener un repositorio público no concede permiso de copiarlo. Las referencias AFPVentas/Vocero y AppFlowy/Clone Wars no se importan automáticamente. Conexiones externas deshabilitadas hasta configuración verificada. [Seguridad](SECURITY.md) · [límites técnicos](docs/security/README.md) · [licencias](THIRD-PARTY-NOTICES.md).

## Pruebas

```sh
node tools/verify-distribution.cjs
npm run test:distribution
npm run kit:validate
npm run test:universal
npm run test:efficiency
npm run test:agents
npm run test:kit
```

La suite completa usa destinos temporales propios y algunas pruebas HTTP localhost, SQLite y Python. No requiere servicios externos, repositorios, dependencias nuevas ni contenedores. Si localhost está prohibido, reporta los fallos del entorno; no los conviertas en aprobaciones. Las pruebas omitidas se separan de capacidades ejercitadas. [Resultados y método de esta distribución](docs/validation.md).

## Actualización y desinstalación

No actualices encima de un proyecto ni sobrescribas personalizaciones. Conserva la versión actual, obtén la siguiente distribución aprobada en otra carpeta, revisa manifiesto y cambios, instala sus dependencias bajo autorización y ejecuta sus validaciones. Cambia el registro MCP solo después de verificarla, conservando los demás servidores. No hay actualizador automático.

Para retirar la integración, usa el comando de eliminación MCP del cliente solo para `canedo_devkit` (en Codex: `codex mcp remove canedo_devkit`) o retira ese bloque concreto tras respaldar la configuración. Reinicia/recarga el cliente si hace falta. Retira únicamente skills que hayas instalado expresamente; no borres configuraciones completas ni proyectos. Después de comprobar que no contiene datos propios, puedes archivar la carpeta del kit. No hay desinstalador que elimine volúmenes, cachés de terceros o estado global.

## Problemas frecuentes y limitaciones

- **Falta AJV:** ejecuta la instalación documentada en la carpeta correcta cuando la autorices. Un ZIP no incluye `node_modules`.
- **MCP registrado sin herramientas:** consulta los registros del cliente, ámbito, permisos de lectura, Node y reinicio efectivo. No equivale a fallo del protocolo.
- **Error SQLite de Codex:** el cliente necesita acceso a su estado; no concluyas corrupción ni borres bases por un mensaje de acceso.
- **Presupuesto MCP insuficiente:** usa páginas y fragmentos, no omitas errores críticos ni controles.
- **Inspección incompleta:** revisa enlaces, fuentes grandes y archivos cambiantes; no fuerces la aprobación ignorando contenido arbitrario.
- **Toolchain ausente:** se informa como pendiente. Sintaxis JSON/JS/Python no equivale a tipos, builds, seguridad funcional ni pruebas de todos los stacks.
- **Publicación pendiente:** ISC está aplicada al código original con el alcance documentado; publicar sigue requiriendo autorización expresa. Instalación limpia: **PENDIENTE DE VERIFICACIÓN**. Tampoco se certifican clientes externos o instalaciones nativas en los tres sistemas.

Documentación adicional: [API y transporte](docs/integrations/agents.md), [límites de SaaS de ejemplo](docs/monetization/README.md) y [canales optativos](docs/integrations/omnichannel.md).

[Cierre documental](PREPUBLICATION-CLOSURE.md) · [Lista exacta de archivos autorizables](PUBLICATION-FILES.txt).
