# Instalación

## Opción 1: descargar el kit completo

Descarga el ZIP desde GitHub (Code → Download ZIP), descomprímelo y abre la
carpeta en tu asistente de programación compatible con skills.

También puedes clonarlo:

```bash
git clone https://github.com/luisfor/Canedo-Web-Studio.git
cd Canedo-Web-Studio
npm ci
```

Necesitas Node.js y npm para los scripts del proyecto. Las instrucciones de
Codex están en `.agents/skills/` y las de Claude Code en `.claude/skills/`.
Usa tu propia cuenta del asistente. Configura únicamente las integraciones
que necesites: las claves de proveedores de imágenes, chatbots y automatismos
son independientes de la cuenta del asistente.

Copia `.env.example` a `.env` si vas a usar las integraciones indicadas allí
y rellena tus propias claves. Nunca publiques ese archivo. No pongas claves
privadas de proveedores en HTML o JavaScript que llegue al navegador.

Las configuraciones de los bots contienen marcadores `YOUR_…`: crea tus propios
recursos y sustituye los marcadores antes de desplegar. Consulta el README de
cada bot. El kit no incluye cuentas, credenciales ni bases de datos del autor.

## Opción 2: instalar solamente la skill REA

Con Node.js 22.20 o posterior y npm, desde la carpeta de tu proyecto:

```bash
npx skills add https://github.com/luisfor/Canedo-Web-Studio --skill reverse-engineer-anything
```

