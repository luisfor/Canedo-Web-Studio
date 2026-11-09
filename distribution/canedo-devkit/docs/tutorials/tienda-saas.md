# Preparar una tienda SaaS con CRM

Desde la raíz del kit, con las dependencias del propio kit ya disponibles y Node compatible existente:

```sh
node scripts/devkit.js plan "Crear SaaS multiempresa para tiendas con inventario compras proveedores ventas caja CRM omnicanal WhatsApp Facebook Instagram chatbot agenda recordatorios suscripciones mensuales cuotas" --out /ruta/nueva/mi-tienda --json
```

`plan` no escribe el proyecto. Revisa requisitos, evidencia KIT-FIRST, módulos, procedencia, archivos/contratos, comandos y limitaciones. Si solicita aclaraciones, reformula la solicitud; no fuerces generación. Una ruta existente se inspecciona y requiere mejora compatible, nunca regeneración.

Para conservar y reutilizar exactamente el plan, en una shell POSIX (en PowerShell adapta ruta y salida UTF-8):

```sh
node scripts/devkit.js plan "Crear SaaS multiempresa inventario compras ventas caja CRM WhatsApp Facebook Instagram chatbot suscripciones mensuales cuotas" --out /ruta/nueva/mi-tienda --json > /tmp/mi-tienda.plan.json
node scripts/devkit.js create --file /tmp/mi-tienda.plan.json --out /ruta/nueva/mi-tienda --json
```

El segundo comando escribe solo en destino nuevo y registra memoria. No ejecuta instalaciones, migraciones, servidores o proveedores. Cambios de catálogo/destino invalidan el plan; vuelve a planificar.

Tras revisar el código generado, desde esa carpeta:

```sh
npm test
```

Las pruebas usan SQLite y HTTP locales temporales; puertos firmados/IA son fixtures simulados. No hace falta instalar dependencias de la aplicación Node generada. Para iniciar después: crea privadamente `secrets/actors.json` según el README generado, revisa DATA_DIR y ejecuta manualmente `npm run migrate`, luego `npm start`. No uses datos v1 para saltarte la migración bloqueada.

Para SaaS, un operador autorizado configura planes/suscripción antes de escrituras de negocio; ver [operación y payloads](../monetization/README.md). Abre `http://127.0.0.1:8080/` para la bandeja mínima. Las credenciales se conservan solo en la memoria de esa pestaña. Ningún mensaje sale a plataformas reales.

## Verificación integral del kit

```sh
npm run kit:composition -- acceptance --json
```

Es una operación de pruebas explícita: crea diez destinos temporales (A–I y solicitud integrada), valida planes/contratos/Compose, ejecuta sus pruebas y registra evidencia local en revisiones de memoria. Elimina solo sus directorios temporales. No modifica proyectos existentes ni certifica plataformas externas. Las pruebas agrupadas activan los casos relevantes a los módulos seleccionados; no significan 52 integraciones distintas ni 52 canales reales.

La adopción inicial marca verificación `not-run`. Solo una ejecución real de aceptación puede registrar su resultado; `passed` cubre el código/pruebas locales de esa instantánea. La prueba conserva módulos externos pendientes. Para proyectos del usuario, ejecutar `npm test` por separado no actualiza automáticamente la memoria; la importación de resultados de pruebas personalizadas aún no está implementada.

## Continuar desarrollo

```sh
npm run kit:memory -- status --project /ruta/mi-proyecto --json
node scripts/devkit.js enhance "Agregar chatbot" --project /ruta/mi-proyecto --json
```

El reconciliador automático actual cubre v1 compatible. V2/Python se inspeccionan y conservan, pero cambios incrementales quedan bloqueados hasta un adaptador revisado específico. Para v1, revisa el plan, preservados y conflictos y sigue [continuidad](../continuity/README.md); no edites JSON para eludir bloqueos. Codex/MCP consulta el mismo estado, sin reemplazar personalizaciones.
