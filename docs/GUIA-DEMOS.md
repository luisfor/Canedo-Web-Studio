# Demos y tutoriales del kit

Los ejemplos incluidos se pueden abrir localmente. Un enlace al HTML en GitHub muestra su código; no equivale a una demo publicada. El kit no tiene una galería pública propia desplegada.

## Generar una tienda con CRM

El [tutorial de composición](../examples/composition/README.md) genera un backend propio con productos, inventario, ventas, caja, compras, proveedores, contactos CRM y adaptadores WhatsApp/chatbot deshabilitados. Incluye contratos OpenAPI, SQLite, migraciones, pruebas y Compose opcional. `npm run kit:composition -- verify --json` prueba ambas arquitecturas con datos temporales y HTTP real en localhost, sin contenedores ni proveedores externos. No hay UI o demo pública de esta aplicación. Consulta [arquitectura y límites](PROJECT-COMPOSITION.md).

## Ver las demos locales

Desde la raíz del repositorio, con Python 3 instalado:

```bash
python3 -m http.server 4173 --bind 127.0.0.1 --directory ejemplos/web-de-practica
```

Abre [la demo del restaurante ficticio](http://127.0.0.1:4173/). Detén el servidor con Ctrl+C. Se sirve solo la carpeta del ejemplo, nunca la raíz del kit ni sus secretos. Esta web tiene defectos intencionales para practicar rediseño. Lee [la explicación](../ejemplos/LEEME.md).

Para ver el starter, detén el servidor anterior y ejecuta:

```bash
python3 -m http.server 4173 --bind 127.0.0.1 --directory starter-template
```

Abre [la plantilla local](http://127.0.0.1:4173/). Los marcadores de contenido son esperables en una plantilla; reemplázalos antes de entregar un sitio.

En equipos donde Python se llama `python` o `py -3`, usa ese ejecutable en lugar de `python3`. El servidor local no instala dependencias ni despliega el sitio.

## Crear y validar una web

1. Instala las dependencias del kit con `npm ci`.
2. Ejecuta `npm run new-site` y responde el cuestionario. Crea una carpeta nueva en `cazas/<slug>/`.
3. Revisa contenido, imágenes y datos reales del negocio. No publiques los del ejemplo ficticio.
4. Ejecuta `npm run validate -- <slug>` con el nombre, sin el prefijo `cazas/`.
5. Sirve únicamente esa carpeta con tu servidor local y revisa móvil y escritorio.
6. Consulta [la lista de entrega](NEW-SITE-CHECKLIST.md) y [despliegue](../despliegue.md) cuando decidas publicarla.

## Explorar capacidades y requisitos

```bash
npm run kit:catalog
npm run kit:catalog -- --profile react --json
npm run kit:doctor -- --profile react
npm run kit:validate
npm run test:kit
```

El catálogo y sus validaciones no requieren una API de IA. El doctor detecta CLIs; no instala SDKs, conecta cuentas ni certifica compatibilidad de versiones.

## Design-to-Web

Consulta [el diseño del pipeline](DESIGN-TO-WEB.md), [el analizador](../scripts/design-to-web/analyzer.js), [el builder](../scripts/design-to-web/builder.js) y [sus pruebas](../tests/design-to-web/).

Los comandos existentes son `design-to-web:analyze`, `design-to-web:build` y `design-to-web:qa`; no hay un comando único `design-to-web`. El adaptador mock produce datos de prueba y no demuestra comprensión visual de una imagen. Para el proveedor real, consulta los adaptadores y configura tus propias credenciales privadas.

## Automatismos

Los bots no son demos sin configuración: necesitan sus recursos, permisos y proveedores. Usa los README específicos para reproducirlos en un entorno propio:

- [Blog](../automatismos/README.md).
- [Bot social](../automatismos/social-media-bot/README.md).
- [Agente comercial](../automatismos/canedostudio-sales-agent/README.md).
- [Flujos n8n](../automatismos/n8n/README.md).

No utilices cuentas ni datos de un cliente como demo pública.

## Referencias externas

[Clone Wars](https://github.com/GorvGoyl/Clone-Wars) enlaza ejemplos, demos y tutoriales de terceros. Su disponibilidad y calidad varían. No son demos propias ni bases verificadas del kit.

El flujo de sugerir un ejemplo, descargarlo tras aceptación y convertirlo en una base reutilizable está propuesto para la evolución del kit; el README no debe presentarlo como descargador implementado.
