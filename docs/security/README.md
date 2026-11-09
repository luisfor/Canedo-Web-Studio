# Seguridad y límites operativos

KIT-FIRST enlaza evidencia a catálogo/código/destino y exige inspección completa. Las escrituras de proyecto usan creación exclusiva y rechazan rutas inseguras/enlaces. No se regeneran proyectos existentes. Las ampliaciones v1 exigen hashes actuales, confirmación exacta del plan, copias privadas y revisión de fallos parciales. No se eliminan datos para corregir errores.

La inspección excluye secretos, .env, datos y carpetas privadas; publica rutas/huellas/señales, no scripts o valores de configuración. Manifiestos no contienen credenciales. Los hashes detectan alteraciones frente a una instantánea; no son firma ni certificación de un tercero.

El backend v2 verifica empresa y token de actor, roles en servidor, referencias por empresa, idempotencia durable y consultas parametrizadas. Usa contactos/mensajes existentes y no introduce un segundo sistema público de autenticación. Las claves bootstrap deben sustituirse/ampliarse con identidad de producción cuando el proyecto lo requiera. No hay OIDC, MFA o gestión completa de sesiones suministrados.

Los operadores de planes se configuran privadamente; un administrador de cliente no puede otorgarse ese atributo por API. Las cuotas CRM se verifican y registran en transacción. No se afirman cuotas entre bases distribuidas, facturación de tokens IA o protección integral contra abuso. Son pendientes: límites de tasa HTTP, paginación, retención/exportación avanzada, recuperación de cuentas, backups/restauración auditados y revisión de producción.

Canales externos y pagos permanecen deshabilitados. Recepción requiere configuración autorizada, firma y cuenta ligada a empresa; una firma no prueba aprobación de la plataforma. TikTok rechaza activación sin acceso/especificación verificados. IA inyectada requiere autorización, consentimiento, handoff y reserva previa; timeout local y señal de cancelación no garantizan que un proveedor remoto haya cancelado. Resultados inciertos requieren reconciliación, nunca reintentos pagados automáticos.

La aceptación integral genera sus propios destinos temporales y ejecuta únicamente sus pruebas revisadas, sin `npm install`, scripts del usuario, repositorios, imágenes o contenedores. No acepta una ruta existente para ejecutarle código. La evidencia local no certifica canales, otro sistema operativo, producción o auditoría de seguridad externa.

Docker genera secretos externos, usuarios sin privilegios, red interna, volúmenes y límites; no publica puertos por defecto. Deben revisarse los digest de imágenes, permisos de secretos y migraciones antes de ejecutar comandos. Nunca se incluyen tokens en imágenes ni se borran volúmenes por generación. El modo asistido de instalación sigue reservado; se emiten comandos manuales revisables.
