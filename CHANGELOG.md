# Cambios del kit

## Sin publicar — 2026-11-02

### Motor de composición de proyectos

- Catálogo declarativo ampliable de capacidades, arquetipos y referencias AFPVentas/Vocero con evidencia de licencia, sin importar código externo.
- Interpretación local en español y frontera configurable de proveedores semánticos, resolución de dependencias, conflictos tecnológicos y arquitectura justificada.
- Generador original Node/SQLite de tienda + CRM: APIs, transacciones venta/stock/caja/outbox, inbox idempotente, compras/proveedores, migraciones, contratos, interfaces y puertos HTTP.
- WhatsApp y chatbot deshabilitados por defecto; consentimiento e inyección explícita de adaptadores de prueba, sin proveedores pagos activados.
- Compose optativo reutilizando políticas y esquema existentes; escritura exclusiva y registro de integridad; comandos manuales sin instalaciones o arranque de contenedores.
- Ejemplo reproducible, pruebas del motor y de los proyectos generados, verificador integral explícito con SQLite y HTTP real en localhost. Plataformas/SDK e imágenes no ejecutados se informan como pendientes.

### Fase I ampliada: validación nativa local

- 301 pruebas aprobadas y 25 controles, con esquema Compose oficial vendorizado, commit/checksum fijados y licencia/NOTICE conservados.
- Pruebas HTTP reales Node/Python/Java en localhost temporal; Java original y nueva plantilla compilados con JDK existente. Se registran versiones reales y diferencias con los SDK solicitados.
- Plantilla 1.1 optativa para HOST/PORT; versión 1.0 y planes previos conservados sin cambio de valor predeterminado.
- `verify native`, `verify compose` y `docker schema`; CI ampliado sin instalar SDKs faltantes ni iniciar contenedores.
- Inventario revisable de 55 archivos para CI, sin publicar. Windows/Linux/Intel y Docker real siguen pendientes; no se declara certificación nativa externa.

### Fases F–I: entornos, Docker y operación manual

- F: diagnóstico Docker por componente/contexto; seis stacks con versiones/dependencias por proyecto, planes validados y escritura exclusiva.
- G: diez perfiles optativos, Compose para cinco motores de datos y cinco backends /health; secretos externos, redes, volúmenes, puertos locales optativos, health checks y límites.
- H: comandos de operación sin ejecución; confirmaciones de eliminación, drift y export/restore/compare/update/repair de configuración, sin secretos o datos.
- I: verificador por host, pruebas integradas y workflow de matriz Windows/Linux/macOS ARM/Intel con acciones fijadas por SHA. Workflow definido, no ejecutado en GitHub.
- Se conservan las capacidades anteriores y el modo asistido deshabilitado. Sin dependencias nuevas, instalaciones globales, commits, push, arranque de contenedores ni despliegues.
- 282 pruebas totales aprobadas; 15 controles de configuración y sintaxis Node/Python.
- Informes por fase y guía operativa con límites: Docker ausente localmente, builds y plataformas externas pendientes de comprobación nativa.

### Fase E: transición a generación de comandos manuales

- Modo manual predeterminado; modo asistido reservado e inhabilitado, incluso con `--approve`.
- CLI y API público bloquean ejecución. Motores internos, preparación de snapshots, validación y pruebas anteriores conservados.
- Comandos `install commands` y `install modes`; cobertura manual separada de los snapshots históricos.
- Cinco adaptadores: Homebrew, winget, apt, dnf y archivos oficiales; recetas para Node, Go, Python, Git, Java, .NET, Terraform y Docker, con npm incluido.
- Planes de esquema 3 con comandos estructurados, precondiciones, versiones de paquete, fuentes, permisos, riesgos y espacio explícitamente desconocido sin evidencia.
- Renderizado POSIX/PowerShell, validación mediante reconstrucción y huellas, rechazo de inyección y de reinstalación nativa de herramientas detectadas.
- Docker incluye comandos manuales de instalación y verificaciones por componente, sin diagnóstico operativo ni generación/arranque de servicios en esta fase.
- 58 pruebas manuales nuevas; 218 pruebas totales aprobadas, incluyendo regresión de capacidades anteriores.
- Documentación, ejemplos e informe de entrega; fase F pendiente de autorización.
- Sin dependencias nuevas, instalaciones globales, commits, push ni despliegues.

