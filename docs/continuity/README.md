# Memoria técnica y mejoras incrementales

La continuidad incorpora un manifiesto validado por [esquema](../../schemas/project-memory.schema.json) en `.devkit/project.json`. Los proyectos nuevos creados mediante `agent create` lo reciben automáticamente. Los lectores de registros anteriores siguen disponibles; no se reemplazan ni modifican sus archivos al adoptar un proyecto.

## Adoptar y consultar

```bash
npm run kit:memory -- adopt --project /ruta/absoluta/proyecto --json
npm run kit:memory -- status --project /ruta/absoluta/proyecto --json
```

`adopt` consulta el kit e inspecciona el destino antes de crear exclusivamente una carpeta `.devkit` nueva. Si existe, incluso vacía, se rechaza. No ejecuta código, migraciones o pruebas del proyecto. Puede registrar un proyecto arbitrario sin considerarlo generado por el kit.

El manifiesto contiene ID sin ruta personal, versión/huella del kit, arquitectura, lenguajes/frameworks/motores observados, módulos y origen, contratos, dependencias sanitizadas, decisiones, cambios, hashes/propiedad y estado de verificación. Distingue módulos `generated` u `observed` de capacidades `implemented`: estas últimas no se rellenan por detectar o generar código. Las pruebas comienzan en `not-run`. No se copian secretos, `.env`, valores de configuración, scripts npm, bases de datos ni datos de clientes.

La base `project.json` permanece inmutable. Las mejoras agregan estados completos encadenados en `.devkit/revisions/<id>.json`; `memory status` valida el estado vigente. Modificar, bifurcar o dejar revisiones huérfanas bloquea la lectura. Los hashes no son firmas ni una auditoría inviolable frente al propietario del filesystem.

## Planificar y aplicar una ampliación

```bash
node scripts/kit.js agent discover --project /ruta/proyecto --json > /tmp/evidencia.json
node scripts/kit.js memory enhance --project /ruta/proyecto --file /tmp/evidencia.json --request "ventas caja WhatsApp chatbot" --json > /tmp/mejora.json
node scripts/kit.js memory validate --project /ruta/proyecto --file /tmp/mejora.json --json
node scripts/kit.js memory apply --project /ruta/proyecto --file /tmp/mejora.json --confirm ID_EXACTO_DE_PROPOSAL --json
```

Usa rutas absolutas propias, redirección UTF-8 en Windows y archivos que no necesites conservar previamente. `ID_EXACTO_DE_PROPOSAL` es `proposalId` del JSON revisado. No se aplica nada al planificar. La aplicación es explícita y vuelve a comprobar evidencia, manifiesto, archivos y plan.

El reconciliador inicial amplía composiciones v1 propias Node/SQLite. Reutiliza su configuración y el generador, conserva módulos y calcula diferencias; no reemplaza carpetas, elimina archivos ni reescribe una aplicación completa. Un módulo ya presente es una operación sin cambios. Otros proyectos se inspeccionan/adoptan, pero necesitan un reconciliador compatible antes de modificar código. No se sustituye su framework, autenticación o persistencia. Cambios explícitos de lenguaje, framework, base de datos o límites de despliegue se bloquean y requieren un plan específico.

Solo se reemplazan archivos registrados como generados por el kit cuyo hash actual sigue intacto. Se conservan sus permisos. Código o contratos personalizados bloquean la mejora antes de escribir. README, arquitectura y procedencia personalizados se conservan y se indican en el plan. Archivos adicionales, datos, secretos y configuraciones privadas no se eliminan. No se aplican migraciones ni se ejecutan herramientas, pruebas, proveedores, contenedores o servidores al aplicar.

Las operaciones usan un bloqueo local del kit, archivos exclusivos, copias antes/después en `.devkit/operations/<proposalId>` y reemplazos temporales. El bloqueo coordina al kit, no editores externos que lo ignoren. Una caída entre escrituras puede dejar una operación parcial: las copias permanecen, se informa reconciliación y se bloquea otro intento automático. No se borra información para restaurar ni se promete atomicidad de múltiples archivos. `.devkit/.gitignore` excluye copias y bloqueos de publicaciones accidentales.

Los registros antiguos se conservan como evidencia de su estado anterior. Tras una mejora, su comprobador puede informar diferencias respecto a esa versión: usa `memory status` para el estado vigente. No se falsifica la integridad de la plantilla anterior. El nuevo estado vuelve a `not-run`; aplicar código no acredita pruebas o migraciones aprobadas.

## Verificación

`npm run test:memory` prueba adopción, esquemas, procedencia, privacidad, revisiones, personalizaciones, planes alterados, cambios tardíos, operaciones sin cambios, fallos parciales y rechazo de migraciones tecnológicas implícitas. Un proyecto de inventario + CRM se amplía en una carpeta temporal y ejecuta las cinco pruebas HTTP/SQLite del ejemplo completo. Usa puertos efímeros en localhost y adaptadores simulados para proveedores, sin servicios reales.

[Código](../../scripts/memory/) · [Pruebas](../../tests/kit/memory.test.js) · [KIT-FIRST](../kit-first/README.md)

## Evidencia de aceptación local

El esquema admite `verification.proof` opcional con host/runtime, conteos, plan, huella de fuentes y alcance. Los manifiestos anteriores siguen válidos. `composition acceptance` registra este dato únicamente en sus propios proyectos temporales tras ejecutar pruebas; generar/adoptar mantiene `not-run`. Un resultado `passed` es evidencia local de esa instantánea, no certificación de canales reales. Pruebas personalizadas ejecutadas manualmente no se importan automáticamente. Un cambio de código exige nuevas pruebas; la evidencia histórica no elimina el drift detectado.
