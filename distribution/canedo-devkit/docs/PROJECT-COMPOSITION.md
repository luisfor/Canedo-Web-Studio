# Composición de proyectos y módulos

El motor transforma solicitudes de negocio en español en una selección verificable de capacidades y un backend inicial ejecutable. El proveedor básico es local, determinista y gratuito; no consulta servicios de IA. No clona repositorios, instala herramientas, inicia contenedores ni copia aplicaciones externas.

## Comandos

```bash
npm run kit:composition -- catalog --json
npm run kit:composition -- plan --request "inventario, ventas, caja, CRM de WhatsApp y chatbot" --docker --json
node scripts/kit.js composition plan --file examples/composition/tienda-crm.request.json --json > /tmp/tienda.plan.json
npm run kit:composition -- validate --file /tmp/tienda.plan.json
npm run kit:composition -- create --file /tmp/tienda.plan.json --out /tmp/tienda-nueva
npm run kit:composition -- check --project /tmp/tienda-nueva
npm run test:composition
npm run kit:composition -- verify --json
```

Las rutas son ejemplos POSIX: usa rutas absolutas nuevas propias en Windows. No sobrescribas un archivo de plan que quieras conservar mediante la redirección de tu shell. `--file` en `plan` recibe una solicitud, en `validate/create` recibe el plan completo. No se combina `plan --file` con opciones de solicitud. `--catalog` permite incorporar un JSON de extensión local ya revisado; no consulta una URL ni ejecuta su contenido.

`verify` es una acción de prueba explícita, distinta de la generación: ejecuta únicamente código original generado en carpetas temporales y abre HTTP en localhost. Informa el host real y las pruebas aprobadas; no transforma la falta de permisos o runtimes en resultados positivos. Se eliminan los datos sintéticos temporales al terminar. `check` solo verifica integridad de archivos; no inicia el backend ni acredita funcionamiento.

## Componentes y decisiones

| Componente | Responsabilidad |
|---|---|
| [Registro](../catalog/composition/registry.json) y [esquema](../schemas/composition-catalog.schema.json) | Capacidades, dependencias, arquetipos, proyectos y evidencia de procedencia/licencia |
| [Intenciones](../scripts/composition/intents.js) | Sinónimos en español, negaciones básicas, tecnologías y términos no reconocidos; interfaz de proveedores |
| [Planificador](../scripts/composition/planner.js) | Recorre todos los proyectos/arquetipos del registro; expande dependencias, explica selección y conflictos |
| [Motor](../scripts/composition/engine.js) | Registro de generadores confiables, planes reproducibles, validación y escritura |
| [Contratos](../scripts/composition/contracts.js) | OpenAPI 3.1, esquemas de mensajes y puertos TypeScript independientes del transporte |
| [Generador](../scripts/composition/generate.js) y [runtime](../scripts/composition/runtime/) | Código original, módulos, persistencia, migraciones, pruebas, documentación y Compose optativo |
| [Escritura compartida](../scripts/workspace/files.js) | Creación exclusiva y rechazo de rutas existentes, traversal y padres simbólicos |
| [Docker existente](../scripts/docker/generate.js) y [validador](../scripts/docker/schema.js) | Reutilización de políticas de contenedor y esquema oficial Compose, sin sustituir módulos anteriores |

La salida incluye capacidades detectadas/dependencias, todas las referencias evaluadas con coincidencias, arquetipos candidatos, conflictos, arquitectura justificada y pasos con comprobaciones. Los perfiles de herramientas existentes conservan su función de diagnóstico: no se convierten automáticamente en módulos de negocio.

Un monolito modular es la opción inicial para un proyecto pequeño nuevo con un runtime. Comercio y comunicaciones mantienen propiedad de datos separada, aunque compartan proceso. Los servicios independientes se eligen por solicitud explícita o para planificar límites entre lenguajes diferentes. La generación solo queda habilitada si existe un generador compatible; no se migran lenguajes, frameworks o motores de datos en silencio. Por ejemplo, pedir PHP/Laravel + TypeScript produce límites independientes y bloqueadores de generadores faltantes, sin sustituirlos por Node.

## Alcance funcional inicial

El adaptador incluido genera JavaScript/Node con SQLite, sin dependencias npm. La versión de proyecto se fija en `.node-version`, `.nvmrc` y `package.json`; el kit no cambia el runtime del sistema. Se usa `node:sqlite` y hay que comprobar su disponibilidad en la versión elegida. No hay generadores ejecutables para todas las tecnologías de las skills.

Capacidades seleccionables: productos, inventario, ventas, caja, compras, proveedores, CRM, WhatsApp y chatbot. Se generan contratos, configuración por módulo, endpoints, persistencia relacional, migraciones v1, interfaces, pruebas y documentación. Compose y Dockerfile se generan solo con Docker seleccionado. Las funciones no seleccionadas no exponen rutas.

El ejemplo completo demuestra:

1. Contacto CRM y producto con precio en centavos y stock.
2. Venta de un producto: stock, venta, caja, movimiento y outbox se confirman en una transacción SQLite.
3. Idempotencia por organización, dominio y clave; una carga distinta con la misma clave devuelve 409.
4. Entrega al menos una vez a CRM mediante interfaz interna o HTTP autenticado; inbox deduplica eventos y registra actividad.
5. Reintentos acotados y registros agotados conservados para reconciliación. Una venta aprobada no acredita entrega a CRM.
6. WhatsApp y chatbot deshabilitados por defecto. Adaptadores de prueba explícitos comprueban la integración sin contactar proveedores reales.

