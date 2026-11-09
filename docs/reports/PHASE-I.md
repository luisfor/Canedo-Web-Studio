# Fase I — verificación ampliada y ejecución nativa local

2026-11-02. Se ejecutó la validación posible con herramientas existentes. La matriz de otros sistemas no se presenta como ejecutada.

## Resultados actuales

- **301 pruebas automatizadas aprobadas**, 0 fallos, 0 omitidas en este macOS ARM64.
- **25 controles** en `verify runtime`: catálogos, planes, sintaxis y esquema Compose oficial para cinco motores de datos y cinco backends.
- Compilación Java real con JDK **21.0.7**, `--release 21`, tanto de la plantilla original 1.0 como de la optativa 1.1.
- Pruebas HTTP nativas reales con **Node 25.2.1**, **Python 3.14.4** y **Java 21.0.7**: `/health` devolvió 200, otra ruta 404 y cada healthcheck terminó con código 0.
- Los tres procesos se enlazaron exclusivamente a **127.0.0.1**, con puerto efímero; terminaron al cerrar las pruebas y se eliminaron sus archivos temporales. No se instalaron runtimes ni se cambiaron ajustes globales.
- Las versiones disponibles no coinciden exactamente con las imágenes solicitadas en los ejemplos. `exactRuntimeMatch: false` lo deja explícito; no se certifican esas imágenes a partir de estos resultados.

[Evidencia nativa sin rutas personales](PHASE-I-NATIVE-MACOS-ARM64.json).

## Implementación

- `scripts/workspace/native-check.js`: pruebas explícitas de programas generados, con límites, versiones detectadas, estados de SDK ausente, puertos locales, cierre y limpieza.
- `scripts/workspace/compose-check.js`: diez comprobaciones `docker compose config --quiet` cuando existe la CLI; no consulta motor, descarga imágenes ni inicia contenedores.
- `scripts/docker/schema.js` y `schemas/vendor/compose-spec.*`: esquema oficial vendorizado, commit fijado, checksum, licencia Apache-2.0 y NOTICE conservados. Valida estructura sin Docker; no sustituye sus pruebas de ejecución.
- `scripts/docker/backends-v1.js`: conserva los archivos anteriores. `backends.js` añade plantilla optativa **1.1.0**, con HOST/PORT para Node/Python/Java. El valor predeterminado sigue siendo 1.0.0; planes y registros previos continúan admitidos.
- CLI: `verify native`, `verify compose`, `docker schema` y `docker plan --template-version 1.1.0`.
- Nuevas pruebas en `tests/kit/native-i.test.js`; integración en package.json, verificador y workflow de CI.

## Docker y plataformas externas

En este host no hay Docker/Compose, Podman, Colima o Lima disponibles. `verify compose --require-docker` devuelve **unavailable**, con salida 1 y cero comprobaciones nativas Compose. El esquema oficial sí valida las diez configuraciones, pero no demuestra que se puedan construir o ejecutar sus imágenes.

No se ejecutaron contenedores, pruebas de bases de datos, persistencia/migración ni builds Go/.NET. Windows, Linux y macOS Intel requieren hosts reales. Rosetta instalada no equivale a una prueba nativa Intel y no se usa como tal.

La matriz contiene Windows, Linux, macOS ARM e Intel. Además de la suite, propone Node HTTP nativo obligatorio, Python/Java existentes —sin instalar SDKs ausentes— y el parser Compose en el runner Linux. Está **definida, no ejecutada en GitHub**. No se hizo push, se abrió PR o se activó un workflow.

## Siguiente acción revisable

[PHASE-I-CI-FILES.json](PHASE-I-CI-FILES.json) enumera **55 archivos** de código, pruebas, catálogos, esquemas y workflow necesarios para una rama de validación, con SHA-256 y commit base. Excluye proyectos de clientes, configuración personal, secretos, anexos, informes locales y cambios de la web ajenos a las pruebas. El inventario no concede autorización ni garantiza que todos los datos históricos del repositorio estén auditados.

Rama propuesta: `codex/fase-i-validacion`, PR en borrador, sin merge ni despliegue. Antes de publicar deben comprobarse de nuevo hashes/privacidad y la autorización de commits/push indicada por el usuario. Sin esa autorización o hosts externos accesibles, no se puede cerrar honestamente la certificación nativa externa.
