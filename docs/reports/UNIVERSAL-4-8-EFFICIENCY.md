# Mejoras universales 4–8 y eficiencia transversal

Se conservan planificador, catálogos, preparadores, memoria y generadores existentes. El reconocimiento técnico admite señales web, backend, móvil, escritorio, videojuegos, IoT, IA, automatización y empresa sin exigir módulos comerciales. Reconocer una tecnología no certifica su generador o compilador.

## Implementación y archivos

- `scripts/kit-first/{cache,inspect,service,discovery}.js`: caché derivada, invalidación por contenido y comprobación fresca KIT-FIRST.
- `scripts/agents/{context,progressive,usage,cli,benchmark}.js`: presupuestos, resúmenes, paginación, evidencia ampliable y métricas.
- `scripts/agents/{controller,mcp-server}.js`: API/MCP progresivo conservando herramientas históricas.
- `scripts/terminal/{technical,interpret,service}.js`: reconocimiento, reutilización de evidencia y métricas opcionales.
- `scripts/workspace/static-validation.js`: comprobaciones sintácticas sin ejecutar el proyecto.
- `scripts/memory/{store,checkpoint}.js`, `schemas/project-memory.schema.json`: continuidad con verificación de alcance explícito.
- `scripts/composition/{acceptance.js,business-runtime/integration.test.cjs}`: omisiones declaradas, separadas de pruebas ejercitadas.
- `tests/kit/{efficiency,business,acceptance}.test.js`, `package.json`, `.gitignore`, README y guía: pruebas y documentación.

Esta lista identifica responsabilidades de la entrega; no atribuye todos los archivos previos sin seguimiento a ella.

## Pruebas y mediciones

Comandos: `node --test tests/kit/efficiency.test.js`, `node scripts/kit.js efficiency benchmark`, `npm run test:kit`.

Las 12 pruebas específicas pasan: equivalencia caché/completo, reutilización entre procesos, invalidación con fechas restauradas, enlaces, limpieza segura, paginación, reconstrucción de evidencia, MCP STDIO, rechazo de contextos antiguos, checkpoints y métricas de proveedor simulado.

La primera regresión restringida obtuvo 409 aprobadas y 9 fallidas de 418: ocho necesitaron HTTP localhost bloqueado por el sandbox; una detectó el enlace a este informe aún no creado. No se presenta esa ejecución como aprobada. El resultado final se añade tras ejecutar las regresiones.

[Benchmark JSON](UNIVERSAL-4-8-EFFICIENCY-RESULTS.json): tres análisis iniciales, cero análisis repetidos y tres reutilizados en caliente; los mismos 96 bytes se leen para verificar seguridad. Los bytes JSON de evidencia completa y resumen se miden directamente. No equivalen a tokens ni ahorro monetario. No se invocaron modelos.

Las omisiones internas de ejemplos se reportan como `notExercisedTests`; el total declarado no equivale a total ejercitado. Los informes históricos se conservan.

## Limitaciones

Cliente MCP de protocolo probado; clientes reales Codex/Gemini/Claude sin configurar ni certificar. Host real macOS ARM64; Windows/Linux requieren verificación nativa. Validación estática no certifica comportamiento o builds de todos los stacks. El bundle grande `automatismos/social-media-bot/bundled-test/index.js` sigue bloqueando inspección integral de este repositorio; no se ignora arbitrariamente.

Caché persistente optativa, entradas acotadas individualmente y limpieza manual; sin cuota total automática. Consumo interno de agentes externos desconocido. No se instalaron dependencias, descargaron repositorios, iniciaron contenedores, hicieron commits, push ni despliegues.

[Guía de comandos, controles y límites](../cli/resource-efficiency.md).

## Resultado final

La regresión completa ejecutada con permiso para HTTP localhost terminó con **418/418 aprobadas**, cero fallos, cero omisiones del runner principal, en 18 823 ms. Después se añadió una prueba explícita de parsers Python/ESM y se redujo el recibo CLI de checkpoint para que una respuesta grande no cause un error después de registrar metadatos: **12/12 pruebas de eficiencia aprobadas**, en 1 988 ms. No se presenta esta segunda ejecución como una nueva regresión completa de 419 casos.

El runner principal puede aprobar una prueba que comprueba omisiones internas correctamente: las omisiones de los ejemplos generados siguen separadas del trabajo ejecutado. La equivalencia de evidencias y KIT-FIRST sin paquetes comerciales están cubiertos por las suites universales y la regresión completa.

La entrega implementa los controles locales y las interfaces de las mejoras 4–8 dentro del alcance descrito. La verificación nativa multistema, los validadores de stacks pendientes y las conexiones con clientes reales siguen abiertas; no se declaran terminadas por esta entrega.
