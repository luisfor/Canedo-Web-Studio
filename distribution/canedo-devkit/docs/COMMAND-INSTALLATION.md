# Generación de comandos de instalación — fase E

## Contrato

Modo inicial: **manual**. Generar, mostrar y validar un plan no ejecuta sus pasos. El usuario revisa el plan y ejecuta los comandos por etapas, deteniéndose ante errores o condiciones incumplidas. El kit no acepta comandos arbitrarios en el JSON: reconstruye los pasos desde recetas versionadas, parámetros restringidos y un plan D válido.

El modo `assisted` es una interfaz futura, no un interruptor disponible. Su contrato exige un ejecutor nuevo, recetas validadas, rediagnóstico, precondiciones reales y autorización explícita de los efectos concretos. `install apply` y el API público de ejecución están deshabilitados; un ID no concede permisos.

## Flujo común

Primero crea un plan D, que conserva diagnóstico, selección y dependencias:

```bash
node scripts/kit.js plan --tool go --version go=1.27.3 --json > go-plan.local.json
node scripts/kit.js install commands --plan go-plan.local.json --method auto
node scripts/kit.js install commands --plan go-plan.local.json --method homebrew --json > go-commands.local.json
node scripts/kit.js install validate --file go-commands.local.json --json
```

La versión es un ejemplo y no una recomendación permanente. Si el doctor detecta una versión compatible sin cambio solicitado, el resultado es `no-changes`. Una instalación existente, incompatible o incierta no da lugar a comandos de reinstalación con gestores del sistema: primero requiere revisión. No se modifican herramientas del equipo al generar el plan.

`auto` conserva el gestor elegido en el plan D o selecciona Homebrew en macOS, winget en Windows, apt en Ubuntu/Debian y dnf en Fedora. No instala gestores ausentes, no infiere soporte de distribuciones derivadas y no cambia implícitamente una preferencia del plan original. Homebrew en Linux no está cubierto por este adaptador inicial.

Para evitar sobrescribir un archivo, utiliza un nombre nuevo o la protección de sobrescritura de tu shell. Las redirecciones `>` son operaciones del shell que ejecutas tú; el generador no crea archivos de salida por su cuenta.

## Información que muestra

Cada herramienta incluye objetivo, compatibilidad conocida o sin evaluar, método, paquete y versión de paquete, fuentes del editor/gestor, dependencias, permisos, espacio y motivos de incertidumbre, riesgos y pasos de verificación. No afirma disponibilidad de un paquete sin consultarlo.

Cada paso contiene:

- `run.executable`, `run.args` y, para comprobaciones Homebrew, una entrada de otra consulta mediante `stdinFrom`.
- `command`, renderizado para POSIX o PowerShell con los valores entrecomillados como datos.
- `requiresSuccessfulSteps`: pasos críticos que deben terminar correctamente.
- `requiresReviewedSteps`: consultas y vistas previas cuyo resultado debe revisar el usuario.
- `changesSystem`, `manualReviewRequired` y notas sobre los efectos.

Las consultas de paquetes ausentes pueden devolver salida 1. `dnf --assumeno` también puede terminar con código no cero por cancelar. No equivalen a una instalación fallida ni autorizan a saltarse la revisión. **No copies todos los pasos como un script incondicional**: la modalidad manual exige interpretar esas condiciones y revisar la transacción.

`review-ready` significa que están completos los datos necesarios para revisar los comandos; no significa paquete disponible, fuente autenticada, sistema compatible ni autorización concedida. `needs-decisions` deja pendientes como gestor ausente o versión de paquete. `blocked` retira los pasos que modifican el sistema. `no-changes` conserva herramientas reutilizables. La salida JSON mantiene `executionAllowed: false`, `approval: not-requested` y `environmentRechecked: false`.

El CLI devuelve 0 para `review-ready`/`no-changes` y 1 para planes bloqueados, decisiones pendientes o entradas inválidas. En esos casos puede mostrar consultas que ayudan a resolver lo pendiente.

## Homebrew

```bash
node scripts/kit.js install commands --plan go-plan.local.json --method homebrew
```

Las recetas contemplan fórmulas por rama para Node/Python/Java y casks para .NET SDK y Docker Desktop. Muestran inventario, información JSON y una comprobación de versión que debe pasar antes de instalar. Si Homebrew ya no ofrece el parche solicitado, no debe continuarse: el adaptador no promete fijar parches antiguos ni revisiones de la fórmula.

