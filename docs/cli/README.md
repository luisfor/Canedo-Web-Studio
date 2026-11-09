# Terminal inteligente

La entrada `scripts/devkit.js` prepara proyectos y mejoras desde solicitudes en español usando KIT-FIRST. El intérprete básico es local y no necesita una IA de pago. Los comandos `kit:*` anteriores conservan su significado.

```bash
node scripts/devkit.js plan "Crear un POS con inventario compras ventas y caja" --out /tmp/pos-nuevo --json
node scripts/devkit.js create "Crear un POS con CRM y chatbot" --out /tmp/pos-nuevo --json
node scripts/devkit.js inspect --project /ruta/proyecto --json
node scripts/devkit.js enhance "Agregar chatbot al proyecto actual" --project /ruta/proyecto --json
```

También: `npm run devkit -- plan "Crear inventario" --out /tmp/inventario-nuevo --json`. Las rutas son ejemplos POSIX; usa rutas propias y absolutas en Windows. Las solicitudes van entre comillas y se tratan como datos, nunca como comandos shell.

`package.json` define el binario `devkit` para una instalación futura elegida por el usuario. Esta entrega no instala, enlaza ni configura un comando global. Las formas `node scripts/devkit.js` y `npm run devkit -- ...` funcionan desde el repositorio con las dependencias ya existentes del kit.

## Planificación técnica universal

`plan` reconoce solicitudes técnicas generales sin exigir módulos comerciales y devuelve `technical-project-plan`: pasos, decisiones, tecnologías catalogadas o no catalogadas, plataformas, inspección y restricciones. Para forzar esta salida en solicitudes de ejemplos usa `plan --technical`. Es consultivo: `files` y `commands` superiores están vacíos y no autoriza `create`. `resources` puede contener configuración de entorno en memoria y comandos manuales, generados por los módulos existentes; no se ejecutan. `--diagnose` solicita consultas de versión, mientras `--report` reutiliza un reporte sin consultarlas. La ruta anterior de composición/generación se conserva para solicitudes explícitas de ejemplos. [Recursos conectados, A–H y límites](universal-planning.md).

## Comportamiento

| Acción | Efecto |
|---|---|
| `plan` | Descubre el kit, inspecciona un destino, interpreta y prepara un plan sin escribir proyectos |
| `create` | Genera únicamente un destino nuevo indicado con `--out`, después de las comprobaciones KIT-FIRST; registra memoria |
| `enhance` | Prepara un plan incremental y preserva personalizaciones; no lo aplica automáticamente |
| `inspect` | Devuelve descubrimiento e inspección del proyecto, sin ejecutar su código |

Sin `--out`, `create` devuelve una pregunta de destino y no escribe. `plan` sin destino inspecciona solo el candidato `devkit-project` del directorio actual; no lo crea. `inspect/enhance` sin `--project` se refieren al directorio actual. Un destino existente no se regenera. Un plan técnico puede inspeccionarlo sin adoptar memoria; la ruta incremental anterior sigue solicitando adopción explícita mediante `kit:memory adopt`.

La salida es JSON estructurado y revisable, también cuando se requieren aclaraciones: incluye `questions`, módulos faltantes, tecnologías, arquitectura, integraciones deshabilitadas y presupuesto. `needs-clarification` pide una respuesta del desarrollador; reformula la solicitud o usa un agente para responder. No se inventan respuestas ni hay un asistente interactivo TTY que decida por el usuario. La ruta de composición bloquea un requisito sin generador. El plan técnico puede explicar esa limitación y sus decisiones sin generar código ni anunciar soporte ejecutable.

El vocabulario versionado está en [catalog/terminal](../../catalog/terminal/vocabulary.json), validado por [su esquema](../../schemas/terminal-vocabulary.schema.json). El intérprete combina ese vocabulario con el catálogo de composición y sus dependencias, sin duplicar el motor. Nuevos sectores y términos pueden añadirse mediante datos revisados; un término no instala módulos o activa proveedores.

## Interpretación y límites

Se reconocen tipos CRM/POS/SaaS/e-commerce/ERP, sectores iniciales, módulos comerciales, canales, seguridad multiusuario/multiempresa, Docker, lenguajes/frameworks/motores, arquitectura y presupuesto simple como `100 USD al mes`. La cobertura es acotada: términos desconocidos y contradicciones devuelven preguntas. Presupuestos localizados o decisiones empresariales complejas pueden requerir aclaración. No se promete entender cualquier formulación.

Las integraciones externas quedan `disabled`. El presupuesto no acredita costos reales ni configura cuentas. La restricción de IA paga no convierte un chatbot en un proveedor gratuito: el puerto sigue deshabilitado hasta configuración autorizada.

La solicitud final SaaS/tienda/WhatsApp/Facebook/Instagram/chatbot/suscripciones se reconoce y muestra las brechas. Mientras no existan los módulos correspondientes, no se genera una aplicación que los omita silenciosamente. La generación disponible sigue el estado real del catálogo, no la mera presencia de palabras en el intérprete.

Una interfaz programática opcional acepta un proveedor autorizado de datos semánticos. Su respuesta se valida con [JSON Schema](../../schemas/terminal.schema.json) antes de planificar; no admite comandos ni código. La interpretación validada se conserva para revisar/reconstruir sin repetir llamadas al proveedor. No se incluye ni activa una conexión remota de IA; las pruebas de ese contrato usan funciones locales de prueba.

No se ejecutan instalaciones, pruebas del proyecto, migraciones, contenedores o proveedores al crear/aplicar. Un `plan` guardado puede crearse con `create --file /tmp/plan.json --out /destino/vinculado`. Para aplicar una mejora guardada, utiliza `kit:memory validate/apply` directamente sobre ese JSON y confirma `core.proposalId`; no hace falta editarlo para extraer el plan interno. No se copian proyectos externos. [Pruebas](../../tests/kit/terminal.test.js) · [Continuidad](../continuity/README.md) · [KIT-FIRST](../kit-first/README.md).
