# Piloto Codex: comprobación de conexión

Estado: detenido antes de la planificación por falta de registro MCP del kit en el cliente real.

## Evidencia de esta ejecución

- `git status --short` y `git diff --name-only`: se conservan 11 archivos rastreados modificados y los directorios previos sin seguimiento. No se restablecieron archivos ni se prepararon commits.
- Se leyó `AGENTS.md`, el ejemplo TOML y la guía de integración del kit.
- Lectura selectiva mediante `tomllib` de `/Users/luis/.codex/config.toml`: el registro `mcp_servers` contiene `node_repl`; no contiene `canedo_devkit` ni un comando apuntando al servidor del kit. No existe `.codex/config.toml` en este proyecto.
- La lista de herramientas disponible en esta sesión real no contiene `kit_context`, `kit_technical_plan`, `kit_discover` ni otras herramientas identificadas del kit. Las herramientas de aplicaciones ajenas no demuestran conexión con él.
- `command -v node`: `/opt/homebrew/bin/node`.
- Existe el ejecutable local Codex. No se inició otra sesión, no se modificó configuración y no se usaron credenciales externas.

La ausencia de registro y herramientas demuestra que esta sesión no puede completar el piloto MCP solicitado; no demuestra un fallo del servidor. Una ejecución del controlador, CLI del kit o cliente de protocolo propio no se presentaría como conexión real Codex.

## Qué falta y configuración propuesta, todavía no aplicada

Autorizar agregar el servidor local en `/Users/luis/.codex/config.toml` conservando sus entradas existentes, o configurarlo mediante las opciones MCP del cliente. Configuración concreta de alcance limitado a este kit:

```toml
[mcp_servers.canedo_devkit]
command = "/opt/homebrew/bin/node"
args = ["/Users/luis/Desktop/Canedo-Web-Studio-v1 usandolo actualmente/scripts/agents/mcp-server.js", "--root", "/Users/luis/Desktop/Canedo-Web-Studio-v1 usandolo actualmente", "--compact", "--max-context-bytes", "8192"]
```

No habilita generación ni requiere claves. Cualquier otro ámbito de proyectos debe elegirse expresamente; este bloque no concede acceso a carpetas ajenas. La disponibilidad efectiva y cualquier recarga necesaria deben verificarse en el cliente tras configurarlo, sin asumir que una edición incorpora herramientas a la sesión actual. En esta entrega no se solicita ni intenta escalación para cambiar la configuración global.

Fuente: [OpenAI, configuración MCP](https://learn.chatgpt.com/docs/extend/mcp), que documenta tablas `mcp_servers`, comandos STDIO y configuración global o por proyecto.

## Pendientes del piloto, no ejecutados

Por la condición explícita de detenerse si la conexión requiere configuración/autorización, no se ejecutaron planificación FastAPI, repetición con caché, comparación de respuestas ni regresiones en esta ejecución. Solicitud preparada para ambas repeticiones: «Crear una API con Python y FastAPI». Se deberán comprobar dependencias, versiones y restricciones, preparación disponible y validaciones pendientes, sin generar una aplicación.

Tiempos de planificación, bytes de respuestas del kit y tokens: no medidos en este piloto. Los resultados históricos de pruebas/benchmarks no se reutilizan como evidencia del cliente real. Tras conectar, deben compararse salidas completas y compactas, incluyendo errores/bloqueos y vigencia de evidencia.

La inspección integral del repositorio tenía además un bloqueo documentado por un bundle fuente grande; no se ha vuelto a comprobar ni ignorado en esta ejecución. Si persiste, debe aparecer en el resultado real y no ocultarse para completar el piloto.

## Dictamen

No está verificado como asistente MCP de Codex para proyectos reales. El kit dispone de implementación y pruebas locales previas, pero esta instalación no lo expone a esta sesión. Se requiere configurar/autorizar el servidor y completar el piloto antes de emitir un dictamen favorable. Único archivo añadido por esta comprobación: este informe. Sin instalaciones, cambios de producto, aplicaciones generadas, commits, push o despliegues.
