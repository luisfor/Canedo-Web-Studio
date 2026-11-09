# Universalización — etapa 1: interpretación y planificación

## Alcance implementado

Se amplía la terminal existente con planificación técnica consultiva para web/frontend, backend/APIs, móvil, escritorio, videojuegos, IoT/embebidos, automatización, IA, datos, DevOps, empresa y proyectos personalizados. A–H producen pasos de diseño, decisiones, restricciones y criterios, sin exigir módulos comerciales ni generar aplicaciones.

Las tecnologías conocidas se reconocen por IDs/nombres del catálogo existente y alias lingüísticos. Unity conserva estado no catalogado; ESP32 no se presenta como hardware probado. No se instala ni adivina un stack. Las solicitudes explícitas de ejemplos conservan sus rutas; `plan --technical` fuerza planificación consultiva. No se reconstruye el proyecto.

## Archivos

Nuevos: `scripts/terminal/technical.js`, `schemas/technical-plan.schema.json`, `tests/kit/universal-planning.test.js`, `docs/cli/universal-planning.md` y este informe.

Modificados: `scripts/terminal/interpret.js`, `scripts/terminal/service.js`, `scripts/devkit.js`, `scripts/kit-first/discovery.js`, `scripts/kit-first/service.js`, `package.json`, `README.md`, `docs/CAPACIDADES.md`, `docs/cli/README.md`.

El cambio en descubrimiento es acotado al modo técnico: mantiene esquema y controles existentes, omite carga de paquetes/compositor y no entrega evidencia utilizable para el escritor completo. No se cambia MCP ni su integración con clientes.

## Pruebas

`node --test tests/kit/universal-planning.test.js`: 13 pruebas iniciales aprobadas, cero fallos/omisiones. A–H son casos separados con aserciones de reconocimiento/plan y ausencia de generación. Otros casos comprueban dominios adicionales, datos desconocidos/contradicciones, independencia del catálogo comercial, evidencia/destino/plan alterados, escritor bloqueado, inspección incompleta y CLI.

Resultados de cierre:

- `npm run test:kit`: **395/395 aprobadas**, cero fallos, cancelaciones u omisiones. Las regresiones anteriores usan sus fixtures temporales existentes; no se desarrolló una nueva aplicación comercial.
- `npm run kit:validate`: aprobado (14 skills, 24 perfiles; catálogos conservados).
- `git diff --check`: aprobado.
- Comprobación adicional A–H mediante la API de terminal: ocho planes consultivos válidos, cero archivos/comandos generados. A/D/E/F/G: `needs-decisions`; B/C: `ready-for-review`; H sobre la raíz real: `needs-inspection` por los bundles grandes ya detectados. En el fixture mínimo existente de H se verifica preservación de personalizaciones.
- Verificación local: macOS ARM64 y Node 25.2.1 existente. No se afirma compatibilidad con la política LTS del kit (el doctor marca ese Node fuera de rango), ni ejecución nativa Windows/Linux, SDK móvil, Unity o ESP32.

La ejecución de pruebas valida planificación y regresiones, no conexión de clientes IA o tecnologías externas. Los conteos históricos de otras entregas se conservan como históricos.

## Pendientes y límites

Etapa 2: conexión automática a diagnósticos, versiones, dependencias, gestores/perfiles, arquitecturas detalladas y generadores. Etapa 3: exponer el plan universal mediante interfaces de agentes/MCP y verificar clientes por separado. Etapa 4: ejecutar/registrar validación y continuidad general con autorizaciones. Etapas 5–6: ampliar aceptación/métricas y documentación global según esas capacidades.

`ok` significa plan consultivo existente, no compatibilidad instalada. No hay soporte universal de compilación o generación por reconocer un nombre. El inspector conserva sus límites, incluidos bundles grandes del proyecto actual; el plan los informa sin ignorarlos ni permitir cambios. El flujo anterior de composición sigue siendo específico de los ejemplos.

No se instalaron herramientas o dependencias, descargaron repositorios, ejecutaron contenedores, realizaron commits/push/despliegues o modificaron otros proyectos. Esta etapa termina aquí y requiere aprobación antes de continuar a la etapa 2.