Los comandos emitidos desactivan autoactualización, limpieza y actualización/reinstalación automática de dependientes mediante variables del proceso, sin modificar configuración persistente. No incluyen `reinstall`, `upgrade`, `link --overwrite` ni `--force`. Aun así el gestor puede resolver dependencias y cambiar enlaces de la herramienta nueva; hay que revisar sus efectos y requisitos. Algunas fórmulas son keg-only y su verificación requiere ruta explícita; configurar PATH queda fuera de esta fase.

Terraform mediante `hashicorp/tap/terraform` requiere revisar por separado el tap oficial. No se genera ni ejecuta automáticamente `brew tap`. [Referencia Homebrew](https://docs.brew.sh/Manpage).

## winget

```powershell
node scripts/kit.js install commands --plan node-plan.local.json --method winget
```

Usa ID exacto, fuente winget, versión y arquitectura, con `--no-upgrade`. Antes de instalar muestra `winget show ... --versions`; una versión concreta puede no estar disponible bajo ese ID. La versión del paquete puede tener un sufijo propio: se puede indicar `--package-version herramienta=VERSION`. Nunca se desactiva la validación de hashes ni se aceptan acuerdos de paquete/fuente automáticamente. Los permisos dependen del instalador; no se afirma alcance de usuario si el paquete no lo soporta. [Referencia winget](https://learn.microsoft.com/en-us/windows/package-manager/winget/install).

## apt y dnf

```bash
node scripts/kit.js install commands --plan python-plan.local.json --method apt
node scripts/kit.js install commands --plan python-plan.local.json --method apt --package-version python=3.13.18-1
node scripts/kit.js install commands --plan python-plan.local.json --method dnf --package-version python=3.13.18-1
```

Son ejemplos de sintaxis, **no pruebas de que esas versiones estén en Ubuntu, Debian o Fedora**. Genera el plan con el diagnóstico de la máquina correspondiente. La versión del lenguaje y la versión del paquete no son equivalentes. Los paquetes pueden incorporar epoch, revisión de distribución y sufijos; las recetas no inventan esos valores.

Se muestran consultas de versiones/inventario y vistas previas. Sin versión de paquete explícita no se ofrecen pasos de instalación. Se rechazan pines cuyo número no corresponde al objetivo, pero esta comprobación sintáctica no acredita el contenido del paquete; revisar origen y versión sigue siendo obligatorio. Un metapaquete como `golang-go` puede no tener una versión numérica correspondiente al runtime: en ese caso el adaptador no debe forzar la instalación y se utiliza otra receta/fuente.

apt incluye `--no-remove` y `--no-upgrade`, sin `-y`. dnf no emite `--allowerasing`, `--nogpgcheck` o `-y`, y desactiva dependencias débiles. Las dependencias transitivas y la posible activación de servicios por los paquetes requieren revisión específica del usuario. No se generan eliminaciones de paquetes conflictivos.

Terraform, Docker y .NET requieren revisión del repositorio del editor. Si ya lo configuraste y verificaste por tu cuenta, `--repository-ready` registra esa declaración y permite mostrar comandos; **no comprueba el repositorio ni sus firmas**. Consulta las fuentes enlazadas en cada herramienta. No se añade un repositorio, importa una clave ni modifica apt/dnf desde el kit.

## Archivos oficiales conservados

Go, Node/npm y Terraform mantienen el flujo de preparación de metadatos. No descarga SDK, no crea destino y sí consulta fuentes oficiales y diagnósticos locales:

```bash
node scripts/kit.js install prepare --plan go-plan.local.json --destination /ruta/real/nueva-carpeta --json > go-artifact.local.json
node scripts/kit.js install commands --file go-artifact.local.json --json > go-official-commands.local.json
```

El snapshot debe estar vigente —caduca en una hora— y corresponder al catálogo y al plan actuales. Los comandos emitidos incluyen creación exclusiva del destino, descarga HTTPS, comprobación exacta de tamaño/SHA-256 con Node ya disponible en el kit, listado del archivo para revisión manual, extracción y consulta de versiones. El Node usado para estas comprobaciones debe ser una instalación de confianza. Go/Node extraen su raíz de publicación; Terraform usa una subcarpeta nueva. No se configura PATH, no se borra contenido ni se registra automáticamente un recibo por operaciones ejecutadas fuera del kit.

Antes de extraer, revisa que el índice no tenga rutas externas, traversal ni enlaces fuera de su árbol. La modalidad manual no automatiza la inspección estructural que conservan los motores internos. Si falla integridad, detente: no extraigas ni ejecutes. Los comandos se presentan por etapas con dependencias; no son un instalador transaccional ni proporcionan rollback automático.

Se usa tar en macOS y Windows; en Linux ZIP requiere `/usr/bin/unzip`. Los requisitos del extractor y curl deben comprobarse antes de ejecutar. Los hashes de la publicación se obtienen por HTTPS del editor; no se verifica una firma independiente en esta fase. Las redirecciones curl quedan limitadas a HTTPS, no a una lista de hosts durante la ejecución manual; el hash aprobado debe coincidir antes de extraer.

Los snapshots antiguos siguen siendo validables, pero `install apply` siempre se rechaza. Los módulos internos y sus pruebas permanecen para conservar el trabajo previo y diseñar una modalidad asistida futura; no forman una interfaz pública de ejecución habilitada.

## Docker en la fase E

Las recetas de instalación distinguen Docker Desktop en macOS/Windows y paquetes del repositorio oficial en Ubuntu/Debian/Fedora. La versión Desktop es diferente de las versiones CLI/Engine: en winget/Homebrew se requiere `--package-version docker=VERSION_DESKTOP` además del objetivo de CLI. No se equiparan esos números.

En Linux se declaran `docker-ce-cli`, `containerd.io`, `docker-compose-plugin` y `docker-buildx-plugin`. Las versiones de los plugins y las dependencias se resuelven en la transacción del gestor: no se afirma que estén fijadas ni que el entorno completo sea reproducible. Antes de ejecutar revisa conflictos, origen, firma, privilegios y si la instalación iniciará servicios. No se elimina `docker.io`, Podman u otros paquetes automáticamente.

Los pasos de verificación propuestos son independientes:

| Componente | Comando a revisar/ejecutar manualmente | Qué demuestra |
|---|---|---|
| Contexto | `docker context show` | Nombre del contexto seleccionado; revisar si apunta a un motor remoto |
| CLI | `docker --version` | Cliente disponible |
| Engine | `docker version --format '{{.Server.Version}}'` | Servidor accesible en ese contexto; no demuestra que se pueda ejecutar cualquier contenedor |
| Compose | `docker compose version` | Plugin disponible |
| Buildx | `docker buildx version` | Plugin disponible; no acredita un builder funcional |
| Desktop | Inventario de cask o paquete Desktop | Aplicación instalada; no acredita que esté iniciada |

No se ejecutan estas verificaciones desde el generador. No se usan `docker run`, `pull`, `prune`, `down`, eliminación de volúmenes, activación del daemon ni cambios de grupo de usuario. El módulo de diagnóstico operativo, las plantillas Dockerfile/Compose y los comandos de servicios están disponibles en [F–I](WORKSPACE-OPERATIONS.md). Esta receta de instalación sigue mostrando comandos sin ejecutarlos. [Instalación oficial Docker](https://docs.docker.com/engine/install/).

## Validación, privacidad y extensibilidad

[Recetas](../catalog/install-recipes/manifest.json) y [esquema de recetas](../schemas/install-recipes.schema.json) están separados del catálogo de 80 herramientas. El generador no ejecuta los comandos ni consulta gestores/red. La validación comprueba esquema y reconstruye el resultado con las recetas actuales, comparando la huella del contenido; modificar el JSON y recalcular su hash no permite insertar comandos diferentes. La huella no es una firma ni prueba la autenticidad de un diagnóstico proporcionado por terceros.

No se copian contraseñas o valores de entorno al plan. Los snapshots oficiales sí contienen un destino local. Usa `*.local.json`, ya ignorado por Git, y revisa los archivos antes de compartirlos. La salida humana muestra comandos; `--json` conserva el contrato estructurado. Las entradas JSON se limitan a 1 MiB y los errores no muestran su contenido.

Añadir herramientas requiere receta revisada, fuentes, pruebas, actualización de cobertura y validación. No basta con añadir un comando arbitrario al JSON: los adaptadores y las estructuras de pasos son código del kit. La configuración de versiones y dependencias por proyecto está disponible en [F–I](WORKSPACE-OPERATIONS.md), sin ejecutar gestores ni instalar frameworks automáticamente.
