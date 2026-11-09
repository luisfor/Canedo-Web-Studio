# Fase H — operación manual y manifiestos

2026-11-02. Sin ejecución de Docker, instalaciones o modificación del proyecto original.

Nuevos: scripts/workspace/environment.js, scripts/docker/operations.js y tests/kit/workspace-h.test.js. Integración en CLI/package.json. Ajustes de archivos compartidos y plantillas: configuración Redis no secreta legible, exclusiones adicionales de secretos en builds, comando venv Windows correcto y plugin compilador Maven 3.13.0 explícito para --release. Los valores de secretos se siguen creando y protegiendo manualmente fuera de imágenes.

273 pruebas aprobadas (252 + 21 nuevas), kit:validate aprobado. Se probaron export/restore de configuración, privacidad, drift, symlinks, confirmación de eliminación de contenedores/volúmenes, contexto y servicio restringidos, actualizaciones como planes nuevos y mantenimiento sin reinstalación.

Los comandos de operación no se ejecutaron: up evita descarga/build/recreación implícita; stop preserva datos; pull/build son acciones manuales explícitas; down y remove-volumes requieren confirmaciones particulares. El nombre Compose no prueba propiedad de recursos; el usuario debe revisar contexto, inventario y backups.

Export/restore reproduce la configuración inicial, no código modificado, datos, secretos, lockfiles o SDKs. Diferencias de host se informan, no se certifica equivalencia. Docker ausente en macOS ARM64; pruebas de integración con motor y migraciones reales quedan pendientes para un entorno autorizado. Continúa fase I dentro de la autorización conjunta.
