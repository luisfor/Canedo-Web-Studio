# Generadores extensibles y contratos

El [motor existente](../PROJECT-COMPOSITION.md) conserva sus comandos y el generador Node/SQLite. Ahora publica sus adaptadores mediante descubrimiento, admite versiones por runtime y validadores de artefactos propios de un adaptador confiable: un generador CLI no tiene que inventar OpenAPI. Las rutas seguras, esquemas del plan, reconstrucción y escritura exclusiva siguen siendo controles comunes. Un catálogo JSON no carga ni ejecuta plugins.

Los adaptadores revisados se registran con `engine.registerAdapter`. Declaran capacidades reales, dominios, lenguajes, frameworks y persistencia; `files` genera artefactos y `commands` propone operaciones del runtime correspondiente. Opcionalmente pueden definir `architectureDecision`, `testInstruction` y `validateArtifacts`. Sin validador propio se comprueba el contrato OpenAPI generado. La validación de versiones de Node corresponde a su adaptador, no se impone como dependencia de otro lenguaje.

## Python con dos persistencias

```bash
node scripts/kit.js composition plan --request "Crear inventario Python json-file" --docker --json
node scripts/devkit.js plan "Crear inventario Python sqlite" --out /tmp/inventario-python --json
```

El adaptador `python-inventory` genera productos/entradas de stock, API, contratos, migración explícita, pruebas, versión de Python, documentación y Compose optativo. No requiere pip ni frameworks. SQLite y JSON-file comparten operaciones de dominio, aislamiento e idempotencia. JSON-file es una alternativa local acotada, no una base distribuida; conserva locks huérfanos para revisión y nunca borra datos desconocidos. No se cambia proveedor para migrar datos automáticamente.

`runtimeVersions: {"python":"3.14.4"}` puede declararse en una solicitud JSON de composición/agente. Los archivos resultantes fijan esa versión; el kit no instala ni cambia Python globalmente. La disponibilidad de `sqlite3` depende de la distribución. La verificación local usó Python 3.14.4 existente y SQLite/JSON reales; otros runtimes o plataformas no se certifican por generar archivos.

Este adaptador no implementa ventas, CRM, SaaS ni frameworks Python: pedirlos se bloquea en lugar de convertir la solicitud a Node. El generador Node mantiene esos módulos iniciales y sus límites previos. Otros lenguajes y bases pueden incorporarse mediante adaptadores y contratos, con pruebas reales antes de anunciarlos disponibles. Los contratos HTTP permiten implementaciones en distintos lenguajes sin asumir compatibilidad de APIs externas originales.

Se conservaron el catálogo de 80 herramientas y módulos Docker. Compose reutiliza políticas y esquema oficiales existentes; no se ejecutó Docker ni se certificó una imagen/build. Los tags deben revisarse/fijarse a digest antes de un build autorizado.

[Pruebas nativas de generación](../../tests/kit/polyglot.test.js) · [Python sqlite3](https://docs.python.org/3.14/library/sqlite3.html) · [Reemplazo de archivos](https://docs.python.org/3.14/library/os.html#os.replace) · [Catálogo comercial](../commercial-packages/README.md)
