# Entornos, Docker y operación manual — fases F–I

## F: diagnóstico y versiones por proyecto

```bash
npm run kit:docker -- doctor --json
npm run kit:docker -- doctor --server --json
```

CLI, servidor Engine, presencia de Desktop, Compose y Buildx tienen estados independientes. Por defecto no se consulta el servidor. `--server` solo lo consulta si el contexto resuelve a socket local o localhost; un contexto remoto necesita además `--allow-remote`. No se inicia Desktop, daemon, builder ni contenedores. Servidor accesible no certifica capacidad de ejecutar imágenes. No se exportan nombres de contexto, endpoints, rutas, valores de entorno o stderr sin filtrar. Compose/Buildx se consultan solo por versión.

```bash
npm run kit:project -- plan --stack node --version 24.22.2 --manager-version 11.19.1 --dependency express=5.1.0 --json > project-plan.local.json
npm run kit:project -- validate --file project-plan.local.json
npm run kit:project -- create --file project-plan.local.json --out /ruta/real/nuevo-proyecto
```

Versiones de ejemplo, no recomendaciones permanentes. Los stacks iniciales son node, python, go, java, dotnet y rust. El plan incluye archivos nativos de versiones/dependencias y comandos manuales. No ejecuta gestores ni cambia PATH/JAVA_HOME. El destino debe ser nuevo, con padre existente y sin enlaces simbólicos. No se sobreescribe una carpeta vacía ni se borra la carpeta si una escritura queda incompleta.

Node genera package.json, .node-version y .nvmrc; Python .python-version, pyproject.toml y requirements.txt; Go .go-version y go.mod; Java .java-version y pom.xml; .NET global.json sin roll-forward y proyecto SDK; Rust rust-toolchain.toml y Cargo.toml. Los gestores externos deben respetar esos archivos; el kit no instala ni activa toolchains. No se inventan lockfiles: deben generarse, revisarse y conservarse antes de afirmar reproducción exacta. Go requiere ejecutar con GOTOOLCHAIN=local si se desea impedir descarga automática de toolchains; Rustup puede descargar el toolchain al invocarlo manualmente.

Las dependencias solo se añaden si se indican con versión exacta. Java usa coordenadas grupo:artefacto. El plan es una configuración inicial, no una aplicación completa ni garantía de compatibilidad. Windows usa PowerShell; para venv sustituye .venv/bin/python por .venv/Scripts/python.exe.

Los registros devkit.project.json contienen configuración y hashes de archivos generados, no credenciales ni variables de entorno. No incorporan tu código posterior ni sustituyen un repositorio o backup.

## G: perfiles y Docker/Compose

```bash
npm run kit:profiles -- list
npm run kit:profiles -- plan --profile backend --stack go --version 1.27.3 --json > profile.local.json
npm run kit:profiles -- create --file profile.local.json --out /ruta/real/nuevo-backend
npm run kit:docker -- plan --name demo --service postgres --image postgres=postgres:17.6 --backend node --version 24.22.2 --image runtime=node:24.22.2-alpine --publish backend=18080 --json > compose-plan.local.json
npm run kit:docker -- validate --file compose-plan.local.json
npm run kit:docker -- create --file compose-plan.local.json --out /ruta/real/nuevo-compose
```

Los perfiles minimal, frontend, backend, full-stack, mobile, cloud, iot, ai, enterprise y fintech ofrecen sugerencias, sin añadir frameworks/SDK automáticamente. No sustituyen los 24 perfiles de diagnóstico existentes. Mobile/IoT cubren la configuración de versiones del stack elegido; no generan una app móvil, firmware o SDK por seleccionar perfil.

Servicios de datos: postgres, mariadb, mysql, mongo y redis. Se requieren imágenes explícitas de las familias oficiales correspondientes, con etiqueta numérica que incluya al menos major.minor o digest. PostgreSQL necesita también etiqueta para determinar el directorio de datos: hasta 17 usa /var/lib/postgresql/data y desde 18 /var/lib/postgresql. No se verifica disponibilidad, firma o compatibilidad de imágenes al generar archivos; fijar solo un tag no los hace inmutables. Los ejemplos no son recomendaciones de versiones.

Cada servicio declara volúmenes, red interna, healthcheck, límites de CPU/memoria/PID y logs acotados. No se publican puertos por defecto; --publish servicio=PUERTO enlaza solo 127.0.0.1 y rechaza puertos privilegiados/duplicados. No hay privileged, host networking o socket Docker montado. Las bases conservan los permisos que su imagen necesita para inicializar datos; no se fuerza un usuario incompatible. Las plantillas son para contenedores Linux: Windows necesita Docker Desktop configurado para Linux containers.

Los secretos se referencian en ./secrets/, pero NO se crean sus valores. Lee secrets/README.md antes de validar/arrancar. MySQL/MariaDB tienen secreto de aplicación y de root separados; Mongo inicializa un administrador y no un usuario de mínimo privilegio de la aplicación. Redis usa un ACL externo: default solo permite PING de healthcheck, y app requiere hash y permisos revisados. No uses los placeholders como secretos reales. Compose local monta archivos, no proporciona un almacén cifrado.

