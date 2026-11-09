# Fase G — perfiles y plantillas Docker

2026-11-02. Modo manual, sin arranque ni descarga de imágenes.

Nuevos: catalog/profiles/manifest.json, scripts/workspace/profiles.js, scripts/docker/generate.js, scripts/docker/backends.js y tests/kit/workspace-g.test.js. Integración en scripts/workspace/cli.js, scripts/kit.js, package.json y docs/WORKSPACE-OPERATIONS.md.

252 pruebas aprobadas (234 + 18 nuevas); kit:validate aprobado. Matrices de cinco motores de datos y cinco backends, secretos externos, puertos locales optativos, límites, persistencia, variantes PostgreSQL, imágenes explícitas, archivos exclusivos, perfiles optativos y sintaxis Node generada.

Verificaciones reales: CLI/generación y sintaxis del backend Node en macOS ARM64. Docker está ausente: no se ejecutó compose config, un build o un contenedor. No se atribuye compilación a Go/Java/.NET ni certificación nativa a Windows/Linux. Los backends de ejemplo solo implementan /health.

Pendiente: comandos de operación/exportación/restauración (H), integración y matriz nativa (I). Validación real de imágenes, autenticación, backups y migraciones requieren un entorno autorizado; no se inventan resultados.
