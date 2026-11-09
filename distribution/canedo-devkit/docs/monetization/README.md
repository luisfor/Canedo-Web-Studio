# SaaS, cuotas y combinaciones

El arquetipo `node-business` incorpora suscripciones cuando se solicitan `saas`, `multiempresa`, `suscripciones` o `cuotas`. Es un backend local multiempresa, no una plataforma de cobros o un servicio ya desplegado.

## Operación explícita

Tras revisar y ejecutar manualmente las migraciones, configura actores privados. Solo un admin marcado `platformAdmin:true` en el archivo privado puede crear planes y asignar suscripciones. Un admin del cliente no puede ampliarse límites ni otorgarse ese atributo mediante la API. El operador continúa limitado a la empresa de su credencial; no hay selector global de empresa. OIDC, MFA y portal de autoservicio siguen pendientes.

1. `POST /saas/plans`: `{id,name,limits:{contacts,messages,conversations,aiCalls,seats}}`.
2. `POST /saas/subscription`: `{planId,status,validUntil}`. Fechas SaaS: milisegundos epoch; estado trialing/active/suspended/cancelled. Este registro es una asignación local por operador, no prueba de pago.
3. `GET /saas/plans`, `/saas/subscription`, `/saas/usage`: consultar solo la empresa autenticada.

X-Tenant-Id, Bearer de actor e Idempotency-Key son obligatorios en escrituras. Sin suscripción activa/vigente, se rechazan nuevas escrituras de negocio. Las lecturas siguen disponibles para revisión/exportación manual. No se borran datos por suspensión o cambio de plan. Planes ya suscritos son inmutables; crear un ID nuevo para cambiar límites. Se rechazan planes por debajo del consumo actual o miembros configurados; las credenciales nuevas tampoco eluden el límite de asientos.

Las cuotas cubren **creaciones mensuales** de contactos/conversaciones, mensajes entrantes y registrados de salida, y reservas de llamada IA. No representan contactos totales, mensajes realmente entregados ni tokens de modelo facturables. El mes se calcula en UTC con el reloj del servidor. Son límites por empresa/mes, no límites de tasa por IP. Mensajes entrantes crean contacto/conversación sin consentimiento; si se agota la cuota se rechaza el evento completo para revisión/reintento del proveedor. No hay envío externo ni respuesta automática. Alertas al 80% se persisten sin mandar correo.

Las mutaciones y cuotas del CRM comparten transacción SQLite. Repetir la misma clave/payload no consume de nuevo; una clave distinta constituye otra operación. Una llamada IA incierta conserva reserva y requiere reconciliación, sin reintento pagado automático. Comercio y CRM usan bases separadas; se comprueba suscripción antes de escrituras comerciales, pero no se anuncia una cuota transaccional de ventas entre dos bases. Lecturas y operaciones de IAM no son métricas cobrables. Listados hasta 1000; SQLite es para un host/escritor, no HA.

## Combinaciones

```sh
npm run kit:packages -- combinations --json
npm run kit:packages -- combination --name H --docker --json
node scripts/devkit.js plan "Crear SaaS multiempresa con inventario ventas caja CRM WhatsApp Facebook Instagram chatbot suscripciones mensuales" --out /ruta/nueva/tienda --json
```

| Combinación | Base funcional local | Límite externo/pendiente |
|---|---|---|
| A: CRM + WhatsApp/Messenger/Instagram | Contactos, conversaciones, pipeline, roles, firmas y puertos separados | Sin envío/verificación de plataformas |
| B: CRM + TikTok + IA | CRM, handoff y contrato chatbot | TikTok bloqueado; IA deshabilitada |
| C: POS + inventario + caja + CRM | Venta transaccional, stock, caja y evento CRM | Sin impuestos, devoluciones o POS visual completo |
| D: tienda + pagos + inventario + CRM | `/shop/catalog`, `/shop/orders` reutilizan productos/venta; intención de pago con importe de venta | Intención `provider-disabled`, ningún cobro |
| E: agenda + chatbot + recordatorios | Citas sin solapamiento, puerto IA, recordatorios persistidos | Despacho manual y proveedor IA pendiente |
| F: marketing + contenido + CRM | Borradores manuales, campañas y audiencia segmentada con consentimiento | Sin generación IA, publicación o envío social |
| G: ERP + inventario + facturación + CRM | Comercio y borrador ligado a venta | `not-fiscal-draft`, sin número fiscal/emisión autorizada |
| H: SaaS + CRM omnicanal + IA | Planes, suscripción, cuotas, alertas, roles y CRM | Sin cobros ni plataformas verificadas |
| I: tienda + compras/ventas/caja + WhatsApp/Instagram/IA | Comercio integrado, proveedores, CRM y puertos | Sin mensajería remota o IA activa |

Los pedidos de `/shop/orders` están autenticados; no es un checkout público ni un portal cliente completo. Borradores de pago/factura no modifican estados financieros ni envían nada. La lectura de venta para borradores usa el puerto de comercio con límite de 1000 ventas listadas; paginación/búsqueda directa deben ampliarse antes de mayor escala. Ninguna combinación declara un producto comercial completo por generar estos archivos.

El registro de combinaciones es versionado, validado y ampliable. Si un requisito nuevo carece de generador, el plan bloquea generación en lugar de omitirlo. Las capacidades de pago/emisión/publicación no se activan mediante una bandera ficticia de verificación.

## Comercialización

Se pueden diseñar suscripciones mensuales/anuales, cobro por usuario/sucursal/conversaciones/consumo, módulos adicionales, instalación personalizada, soporte y mantenimiento. Marca blanca y licencias de uso requieren revisar las licencias efectivamente incluidas. El kit no importa código de referencias ni garantiza ingresos. Antes de cobrar: proveedor autorizado, contratos fiscales, conciliación de webhooks reales, seguridad, backups/restauración, límites del proveedor, retención y pruebas de producción. Nada de ello se ejecuta automáticamente.