Backends: node, python, go, java y dotnet. Requieren --version y --image runtime=...; Go/Java/.NET requieren además --image builder=.... Se genera Dockerfile y código de /health, sin autenticación, CRUD ni integración automática con las bases. La imagen de aplicación se etiqueta localmente con nombre del proyecto y no reemplaza una base. El backend ejecuta con UID/GID 10001, filesystem de solo lectura, tmpfs, capacidades retiradas y límites. Revisa que tus imágenes base incluyan los binarios/módulos correspondientes.

compose.yaml se serializa como JSON válido en YAML 1.2 para no introducir un parser YAML adicional. Docker Compose lo admite; no se ejecuta compose config ni se descargan imágenes al generar. El archivo devkit.compose.json registra solicitud y hashes, no secretos. Los destinos se crean exclusivamente y se preservan si ocurre una escritura parcial.

Healthchecks comprueban disponibilidad, no credenciales, migraciones, datos persistidos ni un despliegue de producción. Las imágenes y builds Go/Java/.NET no están compilados ni ejecutados en el host sin Docker/SDK correspondiente.

## H: operación, exportación y reproducción

```bash
npm run kit:project -- check --project /ruta/real/proyecto
npm run kit:environment -- export --project /ruta/real/proyecto --json > environment.local.json
npm run kit:environment -- validate --file environment.local.json
npm run kit:environment -- restore --file environment.local.json --json > restored-plan.local.json
npm run kit:environment -- compare --file environment.local.json --project /ruta/real/otro-proyecto
npm run kit:environment -- update --file environment.local.json --version 26.13.0 --json > updated-plan.local.json
```

restore solo genera el plan; para escribirlo usa project create o docker create según el tipo, con destino nuevo. No modifica el entorno original. update acepta --version/--dependency para proyectos o --image servicio=... para Compose y produce otro plan, sin aplicar cambios. No migra datos, fija automáticamente lockfiles o reconstruye código modificado.

El manifiesto exporta solicitud, versión de plantilla y hashes de archivos generados. No incluye tu código modificado, .env, contraseñas, contenido de secrets, binarios, imágenes ni datos de volúmenes. Drift indica archivos cambiados/ausentes/enlazados. No se siguen enlaces a archivos fuera del proyecto. Solo se admiten registros del kit que coincidan con las plantillas actuales; no es un importador de cualquier proyecto ajeno. Mantén un repositorio y backups aparte. Un hash no es una firma ni prueba de propiedad de datos.

```bash
npm run kit:docker -- commands --project /ruta/real/compose --context desktop-linux --action validate
npm run kit:docker -- commands --project /ruta/real/compose --context desktop-linux --action up
npm run kit:docker -- commands --project /ruta/real/compose --context desktop-linux --action stop
npm run kit:docker -- commands --project /ruta/real/compose --context desktop-linux --action status
npm run kit:docker -- commands --project /ruta/real/compose --context desktop-linux --action logs --service backend
npm run kit:environment -- repair --project /ruta/real/compose --context desktop-linux
```

Todos muestran comandos, no los ejecutan. El contexto es obligatorio y puede ser remoto: revísalo antes de ejecutar. El nombre Compose y el directorio acotan la operación, pero no acreditan propiedad de recursos ya existentes; elige nombres únicos y verifica el inventario. up usa --pull never, --no-build y --no-recreate. start inicia solo contenedores existentes; stop no elimina. pull es una acción explícita, ignora servicios construibles; build puede descargar bases/dependencias cuando tú lo ejecutes. No se publica ninguna imagen. inspect/status usan ps sin docker inspect completo; logs puede contener datos sensibles y el kit no los recoge.

repair ofrece config --quiet y estado, o versiones del stack en proyectos: no reinstala, limpia cachés ni recrea contenedores. Archivos modificados bloquean propuestas de cambio sobre Compose; primero hay que revisar y regenerar un plan. Las consultas de reparación sí se pueden mostrar con drift.

down también elimina la capa escribible de cada contenedor: datos fuera de volúmenes pueden perderse aunque no se borren volúmenes. Eliminar contenedores/redes requiere acción down, --acknowledge-removal y --confirm NOMBRE_EXACTO. Eliminar volúmenes requiere acción remove-volumes y además --approve-data-loss. Esas opciones solo permiten mostrar el comando destructivo; no habilitan ejecución. No hay prune global, eliminación de imágenes, --rmi ni --remove-orphans. No se generan borrados por defecto. Backup, restauración de datos, rotación de secretos y migraciones de versión mayor necesitan procedimientos específicos de cada aplicación; los planes no los realizan.

## I: verificación y estado real

```bash
npm run kit:validate
npm run test:kit
npm run kit:verify -- runtime --json
npm run kit:verify -- runtime --docker --json
npm run kit:verify -- runtime --docker --server --json
```

