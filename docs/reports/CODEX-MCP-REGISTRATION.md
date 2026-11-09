# Registro MCP Canedo Devkit en Codex

Estado: registrado y arranque local verificado; piloto del cliente real pendiente de recarga.

## Configuración aplicada

Codex CLI instalado: `0.164.0-alpha.11.1`. Registro mediante el comando oficial `codex mcp add canedo_devkit -- /opt/homebrew/bin/node ...`, con argumentos:

```toml
[mcp_servers.canedo_devkit]
command = "/opt/homebrew/bin/node"
args = ["/Users/luis/Desktop/Canedo-Web-Studio-v1 usandolo actualmente/scripts/agents/mcp-server.js", "--root", "/Users/luis/Desktop/Canedo-Web-Studio-v1 usandolo actualmente", "--compact", "--max-context-bytes", "8192"]
```

Archivo: `/Users/luis/.codex/config.toml`. Respaldo privado, no incluido en Git: `/Users/luis/.codex/config.toml.backup-canedo-20261102T193049727805Z`.

El comando oficial normalizó dos campos de `node_repl`: eliminó `args=[]` y representó un timeout como float. Se detectó y corrigió restaurando exactamente los bytes previos y añadiendo únicamente el bloque nuevo. Verificación final: todos los bytes originales y todos los servidores anteriores preservados. El primer script corrector fue rechazado por la revisión automática al interpretar una comparación como eliminación; no se ejecutó. Una versión explícita sin eliminaciones fue aprobada y aplicada. No queda bloqueo de aprobación pendiente.

`codex mcp get canedo_devkit --json` confirma `enabled: true`, transporte STDIO, comando y argumentos exactos, sin variables de credenciales, URL remota ni `--allow-generate`.

Fuente del mecanismo: [documentación oficial MCP de OpenAI](https://learn.chatgpt.com/docs/extend/mcp), contrastada con `codex mcp add --help` de la versión instalada.

## Arranque y seguridad: comprobación local, no cliente Codex

Un proceso local de prueba inició el servidor instalado, negoció protocolo `2025-11-25`, consultó cuatro páginas y verificó rechazo de `kit_inspect` sobre `/tmp` fuera del ámbito. Salida del proceso: 0. Servidor identificado: `canedo-devkit`, versión `1.0.0`.

Herramientas anunciadas (18): `kit_discover`, `kit_inspect`, `kit_modules`, `kit_dependencies`, `kit_plan`, `kit_validate`, `kit_enhance`, `kit_memory_status`, `kit_context`, `kit_catalog_page`, `kit_evidence_chunk`, `kit_technical_plan`, `kit_plan_chunk`, `kit_static_validate`, `kit_validation_chunk`, `kit_memory_summary`, `kit_memory_page`, `kit_efficiency`.

`kit_generate` ausente. No se habilitan instalaciones, ejecución arbitraria, despliegues ni escritura de aplicaciones. La inspección de fuentes del transporte/controlador y ruta progresiva confirmó módulos locales, validación de esquemas/ámbito y ausencia de proveedor externo en este flujo. Esto no constituye certificación exhaustiva de seguridad del kit o de todos sus módulos. No se usaron credenciales externas ni se invocaron modelos para la prueba local.

Métricas de esta comprobación única: 728.684 ms de proceso medidos con `performance.now()`; 9982 bytes UTF-8 totales de stdout de todos los mensajes. No son bytes de una respuesta individual, comparación de caché ni tokens. No se midieron tokens. No se afirma mejora de rendimiento a partir de esta muestra.

## Bloqueo de sesión real y próximo paso

Tras registrar, el inventario de herramientas de esta sesión Codex sigue sin `canedo_devkit`, `kit_context` o `kit_technical_plan`. El registro visible para la CLI no acredita llamadas reales desde esta conversación. No se ejecutó una sesión Codex adicional ni se simuló el piloto con el controlador.

El usuario debe cerrar completamente y volver a abrir la aplicación que aloja esta conversación, reabrir este chat/proyecto y pedir: «Continúa el piloto MCP de Canedo Devkit y comprueba primero las herramientas reales». Si el cliente ofrece recarga de servidores MCP, puede probarla primero; solo su disponibilidad posterior demuestra que funcionó. Si tras la recarga no aparecen, revisar el estado/error de `canedo_devkit` en la configuración MCP del cliente. No se asume que una nueva conversación por sí sola recargue el proceso de la aplicación.

Se detiene aquí conforme a la instrucción del usuario. Pendientes hasta conexión real: descubrimiento KIT-FIRST, plan FastAPI, herramientas/dependencias/versiones/preparadores, repetición idéntica y caché, comparación completa/compacta, validaciones y regresiones pertinentes. No se reutilizan métricas históricas como evidencia del piloto. No hay certificación de integración todavía.

Únicas modificaciones de esta fase: registro global autorizado con respaldo y este informe local. Sin instalaciones, descargas de repositorios, aplicaciones generadas, contenedores, commits, push, despliegues o cambios en otros proyectos.