Las compras reciben stock y validan proveedor. El inventario inicial permite entradas positivas; la venta descuenta existencias. Caja es un libro de ingresos de ventas, sin apertura/cierre contable. No incluye impuestos, devoluciones, multi-moneda, gateway de pagos, UI, roles administrativos completos ni certificación de producción. SQLite está orientado a un host y tiene un escritor; no se comparte el archivo entre servicios ni se presenta como alta disponibilidad.

## Seguridad y contratos

Cada solicitud pública requiere un token distinto por organización y `X-Tenant-Id`; escrituras requieren `Idempotency-Key`. No se generan secretos. El endpoint de eventos usa un token de servicio diferente, valida el contrato y admite solo organizaciones configuradas. El servidor local se vincula a loopback por defecto, limita cuerpos/tiempos y evita devolver errores SQL o credenciales. Tokens de arranque no equivalen a un producto completo de identidad/autorización.

La validación OpenAPI comprueba el subconjunto generado, referencias locales, IDs de operación y compila todos los esquemas de cuerpos/respuestas con AJV. No se afirma que el esquema local sea el validador oficial completo de OpenAPI ni que valide cualquier documento externo. El runtime aplica el mismo subconjunto de restricciones a entradas y respuestas. Compose usa el esquema oficial vendorizado existente; esta revisión no prueba build, imágenes ni motor.

Los puertos WhatsApp/chatbot no tienen SDKs ni credenciales incorporados. La inyección programática de un adaptador confiable exige `allowExternalAdapters: true` y `enabled: true` en el adaptador. WhatsApp solo encola tras consentimiento; el envío se solicita explícitamente mediante `dispatchWhatsApp()`. Chatbot exige consentimiento y reserva un recibo durable antes de llamar al proveedor; un resultado pendiente/fallido necesita reconciliación para evitar reintentos pagos automáticos. Deben implementarse/verificarse las reglas reales del proveedor (firmas de webhook, ventana de entrega, límites, privacidad, timeout e idempotencia remota) antes de activarlo. Las pruebas usan adaptadores falsos, identificados como tales.

Los destinos existentes se rechazan incluso si están vacíos. El plan se reconstruye y compara antes de escribir; los hashes registran integridad, no firmas de autenticidad. Un fallo parcial conserva únicamente la nueva carpeta para revisión; no borra datos ni reintenta sobre ella. No se sobreescriben archivos ajenos. La comprobación específica es `composition check`; los registros nuevos no se hacen pasar por registros antiguos de `environment`.

## Extensibilidad

Una extensión JSON incorpora `capabilities`, `archetypes` y/o `projects`. Cada capacidad declara dominio, sinónimos y dependencias; cada proyecto URL/revisión, capacidades y evidencia de licencia. Se validan IDs, referencias, alias ambiguos y ciclos. No admite comandos ni código. Para un proyecto adicional usa los campos del registro, indicando honestamente el estado de revisión; el motor consulta todos los registros y muestra coincidencias, aunque no seleccione ese proyecto.

Los generadores son módulos locales revisados y se registran mediante `engine.registerAdapter(id, adapter)` con `files(design)` y listas explícitas `capabilities`, `domains`, `languages`, `frameworks`, `databases`. Opcionalmente `commands(design)` devuelve comandos revisables del runtime correspondiente; el motor no añade comandos Node a otros adaptadores. Un arquetipo JSON no puede adjudicar capacidades que el adaptador no declare. No se cargan plugins desde rutas o URLs incluidas en solicitudes. Los nuevos generadores necesitan contratos válidos, escritura segura, pruebas de flujo y validación del runtime correspondiente antes de anunciarse disponibles. No se fuerza un catálogo cerrado de lenguajes.

Para un proveedor de interpretación configurado, un llamador confiable usa `engine.plan(request, {provider: {id, interpret(text, catalog)}, allowProvider: true})`. La interfaz síncrona devuelve solo datos semánticos validados (`selected`, `excluded`, `languages`, `databases`, `frameworks`, `unrecognized`, `independent`, `modular`), nunca shell o código. Una integración de IA asincrónica puede obtener primero el resultado y entregarlo a esta interfaz. El plan conserva la interpretación para revisión/reconstrucción, sin repetir llamadas de pago al validarlo. El kit no incluye ni activa un proveedor remoto. Los términos no comprendidos bloquean la generación y requieren aclaración o una extensión; el parser no promete comprensión universal.

Los contratos HTTP/eventos permiten implementar un módulo en PHP/Laravel y otro en TypeScript sin migración. No se afirma que las rutas originales de AFPVentas/Vocero implementen ya estos contratos nuevos: necesitan un adaptador revisado y pruebas antes de conectarlos. La primera composición reutiliza conocimiento arquitectónico y genera implementación propia.

## Licencias y procedencia

[AFPVentas](https://github.com/Pipepena2979/AFPVentas) aporta la referencia comercial Laravel/MySQL; declara MIT en `composer.json`, sin texto principal de licencia verificado. [Vocero CRM](https://github.com/kevinrivm/vocero-crm) aporta el límite CRM/WhatsApp/agente, con MIT explícita y agente separado. Revisiones y archivos consultados están registrados en el catálogo y `PROVENANCE.json` generado. No se importó código, marcas ni datos de estos proyectos. El catálogo v1 no habilita importación de código, incluso cuando una licencia permita reutilización; una futura importación exige revisión específica de código/assets, avisos y dependencias.

Referencias técnicas: [SQLite de Node](https://nodejs.org/docs/latest-v24.x/api/sqlite.html), [OpenAPI 3.1](https://spec.openapis.org/oas/v3.1.0.html), [ejemplo reproducible](../examples/composition/README.md), [pruebas del planificador](../tests/kit/composition-planner.test.js), [pruebas de ejecución](../tests/kit/composition-runtime.test.js).
