# Etapa 3 — terminal inteligente

Antes de iniciar esta etapa se verificó el cierre de continuidad: 345/345 pruebas y catálogo aprobado.

Archivos nuevos: [vocabulario versionado](../../catalog/terminal/vocabulary.json), [esquema de vocabulario](../../schemas/terminal-vocabulary.schema.json), [esquema semántico](../../schemas/terminal.schema.json), [intérprete](../../scripts/terminal/interpret.js), [servicio](../../scripts/terminal/service.js), [entrada CLI](../../scripts/devkit.js), [pruebas](../../tests/kit/terminal.test.js), [guía](../cli/README.md) y este informe.

Modificados: [package.json](../../package.json), [package-lock.json](../../package-lock.json) (solo metadata del binario, sin dependencias nuevas), [descubrimiento](../../scripts/kit-first/discovery.js), [CLI compartida](../../scripts/workspace/cli.js) y [README](../../README.md).

## Incorporado

- `plan/create/enhance/inspect` mediante `node scripts/devkit.js` y `npm run devkit -- ...`. Se conserva la CLI anterior y se declara un binario para instalación futura; no se instala o enlaza globalmente.
- Interpretación en español de tipo de aplicación, sector, módulos, tecnologías, arquitectura, persistencia, canales, seguridad multiusuario/multiempresa, Docker, presupuesto sencillo y requisitos desconocidos.
- Preguntas estructuradas ante ambigüedad y requisitos contradictorios; no se inventan respuestas. Requisitos reconocidos sin módulo se muestran bloqueados, no disponibles.
- KIT-FIRST antes de planificar/generar; escritura nueva y memoria automática. Mejoras se preparan mediante el reconciliador y se aplican explícitamente mediante el ID del plan interno.
- Esquemas para toda interpretación, incluido un proveedor opcional autorizado. Validar un plan conserva la interpretación validada y no repite llamadas al proveedor. El proveedor básico es local; las pruebas opcionales usan funciones simuladas, no IA remota.
- Un plan de creación guardado puede ejecutarse desde archivo solo sobre el destino vinculado. Los planes de mejora pueden validarse/aplicarse directamente desde su JSON de terminal, sin edición manual.

## Pruebas

11 pruebas nuevas: selección POS; interpretación de la solicitud completa SaaS/tienda/canales; preguntas de sector/canales/arquitectura; presupuesto y restricciones de IA; negaciones y tecnologías no soportadas; esquemas/procedencia de proveedor; vocabulario declarativo; destinos explícitos; inspección/mejoras; inyección/campos no admitidos; creación y mejora desde planes revisados.

- `npm run test:kit`: **356/356 aprobadas**, sin fallos ni omisiones.
- `npm run kit:validate`: aprobado.
- `git diff --check`: sin errores.

Se reutilizaron los catálogos, intérprete base, motor, política KIT-FIRST, memoria y escritor; no se creó un generador paralelo ni se alteraron proyectos ajenos.

## Límites y pendientes

No hay promesa de comprensión universal ni asistente TTY: las preguntas se entregan en JSON para el desarrollador o cliente agente. El vocabulario y sectores son ampliables y acotados. Presupuestos complejos pueden requerir aclaración y no acreditan costos externos.

La solicitud final de SaaS + Facebook/Instagram + suscripciones ahora se comprende, pero todavía queda bloqueada por módulos faltantes; no genera un proyecto que los omita. La implementación de esos módulos pertenece a etapas posteriores. Canales y IA reales siguen deshabilitados. El binario global y las integraciones de cliente no se instalaron. No hubo contenedores, descargas, commits, push o despliegues.
