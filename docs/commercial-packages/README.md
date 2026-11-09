# Catálogo comercial

El [registro versionado](../../catalog/commercial/registry.json) contiene las veinte soluciones solicitadas, con ID, sector, funciones, módulos/dependencias, tecnologías, integraciones, seguridad, operación, monetización, estado, pruebas y aceptación. Se valida mediante [JSON Schema](../../schemas/commercial-catalog.schema.json) y comprobaciones de código/pruebas existentes.

```bash
npm run kit:packages -- list --json
npm run kit:packages -- show --name inventory --json
npm run kit:packages -- validate --json
```

Una extensión usa el mismo esquema y se incorpora con `--catalog /ruta/extension.json` en list/show; no necesita modificar el núcleo. Un registro no ejecuta código, instala módulos o activa servicios. Los agentes reciben también el catálogo mediante descubrimiento KIT-FIRST; la terminal muestra paquetes coincidentes y brechas.

| Estado | Significado |
|---|---|
| `available` | Requiere generador compatible con todos los módulos, pruebas y evidencia de aceptación vigente |
| `partial` | Hay un alcance implementado y probado, con brechas explícitas del paquete |
| `experimental` | Código o integración en evaluación; no certifica operación comercial |
| `planned` | Registro de solución objetivo; no se presenta como producto funcional |
| `unsupported` | Fuera del soporte actual |

Actualmente ningún paquete se declara producto comercial completo: catorce son parciales y seis planificados. Productos/inventario, venta/caja, compras/proveedores y CRM básico son módulos funcionales; eso no incluye automáticamente almacenes, contabilidad, frontend, identidad completa, fiscalidad o conexiones reales. WhatsApp/chatbot actuales son puertos deshabilitados y probados con adaptadores de prueba. Las restantes integraciones permanecen previstas.

Los estados `available` y canales `verified` exigen evidencia de aceptación vinculada a un plan vigente, sus criterios, pruebas sin fallos/omisiones y, para canales, verificación real declarada explícitamente. El validador rechaza disponibilidad basada solo en una etiqueta o archivo README. Los informes locales son evidencia verificable de estado, no firmas de un tercero ni certificaciones regulatorias. Ninguna etiqueta del catálogo activa credenciales o sustituye los controles privados del proveedor.

La monetización describe opciones de producto —suscripciones, implementación y soporte—, no cobros activos ni ingresos garantizados. Las funciones SaaS/medición y los proveedores de pago se implementan/verifican por etapas. Consulta `implementedScope`, `gaps` y `generatorSupport` antes de elegir una solución.

Las referencias AFPVentas/Vocero conservan URL, revisión, autor público/evidencia, dependencias declaradas, restricciones, riesgos y necesidad de mapear APIs/eventos. Se mantienen como referencias arquitectónicas, sin importar código. El catálogo es ampliable y no se limita a esos dos repositorios.

Las combinaciones A–I se consultan con `npm run kit:packages -- combinations --json`; `combination --name H --docker --json` devuelve el plan completo revisable. Ready significa generación local, no canales o cobros verificados. [Alcances SaaS/combinaciones](../monetization/README.md).