El informe identifica el host actual, las comprobaciones realizadas y las plataformas no ejecutadas. La ampliación nativa al final de esta guía actualiza las comprobaciones iniciales. Comprueba catálogos, reconstrucción de planes y sintaxis Node sin instalar nada. --docker consulta versiones/presencia; --server solicita además disponibilidad del motor local y devuelve error si no está listo. Un contexto remoto no se consulta desde verify. Que los checks de código pasen no significa que Docker esté disponible: configurationChecksPassed y el diagnóstico Docker se muestran por separado.

Esta distribución no incluye un workflow de publicación o instalación automática. La [validación local](validation.md) distingue pruebas reales y simuladas. Una matriz CI para Linux, Windows y macOS requiere preparación y aprobación posteriores; no hay resultados nativos certificados por disponer de una definición histórica.

Verificación local de esta entrega: macOS ARM64, Node 25.2.1, con las pruebas del kit. Docker CLI y Desktop ausentes: no se realizó compose config, build, up, autenticación real, migración o restauración de datos. No se instaló nada para suplir esa ausencia. Go y .NET no se compilaron. La ampliación I posterior sí compila Java y prueba Node/Python/Java con los runtimes existentes, como se detalla abajo. Windows, Linux y macOS Intel siguen pendientes de ejecutar la matriz en sus hosts; ciertas fixtures POSIX se omiten explícitamente en Windows, sin presentarlas como pruebas nativas.

Las CLIs usadas para diagnóstico deben ser de confianza: el kit limita argumentos y no busca rutas relativas, pero consultar una versión no verifica la firma de su ejecutable. El módulo Docker lee ubicaciones conocidas de Desktop: ausencia en ellas no es un escaneo completo del equipo. La configuración local de secretos necesita permisos compatibles con el UID del contenedor; no se cambia su propiedad automáticamente.

Referencias: [Compose servicios](https://docs.docker.com/reference/compose-file/services/), [secretos](https://docs.docker.com/compose/how-tos/use-secrets/), [up y recreación](https://docs.docker.com/reference/cli/docker/compose/up/), [pull](https://docs.docker.com/reference/cli/docker/compose/pull/), [matriz GitHub](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-run/run-job-variations), [runners disponibles](https://docs.github.com/en/actions/reference/runners/github-hosted-runners), [compilador Maven](https://maven.apache.org/plugins-archives/maven-compiler-plugin-3.13.0/examples/set-compiler-release.html).

Las actualizaciones y recuperación de H se aplican a planes/configuración por proyecto. No se ofrece desinstalación global de herramientas sin poder acreditar su propiedad; el modo manual no registra una ejecución que el usuario hizo fuera del kit.

## Ampliación I: pruebas nativas y esquema oficial

```bash
npm run kit:docker -- schema --file compose-plan.local.json --json
npm run kit:verify -- native --stacks node,python,java --require-all --json
npm run kit:verify -- compose --require-docker --json
```

`docker schema` recibe el JSON de un plan o un documento Compose JSON y aplica el esquema oficial vendorizado, sin red/motor. No es un parser de YAML arbitrario ni prueba ejecución, credenciales o disponibilidad de imágenes. Commit, hash, licencia y NOTICE están en schemas/vendor/compose-spec.*.

`verify native` es una acción de prueba **explícita**: usa únicamente Node/Python/Java ya existentes, genera programas de muestra en carpetas temporales y abre puertos efímeros solo en 127.0.0.1. Comprueba salud HTTP, 404 y healthcheck real; cierra procesos y elimina archivos al terminar. No ejecuta tu código de aplicación, instala toolchains, usa Docker o configura globalmente el equipo. `--require-all` devuelve error si falta un runtime; sin él los ausentes figuran como skipped, no como aprobados. Java necesita JDK 21+ existente; se revisan las ubicaciones JAVA_HOME conocidas y PATH, sin activar ni instalar un SDK.

La plantilla optativa 1.1.0 admite HOST/PORT en Node/Python/Java para estas pruebas. La original 1.0.0 permanece intacta y sigue siendo la predeterminada. Para elegir la nueva, añade `--template-version 1.1.0` al plan Docker. El servidor normal conserva los valores de contenedor 0.0.0.0:8080; el verificador fija por proceso HOST=127.0.0.1 y PORT=0. Los healthchecks reciben el puerto asignado sin modificar configuración persistente.

`verify compose` usa únicamente `docker compose version` y `config --quiet`, sobre diez configuraciones temporales con secretos sintéticos que se eliminan. No usa up/build/pull ni se conecta al motor. Si no existe la CLI/plugin, informa unavailable; con --require-docker devuelve error. El resultado de este parser sigue sin certificar imágenes, builds, contenedores, datos o credenciales.

Resultados locales actualizados: 301 pruebas y 25 controles; pruebas HTTP reales de Node/Python/Java en macOS ARM64 con sus runtimes existentes, versiones exactas registradas en [Validación y límites de esta distribución](validation.md). Las versiones de ejemplo de imagen/SDK no coinciden todas con esos runtimes; no se presenta esa diferencia como equivalencia. Docker sigue ausente. La matriz CI y sus pasos nativos necesitan publicarse/ejecutarse para aportar evidencia Windows/Linux/Intel. [Validación y límites de esta distribución](validation.md).
