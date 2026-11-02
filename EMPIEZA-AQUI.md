# Empieza aquí

1. Descarga o clona el kit siguiendo [INSTALACION.md](INSTALACION.md), abre la carpeta en tu asistente y usa tu propia cuenta. La conexión del asistente no obliga a contratar OpenRouter.
2. Instala las dependencias de los scripts con `npm ci` y consulta `npm run kit:catalog`.
3. Elige un trabajo concreto, por ejemplo «CRM en React y .NET» o «rediseña esta web pública». El asistente selecciona las skills correspondientes.
4. Usa `npm run kit:doctor -- --profile react` (o el perfil que necesites) para detectar CLIs ausentes. No instala SDKs ni acredita acceso al proveedor.
5. Configura solo las integraciones del proyecto. Copia `.env.example` a `.env` cuando aplique y usa claves propias. Las claves de servidor no van en HTML, JavaScript público ni apps móviles.
6. Construye y prueba el flujo solicitado. Publicar un sitio, crear infraestructura y lanzar operaciones financieras son acciones distintas de preparar su código.

Para webs estáticas existe `npm run new-site`. Para otros stacks usa las skills y el generador oficial del framework elegido; el kit no trae un generador universal de proyectos.

[Capacidades](docs/CAPACIDADES.md) · [Comparación de referencias](docs/REFERENCIAS-PRODUCTO.md)
