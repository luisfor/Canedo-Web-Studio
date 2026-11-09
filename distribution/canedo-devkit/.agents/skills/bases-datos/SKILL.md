---
name: bases-datos
description: Diseñar esquemas, consultas, migraciones y rendimiento en SQL, SQL Server, SQLite, PostgreSQL, MySQL y Oracle respetando las diferencias entre motores.
---

# Datos relacionales
Determina motor, versión, esquema, carga, collation y zona horaria. SQL es un lenguaje, no un motor. Mantén credenciales fuera de consultas, logs y Git.

## Modelo y consultas
Respeta el motor existente. En uno nuevo compara concurrencia, despliegue y operación. Define claves, unicidad, relaciones, precisión decimal y timestamps. Dinero no usa float.
Parametriza valores y valida identificadores dinámicos con una lista permitida. Usa constraints y transacciones para invariantes; comprobaciones previas solas están expuestas a carreras.

## Diferencias operativas
- PostgreSQL: MVCC, aislamiento, índices parciales y permisos. EXPLAIN ANALYZE ejecuta la consulta. Revisa bloqueos DDL y reglas de índices concurrentes.
- SQL Server: T-SQL, IDENTITY, OUTPUT, TOP/OFFSET y planes; revisa aislamiento. NOLOCK puede alterar resultados, no es una optimización universal.
- SQLite: verifica foreign_keys por conexión, escritor único, busy_timeout y WAL. Usa backup consistente: copiar solo el archivo activo puede perder cambios del WAL.
- MySQL: verifica InnoDB, sql_mode, charset/collation y commits implícitos DDL. No asumas que rollback revierte todas las migraciones.
- Oracle: distingue servicio y esquema, secuencias/identidades y cadenas vacías tratadas como NULL; verifica límites y paginación de la versión real.

## Migraciones y validación
Lee planes antes de añadir índices. Define expansión/contracción, compatibilidad y recuperación. Prueba restauración; un downgrade no recupera necesariamente datos eliminados.
Prueba contra el motor objetivo: SQLite no sustituye SQL Server u Oracle. En operaciones destructivas confirma entorno y alcance si la petición no los autoriza.
Fuentes: [PostgreSQL](https://www.postgresql.org/docs/), [SQL Server](https://learn.microsoft.com/sql/), [SQLite](https://sqlite.org/docs.html), [MySQL](https://dev.mysql.com/doc/), [Oracle](https://docs.oracle.com/en/database/).
