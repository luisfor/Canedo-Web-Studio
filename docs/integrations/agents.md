# Agentes: API estructurada y MCP

El kit dispone de interfaces CLI/JSON, un controlador programático y un servidor MCP local STDIO. Todos reutilizan KIT-FIRST, composición, memoria y validadores existentes. No se instalaron SDKs, clientes ni servicios externos y no se modificó la configuración global del usuario.

## Servidor local

```bash
node /ruta/kit/scripts/agents/mcp-server.js --root /ruta/proyectos-propios
```

La raíz debe existir, ser absoluta/normalizada y no tener enlaces simbólicos. Las herramientas solo admiten proyectos dentro de ella. Por defecto no se expone generación. Para habilitar explícitamente creación de destinos nuevos dentro del ámbito, el operador puede añadir `--allow-generate`; sigue requiriendo descubrimiento, plan emitido por la conexión, validación y confirmación del ID exacto. No hay herramienta para instalaciones, comandos arbitrarios, migraciones, contenedores, cobros, despliegues ni aplicación de mejoras sobre proyectos existentes.

STDIO usa JSON-RPC delimitado por nuevas líneas; stdout solo contiene mensajes del protocolo. Configura el cliente para ejecutar `node` directamente, no `npm run` con banners. La implementación local admite negociación de las versiones 2024-11-05, 2025-03-26, 2025-06-18 y 2025-11-25; ajusta campos de resultados/hints para versiones anteriores. No anuncia HTTP, recursos, tareas, muestreo, OAuth o funciones no implementadas. Limita mensajes a 2 MiB y conserva un máximo de 128 evidencias/planes por conexión; evidencia evictada requiere redescubrimiento.

## Herramientas

| Herramienta | Alcance |
|---|---|
| `kit_discover` | Versión, catálogos e inspección; emite evidencia en esta conexión |
| `kit_inspect` | Inspección estática, sin ejecutar el destino |
| `kit_modules` | Módulos, arquetipos y referencias del catálogo descubierto |
| `kit_dependencies` | Dependencias transitivas declaradas de módulos o herramientas; no instala |
| `kit_plan` | Plan de creación con evidencias vigentes y evaluación de reutilización |
| `kit_validate` | Valida un plan emitido por la misma conexión |
| `kit_enhance` | Prepara una mejora incremental, sin aplicarla |
| `kit_memory_status` | Estado del manifiesto y diferencias de archivos |
| `kit_generate` | Solo con habilitación del operador; crea un destino nuevo y registra memoria |

El controlador exige el orden observado en la conexión, además de la revalidación del estado real. Una evidencia de otro cliente no evita el descubrimiento. Cambios del kit/destino/plan bloquean la generación. Los hashes no autentican al agente y la política no controla escrituras fuera del kit. La aprobación humana final depende del cliente que consume MCP; conserva sus controles de herramientas.

## Codex y otros clientes

La [documentación oficial de OpenAI](https://developers.openai.com/codex/mcp) describe servidores STDIO, `command`, `args` y configuración por servidor. El [ejemplo TOML](../../examples/agents/codex-config.example.toml) es revisable y contiene rutas ficticias, sin credenciales. No se copia a `.codex/config.toml` ni instala nada automáticamente. También hay [campos de lanzamiento genéricos](../../examples/agents/stdio-server.example.json) para adaptar al formato del cliente elegido.

Se comprobó un cliente local real del protocolo que inicia el proceso por STDIO, negocia, descubre herramientas, consulta el kit, planifica, valida y genera un proyecto con memoria. No se configuró/verificó esta conexión en una instalación real de Codex Desktop/IDE/CLI, Claude u otro cliente de terceros. Compatibilidad del transporte probado no equivale a certificar todas sus versiones o sus políticas de aprobación. AGENTS.md y CLAUDE.md complementan la interfaz; no la sustituyen.

La API programática se obtiene con `require('/ruta/kit')` (`controller({root, allowGenerate})`) o módulos directos de `scripts/kit-first`, `scripts/terminal` y `scripts/memory`. El paquete no inicia un servidor al importarlo. JSON Schema y las mismas compuertas se aplican a todas las llamadas.

## Verificación y fuentes

`npm run test:agents` comprueba ciclo de vida, negociación, ámbito, modo de solo lectura, esquemas, orden entre herramientas, evidencias ajenas, cambios del destino, confirmación, privacidad del transporte y un flujo real de generación por STDIO. No usa un SDK simulado como prueba de conexión externa: el cliente de prueba conversa con el servidor ejecutado y genera archivos reales en una carpeta temporal. Ninguna prueba conecta un proveedor de IA o canal social.

Implementación basada en [transporte MCP](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports), [ciclo de vida](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle) y [herramientas](https://modelcontextprotocol.io/specification/2025-11-25/server/tools). Es un servidor acotado con pruebas locales, no una certificación completa ni un reemplazo de todos los componentes de un SDK MCP.
