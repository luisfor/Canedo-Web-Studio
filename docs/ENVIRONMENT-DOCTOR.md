# Diagnóstico del entorno — fase B

Estado: implementado como ampliación de `kit:doctor`. No es todavía un instalador, actualizador ni gestor completo de dependencias.

## Uso compatible

```bash
npm run kit:doctor -- --profile react
npm run kit:doctor -- --profile python --json
npm run kit:doctor -- --tool git --tool go --json
npm run kit:doctor -- --tool node --strict
```

Sin perfil ni herramientas se comprueban las CLIs de los 24 perfiles actuales. `--tool` es repetible, acepta herramientas conocidas del catálogo y los diagnósticos adicionales `git` y `go`, y no se combina con `--profile`. Detectar Go no añade una skill, un arquetipo ni un generador Go.

## Información obtenida

- Familia del sistema: Windows, macOS o Linux; kernel, arquitectura del proceso y arquitectura informada por el sistema.
- Versión de producto de macOS mediante `sw_vers`, cuando está disponible.
- Distribución Linux mediante lectura de `/etc/os-release`, sin ejecutar su contenido.
- Versión/build de Windows. No se deduce Windows 11 a partir del build: también existen sistemas Server.
- Versión de las CLIs seleccionadas cuando una consulta local limitada puede obtenerla.
- Gestores presentes: WinGet, Homebrew, apt/dnf y gestores de lenguajes, según plataforma.
- Presencia de variables de SDK y entornos virtuales, sin sus valores.
- Permiso de escritura aparente en la carpeta actual, consultado sin crear archivos. No garantiza que una futura operación pueda completarse.

La arquitectura informada no es una comprobación exhaustiva de emulación/Rosetta. El doctor no revela hostname, usuario, contenido de PATH, valores de variables ni salida completa de procesos.

## Estados

| Estado de una CLI | Significado |
|---|---|
| `detected` | Se obtuvo una versión mediante la comprobación local |
| `missing` | No se encontró un ejecutable utilizable en directorios absolutos del PATH |
| `unverifiable` | Hay una limitación: wrapper, alias, bootstrap de SDK o versión no reconocida |
| `incompatible` | La versión queda fuera de una regla explícita declarada |
| `unsupported` | La herramienta declara una restricción de plataforma que no se cumple |
| `error` | Permisos, timeout, exceso de salida o fallo de la comprobación |

`compatibility.status: not-assessed` significa que no hay una regla explícita evaluable. La fase C incorpora un [catálogo versionado](TOOL-CATALOG.md) con reglas iniciales para Node, Python y Go. Sigue pendiente una matriz específica por versión de framework y por proyecto. El motor puede evaluar requisitos numéricos explícitos `min`, `maxExclusive` y `majors`; no interpreta rangos SemVer arbitrarios. Una versión preliminar no se acepta silenciosamente como versión estable.

`updateStatus: not-checked` significa que no se consultaron versiones recientes ni bases de vulnerabilidades. El diagnóstico es local; detectar una versión no prueba que esté soportada, actualizada o libre de vulnerabilidades.

Los gestores con `verification: presence-only` solo fueron encontrados: no se ejecutan ni se consideran configurados. Cuando una CLI seleccionada ya se comprobó, se reutiliza ese resultado. La ausencia de gestores opcionales no provoca fallo de un perfil.

## Seguridad y límites

- Solo se admiten herramientas conocidas y argumentos de versión/ayuda permitidos.
- Los procesos se lanzan sin shell, con timeout de 4 segundos y salida limitada.
- Se ignoran entradas relativas o vacías de PATH para no ejecutar archivos del proyecto por accidente.
- Las variables de protección se aplican solo al proceso hijo: no se cambia la configuración del usuario. Go usa `GOTOOLCHAIN=local`; Corepack y rustup reciben controles para evitar descargas implícitas.
- Flutter se detecta por presencia sin inicializar su caché/SDK: queda `unverifiable` hasta una validación autorizada.
- En Windows, npm puede consultarse mediante Node y su `npm-cli.js` instalado junto al wrapper. Otros `.cmd`/`.bat` no se pasan a `cmd.exe`: se informan como no verificables.
- Los alias de Windows Store no se ejecutan. Para Python se buscan alternativas `python3`, `python` y `py -3`.
- No se solicitan privilegios ni se instalan/actualizan herramientas. Las CLIs proceden del PATH del usuario; esta fase no acredita su firma ni procedencia.
- No se prueban servidores, cuentas cloud, SDK completos, hardware, servicios de base de datos ni dependencias del proyecto.

## Salida y compatibilidad del comando

La fase C agrega `toolCatalogVersion` para identificar las reglas utilizadas. Se conservan `profiles`, `checks`, `ok`, `scope` y los campos históricos `tool`, `command`, `status`. La salida JSON declara `schemaVersion: 2` y agrega `system`, `packageManagers`, `configuration` y `permissions`, además de versiones y motivos por CLI.

Sin `--strict`, los hallazgos se informan con salida 0, como antes. Con `--strict`, una CLI requerida ausente, errónea, no verificable o incompatible hace salir con 1. Los argumentos inválidos salen con 1. `ok` solo refleja las comprobaciones seleccionadas y el reconocimiento de la familia del sistema; no certifica un entorno listo para desarrollar.

## Validación

```bash
npm run kit:validate
npm run test:kit
```

Las pruebas incluyen regresión del CLI, familias de OS, distribución Linux, rutas Windows, wrappers, Python launcher, versiones, fallos, reglas explícitas y no exposición de valores sensibles.

| Plataforma | Evidencia de esta fase |
|---|---|
| macOS ARM64 | Ejecución real del CLI y pruebas en el equipo de desarrollo |
| macOS Intel | Casos de arquitectura simulados; validación nativa pendiente |
| Windows | Casos de PATH, wrappers y launcher simulados; validación nativa pendiente |
| Linux | Casos de distribución, PATH y gestores simulados; validación nativa pendiente |

Las pruebas simuladas no acreditan compatibilidad nativa completa. La matriz de CI/instalación se desarrollará en las fases autorizadas posteriores.

## Procedencia técnica

- [Procesos y wrappers de Windows en Node.js](https://nodejs.org/api/child_process.html#spawning-bat-and-cmd-files-on-windows).
- [Información del sistema en Node.js](https://nodejs.org/api/os.html).
- [Selección de toolchain de Go](https://go.dev/doc/toolchain).

## Pendiente de otras fases

El catálogo inicial de versiones y dependencias ya está disponible en la fase C. Siguen pendientes planes de instalación, adaptadores de instalación, aceptación de cambios, actualización/reparación, registro de propiedad y exportación/restauración del entorno. Ninguno de esos efectos se ejecuta desde este doctor.