Revisa las opciones que muestre el instalador para seleccionar tu asistente
y el alcance de instalación. La skill original procede de
[morluto/rea](https://github.com/morluto/rea) y conserva su licencia MIT.
Las otras skills del kit no se instalan con este comando.

## Instalar las skills ampliadas en otro proyecto

Desde la carpeta de destino, usa el [instalador de skills](https://github.com/vercel-labs/skills) con Node.js 22.20 o posterior. La selección interactiva permite elegir skills y agente:

```bash
npx skills add https://github.com/luisfor/Canedo-Web-Studio
```

Para instalar una skill concreta en Claude Code:

```bash
npx skills add https://github.com/luisfor/Canedo-Web-Studio --skill desarrollo-frontend -a claude-code
```

Para Codex:

```bash
npx skills add https://github.com/luisfor/Canedo-Web-Studio --skill bases-datos -a codex
```

Consulta los nombres en [CAPACIDADES.md](docs/CAPACIDADES.md). Selecciona solo las skills que necesites. El índice Clone Wars y la aplicación AppFlowy no se instalan mediante esos comandos; se usan como fuentes en las skills referencias-producto y workspace-colaborativo.

Dentro de este kit también puedes consultar y detectar requisitos:

```bash
npm run kit:catalog
npm run kit:doctor -- --profile react
npm run kit:doctor -- --profile postgresql
npm run kit:validate
npm run test:kit
```

Los lenguajes y plataformas se implementan con sus herramientas oficiales. Cada skill enlaza documentación; el kit no descarga todos los compiladores, SDKs ni motores de datos. Para AppFlowy sigue su [instalación oficial](https://github.com/AppFlowy-IO/AppFlowy#user-installation) únicamente si vas a usar esa aplicación.

## Opción 3: REA con herramientas de análisis

Instalar la skill solo agrega instrucciones. Para conectar el servidor MCP
y las instrucciones compatibles con la versión publicada de REA:

```bash
npx rea-agents@latest setup
```

Selecciona tu asistente, revisa los cambios propuestos y reinícialo cuando
el instalador lo indique. Consulta los requisitos actuales y los motores
opcionales en la [guía oficial de REA](https://github.com/morluto/rea/blob/main/docs/installation.md).
Este comando configura REA; no instala todo el Kit Agencia Web.

## Diagnóstico del entorno (fase B)

```bash
npm run kit:doctor -- --profile react --json
npm run kit:doctor -- --tool git --tool go
```

Muestra plataforma, arquitectura, versiones y gestores presentes. No instala ni reconfigura herramientas. Las propuestas revisables están disponibles en la fase D; su ejecución y la reproducción del entorno siguen pendientes. Consulta [ENVIRONMENT-DOCTOR.md](docs/ENVIRONMENT-DOCTOR.md) y [CHANGELOG.md](CHANGELOG.md).

## Catálogo de herramientas (fase C)

```bash
npm run kit:tools -- list
npm run kit:tools -- show go --json
npm run kit:tools -- dependencies govulncheck --json
npm run kit:tools -- validate
```

Son consultas locales de metadatos: no instalan paquetes ni ejecutan herramientas. El catálogo distingue las entradas documentadas de las que tienen diagnóstico. Las reglas declaradas se aplican en `kit:doctor`; consulta [TOOL-CATALOG.md](docs/TOOL-CATALOG.md) para el alcance y la revisión de versiones.

## Archivos privados y actualizaciones

`.env`, `secretos/`, `cazas/`, dependencias y configuraciones locales están
excluidos mediante `.gitignore`. Revisa siempre los cambios antes de subirlos:
Git no elimina automáticamente información que ya esté versionada ni borra
su historial. Las configuraciones originales de esta máquina se conservan
solo en `secretos/config-original-privada/` cuando existe esa carpeta.

## Planificador revisable (fase D)

```bash
npm run kit:plan -- --tool go --json
npm run kit:plan -- --profile react --strict
```

Resuelve dependencias y registra decisiones, sin instalar ni modificar el equipo. Consulta [INSTALLATION-PLANNER.md](docs/INSTALLATION-PLANNER.md) para guardar y validar propuestas. La validación no concede aprobación ni vuelve a diagnosticar el equipo. La fase E genera comandos manuales mediante adaptadores; consulta el alcance siguiente.

## Comandos de herramientas — fase E manual

```bash
npm run kit:install -- modes --json
npm run kit:install -- coverage
node scripts/kit.js install commands --plan go-plan.local.json --method homebrew
node scripts/kit.js install commands --plan python-plan.local.json --method apt --package-version python=3.13.18-1
```

Los archivos y versiones son ejemplos: primero crea el plan D con el diagnóstico del equipo correspondiente y consulta la versión real del paquete. El kit muestra los comandos sin ejecutarlos. Hay adaptadores Homebrew (macOS), winget (Windows), apt (Ubuntu/Debian), dnf (Fedora) y snapshots oficiales Go/Node/Terraform. No se modifica PATH, se añade un repositorio ni se inicia Docker desde el generador.

`install apply` está deshabilitado incluso con `--approve`. `install prepare` conserva su utilidad de consulta de metadatos oficiales; `install validate` también valida los nuevos planes de comandos. Consulta [COMMAND-INSTALLATION.md](docs/COMMAND-INSTALLATION.md) para precondiciones, versiones de paquete, permisos y riesgos. El flujo de entornos y Docker F–I se documenta a continuación; se mantiene el modo manual.

## Versiones, perfiles y Docker (F–I)

```bash
npm run kit:docker -- doctor --json
npm run kit:project -- plan --stack node --version 24.22.2 --manager-version 11.19.1 --json > project-plan.local.json
npm run kit:project -- create --file project-plan.local.json --out /ruta/real/nuevo-proyecto
npm run kit:profiles -- list
npm run kit:verify -- runtime --json
```

Los destinos deben ser nuevos y su padre debe existir. Para proyectos Compose, secretos, imágenes, comandos de operación y export/restore consulta [WORKSPACE-OPERATIONS.md](docs/WORKSPACE-OPERATIONS.md). No se cambia PATH/JAVA_HOME ni se ejecutan gestores, builds o contenedores al generar archivos. `docker doctor --server` consulta solo un motor local identificado; contextos remotos requieren consentimiento explícito con `--allow-remote`.

Las configuraciones Docker son para Linux containers, también en Desktop Windows/macOS. No se afirma que estén ejecutadas en esta máquina: Docker no está disponible en la verificación local. La matriz CI está preparada para cuatro runners, pendiente de publicación/autorización y ejecución; no se han hecho commits, push o despliegues.
