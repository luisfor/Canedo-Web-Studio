# KIT-FIRST — descubrimiento e inspección

La interfaz estructurada de agentes exige consultar el kit, inspeccionar el destino y evaluar reutilización antes de producir un proyecto. Reutiliza los catálogos, el motor de composición y el escritor exclusivo existentes. No ejecuta scripts del destino, instala herramientas, descarga código ni activa servicios.

## Interfaz disponible

```bash
node scripts/kit.js agent discover --project /tmp/tienda-nueva --agent codex-cli-json --json > /tmp/evidencia-kit.json
node scripts/kit.js agent plan --project /tmp/tienda-nueva --file /tmp/evidencia-kit.json --request "inventario ventas caja CRM WhatsApp chatbot" --json > /tmp/plan-agente.json
node scripts/kit.js agent validate --project /tmp/tienda-nueva --file /tmp/plan-agente.json --json
node scripts/kit.js agent create --out /tmp/tienda-nueva --file /tmp/plan-agente.json --json
```

El destino debe ser nuevo y su padre debe existir. Los archivos de evidencia y plan se guardan fuera del destino. No sobrescribas planes que quieras conservar mediante redirección de shell. En Windows usa rutas absolutas propias y redirección UTF-8. También existe `npm run kit:agent -- ...` (usa `--silent` al redirigir JSON).

Inspección de un proyecto existente, sin ejecutarlo:

```bash
npm run kit:agent -- inspect --project /ruta/absoluta/proyecto --json
```

## Comprobaciones técnicas

La evidencia está validada por [esquema](../../schemas/kit-first.schema.json) y vincula versión/huella del kit, catálogos e inspección del destino. El plan y la escritura vuelven a consultar esos estados; cambios en archivos relevantes, versiones, catálogos, destino o plan impiden generar. Un proceso cuyo kit cambió en disco debe reiniciarse. Los hashes acreditan igualdad de estados, no identidad del agente, lectura humana ni firmas criptográficas.

La secuencia obligatoria en `scripts/kit-first/service.js` es descubrimiento → inspección → evaluación de reutilización → plan → validación → generación. La llamada al generador ocurre después de comprobar la evidencia. Una evidencia recalculada por el llamador no evita la comparación con el estado real. No hay un ejecutor de comandos en esta interfaz.

Los protocolos disponibles son `codex-cli-json` y `generic-cli-json`: transporte local JSON invocable desde un agente. Las pruebas ejercitan ese transporte, no acreditan un SDK nativo, instalación de clientes externos, MCP ni compatibilidad universal con todos los agentes. La política obliga las operaciones de esta API; los comandos manuales heredados se conservan y no se afirma controlar escrituras directas de un agente fuera del kit.

## Inspección y reutilización

Se detectan tres escenarios: destino nuevo, existente y presencia de registros de generación anteriores. La presencia de un registro no acredita por sí sola validez, integridad o funcionamiento; la continuidad unificada se incorpora en la etapa 2.

La inspección usa archivos de texto y manifiestos acotados. Excluye directorios de dependencias, repositorios Git, secretos, `.env*`, claves, bases de datos y archivos privados reconocibles. No devuelve contenido de archivos, scripts npm ni valores de configuración: solo rutas relativas, hashes y señales permitidas. Señales de manifiestos son `declared`, extensiones de código `observed-file` y patrones estáticos `inferred`; ninguna equivale a funcionalidad probada.

Autenticación, API, persistencia y módulos existentes se presentan como candidatos que deben preservarse y verificarse. No se generan sustitutos por preferencia tecnológica. Los destinos existentes quedan bloqueados para generación completa; el plan muestra las capacidades encontradas y faltantes. La [interfaz de continuidad](../continuity/README.md) permite registrar la memoria y preparar ampliaciones mediante un reconciliador compatible.

Los enlaces simbólicos no se siguen; una inspección incompleta bloquea generación. Límites iniciales: 5000 entradas, 1 MiB por archivo de texto, 16 MiB leídos y 900 KiB por evidencia JSON. Binarios, dependencias y datos omitidos no se inspeccionan ni se certifican. La inspección estática no demuestra seguridad, ausencia de vulnerabilidades ni ausencia de funciones que no reconoció.

La [solicitud de agente](../../schemas/agent-request.schema.json) rechaza comandos/campos arbitrarios y asignaciones reconocibles de credenciales. La interfaz inicial usa los catálogos publicados del kit; extensiones privadas y proveedores de interpretación requieren descubrimiento explícito adicional en etapas posteriores. La API manual de composición conserva sus extensiones existentes.

## Pruebas

`npm run test:kit-first` comprueba bloqueo previo al generador, versión/catálogos/destino, detección de reutilización, privacidad, cambios del destino, personalizaciones, enlaces, esquema y flujo de generación con el escritor compartido. `npm run test:kit` incorpora estas pruebas además de la regresión existente.

El código y pruebas están en [scripts/kit-first](../../scripts/kit-first/) y [kit-first.test.js](../../tests/kit/kit-first.test.js). El resultado y los pendientes de la entrega se detallan en [Validación y límites de esta distribución](../validation.md).
# Núcleo técnico independiente

Las mejoras universales 1–3 añaden descubrimiento técnico independiente: `discover({destination, technicalOnly:true})` y `requireTechnicalCurrent(evidence,destination)` en `scripts/kit-first/service.js`. El plan universal los usa sin cargar catálogos o generadores comerciales. Su huella incluye únicamente el núcleo técnico y sus reglas consumidas, no los paquetes opcionales. La carga diferida conserva las funciones anteriores de composición.

`requireTechnicalCurrent` verifica esquema, destino, huella y evidencia actual. Puede describir una inspección incompleta en un plan de solo lectura, pero no autoriza escrituras. La evidencia técnica se rechaza al pasarla al control completo `requireCurrent`; el escritor mantiene su validación y rechazo de inspección incompleta. Una huella no es firma, identidad de agente ni autorización de instalación.

Los diagnósticos explícitos quedan como instantáneas; validar no vuelve a ejecutar procesos. [Planificación y recursos](../cli/universal-planning.md) · [Validación y límites de esta distribución](../validation.md).

