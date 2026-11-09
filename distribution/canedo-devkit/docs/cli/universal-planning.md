# Planificación técnica universal — mejoras 1–3

El principio es solicitud → descubrimiento/inspección → plan técnico → revisión. No exige inventario, CRM, POS u otra capacidad comercial. Se amplía la terminal existente, sin sustituir el compositor o los ejemplos y sin un segundo catálogo de herramientas.

```sh
node scripts/devkit.js plan "Crear una aplicación móvil para Android y iPhone" --json
node scripts/devkit.js plan "Crear una aplicación web con React y PostgreSQL" --json
node scripts/devkit.js plan "Crear una API con Python y FastAPI" --json
node scripts/devkit.js plan "Crear una aplicación de escritorio multiplataforma" --json
node scripts/devkit.js plan "Crear un proyecto IoT con ESP32" --json
node scripts/devkit.js plan "Crear un videojuego con Unity" --json
node scripts/devkit.js plan "Crear una plataforma SaaS empresarial" --json
node scripts/devkit.js plan "Continuar un proyecto existente sin sobrescribir personalizaciones" --project /ruta/proyecto --json
```

Usa una carpeta padre existente si proporcionas un destino nuevo mediante `--out`. Sin ruta se inspecciona el candidato `devkit-project` del directorio actual, sin crearlo. Para continuar, indica el proyecto existente: la frase por sí sola no identifica una carpeta.

## Salida

`technical-project-plan` está validado por esquema y huella canónica. Contiene:

- `requirements`: dominios/tipos, plataformas objetivo, tecnologías, exclusiones, contradicciones y términos por aclarar. Los IDs/nombres de tecnologías catalogadas proceden de `catalog/tools/manifest.json`; los alias del intérprete no agregan versiones, dependencias ni soporte.
- `evidence`: versión/huella del kit e inspección estática, mediante el servicio KIT-FIRST. El modo técnico no carga el catálogo comercial ni el compositor. No se admite esa evidencia como evidencia completa de generación.
- `observed`: señales de lenguaje/framework/base/componentes existentes; son declaraciones o inferencias, no pruebas de funcionamiento.
- `resources`: plan de herramientas/dependencias y conflictos; diagnóstico o instantánea; candidatos de perfiles/gestores; recetas; configuración de runtime y comandos manuales preparados por los módulos existentes. No duplica sus registros o reglas.
- `architecture`, `steps`, `acceptance`: preservar arquitectura existente; decisiones de diseño por tipo de software; preparación, entrega a IA y criterios de validación.
- `questions` y `limitations`: decisiones pendientes y restricciones. Unity no está catalogado; ESP32 requiere confirmar placa y toolchain. No se adivinan versiones o generadores.
- `files: []`, `commands: []`, `executionAllowed: false`, `generation.available: false`: no escribe proyectos ni ejecuta las instrucciones preparadas. `resources` puede contener archivos de configuración en memoria y comandos manuales; solo `--diagnose` solicita consultas locales de versión.

`ok: true` significa plan consultivo construido, no entorno listo. Estados: `ready-for-review` (revisable), `needs-decisions` (decisiones pendientes), `needs-inspection` (inspección incompleta). Ninguno concede permisos de escritura. Una inspección incompleta permite explicar el trabajo pendiente, pero no eludir bloqueos del escritor original. El validador compara la evidencia real del destino y todo el plan; un cambio invalida su instantánea.

El intérprete es determinista y acotado: no promete comprender cualquier frase. Los requisitos desconocidos se conservan y generan preguntas específicas, sin proponer módulos comerciales por defecto. Solicitudes explícitas de ejemplos mantienen el flujo anterior. `plan --technical` fuerza la salida consultiva para cualquier dominio, incluso un ejemplo existente. `create` y `enhance` conservan su alcance anterior; no se amplía generación/edición de aplicaciones en esta etapa.

## API interna

```js
const terminal = require('./scripts/terminal/service');
const plan = terminal.prepare('Crear una API con Python y FastAPI', {
  destination: '/ruta/absoluta/normalizada/nueva'
});
const result = terminal.validate(plan, '/ruta/absoluta/normalizada/nueva');
// Solo valida el plan consultivo; no ejecuta código del proyecto.
```

La API MCP de agentes conserva sus herramientas y contratos anteriores. Publicar/verificar este plan con clientes reales queda fuera de las mejoras 1–3. No se afirma una conexión real con Codex, Gemini o Claude.

## Recursos y diagnóstico

