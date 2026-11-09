# Etapa 5 — composición extensible y catálogo comercial

Se inició después de cerrar agentes con 363/363 pruebas y validación aprobada.

## Archivos

Nuevos: [generador Python](../../scripts/composition/python.js), [runtime/repositorios](../../scripts/composition/python-runtime/inventory.py), [servidor](../../scripts/composition/python-runtime/server.py), [migración](../../scripts/composition/python-runtime/migrate.py), [SQL](../../scripts/composition/python-runtime/001.sql), [pruebas generadas](../../scripts/composition/python-runtime/test_inventory.py), [pruebas de generadores](../../tests/kit/polyglot.test.js), [registro comercial](../../catalog/commercial/registry.json), [esquema](../../schemas/commercial-catalog.schema.json), [API comercial](../../scripts/commercial/catalog.js), [pruebas](../../tests/kit/commercial.test.js), [guía de composición](../composition/README.md), [guía comercial](../commercial-packages/README.md) y este informe.

Ampliados: motor/planificador/intenciones y generador Node; registro/esquema de composición; descubrimiento y su esquema; inspector/memoria; esquema de solicitud de agente; CLI principal/compartida y servicio terminal; package.json, README y capacidades. Se conservaron módulos anteriores, el catálogo de herramientas y Docker.

## Implementado

El motor deja de imponer la validación de Node a otros generadores, admite versiones por runtime y descriptores públicos de adaptadores, decisiones/instrucciones propias y validación de artefactos no HTTP. Un generador confiable de prueba produjo y ejecutó una CLI sin OpenAPI; un registro JSON no puede cargar código ni inventar capacidades del adaptador.

El segundo generador real implementa productos/inventario en Python estándar, con persistencia SQLite o JSON-file, autenticación por empresa, validación, idempotencia y transacciones/actualización local atómica. Genera estructura, contratos, migración, pruebas, documentación y Compose optativo. No requiere pip. Los proveedores comparten operaciones de dominio; JSON-file tiene límites locales explícitos y no se presenta como base distribuida.

El catálogo comercial contiene los 20 paquetes solicitados, datos extensibles y esquemas, dependencias, tecnologías, integraciones, seguridad, operación, monetización, alcance, brechas, pruebas y aceptación. Se consultan por CLI y agentes y aparecen en planes terminales. Se rechazan disponibilidades o canales verificados sin evidencia suficiente. Estado inicial: seis parciales, catorce planificados, ninguno declarado producto comercial completo.

Las referencias externas amplían autor público/evidencia, dependencias, restricciones, riesgos y compatibilidad a mapear, conservando revisión/licencia y prohibición de importación automática.

## Pruebas

- Cinco pruebas de generadores: selección Python, independencia de Node, SQLite/JSON, Compose, memoria y validación no HTTP. La aplicación generada ejecutó cuatro pruebas unittest con ambos proveedores reales, persistencia/idempotencia/aislamiento y HTTP en localhost.
- Tres pruebas comerciales: estructura/estados, rechazo de afirmaciones sin evidencia y extensiones sin modificar núcleo.
- `npm run test:kit`: **371/371 aprobadas**, sin fallos ni omisiones.
- Runtimes locales: Node 25.2.1 y Python 3.14.4 existentes. No se instalaron intérpretes o dependencias. Windows/Linux y otras versiones siguen sin verificación nativa aquí.

## Límites

Universal/extensible no significa que todos los stacks tengan generadores completos: Node conserva sus módulos iniciales; Python cubre inventario. Otros lenguajes/frameworks/motores requieren adaptadores revisados con pruebas y no se migran silenciosamente. SaaS, canales adicionales y otros paquetes pendientes no se marcan disponibles por reconocer sus requisitos. El reconciliador incremental existente continúa limitado a composiciones v1 compatibles.

No se ejecutaron Docker, imágenes, servicios externos, APIs de IA o canales reales. No hubo instalaciones, descargas de repositorios, cambios globales, commits, push, despliegues o modificaciones de proyectos ajenos.
