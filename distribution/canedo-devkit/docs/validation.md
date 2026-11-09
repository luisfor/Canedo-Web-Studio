# Validación de esta distribución

## Resultados ejecutados

- `npm run kit:validate`: válido, 11 skills, 24 perfiles, 80 herramientas catalogadas.
- `npm run test:kit`: **419/419 aprobadas**, cero fallos y cero omisiones del runner principal; 164187.44575 ms. Host macOS ARM64, Node 25.2.1. Ejecución desde copia temporal fuera del repositorio con permiso HTTP localhost y dependencias existentes reutilizadas por `NODE_PATH`. No se instalaron paquetes.
- Pruebas específicas de planificación universal/recursos/eficiencia: 37/37 aprobadas antes de la regresión completa.
- `npm run test:distribution`: **5/5 aprobadas** sobre los documentos finales: selección, enlaces, lockfile, licencias de terceros y ejemplos MCP.
- Plan `Crear una API con Python y FastAPI`: `technical-project-plan`, `ok: true`, estado `needs-decisions`, herramientas Python/FastAPI, `executionAllowed: false`; no se creó una aplicación.
- Benchmark sintético de tres archivos: evidencia equivalente, tres análisis iniciales, tres reutilizados y cero repetidos en caliente; se conservan 96 bytes de lecturas de seguridad. Evidencia completa 55369 bytes JSON y resumen 616. Cero llamadas a modelos; consumo de agentes externos desconocido. No son tokens ni ahorro monetario.

La primera regresión de selección obtuvo 416/419; se corrigieron exclusivamente en esta copia la expectativa de 11 skills, enlaces de navegación y resolución de AJV de un fixture. No se debilitaron controles del motor. Los metadatos/inventario final se verifican aparte de la regresión.

## Qué no se ha probado

No se ejecutó `npm ci`, instalación desde cero, descarga, contenedor ni cliente real Codex/Gemini/Claude. Las pruebas del protocolo son clientes locales automatizados; no certifican la integración de extremo a extremo de esas aplicaciones. No se verificaron instalaciones nativas Windows/Linux. Los fixtures de prueba sí crean ejemplos temporales propios, nunca proyectos de clientes o aplicaciones destinadas a entrega. Las omisiones internas de los ejemplos se contabilizan aparte del runner principal.

## Integridad reproducible

Antes de instalar dependencias, ejecuta `node tools/verify-distribution.cjs`. Compara archivos con SHA-256 del manifiesto. Tras instalar, el verificador excluye el directorio local node_modules y estado local reconocido; no debes distribuirlos. El manifiesto no contiene su propio hash y no es una firma de autenticidad ni aprobación de licencias. Después ejecuta `npm run test:distribution` y las suites pertinentes.

Los informes históricos del repositorio original se excluyen: no son resultados de esta selección ni configuraciones públicas de clientes.

## Cierre documental autorizado

ISC aplicada solo al código original; terceros conservados. Canal privado de seguridad: contacto@canedostudio.com, sin plazos prometidos ni GitHub Private Vulnerability Reporting comprobado. **Instalación limpia: PENDIENTE DE VERIFICACIÓN**, por decisión del propietario. Este cierre no repite las 419 regresiones porque no cambia funcionalidades del núcleo; sus resultados anteriores siguen identificados como históricos. Se verifican integridad, contenido, sintaxis y pruebas estáticas de distribución.