```sh
node scripts/devkit.js plan "Crear web React PostgreSQL" --json
node scripts/devkit.js plan "Crear API Python FastAPI" --version python=3.14.4 --manager pip --json
node scripts/devkit.js plan "Crear API Python FastAPI" --diagnose --json
node scripts/devkit.js plan "Crear API Python FastAPI" --report /ruta/doctor.json --json
```

`--version herramienta=X.Y.Z` admite varias herramientas sin duplicados; son elecciones explícitas, no versiones inventadas o certificadas como recientes. Se rechazan herramientas no seleccionadas, versiones ambiguas y gestores desconocidos. No se mezclan `--diagnose` y `--report`. Las opciones de recursos se aplican al plan técnico; en solicitudes de ejemplos se puede usar `--technical`.

React incorpora la dependencia Node declarada; FastAPI incorpora Python. PostgreSQL distingue cliente y decisión de despliegue del servidor, sin iniciarlo. Android/iOS conectan registros de SDK/Xcode ya existentes; el planificador informa las restricciones de sistema. ESP32 remite a ESP-IDF sin sustituirlo por Arduino. Los perfiles mantienen sus sugerencias como opcionales. Un SaaS sin stack elegido no recibe Node/SQLite por defecto.

Sin diagnóstico, la información del sistema procede de metadatos locales y no se supone que una CLI falte. `--diagnose` usa el doctor existente, argumentos de versión permitidos, límites de tiempo/salida y un entorno de proceso acotado. Los ejecutables provienen de PATH, no de código generado por una IA; el origen y la confianza de las CLIs instaladas requieren revisión del operador. No consulta motores Docker, cuentas o servicios externos. El resultado no acredita SDK completos, compilación, autenticación o hardware.

`--report` acepta el JSON del doctor existente (límite del lector: 1 MiB). Se comprueba el esquema, se recomputa compatibilidad con las reglas actuales y se descartan valores privados adicionales. La fuente es `provided-report`; no autentica que el diagnóstico sea verdadero o reciente. Un diagnóstico explícito usa `live-doctor`. En ambos casos, validar conserva la instantánea y muestra `environmentRechecked: false`: no repite procesos o instala nada. Volver a usar `--diagnose` crea un plan nuevo.

Con una versión de runtime elegida, `resources.environmentPlans` reutiliza `workspace/profiles` o `workspace/project`. Produce archivos como `.python-version`, `pyproject.toml` o `global.json` en memoria. No instala FastAPI/React, genera lockfiles ficticios o sobrescribe archivos existentes. Un conflicto del conjunto de herramientas impide esa preparación. Los nombres/versiones de paquetes y límites entre componentes siguen siendo decisiones revisables.

`resources.manualCommands` reutiliza el generador de recetas y su validador: método, fuentes, permisos, riesgos, guardas y pasos. Se pueden mantener decisiones por falta de versión de paquete, gestor o repositorio. Tener receta no significa paquete publicado/disponible. El mecanismo oficial conserva el requisito de snapshot validado del flujo anterior; no se descarga por este plan. No hay ejecutor asistido habilitado.

La API acepta `resourceOptions: {versions, manager, report}` y `diagnose: true` como autorización explícita de consultas de versión. Los datos de diagnóstico en planes guardados son instantáneas, no firmas de terceros. La validación reconstruye los planes con reglas y evidencia vigentes, sin convertirlos en autorizaciones.

## KIT-FIRST y límites

El descubrimiento técnico usa una lista explícita de código/esquemas/catálogos del núcleo; no lee paquetes comerciales ni sus generadores para construir la huella. La carga de esas funciones queda diferida a sus rutas anteriores. Una prueba en un proceso nuevo bloquea sus imports y catálogos y comprueba que el plan técnico sigue funcionando. La huella completa de generación permanece separada; la evidencia técnica no puede utilizarse para degradar ese control.

No se cambió el reconocimiento de dominios de la etapa 1, el inspector, la reconciliación de proyectos o la integración con clientes. Las mejoras 4–8 continúan pendientes. Fuentes oficiales y políticas siguen en el catálogo existente; no se certifica una versión, SDK o plataforma por reconocer su nombre.

Pruebas: `npm run test:universal`. Conservan A–H y añaden dependencias, perfiles, versiones, reportes, restricciones de OS, independencia en proceso nuevo y bloqueos. Son pruebas de planificación con fixtures mínimos; no desarrollan aplicaciones comerciales. [Validación y límites de esta distribución](../validation.md).
