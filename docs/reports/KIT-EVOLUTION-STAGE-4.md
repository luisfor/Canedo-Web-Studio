# Etapa 4 — interfaces de agentes y MCP

La etapa 3 cerró con 356/356 pruebas y catálogo aprobado antes de iniciar esta etapa.

Archivos nuevos: [controlador](../../scripts/agents/controller.js), [servidor STDIO](../../scripts/agents/mcp-server.js), [pruebas](../../tests/kit/agents.test.js), [guía](../integrations/agents.md), [ejemplo Codex](../../examples/agents/codex-config.example.toml), [campos genéricos](../../examples/agents/stdio-server.example.json) y este informe.

Modificados: [AGENTS.md](../../AGENTS.md), [CLAUDE.md](../../CLAUDE.md), [package.json](../../package.json) y [README](../../README.md). La entrada de biblioteca apunta ahora a un módulo real, sin iniciar servidores al importarlo. No se añadieron dependencias.

## Implementado

Controlador con ámbito de filesystem elegido por el operador, JSON Schema, límites por conexión y operaciones de descubrimiento, inspección, módulos, dependencias, planificación, validación, estado y preparación de mejoras. La generación es optativa mediante `--allow-generate`, solo para destinos nuevos. No hay herramientas de ejecución, instalación, contenedores, migraciones, cobros o aplicación de mejoras existentes.

El servidor local implementa negociación/ciclo de vida MCP y herramientas sobre JSON-RPC/NDJSON. Exige descubrimiento y plan emitidos por la propia conexión, validación previa y confirmación del plan exacto. Revalida el estado mediante KIT-FIRST y usa la composición/escritura/memoria existentes. Una evidencia importada, proyecto fuera de ámbito, plan cambiado o destino existente no permite generar. No depende únicamente de AGENTS.md.

La documentación se contrastó con la [especificación de transporte](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports), [ciclo de vida](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle), [herramientas](https://modelcontextprotocol.io/specification/2025-11-25/server/tools) y [configuración oficial OpenAI](https://developers.openai.com/codex/mcp). Los ejemplos son datos revisables; no se aplicaron a configuración global o privada.

## Pruebas y resultados

Siete pruebas nuevas: ciclo de vida/negociación, modo de solo lectura, límites de raíz/esquema, consulta y plan por conexión, validación y confirmación previas, catálogo/dependencias, cambios del destino, notificaciones sin efectos, campos de versiones anteriores, arranque inválido y mensajes malformados. Un cliente de prueba real inicia el servidor por STDIO y completa `initialize → tools/list → discover → plan → validate → generate`, creando un proyecto temporal con memoria y sin comandos ejecutados.

- `node --test tests/kit/agents.test.js`: 7/7 aprobadas.
- `npm run test:kit`: **363/363 aprobadas**, sin fallos ni omisiones.
- `npm run kit:validate`: aprobado.
- `git diff --check`: sin errores.

## Límites y pendientes

La prueba del transporte es real y genera archivos reales, pero usa un cliente local controlado. No se instaló/configuró/verificó un cliente Codex Desktop/IDE/CLI, Claude ni otro cliente comercial. No se afirma compatibilidad universal o certificación MCP completa. La implementación se limita a STDIO/herramientas; no anuncia HTTP, OAuth, recursos o tareas no implementados.

La política protege las operaciones de la interfaz, no escrituras externas. El ámbito y habilitación de escritura los elige el operador, y las aprobaciones humanas siguen correspondiendo al cliente. No se modificaron configuraciones globales ni proyectos ajenos, instalaron SDKs, descargaron repositorios o iniciaron contenedores. Sin commits, push o despliegues.
