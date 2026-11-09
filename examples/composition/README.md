# Tienda + CRM + adaptador de chatbot

La [solicitud ejecutable](tienda-crm.request.json) genera código original. AFPVentas y Vocero son referencias arquitectónicas registradas, no dependencias descargadas. El generador incluye el flujo comercial básico, contactos/actividad CRM y puertos WhatsApp/chatbot deshabilitados por defecto.

Desde la raíz del kit, revisa primero el plan:

```bash
node scripts/kit.js composition plan --file examples/composition/tienda-crm.request.json --json > /tmp/tienda-crm.plan.json
node scripts/kit.js composition validate --file /tmp/tienda-crm.plan.json
node scripts/kit.js composition create --file /tmp/tienda-crm.plan.json --out /tmp/mi-tienda-nueva
node scripts/kit.js composition check --project /tmp/mi-tienda-nueva
```

Elige una ruta nueva. En Windows sustituye `/tmp/...` por rutas absolutas propias y usa una redirección UTF-8; no copies literalmente las rutas POSIX. Se pueden usar `npm run kit:composition -- ...` o `npm run --silent kit:composition -- ...` cuando se redirige JSON. No se instala nada ni se inicia el proyecto al generarlo.

En la carpeta generada:

```bash
npm test
```

Las pruebas usan Node existente, bases SQLite temporales, datos sintéticos y HTTP real en puertos efímeros de `127.0.0.1`; eliminan sus datos al terminar. No contactan WhatsApp, Meta ni un modelo de IA. La advertencia experimental de `node:sqlite` puede aparecer según la versión de Node.

Para ejecutar la aplicación posteriormente, revisa `README.md`, crea las credenciales locales indicadas en `secrets/README.md`, revisa las migraciones y ejecuta manualmente `npm run migrate` y `npm start`. No hace falta `npm install` en el proyecto generado. El kit no realiza estos pasos al generarlo. No contiene frontend ni autenticación de usuarios completa.

La variante independiente se elige con `architecture: "independent-services"` en una copia de la solicitud. Conserva la variante original. No hay puertos publicados en Compose ni borrado de volúmenes.

Verificación integral explícita desde el kit:

```bash
npm run kit:composition -- verify --json
```

Genera ambas arquitecturas en carpetas temporales y ejecuta sus pruebas. Requiere permiso para HTTP local; falla si el entorno lo impide. No ejecuta Docker. Consulta [arquitectura y extensiones](../../docs/PROJECT-COMPOSITION.md).
