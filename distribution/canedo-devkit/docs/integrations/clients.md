# Clientes MCP: configuración propuesta, sin certificación de clientes

Cada cliente debe usar Node instalado, una ruta absoluta al servidor y una raíz existente limitada a proyectos propios. No sobrescribas la configuración existente; respáldala y fusiona solo el bloque. No requiere credenciales del servidor. Los permisos del agente siguen bajo control del usuario.

## Codex

[Documentación oficial](https://learn.chatgpt.com/docs/extend/mcp). Usa `codex mcp add` como muestra el README o adapta [el TOML](../../examples/agents/codex-config.example.toml). Reinicia/recarga según el cliente y verifica una llamada real. Listar registros no demuestra herramientas disponibles al modelo.

## Gemini CLI

[Documentación oficial](https://geminicli.com/docs/tools/mcp-server/). Adapta el bloque [mcpServers de ejemplo](../../examples/agents/gemini-settings.example.json) a los settings admitidos por tu versión. No activa confianza automática ni omite aprobaciones. Fusión manual, no sustitución de los settings completos. En el cliente consulta su estado MCP y pide `kit_context`; esta candidata no ha sido probada en una instalación real de Gemini CLI.

## Claude Code

[Documentación oficial](https://code.claude.com/docs/en/mcp). Registro propuesto limitado al proyecto del cliente:

```sh
claude mcp add --transport stdio --scope local canedo_devkit -- node /ruta/canedo-devkit/scripts/agents/mcp-server.js --root /ruta/proyectos-propios --compact --max-context-bytes 8192
```

Revisa `claude mcp add --help` en tu versión antes de ejecutar. Consulta `/mcp` y una llamada real tras aprobar el servidor. `CLAUDE.md` es una instrucción complementaria, no el registro. Cliente real no verificado en esta preparación.

## Flujo de solo lectura

1. Descubre herramientas progresivamente; deben estar las 18 del servidor sin `kit_generate`.
2. `kit_context` con `project` absoluto dentro del ámbito; consulta limitaciones de inspección.
3. `kit_catalog_page` para herramientas relevantes; usa cursor/límite/filtro.
4. `kit_technical_plan` con `project`, `contextId` emitido y `text: Crear una API con Python y FastAPI`.
5. Amplía con `kit_plan_chunk` o `kit_evidence_chunk`; no omitas errores críticos para reducir contexto.

La CLI técnica sin `--diagnose` no sondea versiones instaladas; MCP no convierte una versión catalogada en una versión comprobada. No agregues generación o arranques de servicios para probar el descubrimiento.