## Sin publicar — 2026-11-01

### Fase E: ampliación Node.js/npm y Terraform

- Registro de tres recetas y comando `install coverage`: 3 herramientas con receta, npm incluido y 76 entradas pendientes.
- Node LTS con npm de la publicación y Terraform con archivo/versión exactos en listas SHA-256 oficiales.
- Consulta HEAD de tamaño sin descargar SDK; nueva consulta oficial antes de aplicar.
- Copias paralelas Node/Terraform que conservan herramientas existentes y PATH; compatibilidad de proyecto Terraform sin certificar.
- Motor compartido con validación de enlaces internos Node, versiones, arquitectura, límites y publicación exclusiva.
- Extracción de operaciones comunes manteniendo la API/receta Go; corrección y prueba del entorno Windows y aislamiento npm/Terraform.
- Preparación comprobada contra fuentes oficiales de Node y Terraform en macOS ARM64, sin instalar distribuciones reales. Plataformas restantes con simulaciones y pruebas nativas pendientes.
- 47 pruebas nuevas (160 en total), incluidas copias paralelas Node, fallos de recibo y ZIP real con el adaptador unzip para Linux.
- Sin dependencias nuevas, commits, push ni cambios de configuración persistente.

### Fase E: motor de instalación y receta Go

- Comando `kit:install recipes/prepare/validate/apply`, separado del planificador revisable.
- Archivos oficiales Go para Windows/macOS/Linux y x64/ARM64, según versión publicada; las otras herramientas permanecen sin receta.
- Propuestas con destino nuevo, artefacto, tamaño, SHA-256, caducidad e ID para aprobación explícita.
- Rediagnóstico, revalidación oficial, transporte HTTPS restringido, extracción con argumentos fijos e inspección de archivos.
- Verificación de versión, publicación sin reemplazo, recibo local y detención controlada ante fallos.
- 32 pruebas nuevas (113 en total), con archivos sintéticos y transporte HTTPS simulado; preparación verificada contra metadatos oficiales. Sin instalar un SDK real ni configurar PATH. Certificación nativa de Windows/Linux pendiente.
- Sin dependencias nuevas, commits ni push.

### Fase D: planificador revisable

- Comandos `kit:plan` y `plan validate` con selección por perfil/herramienta, exclusiones, versiones exactas y preferencia de gestor.
- Resolución de dependencias, bloqueos y decisiones; reutilización compatible y revisión de instalaciones existentes sin reemplazo automático.
- Servicios de bases de datos con despliegue por decidir; paquetes con alcance de proyecto.
- Esquemas estrictos, normalización de reportes, huellas SHA-256 y reconstrucción para validar coherencia.
- 27 pruebas del planificador; sin recetas ejecutables, instalaciones, commits ni push.

### Fase C: catálogo versionado de herramientas

- Manifiesto 1.0.0 con 80 entradas, 22 diagnósticos y 58 recursos documentados.
- JSON Schema y validación de fuentes, versiones, referencias, ciclos, conflictos y plataformas comunes.
- Comandos locales `tools list/show/dependencies/validate` mediante `kit:tools`.
- Reglas revisadas de Node, Python y Go conectadas al doctor; las otras compatibilidades no se presuponen.
- Comprobación de correspondencia con los 20 diagnósticos heredados sin eliminar perfiles.
- Restricción de combinaciones de argumentos para que un supuesto comando de versión no ejecute archivos de un proyecto.
- Sin instalaciones, actualizaciones, planes ejecutables, commits ni push.

### Fase B: diagnóstico multiplataforma

- Doctor modular con información de OS/arquitectura, distribución Linux y versión de macOS.
- Versiones de CLIs, gestores por presencia, estado de configuración sin valores y motivos de fallo.
- Consultas selectivas `--tool`, incluidos Git y Go, sin añadir generadores ni instaladores.
- Resolución de rutas Windows, tratamiento de wrappers/alias y alternativa Python launcher.
- Compatibilidad evaluada solo ante requisitos explícitos y controles contra descargas implícitas.
- Pruebas de regresión y casos simulados de plataformas; validación nativa de Windows/Linux pendiente.
- Documentación de alcance y límites en `docs/ENVIRONMENT-DOCTOR.md`.

No se incluyen instalaciones, actualizaciones, commits ni despliegues en la ejecución de esta fase.
