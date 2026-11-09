# Herramientas — modo manual de la fase E

La modalidad pública actual **genera comandos para revisión**. No ejecuta instalaciones ni modifica configuraciones globales. El modo asistido está previsto en la arquitectura y **no está habilitado**, incluso con `--approve` o con un ID de una propuesta antigua.

```bash
npm run kit:install -- modes --json
npm run kit:install -- recipes --json
npm run kit:install -- coverage
```

Hay cinco adaptadores: Homebrew, winget, apt, dnf y archivos oficiales. El catálogo manual inicial cubre **Node, Go, Python, Git, Java, .NET, Terraform y Docker**. npm se considera incluido con Node; las otras 71 entradas del catálogo se conservan sin inventar recetas. Esta cobertura no demuestra disponibilidad de paquetes, instalación ni certificación nativa.

Consulta [COMMAND-INSTALLATION.md](COMMAND-INSTALLATION.md) para uso, condiciones y ejemplos completos y [Validación y límites de esta distribución](validation.md).

## Conservación y transición

Se conservan las 11 skills, 24 perfiles, 80 entradas, doctor, planificador y consultas anteriores. Los módulos internos de archivos Go/Node/Terraform y sus pruebas con ejecutables sintéticos permanecen en el repositorio. No se publican como ejecutores del kit en esta modalidad.

`install prepare --plan ... --destination ...` sigue preparando metadatos de archivos oficiales, sin descargar SDK ni crear el destino. `install validate --file ...` valida tanto esas propuestas antiguas como los nuevos planes manuales de esquema 3.

El uso anterior de `install apply` cambia intencionalmente por la preferencia de modo manual: **se rechaza antes de leer el archivo, consultar la red o escribir en el sistema**. El API público `scripts/installers/index.js` también rechaza ejecución. Para obtener comandos desde un snapshot oficial:

```bash
node scripts/kit.js install commands --file archivo-oficial.local.json --json
```

Los motores internos se conservan para una futura implementación autorizada del modo asistido, no como una vía de ejecución actualmente soportada. El código fuente no es un aislamiento frente a alguien que lo modifique o invoque módulos internos por su cuenta.

## Límites de esta entrega

- El diagnóstico operativo Docker está disponible con `kit:docker doctor`; sus consultas son de lectura y no inician servicios. Consulta [F–I](WORKSPACE-OPERATIONS.md).
- Las fases F–I generan Dockerfile/Compose y archivos de versiones en carpetas nuevas, y muestran comandos de operación manual. No instalan SDK ni ejecutan contenedores.
- No se calculan tamaños instalados sin evidencia: `space.bytes` queda en `null`, con el motivo. El tamaño de un archivo comprimido no es una estimación de espacio instalado.
- No se consultan gestores al generar comandos; sus fuentes, firmas, versiones y transacciones deben revisarse al ejecutarlos manualmente.
- Windows y Linux tienen pruebas simuladas y una matriz CI preparada, pendiente de ejecución nativa. El host real es macOS ARM64; no se instalaron distribuciones reales en él.

Implementación: [catálogo manual](../catalog/install-recipes/manifest.json), [generador](../scripts/commands/plan.js), [esquema](../schemas/command-plan.schema.json), [política de modos](../scripts/commands/policy.js), [renderizador](../scripts/commands/render.js), [registro conservado](../scripts/installers/index.js), [pruebas manuales](../tests/kit/manual-commands.test.js).
